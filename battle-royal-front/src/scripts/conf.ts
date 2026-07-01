export default class FrontConf {
    backEndIp: string
    backEndPort: number
    width: number
    height: number
    playerSpeed: number
    bulletSpeed: number
    visionScope: number
    visionAlpha: number
    constructor() {
        var config = require('../frontConf.json');
        // Network
        this.backEndIp = window.location.hostname || config.network.backEndIP;
        this.backEndPort = config.network.backEndPort;
        this.width = config.network.width;
        this.height = config.network.height;
        // Gameplay
        this.playerSpeed = config.gameplay.playerSpeed;
        this.bulletSpeed = config.gameplay.bulletSpeed;
        this.visionScope = config.gameplay.visionScope;
        this.visionAlpha = config.gameplay.visionAlpha;
    }

    webSocketUrl(): string {
        const secure = window.location.protocol === "https:";
        const protocol = secure ? "wss" : "ws";
        const port = secure ? "" : `:${this.backEndPort}`;
        return `${protocol}://${this.backEndIp}${port}/game`;
    }

    httpApiUrl(): string {
        const secure = window.location.protocol === "https:";
        const protocol = secure ? "https" : "http";
        const port = secure ? "" : `:${this.backEndPort}`;
        return `${protocol}://${this.backEndIp}${port}`;
    }
}
