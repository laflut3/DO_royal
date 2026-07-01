package com.nmeo;

import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.logging.log4j.core.config.Configurator;

import com.nmeo.handlers.SocketHandler;
import com.nmeo.infrastructure.VaultEnvironment;
import com.nmeo.services.BroadcastService;
import com.nmeo.services.IPlayerService;
import com.nmeo.services.MovementBroadcastService;
import com.nmeo.services.impl.AccountService;
import com.nmeo.services.impl.GameService;
import com.nmeo.services.impl.PlayerService;

import io.javalin.Javalin;

public class App {
    private static final Logger logger = LogManager.getLogger(App.class.getName());
    public static void main(String[] args) {
        Configurator.setAllLevels(LogManager.getRootLogger().getName(), Level.INFO);
        VaultEnvironment.load();
        logger.info("Starting the app");
        AccountService accountService = new AccountService();
        GameService gameService = new GameService();
        gameService.setFinishListener(accountService::rewardFinishedGame);
        IPlayerService playerService = new PlayerService(gameService, accountService);
        BroadcastService broadcastService = new BroadcastService();
        MovementBroadcastService movementBroadcastService = new MovementBroadcastService(broadcastService);
        Runtime.getRuntime().addShutdownHook(new Thread(movementBroadcastService::close));

        String serverPort = System.getProperty("SERVER_PORT", System.getenv("SERVER_PORT"));
        int port = serverPort != null ? Integer.parseInt(serverPort) : 8080;
        Javalin app = Javalin.create(config -> {
            config.enableCorsForAllOrigins();
        });
        accountService.registerRoutes(app);
        app.ws("/game", ws -> {
            ws.onConnect(ctx -> {
                SocketHandler.handleNewConnection(ctx, broadcastService);
            });
            ws.onMessage(ctx -> {
                SocketHandler.handleNewMessage(
                        ctx,
                        playerService,
                        gameService,
                        broadcastService,
                        movementBroadcastService,
                        accountService);
            });
            ws.onClose(ctx -> {
                SocketHandler.handleCloseConnection(
                        ctx,
                        playerService,
                        gameService,
                        broadcastService,
                        movementBroadcastService);
                logger.debug("onClose");
            });
        }).start(port);
    }
}
