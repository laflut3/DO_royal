package com.nmeo.models;

import java.util.UUID;

import lombok.Value;

@Value
public class PlayerRegistration {
    UUID gameId;
    String playerUuid;
}
