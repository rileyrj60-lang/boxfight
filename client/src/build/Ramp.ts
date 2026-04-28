import {
  BufferGeometry,
  BoxGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Vector3
} from 'three';
import { createBuildMaterial, createBuildTrimMaterial } from '../Materials';
import { BuildPiece, type AABB } from './BuildPiece';

export type RampDirection = 'N' | 'S' | 'E' | 'W';

const CELL_SIZE = 4;

export class Ramp extends BuildPiece {
  public constructor(
    gridKey: string,
    cell: Vector3,
    private readonly direction: RampDirection
  ) {
    const material = createBuildMaterial();
    const trimMaterial = createBuildTrimMaterial();
    const mesh = new Mesh(createRampGeometry(), material);
    const center = cell.clone().multiplyScalar(CELL_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addRampTrim(mesh, trimMaterial);
    mesh.position.set(center.x, center.y, center.z);

    if (direction === 'S') {
      mesh.rotation.y = Math.PI;
    } else if (direction === 'E') {
      mesh.rotation.y = -Math.PI / 2;
    } else if (direction === 'W') {
      mesh.rotation.y = Math.PI / 2;
    }

    super('ramp', gridKey, cell, '', mesh, material);
  }

  public override getAABB(): AABB {
    const center = this.cell.clone().multiplyScalar(CELL_SIZE);
    return {
      min: new Vector3(center.x - 2, center.y, center.z - 2),
      max: new Vector3(center.x + 2, center.y + 4, center.z + 2)
    };
  }

  public override getRampSurfaceY(x: number, z: number): number | undefined {
    const center = this.cell.clone().multiplyScalar(CELL_SIZE);
    const localX = x - center.x;
    const localZ = z - center.z;

    if (Math.abs(localX) > 2 || Math.abs(localZ) > 2) {
      return undefined;
    }

    let climb = 0;

    if (this.direction === 'N') {
      climb = (2 - localZ) / CELL_SIZE;
    } else if (this.direction === 'S') {
      climb = (localZ + 2) / CELL_SIZE;
    } else if (this.direction === 'E') {
      climb = (localX + 2) / CELL_SIZE;
    } else {
      climb = (2 - localX) / CELL_SIZE;
    }

    return center.y + Math.max(0, Math.min(1, climb)) * CELL_SIZE;
  }
}

function createRampGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertices = new Float32Array([
    -2, 0, -2,
    2, 0, -2,
    -2, 4, -2,
    2, 4, -2,
    -2, 0, 2,
    2, 0, 2
  ]);
  const indices = [
    0, 1, 3, 0, 3, 2,
    4, 5, 1, 4, 1, 0,
    4, 0, 2,
    5, 3, 1,
    4, 2, 3, 4, 3, 5
  ];

  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function addRampTrim(root: Mesh, material: MeshStandardMaterial): void {
  const slopeAngle = -Math.atan2(CELL_SIZE, CELL_SIZE);
  const rails: Array<{
    size: [number, number, number];
    position: [number, number, number];
    rotationX?: number;
  }> = [
    { size: [0.18, 0.18, 5.45], position: [-1.9, 2.05, 0], rotationX: slopeAngle },
    { size: [0.18, 0.18, 5.45], position: [1.9, 2.05, 0], rotationX: slopeAngle },
    { size: [3.85, 0.16, 0.18], position: [0, 0.56, 1.46] },
    { size: [3.85, 0.16, 0.18], position: [0, 1.24, 0.78] },
    { size: [3.85, 0.16, 0.18], position: [0, 1.92, 0.1] },
    { size: [3.85, 0.16, 0.18], position: [0, 2.6, -0.58] },
    { size: [3.85, 0.16, 0.18], position: [0, 3.28, -1.26] }
  ];

  for (const rail of rails) {
    const mesh = new Mesh(new BoxGeometry(...rail.size), material);
    mesh.position.set(...rail.position);
    mesh.rotation.x = rail.rotationX ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
