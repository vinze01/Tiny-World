import { clamp } from './rng';
import type { BiomeId, CycleMode, DayPhase } from './types';

export interface SkyState {
  /** 0..24 hour of the (possibly accelerated or manually previewed) day */
  hour: number;
  phase: DayPhase;
  /** 0 = full day, 1 = deep night (smooth) */
  night: number;
  /** multiply tint applied to world sprites */
  tint: number;
  skyTop: number;
  skyBottom: number;
  glow: number;
}

interface Key { h: number; tint: number; top: number; bot: number; night: number }
// Keyframes loosely follow the reference art: warm morning, bright day, rosy sunset, deep navy night.
const KEYS: Key[] = [
  { h: 0, tint: 0x6f7fc4, top: 0x0d1030, bot: 0x2a2d6a, night: 1 },
  { h: 5, tint: 0x7f8bc8, top: 0x1a1d4d, bot: 0x4a4a8a, night: 0.9 },
  { h: 6.5, tint: 0xffd9b5, top: 0x7aa7d6, bot: 0xffcfa0, night: 0.25 },
  { h: 9, tint: 0xfff3dc, top: 0x6ec0ec, bot: 0xd6efe6, night: 0 },
  { h: 12, tint: 0xffffff, top: 0x5cb8ee, bot: 0xcdeef4, night: 0 },
  { h: 16.5, tint: 0xfff4de, top: 0x68b6e6, bot: 0xf2e6c6, night: 0 },
  { h: 18, tint: 0xffb98c, top: 0x6a79c0, bot: 0xffa77a, night: 0.2 },
  { h: 19.5, tint: 0xa5899f, top: 0x2e2f6e, bot: 0xd8727a, night: 0.65 },
  { h: 21, tint: 0x6f7fc4, top: 0x0d1030, bot: 0x2a2d6a, night: 1 },
  { h: 24, tint: 0x6f7fc4, top: 0x0d1030, bot: 0x2a2d6a, night: 1 },
];

const mix = (a: number, b: number, t: number) => {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
};

export const FAST_CYCLE_MS = 6 * 60_000;

/** Hour of day for a timestamp under a cycle mode and optional visual manualHour override. */
export const hourFor = (now: number, mode: CycleMode, manualHour?: number | null): number => {
  if (mode === 'custom') {
    const h = typeof manualHour === 'number' && Number.isFinite(manualHour) ? manualHour : 12;
    return ((h % 24) + 24) % 24;
  }
  if (mode === 'day') return 12;
  if (mode === 'night') return 23;
  if (mode === 'fast') return ((now % FAST_CYCLE_MS) / FAST_CYCLE_MS) * 24;
  const d = new Date(now);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

export const phaseOf = (hour: number): DayPhase => {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19.5) return 'sunset';
  return 'night';
}

const BIOME_SKY_BIAS: Partial<Record<BiomeId, { top: number; bot: number; tint: number; strength: number }>> = {
  frostfall: { top: 0x7cb8e8, bot: 0xdcf0fa, tint: 0xf0f7ff, strength: 0.25 },
  mistwood: { top: 0x628ea0, bot: 0xc2d8c8, tint: 0xecf5ee, strength: 0.22 },
  emberglow: { top: 0x7d4c68, bot: 0xf2a67a, tint: 0xffebd6, strength: 0.26 },
  starlight: { top: 0x1e2058, bot: 0x5c4c96, tint: 0xe6e0ff, strength: 0.28 },
  everdream: { top: 0x72b0ea, bot: 0xf4dff0, tint: 0xfff7fc, strength: 0.22 },
};

export const skyAt = (
  now: number,
  mode: CycleMode,
  manualHour?: number | null,
  biome?: BiomeId | null,
): SkyState => {
  const hour = hourFor(now, mode, manualHour);
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = clamp((hour - a.h) / (b.h - a.h || 1), 0, 1);
  const night = a.night + (b.night - a.night) * t;
  let tint = mix(a.tint, b.tint, t);
  let skyTop = mix(a.top, b.top, t);
  let skyBottom = mix(a.bot, b.bot, t);
  const bias = biome ? BIOME_SKY_BIAS[biome] : undefined;
  if (bias) {
    const s = bias.strength * (1 - night * 0.45);
    tint = mix(tint, bias.tint, s * 0.65);
    skyTop = mix(skyTop, bias.top, s);
    skyBottom = mix(skyBottom, bias.bot, s);
  }
  return {
    hour,
    phase: phaseOf(hour),
    night,
    tint,
    skyTop,
    skyBottom,
    glow: clamp((night - 0.35) / 0.65, 0, 1),
  };
}

/** Real wall-clock night (used by the Night Owl achievement so settings can't fake it). */
export const isRealNight = (now: number) => phaseOf(hourFor(now, 'real')) === 'night';
