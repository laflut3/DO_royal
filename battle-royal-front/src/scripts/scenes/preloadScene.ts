import { MAP_CATALOG } from "../gameCore/mapCatalog"

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload() {
    /* Menu Scene */
    this.load.image('menuBackgroud', 'assets/menu/menuBack.png')
    this.load.atlas("menuButton", 'assets/menu/menuButton.png', 'assets/menu/menuButton.json')

    /* Main Scene */
    // Template
    this.load.image('phaser-logo', 'assets/img/phaser-logo.png');
    // Sprites
    this.load.image('bullet', 'assets/sprites/bullet.png');

    // PropHunt Map
    this.load.image('build_atlas', 'assets/maps/fest_room/build_atlas.png');
    this.load.image('indoor1', 'assets/maps/fest_room/indoor1.png');
    this.load.image('indoor2', 'assets/maps/fest_room/indoor2.png');
    this.load.image('indoor3', 'assets/maps/fest_room/indoor3.png');
    MAP_CATALOG.forEach((mapDefinition) => {
      this.load.tilemapTiledJSON(mapDefinition.mapKey, mapDefinition.path);
    });
    this.load.atlas('fest_room_prop_atlas', 'assets/maps/fest_room/fest_room_prop.png', 'assets/maps/fest_room/fest_room_prop.json');
    this.load.atlas('room_prop_atlas', 'assets/maps/fest_room/room_prop.png', 'assets/maps/fest_room/room_prop.json');

    // Tuxmon player
    this.load.atlas("misa", "assets/atlas/players/misa.png", "assets/atlas/players/misa.json")
    this.load.atlas("scout", "assets/atlas/players/scout.png", "assets/atlas/players/scout.json")
    this.load.atlas("knight", "assets/atlas/players/knight.png", "assets/atlas/players/knight.json")
    this.load.atlas("medic", "assets/atlas/players/medic.png", "assets/atlas/players/medic.json")
    this.load.atlas("rogue", "assets/atlas/players/rogue.png", "assets/atlas/players/rogue.json")
    this.load.atlas("nova", "assets/atlas/players/nova.png", "assets/atlas/players/nova.json")
    this.load.atlas("ember", "assets/atlas/players/ember.png", "assets/atlas/players/ember.json")
    this.load.atlas("cipher", "assets/atlas/players/cipher.png", "assets/atlas/players/cipher.json")
    this.load.atlas("oni", "assets/atlas/players/oni.png", "assets/atlas/players/oni.json")
    this.load.atlas("mbappe", "assets/atlas/players/mbappe.png", "assets/atlas/players/mbappe.json")
    this.load.atlas("oudindindoun-madindindoun", "assets/atlas/players/oudindindoun-madindindoun.png", "assets/atlas/players/oudindindoun-madindindoun.json")
    this.load.atlas("six-seven", "assets/atlas/players/six-seven.png", "assets/atlas/players/six-seven.json")
    this.load.atlas("tralalelo-tralala", "assets/atlas/players/tralalelo-tralala.png", "assets/atlas/players/tralalelo-tralala.json")
    this.load.atlas("tung-tung-tung-sahur", "assets/atlas/players/tung-tung-tung-sahur.png", "assets/atlas/players/tung-tung-tung-sahur.json")
  }

  create() {
    this.scene.start('MenuScene');
  }
}
