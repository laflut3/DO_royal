package com.nmeo.services.impl;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.nmeo.models.GameSession;
import com.nmeo.models.GameStatus;
import com.nmeo.models.Player;
import com.nmeo.models.PlayerRegistration;
import com.nmeo.services.IPlayerService;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class PlayerService implements IPlayerService {
    private static final double TILE_SIZE = 32.0;
    private static final double PLAYER_VISIBILITY_TILE_RANGE = 100.0;
    private static final double PLAYER_VISIBILITY_RANGE = TILE_SIZE * PLAYER_VISIBILITY_TILE_RANGE;

    private final GameService gameService;
    private final AccountService accountService;
    private final Map<UUID, PlayerRegistration> registrationsBySocket = new ConcurrentHashMap<>();

    public PlayerService(GameService gameService) {
        this(gameService, null);
    }

    public void createPlayer(UUID socketUuid, UUID gameId, Player player, String authToken) {
        Long accountId = resolveAccountId(authToken);
        normalizePlayer(socketUuid, player, accountId);
        createPlayer(socketUuid, gameId, player);
    }

    @Override
    public void createPlayer(UUID socketUuid, UUID gameId, Player player) {
        if (socketUuid == null || gameId == null || player == null) {
            throw new IllegalArgumentException("socketUuid, gameId and player are required");
        }
        normalizePlayer(socketUuid, player, player.getAccountId());

        GameSession session = gameService.getSession(gameId)
                .orElseThrow(() -> new IllegalArgumentException("game not found"));
        if (session.getStatus() == GameStatus.STARTING || session.getStatus() == GameStatus.PLAYING) {
            player.setIsAlive(false);
            player.setHealth(0);
            player.setShield(0);
        }
        Map<String, Player> players = session.getPlayers();
        if (players.containsKey(player.getUuid())) {
            throw new IllegalArgumentException("A player with the same uuid already exists in this game.");
        }

        players.put(player.getUuid(), player);
        gameService.assignOwnerIfMissing(gameId, player.getUuid());
        registrationsBySocket.put(socketUuid, new PlayerRegistration(gameId, player.getUuid()));
    }

    @Override
    public void updatePlayer(UUID socketUuid, UUID gameId, Player player) {
        if (socketUuid == null || gameId == null || player == null) {
            throw new IllegalArgumentException("socketUuid, gameId and player are required");
        }
        Map<String, Player> players = gameService.getSession(gameId)
                .orElseThrow(() -> new IllegalArgumentException("game not found"))
                .getPlayers();
        Player existingPlayer = players.get(player.getUuid());
        Long accountId = player.getAccountId() != null
                ? player.getAccountId()
                : existingPlayer == null ? null : existingPlayer.getAccountId();
        normalizePlayer(socketUuid, player, accountId);
        players.put(player.getUuid(), player);
        registrationsBySocket.put(socketUuid, new PlayerRegistration(gameId, player.getUuid()));
    }

    @Override
    public UUID removePlayer(UUID socketUuid) {
        PlayerRegistration registration = registrationsBySocket.remove(socketUuid);
        if (registration == null) {
            return null;
        }

        gameService.getSession(registration.getGameId())
                .ifPresent(session -> {
                    session.getPlayers().remove(registration.getPlayerUuid());
                    gameService.transferOwnerIfNeeded(registration.getGameId(), registration.getPlayerUuid());
                });
        return registration.getGameId();
    }

    @Override
    public String getPlayerUuidForSocket(UUID socketUuid) {
        PlayerRegistration registration = registrationsBySocket.get(socketUuid);
        return registration == null ? null : registration.getPlayerUuid();
    }

    @Override
    public List<Player> getPlayersVisibleBy(UUID gameId, UUID socketUuid) {
        PlayerRegistration currentPlayer = registrationsBySocket.get(socketUuid);
        if (currentPlayer == null) {
            return List.of();
        }

        GameSession session = gameService.getSession(gameId).orElse(null);
        if (session == null) {
            return List.of();
        }

        Map<String, Player> players = session.getPlayers();
        return players.values().stream()
                .filter(player -> !player.getUuid().equals(currentPlayer.getPlayerUuid()))
                .toList();
    }

    @Override
    public boolean canSocketSeePoint(UUID gameId, UUID socketUuid, double x, double y) {
        PlayerRegistration currentPlayer = registrationsBySocket.get(socketUuid);
        if (currentPlayer == null) {
            return false;
        }

        GameSession session = gameService.getSession(gameId).orElse(null);
        if (session == null) {
            return false;
        }

        if (session.getStatus() == GameStatus.LOBBY || session.getStatus() == GameStatus.FINISHED) {
            return true;
        }

        Player observer = session.getPlayers().get(currentPlayer.getPlayerUuid());
        return observer != null && distance(observer.getX(), observer.getY(), x, y) <= PLAYER_VISIBILITY_RANGE;
    }

    private double distance(double firstX, double firstY, double secondX, double secondY) {
        double xDelta = firstX - secondX;
        double yDelta = firstY - secondY;
        return Math.sqrt(xDelta * xDelta + yDelta * yDelta);
    }

    private Long resolveAccountId(String authToken) {
        if (accountService == null || authToken == null || authToken.isBlank()) {
            return null;
        }
        return accountService.accountIdFromToken(authToken).orElse(null);
    }

    private void normalizePlayer(UUID socketUuid, Player player, Long accountId) {
        if (player.getUuid() == null || player.getUuid().isBlank()) {
            player.setUuid(socketUuid.toString());
        }
        player.setAccountId(accountId);
        if (accountService != null) {
            player.setAtlas(accountService.allowedSkinForAccount(accountId, player.getAtlas()));
        }
        if (player.getIsAlive() == null) {
            player.setIsAlive(true);
        }
        if (player.getMaxHealth() == null || player.getMaxHealth() <= 0) {
            player.setMaxHealth(100);
        }
        if (player.getHealth() == null) {
            player.setHealth(player.getMaxHealth());
        }
        player.setHealth(Math.max(0, Math.min(player.getHealth(), player.getMaxHealth())));
        if (player.getHealth() == 0) {
            player.setIsAlive(false);
        }
        if (player.getMaxShield() == null || player.getMaxShield() <= 0) {
            player.setMaxShield(100);
        }
        if (player.getShield() == null) {
            player.setShield(0);
        }
        player.setShield(Math.max(0, Math.min(player.getShield(), player.getMaxShield())));
        if (player.getSkinTint() == null) {
            player.setSkinTint(0xFFFFFF);
        }
    }

}
