import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3
} from 'three';

export class WeaponViewModel {
  private readonly root = new Group();
  private readonly rifle = new Group();
  private readonly sniper = new Group();
  private readonly pickaxe = new Group();
  private readonly rootTarget = new Vector3(0.45, -0.42, -0.8);
  private swayTime = 0;

  public constructor(camera: PerspectiveCamera) {
    this.root.position.copy(this.rootTarget);
    this.root.rotation.set(-0.08, -0.18, 0.05);
    this.createRifle();
    this.createSniper();
    this.createPickaxe();
    this.root.add(this.rifle, this.sniper, this.pickaxe);
    camera.add(this.root);
  }

  public update(
    weaponName: string,
    deltaSeconds: number,
    isAiming: boolean,
    playerSpeed: number,
    swapProgress = 1
  ): void {
    const swapDip = swapProgress >= 1 ? 0 : Math.sin(swapProgress * Math.PI) * 0.55;
    const sniperAiming = weaponName === 'SNIPER' && isAiming;
    this.rifle.visible = weaponName === 'RIFLE';
    this.sniper.visible = weaponName === 'SNIPER';
    this.pickaxe.visible = weaponName === 'PICKAXE';

    this.swayTime += deltaSeconds * (3.5 + playerSpeed * 0.22);
    const swayScale = sniperAiming ? 0.12 : 1;
    const bobX = Math.sin(this.swayTime * 1.7) * 0.018 * swayScale;
    const bobY = Math.cos(this.swayTime * 2.2) * 0.014 * swayScale;
    this.rootTarget.set(
      sniperAiming ? 0.08 : 0.45,
      sniperAiming ? -0.37 : -0.42,
      sniperAiming ? -0.74 : -0.8
    );

    const amount = 1 - Math.exp(-14 * deltaSeconds);
    this.root.position.x = MathUtils.lerp(this.root.position.x, this.rootTarget.x + bobX, amount);
    this.root.position.y = MathUtils.lerp(this.root.position.y, this.rootTarget.y + bobY - swapDip, amount);
    this.root.position.z = MathUtils.lerp(this.root.position.z, this.rootTarget.z, amount);
    this.root.rotation.x = MathUtils.lerp(this.root.rotation.x, sniperAiming ? -0.04 : -0.08, amount);
    this.root.rotation.y = MathUtils.lerp(this.root.rotation.y, sniperAiming ? -0.04 : -0.18, amount);
    this.root.rotation.z = MathUtils.lerp(this.root.rotation.z, sniperAiming ? 0 : 0.05, amount);
  }

  private createRifle(): void {
    const bodyMaterial = this.createMaterial(0x242932);
    const gripMaterial = this.createMaterial(0x7b5631);
    const barrelMaterial = this.createMaterial(0x0c1015);
    const accentMaterial = this.createMaterial(0x35d6be);

    this.addBox(this.rifle, [0.22, 0.16, 0.68], [0, 0, -0.12], bodyMaterial);
    this.addBox(this.rifle, [0.16, 0.18, 0.28], [0.02, -0.02, 0.35], gripMaterial);
    this.addBox(this.rifle, [0.12, 0.32, 0.13], [0.03, -0.22, 0.05], gripMaterial, [-0.24, 0, 0]);
    this.addBox(this.rifle, [0.2, 0.08, 0.2], [0, -0.2, -0.22], barrelMaterial, [-0.12, 0, 0]);
    this.addCylinder(this.rifle, 0.036, 0.62, [0, 0.045, -0.72], barrelMaterial);
    this.addCylinder(this.rifle, 0.052, 0.12, [0, 0.045, -1.05], accentMaterial);
    this.addBox(this.rifle, [0.2, 0.035, 0.42], [0, 0.11, -0.18], barrelMaterial);
    this.addBox(this.rifle, [0.16, 0.18, 0.12], [0, 0.22, -0.18], barrelMaterial);
  }

  private createSniper(): void {
    const bodyMaterial = this.createMaterial(0x1b222d);
    const barrelMaterial = this.createMaterial(0x05080d);
    const scopeMaterial = this.createMaterial(0x121820);
    const glassMaterial = this.createMaterial(0x73e6ff);
    const gripMaterial = this.createMaterial(0x5e4229);

    this.addBox(this.sniper, [0.2, 0.15, 0.7], [0, 0, -0.1], bodyMaterial);
    this.addBox(this.sniper, [0.16, 0.15, 0.36], [0.02, -0.03, 0.38], gripMaterial);
    this.addBox(this.sniper, [0.1, 0.34, 0.12], [0.02, -0.22, 0.04], gripMaterial, [-0.26, 0, 0]);
    this.addCylinder(this.sniper, 0.032, 1.08, [0, 0.04, -0.92], barrelMaterial);
    this.addCylinder(this.sniper, 0.058, 0.18, [0, 0.04, -1.52], barrelMaterial);
    this.addCylinder(this.sniper, 0.076, 0.48, [0, 0.22, -0.3], scopeMaterial);
    this.addCylinder(this.sniper, 0.095, 0.08, [0, 0.22, -0.58], glassMaterial);
    this.addCylinder(this.sniper, 0.095, 0.08, [0, 0.22, -0.02], glassMaterial);
    this.addBox(this.sniper, [0.22, 0.035, 0.52], [0, 0.12, -0.2], barrelMaterial);
    this.addBox(this.sniper, [0.028, 0.34, 0.028], [-0.13, -0.22, -0.56], barrelMaterial, [0.34, 0, -0.16]);
    this.addBox(this.sniper, [0.028, 0.34, 0.028], [0.13, -0.22, -0.56], barrelMaterial, [0.34, 0, 0.16]);
  }

  private createPickaxe(): void {
    const handleMaterial = this.createMaterial(0x704b27);
    const wrapMaterial = this.createMaterial(0x2b3540);
    const headMaterial = this.createMaterial(0xc4d3df);

    this.addBox(this.pickaxe, [0.08, 0.8, 0.08], [0.02, -0.04, -0.12], handleMaterial, [0, 0, -0.5]);
    this.addBox(this.pickaxe, [0.11, 0.18, 0.1], [-0.09, 0.18, -0.15], wrapMaterial, [0, 0, -0.5]);
    this.addBox(this.pickaxe, [0.58, 0.08, 0.1], [-0.18, 0.33, -0.18], headMaterial, [0, 0, -0.5]);
    this.addBox(this.pickaxe, [0.24, 0.07, 0.08], [0.16, 0.42, -0.18], headMaterial, [0, 0, -0.9]);
  }

  private createMaterial(color: number): MeshBasicMaterial {
    return new MeshBasicMaterial({ color, depthTest: false });
  }

  private addBox(
    group: Group,
    size: [number, number, number],
    position: [number, number, number],
    material: MeshBasicMaterial,
    rotation: [number, number, number] = [0, 0, 0]
  ): void {
    const mesh = new Mesh(new BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    this.prepareMesh(mesh);
    group.add(mesh);
  }

  private addCylinder(
    group: Group,
    radius: number,
    length: number,
    position: [number, number, number],
    material: MeshBasicMaterial
  ): void {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 18), material);
    mesh.position.set(...position);
    mesh.rotation.x = Math.PI / 2;
    this.prepareMesh(mesh);
    group.add(mesh);
  }

  private prepareMesh(mesh: Mesh): void {
    mesh.renderOrder = 1000;
    mesh.frustumCulled = false;
  }
}
