package com.nmeo.dto;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.nmeo.models.Bullet;
import com.nmeo.models.Game;
import com.nmeo.models.GameStatus;
import com.nmeo.models.Player;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebSocketMessage {
    private MessageType type;
    private UUID socketUuid;
    private UUID gameId;
    private String gameName;
    private String mapId;
    private String mapName;
    private GameStatus gameStatus;
    private String winnerName;
    private String ownerPlayerUuid;
    private List<String> playerUuids;
    private int roundNumber;
    private String status;
    private String errorMessage;
    private Player player;
    private List<Player> players;
    private Bullet bullet;
    private List<Game> gamelist;
    private String chatMessage;
    private String playerUuid;
    private String playerName;
    private String authToken;

    public static WebSocketMessage gameState(UUID gameId, GameStatus gameStatus, String winnerName, String ownerPlayerUuid, List<String> playerUuids, int roundNumber, List<Player> players) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(MessageType.GAME_STATE);
        message.setGameId(gameId);
        message.setGameStatus(gameStatus);
        message.setWinnerName(winnerName == null ? "" : winnerName);
        message.setOwnerPlayerUuid(ownerPlayerUuid);
        message.setPlayerUuids(playerUuids);
        message.setRoundNumber(roundNumber);
        message.setPlayers(players);
        return message;
    }

    public static WebSocketMessage gameList(List<Game> games) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(MessageType.LIST_GAME);
        message.setGamelist(games);
        return message;
    }

    public static WebSocketMessage bullet(MessageType type, UUID gameId, Bullet bullet) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(type);
        message.setGameId(gameId);
        message.setBullet(bullet);
        return message;
    }

    public static WebSocketMessage playerMoved(UUID gameId, Player player) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(MessageType.PLAYER_MOVED);
        message.setGameId(gameId);
        message.setPlayer(Player.copyOf(player));
        return message;
    }

    public static WebSocketMessage playersMoved(UUID gameId, List<Player> players) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(MessageType.PLAYER_MOVED);
        message.setGameId(gameId);
        message.setPlayers(players.stream()
                .map(Player::copyOf)
                .toList());
        return message;
    }

    public static WebSocketMessage chatMessage(UUID gameId, String playerUuid, String playerName, String chatMessage) {
        WebSocketMessage message = new WebSocketMessage();
        message.setType(MessageType.CHAT_MESSAGE);
        message.setGameId(gameId);
        message.setPlayerUuid(playerUuid);
        message.setPlayerName(playerName);
        message.setChatMessage(chatMessage);
        return message;
    }

    public static WebSocketMessage ok() {
        return status("OK", "");
    }

    public static WebSocketMessage ko(String errorMessage) {
        return status("KO", errorMessage);
    }

    private static WebSocketMessage status(String status, String errorMessage) {
        WebSocketMessage message = new WebSocketMessage();
        message.setStatus(status);
        message.setErrorMessage(errorMessage);
        return message;
    }
}
