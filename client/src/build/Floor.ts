import {
  BoxGeometry,
  Mesh,
  MeshStandardMaterial,
  Vector3
} from 'three';
import { createBuildMaterial, createBuildTrimMaterial } from '../Materials';
import { BuildPiece } from './BuildPiece';

const CELL_SIZE = 4;

export class Floor extends BuildPiece {
  public constructor(gridKey: string, cell: Vector3) {
    const material = createBuildMaterial();
    const trimMaterial = createBuildTrimMaterial();
    const mesh = new Mesh(new BoxGeometry(CELL_SIZE, 0.2, CELL_SIZE), material);
    const center = cell.clone().multiplyScalar(CELL_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addFloorTrim(mesh, trimMaterial);
    mesh.position.set(center.x, center.y, center.z);
    super('floor', gridKey, cell, '', mesh, material);
  }
}

function addFloorTrim(root: Mesh, material: MeshStandardMaterial): void {
  const beams: Array<{
    size: [number, number, number];
    position: [number, number, number];
    rotationY?: number;
  }> = [
    { size: [4.16, 0.18, 0.18], position: [0, 0.12, -1.88] },
    { size: [4.16, 0.18, 0.18], position: [0, 0.12, 1.88] },
    { size: [0.18, 0.18, 4.16], position: [-1.88, 0.12, 0] },
    { size: [0.18, 0.18, 4.16], position: [1.88, 0.12, 0] },
    { size: [0.14, 0.16, 5.28], position: [0, 0.15, 0], rotationY: Math.PI / 4 },
    { size: [0.14, 0.16, 5.28], position: [0, 0.16, 0], rotationY: -Math.PI / 4 }
  ];

  for (const beam of beams) {
    const mesh = new Mesh(new BoxGeometry(...beam.size), material);
    mesh.position.set(...beam.position);
    mesh.rotation.y = beam.rotationY ?? 0;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
