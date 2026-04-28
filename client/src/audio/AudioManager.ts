type SoundName =
  | 'rifleShot'
  | 'rifleReload'
  | 'pickaxeSwing'
  | 'buildPlace'
  | 'buildHit'
  | 'buildBreak'
  | 'playerHit'
  | 'hitConfirm'
  | 'eliminationGet'
  | 'eliminationDie'
  | 'matchStart'
  | 'matchVictory'
  | 'matchDefeat';

const VOLUME_KEY = 'boxfight:volume';

export class AudioManager {
  private context?: AudioContext;
  private master?: GainNode;
  private noiseBuffer?: AudioBuffer;
  private volume: number;

  public constructor() {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(VOLUME_KEY) : null;
    this.volume = stored !== null ? Math.max(0, Math.min(1, parseFloat(stored))) : 0.6;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    try { localStorage.setItem(VOLUME_KEY, String(this.volume)); } catch {}
    if (this.master) this.master.gain.value = this.volume;
  }

  public play(name: SoundName): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;

    switch (name) {
      case 'rifleShot': return this.playRifleShot(ctx, now);
      case 'rifleReload': return this.playRifleReload(ctx, now);
      case 'pickaxeSwing': return this.playPickaxeSwing(ctx, now);
      case 'buildPlace': return this.playBuildPlace(ctx, now);
      case 'buildHit': return this.playBuildHit(ctx, now);
      case 'buildBreak': return this.playBuildBreak(ctx, now);
      case 'playerHit': return this.playPlayerHit(ctx, now);
      case 'hitConfirm': return this.playHitConfirm(ctx, now);
      case 'eliminationGet': return this.playEliminationGet(ctx, now);
      case 'eliminationDie': return this.playEliminationDie(ctx, now);
      case 'matchStart': return this.playArpeggio(ctx, now, [392, 523, 659, 784], 0.15);
      case 'matchVictory': return this.playArpeggio(ctx, now, [523, 659, 784, 1046], 0.18, 'triangle');
      case 'matchDefeat': return this.playArpeggio(ctx, now, [392, 349, 261], 0.22, 'triangle');
    }
  }

  private ensureContext(): AudioContext | undefined {
    if (this.context) return this.context;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      const buf = this.context.createBuffer(1, this.context.sampleRate * 0.5, this.context.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    } catch {
      return undefined;
    }
    return this.context;
  }

  private envelopeGain(ctx: AudioContext, attack: number, peak: number, decay: number, start: number): GainNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
    return gain;
  }

  private connect(node: AudioNode): void {
    if (this.master) node.connect(this.master);
  }

  private noiseBurst(ctx: AudioContext, start: number, duration: number, peak: number, filterFreq?: number, filterType: BiquadFilterType = 'bandpass'): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.envelopeGain(ctx, 0.005, peak, duration, start);
    let last: AudioNode = src;
    if (filterFreq !== undefined) {
      const filt = ctx.createBiquadFilter();
      filt.type = filterType;
      filt.frequency.value = filterFreq;
      filt.Q.value = 1.2;
      src.connect(filt);
      last = filt;
    }
    last.connect(gain);
    this.connect(gain);
    src.start(start);
    src.stop(start + duration + 0.05);
  }

  private playRifleShot(ctx: AudioContext, now: number): void {
    this.noiseBurst(ctx, now, 0.06, 0.2, 1800, 'highpass');
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);
    const gain = this.envelopeGain(ctx, 0.003, 0.18, 0.08, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  private playRifleReload(ctx: AudioContext, now: number): void {
    for (const t of [now, now + 0.15]) {
      this.noiseBurst(ctx, t, 0.025, 0.16, 3000, 'highpass');
    }
  }

  private playPickaxeSwing(ctx: AudioContext, now: number): void {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 1;
    filt.frequency.setValueAtTime(400, now);
    filt.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
    const gain = this.envelopeGain(ctx, 0.01, 0.18, 0.18, now);
    src.connect(filt);
    filt.connect(gain);
    this.connect(gain);
    src.start(now);
    src.stop(now + 0.25);
  }

  private playBuildPlace(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    const gain = this.envelopeGain(ctx, 0.005, 0.22, 0.12, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playBuildHit(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    const gain = this.envelopeGain(ctx, 0.004, 0.18, 0.1, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playBuildBreak(ctx: AudioContext, now: number): void {
    this.noiseBurst(ctx, now, 0.18, 0.28, 1200, 'highpass');
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.12);
    const gain = this.envelopeGain(ctx, 0.003, 0.22, 0.16, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playPlayerHit(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
    const gain = this.envelopeGain(ctx, 0.005, 0.32, 0.12, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playHitConfirm(ctx: AudioContext, now: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, now);
    const gain = this.envelopeGain(ctx, 0.002, 0.18, 0.06, now);
    osc.connect(gain);
    this.connect(gain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  private playEliminationGet(ctx: AudioContext, now: number): void {
    this.tone(ctx, now, 660, 0.1, 'triangle', 0.22);
    this.tone(ctx, now + 0.1, 990, 0.16, 'triangle', 0.22);
  }

  private playEliminationDie(ctx: AudioContext, now: number): void {
    this.tone(ctx, now, 320, 0.14, 'triangle', 0.24);
    this.tone(ctx, now + 0.12, 220, 0.22, 'triangle', 0.24);
  }

  private playArpeggio(ctx: AudioContext, now: number, freqs: number[], step: number, type: OscillatorType = 'sine'): void {
    freqs.forEach((f, i) => {
      this.tone(ctx, now + i * step, f, step * 0.95, type, 0.18);
    });
  }

  private tone(ctx: AudioContext, start: number, freq: number, duration: number, type: OscillatorType, peak: number): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    const gain = this.envelopeGain(ctx, 0.005, peak, duration, start);
    osc.connect(gain);
    this.connect(gain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
}
