import BackEndWebSocket from "../network/backEndWebSocket";
import Bullet from "./bullet";

export default class BulletGroup extends Phaser.GameObjects.Group {
    bulletArray : Array<Bullet>
    scene : Phaser.Scene
    bulletSpeed: number
    constructor(scene: Phaser.Scene, bulletSpeed: number) {
        super(scene);
        this.bulletArray = new Array<Bullet>();
        this.scene = scene;
        this.bulletSpeed = bulletSpeed;
    }

    fireBullet(startX: number, startY: number, toX: number, toY: number, uuid: string, backEnd : BackEndWebSocket) {
        let bullet : Bullet = new Bullet(this.scene, startX, startY, toX, toY,
            this.bulletSpeed, uuid, true);
        this.bulletArray.push(bullet);
        this.add(bullet);
        if(backEnd) {
            backEnd.registerBullet(bullet);
        }
    }

    fireBulletRemote(startX: number, startY: number, toX: number, toY: number, uuid: string) {
        let bullet : Bullet = new Bullet(this.scene, startX, startY, toX, toY,
            this.bulletSpeed, uuid, false);
        this.bulletArray.push(bullet);
        this.add(bullet);
    }

    deleteBullet(bullet: Bullet, backEnd? : BackEndWebSocket) {
        this.remove(bullet, true);
        const index = this.bulletArray.indexOf(bullet, 0);
        if (index > -1) {
            this.bulletArray.splice(index, 1);
        }
        if(backEnd) {
            backEnd.deleteBullet(bullet);
        }
    }

    deleteBulletIfLocal(bullet: Bullet, backEnd : BackEndWebSocket) {
        if(bullet.isLocal) {
            this.deleteBullet(bullet, backEnd);
        }
    }

    deleteBulletIfRemote(bullet: Bullet, backEnd : BackEndWebSocket) : boolean {
        if(!bullet.isLocal) {
            this.deleteBullet(bullet, backEnd);
        }
        return !bullet.isLocal;
    }

    deleteBulletFromUuid(bulletUuid: string) {
        let bulletFound : Bullet | undefined = this.bulletArray.find((bullet: Bullet) => {return bullet.uuid === bulletUuid});
        if(bulletFound === undefined) {
            console.error("Trying to delete a non existing bullet !");
        }
        else {
            this.deleteBullet(bulletFound);
        }
    }
}