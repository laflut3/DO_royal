import { Physics } from "phaser";
import FrontConf from "../conf";
import { TextEdit, Edit } from 'phaser3-rex-plugins/plugins/textedit.js';


import ListGamesWebSocket from "../network/listGameWebSocket"
import {
    CONTROL_ACTIONS,
    ControlSettings,
    keyboardCodeToLabel,
    loadControlSettings,
    normalizeKeyboardEventKey,
    resetControlSettings,
    saveControlSettings
} from "../gameCore/controlSettings"

interface SkinOption {
    name: string
    atlas: string
    description: string
}

export default class MenuScene extends Phaser.Scene {
    serverList : Map<string, string>
    graphicServerList : Array<Phaser.GameObjects.Text>
    selectedServer : string | undefined
    webSocket : ListGamesWebSocket
    frontConf : FrontConf
    pseudoText : Phaser.GameObjects.Text
    textJoin : Phaser.GameObjects.Text
    serverNameText : Phaser.GameObjects.Text
    selectedSkinIndex : number
    skinPreview : Phaser.GameObjects.Sprite
    skinNameText : Phaser.GameObjects.Text
    skinDescriptionText : Phaser.GameObjects.Text
    skinOptions : Array<SkinOption>
    animatedTiles : Array<Phaser.GameObjects.TileSprite>
    controlSettings : ControlSettings
    settingsPanel : Phaser.GameObjects.Container
    settingsRows : Map<string, Phaser.GameObjects.Text>
    waitingControl : keyof ControlSettings | null

    constructor() {
      super({ key: 'MenuScene' })
    }

    create() {
        this.webSocket = new ListGamesWebSocket(this);

        this.frontConf = new FrontConf();
        this.controlSettings = loadControlSettings();
        this.settingsRows = new Map<string, Phaser.GameObjects.Text>();
        this.waitingControl = null;
        this.selectedSkinIndex = 0;
        this.animatedTiles = new Array<Phaser.GameObjects.TileSprite>();
        this.skinOptions = [
            { name: "Misa", atlas: "misa", description: "Balanced survivor" },
            { name: "Scout", atlas: "scout", description: "Fast forest runner" },
            { name: "Knight", atlas: "knight", description: "Armored frontliner" },
            { name: "Medic", atlas: "medic", description: "Field support" },
            { name: "Rogue", atlas: "rogue", description: "Masked ambusher" }
        ];
        // Fill the back ground with texture
        for(let w = 0; w <= this.frontConf.width; w+= 512 ) {
            for(let h = 0; h <= this.frontConf.height; h+= 512 ) {
                let tile = this.add.tileSprite(w, h, 512, 512, 'menuBackgroud');
                tile.setAlpha(0.82);
                this.animatedTiles.push(tile);
            }
        }
        this.add.rectangle(this.frontConf.width / 2, this.frontConf.height / 2, this.frontConf.width, this.frontConf.height, 0x071017, 0.55);
        this.createAnimatedBackground();

        /* Title */
        let textTitle = this.add.text(this.frontConf.width/2, 30, "Battle Royal 2D");
        textTitle.setOrigin(0.5, 0.5);
        textTitle.setFontSize(50);
        textTitle.setColor("#f7fbff");
        textTitle.setStroke("#0b141c", 6);
        this.tweens.add({ targets: textTitle, y: 38, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        let textSubTitle = this.add.text(this.frontConf.width/2, 83, "Choose your fighter, join the arena, survive.");
        textSubTitle.setOrigin(0.5, 0.5);
        textSubTitle.setFontSize(20);
        textSubTitle.setColor("#b7d8de");

        /* Pseudo */
        this.add.rectangle(this.frontConf.width/2, this.frontConf.height/2 - 122, 590, 112, 0x0d1b24, 0.82).setStrokeStyle(2, 0x2f7f83, 0.5);
        let pseudoLabel = this.add.text(this.frontConf.width/2 - 150, this.frontConf.height/2 - 150, "Enter your pseudo :");
        pseudoLabel.setOrigin(0.5, 0.5);
        pseudoLabel.setFontSize(25);
        var pseudoBox = this.add.sprite(this.frontConf.width/2 + 150, this.frontConf.height/2 -150, 'menuButton', 'edit-box');
        pseudoBox.setOrigin(0.5, 0.5);
        this.pseudoText = this.add.text(this.frontConf.width/2 +150, this.frontConf.height/2 -150, "Enter pseudo");
        this.pseudoText.setOrigin(0.5, 0.5);
        this.pseudoText.setColor("#f6fbff");
        this.pseudoText.setInteractive();
        this.pseudoText.setInteractive().on('pointerdown', () => {
            var editor = new TextEdit(this.pseudoText);
            editor.open(
            {
                onOpen: function (textObject) {},
                onTextChanged: function (textObject, text) {
                    (textObject as Phaser.GameObjects.Text).text = text;
                },
                onClose: function (textObject) {},
                selectAll: true,
            });
        });

        /* Skin */
        let skinLabel = this.add.text(this.frontConf.width/2 - 150, this.frontConf.height/2 - 95, "Choose your character :");
        skinLabel.setOrigin(0.5, 0.5);
        skinLabel.setFontSize(25);
        this.skinPreview = this.add.sprite(this.frontConf.width/2 + 60, this.frontConf.height/2 - 92, "misa", "misa-front");
        this.skinPreview.setScale(1.8, 1.8);
        this.skinNameText = this.add.text(this.frontConf.width/2 + 185, this.frontConf.height/2 - 100, this.skinOptions[this.selectedSkinIndex].name);
        this.skinNameText.setOrigin(0.5, 0.5);
        this.skinNameText.setFontSize(20);
        this.skinNameText.setColor("#f6fbff");
        this.skinDescriptionText = this.add.text(this.frontConf.width/2 + 185, this.frontConf.height/2 - 73, this.skinOptions[this.selectedSkinIndex].description);
        this.skinDescriptionText.setOrigin(0.5, 0.5);
        this.skinDescriptionText.setFontSize(13);
        this.skinDescriptionText.setColor("#8fb7bf");
        let previousSkin = this.add.text(this.frontConf.width/2 + 135, this.frontConf.height/2 - 100, "<");
        previousSkin.setOrigin(0.5, 0.5);
        previousSkin.setFontSize(30);
        previousSkin.setColor("#f4d35e");
        previousSkin.setInteractive();
        previousSkin.on('clicked', () => this.changeSkin(-1));
        let nextSkin = this.add.text(this.frontConf.width/2 + 235, this.frontConf.height/2 - 100, ">");
        nextSkin.setOrigin(0.5, 0.5);
        nextSkin.setFontSize(30);
        nextSkin.setColor("#f4d35e");
        nextSkin.setInteractive();
        nextSkin.on('clicked', () => this.changeSkin(1));
        this.tweens.add({ targets: this.skinPreview, y: this.skinPreview.y - 5, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.updateSkinPreview();

        /* Join Section */
        this.add.rectangle(this.frontConf.width/2 - 300, this.frontConf.height/2 + 120, 420, 330, 0x0d1b24, 0.86).setStrokeStyle(2, 0x2f7f83, 0.45);
        this.textJoin = this.add.text(this.frontConf.width/2 - 300, this.frontConf.height / 2, "Join server");
        this.textJoin.setOrigin(0.5, 0.5);
        this.textJoin.setFontSize(25);
        this.textJoin.setColor("#f6fbff");

        /* Button Refresh */
        let buttonRefresh = this.add.sprite(this.frontConf.width/2 - 400, this.frontConf.height / 2 + 260, 'menuButton', 'button1');
        buttonRefresh.setInteractive();
        buttonRefresh.setScale(0.7, 0.7);
        buttonRefresh.on('clicked', (button : Physics.Arcade.Sprite) => {
            buttonRefresh.setFrame("button1-clicked");
            this.webSocket.sendServerListRequest();
        });
        buttonRefresh.on('pointerup', (button : Physics.Arcade.Sprite) => {
            buttonRefresh.setFrame("button1");
        });

        let textRefresh = this.add.text(this.frontConf.width/2 - 400, this.frontConf.height / 2 + 260, "Refresh servers");
        textRefresh.setOrigin(0.5, 0.5);
        textRefresh.setScale(0.7, 0.7);
        textRefresh.setColor("#f6fbff");

        /* Button Join */
        let buttonJoin = this.add.sprite(this.frontConf.width/2 - 200, this.frontConf.height / 2 + 260, 'menuButton', 'button1');
        buttonJoin.setInteractive();
        buttonJoin.setScale(0.7, 0.7);
        buttonJoin.on('clicked', (button : Physics.Arcade.Sprite) => {
            buttonJoin.setFrame("button1-clicked");
            this.joinServer();
        });
        buttonJoin.on('pointerup', (button : Physics.Arcade.Sprite) => {
            buttonJoin.setFrame("button1");
        });

        let textSelectedJoin = this.add.text(this.frontConf.width/2 - 200, this.frontConf.height / 2 + 260, "Join Selected Server");
        textSelectedJoin.setOrigin(0.5, 0.5);
        textSelectedJoin.setScale(0.7, 0.7);
        textSelectedJoin.setColor("#f6fbff");

        /* Server List */
        let textServer = this.add.text(this.frontConf.width/2 - 300, this.frontConf.height/2 + 110 , "Server List");
        textServer.setOrigin(0.5, 0.5);
        textServer.setColor("#b7d8de");

        let serverListBack = this.add.sprite(this.frontConf.width/2 - 300, this.frontConf.height/2 + 120, 'menuButton', 'server-list');
        serverListBack.scale = 2.5

        this.serverList = new Map<string, string>();
        this.graphicServerList = new Array<Phaser.GameObjects.Text>();

        /* Create Section */
        this.add.rectangle(this.frontConf.width/2 + 300, this.frontConf.height/2 + 85, 390, 210, 0x0d1b24, 0.86).setStrokeStyle(2, 0xf4d35e, 0.45);
        let textCreateSection = this.add.text(this.frontConf.width/2 + 300, this.frontConf.height / 2, "Create a server");
        textCreateSection.setOrigin(0.5, 0.5);
        textCreateSection.setFontSize(25);
        textCreateSection.setColor("#f6fbff");

        var serverNameInput = this.add.sprite(this.frontConf.width/2 +300, this.frontConf.height/2 + 50, 'menuButton', 'edit-box');
        serverNameInput.setOrigin(0.5, 0.5);
        this.serverNameText = this.add.text(this.frontConf.width/2 +300, this.frontConf.height/2 + 50, "Enter server name");
        this.serverNameText.setOrigin(0.5, 0.5);
        this.serverNameText.setColor("#f6fbff");
        this.serverNameText.setInteractive();
        this.serverNameText.setInteractive().on('pointerdown', () => {
            var editor = new TextEdit(this.serverNameText);
            editor.open(
            {
                onOpen: function (textObject) {},
                onTextChanged: function (textObject, text) {
                    (textObject as Phaser.GameObjects.Text).text = text;
                },
                onClose: function (textObject) {},
                selectAll: true,
            });
        });

        let buttonCreate = this.add.sprite(this.frontConf.width/2 + 300, this.frontConf.height/2+ 100, 'menuButton', 'button1');
        buttonCreate.setInteractive();
        buttonCreate.on('clicked', (button : Physics.Arcade.Sprite) => {
            buttonCreate.setFrame("button1-clicked");
            this.createGame();
        });
        buttonCreate.on('pointerup', (button : Physics.Arcade.Sprite) => {
            buttonCreate.setFrame("button1");
        });

        let textCreate = this.add.text(this.frontConf.width/2 +300, this.frontConf.height/2 + 100, "Create Server");
        textCreate.setOrigin(0.5, 0.5);
        textCreate.setColor("#f6fbff");

        let buttonSettings = this.add.sprite(this.frontConf.width - 155, 44, 'menuButton', 'button1');
        buttonSettings.setInteractive();
        buttonSettings.setScale(0.55, 0.55);
        buttonSettings.on('clicked', (button : Physics.Arcade.Sprite) => {
            this.openSettingsPanel();
        });

        let textSettings = this.add.text(this.frontConf.width - 155, 44, "Parametres");
        textSettings.setOrigin(0.5, 0.5);
        textSettings.setScale(0.65, 0.65);
        textSettings.setColor("#f6fbff");

        this.createSettingsPanel();
        this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
            if (this.waitingControl === null) {
                return;
            }
            this.setControl(this.waitingControl, normalizeKeyboardEventKey(event));
        });
        this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            if (this.waitingControl === null || !pointer.rightButtonDown()) {
                return;
            }
            this.setControl(this.waitingControl, "RIGHT_CLICK");
        });
        this.input.mouse.disableContextMenu();
        // Catch click and send it to corresponding game object
        this.input.on('gameobjectdown', (pointer, gameObject) => {gameObject.emit('clicked', gameObject)});
        this.input.on('gameobjectup', (pointer, gameObject) => {gameObject.emit('pointerup', gameObject)});
    }

    update() {
        this.animatedTiles.forEach((tile, index) => {
            tile.tilePositionX += 0.12 + index * 0.004;
            tile.tilePositionY += 0.05;
        });
    }

    goToMainScene(data : object) {
        this.scene.start('MainScene',  data);
    }

    createGame() {
        if(this.pseudoText.text === null || this.pseudoText.text === "Enter pseudo") {
            this.pseudoText.setColor("red");
            return;
        } else {
            this.pseudoText.setColor("green");
        }
        if (this.serverNameText.text === null || this.serverNameText.text === "Enter server name") {
            this.serverNameText.setColor("red");
            return;
        } else {
            this.serverNameText.setColor("green");
        }
        console.log("Creating a new game " + this.serverNameText.text);
        var gameUuid = Phaser.Utils.String.UUID();
        this.webSocket.createNewServer(
            this.serverNameText.text,
            gameUuid,
            () => this.goToMainScene({ pseudo: this.pseudoText.text, gameUuid : gameUuid, gameOwner : true, playerAtlas: this.currentSkinAtlas(), skinTint: 0xffffff }),
            (errorMessage: string) => {
                console.log("Game creation failed: " + errorMessage);
                this.serverNameText.setColor("red");
            });
    }

    joinServer() {
        if(this.pseudoText.text === null || this.pseudoText.text === "Enter pseudo") {
            this.pseudoText.setColor("red");
            return;
        } else {
            this.pseudoText.setColor("green");
        }
        if(this.selectedServer === undefined) {
            this.textJoin.setColor("red");
            return;
        }
        this.goToMainScene({ pseudo: this.pseudoText.text, gameUuid : this.selectedServer, gameOwner : false, playerAtlas: this.currentSkinAtlas(), skinTint: 0xffffff });
    }

    changeSkin(direction : number) {
        this.selectedSkinIndex = (this.selectedSkinIndex + direction + this.skinOptions.length) % this.skinOptions.length;
        this.updateSkinPreview();
    }

    updateSkinPreview() {
        const skin = this.skinOptions[this.selectedSkinIndex];
        this.skinPreview.setTexture(skin.atlas, skin.atlas.concat("-front"));
        this.skinPreview.clearTint();
        this.skinNameText.setText(skin.name);
        this.skinDescriptionText.setText(skin.description);
    }

    currentSkinAtlas() : string {
        return this.skinOptions[this.selectedSkinIndex].atlas;
    }

    createSettingsPanel() {
        this.settingsPanel = this.add.container(0, 0);
        this.settingsPanel.setDepth(2000);
        this.settingsPanel.setVisible(false);

        const centerX = this.frontConf.width / 2;
        const centerY = this.frontConf.height / 2;
        const overlay = this.add.rectangle(centerX, centerY, this.frontConf.width, this.frontConf.height, 0x02070a, 0.72);
        overlay.setInteractive();
        const panel = this.add.rectangle(centerX, centerY, 520, 430, 0x0d1b24, 0.96);
        panel.setStrokeStyle(2, 0x5fd0b5, 0.7);
        const title = this.add.text(centerX, centerY - 180, "Parametres des touches");
        title.setOrigin(0.5, 0.5);
        title.setFontSize(28);
        title.setColor("#f6fbff");

        this.settingsPanel.add([overlay, panel, title]);
        CONTROL_ACTIONS.forEach((action, index) => {
            const y = centerY - 120 + index * 44;
            const label = this.add.text(centerX - 170, y, action.label);
            label.setOrigin(0, 0.5);
            label.setFontSize(20);
            label.setColor("#b7d8de");
            const valueBox = this.add.rectangle(centerX + 120, y, 180, 30, 0x122b36, 0.9);
            valueBox.setStrokeStyle(1, 0xf4d35e, 0.65);
            valueBox.setInteractive();
            valueBox.on("clicked", () => this.waitForControl(action.id));
            const valueText = this.add.text(centerX + 120, y, keyboardCodeToLabel(this.controlSettings[action.id]));
            valueText.setOrigin(0.5, 0.5);
            valueText.setFontSize(18);
            valueText.setColor("#f6fbff");
            valueText.setInteractive();
            valueText.on("clicked", () => this.waitForControl(action.id));
            this.settingsRows.set(action.id, valueText);
            this.settingsPanel.add([label, valueBox, valueText]);
        });

        const resetButton = this.add.rectangle(centerX - 105, centerY + 165, 140, 38, 0x122b36, 0.95);
        resetButton.setStrokeStyle(1, 0xf4d35e, 0.7);
        resetButton.setInteractive();
        resetButton.on("clicked", () => {
            this.controlSettings = resetControlSettings();
            this.refreshSettingsRows();
        });
        const resetText = this.add.text(centerX - 105, centerY + 165, "Reset");
        resetText.setOrigin(0.5, 0.5);
        resetText.setFontSize(18);
        resetText.setColor("#f6fbff");

        const closeButton = this.add.rectangle(centerX + 105, centerY + 165, 140, 38, 0x122b36, 0.95);
        closeButton.setStrokeStyle(1, 0x5fd0b5, 0.7);
        closeButton.setInteractive();
        closeButton.on("clicked", () => this.closeSettingsPanel());
        const closeText = this.add.text(centerX + 105, centerY + 165, "Fermer");
        closeText.setOrigin(0.5, 0.5);
        closeText.setFontSize(18);
        closeText.setColor("#f6fbff");

        this.settingsPanel.add([resetButton, resetText, closeButton, closeText]);
    }

    openSettingsPanel() {
        this.waitingControl = null;
        this.refreshSettingsRows();
        this.settingsPanel.setVisible(true);
    }

    closeSettingsPanel() {
        this.waitingControl = null;
        this.settingsPanel.setVisible(false);
    }

    waitForControl(control: keyof ControlSettings) {
        this.waitingControl = control;
        this.refreshSettingsRows();
        const row = this.settingsRows.get(control);
        if (row) {
            row.setText("Appuie...");
            row.setColor("#f4d35e");
        }
    }

    setControl(control: keyof ControlSettings, value: string) {
        this.controlSettings[control] = value;
        saveControlSettings(this.controlSettings);
        this.waitingControl = null;
        this.refreshSettingsRows();
    }

    refreshSettingsRows() {
        CONTROL_ACTIONS.forEach((action) => {
            const row = this.settingsRows.get(action.id);
            if (row) {
                row.setText(keyboardCodeToLabel(this.controlSettings[action.id]));
                row.setColor("#f6fbff");
            }
        });
    }

    createAnimatedBackground() {
        for (let i = 0; i < 38; i++) {
            let spark = this.add.rectangle(
                Phaser.Math.Between(0, this.frontConf.width),
                Phaser.Math.Between(105, this.frontConf.height),
                Phaser.Math.Between(2, 5),
                Phaser.Math.Between(2, 5),
                i % 4 === 0 ? 0xf4d35e : 0x5fd0b5,
                0.18
            );
            this.tweens.add({
                targets: spark,
                y: spark.y - Phaser.Math.Between(45, 130),
                alpha: 0,
                duration: Phaser.Math.Between(2400, 5200),
                delay: Phaser.Math.Between(0, 1800),
                repeat: -1,
                onRepeat: () => {
                    spark.setPosition(Phaser.Math.Between(0, this.frontConf.width), this.frontConf.height + 20);
                    spark.setAlpha(0.18);
                }
            });
        }
        let scanLine = this.add.rectangle(this.frontConf.width / 2, 120, this.frontConf.width, 2, 0x5fd0b5, 0.16);
        this.tweens.add({ targets: scanLine, y: this.frontConf.height - 20, duration: 4200, repeat: -1, ease: "Sine.easeInOut" });
    }

    loadServerList(serverList : Map<string, string>) {
        this.graphicServerList.forEach( (textElement : Phaser.GameObjects.Text) => { textElement.destroy()});
        this.graphicServerList = new Array<Phaser.GameObjects.Text>();
        this.serverList = serverList;
        let i = 15;
        this.serverList.forEach( ( value : string, key : string) => {
            let textServer = this.add.text(this.frontConf.width/2 - 300, this.frontConf.height/2 + 35 + i , key);
            textServer.setOrigin(0.5, 0.5);
            textServer.setInteractive();

            textServer.on('clicked', (button : Physics.Arcade.Sprite) => {
                this.graphicServerList.forEach( (textElement : Phaser.GameObjects.Text) => { textElement.setColor("white");});
                textServer.setColor("red");
                this.selectedServer = this.serverList.get(textServer.text);
            });
            this.graphicServerList.push(textServer);
            i += this.frontConf.height/30;
        });
    }
  }
