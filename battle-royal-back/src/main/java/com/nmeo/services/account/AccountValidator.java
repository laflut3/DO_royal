package com.nmeo.services.account;

public final class AccountValidator {
    private AccountValidator() {
    }

    public static String normalizeUsername(String username) {
        if (username == null || !username.matches("[a-zA-Z0-9_]{3,24}")) {
            throw new IllegalArgumentException("Le pseudo doit faire 3 a 24 caracteres: lettres, chiffres ou underscore.");
        }
        return username.toLowerCase();
    }

    public static String normalizePassword(String password) {
        if (password == null || password.length() < 10 || password.length() > 128) {
            throw new IllegalArgumentException("Le mot de passe doit faire au moins 10 caracteres.");
        }
        return password;
    }
}
