package com.nmeo.services.impl;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Consumer;

import com.nmeo.models.Bullet;
import com.nmeo.models.Game;
import com.nmeo.models.GameSession;
import com.nmeo.models.GameStatus;
import com.nmeo.models.Player;

public class GameService {
    private final Map<UUID, GameSession> sessions = new ConcurrentHashMap<>();
    private Consumer<GameSession> finishListener = session -> {};

    public void setFinishListener(Consumer<GameSession> finishListener) {
        this.finishListener = finishListener == null ? session -> {} : finishListener;
    }

    public void createGame(UUID gameId, String gameName) {
        createGame(gameId, gameName, Game.DEFAULT_MAP_ID, Game.DEFAULT_MAP_NAME);
    }

    public void createGame(UUID gameId, String gameName, String mapId, String mapName) {
        if (gameId == null || gameName == null || gameName.isBlank()) {
            throw new IllegalArgumentException("gameId and gameName are required");
        }
        String normalizedMapId = mapId == null || mapId.isBlank() ? Game.DEFAULT_MAP_ID : mapId.strip();
        String normalizedMapName = mapName == null || mapName.isBlank() ? Game.DEFAULT_MAP_NAME : mapName.strip();
        GameSession session = new GameSession(new Game(gameId, gameName, normalizedMapId, normalizedMapName));
        if (sessions.putIfAbsent(gameId, session) != null) {
            throw new IllegalArgumentException("A game with the same uuid already exists.");
        }
    }

    public List<Game> listGames() {
        return sessions.values().stream()
                .map(GameSession::getGame)
                .sorted(Comparator.comparing(Game::getName))
                .toList();
    }

    public Optional<GameSession> getSession(UUID gameId) {
        return Optional.ofNullable(sessions.get(gameId));
    }

    public boolean exists(UUID gameId) {
        return sessions.containsKey(gameId);
    }

    public GameStatus getGameStatus(UUID gameId) {
        return getSession(gameId)
                .map(GameSession::getStatus)
                .orElse(GameStatus.IDLE);
    }

    public String getWinnerName(UUID gameId) {
        return getSession(gameId)
                .map(GameSession::getWinnerName)
                .orElse("");
    }

    public String getOwnerPlayerUuid(UUID gameId) {
        return getSession(gameId)
                .map(GameSession::getOwnerPlayerUuid)
                .orElse(null);
    }

    public List<String> getPlayerUuids(UUID gameId) {
        return getSession(gameId)
                .map(session -> session.getPlayers().keySet().stream().sorted().toList())
                .orElse(List.of());
    }

    public void assignOwnerIfMissing(UUID gameId, String playerUuid) {
        GameSession session = sessionOrThrow(gameId);
        if (session.getOwnerPlayerUuid() == null && playerUuid != null && session.getPlayers().containsKey(playerUuid)) {
            session.setOwnerPlayerUuid(playerUuid);
        }
    }

    public void transferOwnerIfNeeded(UUID gameId, String removedPlayerUuid) {
        GameSession session = sessionOrThrow(gameId);
        if (removedPlayerUuid == null || !removedPlayerUuid.equals(session.getOwnerPlayerUuid())) {
            return;
        }
        List<String> connectedPlayerUuids = session.getPlayers().keySet().stream().toList();
        if (connectedPlayerUuids.isEmpty()) {
            session.setOwnerPlayerUuid(null);
            return;
        }
        session.setOwnerPlayerUuid(connectedPlayerUuids.get(ThreadLocalRandom.current().nextInt(connectedPlayerUuids.size())));
    }

    public boolean isOwner(UUID gameId, String playerUuid) {
        return playerUuid != null && playerUuid.equals(getOwnerPlayerUuid(gameId));
    }

    public void updateGameStatus(UUID gameId, GameStatus status) {
        GameSession session = sessionOrThrow(gameId);
        GameStatus previousStatus = session.getStatus();
        session.setStatus(status);
        if (status == GameStatus.STARTING && previousStatus != GameStatus.STARTING) {
            session.setRoundNumber(session.getRoundNumber() + 1);
        }
        if (status == GameStatus.LOBBY || status == GameStatus.STARTING) {
            session.setWinnerName("");
            session.getPlayers().values().forEach(player -> {
                player.setIsAlive(true);
                if (player.getMaxHealth() == null || player.getMaxHealth() <= 0) {
                    player.setMaxHealth(100);
                }
                player.setHealth(player.getMaxHealth());
                if (player.getMaxShield() == null || player.getMaxShield() <= 0) {
                    player.setMaxShield(100);
                }
                player.setShield(0);
            });
        }
    }

    public Player getPlayer(UUID gameId, String playerUuid) {
        if (playerUuid == null) {
            return null;
        }
        return getSession(gameId)
                .map(session -> session.getPlayers().get(playerUuid))
                .orElse(null);
    }

    public void addBullet(UUID gameId, Bullet bullet) {
        GameSession session = sessionOrThrow(gameId);
        if (bullet == null || bullet.getUuid() == null || bullet.getUuid().isBlank()) {
            throw new IllegalArgumentException("bullet uuid is required");
        }
        session.getBullets().put(bullet.getUuid(), bullet);
    }

    public void removeBullet(UUID gameId, Bullet bullet) {
        GameSession session = sessionOrThrow(gameId);
        if (bullet == null || bullet.getUuid() == null || bullet.getUuid().isBlank()) {
            throw new IllegalArgumentException("bullet uuid is required");
        }
        session.getBullets().remove(bullet.getUuid());
    }

    public void updateFinishedState(UUID gameId) {
        GameSession session = sessionOrThrow(gameId);
        if (session.getStatus() != GameStatus.PLAYING || session.getPlayers().size() <= 1) {
            return;
        }

        List<Player> alivePlayers = session.getPlayers().values().stream()
                .filter(player -> Boolean.TRUE.equals(player.getIsAlive()))
                .toList();
        if (alivePlayers.size() == 1) {
            session.setStatus(GameStatus.FINISHED);
            session.setWinnerName(alivePlayers.get(0).getName());
            finishListener.accept(session);
        }
    }

    public boolean removeIfEmpty(UUID gameId) {
        GameSession session = sessions.get(gameId);
        if (session == null || !session.getPlayers().isEmpty()) {
            return false;
        }
        return sessions.remove(gameId, session);
    }

    private GameSession sessionOrThrow(UUID gameId) {
        return getSession(gameId)
                .orElseThrow(() -> new IllegalArgumentException("game not found"));
    }
}
