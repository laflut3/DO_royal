package com.nmeo.services.account;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PasswordHasherTest {
    @Test
    public void shouldVerifyPasswordWithStoredIterationCount() {
        PasswordHasher fastHasher = new PasswordHasher(1000);
        PasswordHasher defaultHasher = new PasswordHasher(120000);

        String storedHash = fastHasher.hash("password-secret");

        assertTrue(defaultHasher.verify("password-secret", storedHash));
        assertFalse(defaultHasher.verify("bad-password", storedHash));
    }
}
