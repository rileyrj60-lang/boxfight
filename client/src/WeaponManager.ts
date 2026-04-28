import type { WeaponStatus } from './Weapon';
import { Weapon } from './Weapon';
import { InputManager } from './InputManager';

const SWAP_DURATION = 0.25;

export class WeaponManager {
  private selectedSlot: 1 | 2 | 3 = 1;
  private swapRemaining = 0;
  public onSwap?: () => void;

  public constructor(
    private readonly input: InputManager,
    private readonly weapons: Map<1 | 2 | 3, Weapon> | Weapon
  ) {}

  public update(deltaSeconds: number, suppressFire: boolean): void {
    const pressedSlot = this.input.consumeWeaponSlotPressed();

    if (pressedSlot && pressedSlot !== this.selectedSlot) {
      this.selectedSlot = pressedSlot;
      this.swapRemaining = SWAP_DURATION;
      this.onSwap?.();
    }

    if (this.swapRemaining > 0) {
      this.swapRemaining = Math.max(0, this.swapRemaining - deltaSeconds);
    }

    const currentWeapon = this.getCurrentWeapon();
    for (const weapon of this.getWeapons()) {
      weapon.setAiming(false);
    }

    currentWeapon?.setAiming(this.input.isSecondaryFireHeld && !this.isSwapping());

    if (this.input.consumeReloadPressed() && !this.isSwapping()) {
      currentWeapon?.reload();
    }

    if (!suppressFire && !this.isSwapping()) {
      const primaryFirePressed = this.input.consumePrimaryFirePressed();

      if (primaryFirePressed || this.input.isPrimaryFireHeld) {
        currentWeapon?.fire();
      }
    }

    for (const weapon of this.getWeapons()) {
      weapon.update(deltaSeconds);
    }
  }

  public isSwapping(): boolean {
    return this.swapRemaining > 0;
  }

  public getSwapProgress(): number {
    return 1 - (this.swapRemaining / SWAP_DURATION);
  }

  public getStatus(): WeaponStatus {
    const currentWeapon = this.getCurrentWeapon();

    if (currentWeapon) {
      return currentWeapon.getStatus();
    }

    return {
      currentAmmo: 0,
      maxAmmo: 0,
      isReloading: false,
      weaponName: 'EMPTY',
      hasAmmo: false,
      isAiming: false
    };
  }

  public getSelectedSlot(): 1 | 2 | 3 {
    return this.selectedSlot;
  }

  private getCurrentWeapon(): Weapon | undefined {
    return this.weapons instanceof Map ? this.weapons.get(this.selectedSlot) : this.weapons;
  }

  private getWeapons(): Weapon[] {
    return this.weapons instanceof Map ? [...this.weapons.values()] : [this.weapons];
  }
}
