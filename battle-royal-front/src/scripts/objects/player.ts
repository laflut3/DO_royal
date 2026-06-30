export enum PlayerDirection {
    NOT_MOVING = 0,
    UP = 1,
    DOWN = 2,
    LEFT = 3,
    RIGHT = 4
}

export interface PlayerControlState {
    up : boolean,
    down : boolean,
    left : boolean,
    right : boolean,
    sprint : boolean
}

export interface PlayerInterface {
    uuid : string,
    name : string,
    x : number,
    y : number,
    velocityX : number,
    velocityY : number
    direction : number,
    atlas : string,
    frame : string,
    width : number,
    height : number,
    isAlive : boolean,
    health : number,
    maxHealth : number,
    shield : number,
    maxShield : number,
    skinTint : number
}

export default class Player extends Phaser.Physics.Arcade.Sprite {
    static readonly DEFAULT_MAX_HEALTH = 100;
    static readonly DEFAULT_MAX_SHIELD = 100;
    static readonly BULLET_DAMAGE = 25;
    static readonly STAMINA_DRAIN_PER_SECOND = 36;
    static readonly STAMINA_REGEN_PER_SECOND = 24;
    static readonly SPRINT_MULTIPLIER = 1.65;

    scene : Phaser.Scene
    atlas : string
    name : string
    lastVelocity : Phaser.Math.Vector2
    velocity : number
    uuid : string
    direction : PlayerDirection
    hasBeenUpdated : boolean
    lobbyPoint : Phaser.Math.Vector2
    spawnPoint : Phaser.Math.Vector2
    lastUpdate : number
    isAlive : boolean
    health : number
    maxHealth : number
    shield : number
    maxShield : number
    stamina : number
    maxStamina : number
    lastStaminaUpdate : number
    skinTint : number
    nameText : Phaser.GameObjects.Text
    shieldBarBackground : Phaser.GameObjects.Rectangle
    shieldBarFill : Phaser.GameObjects.Rectangle
    healthBarBackground : Phaser.GameObjects.Rectangle
    healthBarFill : Phaser.GameObjects.Rectangle
    staminaBarBackground : Phaser.GameObjects.Rectangle
    staminaBarFill : Phaser.GameObjects.Rectangle
    chatBubbleText : Phaser.GameObjects.Text | null
    chatBubbleTimer : Phaser.Time.TimerEvent | null
    spawnPoints : Array<Phaser.Math.Vector2>

    constructor(scene : Phaser.Scene, lobbyPoint : Phaser.Math.Vector2 , playerAtlas : string, frame: string, uuid : string, name : string, skinTint: number = 0xffffff, spawnPoints: Array<Phaser.Math.Vector2> = []) {
        super(scene, lobbyPoint.x, lobbyPoint.y, playerAtlas, frame);
        this.scene = scene;
        this.atlas = playerAtlas;
        this.name = name;
        this.skinTint = skinTint;
        this.maxHealth = Player.DEFAULT_MAX_HEALTH;
        this.health = this.maxHealth;
        this.maxShield = Player.DEFAULT_MAX_SHIELD;
        this.shield = 0;
        this.maxStamina = 100;
        this.stamina = this.maxStamina;
        this.lastStaminaUpdate = Date.now();
        this.isAlive = true;
        // Adding player to scene
        scene.add.existing(this)
        scene.physics.add.existing(this)
        this.setTint(this.skinTint);
        this.setDepth(10);

        // setSize & setOffset are used to control the size of the player's body.
        this.setSize(32, 32);

        // Parameter usefull to destroy a remote player who has been disconnected
        this.hasBeenUpdated = true;

        // Set velocity parameters
        this.velocity = 200;
        this.lastVelocity = new Phaser.Math.Vector2(0,0);
        this.direction = PlayerDirection.NOT_MOVING;

        // Unique ID for this player
        this.uuid = uuid;
        this.lobbyPoint = lobbyPoint;
        this.spawnPoints = spawnPoints;

        // Define spawn point from validated map points, not from a global random position.
        this.spawnPoint = this.pickSpawnPoint(spawnPoints);
        this.lastUpdate = Date.now();

        this.nameText = scene.add.text(this.x, this.y - 58, this.name, {
            fontSize: "12px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3
        });
        this.nameText.setOrigin(0.5, 0.5);
        this.nameText.setDepth(30);
        this.shieldBarBackground = scene.add.rectangle(this.x, this.y - 44, 42, 5, 0x101010, 0.85);
        this.shieldBarBackground.setDepth(30);
        this.shieldBarFill = scene.add.rectangle(this.x - 20, this.y - 44, 40, 3, 0x3498db, 1);
        this.shieldBarFill.setOrigin(0, 0.5);
        this.shieldBarFill.setDepth(31);
        this.healthBarBackground = scene.add.rectangle(this.x, this.y - 34, 42, 6, 0x101010, 0.85);
        this.healthBarBackground.setDepth(30);
        this.healthBarFill = scene.add.rectangle(this.x - 20, this.y - 34, 40, 4, 0x2ecc71, 1);
        this.healthBarFill.setOrigin(0, 0.5);
        this.healthBarFill.setDepth(31);
        this.staminaBarBackground = scene.add.rectangle(this.x, this.y - 26, 42, 5, 0x101010, 0.85);
        this.staminaBarBackground.setDepth(30);
        this.staminaBarFill = scene.add.rectangle(this.x - 20, this.y - 26, 40, 3, 0xf1c40f, 1);
        this.staminaBarFill.setOrigin(0, 0.5);
        this.staminaBarFill.setDepth(31);
        this.chatBubbleText = null;
        this.chatBubbleTimer = null;
        this.updateHud();
    }

    update(controls : PlayerControlState)
    {
        // Record previous velocity
        this.lastVelocity = this.body.velocity.clone();

        const now = Date.now();
        const deltaSeconds = (now - this.lastStaminaUpdate) / 1000;
        this.lastStaminaUpdate = now;

        // Stop any previous movement from the last frame
        this.setVelocity(0);

        const wantsToMove = controls.left || controls.right || controls.up || controls.down;
        const wantsToSprint = controls.sprint && wantsToMove && this.stamina > 1;
        const currentVelocity = wantsToSprint ? this.velocity * Player.SPRINT_MULTIPLIER : this.velocity;

        // Horizontal movement
        if (controls.left) {
            this.setVelocityX(-currentVelocity);
        } else if (controls.right) {
            this.setVelocityX(currentVelocity);
        }

        // Vertical movement
        if (controls.up) {
            this.setVelocityY(-currentVelocity);
        } else if (controls.down) {
            this.setVelocityY(currentVelocity);
        }

        // Normalize and scale the velocity so that player can't move faster along a diagonal
        this.body.velocity.normalize().scale(currentVelocity);

        if (wantsToSprint) {
            this.stamina = Math.max(0, this.stamina - Player.STAMINA_DRAIN_PER_SECOND * deltaSeconds);
            if (this.stamina <= 0) {
                this.body.velocity.normalize().scale(this.velocity);
            }
        } else {
            this.stamina = Math.min(this.maxStamina, this.stamina + Player.STAMINA_REGEN_PER_SECOND * deltaSeconds);
        }

        this.updateHud();
    }

    goToSpawnPoint() {
        this.reviveAtSpawn();
    }

    goToLobbyPoint() {
        this.setPosition(this.lobbyPoint.x, this.lobbyPoint.y);
        this.updateHud();
    }

    isShot() {
        this.takeDamage(Player.BULLET_DAMAGE);
    }

    takeDamage(damage: number) {
        if (!this.isAlive) {
            return;
        }
        let remainingDamage = Math.max(0, damage);
        if (this.shield > 0) {
            const shieldDamage = Math.min(this.shield, remainingDamage);
            this.shield = Math.max(0, this.shield - shieldDamage);
            remainingDamage -= shieldDamage;
        }
        this.health = Math.max(0, this.health - remainingDamage);
        if (this.health <= 0) {
            this.becomeGhost();
        }
        this.updateHud();
    }

    becomeGhost() {
        this.health = 0;
        this.shield = 0;
        this.isAlive = false;
        this.updateHud();
    }

    reviveAtSpawn() {
        this.spawnPoint = this.pickSpawnPoint(this.spawnPoints);
        this.setPosition(this.spawnPoint.x, this.spawnPoint.y);
        this.health = this.maxHealth;
        this.shield = 0;
        this.stamina = this.maxStamina;
        this.isAlive = true;
        this.setAlpha(1);
        this.updateHud();
    }

    healPercent(percent: number) {
        if (!this.isAlive) {
            return;
        }
        this.health = Math.min(this.maxHealth, this.health + this.maxHealth * percent);
        this.updateHud();
    }

    addShieldPercent(percent: number) {
        if (!this.isAlive) {
            return;
        }
        this.shield = Math.min(this.maxShield, this.shield + this.maxShield * percent);
        this.updateHud();
    }

    toJsonBackEnd() : PlayerInterface {
        let returnValue : PlayerInterface = {
            uuid: this.uuid,
            name: this.name,
            x: this.x,
            y: this.y,
            velocityX : this.body.velocity.x,
            velocityY : this.body.velocity.y,
            direction : this.direction,
            atlas : this.atlas,
            frame : this.frame.name,
            width : this.body.width,
            height : this.body.height,
            isAlive : this.isAlive,
            health : Math.ceil(this.health),
            maxHealth : this.maxHealth,
            shield : Math.ceil(this.shield),
            maxShield : this.maxShield,
            skinTint : this.skinTint
        }
        return returnValue;
    }

    updateFromJson(jsonMessage : PlayerInterface) {
        this.setPosition(jsonMessage.x, jsonMessage.y);
        this.lastVelocity.x = jsonMessage.velocityX;
        this.lastVelocity.y = jsonMessage.velocityY;
        this.name = jsonMessage.name;
        this.isAlive = jsonMessage.isAlive;
        this.maxHealth = jsonMessage.maxHealth || Player.DEFAULT_MAX_HEALTH;
        this.health = jsonMessage.health === undefined ? this.maxHealth : jsonMessage.health;
        this.maxShield = jsonMessage.maxShield || Player.DEFAULT_MAX_SHIELD;
        this.shield = jsonMessage.shield === undefined ? 0 : jsonMessage.shield;
        this.skinTint = jsonMessage.skinTint === undefined ? 0xffffff : jsonMessage.skinTint;
        this.setTint(this.skinTint);
        this.lastUpdate = Date.now();
        this.updateHud();
    }

    setVisible(value: boolean): this {
        super.setVisible(value);
        if (this.nameText) {
            this.nameText.setVisible(value);
            this.shieldBarBackground.setVisible(value);
            this.shieldBarFill.setVisible(value);
            this.healthBarBackground.setVisible(value);
            this.healthBarFill.setVisible(value);
            this.staminaBarBackground.setVisible(value);
            this.staminaBarFill.setVisible(value);
            if (this.chatBubbleText) {
                this.chatBubbleText.setVisible(value);
            }
        }
        return this;
    }

    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
            this.shieldBarBackground.destroy();
            this.shieldBarFill.destroy();
            this.healthBarBackground.destroy();
            this.healthBarFill.destroy();
            this.staminaBarBackground.destroy();
            this.staminaBarFill.destroy();
        }
        if (this.chatBubbleTimer) {
            this.chatBubbleTimer.remove(false);
        }
        if (this.chatBubbleText) {
            this.chatBubbleText.destroy();
        }
        super.destroy();
    }

    showChatBubble(message: string) {
        if (this.chatBubbleTimer) {
            this.chatBubbleTimer.remove(false);
            this.chatBubbleTimer = null;
        }
        if (this.chatBubbleText) {
            this.chatBubbleText.destroy();
        }
        this.chatBubbleText = this.scene.add.text(this.x, this.y - 82, message, {
            fontSize: "13px",
            color: "#0b141c",
            backgroundColor: "#ffffff",
            wordWrap: { width: 180, useAdvancedWrap: true }
        });
        this.chatBubbleText.setPadding(8, 5, 8, 5);
        this.chatBubbleText.setOrigin(0.5, 1);
        this.chatBubbleText.setDepth(80);
        this.chatBubbleText.setVisible(this.visible);
        this.chatBubbleTimer = this.scene.time.delayedCall(2000, () => {
            if (this.chatBubbleText) {
                this.chatBubbleText.destroy();
                this.chatBubbleText = null;
            }
            this.chatBubbleTimer = null;
        });
    }

    public updateHud() {
        if (!this.nameText) {
            return;
        }
        this.nameText.setText(this.name);
        this.nameText.setPosition(this.x, this.y - 58);
        this.shieldBarBackground.setPosition(this.x, this.y - 44);
        this.shieldBarFill.setPosition(this.x - 20, this.y - 44);
        this.healthBarBackground.setPosition(this.x, this.y - 34);
        this.healthBarFill.setPosition(this.x - 20, this.y - 34);
        this.staminaBarBackground.setPosition(this.x, this.y - 26);
        this.staminaBarFill.setPosition(this.x - 20, this.y - 26);
        if (this.chatBubbleText) {
            this.chatBubbleText.setPosition(this.x, this.y - 82);
        }

        const shieldRatio = Phaser.Math.Clamp(this.shield / this.maxShield, 0, 1);
        this.shieldBarFill.width = 40 * shieldRatio;
        this.shieldBarBackground.setVisible(this.visible && shieldRatio > 0);
        this.shieldBarFill.setVisible(this.visible && shieldRatio > 0);

        const healthRatio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
        this.healthBarFill.width = 40 * healthRatio;
        if (healthRatio > 0.6) {
            this.healthBarFill.setFillStyle(0x2ecc71, 1);
        } else if (healthRatio > 0.3) {
            this.healthBarFill.setFillStyle(0xf1c40f, 1);
        } else {
            this.healthBarFill.setFillStyle(0xe74c3c, 1);
        }

        const staminaRatio = Phaser.Math.Clamp(this.stamina / this.maxStamina, 0, 1);
        this.staminaBarFill.width = 40 * staminaRatio;
    }

    private pickSpawnPoint(spawnPoints: Array<Phaser.Math.Vector2>): Phaser.Math.Vector2 {
        if (spawnPoints.length === 0) {
            return new Phaser.Math.Vector2(this.lobbyPoint.x, this.lobbyPoint.y);
        }
        const spawnPoint = Phaser.Utils.Array.GetRandom(spawnPoints);
        return new Phaser.Math.Vector2(spawnPoint.x, spawnPoint.y);
    }
}
