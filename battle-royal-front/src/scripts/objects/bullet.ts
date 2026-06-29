export interface BulletInterface {
    uuid : string,
    startX : number,
    startY : number,
    toX : number,
    toY : number,
}

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    score : integer
    scene : Phaser.Scene
    uuid : string
    startX : number
    startY : number
    toX : number
    toY : number
    hasBeenUpdated : boolean
    velocity : number
    isLocal : boolean

    constructor(scene : Phaser.Scene, startX: number, startY: number, toX: number, toY: number,
         bulletSpeed: number, uuid : string, isLocal : boolean) {

        super(scene, startX, startY, 'bullet');
        this.scene = scene;
        this.startX = startX;
        this.startY = startY;
        this.toX = toX;
        this.toY = toY;
        this.isLocal = isLocal;

        // Adding bullet to scene
        scene.add.existing(this)
        scene.physics.add.existing(this)
                
        // Parameter usefull to destroy a remote player who has been disconnected
        this.hasBeenUpdated = true;
        
        // Set velocity parameters
        this.velocity = bulletSpeed;

        // Unique ID for this bullet
        this.uuid = uuid;

        // Bullet moves to go to postion
        scene.physics.moveTo(this, toX, toY, this.velocity);
    }

    toJsonBackEnd() : BulletInterface {
        let returnValue : BulletInterface = {
            uuid: this.uuid,
            startX : this.startX,
            startY : this.startY,
            toX : Math.round(this.toX),
            toY : Math.round(this.toY)
        }
        return returnValue;
    }
}