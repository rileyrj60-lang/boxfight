import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Scene,
  Sprite,
  SpriteMaterial
} from 'three';
import { InterpolationBuffer } from './InterpolationBuffer';

const PALETTE = [
  0xff5470,
  0x4dd2ff,
  0xffd644,
  0x9b6bff,
  0x4cd97b,
  0xff8a4c
];

const HP_BAR_BG_COLOR = 0x222222;
const HP_BAR_FG_COLOR = 0x4cd97b;
const HP_BAR_LOW_COLOR = 0xff5470;

function colorForSession(sessionId: string): number {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function createTextSprite(text: string, color: string, fontPx = 32): Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontPx}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new SpriteMaterial({ map: texture, depthTest: false, transparent: true });
  const sprite = new Sprite(material);
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 999;
  return sprite;
}

export class RemotePlayer {
  public readonly group = new Group();
  public readonly buffer = new InterpolationBuffer();
  private readonly body: Mesh;
  private readonly nameSprite: Sprite;
  private readonly deadSprite: Sprite;
  private readonly bodyMaterial: MeshStandardMaterial;
  private readonly hpBarBg: Mesh;
  private readonly hpBarFg: Mesh;
  private readonly hpBarFgMaterial: MeshBasicMaterial;
  private readonly nameTexture: CanvasTexture;
  private readonly deadTexture: CanvasTexture;
  private alive = true;
  private hp = 100;

  public constructor(
    private readonly scene: Scene,
    public readonly sessionId: string,
    name: string
  ) {
    const colorHex = colorForSession(sessionId);
    this.bodyMaterial = new MeshStandardMaterial({ color: new Color(colorHex), roughness: 0.6, metalness: 0.05 });

    const geometry = new CapsuleGeometry(0.5, 1.1, 6, 12);
    this.body = new Mesh(geometry, this.bodyMaterial);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.body.position.y = 1.05;
    this.body.userData.remoteSessionId = sessionId;
    this.body.userData.remotePlayer = this;
    this.group.add(this.body);

    this.nameSprite = createTextSprite(name, `#${colorHex.toString(16).padStart(6, '0')}`);
    this.nameSprite.position.set(0, 2.85, 0);
    this.nameTexture = this.nameSprite.material.map as CanvasTexture;
    this.group.add(this.nameSprite);

    this.deadSprite = createTextSprite('DEAD', '#ff5470', 36);
    this.deadSprite.position.set(0, 2.0, 0);
    this.deadSprite.visible = false;
    this.deadTexture = this.deadSprite.material.map as CanvasTexture;
    this.group.add(this.deadSprite);

    const hpBarGeom = new PlaneGeometry(1, 0.1);
    const hpBarBgMat = new MeshBasicMaterial({ color: HP_BAR_BG_COLOR, transparent: true, opacity: 0.85, depthTest: false });
    this.hpBarBg = new Mesh(hpBarGeom, hpBarBgMat);
    this.hpBarBg.position.set(0, 2.5, 0);
    this.hpBarBg.renderOrder = 998;
    this.group.add(this.hpBarBg);

    this.hpBarFgMaterial = new MeshBasicMaterial({ color: HP_BAR_FG_COLOR, transparent: true, opacity: 0.95, depthTest: false });
    this.hpBarFg = new Mesh(hpBarGeom.clone(), this.hpBarFgMaterial);
    this.hpBarFg.position.set(0, 2.5, 0.01);
    this.hpBarFg.renderOrder = 999;
    this.group.add(this.hpBarFg);

    this.scene.add(this.group);
  }

  public update(nowMs: number, cameraPosition?: { x: number; y: number; z: number }): void {
    const state = this.buffer.sample(nowMs);
    if (!state) {
      return;
    }

    this.group.position.set(state.x, state.y, state.z);
    this.body.rotation.y = state.ry;

    if (cameraPosition) {
      const dx = cameraPosition.x - state.x;
      const dz = cameraPosition.z - state.z;
      const billboardY = Math.atan2(dx, dz);
      this.hpBarBg.rotation.y = billboardY;
      this.hpBarFg.rotation.y = billboardY;
    }
  }

  public setVitals(hp: number, alive: boolean): void {
    this.hp = Math.max(0, Math.min(100, hp));
    this.alive = alive;

    const ratio = this.hp / 100;
    this.hpBarFg.scale.x = Math.max(0.001, ratio);
    this.hpBarFg.position.x = -(1 - ratio) / 2;
    this.hpBarFgMaterial.color.setHex(ratio > 0.4 ? HP_BAR_FG_COLOR : HP_BAR_LOW_COLOR);

    this.body.visible = alive;
    this.hpBarBg.visible = alive;
    this.hpBarFg.visible = alive;
    this.deadSprite.visible = !alive;
  }

  public isAlive(): boolean {
    return this.alive;
  }

  public getHitObject(): Mesh | undefined {
    return this.alive ? this.body : undefined;
  }

  public dispose(): void {
    this.scene.remove(this.group);
    this.body.geometry.dispose();
    this.bodyMaterial.dispose();
    this.nameTexture.dispose();
    this.nameSprite.material.dispose();
    this.deadTexture.dispose();
    this.deadSprite.material.dispose();
    this.hpBarBg.geometry.dispose();
    (this.hpBarBg.material as MeshBasicMaterial).dispose();
    this.hpBarFg.geometry.dispose();
    this.hpBarFgMaterial.dispose();
  }
}
