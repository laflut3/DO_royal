import FrontConf from "../conf";
import Bullet, { BulletInterface } from "../objects/bullet";
import BulletGroup from "../objects/bulletGroup";
import MultiPlayers from "../objects/multiPlayers";
import Player, { PlayerInterface } from "../objects/player";
import MainScene from "../scenes/mainScene";


const LATENCY_MIN = 30;

export enum MessageType {
    NEW_PLAYER  = 1,
    PLAYER_MOVED = 2,
    GAME_STATE  = 3,
    PLAYER_DESTROY = 4,
    NEW_BULLET = 5,
    BULLET_DESTROY = 6,
    NEW_GAME = 7,
	LIST_GAME = 8,
    CHAT_MESSAGE = 9,
};

export enum KeyWords {
    MESSAGE_TYPE = "type",
    PLAYER_INFO = "player",
    PLAYERS_INFO = "players",
    SOCKET_UUID = "socketUuid",
    BULLET_INFO = "bullet",
    GAME_ID = "gameId",
    GAME_NAME = "gameName",
    GAME_STATUS = "gameStatus",
    WINNER_NAME = "winnerName",
    OWNER_PLAYER_UUID = "ownerPlayerUuid",
    CHAT_MESSAGE = "chatMessage",
    PLAYER_UUID = "playerUuid",
    PLAYER_NAME = "playerName"
}

export enum GameStatus {
    LOBBY = 1,
    STARTING = 2,
    PLAYING = 3,
    FINISHED = 4
};


export default class BackEndWebSocket {
    webSocket : WebSocket
    otherPlayerMap : Map<string, PlayerInterface>
    multiPlayer : MultiPlayers
    bulletsGroup : BulletGroup
    latency : number
    lastUpdateReceived : number
    lastUpdateSent : number
    uuid : string
    gameUuid : string
    gameStatus : GameStatus
    currentPlayer : Player
    finishCallback : any
    winnerName : string
    remoteBulletCallback : any
    chatCallback : any
    ownerPlayerUuid : string
    isOwner : boolean


    constructor(player : Player, multiPlayer : MultiPlayers, bulletsGroup : BulletGroup, gameUuid: string, finishCallback : any, remoteBulletCallback? : any, chatCallback? : any) {

        this.otherPlayerMap = new Map<string, PlayerInterface>();
        this.multiPlayer = multiPlayer;
        this.bulletsGroup = bulletsGroup;
        this.currentPlayer = player;
        this.finishCallback = finishCallback;
        this.remoteBulletCallback = remoteBulletCallback;
        this.chatCallback = chatCallback;
        let frontConf = new FrontConf();
        let url = frontConf.webSocketUrl();

        this.webSocket = new WebSocket(url);
        this.uuid = Phaser.Utils.String.UUID();
        this.gameUuid = gameUuid;
        this.gameStatus = GameStatus.LOBBY;
        this.ownerPlayerUuid = "";
        this.isOwner = false;

        this.webSocket.onopen = (ev: Event) => {
            this.registerPlayer(player);
        };

        this.latency = 0;
        this.lastUpdateReceived = performance.now();
        this.lastUpdateSent = 0;

        this.webSocket.onmessage = (ev: MessageEvent) =>  {
            let message;
            try {
                message = JSON.parse(ev.data);
            } catch(e) {
                console.log("An error occured while parsing message : " + ev.data);
                return;
            }

            if(message[KeyWords.MESSAGE_TYPE] === MessageType.GAME_STATE) {
                this.multiPlayersPositionMessageHandler(message[KeyWords.PLAYERS_INFO]);
                this.gameStatusHandler(message[KeyWords.GAME_STATUS]);
                this.ownerPlayerUuid = message[KeyWords.OWNER_PLAYER_UUID] || "";
                this.isOwner = this.ownerPlayerUuid === this.currentPlayer.uuid;
                if(message[KeyWords.WINNER_NAME] != "") {
                    this.winnerName = message[KeyWords.WINNER_NAME];
                }
                this.latency = performance.now() - this.lastUpdateReceived;
                this.lastUpdateReceived = performance.now();
            } else if (message[KeyWords.MESSAGE_TYPE] === MessageType.NEW_BULLET) {
                this.newBulletHandler(message[KeyWords.BULLET_INFO]);
            } else if (message[KeyWords.MESSAGE_TYPE] === MessageType.BULLET_DESTROY) {
                this.destroyBulletHandler(message[KeyWords.BULLET_INFO]);
            } else if (message[KeyWords.MESSAGE_TYPE] === MessageType.CHAT_MESSAGE) {
                this.chatMessageHandler(message);
            }
        };

        this.webSocket.onclose = (ev: Event) =>  {
            console.log("WebSocket closed");
        }

    }

    private registerPlayer(player : Player) {
        let jsonObject : PlayerInterface = player.toJsonBackEnd();
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.NEW_PLAYER;
        message[KeyWords.PLAYER_INFO] = jsonObject;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    updatePlayerPosition(player : Player) {
        // The player position is updated only every 30 ms
        if(this.webSocket.readyState === WebSocket.OPEN &&
            performance.now() - this.lastUpdateSent > LATENCY_MIN) {
            let jsonObject : PlayerInterface = player.toJsonBackEnd();
            let message = {};
            message[KeyWords.SOCKET_UUID] = this.uuid;
            message[KeyWords.GAME_ID] = this.gameUuid;
            message[KeyWords.MESSAGE_TYPE] = MessageType.PLAYER_MOVED;
            message[KeyWords.PLAYER_INFO] = jsonObject;
            this.webSocket.send(JSON.stringify(message));
            this.lastUpdateSent = performance.now();
        }
    }

    multiPlayersPositionMessageHandler(messagePlayers: any) {
        // Update other players info
        let updatedPlayers : Array<string> = new Array<string>();
        messagePlayers.forEach( element => {
            updatedPlayers.push(element["uuid"]);
            let playerMulti : PlayerInterface | undefined = this.otherPlayerMap.get(element["uuid"]);
            if(playerMulti != undefined) {
                // Update existing player
                playerMulti.x = element["x"];
                playerMulti.y = element["y"];
                playerMulti.name = element["name"];
                playerMulti.velocityX = element["velocityX"];
                playerMulti.velocityY = element["velocityY"];
                playerMulti.atlas = element["atlas"];
                playerMulti.direction = element["direction"];
                playerMulti.frame = element["frame"];
                playerMulti.width = element["width"];
                playerMulti.height = element["height"];
                playerMulti.isAlive = element["isAlive"];
                playerMulti.health = element["health"];
                playerMulti.maxHealth = element["maxHealth"];
                playerMulti.shield = element["shield"];
                playerMulti.maxShield = element["maxShield"];
                playerMulti.skinTint = element["skinTint"];
            } else {
                // Create new Player
                let playerMulti : PlayerInterface = {
                    uuid : element["uuid"],
                    name : element["name"],
                    x : element["x"],
                    y : element["y"],
                    velocityX : element["velocityX"],
                    velocityY : element["velocityY"],
                    atlas : element["atlas"],
                    direction : element["direction"],
                    frame : element["frame"],
                    width : element["width"],
                    height : element["height"],
                    isAlive : element["isAlive"],
                    health : element["health"],
                    maxHealth : element["maxHealth"],
                    shield : element["shield"],
                    maxShield : element["maxShield"],
                    skinTint : element["skinTint"]
                };
                this.otherPlayerMap.set(playerMulti.uuid, playerMulti);
            }
        });
        // Delete disconnected players -> players witch were not updated
        if(this.otherPlayerMap.size != updatedPlayers.length) {
            this.otherPlayerMap.forEach( (playerInterface : PlayerInterface, uuid : string) => {
                if(!updatedPlayers.includes(uuid)) {
                    this.otherPlayerMap.delete(uuid);
                }
            });
        }
        // Update scene
        this.multiPlayer.updateFromServer(this.otherPlayerMap);
    }

    registerBullet(bullet : Bullet) {
        let jsonObject : BulletInterface = bullet.toJsonBackEnd();
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.NEW_BULLET;
        message[KeyWords.BULLET_INFO] = jsonObject;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    deleteBullet(bullet : Bullet) {
        let jsonObject : BulletInterface = bullet.toJsonBackEnd();
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.BULLET_DESTROY;
        message[KeyWords.BULLET_INFO] = jsonObject;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    newBulletHandler(messageBullet : any) {
        this.bulletsGroup.fireBulletRemote(messageBullet["startX"],
            messageBullet["startY"],
            messageBullet["toX"],
            messageBullet["toY"],
            messageBullet["uuid"]);
        if(this.remoteBulletCallback) {
            this.remoteBulletCallback(messageBullet["startX"], messageBullet["startY"]);
        }
    }

    destroyBulletHandler(messageBullet : any) {
        this.bulletsGroup.deleteBulletFromUuid(messageBullet["uuid"]);
    }

    chatMessageHandler(message : any) {
        if(this.chatCallback) {
            this.chatCallback(
                message[KeyWords.PLAYER_UUID],
                message[KeyWords.PLAYER_NAME],
                message[KeyWords.CHAT_MESSAGE]
            );
        }
    }

    sendChatMessage(chatMessage: string) {
        if(this.webSocket.readyState !== WebSocket.OPEN) {
            return;
        }
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.CHAT_MESSAGE;
        message[KeyWords.CHAT_MESSAGE] = chatMessage;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    startPlaying() {
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.GAME_STATE;
        message[KeyWords.GAME_STATUS] = GameStatus.PLAYING;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    startGame() {
        // Send starting message
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.GAME_STATE;
        message[KeyWords.GAME_STATUS] = GameStatus.STARTING;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
        // Send playing message after 3 seconds
        setTimeout(this.startPlaying.bind(this), 3000);
    }

    lobbyGame() {
        // Send starting message
        let message = {};
        message[KeyWords.SOCKET_UUID] = this.uuid;
        message[KeyWords.MESSAGE_TYPE] = MessageType.GAME_STATE;
        message[KeyWords.GAME_STATUS] = GameStatus.LOBBY;
        message[KeyWords.GAME_ID] = this.gameUuid;
        this.webSocket.send(JSON.stringify(message));
    }

    gameStatusHandler(gameStatus : GameStatus) {
        const previousGameStatus = this.gameStatus;
        this.gameStatus = gameStatus;
        console.log(this.gameStatus);
        switch(this.gameStatus) {
            case GameStatus.STARTING:
                if(previousGameStatus !== GameStatus.STARTING) {
                    this.currentPlayer.goToSpawnPoint();
                }
                break;
            case GameStatus.LOBBY:
                if(previousGameStatus !== GameStatus.LOBBY) {
                    this.currentPlayer.isAlive = true;
                    this.currentPlayer.health = this.currentPlayer.maxHealth;
                    this.currentPlayer.shield = 0;
                    this.currentPlayer.updateHud();
                }
                break;
            case GameStatus.FINISHED:
                if(previousGameStatus !== GameStatus.FINISHED) {
                    this.finishCallback(this.winnerName);
                    this.currentPlayer.goToLobbyPoint();
                }
                break;
        }
    }
};
