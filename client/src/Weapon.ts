export type WeaponStatus = {
  currentAmmo: number;
  maxAmmo: number;
  isReloading: boolean;
  weaponName: string;
  hasAmmo: boolean;
  isAiming: boolean;
};

export abstract class Weapon {
  protected currentAmmo: number;
  protected cooldownRemaining = 0;
  protected reloadRemaining = 0;

  public constructor(
    public readonly name: string,
    protected readonly maxAmmo: number,
    protected readonly reloadDuration: number,
    protected readonly fireCooldown: number,
    protected readonly hasAmmo = true
  ) {
    this.currentAmmo = maxAmmo;
  }

  public fire(): boolean {
    if (this.isReloading || this.cooldownRemaining > 0 || this.currentAmmo <= 0) {
      return false;
    }

    this.currentAmmo -= 1;
    this.cooldownRemaining = this.fireCooldown;
    this.shoot();
    return true;
  }

  public reload(): boolean {
    if (this.isReloading || this.currentAmmo === this.maxAmmo) {
      return false;
    }

    this.reloadRemaining = this.reloadDuration;
    return true;
  }

  public update(deltaSeconds: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaSeconds);

    if (!this.isReloading) {
      return;
    }

    this.reloadRemaining = Math.max(0, this.reloadRemaining - deltaSeconds);

    if (this.reloadRemaining === 0) {
      this.currentAmmo = this.maxAmmo;
    }
  }

  public getStatus(): WeaponStatus {
    return {
      currentAmmo: this.currentAmmo,
      maxAmmo: this.maxAmmo,
      isReloading: this.isReloading,
      weaponName: this.name,
      hasAmmo: this.hasAmmo,
      isAiming: this.getIsAiming()
    };
  }

  public setAiming(_aiming: boolean): void {}

  protected get isReloading(): boolean {
    return this.reloadRemaining > 0;
  }

  protected getIsAiming(): boolean {
    return false;
  }

  protected abstract shoot(): void;
}
