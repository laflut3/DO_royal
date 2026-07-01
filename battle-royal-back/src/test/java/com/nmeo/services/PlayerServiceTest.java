package com.nmeo.services;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nmeo.dto.WebSocketMessage;
import com.nmeo.models.GameStatus;
import com.nmeo.models.Player;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.PlayerService;

public class PlayerServiceTest {
    @Test
    public void shouldReturnOnlyOtherPlayersForASocket() {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        UUID firstSocket = UUID.randomUUID();
        UUID secondSocket = UUID.randomUUID();

        Player firstPlayer = player("player-1");
        Player secondPlayer = player("player-2");

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(firstSocket, gameId, firstPlayer);
        playerService.createPlayer(secondSocket, gameId, secondPlayer);

        List<Player> visiblePlayers = playerService.getPlayersVisibleBy(gameId, firstSocket);

        assertEquals(1, visiblePlayers.size());
        assertEquals("player-2", visiblePlayers.get(0).getUuid());
    }

    @Test
    public void shouldReturnAllOtherPlayersDuringGame() {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        UUID firstSocket = UUID.randomUUID();
        UUID closeSocket = UUID.randomUUID();
        UUID distantSocket = UUID.randomUUID();

        Player firstPlayer = player("player-1", 100, 100);
        Player closePlayer = player("player-2", 300, 100);
        Player distantPlayer = player("player-3", 4200, 100);

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(firstSocket, gameId, firstPlayer);
        playerService.createPlayer(closeSocket, gameId, closePlayer);
        playerService.createPlayer(distantSocket, gameId, distantPlayer);
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);

        List<Player> visiblePlayers = playerService.getPlayersVisibleBy(gameId, firstSocket);

        assertEquals(2, visiblePlayers.size());
        assertTrue(visiblePlayers.stream().anyMatch(player -> "player-2".equals(player.getUuid())));
        assertTrue(visiblePlayers.stream().anyMatch(player -> "player-3".equals(player.getUuid())));
    }

    @Test
    public void shouldKeepAllOtherPlayersVisibleInLobby() {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        UUID firstSocket = UUID.randomUUID();
        UUID distantSocket = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(firstSocket, gameId, player("player-1", 100, 100));
        playerService.createPlayer(distantSocket, gameId, player("player-2", 1200, 100));

        List<Player> visiblePlayers = playerService.getPlayersVisibleBy(gameId, firstSocket);

        assertEquals(1, visiblePlayers.size());
        assertEquals("player-2", visiblePlayers.get(0).getUuid());
    }

    @Test
    public void shouldSerializeMessageTypeAsFrontEndNumber() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        WebSocketMessage message = WebSocketMessage.gameState(UUID.randomUUID(), GameStatus.LOBBY, "", "player-1", List.of("player-1"), List.of());

        JsonNode json = mapper.readTree(mapper.writeValueAsString(message));

        assertEquals(3, json.get("type").asInt());
        assertTrue(json.has("players"));
        assertEquals("player-1", json.get("ownerPlayerUuid").asText());
    }

    @Test
    public void shouldKeepFrontEndPlayerAliveJsonFieldName() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode json = mapper.readTree(mapper.writeValueAsString(player("player-1")));

        assertTrue(json.has("isAlive"));
        assertTrue(json.get("isAlive").asBoolean());
    }

    private Player player(String uuid) {
        return player(uuid, 0, 0);
    }

    private Player player(String uuid, double x, double y) {
        Player player = new Player();
        player.setUuid(uuid);
        player.setName(uuid);
        player.setX(x);
        player.setY(y);
        player.setAtlas("misa");
        player.setFrame("misa-back");
        player.setIsAlive(true);
        return player;
    }
}
