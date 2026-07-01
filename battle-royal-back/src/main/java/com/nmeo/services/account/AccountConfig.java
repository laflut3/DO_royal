package com.nmeo.services.account;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class AccountConfig {
    private final String jdbcUrl;
    private final String dbUser;
    private final String dbPassword;
    private final String jwtSecret;
    private final int passwordHashIterations;

    public AccountConfig() {
        this.jdbcUrl = normalizeJdbcUrl(env("JDBC_DATABASE_URL", env("DATABASE_URL", "")));
        this.dbUser = env("POSTGRES_USER", env("DB_USERNAME", ""));
        this.dbPassword = env("POSTGRES_PASSWORD", env("DB_PASSWORD", ""));
        this.jwtSecret = env("DO_ROYAL_JWT_SECRET", env("JWT_SECRET", ""));
        this.passwordHashIterations = Integer.parseInt(env("DO_ROYAL_PASSWORD_HASH_ITERATIONS", "120000"));
    }

    public boolean enabled() {
        return !jdbcUrl.isBlank() && !jwtSecret.isBlank();
    }

    public Connection connection() throws SQLException {
        if (dbUser.isBlank()) {
            return DriverManager.getConnection(jdbcUrl);
        }
        return DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
    }

    public String jwtSecret() {
        return jwtSecret;
    }

    public int passwordHashIterations() {
        return passwordHashIterations;
    }

    private static String normalizeJdbcUrl(String url) {
        if (url.startsWith("postgresql://")) {
            return "jdbc:" + url;
        }
        return url;
    }

    private static String env(String name, String defaultValue) {
        String value = System.getenv(name);
        if (value != null) {
            return value;
        }
        return System.getProperty(name, defaultValue);
    }
}
