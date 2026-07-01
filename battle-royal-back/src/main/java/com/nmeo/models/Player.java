package com.nmeo.models;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Player {
    private String uuid;
    private String name;
    private double x;
    private double y;
    private double velocityX;
    private double velocityY;
    private int direction;
    private String atlas;
    private String frame;
    private double width;
    private double height;
    private Boolean isAlive;
    private Integer health;
    private Integer maxHealth;
    private Integer shield;
    private Integer maxShield;
    private Integer skinTint;
    private Long accountId;
}
