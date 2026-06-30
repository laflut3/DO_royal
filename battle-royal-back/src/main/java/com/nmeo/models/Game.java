package com.nmeo.models;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Value;

@Value
public class Game {
    @JsonProperty("gameId")
    UUID uuid;

    @JsonProperty("gameName")
    String name;
}
