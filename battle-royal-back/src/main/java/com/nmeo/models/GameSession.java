package com.nmeo.models;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Supplier;

import lombok.Getter;
import lombok.Setter;

@Getter
public class GameSession {
    private final Game game;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, Bullet> bullets = new ConcurrentHashMap<>();

    private final ReentrantReadWriteLock stateLock = new ReentrantReadWriteLock(true);

    @Setter
    private volatile GameStatus status = GameStatus.LOBBY;

    @Setter
    private volatile String winnerName = "";

    @Setter
    private volatile String ownerPlayerUuid;

    @Setter
    private volatile int roundNumber = 0;

    public GameSession(Game game) {
        this.game = game;
    }

    public UUID getGameId() {
        return game.getUuid();
    }

    public <T> T readState(Supplier<T> action) {
        stateLock.readLock().lock();
        try {
            return action.get();
        } finally {
            stateLock.readLock().unlock();
        }
    }

    public <T> T writeState(Supplier<T> action) {
        stateLock.writeLock().lock();
        try {
            return action.get();
        } finally {
            stateLock.writeLock().unlock();
        }
    }

    public void writeState(Runnable action) {
        stateLock.writeLock().lock();
        try {
            action.run();
        } finally {
            stateLock.writeLock().unlock();
        }
    }
}
