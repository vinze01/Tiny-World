/**
 * Lightweight procedural Web Audio synthesizer for TinyWorld.
 * Disabled by default; never autoplays without user opt-in and gesture.
 */

export type SfxKind =
  | 'click'
  | 'collect'
  | 'place'
  | 'remove'
  | 'pet'
  | 'feed'
  | 'water'
  | 'harvest'
  | 'achievement'
  | 'discover'
  | 'expand'
  | 'error';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = false;
  private volume = 0.5;
  private ambientEnabled = false;
  private ambientTimer: number | null = null;

  configure(opts: { sound: boolean; volume: number; ambient: boolean }) {
    this.enabled = opts.sound;
    this.volume = Math.max(0, Math.min(1, opts.volume));
    this.ambientEnabled = opts.sound && opts.ambient;
    if (!this.ambientEnabled) this.stopAmbient();
    else this.startAmbient();
  }

  private ensureCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) this.ctx = new AC();
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, gainMul = 0.18, slideTo?: number) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const peak = Math.max(0.0001, this.volume * gainMul);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  play(kind: SfxKind) {
    if (!this.enabled) return;
    switch (kind) {
      case 'click':
        this.tone(520, 0.045, 'triangle', 0, 0.12, 620);
        break;
      case 'collect':
        this.tone(660, 0.08, 'sine', 0, 0.16, 880);
        this.tone(990, 0.11, 'triangle', 0.055, 0.15, 1320);
        break;
      case 'place':
        this.tone(330, 0.07, 'triangle', 0, 0.16, 440);
        this.tone(495, 0.09, 'sine', 0.045, 0.14);
        break;
      case 'remove':
        this.tone(440, 0.08, 'triangle', 0, 0.12, 290);
        break;
      case 'pet':
        this.tone(540, 0.09, 'sine', 0, 0.15, 720);
        this.tone(720, 0.12, 'sine', 0.07, 0.15, 860);
        break;
      case 'feed':
        this.tone(480, 0.07, 'triangle', 0, 0.15, 560);
        this.tone(600, 0.07, 'triangle', 0.08, 0.15, 720);
        this.tone(800, 0.11, 'sine', 0.16, 0.16, 960);
        break;
      case 'water':
        this.tone(420, 0.1, 'sine', 0, 0.14, 680);
        this.tone(560, 0.09, 'sine', 0.05, 0.11, 820);
        break;
      case 'harvest':
        this.tone(523.25, 0.08, 'triangle', 0, 0.16);
        this.tone(659.25, 0.08, 'triangle', 0.06, 0.16);
        this.tone(783.99, 0.14, 'sine', 0.12, 0.18);
        break;
      case 'achievement':
      case 'expand':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.16, 'triangle', i * 0.07, 0.17));
        break;
      case 'discover':
        [587.33, 739.99, 880].forEach((f, i) => this.tone(f, 0.12, 'sine', i * 0.06, 0.15));
        break;
      case 'error':
        this.tone(240, 0.11, 'sawtooth', 0, 0.09, 190);
        break;
    }
  }

  private startAmbient() {
    if (this.ambientTimer !== null || typeof window === 'undefined') return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    this.ambientTimer = window.setInterval(() => {
      if (!this.ambientEnabled || document.hidden) return;
      const f = scale[Math.floor(Math.random() * scale.length)];
      this.tone(f, 0.9, 'sine', 0, 0.045);
    }, 3600);
  }

  private stopAmbient() {
    if (this.ambientTimer !== null && typeof window !== 'undefined') {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
  }
}

export const sound = new SoundEngine();
