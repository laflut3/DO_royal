package com.nmeo.services;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;

import com.nmeo.dto.WebSocketMessage;
import com.nmeo.models.Player;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.GameService.GameStateSnapshot;

import io.javalin.websocket.WsContext;
import lombok.AllArgsConstructor;
import lombok.Getter;

public class BroadcastService {
    private final Map<UUID, WsContext> sessionsBySocket = new ConcurrentHashMap<>();
    private final Map<String, UUID> socketBySessionId = new ConcurrentHashMap<>();
    private final Map<UUID, UUID> gameBySocket = new ConcurrentHashMap<>();
    private final Map<UUID, Set<UUID>> socketsByGame = new ConcurrentHashMap<>();
    private final ReentrantReadWriteLock registryLock = new ReentrantReadWriteLock();

    public void registerPlayerSession(WsContext ctx, UUID socketUuid, UUID gameId) {
        registryLock.writeLock().lock();
        try {
            UUID previousGameId = gameBySocket.get(socketUuid);
            if (previousGameId != null && !previousGameId.equals(gameId)) {
                Set<UUID> previousSockets = socketsByGame.get(previousGameId);
                if (previousSockets != null) {
                    previousSockets.remove(socketUuid);
                    if (previousSockets.isEmpty()) {
                        socketsByGame.remove(previousGameId);
                    }
                }
            }

            sessionsBySocket.put(socketUuid, ctx);
            socketBySessionId.put(ctx.getSessionId(), socketUuid);
            gameBySocket.put(socketUuid, gameId);
            socketsByGame.computeIfAbsent(gameId, ignored -> ConcurrentHashMap.newKeySet()).add(socketUuid);
        } finally {
            registryLock.writeLock().unlock();
        }
    }

    public DisconnectedSession unregister(WsContext ctx) {
        registryLock.writeLock().lock();
        try {
            UUID socketUuid = socketBySessionId.remove(ctx.getSessionId());
            if (socketUuid == null) {
                return null;
            }

            sessionsBySocket.remove(socketUuid);
            UUID gameId = gameBySocket.remove(socketUuid);
            if (gameId != null) {
                Set<UUID> sockets = socketsByGame.get(gameId);
                if (sockets != null) {
                    sockets.remove(socketUuid);
                    if (sockets.isEmpty()) {
                        socketsByGame.remove(gameId);
                    }
                }
            }
            return new DisconnectedSession(socketUuid, gameId);
        } finally {
            registryLock.writeLock().unlock();
        }
    }

    public void broadcastGameState(UUID gameId, IPlayerService playerService, GameService gameService) {
        GameStateSnapshot gameState = gameService.snapshotGameState(gameId);
        socketSnapshot(gameId).forEach(socketUuid -> {
            WsContext ctx = sessionsBySocket.get(socketUuid);
            if (ctx == null) {
                return;
            }
            String currentPlayerUuid = playerService.getPlayerUuidForSocket(socketUuid);
            WebSocketMessage message = WebSocketMessage.gameState(
                    gameId,
                    gameState.status(),
                    gameState.winnerName(),
                    gameState.ownerPlayerUuid(),
                    gameState.playerUuids(),
                    gameState.roundNumber(),
                    playersVisibleBy(gameState.players(), currentPlayerUuid));
            ctx.send(message);
        });
    }

    public void broadcastMessageInGame(UUID gameId, WebSocketMessage message) {
        socketSnapshot(gameId).stream()
                .map(sessionsBySocket::get)
                .filter(ctx -> ctx != null)
                .forEach(ctx -> ctx.send(message));
    }

    public void broadcastMessageInGameExcept(UUID gameId, UUID excludedSocketUuid, WebSocketMessage message) {
        socketSnapshot(gameId).stream()
                .filter(socketUuid -> !socketUuid.equals(excludedSocketUuid))
                .map(sessionsBySocket::get)
                .filter(ctx -> ctx != null)
                .forEach(ctx -> ctx.send(message));
    }

    public void broadcastMessageNearPointInGameExcept(
            UUID gameId,
            UUID excludedSocketUuid,
            double x,
            double y,
            WebSocketMessage message,
            IPlayerService playerService) {
        socketSnapshot(gameId).stream()
                .filter(socketUuid -> !socketUuid.equals(excludedSocketUuid))
                .filter(socketUuid -> playerService.canSocketSeePoint(gameId, socketUuid, x, y))
                .map(sessionsBySocket::get)
                .filter(ctx -> ctx != null)
                .forEach(ctx -> ctx.send(message));
    }

    private List<UUID> socketSnapshot(UUID gameId) {
        registryLock.readLock().lock();
        try {
            Set<UUID> sockets = socketsByGame.get(gameId);
            return sockets == null ? List.of() : List.copyOf(sockets);
        } finally {
            registryLock.readLock().unlock();
        }
    }

    private List<Player> playersVisibleBy(List<Player> players, String currentPlayerUuid) {
        if (currentPlayerUuid == null) {
            return List.of();
        }
        return players.stream()
                .filter(player -> !currentPlayerUuid.equals(player.getUuid()))
                .map(Player::copyOf)
                .toList();
    }

    @Getter
    @AllArgsConstructor
    public static class DisconnectedSession {
        private final UUID socketUuid;
        private final UUID gameId;
    }
}
