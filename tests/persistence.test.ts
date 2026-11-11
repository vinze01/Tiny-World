import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SaveStore, previewImport } from '../src/core/persistence';
import { migrate, validateState } from '../src/core/state';
import { seedKey } from '../src/core/catalog';

let dbSeq = 1;
const nextDb = () => `tinyworld-test-${dbSeq++}`;

describe('persistence, corruption recovery, migrations, and concurrency', () => {
  it('initializes a fresh island when save is empty and persists mutations across restarts', async () => {
    const dbName = nextDb();
    let now = 1_700_000_000_000;
    const store1 = new SaveStore({ dbName, clock: () => now });
    const s0 = await store1.load();
    expect(s0.tokens).toBe(30);
    expect(store1.info.recovered).toBe('none');

    await store1.mutate('buy', { key: seedKey('daisy'), qty: 2 });
    store1.close();

    // Simulate browser restart with a new SaveStore instance
    now += 10_000;
    const store2 = new SaveStore({ dbName, clock: () => now });
    const s1 = await store2.load();
    expect(s1.tokens).toBe(24);
    expect(s1.inventory[seedKey('daisy')]).toBe(4);
    store2.close();
  });

  it('recovers automatically from a corrupted primary save using the rolling backup', async () => {
    const dbName = nextDb();
    const store = new SaveStore({ dbName, clock: () => 1_700_000_000_000 });
    await store.load();
    await store.mutate('buy', { key: seedKey('daisy'), qty: 1 }); // writes valid backup + new primary
    await store.mutate('buy', { key: seedKey('daisy'), qty: 1 });

    // Corrupt primary save checksum/payload
    await store._poke('save', { data: { broken: true }, sum: 999999, savedAt: 123 });
    store.close();

    const storeRecovered = new SaveStore({ dbName, clock: () => 1_700_000_010_000 });
    const rec = await storeRecovered.load();
    expect(storeRecovered.info.hadCorrupt).toBe(true);
    expect(storeRecovered.info.recovered).toBe('backup');
    expect(rec.tokens).toBe(27); // state from the rolling backup
    storeRecovered.close();
  });

  it('starts fresh gracefully if both primary and backup saves are corrupted', async () => {
    const dbName = nextDb();
    const store = new SaveStore({ dbName });
    await store._poke('save', 'not-an-envelope');
    await store._poke('save.bak', { data: null, sum: 0, savedAt: 0 });
    const state = await store.load();
    expect(store.info.hadCorrupt).toBe(true);
    expect(store.info.recovered).toBe('fresh');
    expect(state.tokens).toBe(30);
    store.close();
  });

  it('migrates legacy v0 saves (coins -> tokens) and rejects future schema versions', () => {
    const legacy = {
      coins: 75,
      stage: 1,
      objects: [],
      creatures: [{ id: 'mossi', name: 'Mossi', affection: 10 }],
    };
    const migrated = migrate(legacy);
    expect(migrated?.schema).toBe(2);
    expect(migrated?.tokens).toBe(75);
    const validated = validateState(legacy, 1_700_000_000_000);
    expect(validated?.tokens).toBe(75);
    expect(validated?.creatures[0].affection).toBe(10);

    // Future schema version is rejected rather than overwritten
    expect(validateState({ schema: 99, tokens: 10, objects: [] })).toBeNull();
  });

  it('validates export and import JSON backups thoroughly', async () => {
    const dbName = nextDb();
    const store = new SaveStore({ dbName });
    const s = await store.load();
    await store.mutate('renameCreature', { id: 'mossi', name: 'Sprout' });
    const current = (await store.refresh())!;

    const json = store.exportJson(current);
    const ok = previewImport(json);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.state.creatures[0].name).toBe('Sprout');

    expect(previewImport('{bad json').ok).toBe(false);
    expect(previewImport(JSON.stringify({ app: 'other', format: 1, state: current })).ok).toBe(false);
    expect(previewImport(JSON.stringify({ app: 'tinyworld', format: 99, state: current })).ok).toBe(false);
    expect(previewImport(JSON.stringify({ app: 'tinyworld', format: 1, state: { tokens: -5 } })).ok).toBe(false);
    store.close();
  });

  it('prevents duplicated rewards and lost updates when multiple surfaces mutate concurrently', async () => {
    const dbName = nextDb();
    const now = 1_700_000_000_000;
    const popupStore = new SaveStore({ dbName, clock: () => now });
    const fullStore = new SaveStore({ dbName, clock: () => now });
    await popupStore.load();
    await fullStore.load();

    // Seed one sparkle pickup worth 5 tokens
    await popupStore.mutateWith((s) => {
      s.pickups.push({ id: 'pk_shared', kind: 'sparkle', amount: 5, gx: 3, gy: 3, createdAt: now });
      return { ok: true, effects: [] };
    });
    const before = (await popupStore.refresh())!.tokens;

    // Both popup and full page try to collect the same pickup & buy items simultaneously
    const [r1, r2, b1, b2] = await Promise.all([
      popupStore.mutate('collectPickup', { id: 'pk_shared' }),
      fullStore.mutate('collectPickup', { id: 'pk_shared' }),
      popupStore.mutate('buy', { key: seedKey('daisy'), qty: 1 }),
      fullStore.mutate('buy', { key: seedKey('daisy'), qty: 1 }),
    ]);

    // Exactly one collectPickup succeeds; both purchases succeed serialized
    expect([r1.result.ok, r2.result.ok].filter(Boolean)).toHaveLength(1);
    expect(b1.result.ok).toBe(true);
    expect(b2.result.ok).toBe(true);

    const finalState = (await fullStore.refresh())!;
    expect(finalState.tokens).toBe(before + 5 - 3 - 3);
    expect(finalState.inventory[seedKey('daisy')]).toBe(2 + 2);
    popupStore.close();
    fullStore.close();
  });

  it('migrates v1 saves cleanly to schema v2 while preserving inventory, objects and unlocking ground clutter', () => {
    const v1Save = {
      schema: 1,
      tokens: 240,
      stage: 3,
      inventory: { 'seed:daisy': 4, 'decor:lantern': 2 },
      objects: [
        { id: 't1', type: 'tree_big', gx: 2, gy: 1, locked: true },
        { id: 'ss1', type: 'stepping_stones', gx: 4, gy: 4, locked: true },
        { id: 'mp1', type: 'mosaic_path', gx: 5, gy: 4, locked: true },
        { id: 'd1', type: 'bench', gx: 3, gy: 3, rot: 1 },
      ],
      creatures: [{ id: 'mossi', name: 'Mossi', affection: 22, discoveredAt: 100 }],
      settings: { sound: false, volume: 0.5, ambient: false, cycle: 'real', reducedMotion: false },
    };

    const migrated = migrate(v1Save);
    expect(migrated?.schema).toBe(2);
    expect(migrated?.tokens).toBe(240);
    expect(migrated?.stage).toBe(3);

    const validated = validateState(v1Save, 1_700_000_000_000)!;
    expect(validated).not.toBeNull();
    expect(validated.schema).toBe(2);
    expect(validated.tokens).toBe(240);
    expect(validated.inventory['decor:lantern']).toBe(2);
    // Ground clutter tiles unlocked in v2 while landmark tree stays locked
    expect(validated.objects.find((o) => o.id === 'ss1')?.locked).toBeFalsy();
    expect(validated.objects.find((o) => o.id === 'mp1')?.locked).toBeFalsy();
    expect(validated.objects.find((o) => o.id === 't1')?.locked).toBe(true);
    expect(validated.objects.find((o) => o.id === 'd1')?.rot).toBe(1);
    expect(validated.settings.weatherEnabled).toBe(true);
    expect(validated.settings.particleDensity).toBe('normal');
  });
});
