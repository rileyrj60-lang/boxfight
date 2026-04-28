import {
  MathUtils,
  PerspectiveCamera,
  Vector3
} from 'three';
import type { AABB } from './build/BuildPiece';
import { InputManager } from './InputManager';

const WALK_SPEED = 8.8;
const SPRINT_SPEED = 13.2;
const JUMP_VELOCITY = 9.6;
const SLIDE_START_SPEED = 17.5;
const SLIDE_TRIGGER_SPEED = 10.5;
const GRAVITY = 26;
const STAND_CAMERA_HEIGHT = 1.7;
const CROUCH_CAMERA_HEIGHT = 1.18;
const STAND_COLLIDER_HEIGHT = 1.7;
const CROUCH_COLLIDER_HEIGHT = 1.25;
const GROUND_ACCELERATION = 70;
const AIR_ACCELERATION = 28;
const GROUND_FRICTION = 15;
const SLIDE_FRICTION = 2.2;
const AIR_CONTROL = 0.72;
const JUMP_BUFFER_TIME = 0.12;
const COYOTE_TIME = 0.1;
const SLIDE_DURATION = 0.72;
const MAX_HORIZONTAL_SPEED = 19;

export class Player {
  private readonly position = new Vector3(0, 0, 8);
  private readonly velocity = new Vector3();
  private readonly wishDirection = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly slideDirection = new Vector3();
  private grounded = true;
  private supportedThisFrame = false;
  private jumpBufferRemaining = 0;
  private coyoteRemaining = COYOTE_TIME;
  private slideRemaining = 0;
  private cameraHeight = STAND_CAMERA_HEIGHT;
  private bobTime = 0;
  private lastUngroundedY = 0;
  private landingDip = 0;
  public onLanding?: (fallHeight: number) => void;

  public constructor(
    private readonly camera: PerspectiveCamera,
    private readonly input: InputManager
  ) {
    this.syncCamera(0);
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  public respawnAtSpawn(x?: number, y?: number, z?: number): void {
    if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
      this.position.set(x, y, z);
    } else {
      this.position.set(0, 0, 0);
    }
    this.velocity.set(0, 0, 0);
    this.slideRemaining = 0;
    this.jumpBufferRemaining = 0;
    this.grounded = true;
  }

  public getNetworkState(): {
    x: number;
    y: number;
    z: number;
    rx: number;
    ry: number;
    vy: number;
    grounded: boolean;
  } {
    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      rx: this.input.getPitch(),
      ry: this.input.getYaw(),
      vy: this.velocity.y,
      grounded: this.grounded
    };
  }

  public getPosition(): Vector3 {
    return this.position;
  }

  public getVerticalVelocity(): number {
    return this.velocity.y;
  }

  public getHorizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  public getAABB(): AABB {
    const colliderHeight = this.getColliderHeight();

    return {
      min: new Vector3(this.position.x - 0.5, this.position.y, this.position.z - 0.5),
      max: new Vector3(this.position.x + 0.5, this.position.y + colliderHeight, this.position.z + 0.5)
    };
  }

  public applyBuildCollision(correction: Vector3): void {
    this.position.add(correction);

    if (correction.y > 0) {
      this.velocity.y = Math.max(0, this.velocity.y);
      this.grounded = true;
      this.coyoteRemaining = COYOTE_TIME;
    } else if (correction.y < 0) {
      this.velocity.y = Math.min(0, this.velocity.y);
    } else if (this.isSliding()) {
      this.slideRemaining = Math.min(this.slideRemaining, 0.18);
    }

    this.syncCamera(0);
  }

  public resolveAABBCollision(obstacle: AABB): void {
    const playerAABB = this.getAABB();

    if (!aabbIntersects(playerAABB, obstacle)) {
      return;
    }

    this.applyBuildCollision(getSmallestPushOut(playerAABB, obstacle));
  }

  public setFeetY(y: number): void {
    this.position.y = y;
    this.velocity.y = Math.max(0, this.velocity.y);
    this.grounded = true;
    this.supportedThisFrame = true;
    this.coyoteRemaining = COYOTE_TIME;
    this.syncCamera(0);
  }

  public markSupported(): void {
    this.supportedThisFrame = true;
  }

  public update(deltaSeconds: number): void {
    const wasGrounded = this.grounded;
    if (!wasGrounded) {
      this.lastUngroundedY = Math.max(this.lastUngroundedY, this.position.y);
    } else {
      this.lastUngroundedY = this.position.y;
    }

    this.supportedThisFrame = false;
    this.updateActionBuffers(deltaSeconds);
    this.updateSlide(deltaSeconds);
    this.updateHorizontalMovement(deltaSeconds);
    this.updateVerticalMovement(deltaSeconds);
    this.clampHorizontalSpeed();

    this.position.addScaledVector(this.velocity, deltaSeconds);
    this.resolveGroundCollision();
    this.resolveUnsupportedGrounding(deltaSeconds);

    if (!wasGrounded && this.grounded) {
      const fall = Math.max(0, this.lastUngroundedY - this.position.y);
      if (fall > 1) {
        this.landingDip = 0.15;
        this.onLanding?.(fall);
      }
      this.lastUngroundedY = this.position.y;
    }

    if (this.landingDip > 0) {
      this.landingDip = Math.max(0, this.landingDip - deltaSeconds * 1.0);
    }

    this.syncCamera(deltaSeconds);
  }

  public getSprintBlend(): number {
    if (!this.input.isSprinting()) return 0;
    if (!this.grounded) return 0;
    const speed = this.getHorizontalSpeed();
    return Math.max(0, Math.min(1, (speed - WALK_SPEED) / (SPRINT_SPEED - WALK_SPEED)));
  }

  private updateActionBuffers(deltaSeconds: number): void {
    if (this.input.consumeJumpPressed()) {
      this.jumpBufferRemaining = JUMP_BUFFER_TIME;
    } else {
      this.jumpBufferRemaining = Math.max(0, this.jumpBufferRemaining - deltaSeconds);
    }

    if (this.grounded) {
      this.coyoteRemaining = COYOTE_TIME;
    } else {
      this.coyoteRemaining = Math.max(0, this.coyoteRemaining - deltaSeconds);
    }

    if (this.input.consumeCrouchPressed()) {
      this.tryStartSlide();
    }
  }

  private updateSlide(deltaSeconds: number): void {
    if (!this.isSliding()) {
      return;
    }

    this.slideRemaining = Math.max(0, this.slideRemaining - deltaSeconds);

    if (!this.grounded && this.slideRemaining < SLIDE_DURATION * 0.45) {
      this.slideRemaining = 0;
    }
  }

  private updateHorizontalMovement(deltaSeconds: number): void {
    this.updateWishDirection();

    if (this.isSliding()) {
      this.updateSlideMovement(deltaSeconds);
      return;
    }

    const crouchSlowdown = this.input.isCrouching() && this.grounded ? 0.72 : 1;
    const targetSpeed = (this.input.isSprinting() ? SPRINT_SPEED : WALK_SPEED) * crouchSlowdown;
    const horizontalSpeed = this.getHorizontalSpeed();
    const preservedSpeed = this.grounded
      ? Math.max(targetSpeed, Math.min(horizontalSpeed, targetSpeed + 2.5))
      : Math.max(targetSpeed, Math.min(horizontalSpeed, MAX_HORIZONTAL_SPEED));
    const targetVelocityX = this.wishDirection.x * preservedSpeed;
    const targetVelocityZ = this.wishDirection.z * preservedSpeed;
    const acceleration = this.grounded ? GROUND_ACCELERATION : AIR_ACCELERATION * AIR_CONTROL;
    const lerpAmount = 1 - Math.exp(-acceleration * deltaSeconds);

    this.velocity.x = MathUtils.lerp(this.velocity.x, targetVelocityX, lerpAmount);
    this.velocity.z = MathUtils.lerp(this.velocity.z, targetVelocityZ, lerpAmount);

    if (this.grounded && this.wishDirection.lengthSq() === 0) {
      const frictionAmount = 1 - Math.exp(-GROUND_FRICTION * deltaSeconds);
      this.velocity.x = MathUtils.lerp(this.velocity.x, 0, frictionAmount);
      this.velocity.z = MathUtils.lerp(this.velocity.z, 0, frictionAmount);
    }
  }

  private updateWishDirection(): void {
    this.wishDirection.set(0, 0, 0);

    const yaw = this.input.getYaw();
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    if (this.input.isMovingForward()) {
      this.wishDirection.add(this.forward);
    }

    if (this.input.isMovingBackward()) {
      this.wishDirection.sub(this.forward);
    }

    if (this.input.isMovingRight()) {
      this.wishDirection.add(this.right);
    }

    if (this.input.isMovingLeft()) {
      this.wishDirection.sub(this.right);
    }

    if (this.wishDirection.lengthSq() > 0) {
      this.wishDirection.normalize();
    }
  }

  private updateSlideMovement(deltaSeconds: number): void {
    const frictionAmount = 1 - Math.exp(-SLIDE_FRICTION * deltaSeconds);
    this.velocity.x = MathUtils.lerp(this.velocity.x, this.slideDirection.x * 8, frictionAmount);
    this.velocity.z = MathUtils.lerp(this.velocity.z, this.slideDirection.z * 8, frictionAmount);

    if (this.wishDirection.lengthSq() > 0) {
      this.velocity.x += this.wishDirection.x * 5.5 * deltaSeconds;
      this.velocity.z += this.wishDirection.z * 5.5 * deltaSeconds;
    }
  }

  private updateVerticalMovement(deltaSeconds: number): void {
    if (this.jumpBufferRemaining > 0 && (this.grounded || this.coyoteRemaining > 0)) {
      this.velocity.y = JUMP_VELOCITY;
      this.grounded = false;
      this.coyoteRemaining = 0;
      this.jumpBufferRemaining = 0;

      if (this.isSliding()) {
        this.slideRemaining = 0;
        this.velocity.x *= 1.08;
        this.velocity.z *= 1.08;
      }
    }

    if (!this.grounded) {
      this.velocity.y -= GRAVITY * deltaSeconds;
    }
  }

  private tryStartSlide(): void {
    if (!this.grounded || this.isSliding() || !this.input.isSprinting()) {
      return;
    }

    const horizontalSpeed = this.getHorizontalSpeed();

    if (horizontalSpeed < SLIDE_TRIGGER_SPEED) {
      return;
    }

    this.slideRemaining = SLIDE_DURATION;
    this.slideDirection.set(this.velocity.x, 0, this.velocity.z).normalize();
    this.velocity.x = this.slideDirection.x * Math.max(horizontalSpeed, SLIDE_START_SPEED);
    this.velocity.z = this.slideDirection.z * Math.max(horizontalSpeed, SLIDE_START_SPEED);
  }

  private clampHorizontalSpeed(): void {
    const horizontalSpeed = this.getHorizontalSpeed();

    if (horizontalSpeed <= MAX_HORIZONTAL_SPEED) {
      return;
    }

    const scale = MAX_HORIZONTAL_SPEED / horizontalSpeed;
    this.velocity.x *= scale;
    this.velocity.z *= scale;
  }

  private resolveGroundCollision(): void {
    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = Math.max(0, this.velocity.y);
      this.grounded = true;
      this.supportedThisFrame = true;
      this.coyoteRemaining = COYOTE_TIME;
    }
  }

  private resolveUnsupportedGrounding(deltaSeconds: number): void {
    if (this.position.y > 0 && this.grounded && !this.supportedThisFrame) {
      this.grounded = false;
      this.coyoteRemaining = Math.max(this.coyoteRemaining - deltaSeconds, 0);
    }
  }

  private syncCamera(deltaSeconds: number): void {
    const targetHeight = this.isSliding() || this.input.isCrouching()
      ? CROUCH_CAMERA_HEIGHT
      : STAND_CAMERA_HEIGHT;
    const smoothing = deltaSeconds > 0 ? 1 - Math.exp(-16 * deltaSeconds) : 1;
    this.cameraHeight = MathUtils.lerp(this.cameraHeight, targetHeight, smoothing);

    const bobStrength = this.grounded && !this.isSliding()
      ? Math.min(this.getHorizontalSpeed() / SPRINT_SPEED, 1)
      : 0;
    this.bobTime += deltaSeconds * (5 + this.getHorizontalSpeed() * 0.55);
    const bob = Math.sin(this.bobTime) * 0.05 * bobStrength;
    const dip = -this.landingDip;

    this.camera.position.set(
      this.position.x,
      this.position.y + this.cameraHeight + bob + dip,
      this.position.z
    );
  }

  private getColliderHeight(): number {
    return this.isSliding() || this.input.isCrouching()
      ? CROUCH_COLLIDER_HEIGHT
      : STAND_COLLIDER_HEIGHT;
  }

  private isSliding(): boolean {
    return this.slideRemaining > 0;
  }
}

function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x &&
    a.max.x > b.min.x &&
    a.min.y < b.max.y &&
    a.max.y > b.min.y &&
    a.min.z < b.max.z &&
    a.max.z > b.min.z
  );
}

function getSmallestPushOut(player: AABB, obstacle: AABB): Vector3 {
  const pushLeft = obstacle.min.x - player.max.x;
  const pushRight = obstacle.max.x - player.min.x;
  const pushDown = obstacle.min.y - player.max.y;
  const pushUp = obstacle.max.y - player.min.y;
  const pushBack = obstacle.min.z - player.max.z;
  const pushForward = obstacle.max.z - player.min.z;
  const candidates = [
    new Vector3(pushLeft, 0, 0),
    new Vector3(pushRight, 0, 0),
    new Vector3(0, pushDown, 0),
    new Vector3(0, pushUp, 0),
    new Vector3(0, 0, pushBack),
    new Vector3(0, 0, pushForward)
  ];

  return candidates.reduce((smallest, candidate) => (
    candidate.lengthSq() < smallest.lengthSq() ? candidate : smallest
  ));
}
