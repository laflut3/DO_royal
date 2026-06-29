export default class DebugText extends Phaser.GameObjects.Text {
  constructor(scene: Phaser.Scene) {
    super(scene, 10, 1200, '', { color: 'black', fontSize: '28px' })
    scene.add.existing(this)
    this.setOrigin(0)
  }

  public update(cameraX : number, cameraY : number, latency : number) {
    this.setX(cameraX + 10);
    this.setY(cameraY + 10);
    let text = new Array<string>();
    text.push(`fps: ${Math.floor(this.scene.game.loop.actualFps)}`)
    text.push(`latency: ${Math.floor(latency)}`);
    this.setText(text);
  }
}
