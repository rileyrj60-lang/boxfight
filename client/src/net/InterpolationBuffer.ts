import { INTERPOLATION_BUFFER_SIZE, INTERPOLATION_DELAY_MS } from '../shared-constants';

export type RemoteSnapshot = {
  t: number;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  vy: number;
  grounded: boolean;
};

export type InterpolatedState = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  vy: number;
  grounded: boolean;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export class InterpolationBuffer {
  private snapshots: RemoteSnapshot[] = [];

  public push(snapshot: RemoteSnapshot): void {
    this.snapshots.push(snapshot);
    if (this.snapshots.length > INTERPOLATION_BUFFER_SIZE) {
      this.snapshots.shift();
    }
  }

  public sample(nowMs: number): InterpolatedState | undefined {
    if (this.snapshots.length === 0) {
      return undefined;
    }

    const renderTime = nowMs - INTERPOLATION_DELAY_MS;

    if (this.snapshots.length === 1 || renderTime <= this.snapshots[0].t) {
      return this.toState(this.snapshots[0]);
    }

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      const a = this.snapshots[i];
      const b = this.snapshots[i + 1];
      if (renderTime >= a.t && renderTime <= b.t) {
        const span = b.t - a.t;
        const t = span > 0 ? (renderTime - a.t) / span : 0;
        return {
          x: lerp(a.x, b.x, t),
          y: lerp(a.y, b.y, t),
          z: lerp(a.z, b.z, t),
          rx: lerpAngle(a.rx, b.rx, t),
          ry: lerpAngle(a.ry, b.ry, t),
          vy: lerp(a.vy, b.vy, t),
          grounded: t < 0.5 ? a.grounded : b.grounded
        };
      }
    }

    return this.toState(this.snapshots[this.snapshots.length - 1]);
  }

  private toState(s: RemoteSnapshot): InterpolatedState {
    return { x: s.x, y: s.y, z: s.z, rx: s.rx, ry: s.ry, vy: s.vy, grounded: s.grounded };
  }
}
