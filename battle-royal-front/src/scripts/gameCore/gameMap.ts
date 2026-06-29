export default class GameMap {
    tileMap : Phaser.Tilemaps.Tilemap
    spawnPoint : Phaser.Math.Vector2
    lobbyPoint : Phaser.Math.Vector2
    belowLayer : Phaser.Tilemaps.TilemapLayer
    btwBelowWorld : Phaser.Tilemaps.TilemapLayer
    worldLayer : Phaser.Tilemaps.TilemapLayer
    aboveLayer : Phaser.Tilemaps.TilemapLayer
    tileSets : Array<Phaser.Tilemaps.Tileset>;
    spawnPoints : Array<Phaser.Math.Vector2>;

    constructor(scene : Phaser.Scene, mapName : string, tileSetName : Array<string> ) {
        // Loading map
        this.tileMap = scene.make.tilemap({key: mapName});
        scene.physics.world.setBounds(0, 0, this.tileMap.widthInPixels, this.tileMap.heightInPixels);

        this.tileSets = new Array<Phaser.Tilemaps.Tileset>();
        // Load tiles in map -> take in parameter tileSetFileName & tileSetName (from preload)
        tileSetName.forEach((tileSet : string) => {
            this.tileSets.push(this.tileMap.addTilesetImage(tileSet, tileSet));
        });
        
        // Create map layers
        this.belowLayer = this.tileMap.createLayer("Below", this.tileSets, 0, 0);
        this.btwBelowWorld = this.tileMap.createLayer("BtwBelowAndWorld", this.tileSets, 0, 0);
        this.worldLayer = this.tileMap.createLayer("World", this.tileSets, 0, 0);
        //this.aboveLayer = this.tileMap.createLayer("Above Player", this.tileSets, 0, 0);
        this.belowLayer.setDepth(0);
        this.btwBelowWorld.setDepth(1);
        this.worldLayer.setDepth(2);
        
        this.worldLayer.setCollisionByExclusion([-1]);
        this.worldLayer.setCollisionByProperty({ collides: true });

        // By default, everything gets depth sorted on the screen in the order we created things. Here, we
        // want the "Above Player" layer to sit on top of the player, so we explicitly give it a depth.
        // Higher depths will sit on top of lower depth objects.
        //this.aboveLayer.setDepth(10);

        // Get Spawn Point and lobby point from map
        // Object layers in Tiled let you embed extra info into a map - like a spawn point or custom
        // collision shapes. In the tmx file, there's an object layer with a point named "Spawn Point"
        this.spawnPoints = this.tileMap.filterObjects("Objects", obj => obj.name === "Spawn Point")
            .map((spawnTile: Phaser.Types.Tilemaps.TiledObject) => new Phaser.Math.Vector2(<number>spawnTile.x, <number> spawnTile.y));
        if(this.spawnPoints.length > 0) {
            this.spawnPoint = this.spawnPoints[0];
        } else {
            console.error("Object Spawn Point could not be found");
            this.spawnPoint = new Phaser.Math.Vector2(0, 0);
            this.spawnPoints = [this.spawnPoint];
        }

        let lobbyTile: Phaser.Types.Tilemaps.TiledObject = this.tileMap.findObject("Objects", obj => obj.name === "Lobby Point");
        if(lobbyTile) {
            this.lobbyPoint = new Phaser.Math.Vector2(<number>lobbyTile.x, <number> lobbyTile.y );
        } else {
            console.error("Object Lobby Point could not be found");
            this.lobbyPoint = new Phaser.Math.Vector2(0, 0);
        }
    }

}
