package com.nmeo.dto;

import com.nmeo.models.Account;

import lombok.Value;

@Value
public class AuthResponse {
    String token;
    Account account;
}
