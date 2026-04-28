import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Vector3
} from 'three';
import { createBuildMaterial, createBuildTrimMaterial } from '../Materials';
import { BuildPiece, type AABB } from './BuildPiece';
import type { RampDirection } from './Ramp';

const CELL_SIZE = 4;
const ROOF_HEIGHT = 2.2;

export class Roof extends BuildPiece {
  public constructor(
    gridKey: string,
    cell: Vector3,
    direction: RampDirection
  ) {
    const material = createBuildMaterial();
    const trimMaterial = createBuildTrimMaterial();
    const mesh = new Mesh(createRoofGeometry(), material);
    const center = cell.clone().multiplyScalar(CELL_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addRoofTrim(mesh, trimMaterial);
    mesh.position.set(center.x, center.y, center.z);

    if (direction === 'S') {
      mesh.rotation.y = Math.PI;
    } else if (direction === 'E') {
      mesh.rotation.y = -Math.PI / 2;
    } else if (direction === 'W') {
      mesh.rotation.y = Math.PI / 2;
    }

    super('roof', gridKey, cell, '', mesh, material);
  }

  public override getAABB(): AABB {
    const center = this.cell.clone().multiplyScalar(CELL_SIZE);
    return {
      min: new Vector3(center.x - 2, center.y, center.z - 2),
      max: new Vector3(center.x + 2, center.y + ROOF_HEIGHT, center.z + 2)
    };
  }

  public override getRoofSurfaceY(x: number, z: number): number | undefined {
    const center = this.cell.clone().multiplyScalar(CELL_SIZE);
    const localX = x - center.x;
    const localZ = z - center.z;

    if (Math.abs(localX) > 2 || Math.abs(localZ) > 2) {
      return undefined;
    }

    const edgeDistance = Math.max(Math.abs(localX), Math.abs(localZ));
    return center.y + Math.max(0, 1 - edgeDistance / 2) * ROOF_HEIGHT;
  }
}

function createRoofGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  const vertices = new Float32Array([
    -2, 0, -2,
    2, 0, -2,
    2, 0, 2,
    -2, 0, 2,
    0, ROOF_HEIGHT, 0
  ]);
  const indices = [
    0, 1, 4,
    1, 2, 4,
    2, 3, 4,
    3, 0, 4,
    0, 3, 2,
    0, 2, 1
  ];

  geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

function addRoofTrim(root: Mesh, material: MeshStandardMaterial): void {
  const corners = [
    new Vector3(-2, 0.06, -2),
    new Vector3(2, 0.06, -2),
    new Vector3(2, 0.06, 2),
    new Vector3(-2, 0.06, 2)
  ];
  const apex = new Vector3(0, ROOF_HEIGHT + 0.04, 0);

  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index];
    const end = corners[(index + 1) % corners.length];
    root.add(createBeam(start, end, material, 0.16));
    root.add(createBeam(start, apex, material, 0.14));
  }
}

function createBeam(
  start: Vector3,
  end: Vector3,
  material: MeshStandardMaterial,
  thickness: number
): Mesh {
  const delta = end.clone().sub(start);
  const length = delta.length();
  const mesh = new Mesh(new BoxGeometry(thickness, length, thickness), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
