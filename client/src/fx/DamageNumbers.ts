import { CanvasTexture, Scene, Sprite, SpriteMaterial, Vector3 } from 'three';

type Floater = {
  sprite: Sprite;
  texture: CanvasTexture;
  material: SpriteMaterial;
  age: number;
  life: number;
  velocityY: number;
};

export class DamageNumbers {
  private readonly floaters: Floater[] = [];

  public constructor(private readonly scene: Scene) {}

  public spawn(position: Vector3, amount: number, kind: 'self' | 'opponent' | 'build' = 'opponent'): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `bold ${kind === 'opponent' ? 44 : 32}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillStyle = kind === 'self' ? '#ff5470' : kind === 'build' ? '#ffd070' : '#ffffff';
      const text = `-${Math.round(amount)}`;
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new Sprite(material);
    sprite.scale.set(kind === 'opponent' ? 1.6 : 1.1, kind === 'opponent' ? 0.8 : 0.55, 1);
    sprite.position.copy(position);
    sprite.position.y += 0.2;
    sprite.renderOrder = 1000;
    this.scene.add(sprite);

    this.floaters.push({
      sprite,
      texture,
      material,
      age: 0,
      life: 0.85,
      velocityY: 1.6
    });
  }

  public update(deltaSeconds: number): void {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.age += deltaSeconds;
      f.sprite.position.y += f.velocityY * deltaSeconds;
      f.material.opacity = Math.max(0, 1 - f.age / f.life);
      if (f.age >= f.life) {
        this.scene.remove(f.sprite);
        f.material.dispose();
        f.texture.dispose();
        this.floaters.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    for (const f of this.floaters) {
      this.scene.remove(f.sprite);
      f.material.dispose();
      f.texture.dispose();
    }
    this.floaters.length = 0;
  }
}
