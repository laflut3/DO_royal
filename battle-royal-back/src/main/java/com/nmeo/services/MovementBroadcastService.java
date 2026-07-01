package com.nmeo.services;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.nmeo.dto.WebSocketMessage;
import com.nmeo.models.Player;

public class MovementBroadcastService implements AutoCloseable {
    private static final Logger logger = LogManager.getLogger(MovementBroadcastService.class.getName());
    private static final long BROADCAST_INTERVAL_MS = 50;

    private final BroadcastService broadcastService;
    private final Map<UUID, Map<String, Player>> pendingPlayersByGame = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler;

    public MovementBroadcastService(BroadcastService broadcastService) {
        this.broadcastService = broadcastService;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(task -> {
            Thread thread = new Thread(task, "movement-broadcast");
            thread.setDaemon(true);
            return thread;
        });
        this.scheduler.scheduleAtFixedRate(
                this::flushSafely,
                BROADCAST_INTERVAL_MS,
                BROADCAST_INTERVAL_MS,
                TimeUnit.MILLISECONDS);
    }

    public void queuePlayerMove(UUID gameId, Player player) {
        if (gameId == null || player == null || player.getUuid() == null || player.getUuid().isBlank()) {
            return;
        }
        pendingPlayersByGame
                .computeIfAbsent(gameId, ignored -> new ConcurrentHashMap<>())
                .put(player.getUuid(), Player.copyOf(player));
    }

    public void removeGame(UUID gameId) {
        if (gameId != null) {
            pendingPlayersByGame.remove(gameId);
        }
    }

    private void flushSafely() {
        try {
            flush();
        } catch (RuntimeException exception) {
            logger.warn("Unable to flush movement updates", exception);
        }
    }

    private void flush() {
        pendingPlayersByGame.forEach((gameId, pendingPlayers) -> {
            List<Player> players = drainPlayers(pendingPlayers);
            if (players.isEmpty()) {
                return;
            }
            broadcastService.broadcastMessageInGame(gameId, WebSocketMessage.playersMoved(gameId, players));
        });
    }

    private List<Player> drainPlayers(Map<String, Player> pendingPlayers) {
        List<Player> players = new ArrayList<>();
        pendingPlayers.forEach((playerUuid, player) -> {
            if (pendingPlayers.remove(playerUuid, player)) {
                players.add(Player.copyOf(player));
            }
        });
        return players;
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}
