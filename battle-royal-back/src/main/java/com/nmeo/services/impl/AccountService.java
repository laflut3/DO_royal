package com.nmeo.services.impl;

import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import com.nmeo.dto.AuthRequest;
import com.nmeo.dto.AuthResponse;
import com.nmeo.dto.PurchaseRequest;
import com.nmeo.models.Account;
import com.nmeo.models.GameSession;
import com.nmeo.models.Player;
import com.nmeo.services.account.AccountCatalog;
import com.nmeo.services.account.AccountConfig;
import com.nmeo.services.account.AccountRepository;
import com.nmeo.services.account.AccountValidator;
import com.nmeo.services.account.PasswordHasher;
import com.nmeo.services.account.TokenService;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import io.javalin.Javalin;
import io.javalin.http.Context;

public class AccountService {
    private static final Logger logger = LogManager.getLogger(AccountService.class);
    private static final int SCHEMA_INIT_ATTEMPTS = 30;
    private static final long SCHEMA_INIT_DELAY_MILLIS = 2000L;

    private final AccountConfig config;
    private final AccountRepository repository;
    private final PasswordHasher passwordHasher;
    private final TokenService tokenService;

    public AccountService() {
        this.config = new AccountConfig();
        this.repository = new AccountRepository(config);
        this.passwordHasher = new PasswordHasher(config.passwordHashIterations());
        this.tokenService = new TokenService(config.jwtSecret());
        if (config.enabled()) {
            initSchemaWithRetry();
        }
    }

    public void registerRoutes(Javalin app) {
        app.get("/health", ctx -> ctx.result("OK"));
        app.post("/auth/register", this::register);
        app.post("/auth/login", this::login);
        app.get("/auth/me", ctx -> ctx.json(requireAccount(ctx)));
        app.patch("/auth/me", this::updateAccount);
        app.get("/shop", ctx -> ctx.json(AccountCatalog.SHOP_SKINS.stream().sorted().toList()));
        app.post("/shop/buy", this::buySkin);
    }

    public Optional<Long> accountIdFromToken(String token) {
        if (!config.enabled()) {
            return Optional.empty();
        }
        return tokenService.accountIdFromToken(token);
    }

    public String allowedSkinForAccount(Long accountId, String requestedSkin) {
        String skin = requestedSkin == null || requestedSkin.isBlank()
                ? AccountCatalog.DEFAULT_GUEST_SKIN
                : requestedSkin;
        if (accountId == null) {
            return AccountCatalog.GUEST_SKINS.contains(skin) ? skin : AccountCatalog.DEFAULT_GUEST_SKIN;
        }
        return accountById(accountId)
                .filter(account -> account.getOwnedSkins().contains(skin) || AccountCatalog.GUEST_SKINS.contains(skin))
                .map(account -> skin)
                .orElse(AccountCatalog.DEFAULT_GUEST_SKIN);
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
                    ? AccountCatalog.WIN_REWARD
                    : AccountCatalog.PARTICIPATION_REWARD;
            addCoins(accountId, rewardKey, reward);
        }
    }

    private void register(Context ctx) {
        assertEnabled();
        AuthRequest request = ctx.bodyAsClass(AuthRequest.class);
        String username;
        String password;
        try {
            username = AccountValidator.normalizeUsername(request.getUsername());
            password = AccountValidator.normalizePassword(request.getPassword());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }

        try {
            Account account = repository.create(username, passwordHasher.hash(password));
            ctx.status(201).json(new AuthResponse(tokenService.createToken(account.getId()), account));
        } catch (SQLException exception) {
            if (isUniqueViolation(exception)) {
                ctx.status(409).json(error("Ce pseudo existe deja."));
                return;
            }
            throw new IllegalStateException(exception);
        }
    }

    private void login(Context ctx) {
        assertEnabled();
        AuthRequest request = ctx.bodyAsClass(AuthRequest.class);
        String username;
        String password;
        try {
            username = AccountValidator.normalizeUsername(request.getUsername());
            password = AccountValidator.normalizePassword(request.getPassword());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }

        try {
            Optional<AccountRepository.AccountPassword> accountPassword = repository.findPasswordByUsername(username);
            if (accountPassword.isEmpty() || !passwordHasher.verify(password, accountPassword.get().passwordHash())) {
                ctx.status(401).json(error("Identifiants invalides."));
                return;
            }
            long accountId = accountPassword.get().accountId();
            ctx.json(new AuthResponse(tokenService.createToken(accountId), accountById(accountId).orElseThrow()));
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void updateAccount(Context ctx) {
        Account account = requireAccount(ctx);
        AuthRequest request = ctx.bodyAsClass(AuthRequest.class);
        String username;
        try {
            username = AccountValidator.normalizeUsername(request.getUsername());
        } catch (IllegalArgumentException exception) {
            ctx.status(400).json(error(exception.getMessage()));
            return;
        }
        try {
            ctx.json(repository.updateUsername(account.getId(), username));
        } catch (SQLException exception) {
            if (isUniqueViolation(exception)) {
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
        if (!AccountCatalog.SHOP_SKINS.contains(skin)) {
            ctx.status(400).json(error("Skin inconnu."));
            return;
        }
        if (account.getOwnedSkins().contains(skin)) {
            ctx.json(account);
            return;
        }
        if (account.getCoins() < AccountCatalog.SHOP_PRICE) {
            ctx.status(400).json(error("Pieces insuffisantes."));
            return;
        }
        try {
            ctx.json(repository.buySkin(account, skin));
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
        try {
            return repository.findById(accountId);
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void addCoins(Long accountId, String gameId, int coins) {
        try {
            repository.addReward(accountId, gameId, coins);
        } catch (SQLException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private void initSchemaWithRetry() {
        SQLException lastFailure = null;
        for (int attempt = 1; attempt <= SCHEMA_INIT_ATTEMPTS; attempt++) {
            try {
                repository.initSchema();
                return;
            } catch (SQLException exception) {
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

    private void assertEnabled() {
        if (!config.enabled()) {
            throw new IllegalStateException("Auth is disabled: DATABASE_URL and DO_ROYAL_JWT_SECRET are required.");
        }
    }

    private static boolean isUniqueViolation(SQLException exception) {
        return "23505".equals(exception.getSQLState());
    }

    private static Object error(String message) {
        return java.util.Map.of("error", message);
    }
}
