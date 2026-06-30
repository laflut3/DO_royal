package com.nmeo.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import lombok.Getter;

public enum MessageType {
	IDLE(0),
    NEW_PLAYER (1),
    PLAYER_MOVED(2),
    GAME_STATE (3),
    PLAYER_DESTROY(4),
    NEW_BULLET(5),
    BULLET_DESTROY(6),
    NEW_GAME(7),
	LIST_GAME(8),
    CHAT_MESSAGE(9);

	@Getter(onMethod_ = @JsonValue)
	private final Integer type;

	private MessageType(Integer p_type) {
		this.type = p_type;
	}

	@JsonCreator
	public static MessageType fromType(Integer type) {
		for (MessageType messageType : values()) {
			if (messageType.getType().equals(type)) {
				return messageType;
			}
		}
		return IDLE;
	}
};
