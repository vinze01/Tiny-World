import type { Effect, GameState } from './types';

export const addTokens = (s: GameState, n: number, fx: Effect[], gx?: number, gy?: number) => {
  if (n <= 0) return;
  s.tokens += n;
  s.stats.tokensEarned += n;
  fx.push({ type: 'tokens', amount: n, gx, gy });
}

export const discover = (s: GameState, id: string, now: number, fx: Effect[]) => {
  if (s.discovered[id]) return;
  s.discovered[id] = now;
  fx.push({ type: 'discover', id });
}

export const newId = (s: GameState) => `o${s.nextId++}`;

export const giveInv = (s: GameState, key: string, n = 1) => {
  s.inventory[key] = Math.min(9999, (s.inventory[key] ?? 0) + n);
}
