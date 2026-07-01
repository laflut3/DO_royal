package com.nmeo.services.account;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public class TokenService {
    private final String jwtSecret;

    public TokenService(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    public String createToken(long accountId) {
        long exp = Instant.now().plusSeconds(60 * 60 * 24 * 7).getEpochSecond();
        String header = base64Url("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
        String payload = base64Url("{\"sub\":\"" + accountId + "\",\"exp\":\"" + exp + "\"}");
        return header + "." + payload + "." + sign(header + "." + payload);
    }

    public Optional<Long> accountIdFromToken(String token) {
        if (token == null || token.isBlank()) {
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

    private String sign(String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
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
}
