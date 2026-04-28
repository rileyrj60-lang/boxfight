import { Euler, Vector3 } from 'three';
import type { AABB, BuildFace, BuildType, WallFace } from './BuildPiece';
import { BuildPiece } from './BuildPiece';
import type { RampDirection } from './Ramp';

export type BuildPlacement = {
  type: BuildType;
  cell: Vector3;
  face: BuildFace;
  key: string;
  position: Vector3;
  rotation: Euler;
  rampDirection?: RampDirection;
  roofDirection?: RampDirection;
};

const CELL_SIZE = 4;
const BUILD_REACH = 5.2;
const WALL_REACH = 6.4;

export class BuildGrid {
  private readonly pieces = new Map<string, BuildPiece>();

  public getPlacement(
    type: BuildType,
    playerPosition: Vector3,
    cameraPosition: Vector3,
    lookDirection: Vector3,
    rotationSteps = 0
  ): BuildPlacement {
    const flatForward = lookDirection.clone();
    flatForward.y = 0;

    if (flatForward.lengthSq() === 0) {
      flatForward.set(0, 0, -1);
    } else {
      flatForward.normalize();
    }

    const baseLayer = Math.max(0, Math.round(playerPosition.y / CELL_SIZE));
    const layer = this.pickLayer(type, baseLayer, lookDirection.y);
    const target = this.pickTargetPoint(type, playerPosition, cameraPosition, lookDirection, flatForward, layer);
    const cell = new Vector3(
      Math.round(target.x / CELL_SIZE),
      layer,
      Math.round(target.z / CELL_SIZE)
    );

    if (type === 'wall') {
      const face = this.pickWallFace(flatForward);
      const { position, rotation } = this.getWallTransform(cell, face);
      return {
        type,
        cell,
        face,
        key: this.createKey(type, cell, face),
        position,
        rotation
      };
    }

    const center = cell.clone().multiplyScalar(CELL_SIZE);

    if (type === 'ramp') {
      const rampDirection = this.rotateDirection(this.pickRampDirection(flatForward), rotationSteps);
      const rotation = new Euler(0, this.getRampRotation(rampDirection), 0);

      return {
        type,
        cell,
        face: '',
        key: this.createKey(type, cell, ''),
        position: center,
        rotation,
        rampDirection
      };
    }

    if (type === 'roof') {
      const roofDirection = this.rotateDirection(this.pickRampDirection(flatForward), rotationSteps);
      return {
        type,
        cell,
        face: '',
        key: this.createKey(type, cell, ''),
        position: center,
        rotation: new Euler(0, this.getRampRotation(roofDirection), 0),
        roofDirection
      };
    }

    return {
      type,
      cell,
      face: '',
      key: this.createKey(type, cell, ''),
      position: center,
      rotation: new Euler()
    };
  }

  public isOccupied(key: string): boolean {
    return this.pieces.has(key);
  }

  public hasSupport(placement: BuildPlacement): boolean {
    const { cell, type } = placement;

    if (type !== 'roof' && cell.y <= 0) {
      return true;
    }

    if (this.pieces.size === 0) {
      return false;
    }

    const neighbors: Array<[number, number, number]> = [
      [cell.x, cell.y, cell.z],
      [cell.x + 1, cell.y, cell.z],
      [cell.x - 1, cell.y, cell.z],
      [cell.x, cell.y, cell.z + 1],
      [cell.x, cell.y, cell.z - 1],
      [cell.x, cell.y + 1, cell.z],
      [cell.x, cell.y - 1, cell.z]
    ];

    for (const piece of this.pieces.values()) {
      for (const [nx, ny, nz] of neighbors) {
        if (piece.cell.x === nx && piece.cell.y === ny && piece.cell.z === nz) {
          return true;
        }
      }
    }

    return false;
  }

  public getWallTransformPublic(cell: Vector3, face: WallFace): { position: Vector3; rotation: Euler } {
    return this.getWallTransform(cell, face);
  }

  public getRampEulerPublic(direction: RampDirection): Euler {
    return new Euler(0, this.getRampRotation(direction), 0);
  }

  public isCellBoxedByWalls(cell: Vector3): boolean {
    const sides: Array<[string, string]> = [
      [this.createKey('wall', cell, 'N'), this.createKey('wall', new Vector3(cell.x, cell.y, cell.z - 1), 'S')],
      [this.createKey('wall', cell, 'S'), this.createKey('wall', new Vector3(cell.x, cell.y, cell.z + 1), 'N')],
      [this.createKey('wall', cell, 'E'), this.createKey('wall', new Vector3(cell.x + 1, cell.y, cell.z), 'W')],
      [this.createKey('wall', cell, 'W'), this.createKey('wall', new Vector3(cell.x - 1, cell.y, cell.z), 'E')]
    ];

    return sides.every(([a, b]) => this.pieces.has(a) || this.pieces.has(b));
  }

  public add(piece: BuildPiece): void {
    this.pieces.set(piece.gridKey, piece);
  }

  public remove(piece: BuildPiece): void {
    this.pieces.delete(piece.gridKey);
  }

  public getPieces(): BuildPiece[] {
    return [...this.pieces.values()];
  }

  public getRaycastObjects() {
    return this.getPieces().flatMap((piece) => piece.getRaycastObjects());
  }

  public createCandidateAABB(placement: BuildPlacement): AABB {
    if (placement.type === 'wall') {
      const halfThickness = 0.1;

      if (placement.face === 'E' || placement.face === 'W') {
        return {
          min: new Vector3(placement.position.x - halfThickness, placement.position.y - 2, placement.position.z - 2),
          max: new Vector3(placement.position.x + halfThickness, placement.position.y + 2, placement.position.z + 2)
        };
      }

      return {
        min: new Vector3(placement.position.x - 2, placement.position.y - 2, placement.position.z - halfThickness),
        max: new Vector3(placement.position.x + 2, placement.position.y + 2, placement.position.z + halfThickness)
      };
    }

    if (placement.type === 'floor') {
      return {
        min: new Vector3(placement.position.x - 2, placement.position.y - 0.1, placement.position.z - 2),
        max: new Vector3(placement.position.x + 2, placement.position.y + 0.1, placement.position.z + 2)
      };
    }

    if (placement.type === 'roof') {
      return {
        min: new Vector3(placement.position.x - 2, placement.position.y, placement.position.z - 2),
        max: new Vector3(placement.position.x + 2, placement.position.y + 2.25, placement.position.z + 2)
      };
    }

    return {
      min: new Vector3(placement.position.x - 2, placement.position.y, placement.position.z - 2),
      max: new Vector3(placement.position.x + 2, placement.position.y + 4, placement.position.z + 2)
    };
  }

  private createKey(type: BuildType, cell: Vector3, face: BuildFace): string {
    return `${type}:${cell.x},${cell.y},${cell.z}:${face}`;
  }

  private pickWallFace(forward: Vector3): WallFace {
    if (Math.abs(forward.x) > Math.abs(forward.z)) {
      return forward.x > 0 ? 'W' : 'E';
    }

    return forward.z > 0 ? 'N' : 'S';
  }

  private pickRampDirection(forward: Vector3): RampDirection {
    if (Math.abs(forward.x) > Math.abs(forward.z)) {
      return forward.x > 0 ? 'E' : 'W';
    }

    return forward.z > 0 ? 'S' : 'N';
  }

  private rotateDirection(direction: RampDirection, rotationSteps: number): RampDirection {
    const directions: RampDirection[] = ['N', 'E', 'S', 'W'];
    const index = directions.indexOf(direction);
    const rotatedIndex = (index + rotationSteps) % directions.length;
    return directions[rotatedIndex];
  }

  private pickLayer(type: BuildType, baseLayer: number, lookY: number): number {
    if (type === 'wall') {
      return baseLayer;
    }

    if (type === 'roof') {
      return Math.max(0, baseLayer + (lookY > -0.2 ? 1 : 0));
    }

    if (lookY > 0.48) {
      return baseLayer + 1;
    }

    if (lookY < -0.52) {
      return Math.max(0, baseLayer - 1);
    }

    return baseLayer;
  }

  private pickTargetPoint(
    type: BuildType,
    playerPosition: Vector3,
    cameraPosition: Vector3,
    lookDirection: Vector3,
    flatForward: Vector3,
    layer: number
  ): Vector3 {
    if (type !== 'wall' && Math.abs(lookDirection.y) > 0.08) {
      const planeY = layer * CELL_SIZE;
      const distance = (planeY - cameraPosition.y) / lookDirection.y;

      if (distance > 1.2 && distance < 12) {
        return cameraPosition.clone().addScaledVector(lookDirection, distance);
      }
    }

    const distance = type === 'wall' ? WALL_REACH : BUILD_REACH;
    return playerPosition.clone().addScaledVector(flatForward, distance);
  }

  private getWallTransform(cell: Vector3, face: WallFace): { position: Vector3; rotation: Euler } {
    const center = cell.clone().multiplyScalar(CELL_SIZE);
    const position = new Vector3(center.x, center.y + CELL_SIZE / 2, center.z);
    const rotation = new Euler();

    if (face === 'N') {
      position.z -= CELL_SIZE / 2;
    } else if (face === 'S') {
      position.z += CELL_SIZE / 2;
    } else if (face === 'E') {
      position.x += CELL_SIZE / 2;
      rotation.y = Math.PI / 2;
    } else {
      position.x -= CELL_SIZE / 2;
      rotation.y = Math.PI / 2;
    }

    return { position, rotation };
  }

  private getRampRotation(direction: RampDirection): number {
    if (direction === 'S') {
      return Math.PI;
    }

    if (direction === 'E') {
      return -Math.PI / 2;
    }

    if (direction === 'W') {
      return Math.PI / 2;
    }

    return 0;
  }
}
