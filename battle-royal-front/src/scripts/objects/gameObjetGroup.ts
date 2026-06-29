export default class GameObjectsGroup extends Phaser.GameObjects.Group {
    scene : Phaser.Scene
    atlasName: string
    objectArray : Array<Phaser.Physics.Arcade.Sprite>
    constructor(scene: Phaser.Scene, tileMap: Phaser.Tilemaps.Tilemap, atlasName: string) {
        super(scene);
        this.scene = scene;

        this.atlasName = atlasName;
        this.objectArray = new Array<Phaser.Physics.Arcade.Sprite>();
        // Try to create sprite for each frame available in our tile set atlas
        scene.textures.get(this.atlasName).getFrameNames().forEach(
            (objectName : string) => {
                // Find corresponding objects in object layer
                let objets : Phaser.GameObjects.GameObject[] = tileMap.createFromObjects("Objects", {
                    name : objectName,
                    key : this.atlasName,
                    scene: scene,
                    frame: objectName
                }); 
                // Create the corresponding sprites on map
                objets.forEach(
                    (object : Phaser.GameObjects.GameObject) => {
                        let sprite = <Phaser.Physics.Arcade.Sprite> object;
                        // Tiled is giving Left-Up corner
                        // Phaser is using Left-Down corner as origin :P 
                        sprite.y += sprite.height - 1 ;
                        this.add(sprite);
                        scene.add.existing(sprite);
                        // True means static object (it won't move)
                        scene.physics.add.existing(sprite, true);
                        // Add object to array
                        this.objectArray.push(sprite);
                    }
                );
            }
        );


    }
}