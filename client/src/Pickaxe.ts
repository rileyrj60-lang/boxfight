import {
  MathUtils,
  PerspectiveCamera,
  Raycaster,
  Vector3
} from 'three';
import { BuildManager } from './build/BuildManager';
import { InputManager } from './InputManager';
import { Weapon } from './Weapon';
import type { CombatNet } from './net/CombatNet';
import type { AudioManager } from './audio/AudioManager';

const RANGE = 4;
const BUILD_DAMAGE = 50;
const TARGET_DAMAGE = 20;
const SWING_COOLDOWN = 1 / 1.5;
const SWING_RECOIL = MathUtils.degToRad(0.8);

export class Pickaxe extends Weapon {
  private readonly raycaster = new Raycaster();
  private readonly direction = new Vector3();
  public audio?: AudioManager;

  public constructor(
    private readonly camera: PerspectiveCamera,
    private readonly input: InputManager,
    private readonly buildManager: BuildManager,
    private readonly combatNet: CombatNet
  ) {
    super('PICKAXE', 0, 0, SWING_COOLDOWN, false);
    this.raycaster.far = RANGE;
  }

  public override fire(): boolean {
    if (this.cooldownRemaining > 0) {
      return false;
    }

    this.cooldownRemaining = this.fireCooldown;
    this.shoot();
    return true;
  }

  protected shoot(): void {
    const origin = this.camera.position.clone();
    this.camera.getWorldDirection(this.direction);
    this.raycaster.set(origin, this.direction);

    const hitObjects = [
      ...this.combatNet.getPlayerHitObjects(),
      ...this.buildManager.getRaycastObjects()
    ];
    const hit = this.raycaster.intersectObjects(hitObjects, false)[0];

    this.input.addRecoil(SWING_RECOIL);
    this.audio?.play('pickaxeSwing');
    this.camera.position.addScaledVector(this.direction, 0.12);

    if (!hit) {
      return;
    }

    const playerSessionId = this.combatNet.findPlayerSessionId(hit.object);
    if (playerSessionId) {
      this.combatNet.sendShootPlayer(playerSessionId, TARGET_DAMAGE, 'pickaxe', origin, this.direction);
      return;
    }

    const buildPiece = this.buildManager.findBuildPiece(hit.object);
    if (buildPiece) {
      this.combatNet.sendShootBuild(buildPiece.gridKey, BUILD_DAMAGE, 'pickaxe', origin, this.direction);
    }
  }
}

