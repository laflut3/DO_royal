package com.nmeo.services;

import java.util.List;
import java.util.UUID;

import com.nmeo.models.Player;

public interface IPlayerService {
    public void createPlayer(UUID socketUuid, UUID gameId, Player player);

    public void updatePlayer(UUID socketUuid, UUID gameId, Player player);

    public UUID removePlayer(UUID socketUuid);

    public String getPlayerUuidForSocket(UUID socketUuid);

    public boolean canSocketSeePoint(UUID gameId, UUID socketUuid, double x, double y);

    public List<Player> getPlayersVisibleBy(UUID gameId, UUID socketUuid);
}
