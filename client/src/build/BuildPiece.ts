import {
  Box3,
  Color,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3
} from 'three';

export type BuildType = 'wall' | 'ramp' | 'floor' | 'roof';
export type WallFace = 'N' | 'S' | 'E' | 'W';
export type BuildFace = WallFace | '';

export type AABB = {
  min: Vector3;
  max: Vector3;
};

const FULL_HEALTH_COLOR = new Color(0xa87c4a);
const DESTROYED_COLOR = new Color(0x111111);
const FLASH_COLOR = new Color(0xffffff);
const FLASH_DURATION = 0.08;

export abstract class BuildPiece {
  public onDestroyed?: (piece: BuildPiece) => void;

  protected readonly fullHealth = 150;
  protected health = this.fullHealth;
  protected flashRemaining = 0;
  private spawnTween = 0;
  private destroying = false;
  private destroyTween = 0;

  public constructor(
    public readonly type: BuildType,
    public readonly gridKey: string,
    public readonly cell: Vector3,
    public readonly face: BuildFace,
    public readonly mesh: Mesh,
    protected readonly material: MeshStandardMaterial
  ) {
    this.mesh.userData.buildPiece = this;
    this.spawnTween = 0;
    this.mesh.scale.setScalar(0.85);
  }

  public update(deltaSeconds: number): void {
    this.flashRemaining = Math.max(0, this.flashRemaining - deltaSeconds);
    if (this.spawnTween < 1) {
      this.spawnTween = Math.min(1, this.spawnTween + deltaSeconds / 0.12);
      const eased = 1 - Math.pow(1 - this.spawnTween, 3);
      const scale = 0.85 + (1 - 0.85) * eased;
      this.mesh.scale.setScalar(scale);
    }
    if (this.destroying) {
      this.destroyTween = Math.min(1, this.destroyTween + deltaSeconds / 0.1);
      const scale = Math.max(0.001, 1 - this.destroyTween);
      this.mesh.scale.setScalar(scale);
    }
    this.updateColor();
  }

  public beginDestroyAnim(): void {
    if (this.destroying) return;
    this.destroying = true;
    this.destroyTween = 0;
    this.flashRemaining = FLASH_DURATION;
  }

  public isDestroyAnimDone(): boolean {
    return this.destroying && this.destroyTween >= 1;
  }

  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.flashRemaining = FLASH_DURATION;
    this.updateColor();

    if (this.health === 0) {
      this.onDestroyed?.(this);
    }
  }

  public setHealth(amount: number, flash = true): void {
    const next = Math.max(0, Math.min(this.fullHealth, amount));
    if (flash && next < this.health) {
      this.flashRemaining = FLASH_DURATION;
    }
    this.health = next;
    this.updateColor();
  }

  public getHealth(): number {
    return this.health;
  }

  public getRaycastObjects(): Object3D[] {
    return [this.mesh];
  }

  public getAABB(): AABB {
    const box = new Box3().setFromObject(this.mesh);
    return {
      min: box.min.clone(),
      max: box.max.clone()
    };
  }

  public getRampSurfaceY(_x: number, _z: number): number | undefined {
    return undefined;
  }

  public getRoofSurfaceY(_x: number, _z: number): number | undefined {
    return undefined;
  }

  public dispose(): void {
    const disposedMaterials = new Set<Material>();

    this.mesh.traverse((object) => {
      const child = object as Mesh;

      if (child.geometry) {
        child.geometry.dispose();
      }

      const material = child.material;

      if (Array.isArray(material)) {
        for (const item of material) {
          if (!disposedMaterials.has(item)) {
            item.dispose();
            disposedMaterials.add(item);
          }
        }
      } else if (material && !disposedMaterials.has(material)) {
        material.dispose();
        disposedMaterials.add(material);
      }
    });
  }

  private updateColor(): void {
    const healthRatio = this.health / this.fullHealth;
    const baseColor = DESTROYED_COLOR.clone().lerp(FULL_HEALTH_COLOR, healthRatio);
    const flashAmount = this.flashRemaining / FLASH_DURATION;
    this.material.color.copy(baseColor.lerp(FLASH_COLOR, flashAmount));
  }
}
