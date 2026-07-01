package com.nmeo.services;

import static org.junit.Assert.assertEquals;

import java.util.concurrent.atomic.AtomicInteger;
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
    public void shouldKeepSelectedMapInListedGame() {
        GameService gameService = new GameService();
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1", "warehouse", "Depot Industriel");

        assertEquals("warehouse", gameService.listGames().get(0).getMapId());
        assertEquals("Depot Industriel", gameService.listGames().get(0).getMapName());
    }

    @Test
    public void shouldFinishPlayingGameWhenOnlyOnePlayerIsAlive() {
        GameService gameService = new GameService();
        AtomicInteger finishedGames = new AtomicInteger(0);
        gameService.setFinishListener(session -> finishedGames.incrementAndGet());
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-1", "Player1", true));
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-2", "Player2", false));
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);

        gameService.updateFinishedState(gameId);

        assertEquals(GameStatus.FINISHED, gameService.getGameStatus(gameId));
        assertEquals("Player1", gameService.getWinnerName(gameId));
        assertEquals(1, finishedGames.get());
    }

    @Test
    public void shouldNotFinishPlayingGameWhenPlayerLeaves() {
        GameService gameService = new GameService();
        AtomicInteger finishedGames = new AtomicInteger(0);
        gameService.setFinishListener(session -> finishedGames.incrementAndGet());
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        UUID firstSocket = UUID.randomUUID();
        UUID secondSocket = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(firstSocket, gameId, player("player-1", "Player1", true));
        playerService.createPlayer(secondSocket, gameId, player("player-2", "Player2", true));
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);

        playerService.removePlayer(secondSocket);

        assertEquals(GameStatus.PLAYING, gameService.getGameStatus(gameId));
        assertEquals(0, finishedGames.get());
    }

    @Test
    public void shouldIncrementRoundNumberWhenRoundStarts() {
        GameService gameService = new GameService();
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");

        gameService.updateGameStatus(gameId, GameStatus.STARTING);
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);
        gameService.updateGameStatus(gameId, GameStatus.STARTING);

        assertEquals(2, gameService.getSession(gameId).orElseThrow().getRoundNumber());
    }

    @Test
    public void shouldAssignFirstPlayerAsOwnerAndTransferWhenOwnerLeaves() {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        UUID firstSocket = UUID.randomUUID();
        UUID secondSocket = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(firstSocket, gameId, player("player-1", "Player1", true));
        playerService.createPlayer(secondSocket, gameId, player("player-2", "Player2", true));

        assertEquals("player-1", gameService.getOwnerPlayerUuid(gameId));

        playerService.removePlayer(firstSocket);

        assertEquals("player-2", gameService.getOwnerPlayerUuid(gameId));
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
