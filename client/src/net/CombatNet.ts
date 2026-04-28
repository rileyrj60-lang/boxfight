import type { Object3D, Vector3 } from 'three';
import type { NetworkClient, WeaponName } from './NetworkClient';
import type { RemotePlayer } from './RemotePlayer';

export class CombatNet {
  public constructor(
    private readonly network: NetworkClient,
    private readonly remotes: Map<string, RemotePlayer>
  ) {}

  public getPlayerHitObjects(): Object3D[] {
    const objects: Object3D[] = [];
    for (const remote of this.remotes.values()) {
      const obj = remote.getHitObject();
      if (obj && remote.isAlive()) {
        objects.push(obj);
      }
    }
    return objects;
  }

  public findPlayerSessionId(object: Object3D): string | undefined {
    let current: Object3D | null = object;
    while (current) {
      const id = current.userData?.remoteSessionId;
      if (typeof id === 'string') return id;
      current = current.parent;
    }
    return undefined;
  }

  public sendShootPlayer(
    sessionId: string,
    damage: number,
    weapon: WeaponName,
    origin: Vector3,
    dir: Vector3
  ): void {
    this.network.sendShoot({
      targetSessionId: sessionId,
      hitBuildId: null,
      damage,
      weapon,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z }
    });
  }

  public sendShootBuild(
    buildId: string,
    damage: number,
    weapon: WeaponName,
    origin: Vector3,
    dir: Vector3
  ): void {
    if (weapon === 'pickaxe') {
      this.network.sendDamageBuild({ buildId, damage, weapon });
      return;
    }
    this.network.sendShoot({
      targetSessionId: null,
      hitBuildId: buildId,
      damage,
      weapon,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir: { x: dir.x, y: dir.y, z: dir.z }
    });
  }
}
