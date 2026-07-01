package com.nmeo.services.account;

import java.util.Set;

public final class AccountCatalog {
    public static final int SHOP_PRICE = 600;
    public static final int WIN_REWARD = 100;
    public static final int PARTICIPATION_REWARD = 10;
    public static final String DEFAULT_REGISTERED_SKIN = "six-seven";
    public static final String DEFAULT_GUEST_SKIN = "misa";

    public static final Set<String> GUEST_SKINS = Set.of("medic", "misa", "scout");
    public static final Set<String> SHOP_SKINS = Set.of(
            "knight", "rogue", "nova", "ember", "cipher", "oni", "mbappe",
            "oudindindoun-madindindoun", "tralalelo-tralala", "tung-tung-tung-sahur");

    private AccountCatalog() {
    }
}
