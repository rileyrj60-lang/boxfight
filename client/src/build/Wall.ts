import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3
} from 'three';
import { createBuildMaterial, createBuildTrimMaterial } from '../Materials';
import { BuildPiece, type WallFace } from './BuildPiece';

const CELL_SIZE = 4;

export class Wall extends BuildPiece {
  public constructor(gridKey: string, cell: Vector3, face: WallFace) {
    const material = createBuildMaterial();
    const trimMaterial = createBuildTrimMaterial();
    const mesh = new Mesh(new BoxGeometry(CELL_SIZE, CELL_SIZE, 0.2), material);
    const center = cell.clone().multiplyScalar(CELL_SIZE);
    const half = CELL_SIZE / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addWallTrim(mesh, trimMaterial);

    mesh.position.set(center.x, center.y + half, center.z);

    if (face === 'N') {
      mesh.position.z -= half;
    } else if (face === 'S') {
      mesh.position.z += half;
    } else if (face === 'E') {
      mesh.position.x += half;
      mesh.rotation.y = Math.PI / 2;
    } else {
      mesh.position.x -= half;
      mesh.rotation.y = Math.PI / 2;
    }

    super('wall', gridKey, cell, face, mesh, material);
  }
}

function addWallTrim(root: Mesh, material: MeshStandardMaterial): void {
  const beams: Array<{
    size: [number, number, number];
    position: [number, number, number];
    rotationZ?: number;
  }> = [
    { size: [4.16, 0.18, 0.26], position: [0, 1.88, 0.08] },
    { size: [4.16, 0.18, 0.26], position: [0, -1.88, 0.08] },
    { size: [0.18, 4.16, 0.26], position: [-1.88, 0, 0.08] },
    { size: [0.18, 4.16, 0.26], position: [1.88, 0, 0.08] },
    { size: [0.15, 5.25, 0.24], position: [0, 0, 0.1], rotationZ: Math.PI / 4 },
    { size: [0.15, 5.25, 0.24], position: [0, 0, 0.11], rotationZ: -Math.PI / 4 }
  ];

  for (const beam of beams) {
    const mesh = new Mesh(new BoxGeometry(...beam.size), material);
    mesh.position.set(...beam.position);
    mesh.rotation.z = beam.rotationZ ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
