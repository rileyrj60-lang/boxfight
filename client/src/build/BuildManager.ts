import {
  Euler,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3
} from 'three';
import { InputManager } from '../InputManager';
import { Player } from '../Player';
import { BuildGrid, type BuildPlacement } from './BuildGrid';
import { BuildPiece, type AABB, type BuildType } from './BuildPiece';
import { BuildPreview } from './BuildPreview';
import { Floor } from './Floor';
import { Ramp } from './Ramp';
import { Roof } from './Roof';
import { Wall } from './Wall';

export class BuildManager {
  private readonly preview: BuildPreview;
  private readonly lookDirection = new Vector3();
  private audioContext?: AudioContext;
  private activeBuildType: BuildType | undefined;
  private canPlaceActive = false;
  private placeRepeatRemaining = 0;
  private rotationSteps = 0;
  public onPlaceRequest?: (placement: BuildPlacement) => void;
  public onBuildPlaced?: (position: Vector3) => void;

  public constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly input: InputManager,
    private readonly player: Player,
    private readonly grid: BuildGrid
  ) {
    this.preview = new BuildPreview(scene);
  }

  public update(deltaSeconds: number): void {
    for (const piece of this.grid.getPieces()) {
      piece.update(deltaSeconds);
    }

    for (let i = this.destroyingPieces.length - 1; i >= 0; i--) {
      const piece = this.destroyingPieces[i];
      piece.update(deltaSeconds);
      if (piece.isDestroyAnimDone()) {
        this.scene.remove(piece.mesh);
        piece.dispose();
        this.destroyingPieces.splice(i, 1);
      }
    }

    this.preview.update(deltaSeconds);
    this.updateBuildModeInput();

    if (!this.activeBuildType) {
      this.canPlaceActive = false;
      this.placeRepeatRemaining = 0;
      this.preview.hide();
      return;
    }

    this.camera.getWorldDirection(this.lookDirection);
    const placement = this.grid.getPlacement(
      this.activeBuildType,
      this.player.getPosition(),
      this.camera.position,
      this.lookDirection,
      this.rotationSteps
    );
    const candidateAABB = this.grid.createCandidateAABB(placement);
    const isOccupied = this.grid.isOccupied(placement.key);
    const intersectsPlayer = aabbIntersects(candidateAABB, this.player.getAABB());
    const hasSupport = this.grid.hasSupport(placement);
    const rampBoxedIn = placement.type === 'ramp' && this.grid.isCellBoxedByWalls(placement.cell);

    this.canPlaceActive = !isOccupied && !intersectsPlayer && hasSupport && !rampBoxedIn;
    this.preview.show(placement, this.canPlaceActive);

    const pressedPlace = this.input.consumePrimaryFirePressed();
    this.placeRepeatRemaining = Math.max(0, this.placeRepeatRemaining - deltaSeconds);

    if ((pressedPlace || (this.input.isPrimaryFireHeld && this.placeRepeatRemaining === 0)) && this.canPlaceActive) {
      this.requestPlace(placement);
      this.placeRepeatRemaining = 0.1;
    }
  }

  public applyServerPlacement(snapshot: {
    id: string;
    type: BuildType;
    gx: number;
    gy: number;
    gz: number;
    face: '' | 'N' | 'S' | 'E' | 'W';
    rampDir: '' | 'N' | 'S' | 'E' | 'W';
    hp: number;
  }): void {
    if (this.grid.isOccupied(snapshot.id)) {
      return;
    }
    const cell = new Vector3(snapshot.gx, snapshot.gy, snapshot.gz);
    const placement: BuildPlacement = (() => {
      if (snapshot.type === 'wall') {
        const transform = this.grid.getWallTransformPublic(cell, snapshot.face as 'N' | 'S' | 'E' | 'W');
        return {
          type: 'wall',
          cell,
          face: snapshot.face,
          key: snapshot.id,
          position: transform.position,
          rotation: transform.rotation
        };
      }
      const center = cell.clone().multiplyScalar(4);
      if (snapshot.type === 'ramp') {
        const dir = (snapshot.rampDir || 'N') as 'N' | 'S' | 'E' | 'W';
        return {
          type: 'ramp',
          cell,
          face: '',
          key: snapshot.id,
          position: center,
          rotation: this.grid.getRampEulerPublic(dir),
          rampDirection: dir
        };
      }
      if (snapshot.type === 'roof') {
        const dir = (snapshot.rampDir || 'N') as 'N' | 'S' | 'E' | 'W';
        return {
          type: 'roof',
          cell,
          face: '',
          key: snapshot.id,
          position: center,
          rotation: this.grid.getRampEulerPublic(dir),
          roofDirection: dir
        };
      }
      return {
        type: 'floor',
        cell,
        face: '',
        key: snapshot.id,
        position: center,
        rotation: new Euler()
      };
    })();

    const piece = this.createPiece(placement);
    if (snapshot.hp < 150) {
      piece.setHealth(snapshot.hp, false);
    }
    this.grid.add(piece);
    this.scene.add(piece.mesh);
    this.onBuildPlaced?.(piece.mesh.position.clone());
  }

  public applyServerBuildHp(buildId: string, hp: number): void {
    const piece = this.grid.getPieces().find((p) => p.gridKey === buildId);
    if (!piece) return;
    piece.setHealth(hp, true);
  }

  public applyServerBuildRemove(buildId: string): void {
    const piece = this.grid.getPieces().find((p) => p.gridKey === buildId);
    if (!piece) return;
    piece.beginDestroyAnim();
    this.grid.remove(piece);
    this.destroyingPieces.push(piece);
    this.onBuildBreak?.(piece.mesh.position.clone());
  }

  private destroyingPieces: BuildPiece[] = [];
  public onBuildBreak?: (position: Vector3) => void;

  public flashPreviewRejected(): void {
    this.preview.flashRejected();
  }

  public resolvePlayerCollision(): void {
    for (const piece of this.grid.getPieces()) {
      if (piece.type === 'ramp' && this.resolveRampCollision(piece)) {
        continue;
      }

      if (piece.type === 'floor' && this.resolveFloorSupport(piece)) {
        continue;
      }

      if (piece.type === 'roof' && this.resolveRoofCollision(piece)) {
        continue;
      }

      const playerAABB = this.player.getAABB();
      const pieceAABB = piece.getAABB();

      if (!aabbIntersects(playerAABB, pieceAABB)) {
        continue;
      }

      const correction = getSmallestPushOut(playerAABB, pieceAABB);
      this.player.applyBuildCollision(correction);
    }
  }

  public getRaycastObjects(): Object3D[] {
    return this.grid.getRaycastObjects();
  }

  public getBuildPieces(): BuildPiece[] {
    return this.grid.getPieces();
  }

  public getBuildModeLabel(): string | undefined {
    if (!this.activeBuildType) {
      return undefined;
    }

    return this.activeBuildType.toUpperCase();
  }

  public isBuildModeActive(): boolean {
    return this.activeBuildType !== undefined;
  }

  public findBuildPiece(object: Object3D): BuildPiece | undefined {
    let current: Object3D | null = object;

    while (current) {
      if (current.userData.buildPiece instanceof BuildPiece) {
        return current.userData.buildPiece;
      }

      current = current.parent;
    }

    return undefined;
  }

  private requestPlace(placement: BuildPlacement): void {
    if (this.onPlaceRequest) {
      this.onPlaceRequest(placement);
      return;
    }
    const piece = this.createPiece(placement);
    piece.onDestroyed = (destroyedPiece) => this.destroy(destroyedPiece);
    this.grid.add(piece);
    this.scene.add(piece.mesh);
    this.playPlacementThunk();
  }

  private createPiece(placement: BuildPlacement): BuildPiece {
    if (placement.type === 'wall') {
      if (placement.face === '') {
        throw new Error('Wall placement missing face.');
      }

      return new Wall(placement.key, placement.cell, placement.face);
    }

    if (placement.type === 'ramp') {
      return new Ramp(placement.key, placement.cell, placement.rampDirection ?? 'N');
    }

    if (placement.type === 'roof') {
      return new Roof(placement.key, placement.cell, placement.roofDirection ?? 'N');
    }

    return new Floor(placement.key, placement.cell);
  }

  private destroy(piece: BuildPiece): void {
    this.scene.remove(piece.mesh);
    this.grid.remove(piece);
    piece.dispose();
  }

  private updateBuildModeInput(): void {
    const selectedType = this.input.consumeBuildTypePressed();
    const cancelPressed = this.input.consumeBuildCancelPressed();
    const rotatePressed = this.input.consumeBuildRotatePressed();

    if (selectedType) {
      this.activeBuildType = selectedType;
      this.rotationSteps = 0;
      this.placeRepeatRemaining = 0;
    }

    if (!this.activeBuildType) {
      return;
    }

    if (
      cancelPressed ||
      this.input.hasWeaponSlotPressed() ||
      this.input.consumeSecondaryFirePressed()
    ) {
      this.clearBuildMode();
      return;
    }

    if (rotatePressed) {
      this.rotationSteps = (this.rotationSteps + 1) % 4;
    }
  }

  private clearBuildMode(): void {
    this.activeBuildType = undefined;
    this.canPlaceActive = false;
    this.placeRepeatRemaining = 0;
    this.preview.hide();
  }

  private resolveRampCollision(piece: BuildPiece): boolean {
    const playerAABB = this.player.getAABB();
    const pieceAABB = piece.getAABB();
    const horizontalOverlap =
      playerAABB.max.x > pieceAABB.min.x &&
      playerAABB.min.x < pieceAABB.max.x &&
      playerAABB.max.z > pieceAABB.min.z &&
      playerAABB.min.z < pieceAABB.max.z;

    if (!horizontalOverlap) {
      return false;
    }

    const feet = this.player.getPosition();
    const surfaceY = piece.getRampSurfaceY(feet.x, feet.z);

    if (surfaceY === undefined) {
      return true;
    }

    const isNearRampSurface = feet.y >= pieceAABB.min.y - 0.25 && feet.y <= surfaceY + 0.9;

    if (isNearRampSurface && this.player.getVerticalVelocity() <= 0.1) {
      this.player.setFeetY(surfaceY);
    }

    return true;
  }

  private resolveFloorSupport(piece: BuildPiece): boolean {
    const playerAABB = this.player.getAABB();
    const pieceAABB = piece.getAABB();
    const horizontalOverlap =
      playerAABB.max.x > pieceAABB.min.x &&
      playerAABB.min.x < pieceAABB.max.x &&
      playerAABB.max.z > pieceAABB.min.z &&
      playerAABB.min.z < pieceAABB.max.z;

    if (!horizontalOverlap) {
      return false;
    }

    const floorTop = pieceAABB.max.y;
    const feetY = this.player.getPosition().y;

    if (
      this.player.getVerticalVelocity() <= 0.1 &&
      feetY >= floorTop - 0.35 &&
      feetY <= floorTop + 0.45
    ) {
      this.player.setFeetY(floorTop);
      return true;
    }

    return false;
  }

  private resolveRoofCollision(piece: BuildPiece): boolean {
    const playerAABB = this.player.getAABB();
    const pieceAABB = piece.getAABB();
    const horizontalOverlap =
      playerAABB.max.x > pieceAABB.min.x &&
      playerAABB.min.x < pieceAABB.max.x &&
      playerAABB.max.z > pieceAABB.min.z &&
      playerAABB.min.z < pieceAABB.max.z;

    if (!horizontalOverlap) {
      return false;
    }

    const feet = this.player.getPosition();
    const surfaceY = piece.getRoofSurfaceY(feet.x, feet.z);

    if (surfaceY === undefined) {
      return false;
    }

    const isNearRoofSurface = feet.y >= pieceAABB.min.y - 0.25 && feet.y <= surfaceY + 0.75;

    if (isNearRoofSurface && this.player.getVerticalVelocity() <= 0.1) {
      this.player.setFeetY(surfaceY);
      return true;
    }

    return false;
  }

  private playPlacementThunk(): void {
    this.audioContext ??= new AudioContext();

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume();
    }

    const now = this.audioContext.currentTime;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(110, now);
    oscillator.frequency.exponentialRampToValueAtTime(55, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    oscillator.connect(gain);
    gain.connect(this.audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.13);
  }
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

function getSmallestPushOut(player: AABB, obstacle: AABB): Vector3 {
  const pushLeft = obstacle.min.x - player.max.x;
  const pushRight = obstacle.max.x - player.min.x;
  const pushDown = obstacle.min.y - player.max.y;
  const pushUp = obstacle.max.y - player.min.y;
  const pushBack = obstacle.min.z - player.max.z;
  const pushForward = obstacle.max.z - player.min.z;
  const candidates = [
    new Vector3(pushLeft, 0, 0),
    new Vector3(pushRight, 0, 0),
    new Vector3(0, pushDown, 0),
    new Vector3(0, pushUp, 0),
    new Vector3(0, 0, pushBack),
    new Vector3(0, 0, pushForward)
  ];

  return candidates.reduce((smallest, candidate) => (
    candidate.lengthSq() < smallest.lengthSq() ? candidate : smallest
  ));
}
