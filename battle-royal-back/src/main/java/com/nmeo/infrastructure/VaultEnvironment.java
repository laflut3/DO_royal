package com.nmeo.infrastructure;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class VaultEnvironment {
    private static final Pattern JSON_STRING = Pattern.compile("\"%s\"\\s*:\\s*\"((?:\\\\.|[^\"])*)\"");

    private VaultEnvironment() {
    }

    public static void load() {
        String vaultAddr = env("VAULT_ADDR", "").replaceAll("/+$", "");
        if (vaultAddr.isBlank()) {
            return;
        }

        String authMethod = env("VAULT_AUTH_METHOD", "kubernetes");
        if (!"kubernetes".equals(authMethod)) {
            throw new IllegalStateException("Unsupported VAULT_AUTH_METHOD=" + authMethod);
        }

        String role = requiredEnv("VAULT_K8S_ROLE");
        String authMount = env("VAULT_K8S_AUTH_MOUNT", "kubernetes");
        String kvMount = env("VAULT_KV_MOUNT", "secret");
        String secretPath = env("VAULT_SECRET_PATH", "prod/do-royal");
        String jwtPath = env("VAULT_K8S_JWT_PATH", "/var/run/secrets/kubernetes.io/serviceaccount/token");
        String mappings = env("VAULT_ENV_MAPPINGS",
                "SERVER_PORT=SERVER_PORT,JDBC_DATABASE_URL=JDBC_DATABASE_URL,POSTGRES_USER=POSTGRES_USER,"
                        + "POSTGRES_PASSWORD=POSTGRES_PASSWORD,DO_ROYAL_JWT_SECRET=DO_ROYAL_JWT_SECRET");

        try {
            String jwt = Files.readString(Path.of(jwtPath), StandardCharsets.UTF_8).trim();
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .build();
            String token = login(client, vaultAddr, authMount, role, jwt);
            String secret = getSecret(client, vaultAddr, kvMount, secretPath, token);
            loadMappings(secret, mappings);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load Vault secrets", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while loading Vault secrets", exception);
        }
    }

    private static String login(HttpClient client, String vaultAddr, String authMount, String role, String jwt)
            throws IOException, InterruptedException {
        String body = "{\"role\":\"" + jsonEscape(role) + "\",\"jwt\":\"" + jsonEscape(jwt) + "\"}";
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(vaultAddr + "/v1/auth/" + authMount + "/login"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        requireSuccess(response, "Vault Kubernetes auth failed");
        return requiredJsonString(response.body(), "client_token");
    }

    private static String getSecret(HttpClient client, String vaultAddr, String kvMount, String secretPath, String token)
            throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(vaultAddr + "/v1/" + kvMount + "/data/" + secretPath))
                .timeout(Duration.ofSeconds(10))
                .header("X-Vault-Token", token)
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        requireSuccess(response, "Vault secret read failed");
        return response.body();
    }

    private static void loadMappings(String secret, String mappings) {
        for (String mapping : mappings.split(",")) {
            String[] parts = mapping.trim().split("=", 2);
            String target = parts[0].trim();
            String source = parts.length == 2 ? parts[1].trim() : target;
            if (target.isBlank() || source.isBlank()) {
                throw new IllegalStateException("Invalid VAULT_ENV_MAPPINGS entry: " + mapping);
            }
            System.setProperty(target, requiredJsonString(secret, source));
        }
    }

    private static void requireSuccess(HttpResponse<String> response, String message) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException(message + ": HTTP " + response.statusCode() + " " + response.body());
        }
    }

    private static String requiredJsonString(String json, String key) {
        Matcher matcher = Pattern.compile(String.format(JSON_STRING.pattern(), Pattern.quote(key))).matcher(json);
        if (!matcher.find()) {
            throw new IllegalStateException(key + " must exist in Vault response");
        }
        return unescapeJson(matcher.group(1));
    }

    private static String env(String name, String defaultValue) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? defaultValue : value;
    }

    private static String requiredEnv(String name) {
        String value = env(name, "");
        if (value.isBlank()) {
            throw new IllegalStateException(name + " is required");
        }
        return value;
    }

    private static String jsonEscape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String unescapeJson(String value) {
        return value.replace("\\\"", "\"").replace("\\\\", "\\");
    }
}
