package com.nmeo.handlers;

import java.util.UUID;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.nmeo.dto.WebSocketMessage;
import com.nmeo.models.Player;
import com.nmeo.services.BroadcastService;
import com.nmeo.services.BroadcastService.DisconnectedSession;
import com.nmeo.services.IPlayerService;
import com.nmeo.services.MovementBroadcastService;
import com.nmeo.services.impl.AccountService;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.PlayerService;

import io.javalin.websocket.WsCloseContext;
import io.javalin.websocket.WsConnectContext;
import io.javalin.websocket.WsMessageContext;

public class SocketHandler {

    private static final Logger logger = LogManager.getLogger(SocketHandler.class.getName());

    public static void handleNewConnection(WsConnectContext ctx, BroadcastService broadcastService) {
        logger.info("A new connection has been established");
    }

    public static void handleCloseConnection(
            WsCloseContext ctx,
            IPlayerService playerService,
            GameService gameService,
            BroadcastService broadcastService,
            MovementBroadcastService movementBroadcastService) {
        logger.info("Web socket closed");
        DisconnectedSession disconnectedSession = broadcastService.unregister(ctx);
        if (disconnectedSession == null) {
            return;
        }

        UUID gameId = playerService.removePlayer(disconnectedSession.getSocketUuid());
        if (gameId != null) {
            if (gameService.removeIfEmpty(gameId)) {
                movementBroadcastService.removeGame(gameId);
                logger.info("Game {} removed because it has no players anymore", gameId);
                return;
            }
            broadcastService.broadcastGameState(gameId, playerService, gameService);
        }
    }

    public static void handleNewMessage(
            WsMessageContext ctx,
            IPlayerService playerService,
            GameService gameService,
            BroadcastService broadcastService,
            MovementBroadcastService movementBroadcastService,
            AccountService accountService) {
        WebSocketMessage newMessage = ctx.message(WebSocketMessage.class);
        logger.debug("handleNewMessage type={} gameId={}", newMessage.getType(), newMessage.getGameId());
        try {
            switch(newMessage.getType()) {
                case NEW_PLAYER:
                    if (playerService instanceof PlayerService) {
                        ((PlayerService) playerService).createPlayer(
                                newMessage.getSocketUuid(),
                                newMessage.getGameId(),
                                newMessage.getPlayer(),
                                newMessage.getAuthToken());
                    } else {
                        playerService.createPlayer(newMessage.getSocketUuid(), newMessage.getGameId(), newMessage.getPlayer());
                    }
                    broadcastService.registerPlayerSession(ctx, newMessage.getSocketUuid(), newMessage.getGameId());
                    broadcastService.broadcastGameState(newMessage.getGameId(), playerService, gameService);
                    break;
                case NEW_GAME:
                    gameService.createGame(
                            newMessage.getGameId(),
                            newMessage.getGameName(),
                            newMessage.getMapId(),
                            newMessage.getMapName());
                    ctx.send(WebSocketMessage.ok());
                    break;
                case LIST_GAME:
                    ctx.send(WebSocketMessage.gameList(gameService.listGames()));
                    break;
                case PLAYER_MOVED:
                    playerService.updatePlayer(newMessage.getSocketUuid(), newMessage.getGameId(), newMessage.getPlayer());
                    if (Boolean.FALSE.equals(newMessage.getPlayer().getIsAlive()) || newMessage.getPlayer().getHealth() == 0) {
                        gameService.updateFinishedState(newMessage.getGameId());
                        broadcastService.broadcastGameState(newMessage.getGameId(), playerService, gameService);
                    } else {
                        movementBroadcastService.queuePlayerMove(newMessage.getGameId(), newMessage.getPlayer());
                    }
                    break;
                case PLAYER_DESTROY:
                    playerService.updatePlayer(newMessage.getSocketUuid(), newMessage.getGameId(), newMessage.getPlayer());
                    gameService.updateFinishedState(newMessage.getGameId());
                    broadcastService.broadcastGameState(newMessage.getGameId(), playerService, gameService);
                    break;
                case NEW_BULLET:
                    gameService.addBullet(newMessage.getGameId(), newMessage.getBullet());
                    broadcastService.broadcastMessageNearPointInGameExcept(
                            newMessage.getGameId(),
                            newMessage.getSocketUuid(),
                            newMessage.getBullet().getStartX(),
                            newMessage.getBullet().getStartY(),
                            WebSocketMessage.bullet(newMessage.getType(), newMessage.getGameId(), newMessage.getBullet()),
                            playerService);
                    ctx.send(WebSocketMessage.ok());
                    break;
                case BULLET_DESTROY:
                    gameService.removeBullet(newMessage.getGameId(), newMessage.getBullet());
                    broadcastService.broadcastMessageNearPointInGameExcept(
                            newMessage.getGameId(),
                            newMessage.getSocketUuid(),
                            newMessage.getBullet().getStartX(),
                            newMessage.getBullet().getStartY(),
                            WebSocketMessage.bullet(newMessage.getType(), newMessage.getGameId(), newMessage.getBullet()),
                            playerService);
                    ctx.send(WebSocketMessage.ok());
                    break;
                case GAME_STATE:
                    String statePlayerUuid = playerService.getPlayerUuidForSocket(newMessage.getSocketUuid());
                    if (!gameService.isOwner(newMessage.getGameId(), statePlayerUuid)) {
                        throw new IllegalArgumentException("Only the game owner can update the game state.");
                    }
                    gameService.updateGameStatus(newMessage.getGameId(), newMessage.getGameStatus());
                    broadcastService.broadcastGameState(newMessage.getGameId(), playerService, gameService);
                    ctx.send(WebSocketMessage.ok());
                    break;
                case CHAT_MESSAGE:
                    String chatPlayerUuid = playerService.getPlayerUuidForSocket(newMessage.getSocketUuid());
                    Player chatPlayer = gameService.getPlayer(newMessage.getGameId(), chatPlayerUuid);
                    if (chatPlayer == null) {
                        throw new IllegalArgumentException("player not found");
                    }
                    broadcastService.broadcastMessageInGame(
                            newMessage.getGameId(),
                            WebSocketMessage.chatMessage(
                                    newMessage.getGameId(),
                                    chatPlayer.getUuid(),
                                    chatPlayer.getName(),
                                    normalizeChatMessage(newMessage.getChatMessage())));
                    ctx.send(WebSocketMessage.ok());
                    break;
                default:
                    logger.error("Unsupported message type");
                    ctx.send(WebSocketMessage.ko("Unsupported message type"));
                    break;
            }
        } catch (IllegalArgumentException exception) {
            logger.error(exception.getMessage());
            ctx.send(WebSocketMessage.ko(exception.getMessage()));
        }
    }

    private static String normalizeChatMessage(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("chat message is required");
        }
        String normalizedMessage = message.strip();
        if (normalizedMessage.length() > 120) {
            return normalizedMessage.substring(0, 120);
        }
        return normalizedMessage;
    }
}
