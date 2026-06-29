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
    private final GameService gameService;
    private final Map<UUID, PlayerRegistration> registrationsBySocket = new ConcurrentHashMap<>();

    @Override
    public void createPlayer(UUID socketUuid, UUID gameId, Player player) {
        if (socketUuid == null || gameId == null || player == null) {
            throw new IllegalArgumentException("socketUuid, gameId and player are required");
        }
        normalizePlayer(socketUuid, player);

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
        registrationsBySocket.put(socketUuid, new PlayerRegistration(gameId, player.getUuid()));
    }

    @Override
    public void updatePlayer(UUID socketUuid, UUID gameId, Player player) {
        if (socketUuid == null || gameId == null || player == null) {
            throw new IllegalArgumentException("socketUuid, gameId and player are required");
        }
        normalizePlayer(socketUuid, player);

        Map<String, Player> players = gameService.getSession(gameId)
                .orElseThrow(() -> new IllegalArgumentException("game not found"))
                .getPlayers();
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
                .ifPresent(session -> session.getPlayers().remove(registration.getPlayerUuid()));
        return registration.getGameId();
    }

    @Override
    public List<Player> getPlayersVisibleBy(UUID gameId, UUID socketUuid) {
        Map<String, Player> players = gameService.getSession(gameId)
                .map(session -> session.getPlayers())
                .orElse(Map.of());

        PlayerRegistration currentPlayer = registrationsBySocket.get(socketUuid);
        return players.values().stream()
                .filter(player -> currentPlayer == null || !player.getUuid().equals(currentPlayer.getPlayerUuid()))
                .toList();
    }

    private void normalizePlayer(UUID socketUuid, Player player) {
        if (player.getUuid() == null || player.getUuid().isBlank()) {
            player.setUuid(socketUuid.toString());
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
