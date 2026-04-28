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
import { InputManager } from './InputManager';
import { Weapon } from './Weapon';
import { BuildManager } from './build/BuildManager';
import type { CombatNet } from './net/CombatNet';
import type { AudioManager } from './audio/AudioManager';

type Tracer = {
  line: Line;
  geometry: BufferGeometry;
  material: LineBasicMaterial;
  age: number;
};

const DAMAGE = 25;
const FIRE_COOLDOWN = 0.2;
const MAGAZINE_SIZE = 30;
const RELOAD_TIME = 2;
const MAX_RANGE = 100;
const RECOIL_RADIANS = MathUtils.degToRad(0.5);
const HORIZONTAL_JITTER_RADIANS = MathUtils.degToRad(0.2);
const TRACER_LIFETIME = 0.08;

export class Rifle extends Weapon {
  private readonly raycaster = new Raycaster();
  private readonly direction = new Vector3();
  private readonly tracers: Tracer[] = [];
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
    super('RIFLE', MAGAZINE_SIZE, RELOAD_TIME, FIRE_COOLDOWN);
    this.raycaster.far = MAX_RANGE;
  }

  public override update(deltaSeconds: number): void {
    super.update(deltaSeconds);
    this.updateTracers(deltaSeconds);
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
        this.combatNet.sendShootPlayer(playerSessionId, DAMAGE, 'rifle', origin, this.direction);
        this.input.addRecoil(RECOIL_RADIANS);
        this.playGunshot();
        return;
      }

      const buildPiece = this.buildManager.findBuildPiece(hit.object);
      if (buildPiece) {
        this.combatNet.sendShootBuild(buildPiece.gridKey, 12, 'rifle', origin, this.direction);
        this.input.addRecoil(RECOIL_RADIANS);
        this.playGunshot();
        return;
      }
    }

    this.input.addRecoil(RECOIL_RADIANS);
    this.playGunshot();
  }

  private spawnTracer(origin: Vector3, end: Vector3): void {
    const start = origin.clone().addScaledVector(this.direction, 0.65);
    start.y -= 0.12;

    const geometry = new BufferGeometry().setFromPoints([start, end]);
    const material = new LineBasicMaterial({
      color: 0xfff1a8,
      transparent: true,
      opacity: 1
    });
    const line = new Line(geometry, material);
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

  private playGunshot(): void {
    this.audio?.play('rifleShot');
    this.input.addYawJitter(HORIZONTAL_JITTER_RADIANS);
    this.onShoot?.();
  }
}
