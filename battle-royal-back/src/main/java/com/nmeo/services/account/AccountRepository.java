package com.nmeo.services.account;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import com.nmeo.models.Account;

public class AccountRepository {
    private final AccountConfig config;

    public AccountRepository(AccountConfig config) {
        this.config = config;
    }

    public Account create(String username, String passwordHash) throws SQLException {
        try (Connection connection = config.connection()) {
            connection.setAutoCommit(false);
            long accountId;
            try (PreparedStatement statement = connection.prepareStatement(
                    "insert into accounts(username, password_hash, coins) values (?, ?, 0) returning id")) {
                statement.setString(1, username);
                statement.setString(2, passwordHash);
                try (ResultSet resultSet = statement.executeQuery()) {
                    resultSet.next();
                    accountId = resultSet.getLong("id");
                }
            }
            grantSkin(connection, accountId, AccountCatalog.DEFAULT_REGISTERED_SKIN);
            Account account = findById(connection, accountId).orElseThrow();
            connection.commit();
            return account;
        }
    }

    public Optional<AccountPassword> findPasswordByUsername(String username) throws SQLException {
        try (Connection connection = config.connection();
             PreparedStatement statement = connection.prepareStatement("select id, password_hash from accounts where username = ?")) {
            statement.setString(1, username);
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    return Optional.empty();
                }
                return Optional.of(new AccountPassword(resultSet.getLong("id"), resultSet.getString("password_hash")));
            }
        }
    }

    public Optional<Account> findById(Long accountId) throws SQLException {
        try (Connection connection = config.connection()) {
            return findById(connection, accountId);
        }
    }

    public Account updateUsername(long accountId, String username) throws SQLException {
        try (Connection connection = config.connection();
             PreparedStatement statement = connection.prepareStatement("update accounts set username = ? where id = ?")) {
            statement.setString(1, username);
            statement.setLong(2, accountId);
            statement.executeUpdate();
        }
        return findById(accountId).orElseThrow();
    }

    public Account buySkin(Account account, String skin) throws SQLException {
        try (Connection connection = config.connection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement statement = connection.prepareStatement(
                    "update accounts set coins = coins - ? where id = ? and coins >= ?")) {
                statement.setInt(1, AccountCatalog.SHOP_PRICE);
                statement.setLong(2, account.getId());
                statement.setInt(3, AccountCatalog.SHOP_PRICE);
                if (statement.executeUpdate() == 0) {
                    connection.rollback();
                    return findById(account.getId()).orElseThrow();
                }
            }
            grantSkin(connection, account.getId(), skin);
            Account updatedAccount = findById(connection, account.getId()).orElseThrow();
            connection.commit();
            return updatedAccount;
        }
    }

    public boolean addReward(Long accountId, String gameId, int coins) throws SQLException {
        try (Connection connection = config.connection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement insertReward = connection.prepareStatement(
                    "insert into account_rewards(account_id, game_id, coins) values (?, ?, ?) on conflict do nothing")) {
                insertReward.setLong(1, accountId);
                insertReward.setString(2, gameId);
                insertReward.setInt(3, coins);
                if (insertReward.executeUpdate() == 0) {
                    connection.rollback();
                    return false;
                }
            }
            try (PreparedStatement update = connection.prepareStatement("update accounts set coins = coins + ? where id = ?")) {
                update.setInt(1, coins);
                update.setLong(2, accountId);
                update.executeUpdate();
            }
            connection.commit();
            return true;
        }
    }

    public void initSchema() throws SQLException {
        try (Connection connection = config.connection();
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
        }
    }

    private Optional<Account> findById(Connection connection, Long accountId) throws SQLException {
        try (PreparedStatement accountStatement = connection.prepareStatement("select id, username, coins from accounts where id = ?")) {
            accountStatement.setLong(1, accountId);
            try (ResultSet accountResult = accountStatement.executeQuery()) {
                if (!accountResult.next()) {
                    return Optional.empty();
                }
                Set<String> skins = new LinkedHashSet<>(AccountCatalog.GUEST_SKINS);
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

    public record AccountPassword(long accountId, String passwordHash) {
    }
}
