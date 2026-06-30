package com.nmeo.services;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import com.nmeo.dto.WebSocketMessage;
import com.nmeo.services.impl.GameService;

import io.javalin.websocket.WsContext;
import lombok.AllArgsConstructor;
import lombok.Getter;

public class BroadcastService {
    private final Map<UUID, WsContext> sessionsBySocket = new ConcurrentHashMap<>();
    private final Map<String, UUID> socketBySessionId = new ConcurrentHashMap<>();
    private final Map<UUID, UUID> gameBySocket = new ConcurrentHashMap<>();
    private final Map<UUID, Set<UUID>> socketsByGame = new ConcurrentHashMap<>();

    public void registerPlayerSession(WsContext ctx, UUID socketUuid, UUID gameId) {
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
    }

    public DisconnectedSession unregister(WsContext ctx) {
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
    }

    public void broadcastGameState(UUID gameId, IPlayerService playerService, GameService gameService) {
        Set<UUID> sockets = socketsByGame.get(gameId);
        if (sockets == null) {
            return;
        }

        sockets.forEach(socketUuid -> {
            WsContext ctx = sessionsBySocket.get(socketUuid);
            if (ctx == null) {
                return;
            }
            WebSocketMessage message = WebSocketMessage.gameState(
                    gameId,
                    gameService.getGameStatus(gameId),
                    gameService.getWinnerName(gameId),
                    gameService.getOwnerPlayerUuid(gameId),
                    playerService.getPlayersVisibleBy(gameId, socketUuid));
            ctx.send(message);
        });
    }

    public void broadcastMessageInGame(UUID gameId, WebSocketMessage message) {
        Set<UUID> sockets = socketsByGame.get(gameId);
        if (sockets == null) {
            return;
        }

        sockets.stream()
                .map(sessionsBySocket::get)
                .filter(ctx -> ctx != null)
                .forEach(ctx -> ctx.send(message));
    }

    public void broadcastMessageInGameExcept(UUID gameId, UUID excludedSocketUuid, WebSocketMessage message) {
        Set<UUID> sockets = socketsByGame.get(gameId);
        if (sockets == null) {
            return;
        }

        sockets.stream()
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
        Set<UUID> sockets = socketsByGame.get(gameId);
        if (sockets == null) {
            return;
        }

        sockets.stream()
                .filter(socketUuid -> !socketUuid.equals(excludedSocketUuid))
                .filter(socketUuid -> playerService.canSocketSeePoint(gameId, socketUuid, x, y))
                .map(sessionsBySocket::get)
                .filter(ctx -> ctx != null)
                .forEach(ctx -> ctx.send(message));
    }

    @Getter
    @AllArgsConstructor
    public static class DisconnectedSession {
        private final UUID socketUuid;
        private final UUID gameId;
    }
}
