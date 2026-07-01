package com.nmeo.services.impl;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import com.nmeo.dto.AuthRequest;
import com.nmeo.dto.AuthResponse;
import com.nmeo.dto.PurchaseRequest;
import com.nmeo.models.Account;
import com.nmeo.models.GameSession;
import com.nmeo.models.Player;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import io.javalin.Javalin;
import io.javalin.http.Context;

public class AccountService {
    private static final Logger logger = LogManager.getLogger(AccountService.class);
    private static final int SCHEMA_INIT_ATTEMPTS = 30;
    private static final long SCHEMA_INIT_DELAY_MILLIS = 2000L;
    private static final int SHOP_PRICE = 600;
    private static final int WIN_REWARD = 100;
    private static final int PARTICIPATION_REWARD = 10;
    private static final Set<String> GUEST_SKINS = Set.of("medic", "misa", "scout");
    private static final Set<String> SHOP_SKINS = Set.of(
            "knight", "rogue", "nova", "ember", "cipher", "oni", "mbappe",
            "oudindindoun-madindindoun", "tralalelo-tralala", "tung-tung-tung-sahur");

    private final String jdbcUrl;
    private final String dbUser;
    private final String dbPassword;
    private final String jwtSecret;
    private final boolean enabled;

    public AccountService() {
        this.jdbcUrl = normalizeJdbcUrl(env("JDBC_DATABASE_URL", env("DATABASE_URL", "")));
        this.dbUser = env("POSTGRES_USER", env("DB_USERNAME", ""));
        this.dbPassword = env("POSTGRES_PASSWORD", env("DB_PASSWORD", ""));
        this.jwtSecret = env("DO_ROYAL_JWT_SECRET", "");
        this.enabled = !jdbcUrl.isBlank() && !jwtSecret.isBlank();
        if (enabled) {
            initSchemaWithRetry();
        }
    }

    public void registerRoutes(Javalin app) {
        app.get("/health", ctx -> ctx.result("OK"));
        app.post("/auth/register", this::register);
        app.post("/auth/login", this::login);
        app.get("/auth/me", ctx -> ctx.json(requireAccount(ctx)));
        app.patch("/auth/me", this::updateAccount);
        app.get("/shop", ctx -> ctx.json(SHOP_SKINS.stream().sorted().toList()));
        app.post("/shop/buy", this::buySkin);
    }

    public Optional<Long> accountIdFromToken(String token) {
        if (!enabled || token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3 || !constantTimeEquals(parts[2], sign(parts[0] + "." + parts[1]))) {
                return Optional.empty();
            }
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            long exp = Long.parseLong(extractJsonString(payload, "exp"));
            if (Instant.now().getEpochSecond() > exp) {
                return Optional.empty();
            }
            return Optional.of(Long.parseLong(extractJsonString(payload, "sub")));
        } catch (RuntimeException exception) {
            return Optional.empty();
        }
    }

    public String allowedSkinForAccount(Long accountId, String requestedSkin) {
        String skin = requestedSkin == null || requestedSkin.isBlank() ? "misa" : requestedSkin;
        if (accountId == null) {
            return GUEST_SKINS.contains(skin) ? skin : "misa";
        }
        return accountById(accountId)
                .filter(account -> account.getOwnedSkins().contains(skin) || GUEST_SKINS.contains(skin))
                .map(account -> skin)
                .orElse("misa");
    }

    public void rewardFinishedGame(GameSession session) {
        Set<Long> rewardedAccounts = new LinkedHashSet<>();
        String winnerName = session.getWinnerName();
        String rewardKey = session.getGameId() + ":round:" + session.getRoundNumber();
        for (Player player : session.getPlayers().values()) {
            Long accountId = player.getAccountId();
            if (accountId == null || !rewardedAccounts.add(accountId)) {
                continue;
            }
            int reward = player.getName() != null && player.getName().equals(winnerName)
                    ? WIN_REWARD
                    : PARTICIPATION_REWARD;
            addCoins(accountId, rewardKey, reward);
        }
    }

    private void register(Context ctx) {
        assertEnabled();
        AuthRequest request;
        String username;
        String password;
        try {
            request = ctx.bodyAsClass(AuthRequest.class);
            username = normalizeUsername(request.getUsername());
            password = normalizePassword(request.getPassword());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            long accountId;
            try (PreparedStatement statement = connection.prepareStatement(
                    "insert into accounts(username, password_hash, coins) values (?, ?, 0) returning id")) {
                statement.setString(1, username);
                statement.setString(2, hashPassword(password));
                try (ResultSet resultSet = statement.executeQuery()) {
                    resultSet.next();
                    accountId = resultSet.getLong("id");
                }
            }
            grantSkin(connection, accountId, "six-seven");
            connection.commit();
            Account account = accountById(accountId).orElseThrow();
            ctx.status(201).json(new AuthResponse(tokenFor(accountId), account));
        } catch (SQLException exception) {
            if ("23505".equals(exception.getSQLState())) {
                ctx.status(409).json(error("Ce pseudo existe deja."));
                return;
            }
            throw new IllegalStateException(exception);
        }
    }

    private void login(Context ctx) {
        assertEnabled();
        AuthRequest request;
        String username;
        String password;
        try {
            request = ctx.bodyAsClass(AuthRequest.class);
            username = normalizeUsername(request.getUsername());
            password = normalizePassword(request.getPassword());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement("select id, password_hash from accounts where username = ?")) {
            statement.setString(1, username);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next() || !verifyPassword(password, resultSet.getString("password_hash"))) {
                    ctx.status(401).json(error("Identifiants invalides."));
                    return;
                }
                long accountId = resultSet.getLong("id");
                ctx.json(new AuthResponse(tokenFor(accountId), accountById(accountId).orElseThrow()));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void updateAccount(Context ctx) {
        Account account = requireAccount(ctx);
        AuthRequest request;
        String username;
        try {
            request = ctx.bodyAsClass(AuthRequest.class);
            username = normalizeUsername(request.getUsername());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement("update accounts set username = ? where id = ?")) {
            statement.setString(1, username);
            statement.setLong(2, account.getId());
            statement.executeUpdate();
            ctx.json(accountById(account.getId()).orElseThrow());
        } catch (SQLException exception) {
            if ("23505".equals(exception.getSQLState())) {
                ctx.status(409).json(error("Ce pseudo existe deja."));
                return;
            }
            throw new IllegalStateException(exception);
        }
    }

    private void buySkin(Context ctx) {
        Account account = requireAccount(ctx);
        PurchaseRequest request = ctx.bodyAsClass(PurchaseRequest.class);
        String skin = request.getSkin();
        if (!SHOP_SKINS.contains(skin)) {
            ctx.status(400).json(error("Skin inconnu."));
            return;
        }
        if (account.getOwnedSkins().contains(skin)) {
            ctx.json(account);
            return;
        }
        if (account.getCoins() < SHOP_PRICE) {
            ctx.status(400).json(error("Pieces insuffisantes."));
            return;
        }
        try (Connection connection = connection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement statement = connection.prepareStatement("update accounts set coins = coins - ? where id = ?")) {
                statement.setInt(1, SHOP_PRICE);
                statement.setLong(2, account.getId());
                statement.executeUpdate();
            }
            grantSkin(connection, account.getId(), skin);
            connection.commit();
            ctx.json(accountById(account.getId()).orElseThrow());
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private Account requireAccount(Context ctx) {
        assertEnabled();
        String authorization = ctx.header("Authorization");
        String token = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        Long accountId = accountIdFromToken(token).orElseThrow(() -> new IllegalArgumentException("Unauthorized"));
        return accountById(accountId).orElseThrow(() -> new IllegalArgumentException("Unauthorized"));
    }

    private Optional<Account> accountById(Long accountId) {
        try (Connection connection = connection();
             PreparedStatement accountStatement = connection.prepareStatement("select id, username, coins from accounts where id = ?")) {
            accountStatement.setLong(1, accountId);
            try (ResultSet accountResult = accountStatement.executeQuery()) {
                if (!accountResult.next()) {
                    return Optional.empty();
                }
                Set<String> skins = new LinkedHashSet<>(GUEST_SKINS);
                try (PreparedStatement skinStatement = connection.prepareStatement("select skin from account_skins where account_id = ?")) {
                    skinStatement.setLong(1, accountId);
                    try (ResultSet skinResult = skinStatement.executeQuery()) {
                        while (skinResult.next()) {
                            skins.add(skinResult.getString("skin"));
                        }
                    }
                }
                return Optional.of(new Account(
                        accountResult.getLong("id"),
                        accountResult.getString("username"),
                        accountResult.getInt("coins"),
                        skins));
            }
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void addCoins(Long accountId, String gameId, int coins) {
        try (Connection connection = connection();
             PreparedStatement insertReward = connection.prepareStatement(
                     "insert into account_rewards(account_id, game_id, coins) values (?, ?, ?) on conflict do nothing")) {
            insertReward.setLong(1, accountId);
            insertReward.setString(2, gameId);
            insertReward.setInt(3, coins);
            int inserted = insertReward.executeUpdate();
            if (inserted == 0) {
                return;
            }
            try (PreparedStatement update = connection.prepareStatement("update accounts set coins = coins + ? where id = ?")) {
                update.setInt(1, coins);
                update.setLong(2, accountId);
                update.executeUpdate();
            }
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void grantSkin(Connection connection, long accountId, String skin) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "insert into account_skins(account_id, skin) values (?, ?) on conflict do nothing")) {
            statement.setLong(1, accountId);
            statement.setString(2, skin);
            statement.executeUpdate();
        }
    }

    private void initSchema() {
        try (Connection connection = connection();
             PreparedStatement statement = connection.prepareStatement("""
                     create table if not exists accounts (
                         id bigserial primary key,
                         username text not null unique,
                         password_hash text not null,
                         coins integer not null default 0,
                         created_at timestamptz not null default now()
                     );
                     create table if not exists account_skins (
                         account_id bigint not null references accounts(id) on delete cascade,
                         skin text not null,
                         primary key(account_id, skin)
                     );
                     create table if not exists account_rewards (
                         account_id bigint not null references accounts(id) on delete cascade,
                         game_id text not null,
                         coins integer not null,
                         created_at timestamptz not null default now(),
                         primary key(account_id, game_id)
                     );
                     """)) {
            statement.execute();
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void initSchemaWithRetry() {
        IllegalStateException lastFailure = null;
        for (int attempt = 1; attempt <= SCHEMA_INIT_ATTEMPTS; attempt++) {
            try {
                initSchema();
                return;
            } catch (IllegalStateException exception) {
                Throwable cause = exception.getCause();
                if (!(cause instanceof SQLException)) {
                    throw exception;
                }
                lastFailure = exception;
                if (attempt == SCHEMA_INIT_ATTEMPTS) {
                    break;
                }
                logger.warn(
                        "Database is not ready yet, retrying schema initialization (attempt {}/{})",
                        attempt,
                        SCHEMA_INIT_ATTEMPTS);
                sleepSchemaRetryDelay();
            }
        }
        throw new IllegalStateException("Unable to initialize account schema after retries", lastFailure);
    }

    private void sleepSchemaRetryDelay() {
        try {
            TimeUnit.MILLISECONDS.sleep(SCHEMA_INIT_DELAY_MILLIS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Schema initialization interrupted", exception);
        }
    }

    private Connection connection() throws SQLException {
        if (dbUser.isBlank()) {
            return DriverManager.getConnection(jdbcUrl);
        }
        return DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
    }

    private String tokenFor(long accountId) {
        long exp = Instant.now().plusSeconds(60 * 60 * 24 * 7).getEpochSecond();
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("{\"sub\":\"" + accountId + "\",\"exp\":\"" + exp + "\"}");
        return header + "." + payload + "." + sign(header + "." + payload);
    }

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private String hashPassword(String password) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        byte[] hash = pbkdf2(password, salt);
        return "pbkdf2$310000$" + Base64.getEncoder().encodeToString(salt) + "$" + Base64.getEncoder().encodeToString(hash);
    }

    private boolean verifyPassword(String password, String storedHash) {
        String[] parts = storedHash.split("\\$");
        if (parts.length != 4 || !"pbkdf2".equals(parts[0])) {
            return false;
        }
        byte[] salt = Base64.getDecoder().decode(parts[2]);
        byte[] expectedHash = Base64.getDecoder().decode(parts[3]);
        return MessageDigest.isEqual(expectedHash, pbkdf2(password, salt));
    }

    private byte[] pbkdf2(String password, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 310000, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String normalizeUsername(String username) {
        if (username == null || !username.matches("[a-zA-Z0-9_]{3,24}")) {
            throw new IllegalArgumentException("Le pseudo doit faire 3 a 24 caracteres: lettres, chiffres ou underscore.");
        }
        return username.toLowerCase();
    }

    private static String normalizePassword(String password) {
        if (password == null || password.length() < 10 || password.length() > 128) {
            throw new IllegalArgumentException("Le mot de passe doit faire au moins 10 caracteres.");
        }
        return password;
    }

    private static String normalizeJdbcUrl(String url) {
        if (url.startsWith("postgresql://")) {
            return "jdbc:" + url;
        }
        return url;
    }

    private static String extractJsonString(String json, String key) {
        String needle = "\"" + key + "\":\"";
        int start = json.indexOf(needle);
        if (start < 0) {
            throw new IllegalArgumentException("missing " + key);
        }
        start += needle.length();
        int end = json.indexOf('"', start);
        return json.substring(start, end);
    }

    private static String base64Url(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static boolean constantTimeEquals(String first, String second) {
        return MessageDigest.isEqual(first.getBytes(StandardCharsets.UTF_8), second.getBytes(StandardCharsets.UTF_8));
    }

    private static Object error(String message) {
        return java.util.Map.of("error", message);
    }

    private static String env(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null ? defaultValue : value;
    }

    private void assertEnabled() {
        if (!enabled) {
            throw new IllegalStateException("Auth is disabled: DATABASE_URL and DO_ROYAL_JWT_SECRET are required.");
        }
    }
}
