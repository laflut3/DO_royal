package com.nmeo.models;

import java.util.Set;

import lombok.Value;

@Value
public class Account {
    Long id;
    String username;
    Integer coins;
    Set<String> ownedSkins;
}
