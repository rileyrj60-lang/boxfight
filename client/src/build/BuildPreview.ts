import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Scene
} from 'three';
import type { BuildPlacement } from './BuildGrid';
import type { BuildType } from './BuildPiece';

export class BuildPreview {
  private readonly material = new MeshStandardMaterial({
    color: 0x35d06f,
    emissive: 0x124d36,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    roughness: 0.42,
    metalness: 0.08
  });
  private readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial> = new Mesh(
    new BoxGeometry(4, 4, 0.2),
    this.material
  );
  private currentType: BuildType = 'wall';
  private rejectFlashRemaining = 0;

  public constructor(private readonly scene: Scene) {
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  public flashRejected(): void {
    this.rejectFlashRemaining = 0.18;
  }

  public update(deltaSeconds: number): void {
    if (this.rejectFlashRemaining > 0) {
      this.rejectFlashRemaining = Math.max(0, this.rejectFlashRemaining - deltaSeconds);
    }
  }

  public show(placement: BuildPlacement, valid: boolean): void {
    if (placement.type !== this.currentType) {
      this.currentType = placement.type;
      this.mesh.geometry.dispose();
      this.mesh.geometry = this.createGeometry(placement.type);
    }

    this.mesh.visible = true;
    this.mesh.position.copy(placement.position);
    this.mesh.rotation.copy(placement.rotation);
    const flashing = this.rejectFlashRemaining > 0;
    this.material.color.set(flashing ? 0xff2a2a : valid ? 0x35d06f : 0xd04242);
    this.material.opacity = flashing ? 0.6 : 0.34;
  }

  public hide(): void {
    this.mesh.visible = false;
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }

  private createGeometry(type: BuildType): BufferGeometry {
    if (type === 'wall') {
      return new BoxGeometry(4, 4, 0.2);
    }

    if (type === 'floor') {
      return new BoxGeometry(4, 0.2, 4);
    }

    if (type === 'roof') {
      const geometry = new BufferGeometry();
      const vertices = new Float32Array([
        -2, 0, -2,
        2, 0, -2,
        2, 0, 2,
        -2, 0, 2,
        0, 2.2, 0
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
}
