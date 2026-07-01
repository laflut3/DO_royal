package com.nmeo.services;

import static org.junit.Assert.assertEquals;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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

    @Test
    public void shouldFinishGameOnlyOnceWhenCheckedConcurrently() throws Exception {
        GameService gameService = new GameService();
        AtomicInteger finishedGames = new AtomicInteger(0);
        gameService.setFinishListener(session -> finishedGames.incrementAndGet());
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();

        gameService.createGame(gameId, "Game1");
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-1", "Player1", true));
        playerService.createPlayer(UUID.randomUUID(), gameId, player("player-2", "Player2", false));
        gameService.updateGameStatus(gameId, GameStatus.PLAYING);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        Future<?> firstCheck = executor.submit(() -> {
            await(start);
            gameService.updateFinishedState(gameId);
        });
        Future<?> secondCheck = executor.submit(() -> {
            await(start);
            gameService.updateFinishedState(gameId);
        });

        start.countDown();
        firstCheck.get();
        secondCheck.get();
        executor.shutdown();

        assertEquals(GameStatus.FINISHED, gameService.getGameStatus(gameId));
        assertEquals(1, finishedGames.get());
    }

    @Test
    public void shouldCreateOnlyOnePlayerWithSameUuidWhenCalledConcurrently() throws Exception {
        GameService gameService = new GameService();
        PlayerService playerService = new PlayerService(gameService);
        UUID gameId = UUID.randomUUID();
        gameService.createGame(gameId, "Game1");

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger rejectedPlayers = new AtomicInteger(0);
        List<Future<?>> creations = List.of(
                executor.submit(() -> createDuplicatePlayer(playerService, start, gameId, rejectedPlayers)),
                executor.submit(() -> createDuplicatePlayer(playerService, start, gameId, rejectedPlayers)));

        start.countDown();
        for (Future<?> creation : creations) {
            creation.get();
        }
        executor.shutdown();

        assertEquals(1, gameService.getPlayerUuids(gameId).size());
        assertEquals(1, rejectedPlayers.get());
    }

    private void createDuplicatePlayer(
            PlayerService playerService,
            CountDownLatch start,
            UUID gameId,
            AtomicInteger rejectedPlayers) {
        await(start);
        try {
            playerService.createPlayer(UUID.randomUUID(), gameId, player("player-1", "Player1", true));
        } catch (IllegalArgumentException exception) {
            rejectedPlayers.incrementAndGet();
        }
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(exception);
        }
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
