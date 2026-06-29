import Player, { PlayerControlState, PlayerDirection, PlayerInterface } from "./player"

export default class BattleRoyalPlayer extends Player {

    constructor(scene : Phaser.Scene, lobbyPoint : Phaser.Math.Vector2 , playerAtlas : string, uuid : string, name : string, skinTint: number = 0xffffff, spawnPoints: Array<Phaser.Math.Vector2> = []) {
        super(scene, lobbyPoint, playerAtlas, playerAtlas.concat("-back"), uuid, name, skinTint, spawnPoints);

        // Offset for the player
        this.setSize(30, 40);
        this.setOffset(0,24);

        // Create the player's walking animations from the texture atlas. These are stored in the global
        // animation manager so any sprite can access them.
        this.createAnimationIfMissing({
            key: this.animationKey("left"),
            frames: this.anims.generateFrameNames(this.atlas, {
            prefix: this.atlas.concat("-left-walk."),
            start: 0,
            end: 3,
            zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.createAnimationIfMissing({
            key: this.animationKey("right"),
            frames: this.anims.generateFrameNames(this.atlas, {
            prefix: this.atlas.concat("-right-walk."),
            start: 0,
            end: 3,
            zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.createAnimationIfMissing({
            key: this.animationKey("front"),
            frames: this.anims.generateFrameNames(this.atlas, {
            prefix: this.atlas.concat("-front-walk."),
            start: 0,
            end: 3,
            zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });
        this.createAnimationIfMissing({
            key: this.animationKey("back"),
            frames: this.anims.generateFrameNames(this.atlas, {
            prefix: this.atlas.concat("-back-walk."),
            start: 0,
            end: 3,
            zeroPad: 3
            }),
            frameRate: 10,
            repeat: -1
        });

    }

    private animationKey(direction: string): string {
        return this.atlas.concat("-").concat(direction).concat("-walk-animation");
    }

    private createAnimationIfMissing(config: Phaser.Types.Animations.Animation & { key: string }): void {
        if (!this.scene.anims.exists(config.key)) {
            this.scene.anims.create(config);
        }
    }

    update(controls : PlayerControlState) {
        super.update(controls);

        // Update the animation last and give left/right animations precedence over up/down animations
        if (controls.left) {
            this.anims.play(this.animationKey("left"), true);
            this.direction = PlayerDirection.LEFT;
        } else if (controls.right) {
            this.anims.play(this.animationKey("right"), true);
            this.direction = PlayerDirection.RIGHT;
        } else if (controls.up) {
            this.anims.play(this.animationKey("back"), true);
            this.direction = PlayerDirection.UP;
        } else if (controls.down) {
            this.anims.play(this.animationKey("front"), true);
            this.direction = PlayerDirection.DOWN;
        } else {
            this.anims.stop();
            this.direction = PlayerDirection.NOT_MOVING;

            // If we were moving, pick and idle frame to use
            if (this.lastVelocity.x < 0) this.setTexture(this.atlas, this.atlas.concat("-left"));
            else if (this.lastVelocity.x > 0) this.setTexture(this.atlas, this.atlas.concat("-right"));
            else if (this.lastVelocity.y < 0) this.setTexture(this.atlas, this.atlas.concat("-back"));
            else if (this.lastVelocity.y > 0) this.setTexture(this.atlas, this.atlas.concat("-front"));
        }
    }

    updateFromJson(jsonMessage : PlayerInterface) {
        super.updateFromJson(jsonMessage);
        this.direction = jsonMessage.direction;
        let previousDirection = this.direction;
        if(!this.anims) {
            return;
        }

        // Update the animation
        // Update the animation last and give left/right animations precedence over up/down animations
        if (this.direction === PlayerDirection.LEFT) {
            this.anims.play(this.animationKey("left"), true);
        } else if (this.direction === PlayerDirection.RIGHT) {
            this.anims.play(this.animationKey("right"), true);
        } else if (this.direction === PlayerDirection.UP) {
            this.anims.play(this.animationKey("back"), true);
        } else if (this.direction === PlayerDirection.DOWN) {
            this.anims.play(this.animationKey("front"), true);
        } else {
            this.anims.stop();

            // If we were moving, pick and idle frame to use
            if (previousDirection === PlayerDirection.LEFT) this.setTexture(this.atlas, this.atlas.concat("-left"));
            else if (previousDirection === PlayerDirection.RIGHT) this.setTexture(this.atlas, this.atlas.concat("-right"));
            else if (previousDirection === PlayerDirection.UP) this.setTexture(this.atlas, this.atlas.concat("-back"));
            else if (previousDirection === PlayerDirection.DOWN) this.setTexture(this.atlas, this.atlas.concat("-front"));
        }
    }

    toJsonBackEnd() : PlayerInterface {
        let returnValue : PlayerInterface = super.toJsonBackEnd();
        return returnValue;
    }
}
