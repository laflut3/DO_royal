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
}
