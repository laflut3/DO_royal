package com.nmeo.services.account;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

public class PasswordHasher {
    private static final int SALT_LENGTH_BYTES = 16;
    private static final int KEY_LENGTH_BITS = 256;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final int iterations;

    public PasswordHasher(int iterations) {
        this.iterations = iterations;
    }

    public String hash(String password) {
        byte[] salt = new byte[SALT_LENGTH_BYTES];
        SECURE_RANDOM.nextBytes(salt);
        byte[] hash = pbkdf2(password, salt, iterations);
        return "pbkdf2$" + iterations + "$"
                + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(hash);
    }

    public boolean verify(String password, String storedHash) {
        String[] parts = storedHash.split("\\$");
        if (parts.length != 4 || !"pbkdf2".equals(parts[0])) {
            return false;
        }
        int storedIterations = Integer.parseInt(parts[1]);
        byte[] salt = Base64.getDecoder().decode(parts[2]);
        byte[] expectedHash = Base64.getDecoder().decode(parts[3]);
        return MessageDigest.isEqual(expectedHash, pbkdf2(password, salt, storedIterations));
    }

    private byte[] pbkdf2(String password, byte[] salt, int iterationCount) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterationCount, KEY_LENGTH_BITS);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}
