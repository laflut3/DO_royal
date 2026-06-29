package com.nmeo;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;

import com.nmeo.handlers.SocketHandler;
import com.nmeo.services.BroadcastService;
import com.nmeo.services.IPlayerService;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.PlayerService;

import io.javalin.Javalin;

public class App {
    private static final Logger logger = LogManager.getLogger(App.class.getName());
    public static void main(String[] args) {
        Configurator.setAllLevels(LogManager.getRootLogger().getName(), Level.INFO);
        logger.info("Starting the app");
        GameService gameService = new GameService();
        IPlayerService playerService = new PlayerService(gameService);
        BroadcastService broadcastService = new BroadcastService();

        int port = System.getenv("SERVER_PORT") != null? Integer.parseInt(System.getenv("SERVER_PORT")) : 8080;
        Javalin.create().ws("/game", ws -> {
            ws.onConnect(ctx -> {
                SocketHandler.handleNewConnection(ctx, broadcastService);
            });
            ws.onMessage(ctx -> {
                SocketHandler.handleNewMessage(ctx, playerService, gameService, broadcastService);
            });
            ws.onClose(ctx -> {
                SocketHandler.handleCloseConnection(ctx, playerService, gameService, broadcastService);
                logger.debug("onClose");
            });
        }).start(port);
    }
}
