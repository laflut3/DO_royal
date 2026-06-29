import 'phaser'
import FrontConf from './conf'
import MainScene from './scenes/mainScene'
import MenuScene from './scenes/menuScene'
import PreloadScene from './scenes/preloadScene'
import RexUIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin'
import TextEditPlugin from 'phaser3-rex-plugins/plugins/textedit-plugin.js'

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 720

let frontConf = new FrontConf();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: '#ffffff',
  scale: {
    parent: 'phaser-game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: frontConf.width,
    height: frontConf.height
  },
  dom: {
    createContainer: true
  },
  scene: [PreloadScene, MainScene, MenuScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { y: 0 }
    }
  },
  plugins: {
		scene: [
			{
				key: 'rexUI',
				plugin: RexUIPlugin,
				mapping: 'rexUI'
			},
      {
        key: 'rexTextEdit',
        plugin: TextEditPlugin,
        start: true
      }
		]
    }
}

window.addEventListener('load', () => {
  const game = new Phaser.Game(config)
})

