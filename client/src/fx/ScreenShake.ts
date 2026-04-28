export class ScreenShake {
  private amplitude = 0;
  private duration = 0;
  private elapsed = 0;
  public offsetX = 0;
  public offsetY = 0;

  public add(amplitude: number, duration = 0.08): void {
    if (amplitude > this.amplitude) {
      this.amplitude = amplitude;
      this.duration = duration;
      this.elapsed = 0;
    }
  }

  public update(deltaSeconds: number): void {
    if (this.amplitude <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.elapsed += deltaSeconds;
    const remaining = Math.max(0, 1 - this.elapsed / this.duration);
    const a = this.amplitude * remaining;
    this.offsetX = (Math.random() * 2 - 1) * a;
    this.offsetY = (Math.random() * 2 - 1) * a;
    if (this.elapsed >= this.duration) {
      this.amplitude = 0;
      this.duration = 0;
      this.elapsed = 0;
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }
}
