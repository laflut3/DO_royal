import DebugText from '../gameCore/debugText'
import Player, { PlayerControlState } from '../objects/player'
import GameMap from '../gameCore/gameMap'
import CameraManager from '../gameCore/gameCamera'
import BackEndWebSocket, { GameStatus } from '../network/backEndWebSocket'
import MultiPlayers from '../objects/multiPlayers'
import BulletGroup from '../objects/bulletGroup'
import GameObjectsGroup from '../objects/gameObjetGroup'
import BattleRoyalPlayer from '../objects/battleRoyalPlayer'
import FrontConf from '../conf'
import FieldOfVision from '../gameCore/fieldOfVision'
import GameMenu from '../gameCore/gameMenu'
import {
  CONTROL_ACTIONS,
  ControlSettings,
  keyboardCodeToLabel,
  loadControlSettings,
  normalizeKeyboardEventKey,
  resetControlSettings,
  saveControlSettings
} from '../gameCore/controlSettings'

type PickupKind = "health" | "shield";

interface BattlePickup {
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  kind: PickupKind;
  percent: number;
}

export default class MainScene extends Phaser.Scene {
  debugText: Phaser.GameObjects.Text
  map: GameMap
  cursors: Phaser.Types.Input.Keyboard.CursorKeys
  controlSettings : ControlSettings
  controlKeys : Map<string, Phaser.Input.Keyboard.Key>
  player: Player
  multiPlayers: MultiPlayers
  cameraManager: CameraManager
  backEndWebSocket: BackEndWebSocket
  bulletsGroup: BulletGroup
  gameObjectGroup: GameObjectsGroup
  roomObjectGroup: GameObjectsGroup
  playerName: string
  gameUuid : string
  gameOwner : Boolean
  isCreate : boolean
  frontConf: FrontConf
  fieldOfVision: FieldOfVision
  gameMenu : GameMenu
  playerUuid : string
  playerSkinTint : number
  playerAtlas : string
  battleZoneCenter : Phaser.Math.Vector2
  battleZoneMaxRadius : number
  battleZoneMinRadius : number
  battleZoneRadius : number
  battleZoneElapsed : number
  battleZoneDuration : number
  battleZoneGraphics : Phaser.GameObjects.Graphics
  minimapGraphics : Phaser.GameObjects.Graphics
  pickups : Array<BattlePickup>
  pickupGroup : Phaser.GameObjects.Group
  previousGameStatus : GameStatus
  visibleMinimapEnemies : Map<string, number>
  previousShootKeyDown : boolean
  participatesInRound : boolean
  pauseKey : Phaser.Input.Keyboard.Key
  pauseMenu : Phaser.GameObjects.Container
  pauseSettingsPanel : Phaser.GameObjects.Container
  pauseSettingsRows : Map<string, Phaser.GameObjects.Text>
  waitingControl : keyof ControlSettings | null
  isPausedByMenu : boolean
  lobbyBounds : Phaser.Geom.Rectangle

  constructor() {
    super({ key: 'MainScene' });
    this.gameOwner = false;
    this.frontConf = new FrontConf();
  }

  init(data: object) {
    this.playerName = data["pseudo"];
    this.gameUuid = data["gameUuid"];
    this.gameOwner = data["gameOwner"];
    this.playerSkinTint = data["skinTint"] || 0xffffff;
    this.playerAtlas = data["playerAtlas"] || "misa";
  }

  create() {
    // Create map
    this.map = new GameMap(this, "map_fest_room", ["build_atlas", "indoor1", "indoor2", "indoor3"]);

    // Create objects
    this.gameObjectGroup = new GameObjectsGroup(this, this.map.tileMap, "fest_room_prop_atlas");
    this.roomObjectGroup = new GameObjectsGroup(this, this.map.tileMap, "room_prop_atlas");

    // Create Player
    this.playerUuid = Phaser.Utils.String.UUID();
    this.player = new BattleRoyalPlayer(this, this.map.lobbyPoint, this.playerAtlas, this.playerUuid, this.playerName, this.playerSkinTint, this.map.spawnPoints);

    // Set player's speed
    this.player.velocity = this.frontConf.playerSpeed;
    this.participatesInRound = false;

    // Set up the arrows to control the player
    this.cursors = this.input.keyboard.createCursorKeys();
    this.controlSettings = loadControlSettings();
    this.controlKeys = new Map<string, Phaser.Input.Keyboard.Key>();
    this.createControlKeys();
    this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.pauseSettingsRows = new Map<string, Phaser.GameObjects.Text>();
    this.waitingControl = null;
    this.isPausedByMenu = false;

    // Create distant players array
    this.multiPlayers = new MultiPlayers(this);

    // Create local and remote bullets
    this.bulletsGroup = new BulletGroup(this, this.frontConf.bulletSpeed);

    //  Adding camera
    this.cameraManager = new CameraManager(this, this.player, this.map.tileMap.widthInPixels, this.map.tileMap.heightInPixels);

    this.createBattleZone();
    this.createPickupGroup();
    this.createMinimap();
    this.visibleMinimapEnemies = new Map<string, number>();
    this.previousShootKeyDown = false;

    // Back end connection, adding web socket
    this.backEndWebSocket = new BackEndWebSocket(this.player, this.multiPlayers, this.bulletsGroup, this.gameUuid, this.gameFinished.bind(this), this.markRemoteShooterOnMinimap.bind(this));
    this.previousGameStatus = this.backEndWebSocket.gameStatus;

    // Display fps
    this.debugText = new DebugText(this);

    // Field Of Vision
    this.fieldOfVision = new FieldOfVision(
      this.map,
      this.gameObjectGroup,
      this.multiPlayers,
      this.bulletsGroup,
      this.frontConf.visionScope,
      this.frontConf.visionAlpha);

    // Fire bullet when player clicks
    this.input.on('pointerdown', (pointer) => {
      if (this.waitingControl !== null && this.pauseSettingsPanel.visible && pointer.rightButtonDown()) {
        this.setControl(this.waitingControl, "RIGHT_CLICK");
        return;
      }
      if(this.backEndWebSocket.gameStatus == GameStatus.PLAYING && this.player.isAlive && !this.isPausedByMenu && this.isShootPointer(pointer)) {
        this.fireBulletToPointer(pointer);
      }
    });
    this.input.mouse.disableContextMenu();
    this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
      if (this.waitingControl !== null && this.pauseSettingsPanel.visible) {
        this.setControl(this.waitingControl, normalizeKeyboardEventKey(event));
      }
    });

    this.addColliders();

    this.gameMenu = new GameMenu(this, this.frontConf, this.backEndWebSocket, this.gameOwner);
    this.createPauseMenu();
    this.createLobbyBounds();

  }

  update(time: number, delta: number) {
    if(this.backEndWebSocket.gameStatus == GameStatus.LOBBY || this.backEndWebSocket.gameStatus == GameStatus.FINISHED) {
      this.gameMenu.update(this.cameraManager.mainCamera.scrollX, this.cameraManager.mainCamera.scrollY);
    } else {
      this.gameMenu.hideMenu();
    }
    if (this.previousGameStatus !== this.backEndWebSocket.gameStatus) {
      this.handleGameStatusTransition(this.previousGameStatus, this.backEndWebSocket.gameStatus);
    }
    this.previousGameStatus = this.backEndWebSocket.gameStatus;

    this.debugText.update(this.cameraManager.mainCamera.scrollX, this.cameraManager.mainCamera.scrollY, this.backEndWebSocket.latency);
    // Players position
    this.player.update(this.readPlayerControls());
    this.keepPlayerInLobbyBeforeGame();
    this.multiPlayers.update();
    this.updateLocalGhostAppearance();
    this.updateRemotePlayerVisibility();
    if(this.backEndWebSocket.gameStatus == GameStatus.PLAYING) {
      this.updateKeyboardShooting();
      this.updateBattleZone(delta);
      this.applyBattleZoneDamage(delta);
    }
    this.drawBattleZone();
    this.drawMinimap();
    // Send player position to back
    this.backEndWebSocket.updatePlayerPosition(this.player);
    // Field Of Vision
    this.fieldOfVision.computeFOV(this.cameraManager.mainCamera, this.player);
  }

  handleGameStatusTransition(previousStatus: GameStatus, nextStatus: GameStatus) {
    if (nextStatus === GameStatus.STARTING) {
      this.participatesInRound = true;
      this.closePauseMenu();
      this.player.reviveAtSpawn();
      this.resetBattleRound();
    } else if (nextStatus === GameStatus.PLAYING && previousStatus === GameStatus.LOBBY) {
      this.participatesInRound = false;
      this.player.becomeGhost();
      this.clearPickups();
    } else if (nextStatus === GameStatus.FINISHED) {
      this.participatesInRound = false;
      this.battleZoneRadius = 0;
      this.battleZoneElapsed = this.battleZoneDuration;
      this.clearPickups();
      this.visibleMinimapEnemies.clear();
      this.closePauseMenu();
    } else if (nextStatus === GameStatus.LOBBY) {
      this.participatesInRound = false;
      this.battleZoneRadius = this.battleZoneMaxRadius;
      this.battleZoneElapsed = 0;
      this.clearPickups();
      this.visibleMinimapEnemies.clear();
      this.closePauseMenu();
    }
  }

  createBattleZone() {
    const mapWidth = this.map.tileMap.widthInPixels;
    const mapHeight = this.map.tileMap.heightInPixels;
    this.battleZoneCenter = new Phaser.Math.Vector2(mapWidth / 2, mapHeight / 2);
    this.battleZoneMaxRadius = Phaser.Math.Distance.Between(0, 0, mapWidth / 2, mapHeight / 2);
    this.battleZoneMinRadius = 0;
    this.battleZoneRadius = this.battleZoneMaxRadius;
    this.battleZoneElapsed = 0;
    this.battleZoneDuration = 180000;
    this.battleZoneGraphics = this.add.graphics();
    this.battleZoneGraphics.setDepth(6);
  }

  createMinimap() {
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setScrollFactor(0);
    this.minimapGraphics.setDepth(1000);
  }

  createPickupGroup() {
    this.pickups = new Array<BattlePickup>();
    this.pickupGroup = this.add.group();
    this.physics.add.overlap(this.player, this.pickupGroup, (player: any, pickupObject: any) => {
      this.collectPickup(<Phaser.GameObjects.Arc>pickupObject);
    });
  }

  resetBattleRound() {
    this.battleZoneElapsed = 0;
    this.battleZoneRadius = this.battleZoneMaxRadius;
    this.visibleMinimapEnemies.clear();
    this.clearPickups();
    this.spawnPickups("health", 9);
    this.spawnPickups("shield", 8);
  }

  clearPickups() {
    this.pickups.forEach((pickup: BattlePickup) => {
      pickup.marker.destroy();
      pickup.label.destroy();
    });
    this.pickups = new Array<BattlePickup>();
    this.pickupGroup.clear(false, false);
  }

  updateBattleZone(delta: number) {
    this.battleZoneElapsed = Math.min(this.battleZoneDuration, this.battleZoneElapsed + delta);
    const progress = this.battleZoneElapsed / this.battleZoneDuration;
    this.battleZoneRadius = Math.max(this.battleZoneMinRadius, Phaser.Math.Linear(this.battleZoneMaxRadius, this.battleZoneMinRadius, progress));
  }

  applyBattleZoneDamage(delta: number) {
    if (!this.player.isAlive) {
      return;
    }
    const distanceFromCenter = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.battleZoneCenter.x, this.battleZoneCenter.y);
    if (distanceFromCenter <= this.battleZoneRadius) {
      return;
    }
    const zoneSeverity = 1 - (this.battleZoneRadius / this.battleZoneMaxRadius);
    const damagePerSecond = 4 + zoneSeverity * 24;
    this.player.takeDamage(damagePerSecond * delta / 1000);
  }

  drawBattleZone() {
    const mapWidth = this.map.tileMap.widthInPixels;
    const mapHeight = this.map.tileMap.heightInPixels;
    const left = Math.max(0, this.battleZoneCenter.x - this.battleZoneRadius);
    const right = Math.min(mapWidth, this.battleZoneCenter.x + this.battleZoneRadius);
    const top = Math.max(0, this.battleZoneCenter.y - this.battleZoneRadius);
    const bottom = Math.min(mapHeight, this.battleZoneCenter.y + this.battleZoneRadius);

    this.battleZoneGraphics.clear();
    if (this.battleZoneRadius <= 0 || this.backEndWebSocket.gameStatus === GameStatus.FINISHED || this.backEndWebSocket.gameStatus === GameStatus.LOBBY) {
      return;
    }
    this.battleZoneGraphics.lineStyle(5, 0x3498db, 0.9);
    this.battleZoneGraphics.strokeCircle(this.battleZoneCenter.x, this.battleZoneCenter.y, this.battleZoneRadius);
  }

  drawMinimap() {
    const width = 168;
    const height = 128;
    const padding = 14;
    const x = this.frontConf.width - width - padding;
    const y = padding;
    const mapWidth = this.map.tileMap.widthInPixels;
    const mapHeight = this.map.tileMap.heightInPixels;
    const scaleX = width / mapWidth;
    const scaleY = height / mapHeight;
    const scalePointX = (worldX: number) => x + worldX * scaleX;
    const scalePointY = (worldY: number) => y + worldY * scaleY;

    this.minimapGraphics.clear();
    this.minimapGraphics.fillStyle(0x0b1220, 0.78);
    this.minimapGraphics.fillRoundedRect(x, y, width, height, 6);
    this.minimapGraphics.lineStyle(2, 0xffffff, 0.85);
    this.minimapGraphics.strokeRoundedRect(x, y, width, height, 6);
    this.drawMapShapeOnMinimap(x, y, width, height, scaleX, scaleY);
    if (this.battleZoneRadius > 0 && this.backEndWebSocket.gameStatus !== GameStatus.LOBBY && this.backEndWebSocket.gameStatus !== GameStatus.FINISHED) {
      this.minimapGraphics.lineStyle(1, 0x3498db, 0.95);
      this.minimapGraphics.strokeCircle(
        scalePointX(this.battleZoneCenter.x),
        scalePointY(this.battleZoneCenter.y),
        this.battleZoneRadius * Math.min(scaleX, scaleY)
      );
    }

    this.pickups.forEach((pickup: BattlePickup) => {
      if (!pickup.marker.visible) {
        return;
      }
      this.minimapGraphics.fillStyle(pickup.kind === "health" ? 0x2ecc71 : 0x3498db, 0.95);
      this.minimapGraphics.fillCircle(scalePointX(pickup.marker.x), scalePointY(pickup.marker.y), 2);
    });

    this.minimapGraphics.fillStyle(0xf1c40f, 1);
    this.minimapGraphics.fillCircle(scalePointX(this.player.x), scalePointY(this.player.y), 4);

    const now = Date.now();
    this.multiPlayers.playersMulti.forEach((player: Player) => {
      if (!player.isAlive || !this.visibleMinimapEnemies.has(player.uuid)) {
        return;
      }
      if ((this.visibleMinimapEnemies.get(player.uuid) || 0) < now) {
        this.visibleMinimapEnemies.delete(player.uuid);
        return;
      }
      this.minimapGraphics.fillStyle(0xe74c3c, 1);
      this.minimapGraphics.fillCircle(scalePointX(player.x), scalePointY(player.y), 3);
    });
  }

  spawnPickups(kind: PickupKind, count: number) {
    for (let index = 0; index < count; index++) {
      const percent = this.pickPickupPercent();
      const position = this.pickOpenMapPosition();
      const color = kind === "health" ? 0x2ecc71 : 0x3498db;
      const marker = this.add.circle(position.x, position.y, 8 + percent * 8, color, 0.9);
      marker.setStrokeStyle(2, 0xffffff, 0.85);
      marker.setDepth(5);
      marker.setData("pickupId", this.pickups.length);
      this.physics.add.existing(marker, true);
      const body = <Phaser.Physics.Arcade.Body>marker.body;
      body.setCircle(12 + percent * 10);
      body.setOffset(-4 - percent * 6, -4 - percent * 6);
      this.pickupGroup.add(marker);

      const labelText = kind === "health" ? "+" : "S";
      const label = this.add.text(position.x, position.y - 5, labelText, {
        fontSize: "13px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3
      });
      label.setOrigin(0.5, 0.5);
      label.setDepth(6);

      this.pickups.push({
        marker: marker,
        label: label,
        kind: kind,
        percent: percent
      });
    }
  }

  pickPickupPercent(): number {
    const roll = Math.random();
    if (roll < 0.05) {
      return 1;
    }
    if (roll < 0.25) {
      return 0.5;
    }
    return 0.25;
  }

  drawMapShapeOnMinimap(x: number, y: number, width: number, height: number, scaleX: number, scaleY: number) {
    const tileWidth = this.map.tileMap.tileWidth;
    const tileHeight = this.map.tileMap.tileHeight;
    const stepX = Math.max(1, Math.ceil(this.map.tileMap.width / 42));
    const stepY = Math.max(1, Math.ceil(this.map.tileMap.height / 32));

    this.minimapGraphics.fillStyle(0x28414a, 0.65);
    for (let tileY = 0; tileY < this.map.tileMap.height; tileY += stepY) {
      for (let tileX = 0; tileX < this.map.tileMap.width; tileX += stepX) {
        const tile = this.map.worldLayer.getTileAt(tileX, tileY);
        if (!tile || !tile.collides) {
          continue;
        }
        this.minimapGraphics.fillRect(
          x + tileX * tileWidth * scaleX,
          y + tileY * tileHeight * scaleY,
          Math.max(1, tileWidth * stepX * scaleX),
          Math.max(1, tileHeight * stepY * scaleY)
        );
      }
    }
  }

  createControlKeys() {
    Object.keys(this.controlSettings).forEach((controlName: string) => {
      const keyCode = this.controlSettings[controlName];
      if (keyCode === "RIGHT_CLICK" || keyCode === "LEFT_CLICK") {
        return;
      }
      if (!this.controlKeys.has(keyCode)) {
        this.controlKeys.set(keyCode, this.input.keyboard.addKey(keyCode));
      }
    });
  }

  readPlayerControls(): PlayerControlState {
    if (this.isPausedByMenu) {
      return {
        up: false,
        down: false,
        left: false,
        right: false,
        sprint: false
      };
    }
    return {
      up: this.isControlDown("up"),
      down: this.isControlDown("down"),
      left: this.isControlDown("left"),
      right: this.isControlDown("right"),
      sprint: this.isControlDown("sprint")
    };
  }

  isControlDown(controlName: keyof ControlSettings): boolean {
    const keyCode = this.controlSettings[controlName];
    const key = this.controlKeys.get(keyCode);
    return key ? key.isDown : false;
  }

  isShootPointer(pointer: Phaser.Input.Pointer): boolean {
    const shootControl = this.controlSettings.shoot;
    if (shootControl === "RIGHT_CLICK") {
      return pointer.rightButtonDown();
    }
    if (shootControl === "LEFT_CLICK") {
      return pointer.leftButtonDown();
    }
    return false;
  }

  updateKeyboardShooting() {
    const shootControl = this.controlSettings.shoot;
    if (shootControl === "RIGHT_CLICK" || shootControl === "LEFT_CLICK") {
      this.previousShootKeyDown = false;
      return;
    }
    const shootKey = this.controlKeys.get(shootControl);
    const shootKeyDown = shootKey ? shootKey.isDown : false;
    if (this.player.isAlive && !this.isPausedByMenu && shootKeyDown && !this.previousShootKeyDown) {
      this.fireBulletToPointer(this.input.activePointer);
    }
    this.previousShootKeyDown = shootKeyDown;
  }

  fireBulletToPointer(pointer: Phaser.Input.Pointer) {
    this.bulletsGroup.fireBullet(this.player.x, this.player.y,
      this.cameraManager.mainCamera.scrollX + pointer.x, this.cameraManager.mainCamera.scrollY + pointer.y,
      Phaser.Utils.String.UUID(),
      this.backEndWebSocket);
  }

  markRemoteShooterOnMinimap(startX: number, startY: number) {
    let nearestPlayer : Player | undefined;
    let nearestDistance = 999999;
    this.multiPlayers.playersMulti.forEach((player: Player) => {
      const distance = Phaser.Math.Distance.Between(player.x, player.y, startX, startY);
      if (distance < nearestDistance) {
        nearestPlayer = player;
        nearestDistance = distance;
      }
    });
    if (nearestPlayer && nearestDistance < 90) {
      this.visibleMinimapEnemies.set(nearestPlayer.uuid, Date.now() + 3500);
    }
  }

  createLobbyBounds() {
    this.lobbyBounds = new Phaser.Geom.Rectangle(128, 96, 2944, 512);
  }

  keepPlayerInLobbyBeforeGame() {
    if (this.backEndWebSocket.gameStatus !== GameStatus.LOBBY) {
      return;
    }
    const body = <Phaser.Physics.Arcade.Body>this.player.body;
    const halfWidth = body.width / 2;
    const halfHeight = body.height / 2;
    const clampedX = Phaser.Math.Clamp(
      this.player.x,
      this.lobbyBounds.left + halfWidth,
      this.lobbyBounds.right - halfWidth
    );
    const clampedY = Phaser.Math.Clamp(
      this.player.y,
      this.lobbyBounds.top + halfHeight,
      this.lobbyBounds.bottom - halfHeight
    );
    if (clampedX !== this.player.x || clampedY !== this.player.y) {
      this.player.setPosition(clampedX, clampedY);
      this.player.updateHud();
    }
  }

  updateLocalGhostAppearance() {
    if (this.player.isAlive) {
      this.player.setAlpha(1);
      return;
    }
    this.player.setAlpha(0.45);
  }

  updateRemotePlayerVisibility() {
    this.multiPlayers.playersMulti.forEach((player: Player) => {
      if (this.player.isAlive && !player.isAlive) {
        player.setVisible(false);
        return;
      }
      player.setVisible(true);
      player.setAlpha(player.isAlive ? 1 : 0.45);
      player.updateHud();
    });
  }

  createPauseMenu() {
    const centerX = this.frontConf.width / 2;
    const centerY = this.frontConf.height / 2;
    this.pauseMenu = this.add.container(0, 0);
    this.pauseMenu.setScrollFactor(0);
    this.pauseMenu.setDepth(3000);
    this.pauseMenu.setVisible(false);

    const overlay = this.add.rectangle(centerX, centerY, this.frontConf.width, this.frontConf.height, 0x02070a, 0.68);
    overlay.setInteractive();
    const panel = this.add.rectangle(centerX, centerY, 420, 290, 0x0d1b24, 0.96);
    panel.setStrokeStyle(2, 0x5fd0b5, 0.75);
    const title = this.add.text(centerX, centerY - 105, "Pause");
    title.setOrigin(0.5, 0.5);
    title.setFontSize(34);
    title.setColor("#f6fbff");

    const resumeButton = this.createPauseButton(centerX, centerY - 35, "Reprendre", () => this.closePauseMenu());
    const settingsButton = this.createPauseButton(centerX, centerY + 25, "Parametres", () => this.openPauseSettings());
    const quitButton = this.createPauseButton(centerX, centerY + 85, "Quitter la partie", () => this.leaveGameToMenu());

    this.pauseMenu.add([overlay, panel, title]);
    this.pauseMenu.add(resumeButton);
    this.pauseMenu.add(settingsButton);
    this.pauseMenu.add(quitButton);

    this.createPauseSettingsPanel();
    this.input.keyboard.on("keydown-ESC", (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.repeat || !this.canUsePauseMenu()) {
        return;
      }
      this.togglePauseMenu();
    });
  }

  canUsePauseMenu(): boolean {
    return this.backEndWebSocket.gameStatus === GameStatus.STARTING || this.backEndWebSocket.gameStatus === GameStatus.PLAYING;
  }

  createPauseButton(x: number, y: number, label: string, callback: Function): Array<Phaser.GameObjects.GameObject> {
    const button = this.add.rectangle(x, y, 210, 40, 0x122b36, 0.95);
    button.setStrokeStyle(1, 0xf4d35e, 0.7);
    button.setInteractive();
    button.on("pointerdown", () => callback());
    const text = this.add.text(x, y, label);
    text.setOrigin(0.5, 0.5);
    text.setFontSize(18);
    text.setColor("#f6fbff");
    return [button, text];
  }

  createPauseSettingsPanel() {
    const centerX = this.frontConf.width / 2;
    const centerY = this.frontConf.height / 2;
    this.pauseSettingsPanel = this.add.container(0, 0);
    this.pauseSettingsPanel.setScrollFactor(0);
    this.pauseSettingsPanel.setDepth(3100);
    this.pauseSettingsPanel.setVisible(false);

    const overlay = this.add.rectangle(centerX, centerY, this.frontConf.width, this.frontConf.height, 0x02070a, 0.72);
    overlay.setInteractive();
    const panel = this.add.rectangle(centerX, centerY, 520, 430, 0x0d1b24, 0.96);
    panel.setStrokeStyle(2, 0x5fd0b5, 0.7);
    const title = this.add.text(centerX, centerY - 180, "Parametres des touches");
    title.setOrigin(0.5, 0.5);
    title.setFontSize(28);
    title.setColor("#f6fbff");
    this.pauseSettingsPanel.add([overlay, panel, title]);

    CONTROL_ACTIONS.forEach((action, index) => {
      const y = centerY - 120 + index * 44;
      const label = this.add.text(centerX - 170, y, action.label);
      label.setOrigin(0, 0.5);
      label.setFontSize(20);
      label.setColor("#b7d8de");
      const valueBox = this.add.rectangle(centerX + 120, y, 180, 30, 0x122b36, 0.9);
      valueBox.setStrokeStyle(1, 0xf4d35e, 0.65);
      valueBox.setInteractive();
      valueBox.on("pointerdown", () => this.waitForControl(action.id));
      const valueText = this.add.text(centerX + 120, y, keyboardCodeToLabel(this.controlSettings[action.id]));
      valueText.setOrigin(0.5, 0.5);
      valueText.setFontSize(18);
      valueText.setColor("#f6fbff");
      valueText.setInteractive();
      valueText.on("pointerdown", () => this.waitForControl(action.id));
      this.pauseSettingsRows.set(action.id, valueText);
      this.pauseSettingsPanel.add([label, valueBox, valueText]);
    });

    this.pauseSettingsPanel.add(this.createPauseButton(centerX - 105, centerY + 165, "Reset", () => {
      this.controlSettings = resetControlSettings();
      this.rebuildControlKeys();
      this.refreshPauseSettingsRows();
    }));
    this.pauseSettingsPanel.add(this.createPauseButton(centerX + 105, centerY + 165, "Retour", () => {
      this.waitingControl = null;
      this.pauseSettingsPanel.setVisible(false);
      this.pauseMenu.setVisible(true);
    }));
  }

  togglePauseMenu() {
    if (this.isPausedByMenu) {
      this.closePauseMenu();
    } else {
      this.openPauseMenu();
    }
  }

  openPauseMenu() {
    this.isPausedByMenu = true;
    this.waitingControl = null;
    this.pauseSettingsPanel.setVisible(false);
    this.pauseMenu.setVisible(true);
  }

  closePauseMenu() {
    this.isPausedByMenu = false;
    this.waitingControl = null;
    if (this.pauseMenu) {
      this.pauseMenu.setVisible(false);
    }
    if (this.pauseSettingsPanel) {
      this.pauseSettingsPanel.setVisible(false);
    }
  }

  openPauseSettings() {
    this.waitingControl = null;
    this.refreshPauseSettingsRows();
    this.pauseMenu.setVisible(false);
    this.pauseSettingsPanel.setVisible(true);
  }

  waitForControl(control: keyof ControlSettings) {
    this.waitingControl = control;
    this.refreshPauseSettingsRows();
    const row = this.pauseSettingsRows.get(control);
    if (row) {
      row.setText("Appuie...");
      row.setColor("#f4d35e");
    }
  }

  setControl(control: keyof ControlSettings, value: string) {
    this.controlSettings[control] = value;
    saveControlSettings(this.controlSettings);
    this.waitingControl = null;
    this.rebuildControlKeys();
    this.refreshPauseSettingsRows();
  }

  refreshPauseSettingsRows() {
    CONTROL_ACTIONS.forEach((action) => {
      const row = this.pauseSettingsRows.get(action.id);
      if (row) {
        row.setText(keyboardCodeToLabel(this.controlSettings[action.id]));
        row.setColor("#f6fbff");
      }
    });
  }

  rebuildControlKeys() {
    this.controlKeys.clear();
    this.createControlKeys();
  }

  leaveGameToMenu() {
    if (this.backEndWebSocket && this.backEndWebSocket.webSocket) {
      this.backEndWebSocket.webSocket.close();
    }
    this.scene.start("MenuScene");
  }

  pickOpenMapPosition(): Phaser.Math.Vector2 {
    const mapWidth = this.map.tileMap.widthInPixels;
    const mapHeight = this.map.tileMap.heightInPixels;
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = Phaser.Math.Between(48, mapWidth - 48);
      const y = Phaser.Math.Between(48, mapHeight - 48);
      const tile = this.map.worldLayer.getTileAtWorldXY(x, y);
      if (!tile || !tile.collides) {
        return new Phaser.Math.Vector2(x, y);
      }
    }
    return new Phaser.Math.Vector2(this.map.spawnPoint.x, this.map.spawnPoint.y);
  }

  collectPickup(marker: Phaser.GameObjects.Arc) {
    if (!this.player.isAlive) {
      return;
    }
    if (!marker.visible) {
      return;
    }
    const pickup = this.pickups[marker.getData("pickupId")];
    if (!pickup) {
      return;
    }
    if (pickup.kind === "health") {
      this.player.healPercent(pickup.percent);
    } else {
      this.player.addShieldPercent(pickup.percent);
    }
    pickup.marker.setVisible(false);
    pickup.label.setVisible(false);
    if (pickup.marker.body) {
      (<Phaser.Physics.Arcade.Body>pickup.marker.body).enable = false;
    }
  }

  addColliders() {
    /*** Player ***/
    // Watch the player and worldLayer for collisions, for the duration of the scene:
    this.physics.add.collider(this.player, this.map.worldLayer);
    // Add collides btw player and objects
    this.physics.add.collider(this.player, this.gameObjectGroup);
    this.physics.add.collider(this.player, this.roomObjectGroup);

    /*** Multi-Players ***/
    // Add colliders
    this.physics.add.collider(this.multiPlayers, this.map.worldLayer);
    // Add collides btw multi-players and objects
    this.physics.add.collider(this.multiPlayers, this.gameObjectGroup );
    this.physics.add.collider(this.multiPlayers, this.roomObjectGroup );

    // Add collides btw player and multi-players
    this.physics.add.collider(this.player, this.multiPlayers, undefined, (player: any, otherPlayer: any) => {
      return player.isAlive && otherPlayer.isAlive;
    });

    /*** Bullets ***/
    // If bullet I fired collides with wall, the server is informed
    // Collider with WorldLayer
    this.physics.add.collider(this.bulletsGroup, this.map.worldLayer, (bullet: any, map: any) => {
      this.bulletsGroup.deleteBulletIfLocal(bullet, this.backEndWebSocket);
    });
    // Collider with objects
    this.physics.add.collider(this.bulletsGroup, this.gameObjectGroup, (bullet: any, map: any) => {
      this.bulletsGroup.deleteBulletIfLocal(bullet, this.backEndWebSocket);
    });
    this.physics.add.collider(this.bulletsGroup, this.roomObjectGroup, (bullet: any, map: any) => {
      this.bulletsGroup.deleteBulletIfLocal(bullet, this.backEndWebSocket);
    });
    // Collider with player
    this.physics.add.collider(this.player, this.bulletsGroup, (player: any, bullet: any) => {
      if (!this.player.isAlive) {
        return;
      }
      // If bullet was remote, player has been shot otherwise do nothing to avoid sucuide.
      if (this.bulletsGroup.deleteBulletIfRemote(bullet, this.backEndWebSocket)) {
        this.player.isShot();
      }
    });
  }

  lauchGame() {
    this.multiPlayers.playersMulti = new Array<Player>();
  }

  gameFinished(winnerName: string) {
    this.gameMenu.printWinner(winnerName);
    if(this.gameOwner) {
      this.gameMenu.printMenu();
      // Set lobby after 1 seconds
      setTimeout(this.backEndWebSocket.lobbyGame.bind(this.backEndWebSocket), 1000);
    }
  }
}
