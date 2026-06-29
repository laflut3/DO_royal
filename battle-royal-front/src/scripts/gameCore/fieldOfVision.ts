import BulletGroup from "../objects/bulletGroup";
import GameObjectsGroup from "../objects/gameObjetGroup";
import MultiPlayers from "../objects/multiPlayers";
import GameMap from "./gameMap";
import { Mrpas } from 'mrpas'
import Player from "../objects/player";

export default class FieldOfVision {
    map: GameMap
    objectGroup: GameObjectsGroup
    multiPlayers: MultiPlayers
    bulletGroup: BulletGroup
    mrpas: Mrpas
    visionScope: number
    visionAlpha: number

    constructor(map: GameMap, objectGroup: GameObjectsGroup, multiPlayers: MultiPlayers, bulletGroup: BulletGroup, visionScope: number, visionAlpha: number) {
        this.map = map;
        this.objectGroup = objectGroup;
        this.multiPlayers = multiPlayers;
        this.bulletGroup = bulletGroup;
        // Player's range of vision
        this.visionScope = visionScope;
        // Transparency calculation tiles nearly out of range
        this.visionAlpha = visionAlpha;

        this.mrpas = new Mrpas(this.map.belowLayer.width,
            this.map.belowLayer.height,
            //canSeeThrough
            (tileX: number, tileY: number): boolean => {
                const tile = this.map.worldLayer!.getTileAt(tileX, tileY);
                // If an object as the short property, we allow player to see through
                let shortTile = tile ? tile.properties["short"] : false;
                return !tile || shortTile;
            });
    }

  computeFOV(camera : Phaser.Cameras.Scene2D.Camera, player : Player) {
    this.allTilesAndObjectsInvisible(camera);

    let playerX = this.map.belowLayer.worldToTileX(player.x);
    let playerY = this.map.belowLayer.worldToTileY(player.y);

    // compute fov from player's position
    this.mrpas.compute(
        playerX,
        playerY,
        this.visionScope,
        // Is Tile Visible
        (tileX: number, tileY: number): boolean => {
            const tile = this.map.belowLayer.getTileAt(tileX, tileY);
            if (!tile) {
            return false;
            } else {
                return tile.tint === 0xffffff;
            }
        },
        // Set Visible Tile
        (tileX: number, tileY: number) => {
            const d = Phaser.Math.Distance.Between(playerY, playerX, tileY, tileX)
            // Calculate tile's transparency : proportionnal to distance with player
            const alpha = Math.min(2 - d / this.visionAlpha, 1);

            let tile = this.map.worldLayer.getTileAt(tileX, tileY);
            if (tile) { tile.alpha = 1;}

            tile = this.map.belowLayer.getTileAt(tileX, tileY);
            if (tile) {
                tile.alpha = alpha;
                tile.tint = 0xffffff;
            }

            tile = this.map.btwBelowWorld.getTileAt(tileX, tileY);
            if (tile) { tile.alpha = 1; }

            if(this.map.aboveLayer) {
                tile = this.map.aboveLayer.getTileAt(tileX, tileY);
                if (tile) { tile.alpha = 1; }
            }

            // Convert tile coordinates to world
            let worldVector = this.map.belowLayer.tileToWorldXY(tileX,tileY);

            // Calculate visible objects
            this.objectGroup.objectArray.forEach((object : Phaser.Physics.Arcade.Sprite) => {
              if(Phaser.Math.Distance.Between(object.getCenter().y, object.getCenter().x, worldVector.y + 14, worldVector.x + 14) < 23) {
                object.setVisible(true);
              }
            });

            // Calculate visible bullets
            this.bulletGroup.bulletArray.forEach((bullet : Phaser.Physics.Arcade.Sprite) => {
              if(Phaser.Math.Distance.Between(bullet.getCenter().y, bullet.getCenter().x, worldVector.y + 14, worldVector.x + 14) < 23) {
                bullet.setVisible(true);
              }
            });
        } );
    }

    private allTilesAndObjectsInvisible(camera: Phaser.Cameras.Scene2D.Camera) {
        // Get camera view bounds
        const bounds = new Phaser.Geom.Rectangle(
            this.map.belowLayer.worldToTileX(camera.worldView.x) - 1,
            this.map.belowLayer.worldToTileY(camera.worldView.y) - 1,
            this.map.belowLayer.worldToTileX(camera.worldView.width) + 2,
            this.map.belowLayer.worldToTileX(camera.worldView.height) + 3
        );

        // set all tiles and objects within camera view to invisible
        for (let y = bounds.y; y < bounds.y + bounds.height; y++)
        {
            for (let x = bounds.x; x < bounds.x + bounds.width; x++)
            {
                if (y < 0 || y >= this.map.belowLayer.height || x < 0 || x >= this.map.belowLayer.width)
                { continue }

                let tile = this.map.worldLayer.getTileAt(x, y);
                if (tile) { tile.alpha = 0; }

                tile = this.map.belowLayer.getTileAt(x, y);
                if (tile) { tile.alpha = 1; tile.tint = 0x404040; }

                tile = this.map.btwBelowWorld.getTileAt(x, y);
                if (tile) { tile.alpha = 0; }

                if(this.map.aboveLayer) {
                    tile = this.map.aboveLayer.getTileAt(x, y);
                    if (tile) { tile.alpha = 0; }
                }
            }
        }

        // Set all objects invisible
        this.objectGroup.objectArray.forEach((object : Phaser.Physics.Arcade.Sprite) => {
            object.setVisible(false);
        });

        // Set bullets invisible
        this.bulletGroup.bulletArray.forEach((bullet : Phaser.Physics.Arcade.Sprite) => {
            bullet.setVisible(false);
        });
    }
}
