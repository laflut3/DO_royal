import FrontConf from "../conf";
import BackEndWebSocket from "../network/backEndWebSocket";

export default class GameMenu {
    startGameButton : Phaser.GameObjects.Sprite
    startGameText : Phaser.GameObjects.Text
    positionX : number
    positionY : number
    winnerBackground : Phaser.GameObjects.Sprite
    winnerText : Phaser.GameObjects.Text
    backEndWebSocket : BackEndWebSocket
    isOwner : Boolean

    constructor(scene: Phaser.Scene, frontConf : FrontConf, backEnd : BackEndWebSocket, isOwner: Boolean) {
        this.positionX = frontConf.width/2;
        this.positionY = frontConf.height - 100;

        this.backEndWebSocket = backEnd;
        this.isOwner = isOwner;

        this.startGameButton = scene.add.sprite(this.positionX, this.positionY, 'menuButton', 'button1');
        this.startGameButton.setInteractive();
        this.startGameButton.setScale(0.7, 0.7);
        this.startGameButton.setOrigin(0.5, 0.5);
        this.startGameButton.setScrollFactor(0);
        this.startGameButton.setDepth(1000);
        this.startGameButton.on('clicked', (button : Phaser.GameObjects.Sprite) => {
            this.hideMenu();
            this.backEndWebSocket.startGame();
        });

        this.startGameText = scene.add.text(this.positionX , this.positionY, "Launch game");
        this.startGameText.setOrigin(0.5, 0.5);
        this.startGameText.setScale(0.7, 0.7);
        this.startGameText.setScrollFactor(0);
        this.startGameText.setDepth(1001);
        this.startGameText.setColor("#ffffff");

        scene.input.on('gameobjectdown', (pointer, gameObject) => {gameObject.emit('clicked', gameObject)});
        scene.input.on('gameobjectup', (pointer, gameObject) => {gameObject.emit('pointerup', gameObject)});

        this.winnerBackground = scene.add.sprite(this.positionX, this.positionY+50, 'menuButton', 'button1');
        this.winnerBackground.setScale(0.7, 0.7);
        this.winnerBackground.setOrigin(0.5, 0.5);
        this.winnerBackground.setScrollFactor(0);
        this.winnerBackground.setDepth(1000);
        this.winnerBackground.setVisible(false);

        this.winnerText = scene.add.text(this.positionX , this.positionY+50, "The winner is : Test");
        this.winnerText.setOrigin(0.5, 0.5);
        this.winnerText.setScale(0.7, 0.7);
        this.winnerText.setScrollFactor(0);
        this.winnerText.setDepth(1001);
        this.winnerText.setVisible(false);

        this.setOwner(isOwner);
    }

    hideMenu() {
        this.startGameButton.setActive(false);
        this.startGameButton.setVisible(false);
        this.startGameText.setVisible(false);

        this.winnerBackground.setVisible(false);
        this.winnerText.setVisible(false);
    }

    printMenu() {
        if (!this.isOwner) {
            this.hideStartButton();
            return;
        }
        this.startGameButton.setActive(true);
        this.startGameButton.setVisible(true);
        this.startGameText.setVisible(true);
    }

    setOwner(isOwner: Boolean) {
        this.isOwner = isOwner;
        if (!isOwner) {
            this.hideStartButton();
        }
    }

    private hideStartButton() {
        this.startGameButton.setActive(false);
        this.startGameButton.setVisible(false);
        this.startGameText.setVisible(false);
    }

    printWinner(winnerName: string) {
        this.winnerBackground.setVisible(true);
        this.winnerText.setVisible(true);
        this.winnerText.setText("The winner is : " + winnerName);
    }

    public update(cameraX : number, cameraY : number) {
      this.startGameButton.setPosition(this.positionX, this.positionY);
      this.startGameText.setPosition(this.positionX, this.positionY);

      this.winnerBackground.setPosition(this.positionX, this.positionY + 50);
      this.winnerText.setPosition(this.positionX, this.positionY + 50);
    }
  }
