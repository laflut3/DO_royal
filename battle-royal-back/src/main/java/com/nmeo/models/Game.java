package com.nmeo.models;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Value;

@Value
public class Game {
    public static final String DEFAULT_MAP_ID = "fest_room";
    public static final String DEFAULT_MAP_NAME = "Fest Room";

    @JsonProperty("gameId")
    UUID uuid;

    @JsonProperty("gameName")
    String name;

    @JsonProperty("mapId")
    String mapId;

    @JsonProperty("mapName")
    String mapName;
}
