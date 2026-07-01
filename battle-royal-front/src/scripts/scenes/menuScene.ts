import FrontConf from "../conf";

import { DEFAULT_MAP_ID, MAP_CATALOG, getMapDefinition } from "../gameCore/mapCatalog"
import ListGamesWebSocket, { ServerListEntry } from "../network/listGameWebSocket"
import AuthApi, { Account, AuthSession, loadAuthSession, saveAuthSession } from "../network/authApi"
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
    price?: number
}

const UI = {
    bg: 0x050a0e,
    panel: 0x0b151b,
    panelAlt: 0x101e26,
    field: 0x071017,
    teal: 0x57d6c2,
    tealDark: 0x173c43,
    amber: 0xf4c95d,
    red: 0xff6b6b,
    text: "#f6fbff",
    muted: "#91aeb6",
    soft: "#b7d8de",
    amberText: "#f4d35e",
    dangerText: "#ff6b6b"
};

export default class MenuScene extends Phaser.Scene {
    serverList : Array<ServerListEntry>
    graphicServerList : Array<Phaser.GameObjects.Text>
    graphicServerRows : Array<Phaser.GameObjects.Rectangle>
    selectedServer : string | undefined
    selectedServerMapId : string | undefined
    selectedServerMapName : string | undefined
    webSocket : ListGamesWebSocket
    frontConf : FrontConf
    pseudoText : Phaser.GameObjects.Text
    textJoin : Phaser.GameObjects.Text
    serverNameText : Phaser.GameObjects.Text
    selectedSkinIndex : number
    selectedMapIndex : number
    skinPreview : Phaser.GameObjects.Sprite
    skinNameText : Phaser.GameObjects.Text
    skinDescriptionText : Phaser.GameObjects.Text
    mapNameText : Phaser.GameObjects.Text
    mapDescriptionText : Phaser.GameObjects.Text
    skinOptions : Array<SkinOption>
    animatedTiles : Array<Phaser.GameObjects.TileSprite>
    controlSettings : ControlSettings
    settingsPanel : Phaser.GameObjects.Container
    settingsRows : Map<string, Phaser.GameObjects.Text>
    waitingControl : keyof ControlSettings | null
    activeTextInputDom : Phaser.GameObjects.DOMElement | null
    authApi : AuthApi
    authSession : AuthSession | null
    accountStatusText : Phaser.GameObjects.Text
    coinsText : Phaser.GameObjects.Text
    authPanel : Phaser.GameObjects.Container
    shopPanel : Phaser.GameObjects.Container
    authMessageText : Phaser.GameObjects.Text

    constructor() {
      super({ key: 'MenuScene' })
    }

    create() {
        this.webSocket = new ListGamesWebSocket(this);

        this.frontConf = new FrontConf();
        this.authApi = new AuthApi();
        this.authSession = loadAuthSession();
        this.controlSettings = loadControlSettings();
        this.settingsRows = new Map<string, Phaser.GameObjects.Text>();
        this.waitingControl = null;
        this.activeTextInputDom = null;
        this.selectedSkinIndex = 0;
        this.selectedMapIndex = 0;
        this.animatedTiles = new Array<Phaser.GameObjects.TileSprite>();
        this.skinOptions = [
            { name: "Medic", atlas: "medic", description: "Field support" },
            { name: "Misa", atlas: "misa", description: "Balanced survivor" },
            { name: "Scout", atlas: "scout", description: "Fast forest runner" },
            { name: "Six Seven", atlas: "six-seven", description: "Unpredictable runner" },
            { name: "Knight", atlas: "knight", description: "Armored frontliner", price: 600 },
            { name: "Rogue", atlas: "rogue", description: "Masked ambusher", price: 600 },
            { name: "Nova", atlas: "nova", description: "Stellar duelist", price: 600 },
            { name: "Ember", atlas: "ember", description: "Volcanic striker", price: 600 },
            { name: "Cipher", atlas: "cipher", description: "Neon hacker", price: 600 },
            { name: "Oni", atlas: "oni", description: "Moonlit yokai", price: 600 },
            { name: "Mbappe", atlas: "mbappe", description: "Explosive striker", price: 600 },
            { name: "Oudindindoun", atlas: "oudindindoun-madindindoun", description: "Chaotic contender", price: 600 },
            { name: "Tralalelo", atlas: "tralalelo-tralala", description: "Fast arena oddity", price: 600 },
            { name: "Tung Sahur", atlas: "tung-tung-tung-sahur", description: "Night watch fighter", price: 600 }
        ];
        this.createAnimatedBackground();

        /* Title */
        let textTitle = this.add.text(this.frontConf.width/2, 38, "Battle Royal 2D");
        textTitle.setOrigin(0.5, 0.5);
        textTitle.setFontSize(44);
        textTitle.setColor(UI.text);
        textTitle.setStroke("#02070a", 8);
        this.tweens.add({ targets: textTitle, y: 43, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        let textSubTitle = this.add.text(this.frontConf.width/2, 82, "Choisis ton combattant. Rejoins l'arene. Survis.");
        textSubTitle.setOrigin(0.5, 0.5);
        textSubTitle.setFontSize(18);
        textSubTitle.setColor(UI.soft);
        this.createAccountBar();

        /* Pseudo */
        this.createPanel(this.frontConf.width/2, 170, 640, 132, UI.teal, 0.58);
        let pseudoLabel = this.add.text(this.frontConf.width/2 - 258, 134, "Pseudo");
        pseudoLabel.setOrigin(0.5, 0.5);
        pseudoLabel.setFontSize(17);
        pseudoLabel.setColor(UI.soft);
        this.createInputFrame(this.frontConf.width/2 - 72, 134, 250, 38);
        this.pseudoText = this.add.text(this.frontConf.width/2 - 72, 134, "Enter pseudo");
        this.pseudoText.setOrigin(0.5, 0.5);
        this.pseudoText.setFontSize(17);
        this.pseudoText.setColor(UI.text);
        this.pseudoText.setInteractive({ useHandCursor: true });
        this.pseudoText.on('pointerdown', () => this.openTextInput(this.pseudoText, "Enter pseudo"));

        /* Skin */
        let skinLabel = this.add.text(this.frontConf.width/2 - 258, 195, "Personnage");
        skinLabel.setOrigin(0.5, 0.5);
        skinLabel.setFontSize(17);
        skinLabel.setColor(UI.soft);
        this.add.rectangle(this.frontConf.width/2 - 118, 196, 82, 64, 0x081116, 0.78).setStrokeStyle(1, UI.teal, 0.35);
        this.skinPreview = this.add.sprite(this.frontConf.width/2 - 118, 198, "misa", "misa-front");
        this.skinPreview.setScale(2.1, 2.1);
        this.skinNameText = this.add.text(this.frontConf.width/2 - 30, 184, this.skinOptions[this.selectedSkinIndex].name);
        this.skinNameText.setOrigin(0, 0.5);
        this.skinNameText.setFontSize(20);
        this.skinNameText.setColor(UI.text);
        this.skinDescriptionText = this.add.text(this.frontConf.width/2 - 30, 210, this.skinOptions[this.selectedSkinIndex].description);
        this.skinDescriptionText.setOrigin(0, 0.5);
        this.skinDescriptionText.setFontSize(13);
        this.skinDescriptionText.setColor(UI.muted);
        this.skinDescriptionText.setWordWrapWidth(250);
        this.createArrowButton(this.frontConf.width/2 + 210, 186, "<", () => this.changeSkin(-1));
        this.createArrowButton(this.frontConf.width/2 + 266, 186, ">", () => this.changeSkin(1));
        this.tweens.add({ targets: this.skinPreview, y: this.skinPreview.y - 5, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        this.updateSkinPreview();

        /* Join Section */
        this.createPanel(this.frontConf.width/2 - 305, 445, 430, 335, UI.teal, 0.5);
        this.textJoin = this.add.text(this.frontConf.width/2 - 305, 298, "Rejoindre une partie");
        this.textJoin.setOrigin(0.5, 0.5);
        this.textJoin.setFontSize(24);
        this.textJoin.setColor(UI.text);

        /* Button Refresh */
        this.createTextButton(this.frontConf.width/2 - 405, 612, 150, 38, "Actualiser", UI.teal, () => {
            this.webSocket.sendServerListRequest();
        });

        /* Button Join */
        this.createTextButton(this.frontConf.width/2 - 205, 612, 180, 38, "Rejoindre", UI.amber, () => {
            this.joinServer();
        });

        /* Server List */
        let textServer = this.add.text(this.frontConf.width/2 - 305, 342 , "Serveurs disponibles");
        textServer.setOrigin(0.5, 0.5);
        textServer.setFontSize(15);
        textServer.setColor(UI.soft);
        this.add.rectangle(this.frontConf.width/2 - 305, 465, 365, 210, 0x071017, 0.62).setStrokeStyle(1, UI.teal, 0.22);

        this.serverList = new Array<ServerListEntry>();
        this.graphicServerList = new Array<Phaser.GameObjects.Text>();
        this.graphicServerRows = new Array<Phaser.GameObjects.Rectangle>();

        /* Create Section */
        this.createPanel(this.frontConf.width/2 + 305, 445, 430, 335, UI.amber, 0.5);
        let textCreateSection = this.add.text(this.frontConf.width/2 + 305, 298, "Creer une partie");
        textCreateSection.setOrigin(0.5, 0.5);
        textCreateSection.setFontSize(24);
        textCreateSection.setColor(UI.text);

        this.createInputFrame(this.frontConf.width/2 +305, 352, 285, 38);
        this.serverNameText = this.add.text(this.frontConf.width/2 +305, 352, "Enter server name");
        this.serverNameText.setOrigin(0.5, 0.5);
        this.serverNameText.setFontSize(17);
        this.serverNameText.setColor(UI.text);
        this.serverNameText.setInteractive({ useHandCursor: true });
        this.serverNameText.on('pointerdown', () => this.openTextInput(this.serverNameText, "Enter server name"));

        let mapLabel = this.add.text(this.frontConf.width/2 + 305, 405, "Carte");
        mapLabel.setOrigin(0.5, 0.5);
        mapLabel.setFontSize(16);
        mapLabel.setColor(UI.soft);
        this.add.rectangle(this.frontConf.width/2 + 305, 466, 315, 98, 0x071017, 0.58).setStrokeStyle(1, UI.amber, 0.28);
        this.createArrowButton(this.frontConf.width/2 + 150, 455, "<", () => this.changeMap(-1));
        this.createArrowButton(this.frontConf.width/2 + 460, 455, ">", () => this.changeMap(1));
        this.mapNameText = this.add.text(this.frontConf.width/2 + 305, 445, "");
        this.mapNameText.setOrigin(0.5, 0.5);
        this.mapNameText.setFontSize(21);
        this.mapNameText.setColor(UI.text);
        this.mapDescriptionText = this.add.text(this.frontConf.width/2 + 305, 476, "");
        this.mapDescriptionText.setOrigin(0.5, 0.5);
        this.mapDescriptionText.setFontSize(12);
        this.mapDescriptionText.setColor(UI.muted);
        this.mapDescriptionText.setAlign("center");
        this.mapDescriptionText.setWordWrapWidth(260);
        this.updateMapPreview();

        this.createTextButton(this.frontConf.width/2 + 305, 590, 225, 42, "Creer le serveur", UI.amber, () => {
            this.createGame();
        });

        this.createTextButton(this.frontConf.width - 120, 48, 130, 34, "Parametres", UI.teal, () => {
            this.openSettingsPanel();
        });

        this.createSettingsPanel();
        this.createAuthPanel();
        this.createShopPanel();
        this.refreshAccount();
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
        if (this.webSocket) {
            this.webSocket.disconnect();
        }
        this.scene.start('MainScene',  data);
    }

    createGame() {
        this.closeActiveTextInput(true);
        if (!this.ensureSelectedSkinUnlocked()) {
            return;
        }
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
        const selectedMap = this.currentMapDefinition();
        this.webSocket.createNewServer(
            this.serverNameText.text,
            gameUuid,
            selectedMap.id,
            selectedMap.name,
            () => this.goToMainScene({ pseudo: this.pseudoText.text, gameUuid : gameUuid, gameOwner : true, playerAtlas: this.currentSkinAtlas(), skinTint: 0xffffff, mapId: selectedMap.id, authToken: this.authSession ? this.authSession.token : null }),
            (errorMessage: string) => {
                console.log("Game creation failed: " + errorMessage);
                this.serverNameText.setColor("red");
            });
    }

    joinServer() {
        this.closeActiveTextInput(true);
        if (!this.ensureSelectedSkinUnlocked()) {
            return;
        }
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
        this.goToMainScene({ pseudo: this.pseudoText.text, gameUuid : this.selectedServer, gameOwner : false, playerAtlas: this.currentSkinAtlas(), skinTint: 0xffffff, mapId: this.selectedServerMapId || DEFAULT_MAP_ID, authToken: this.authSession ? this.authSession.token : null });
    }

    changeSkin(direction : number) {
        this.selectedSkinIndex = (this.selectedSkinIndex + direction + this.skinOptions.length) % this.skinOptions.length;
        this.updateSkinPreview();
    }

    updateSkinPreview() {
        const skin = this.skinOptions[this.selectedSkinIndex];
        this.skinPreview.setTexture(skin.atlas, skin.atlas.concat("-front"));
        if (this.isSkinUnlocked(skin.atlas)) {
            this.skinPreview.clearTint();
        } else {
            this.skinPreview.setTint(0x666666);
        }
        this.skinNameText.setText(skin.name);
        const lockText = this.isSkinUnlocked(skin.atlas) ? "" : " - bloque";
        this.skinDescriptionText.setText(skin.description + lockText);
        this.skinDescriptionText.setColor(this.isSkinUnlocked(skin.atlas) ? UI.muted : UI.amberText);
    }

    currentSkinAtlas() : string {
        return this.skinOptions[this.selectedSkinIndex].atlas;
    }

    isSkinUnlocked(atlas: string) : boolean {
        if (["medic", "misa", "scout"].includes(atlas)) {
            return true;
        }
        return this.authSession !== null && this.authSession.account.ownedSkins.includes(atlas);
    }

    ensureSelectedSkinUnlocked() : boolean {
        if (this.isSkinUnlocked(this.currentSkinAtlas())) {
            return true;
        }
        this.skinDescriptionText.setText("Connecte-toi ou achete ce skin dans la boutique.");
        this.skinDescriptionText.setColor(UI.dangerText);
        return false;
    }

    createAccountBar() {
        const panelX = 208;
        this.createPanel(panelX, 55, 386, 76, UI.teal, 0.48);
        this.accountStatusText = this.add.text(panelX - 155, 38, "Invite");
        this.accountStatusText.setOrigin(0, 0.5);
        this.accountStatusText.setFontSize(15);
        this.accountStatusText.setColor(UI.text);
        this.coinsText = this.add.text(panelX - 155, 64, "0 pieces");
        this.coinsText.setOrigin(0, 0.5);
        this.coinsText.setFontSize(11);
        this.coinsText.setColor(UI.amberText);
        this.createSmallButton(panelX + 70, 55, 82, "Compte", () => this.openAuthPanel());
        this.createSmallButton(panelX + 160, 55, 86, "Boutique", () => this.openShopPanel());
    }

    createSmallButton(x: number, y: number, width: number, label: string, callback: () => void) {
        this.createTextButton(x, y, width, 34, label, UI.amber, callback, 13);
    }

    updateAccountBar() {
        if (this.authSession === null) {
            this.accountStatusText.setText("Invite - 4 skins");
            this.coinsText.setText("Connexion requise pour les pieces");
            return;
        }
        this.accountStatusText.setText(this.authSession.account.username);
        this.coinsText.setText(this.authSession.account.coins + " pieces");
    }

    async refreshAccount() {
        if (this.authSession === null) {
            this.updateAccountBar();
            this.updateSkinPreview();
            return;
        }
        try {
            const account = await this.authApi.me(this.authSession.token);
            this.authSession = { token: this.authSession.token, account };
            saveAuthSession(this.authSession);
        } catch(e) {
            this.authSession = null;
            saveAuthSession(null);
        }
        this.updateAccountBar();
        this.updateSkinPreview();
    }

    createAuthPanel() {
        this.authPanel = this.add.container(0, 0);
        this.authPanel.setDepth(2100);
        this.authPanel.setVisible(false);
        const centerX = this.frontConf.width / 2;
        const centerY = this.frontConf.height / 2;
        const overlay = this.add.rectangle(centerX, centerY, this.frontConf.width, this.frontConf.height, 0x02070a, 0.72);
        overlay.setInteractive();
        const panel = this.add.rectangle(centerX, centerY, 470, 330, 0x0d1b24, 0.98);
        panel.setStrokeStyle(2, 0x5fd0b5, 0.7);
        const title = this.add.text(centerX, centerY - 120, "Compte joueur");
        title.setOrigin(0.5, 0.5);
        title.setFontSize(28);
        title.setColor("#f6fbff");
        this.authMessageText = this.add.text(centerX, centerY + 95, "");
        this.authMessageText.setOrigin(0.5, 0.5);
        this.authMessageText.setFontSize(14);
        this.authMessageText.setColor("#f4d35e");
        const usernameInput = this.add.dom(centerX, centerY - 45).createFromHTML('<input data-auth-username maxlength="24" placeholder="pseudo" style="width:260px;height:32px;padding:0 10px;border:1px solid #5fd0b5;background:#071017;color:#f6fbff;text-align:center;font:16px monospace;" />');
        const passwordInput = this.add.dom(centerX, centerY).createFromHTML('<input data-auth-password type="password" maxlength="128" placeholder="mot de passe" style="width:260px;height:32px;padding:0 10px;border:1px solid #5fd0b5;background:#071017;color:#f6fbff;text-align:center;font:16px monospace;" />');
        const login = this.add.rectangle(centerX - 85, centerY + 50, 135, 36, 0x122b36, 0.95).setStrokeStyle(1, 0x5fd0b5, 0.7).setInteractive();
        const loginText = this.add.text(centerX - 85, centerY + 50, "Connexion").setOrigin(0.5, 0.5).setColor("#f6fbff").setFontSize(16);
        const register = this.add.rectangle(centerX + 85, centerY + 50, 135, 36, 0x122b36, 0.95).setStrokeStyle(1, 0xf4d35e, 0.7).setInteractive();
        const registerText = this.add.text(centerX + 85, centerY + 50, "Creer").setOrigin(0.5, 0.5).setColor("#f6fbff").setFontSize(16);
        const logout = this.add.text(centerX - 190, centerY + 135, "Deconnexion").setColor("#ff6b6b").setFontSize(15).setInteractive();
        const close = this.add.text(centerX + 170, centerY + 135, "Fermer").setColor("#b7d8de").setFontSize(15).setInteractive();
        login.on("clicked", () => this.submitAuth(usernameInput, passwordInput, false));
        loginText.setInteractive().on("clicked", () => this.submitAuth(usernameInput, passwordInput, false));
        register.on("clicked", () => this.submitAuth(usernameInput, passwordInput, true));
        registerText.setInteractive().on("clicked", () => this.submitAuth(usernameInput, passwordInput, true));
        logout.on("clicked", () => {
            this.authSession = null;
            saveAuthSession(null);
            this.closeAuthPanel();
            this.refreshAccount();
        });
        close.on("clicked", () => this.closeAuthPanel());
        this.authPanel.add([overlay, panel, title, usernameInput, passwordInput, login, loginText, register, registerText, logout, close, this.authMessageText]);
    }

    async submitAuth(usernameInput: Phaser.GameObjects.DOMElement, passwordInput: Phaser.GameObjects.DOMElement, shouldRegister: boolean) {
        const username = (usernameInput.node.querySelector("input") as HTMLInputElement).value;
        const password = (passwordInput.node.querySelector("input") as HTMLInputElement).value;
        try {
            this.authSession = shouldRegister
                ? await this.authApi.register(username, password)
                : await this.authApi.login(username, password);
            saveAuthSession(this.authSession);
            this.authMessageText.setText("Connecte.");
            this.refreshAccount();
        } catch(e) {
            this.authMessageText.setText((e as Error).message);
        }
    }

    openAuthPanel() {
        this.authMessageText.setText(this.authSession === null ? "" : "Connecte avec " + this.authSession.account.username);
        this.authPanel.setVisible(true);
    }

    closeAuthPanel() {
        this.authPanel.setVisible(false);
    }

    createShopPanel() {
        this.shopPanel = this.add.container(0, 0);
        this.shopPanel.setDepth(2100);
        this.shopPanel.setVisible(false);
        const centerX = this.frontConf.width / 2;
        const centerY = this.frontConf.height / 2;
        const overlay = this.add.rectangle(centerX, centerY, this.frontConf.width, this.frontConf.height, 0x02070a, 0.78).setInteractive();
        const panel = this.add.rectangle(centerX, centerY, 1040, 540, UI.panel, 0.99).setStrokeStyle(2, UI.amber, 0.72);
        const title = this.add.text(centerX - 450, centerY - 230, "Boutique").setOrigin(0, 0.5).setFontSize(32).setColor(UI.text);
        const subtitle = this.add.text(centerX - 450, centerY - 198, "Visualise les personnages avant d'acheter un skin premium.").setOrigin(0, 0.5).setFontSize(14).setColor(UI.muted);
        const balance = this.add.text(centerX + 450, centerY - 220, this.authSession ? this.authSession.account.coins + " pieces" : "Compte requis").setOrigin(1, 0.5).setFontSize(15).setColor(UI.amberText);
        this.shopPanel.add([overlay, panel, title]);
        this.shopPanel.add([subtitle, balance]);
        this.skinOptions.filter(skin => skin.price).forEach((skin, index) => {
            const x = centerX - 390 + (index % 5) * 195;
            const y = centerY - 80 + Math.floor(index / 5) * 205;
            const row = this.add.rectangle(x, y, 165, 174, UI.panelAlt, 0.94).setStrokeStyle(1, UI.teal, 0.38).setInteractive({ useHandCursor: true });
            const previewBack = this.add.rectangle(x, y - 44, 112, 92, 0x081116, 0.82).setStrokeStyle(1, UI.teal, 0.24);
            const sprite = this.add.sprite(x, y - 46, skin.atlas, skin.atlas.concat("-front")).setScale(2.12, 2.12);
            const name = this.add.text(x, y + 35, skin.name).setOrigin(0.5, 0.5).setFontSize(15).setColor(UI.text);
            const priceText = this.add.text(x, y + 57, skin.price + " pieces").setOrigin(0.5, 0.5).setFontSize(12).setColor(UI.muted);
            const stateLabel = this.authSession && this.authSession.account.ownedSkins.includes(skin.atlas) ? "Obtenu" : "Acheter";
            const stateColor = stateLabel === "Obtenu" ? UI.teal : UI.amber;
            const stateBox = this.add.rectangle(x, y + 80, 112, 26, UI.field, 0.94).setStrokeStyle(1, stateColor, 0.74).setInteractive({ useHandCursor: true });
            const state = this.add.text(x, y + 80, stateLabel).setOrigin(0.5, 0.5).setFontSize(12).setColor(stateLabel === "Obtenu" ? "#57d6c2" : UI.amberText);
            const buy = () => this.buySkin(skin.atlas, state);
            row.on("clicked", buy);
            stateBox.on("clicked", buy);
            name.setInteractive().on("clicked", buy);
            state.setInteractive().on("clicked", buy);
            if (stateLabel !== "Obtenu") {
                sprite.setTint(0xd9e4e8);
            }
            this.shopPanel.add([row, previewBack, sprite, name, priceText, stateBox, state]);
        });
        const closeButton = this.add.rectangle(centerX + 430, centerY + 230, 120, 34, UI.field, 0.96).setStrokeStyle(1, UI.teal, 0.65).setInteractive({ useHandCursor: true });
        const close = this.add.text(centerX + 430, centerY + 230, "Fermer").setOrigin(0.5, 0.5).setColor(UI.soft).setFontSize(15).setInteractive({ useHandCursor: true });
        closeButton.on("clicked", () => this.closeShopPanel());
        close.on("clicked", () => this.closeShopPanel());
        this.shopPanel.add([closeButton, close]);
    }

    async buySkin(atlas: string, stateText: Phaser.GameObjects.Text) {
        if (this.authSession === null) {
            stateText.setText("Compte requis");
            stateText.setColor("#ff6b6b");
            return;
        }
        if (this.authSession.account.ownedSkins.includes(atlas)) {
            stateText.setText("Deja obtenu");
            return;
        }
        try {
            const account = await this.authApi.buySkin(this.authSession.token, atlas);
            this.authSession = { token: this.authSession.token, account };
            saveAuthSession(this.authSession);
            stateText.setText("Obtenu");
            stateText.setColor("#5fd0b5");
            this.refreshAccount();
        } catch(e) {
            stateText.setText((e as Error).message);
            stateText.setColor("#ff6b6b");
        }
    }

    openShopPanel() {
        if (this.shopPanel) {
            this.shopPanel.destroy();
        }
        this.createShopPanel();
        this.shopPanel.setVisible(true);
    }

    closeShopPanel() {
        this.shopPanel.setVisible(false);
    }

    changeMap(direction : number) {
        this.selectedMapIndex = (this.selectedMapIndex + direction + MAP_CATALOG.length) % MAP_CATALOG.length;
        this.updateMapPreview();
    }

    updateMapPreview() {
        const mapDefinition = this.currentMapDefinition();
        this.mapNameText.setText(mapDefinition.name);
        this.mapDescriptionText.setText(mapDefinition.description);
    }

    currentMapDefinition() {
        return MAP_CATALOG[this.selectedMapIndex];
    }

    openTextInput(textObject: Phaser.GameObjects.Text, placeholder: string) {
        if (this.activeTextInputDom !== null) {
            this.closeActiveTextInput(true);
        }
        const currentText = textObject.text === placeholder ? "" : textObject.text;
        textObject.setVisible(false);
        this.activeTextInputDom = this.add.dom(textObject.x, textObject.y).createFromHTML(
            '<input maxlength="24" style="width:230px;height:30px;padding:0 10px;border:0;outline:0;background:#071017;color:#f6fbff;text-align:center;font:17px monospace;" />'
        );
        this.activeTextInputDom.setDepth(3000);
        const input = this.activeTextInputDom.node.querySelector("input") as HTMLInputElement;
        input.value = currentText;
        input.focus();
        input.select();

        input.addEventListener("keydown", (event: KeyboardEvent) => {
            event.stopPropagation();
            if (event.key === "Enter") {
                event.preventDefault();
                this.closeActiveTextInput(true);
            } else if (event.key === "Escape") {
                event.preventDefault();
                this.closeActiveTextInput(false);
            }
        });
        input.addEventListener("blur", () => this.closeActiveTextInput(true));
        this.activeTextInputDom.setData("targetText", textObject);
    }

    closeActiveTextInput(shouldApply: boolean) {
        if (this.activeTextInputDom === null) {
            return;
        }
        const input = this.activeTextInputDom.node.querySelector("input") as HTMLInputElement;
        const textObject = this.activeTextInputDom.getData("targetText") as Phaser.GameObjects.Text;
        const value = input.value.trim();
        if (shouldApply && value.length > 0) {
            textObject.setText(value);
            textObject.setColor("#f6fbff");
        }
        textObject.setVisible(true);
        this.activeTextInputDom.destroy();
        this.activeTextInputDom = null;
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
                row.setColor(UI.text);
            }
        });
    }

    createPanel(x: number, y: number, width: number, height: number, accent: number, strokeAlpha: number) {
        const shadow = this.add.rectangle(x + 7, y + 9, width, height, 0x000000, 0.24);
        const panel = this.add.rectangle(x, y, width, height, UI.panel, 0.92);
        panel.setStrokeStyle(1, accent, strokeAlpha);
        const topLine = this.add.rectangle(x, y - height / 2 + 1, width - 18, 2, accent, 0.35);
        return { shadow, panel, topLine };
    }

    createInputFrame(x: number, y: number, width: number, height: number) {
        const frame = this.add.rectangle(x, y, width, height, UI.field, 0.94);
        frame.setStrokeStyle(1, UI.teal, 0.45);
        return frame;
    }

    createTextButton(x: number, y: number, width: number, height: number, label: string, accent: number, callback: () => void, fontSize: number = 15) {
        const button = this.add.rectangle(x, y, width, height, UI.tealDark, 0.88);
        button.setStrokeStyle(1, accent, 0.68);
        button.setInteractive({ useHandCursor: true });
        button.on("clicked", callback);
        button.on("pointerover", () => button.setFillStyle(UI.tealDark, 1));
        button.on("pointerout", () => button.setFillStyle(UI.tealDark, 0.88));

        const text = this.add.text(x, y, label);
        text.setOrigin(0.5, 0.5);
        text.setFontSize(fontSize);
        text.setColor(UI.text);
        text.setInteractive({ useHandCursor: true });
        text.on("clicked", callback);
        return { button, text };
    }

    createArrowButton(x: number, y: number, label: string, callback: () => void) {
        const button = this.add.rectangle(x, y, 38, 32, UI.field, 0.92);
        button.setStrokeStyle(1, UI.amber, 0.62);
        button.setInteractive({ useHandCursor: true });
        button.on("clicked", callback);
        const text = this.add.text(x, y - 1, label);
        text.setOrigin(0.5, 0.5);
        text.setFontSize(22);
        text.setColor(UI.amberText);
        text.setInteractive({ useHandCursor: true });
        text.on("clicked", callback);
    }

    createAnimatedBackground() {
        this.add.rectangle(this.frontConf.width / 2, this.frontConf.height / 2, this.frontConf.width, this.frontConf.height, UI.bg, 1);
        for(let w = 0; w <= this.frontConf.width; w+= 512 ) {
            for(let h = 0; h <= this.frontConf.height; h+= 512 ) {
                let tile = this.add.tileSprite(w, h, 512, 512, 'menuBackgroud');
                tile.setAlpha(0.18);
                tile.setTint(0x4caeaa);
                this.animatedTiles.push(tile);
            }
        }
        this.add.rectangle(this.frontConf.width / 2, this.frontConf.height / 2, this.frontConf.width, this.frontConf.height, 0x02070a, 0.58);
        const mapGraphics = this.add.graphics();
        mapGraphics.lineStyle(1, UI.teal, 0.08);
        for (let x = 40; x < this.frontConf.width; x += 54) {
            mapGraphics.lineBetween(x, 110, x, this.frontConf.height - 34);
        }
        for (let y = 112; y < this.frontConf.height; y += 54) {
            mapGraphics.lineBetween(40, y, this.frontConf.width - 40, y);
        }
        mapGraphics.lineStyle(2, UI.teal, 0.18);
        mapGraphics.strokeRect(82, 132, 240, 150);
        mapGraphics.strokeRect(900, 122, 280, 170);
        mapGraphics.strokeRect(82, 520, 190, 115);
        mapGraphics.strokeRect(984, 504, 210, 122);
        mapGraphics.lineBetween(320, 205, 512, 205);
        mapGraphics.lineBetween(768, 205, 900, 205);
        mapGraphics.lineBetween(638, 95, 638, 256);
        mapGraphics.lineBetween(638, 632, 638, 700);
        this.add.rectangle(this.frontConf.width / 2, 430, 1040, 490, 0x071017, 0.18).setStrokeStyle(1, UI.teal, 0.08);
        let scanLine = this.add.rectangle(this.frontConf.width / 2, 116, this.frontConf.width - 90, 2, UI.teal, 0.13);
        this.tweens.add({ targets: scanLine, y: this.frontConf.height - 26, duration: 4800, repeat: -1, ease: "Sine.easeInOut" });
    }

    loadServerList(serverList : Array<ServerListEntry>) {
        this.graphicServerList.forEach( (textElement : Phaser.GameObjects.Text) => { textElement.destroy()});
        this.graphicServerRows.forEach( (rowElement : Phaser.GameObjects.Rectangle) => { rowElement.destroy()});
        this.graphicServerList = new Array<Phaser.GameObjects.Text>();
        this.graphicServerRows = new Array<Phaser.GameObjects.Rectangle>();
        this.serverList = serverList;
        this.selectedServer = undefined;
        this.selectedServerMapId = undefined;
        this.selectedServerMapName = undefined;
        this.textJoin.setColor(UI.text);
        let i = 0;
        this.serverList.forEach( ( server : ServerListEntry) => {
            const rowY = 378 + i;
            let rowServer = this.add.rectangle(this.frontConf.width/2 - 305, rowY, 334, 32, UI.panelAlt, 0.42);
            rowServer.setStrokeStyle(1, UI.teal, 0.12);
            rowServer.setInteractive({ useHandCursor: true });
            const mapDefinition = getMapDefinition(server.mapId);
            const displayedMapName = server.mapName || mapDefinition.name;
            let textServer = this.add.text(this.frontConf.width/2 - 305, rowY , server.gameName + " (" + displayedMapName + ")");
            textServer.setOrigin(0.5, 0.5);
            textServer.setFontSize(14);
            textServer.setColor(UI.soft);
            textServer.setInteractive({ useHandCursor: true });

            const selectServer = () => {
                this.graphicServerList.forEach( (textElement : Phaser.GameObjects.Text) => { textElement.setColor(UI.soft);});
                this.graphicServerRows.forEach( (rowElement : Phaser.GameObjects.Rectangle) => { rowElement.setFillStyle(UI.panelAlt, 0.42);});
                textServer.setColor(UI.text);
                rowServer.setFillStyle(UI.tealDark, 0.86);
                this.selectedServer = server.gameId;
                this.selectedServerMapId = server.mapId || DEFAULT_MAP_ID;
                this.selectedServerMapName = displayedMapName;
                this.textJoin.setColor(UI.text);
            };
            textServer.on('clicked', selectServer);
            rowServer.on('clicked', selectServer);
            textServer.on('pointerdown', selectServer);
            rowServer.on('pointerdown', selectServer);
            textServer.on('pointerup', () => this.joinServer());
            rowServer.on('pointerup', () => this.joinServer());
            this.graphicServerRows.push(rowServer);
            this.graphicServerList.push(textServer);
            i += 38;
        });
    }
  }
