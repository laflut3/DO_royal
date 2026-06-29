import Player, { PlayerInterface } from "./player";
import BattleRoyalPlayer from "./battleRoyalPlayer";

export default class MultiPlayers extends Phaser.GameObjects.Group {
    playersMulti : Array<Player>
    scene : Phaser.Scene

    constructor(scene: Phaser.Scene) {
        super(scene);
        this.playersMulti = new Array<Player>();
        this.scene = scene;
    }

    updateFromServer(mapBackEndPlayers : Map<string, PlayerInterface>) {
        mapBackEndPlayers.forEach((backEndPlayer: PlayerInterface, uuid : string) => {
            let playerFound : Player | undefined = this.playersMulti.find((player: Player) => {return player.uuid === uuid});
            if(playerFound === undefined) {
                // Create new player
                let playerPos : Phaser.Math.Vector2 = new Phaser.Math.Vector2(backEndPlayer.x, backEndPlayer.y);
                let newPlayer : Player;
                newPlayer = new BattleRoyalPlayer(this.scene, playerPos, backEndPlayer.atlas, uuid, backEndPlayer.name, backEndPlayer.skinTint);
                // Other players can't be moved with collision
                newPlayer.setImmovable(true);
                this.playersMulti.push(newPlayer);
                this.add(newPlayer);
            } else {
                playerFound.updateFromJson(backEndPlayer);
                playerFound.hasBeenUpdated = true;
            }
        });
        // If a player as not been update, he as beend disconnected
        this.playersMulti.forEach((player : Player) => {
            if(player.hasBeenUpdated === true) {
                player.hasBeenUpdated = false;
            } else {
                player.destroy();
            }
        });

    }

    update() {
        this.playersMulti.forEach((player : Player) => {
            let lastUpdateTime = Date.now() - player.lastUpdate;
            // Interpolate new position since last update
            let x = player.x + lastUpdateTime/1000 * player.lastVelocity.x;
            let y = player.y + lastUpdateTime/1000 * player.lastVelocity.y;
            player.setPosition(x, y);
            player.lastUpdate = Date.now();
            player.updateHud();
        });
    }

}
