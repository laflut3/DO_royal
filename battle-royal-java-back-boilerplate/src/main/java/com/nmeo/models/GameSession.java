package com.nmeo.models;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import lombok.Getter;
import lombok.Setter;

@Getter
public class GameSession {
    private final Game game;
    private final Map<String, Player> players = new ConcurrentHashMap<>();
    private final Map<String, Bullet> bullets = new ConcurrentHashMap<>();

    @Setter
    private GameStatus status = GameStatus.LOBBY;

    @Setter
    private String winnerName = "";

    public GameSession(Game game) {
        this.game = game;
    }

    public UUID getGameId() {
        return game.getUuid();
    }
}
