import MenuScene from "../scenes/menuScene";
import FrontConf from "../conf";
import { KeyWords, MessageType } from "./backEndWebSocket"

export interface ServerListEntry {
    gameId: string
    gameName: string
    mapId: string
    mapName: string
}

export default class ListGamesWebSocket {
    webSocket : WebSocket
    uuid : string
    menuScene : MenuScene
    onCreateSuccess?: () => void
    onCreateError?: (errorMessage: string) => void
    pendingMessages : Array<object>

    constructor(menuScene : MenuScene) {
        this.menuScene = menuScene;
        let frontConf = new FrontConf();
        let url = frontConf.webSocketUrl();
        this.webSocket = new WebSocket(url);
        this.uuid = Phaser.Utils.String.UUID();
        this.pendingMessages = new Array<object>();
        this.webSocket.onopen = (ev: Event) => {
            this.flushPendingMessages();
            this.sendServerListRequest();
        };

        this.webSocket.onmessage = (ev: MessageEvent) =>  {
            let message = JSON.parse(ev.data);
            if(message[KeyWords.MESSAGE_TYPE] === MessageType.LIST_GAME) {
                let serverList =  new Array<ServerListEntry>();
                message["gamelist"].forEach( element => {
                    serverList.push({
                        gameId: element[KeyWords.GAME_ID],
                        gameName: element[KeyWords.GAME_NAME],
                        mapId: element[KeyWords.MAP_ID],
                        mapName: element[KeyWords.MAP_NAME]
                    });
                });
                this.menuScene.loadServerList(serverList);
            } else if(message["status"] === "OK" && this.onCreateSuccess !== undefined) {
                this.onCreateSuccess();
                this.onCreateSuccess = undefined;
                this.onCreateError = undefined;
            } else if(message["status"] === "KO" && this.onCreateError !== undefined) {
                this.onCreateError(message["errorMessage"]);
                this.onCreateSuccess = undefined;
                this.onCreateError = undefined;
            }
        }
    }

    connect() { }

    disconnect() {
        if (this.webSocket.readyState === WebSocket.OPEN || this.webSocket.readyState === WebSocket.CONNECTING) {
            this.webSocket.close();
        }
    }

    sendServerListRequest() {
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.LIST_GAME;
        this.sendMessage(message);
    }

    createNewServer(serverName : string, gameUuid : string, mapId : string, mapName : string, onSuccess : () => void, onError : (errorMessage: string) => void) {
        this.onCreateSuccess = onSuccess;
        this.onCreateError = onError;
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.NEW_GAME;
        message[KeyWords.GAME_ID] = gameUuid;
        message[KeyWords.GAME_NAME] = serverName;
        message[KeyWords.MAP_ID] = mapId;
        message[KeyWords.MAP_NAME] = mapName;
        this.sendMessage(message);
    }

    private sendMessage(message : object) {
        if (this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify(message));
            return;
        }
        if (this.webSocket.readyState === WebSocket.CONNECTING) {
            this.pendingMessages.push(message);
        }
    }

    private flushPendingMessages() {
        this.pendingMessages.forEach((message : object) => {
            this.webSocket.send(JSON.stringify(message));
        });
        this.pendingMessages = new Array<object>();
    }

}
