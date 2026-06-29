import Player from "../objects/player";

export default class CameraManager {
    mainCamera : Phaser.Cameras.Scene2D.Camera
    vision : Phaser.GameObjects.Image

    constructor(scene : Phaser.Scene, playerToFollow : Player, cameraBoundX : number, cameraBoudY : number) {
        // Camera automatically follows player
        this.mainCamera = scene.cameras.main;
        // Constrain the camera so that it isn't allowed to move outside the width/height of tilemap
        this.mainCamera.startFollow(playerToFollow);
        this.mainCamera.setBounds(0, 0, cameraBoundX, cameraBoudY);
        this.mainCamera.setBackgroundColor(0x000000);
    }
}