import {
  BufferGeometry,
  Line,
  LineBasicMaterial,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3
} from 'three';
import { BuildManager } from './build/BuildManager';
import { InputManager } from './InputManager';
import { Weapon } from './Weapon';
import type { CombatNet } from './net/CombatNet';
import type { AudioManager } from './audio/AudioManager';

type Tracer = {
  line: Line;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  age: number;
};

const DAMAGE = 110;
const BUILD_DAMAGE = 60;
const FIRE_COOLDOWN = 1.15;
const MAGAZINE_SIZE = 5;
const RELOAD_TIME = 2.35;
const MAX_RANGE = 240;
const HIP_RECOIL = MathUtils.degToRad(1.4);
const SCOPED_RECOIL = MathUtils.degToRad(0.8);
const TRACER_LIFETIME = 0.18;
const DEFAULT_FOV = 75;
const SCOPE_FOV = 28;

export class Sniper extends Weapon {
  private readonly raycaster = new Raycaster();
  private readonly direction = new Vector3();
  private readonly tracers: Tracer[] = [];
  private aiming = false;
  public audio?: AudioManager;
  public onShoot?: () => void;

  public constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly input: InputManager,
    private readonly buildManager: BuildManager,
    private readonly combatNet: CombatNet,
    private readonly staticObjects: Object3D[] = []
  ) {
    super('SNIPER', MAGAZINE_SIZE, RELOAD_TIME, FIRE_COOLDOWN);
    this.raycaster.far = MAX_RANGE;
  }

  public override setAiming(aiming: boolean): void {
    this.aiming = aiming && this.input.isPointerLocked;
  }

  public override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    this.updateTracers(deltaSeconds);
    this.updateCameraZoom(deltaSeconds);
  }

  protected override getIsAiming(): boolean {
    return this.aiming;
  }

  protected shoot(): void {
    const origin = this.camera.position.clone();
    this.camera.getWorldDirection(this.direction);
    this.raycaster.set(origin, this.direction);

    const hitObjects = [
      ...this.combatNet.getPlayerHitObjects(),
      ...this.buildManager.getRaycastObjects(),
      ...this.staticObjects
    ];
    const intersections = this.raycaster.intersectObjects(hitObjects, false);
    const hit = intersections[0];
    const end = hit?.point ?? origin.clone().addScaledVector(this.direction, MAX_RANGE);

    this.spawnTracer(origin, end);

    if (hit) {
      const playerSessionId = this.combatNet.findPlayerSessionId(hit.object);
      if (playerSessionId) {
        this.combatNet.sendShootPlayer(playerSessionId, DAMAGE, 'sniper', origin, this.direction);
        this.finishShot();
        return;
      }

      const buildPiece = this.buildManager.findBuildPiece(hit.object);
      if (buildPiece) {
        this.combatNet.sendShootBuild(buildPiece.gridKey, BUILD_DAMAGE, 'sniper', origin, this.direction);
        this.finishShot();
        return;
      }
    }

    this.finishShot();
  }

  private spawnTracer(origin: Vector3, end: Vector3): void {
    const start = origin.clone().addScaledVector(this.direction, 0.72);
    start.y -= this.aiming ? 0.02 : 0.1;

    const geometry = new BufferGeometry().setFromPoints([start, end]);
    const material = new LineBasicMaterial({
      color: this.aiming ? 0xcdfbff : 0x6fe8ff,
      transparent: true,
      opacity: 1
    });
    const line = new Line(geometry, material);
    line.scale.setScalar(1.01);
    this.scene.add(line);
    this.tracers.push({ line, geometry, material, age: 0 });
  }

  private updateTracers(deltaSeconds: number): void {
    for (let index = this.tracers.length - 1; index >= 0; index -= 1) {
      const tracer = this.tracers[index];
      tracer.age += deltaSeconds;
      tracer.material.opacity = 1 - tracer.age / TRACER_LIFETIME;

      if (tracer.age >= TRACER_LIFETIME) {
        this.scene.remove(tracer.line);
        tracer.geometry.dispose();
        tracer.material.dispose();
        this.tracers.splice(index, 1);
      }
    }
  }

  private updateCameraZoom(deltaSeconds: number): void {
    if (!this.aiming && this.camera.fov >= DEFAULT_FOV - 0.5) {
      return;
    }
    const targetFov = this.aiming ? SCOPE_FOV : DEFAULT_FOV;
    const amount = 1 - Math.exp(-12 * deltaSeconds);
    this.camera.fov = MathUtils.lerp(this.camera.fov, targetFov, amount);
    this.camera.updateProjectionMatrix();
  }

  private finishShot(): void {
    this.input.addRecoil(this.aiming ? SCOPED_RECOIL : HIP_RECOIL);
    this.playGunshot();
  }

  private playGunshot(): void {
    this.audio?.play('rifleShot');
    this.onShoot?.();
  }
}
