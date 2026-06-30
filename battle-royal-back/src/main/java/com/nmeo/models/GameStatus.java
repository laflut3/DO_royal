package com.nmeo.models;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import lombok.Getter;

public enum GameStatus {
    IDLE(0),
    LOBBY(1),
    STARTING(2),
    PLAYING(3),
    FINISHED(4);

    @Getter(onMethod_ = @JsonValue)
    private final int status;

    private GameStatus(int status) {
        this.status = status;
    }

    @JsonCreator
    public static GameStatus fromStatus(Integer status) {
        for (GameStatus gameStatus : values()) {
            if (gameStatus.getStatus() == status) {
                return gameStatus;
            }
        }
        return IDLE;
    }
}
