import { ACTIONS, type ActionName } from './actions';
import { CLOCK_REPAIR_MS } from './events';
import { createInitialState, validateState } from './state';
import { hash, mulberry32 } from './rng';
import type { ActionResult, Ctx, GameState } from './types';

const DB_VERSION = 1;
const KV = 'kv';
const KEY_SAVE = 'save';
const KEY_BACKUP = 'save.bak';
const KEY_CORRUPT = 'save.corrupt';
const LOCK_NAME = 'tinyworld-save';
const CHANNEL = 'tinyworld-sync';

interface Envelope { data: unknown; sum: number; savedAt: number }

const sumOf = (data: unknown) => hash(JSON.stringify(data));

const req = <T>(r: IDBRequest<T>): Promise<T> => {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const txDone = (tx: IDBTransaction): Promise<void> => {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error ?? new Error('Transaction aborted'));
  });
}

export interface LoadInfo { recovered: 'none' | 'backup' | 'fresh'; hadCorrupt: boolean }
export interface MutateOutcome { state: GameState; result: ActionResult }

export interface ExportFile { app: 'tinyworld'; format: 1; exportedAt: number; state: GameState }

/**
 * The single authoritative persistence strategy.
 *
 * Every state change is a *serialised read-modify-write transaction*: we take a cross-context lock
 * (Web Locks), read the latest save from IndexedDB, apply a pure game action to it and write the
 * result back atomically together with a rolling backup. Because every extension surface (popup,
 * side panel, full page) goes through this path, rewards can never be duplicated and writes can
 * never silently overwrite each other. Other surfaces are told via BroadcastChannel to re-read.
 */
export class SaveStore {
  private db?: Promise<IDBDatabase>;
  private chain: Promise<unknown> = Promise.resolve();
  private channel?: BroadcastChannel;
  private listeners = new Set<(s: GameState) => void>();
  info: LoadInfo = { recovered: 'none', hadCorrupt: false };

  constructor(private opts: { dbName?: string; clock?: () => number; reducedMotion?: boolean } = {}) {
    const name = opts.dbName ?? 'tinyworld';
    this.dbName = name;
    this.clock = opts.clock ?? (() => Date.now());
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`${CHANNEL}:${name}`);
      this.channel.onmessage = () => {
        void this.read().then((s) => s && this.listeners.forEach((l) => l(s)));
      };
    }
  }
  private dbName: string;
  clock: () => number;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((res, rej) => {
      const r = indexedDB.open(this.dbName, DB_VERSION);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(KV)) r.result.createObjectStore(KV);
      };
      r.onsuccess = () => {
        r.result.onversionchange = () => { r.result.close(); this.db = undefined; };
        res(r.result);
      };
      r.onerror = () => rej(r.error);
    });
    return this.db;
  }

  private async getRaw(key: string): Promise<Envelope | undefined> {
    const db = await this.open();
    return req(db.transaction(KV, 'readonly').objectStore(KV).get(key));
  }

  private parseEnvelope(env: Envelope | undefined): GameState | null {
    if (!env || typeof env !== 'object') return null;
    if (typeof env.sum !== 'number' || sumOf(env.data) !== env.sum) return null;
    return validateState(env.data, this.clock());
  }

  /** Read the latest valid save (primary, then backup). */
  private async read(): Promise<GameState | null> {
    const primary = await this.getRaw(KEY_SAVE);
    const s = this.parseEnvelope(primary);
    if (s) return s;
    return null;
  }

  private async write(next: GameState, prevEnv?: Envelope): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(KV, 'readwrite');
    const store = tx.objectStore(KV);
    const env: Envelope = { data: next, sum: sumOf(next), savedAt: this.clock() };
    if (prevEnv) store.put(prevEnv, KEY_BACKUP);
    store.put(env, KEY_SAVE);
    await txDone(tx);
  }

  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = (globalThis.navigator as Navigator | undefined)?.locks;
    const run = () => (locks ? locks.request(LOCK_NAME + ':' + this.dbName, fn) : fn());
    // serialise inside this context too (Web Locks already do, the chain also covers non-lock envs)
    const p = this.chain.then(run, run) as Promise<T>;
    this.chain = p.catch(() => undefined);
    return p;
  }

  /** Load (or create) the save. Recovers from corruption using the rolling backup. */
  load(): Promise<GameState> {
    return this.lock(async () => {
      const primaryEnv = await this.getRaw(KEY_SAVE);
      let s = this.parseEnvelope(primaryEnv);
      if (s) return s;
      const hadSomething = primaryEnv !== undefined;
      if (hadSomething) {
        // keep the broken payload so the player can still export / inspect it
        const db = await this.open();
        const tx = db.transaction(KV, 'readwrite');
        tx.objectStore(KV).put(primaryEnv, KEY_CORRUPT);
        await txDone(tx);
        this.info.hadCorrupt = true;
      }
      const backup = this.parseEnvelope(await this.getRaw(KEY_BACKUP));
      if (backup) {
        this.info.recovered = 'backup';
        await this.write(backup);
        return backup;
      }
      s = createInitialState(this.clock(), undefined, this.opts.reducedMotion);
      this.info.recovered = hadSomething ? 'fresh' : 'none';
      await this.write(s);
      return s;
    });
  }

  /** Apply an action transactionally. Failed actions are never written. */
  mutate<P>(name: ActionName, payload?: P): Promise<MutateOutcome> {
    return this.mutateWith((s, ctx) => (ACTIONS[name] as (s: GameState, c: Ctx, p: P) => ActionResult)(s, ctx, payload as P));
  }

  mutateWith(fn: (s: GameState, ctx: Ctx) => ActionResult): Promise<MutateOutcome> {
    return this.lock(async () => {
      const prevEnv = await this.getRaw(KEY_SAVE);
      let cur = this.parseEnvelope(prevEnv);
      if (!cur) cur = (await this.recoverInLock()) as GameState;
      const draft = structuredClone(cur);
      // game time is monotonic: a clock that moved backwards cannot undo or duplicate anything
      const real = this.clock();
      const now = cur.lastActive - real > CLOCK_REPAIR_MS ? real : Math.max(real, cur.lastActive);
      const ctx: Ctx = { now, rng: mulberry32(hash(cur.seed, cur.rev, now)) };
      let result: ActionResult;
      try {
        result = fn(draft, ctx);
      } catch (e) {
        return { state: cur, result: { ok: false, reason: String((e as Error).message), effects: [] } };
      }
      if (!result.ok) return { state: cur, result };
      if (draft.lastActive === cur.lastActive) draft.lastActive = now;
      draft.rev = cur.rev + 1;
      await this.write(draft, prevEnv);
      this.channel?.postMessage({ rev: draft.rev });
      return { state: draft, result };
    });
  }

  private async recoverInLock(): Promise<GameState> {
    const backup = this.parseEnvelope(await this.getRaw(KEY_BACKUP));
    const s = backup ?? createInitialState(this.clock(), undefined, this.opts.reducedMotion);
    await this.write(s);
    return s;
  }

  /** Re-read the latest persisted state (e.g. after another window changed it). */
  refresh(): Promise<GameState | null> {
    return this.lock(() => this.read());
  }

  onExternalChange(cb: (s: GameState) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // ------------------------------------------------------------ export / import
  exportJson(s: GameState): string {
    const file: ExportFile = { app: 'tinyworld', format: 1, exportedAt: this.clock(), state: s };
    return JSON.stringify(file, null, 2);
  }

  /** Parse and validate a backup file without touching the current save. */
  previewImport(json: string): { ok: true; state: GameState } | { ok: false; error: string } {
    return previewImport(json, this.clock());
  }

  /** Replace the save with an imported state. The caller must have obtained user confirmation. */
  importState(state: GameState): Promise<GameState> {
    return this.lock(async () => {
      const prevEnv = await this.getRaw(KEY_SAVE);
      const cur = this.parseEnvelope(prevEnv);
      const next = structuredClone(state);
      next.rev = (cur?.rev ?? 0) + 1;
      next.lastActive = Math.min(next.lastActive, this.clock());
      await this.write(next, prevEnv);
      this.channel?.postMessage({ rev: next.rev });
      return next;
    });
  }

  reset(): Promise<GameState> {
    return this.lock(async () => {
      const prevEnv = await this.getRaw(KEY_SAVE);
      const cur = this.parseEnvelope(prevEnv);
      const s = createInitialState(this.clock(), undefined, this.opts.reducedMotion);
      s.rev = (cur?.rev ?? 0) + 1;
      await this.write(s, prevEnv); // previous save stays available as the rolling backup
      this.channel?.postMessage({ rev: s.rev });
      return s;
    });
  }

  /** Test helper: store arbitrary bytes under the save key. */
  async _poke(key: 'save' | 'save.bak', value: unknown) {
    const db = await this.open();
    const tx = db.transaction(KV, 'readwrite');
    tx.objectStore(KV).put(value, key);
    await txDone(tx);
  }

  close() {
    this.channel?.close();
    void this.db?.then((d) => d.close());
  }
}

export const previewImport = (json: string, now = Date.now()): { ok: true; state: GameState } | { ok: false; error: string } => {
  if (json.length > 5_000_000) return { ok: false, error: 'That file is too large to be a Tiny World backup.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }
  const f = parsed as Partial<ExportFile>;
  if (!f || f.app !== 'tinyworld' || typeof f.format !== 'number') return { ok: false, error: "That doesn't look like a Tiny World backup." };
  if (f.format > 1) return { ok: false, error: 'This backup was made by a newer version of Tiny World.' };
  const state = validateState(f.state, now);
  if (!state) return { ok: false, error: 'The backup is damaged or incompatible.' };
  return { ok: true, state };
}
