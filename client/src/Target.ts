import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3
} from 'three';

type DamageNumber = {
  sprite: Sprite;
  texture: CanvasTexture;
  material: SpriteMaterial;
  age: number;
};

const MAX_HEALTH = 100;
const FLASH_DURATION = 0.12;
const DAMAGE_NUMBER_LIFETIME = 0.68;
const DESPAWN_DELAY = 1;
const RESPAWN_DELAY = 4.2;

export class Target {
  public readonly group = new Group();
  public readonly collisionObjects: Object3D[] = [];

  private readonly originalPosition: Vector3;
  private readonly deathPosition = new Vector3();
  private readonly armorMaterial = new MeshStandardMaterial({
    color: 0x2f9d7e,
    roughness: 0.62,
    metalness: 0.12,
    emissive: 0x000000
  });
  private readonly suitMaterial = new MeshStandardMaterial({
    color: 0x273445,
    roughness: 0.78,
    metalness: 0.08,
    emissive: 0x000000
  });
  private readonly headMaterial = new MeshStandardMaterial({
    color: 0xe1c3a2,
    roughness: 0.68,
    emissive: 0x000000
  });
  private readonly healthBarFill = new Mesh(
    new BoxGeometry(1.35, 0.09, 0.03),
    new MeshBasicMaterial({ color: 0x4cff8b })
  );
  private readonly damageNumbers: DamageNumber[] = [];
  private readonly moveDistance: number;
  private readonly moveSpeed: number;
  private readonly movePhase: number;
  private health = MAX_HEALTH;
  private flashRemaining = 0;
  private deathElapsed = 0;
  private moveElapsed = 0;
  private dead = false;

  public constructor(private readonly scene: Scene, position: Vector3) {
    this.originalPosition = position.clone();
    this.group.position.copy(position);
    this.moveDistance = 1.3 + (Math.abs(position.x * 7 + position.z * 3) % 4) * 0.35;
    this.moveSpeed = 0.7 + (Math.abs(position.x + position.z) % 3) * 0.12;
    this.movePhase = (Math.abs(position.x * 0.31 + position.z * 0.17) % Math.PI) * 2;

    this.createBody();
    this.createHealthBar();
  }

  public takeDamage(amount: number, hitPoint: Vector3, critical = false): void {
    if (this.dead) {
      return;
    }

    this.health = Math.max(0, this.health - amount);
    this.flashRemaining = FLASH_DURATION;
    this.updateHealthBar();
    this.spawnDamageNumber(amount, hitPoint, critical);

    if (this.health === 0) {
      this.die();
    }
  }

  public getHitObjects(): Object3D[] {
    return this.dead ? [] : this.collisionObjects;
  }

  public update(deltaSeconds: number): void {
    this.updateFlash(deltaSeconds);
    this.updateDamageNumbers(deltaSeconds);

    if (!this.dead) {
      this.updateMovement(deltaSeconds);
      return;
    }

    this.deathElapsed += deltaSeconds;

    if (this.deathElapsed <= DESPAWN_DELAY) {
      const progress = this.deathElapsed / DESPAWN_DELAY;
      this.group.rotation.z = MathUtils.lerp(0, Math.PI * 0.48, progress);
      this.group.position.set(
        this.deathPosition.x,
        MathUtils.lerp(this.deathPosition.y, -2.5, progress),
        this.deathPosition.z
      );
    } else {
      this.group.visible = false;
    }

    if (this.deathElapsed >= RESPAWN_DELAY) {
      this.respawn();
    }
  }

  public dispose(): void {
    for (const object of this.collisionObjects) {
      const mesh = object as Mesh;
      mesh.geometry.dispose();
    }

    this.armorMaterial.dispose();
    this.suitMaterial.dispose();
    this.headMaterial.dispose();
    this.healthBarFill.geometry.dispose();
    this.healthBarFill.material.dispose();

    for (const damageNumber of this.damageNumbers) {
      this.scene.remove(damageNumber.sprite);
      damageNumber.material.dispose();
      damageNumber.texture.dispose();
    }

    this.damageNumbers.length = 0;
  }

  private createBody(): void {
    const torso = new Mesh(new BoxGeometry(1.15, 1.35, 0.62), this.armorMaterial);
    torso.position.y = 1.32;

    const chestPlate = new Mesh(new BoxGeometry(0.8, 0.55, 0.68), this.suitMaterial);
    chestPlate.position.set(0, 1.45, -0.03);

    const head = new Mesh(new SphereGeometry(0.43, 20, 14), this.headMaterial);
    head.position.y = 2.3;

    const leftArm = new Mesh(new BoxGeometry(0.28, 1.25, 0.32), this.suitMaterial);
    leftArm.position.set(-0.82, 1.25, 0);
    leftArm.rotation.z = -0.14;

    const rightArm = new Mesh(new BoxGeometry(0.28, 1.25, 0.32), this.suitMaterial);
    rightArm.position.set(0.82, 1.25, 0);
    rightArm.rotation.z = 0.14;

    const leftLeg = new Mesh(new BoxGeometry(0.38, 1.05, 0.38), this.suitMaterial);
    leftLeg.position.set(-0.3, 0.52, 0);

    const rightLeg = new Mesh(new BoxGeometry(0.38, 1.05, 0.38), this.suitMaterial);
    rightLeg.position.set(0.3, 0.52, 0);

    for (const mesh of [torso, chestPlate, head, leftArm, rightArm, leftLeg, rightLeg]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    this.tagAsTarget(torso, 'body');
    this.tagAsTarget(chestPlate, 'body');
    this.tagAsTarget(head, 'head');
    this.collisionObjects.push(torso, chestPlate, head);
  }

  private createHealthBar(): void {
    const bar = new Group();
    const back = new Mesh(
      new BoxGeometry(1.47, 0.15, 0.025),
      new MeshBasicMaterial({ color: 0x111820 })
    );
    bar.position.y = 3.05;
    this.healthBarFill.position.z = -0.02;
    bar.add(back, this.healthBarFill);
    this.group.add(bar);
  }

  private tagAsTarget(mesh: Mesh, hitZone: 'body' | 'head'): void {
    mesh.userData.target = this;
    mesh.userData.hitZone = hitZone;
  }

  private updateMovement(deltaSeconds: number): void {
    this.moveElapsed += deltaSeconds;
    const offset = Math.sin(this.moveElapsed * this.moveSpeed + this.movePhase) * this.moveDistance;
    const sideOffset = Math.cos(this.moveElapsed * this.moveSpeed * 0.55 + this.movePhase) * 0.45;
    this.group.position.set(
      this.originalPosition.x + offset,
      this.originalPosition.y,
      this.originalPosition.z + sideOffset
    );
    this.group.rotation.y = Math.sin(this.moveElapsed * this.moveSpeed + this.movePhase) * 0.18;
  }

  private updateFlash(deltaSeconds: number): void {
    this.flashRemaining = Math.max(0, this.flashRemaining - deltaSeconds);
    const flashAmount = this.flashRemaining / FLASH_DURATION;
    const emissive = new Color(0xff2626).multiplyScalar(flashAmount);
    this.armorMaterial.emissive.copy(emissive);
    this.suitMaterial.emissive.copy(emissive);
    this.headMaterial.emissive.copy(emissive);
  }

  private updateHealthBar(): void {
    const healthRatio = this.health / MAX_HEALTH;
    this.healthBarFill.scale.x = Math.max(0.001, healthRatio);
    this.healthBarFill.position.x = -(1 - healthRatio) * 0.675;
    (this.healthBarFill.material as MeshBasicMaterial).color.set(
      healthRatio > 0.5 ? 0x4cff8b : healthRatio > 0.25 ? 0xffd24a : 0xff4d4d
    );
  }

  private spawnDamageNumber(amount: number, hitPoint: Vector3, critical: boolean): void {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 76;

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = critical
      ? 'bold 42px ui-monospace, Consolas, monospace'
      : 'bold 38px ui-monospace, Consolas, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 8;
    context.strokeStyle = 'rgba(0, 0, 0, 0.78)';
    context.fillStyle = critical ? '#fff176' : '#ff5050';
    context.strokeText(critical ? `${amount}!` : String(amount), canvas.width / 2, canvas.height / 2);
    context.fillText(critical ? `${amount}!` : String(amount), canvas.width / 2, canvas.height / 2);

    const texture = new CanvasTexture(canvas);
    const material = new SpriteMaterial({ map: texture, transparent: true });
    const sprite = new Sprite(material);
    sprite.position.copy(hitPoint).add(new Vector3(0, critical ? 0.52 : 0.35, 0));
    sprite.scale.set(critical ? 1.65 : 1.15, critical ? 0.66 : 0.52, 1);
    this.scene.add(sprite);

    this.damageNumbers.push({ sprite, texture, material, age: 0 });
  }

  private updateDamageNumbers(deltaSeconds: number): void {
    for (let index = this.damageNumbers.length - 1; index >= 0; index -= 1) {
      const damageNumber = this.damageNumbers[index];
      damageNumber.age += deltaSeconds;
      damageNumber.sprite.position.y += deltaSeconds * 1.55;
      damageNumber.material.opacity = 1 - damageNumber.age / DAMAGE_NUMBER_LIFETIME;

      if (damageNumber.age >= DAMAGE_NUMBER_LIFETIME) {
        this.scene.remove(damageNumber.sprite);
        damageNumber.material.dispose();
        damageNumber.texture.dispose();
        this.damageNumbers.splice(index, 1);
      }
    }
  }

  private die(): void {
    this.dead = true;
    this.deathElapsed = 0;
    this.deathPosition.copy(this.group.position);
  }

  private respawn(): void {
    this.health = MAX_HEALTH;
    this.dead = false;
    this.deathElapsed = 0;
    this.flashRemaining = 0;
    this.group.visible = true;
    this.group.position.copy(this.originalPosition);
    this.group.rotation.set(0, 0, 0);
    this.updateHealthBar();
  }
}
