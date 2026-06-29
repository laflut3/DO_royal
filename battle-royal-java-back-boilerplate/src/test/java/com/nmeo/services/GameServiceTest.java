package com.nmeo.services;

import static org.junit.Assert.assertEquals;

import java.util.UUID;

import org.junit.Test;

import com.nmeo.models.GameStatus;
import com.nmeo.models.Player;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.PlayerService;

public class GameServiceTest {
    @Test
    public void shouldListCreatedGames() {
        GameService gameService = new GameService();
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");

        assertEquals(1, gameService.listGames().size());
        assertEquals(gameId, gameService.listGames().get(0).getUuid());
        assertEquals("Game1", gameService.listGames().get(0).getName());
    }

    @Test
    public void shouldFinishPlayingGameWhenOnlyOnePlayerIsAlive() {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-1", "Player1", true));
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-2", "Player2", false));
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);

        gameService.updateFinishedState(gameId);

        assertEquals(GameStatus.FINISHED, gameService.getGameStatus(gameId));
        assertEquals("Player1", gameService.getWinnerName(gameId));
    }

    private Player player(String uuid, String name, boolean alive) {
        Player player = new Player();
        player.setUuid(uuid);
        player.setName(name);
        player.setAtlas("misa");
        player.setFrame("misa-back");
        player.setIsAlive(alive);
        return player;
    }
}
