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
    public void shouldSerializeMessageTypeAsFrontEndNumber() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        WebSocketMessage message = WebSocketMessage.gameState(UUID.randomUUID(), GameStatus.LOBBY, "", List.of());

        JsonNode json = mapper.readTree(mapper.writeValueAsString(message));

        assertEquals(3, json.get("type").asInt());
        assertTrue(json.has("players"));
    }

    @Test
    public void shouldKeepFrontEndPlayerAliveJsonFieldName() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode json = mapper.readTree(mapper.writeValueAsString(player("player-1")));

        assertTrue(json.has("isAlive"));
        assertTrue(json.get("isAlive").asBoolean());
    }

    private Player player(String uuid) {
        Player player = new Player();
        player.setUuid(uuid);
        player.setName(uuid);
        player.setAtlas("misa");
        player.setFrame("misa-back");
        player.setIsAlive(true);
        return player;
    }
}
