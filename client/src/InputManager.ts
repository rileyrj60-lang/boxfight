import type { PerspectiveCamera, WebGLRenderer } from 'three';
import type { BuildType } from './build/BuildPiece';

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly canvas: HTMLCanvasElement;
  private yaw = 0;
  private pitch = 0;
  private recoilOffset = 0;
  private reloadPressed = false;
  private primaryFirePressed = false;
  private secondaryFirePressed = false;
  private jumpPressed = false;
  private crouchPressed = false;
  private buildTypePressed: BuildType | undefined;
  private buildRotatePressed = false;
  private buildCancelPressed = false;
  private weaponSlotPressed: 1 | 2 | 3 | undefined;

  public sensitivity = 0.002;
  public isPointerLocked = false;
  public isPrimaryFireHeld = false;
  public isSecondaryFireHeld = false;
  public onPrimaryFire?: () => void;
  public onReload?: () => void;

  public constructor(renderer: WebGLRenderer, private readonly camera: PerspectiveCamera) {
    this.canvas = renderer.domElement;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('blur', this.releaseInput);
    this.canvas.addEventListener('click', this.requestPointerLock);
    this.canvas.addEventListener('contextmenu', this.preventContextMenu);
    this.applyCameraRotation();
    this.updateCanvasCursor();
    this.createPointerLockHint();
  }

  public isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  public isMovingForward(): boolean {
    return this.isKeyDown('KeyW');
  }

  public isMovingBackward(): boolean {
    return this.isKeyDown('KeyS');
  }

  public isMovingLeft(): boolean {
    return this.isKeyDown('KeyA');
  }

  public isMovingRight(): boolean {
    return this.isKeyDown('KeyD');
  }

  public isSprinting(): boolean {
    return this.isKeyDown('ShiftLeft') || this.isKeyDown('ShiftRight');
  }

  public wantsJump(): boolean {
    return this.isKeyDown('Space');
  }

  public consumeJumpPressed(): boolean {
    const wasPressed = this.jumpPressed;
    this.jumpPressed = false;
    return wasPressed;
  }

  public isCrouching(): boolean {
    return this.isKeyDown('ControlLeft') || this.isKeyDown('ControlRight');
  }

  public consumeCrouchPressed(): boolean {
    const wasPressed = this.crouchPressed;
    this.crouchPressed = false;
    return wasPressed;
  }

  public isBuildingWall(): boolean {
    return this.isKeyDown('KeyQ');
  }

  public isBuildingRamp(): boolean {
    return this.isKeyDown('KeyF');
  }

  public isBuildingFloor(): boolean {
    return this.isKeyDown('KeyC');
  }

  public isBuildingRoof(): boolean {
    return this.isKeyDown('KeyV');
  }

  public consumeBuildTypePressed(): BuildType | undefined {
    const buildType = this.buildTypePressed;
    this.buildTypePressed = undefined;
    return buildType;
  }

  public consumeBuildRotatePressed(): boolean {
    const wasPressed = this.buildRotatePressed;
    this.buildRotatePressed = false;
    return wasPressed;
  }

  public consumeBuildCancelPressed(): boolean {
    const wasPressed = this.buildCancelPressed;
    this.buildCancelPressed = false;
    return wasPressed;
  }

  public consumeReloadPressed(): boolean {
    const wasPressed = this.reloadPressed;
    this.reloadPressed = false;
    return wasPressed;
  }

  public consumePrimaryFirePressed(): boolean {
    const wasPressed = this.primaryFirePressed;
    this.primaryFirePressed = false;
    return wasPressed;
  }

  public consumeSecondaryFirePressed(): boolean {
    const wasPressed = this.secondaryFirePressed;
    this.secondaryFirePressed = false;
    return wasPressed;
  }

  public hasWeaponSlotPressed(): boolean {
    return this.weaponSlotPressed !== undefined;
  }

  public consumeWeaponSlotPressed(): 1 | 2 | 3 | undefined {
    const slot = this.weaponSlotPressed;
    this.weaponSlotPressed = undefined;
    return slot;
  }

  public addRecoil(radians: number): void {
    this.recoilOffset -= radians;
    this.applyCameraRotation();
  }

  public update(deltaSeconds: number): void {
    let rotationChanged = false;

    if (this.recoilOffset !== 0) {
      const decayAmount = Math.min(1, deltaSeconds / 0.1);
      this.recoilOffset = this.recoilOffset * (1 - decayAmount);

      if (Math.abs(this.recoilOffset) < 0.0001) {
        this.recoilOffset = 0;
      }

      rotationChanged = true;
    }

    if (rotationChanged) {
      this.applyCameraRotation();
    }
  }

  public getYaw(): number {
    return this.yaw;
  }

  public getPitch(): number {
    return this.pitch;
  }

  public addYawJitter(amplitude: number): void {
    this.yaw += (Math.random() * 2 - 1) * amplitude;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('blur', this.releaseInput);
    this.canvas.removeEventListener('click', this.requestPointerLock);
    this.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    const isFreshPress = !this.keys.has(event.code);

    if (event.code === 'KeyR' && !this.keys.has(event.code)) {
      this.reloadPressed = true;
      this.onReload?.();
    }

    if (isFreshPress && event.code === 'Space') {
      this.jumpPressed = true;
    }

    if (isFreshPress && (event.code === 'ControlLeft' || event.code === 'ControlRight')) {
      this.crouchPressed = true;
    }

    if (isFreshPress) {
      if (event.code === 'KeyQ') {
        this.buildTypePressed = 'wall';
      } else if (event.code === 'KeyF') {
        this.buildTypePressed = 'ramp';
      } else if (event.code === 'KeyC') {
        this.buildTypePressed = 'floor';
      } else if (event.code === 'KeyV') {
        this.buildTypePressed = 'roof';
      } else if (event.code === 'KeyE') {
        this.buildRotatePressed = true;
      } else if (event.code === 'KeyX' || event.code === 'Escape') {
        this.buildCancelPressed = true;
      }
    }

    if (isFreshPress) {
      if (event.code === 'Digit1') {
        this.weaponSlotPressed = 1;
      } else if (event.code === 'Digit2') {
        this.weaponSlotPressed = 2;
      } else if (event.code === 'Digit3') {
        this.weaponSlotPressed = 3;
      }
    }

    this.keys.add(event.code);

    if (this.isGameControl(event.code)) {
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handlePointerLockChange = (): void => {
    this.isPointerLocked = document.pointerLockElement === this.canvas;

    if (this.isPointerLocked) {
      this.hidePointerLockHint();
    } else {
      this.releaseInput();
      this.showPointerLockHint();
    }

    this.updateCanvasCursor();
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.isPointerLocked) {
      return;
    }

    this.yaw -= event.movementX * this.sensitivity;
    this.pitch -= event.movementY * this.sensitivity;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

    this.applyCameraRotation();
    event.preventDefault();
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.target !== this.canvas) {
      return;
    }

    this.canvas.focus();

    if (event.button === 0) {
      if (this.isPointerLocked) {
        this.isPrimaryFireHeld = true;
        this.primaryFirePressed = true;
        this.onPrimaryFire?.();
      } else {
        this.requestPointerLock();
      }

      event.preventDefault();
    }

    if (event.button === 2) {
      if (this.isPointerLocked) {
        this.isSecondaryFireHeld = true;
        this.secondaryFirePressed = true;
      } else {
        this.requestPointerLock();
      }

      event.preventDefault();
    }
  };

  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.isPrimaryFireHeld = false;
    }

    if (event.button === 2) {
      this.isSecondaryFireHeld = false;
      event.preventDefault();
    }
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.releaseInput();
    }
  };

  private applyCameraRotation(): void {
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.recoilOffset;
  }

  private readonly requestPointerLock = (): void => {
    void this.canvas.requestPointerLock().then(() => {
      this.hidePointerLockHint();
    }).catch(() => {
      this.isPointerLocked = false;
      this.showPointerLockHint('Pointer lock is blocked in this preview. Open in a normal browser for full mouse aim.');
      this.updateCanvasCursor();
    });
  };

  private readonly releaseInput = (): void => {
    this.keys.clear();
    this.clearHeldActions();
    this.updateCanvasCursor();
  };

  private clearHeldActions(): void {
    this.isPrimaryFireHeld = false;
    this.isSecondaryFireHeld = false;
    this.primaryFirePressed = false;
    this.secondaryFirePressed = false;
    this.jumpPressed = false;
    this.crouchPressed = false;
    this.buildTypePressed = undefined;
    this.buildRotatePressed = false;
    this.buildCancelPressed = false;
  }

  private isGameControl(code: string): boolean {
    return [
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'ControlRight',
      'Space',
      'KeyR',
      'KeyQ',
      'KeyF',
      'KeyC',
      'KeyV',
      'KeyE',
      'KeyX',
      'Digit1',
      'Digit2',
      'Digit3'
    ].includes(code);
  }

  private readonly preventContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private updateCanvasCursor(): void {
    this.canvas.style.cursor = this.isPointerLocked ? 'none' : 'crosshair';
  }

  private createPointerLockHint(): void {
    // Pointer-lock hint moved to the HUD (#play-hint) so it can be
    // toggled with the screen state. No-op kept for compatibility.
  }

  private showPointerLockHint(_message?: string): void {}
  private hidePointerLockHint(): void {}
}
