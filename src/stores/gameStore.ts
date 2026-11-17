import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { ACHIEVEMENTS, CREATURE_BY_ID, ITEM_BY_ID, PLANT_BY_ID, STAGES, TREAT_ID, decorKey, seedKey } from '../core/catalog';
import { effectiveEmotion, expansionStatus } from '../core/actions';
import { skyAt } from '../core/daycycle';
import { activeBiome, activeWeather, nextEventEtaMs } from '../core/events';
import { footprintCells, objDef } from '../core/grid';
import { canWater, isBlooming } from '../core/plants';
import { SaveStore } from '../core/persistence';
import { createInitialState } from '../core/state';
import type { ActionResult, CreatureId, CreatureInteractionKind, CycleMode, Effect, GameState, PlacedObject, PlantId, Settings } from '../core/types';
import { sound } from '../audio/sound';

export type SurfaceMode = 'popup' | 'sidepanel' | 'full';
export type ActiveTab = 'none' | 'inventory' | 'shop' | 'creatures' | 'journal' | 'achievements' | 'expand' | 'settings';

export type BuildMode =
  | { kind: 'none' }
  | { kind: 'place-item'; itemId: string; rot: 0 | 1 }
  | { kind: 'plant-seed'; plantId: PlantId }
  | { kind: 'move-object'; objectId: string; rot: 0 | 1 }
  | { kind: 'move-group'; objectIds: string[]; anchorGx: number; anchorGy: number };

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'achievement' | 'discover' | 'warn';
}

export const useGameStore = defineStore('game', () => {
  const reducedMotionDefault =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const saveStore = new SaveStore({ reducedMotion: reducedMotionDefault });
  const state = ref<GameState>(createInitialState(Date.now(), 1, reducedMotionDefault));
  const ready = ref(false);
  const surface = ref<SurfaceMode>('full');
  const activeTab = ref<ActiveTab>('none');
  const buildMode = ref<BuildMode>({ kind: 'none' });
  const cursorCell = ref<{ gx: number; gy: number }>({ gx: 3, gy: 3 });
  const selectedObjectId = ref<string | null>(null);
  const multiSelectMode = ref(false);
  const selectedObjectIds = ref<string[]>([]);
  const selectedCreatureId = ref<CreatureId | null>(null);
  const toasts = ref<ToastItem[]>([]);
  const welcomeLines = ref<string[]>([]);
  const nowTick = ref(Date.now());
  /** id of the 1s UI clock interval, so init() can never stack duplicates */
  let tickTimer: number | undefined;
  let toastSeq = 1;

  // Hook for the live Phaser scene to play immediate visual reactions & particles
  const worldHooks = shallowRef<{
    onEffects?: (fx: Effect[]) => void;
    onCreatureReact?: (id: CreatureId, kind: 'pet' | 'feed' | 'curious' | 'arrive' | 'spin' | 'play' | 'wave' | 'call' | 'cheer' | 'annoyed' | 'angry' | 'rest') => void;
    onCreatureAction?: (id: CreatureId, kind: CreatureInteractionKind, data?: Record<string, unknown>) => void;
    centerCamera?: () => void;
    focusCell?: (gx: number, gy: number) => void;
    zoomBy?: (delta: number) => void;
  }>({});

  const pushToast = (text: string, kind: ToastItem['kind'] = 'info', ms = 3400) => {
    const id = toastSeq++;
    toasts.value.push({ id, text, kind });
    if (toasts.value.length > 4) toasts.value.shift();
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const idx = toasts.value.findIndex((t) => t.id === id);
        if (idx >= 0) toasts.value.splice(idx, 1);
      }, ms);
    }
  }

  const handleEffects = (fx: Effect[]) => {
    for (const e of fx) {
      if (e.type === 'toast') pushToast(e.text, 'info');
      else if (e.type === 'achievement') {
        const def = ACHIEVEMENTS.find((a) => a.id === e.id);
        if (def) pushToast(`Achievement: ${def.name} (+${def.reward})`, 'achievement', 4500);
        sound.play('achievement');
      } else if (e.type === 'discover') {
        sound.play('discover');
      } else if (e.type === 'creature-arrived') {
        worldHooks.value.onCreatureReact?.(e.id, 'arrive');
      } else if (e.type === 'level-up') {
        const c = state.value.creatures.find((x) => x.id === e.creature);
        pushToast(`${c?.name ?? 'Pipkin'} reached Heart Level ${e.level}!`, 'achievement', 4000);
        sound.play('achievement');
      } else if (e.type === 'expanded') {
        const st = STAGES.find((s) => s.id === e.stage);
        pushToast(`Welcome to ${st?.name ?? 'your expanded island'}!`, 'achievement', 4800);
        sound.play('expand');
      } else if (e.type === 'welcome-back') {
        welcomeLines.value = e.lines;
      } else if (e.type === 'emotion') {
        if (e.emotion === 'angry' || e.emotion === 'annoyed') {
          worldHooks.value.onCreatureReact?.(e.creature, e.emotion);
        }
      }
    }
    worldHooks.value.onEffects?.(fx);
  }

  const init = async (mode: SurfaceMode) => {
    surface.value = mode;
    const loaded = await saveStore.load();
    state.value = loaded;
    sound.configure(state.value.settings);
    if (saveStore.info.recovered === 'backup') {
      pushToast('Recovered your island from backup save.', 'warn', 4500);
    } else if (saveStore.info.recovered === 'fresh' && saveStore.info.hadCorrupt) {
      pushToast(
        "Your island save was damaged and couldn't be recovered, so a fresh island was started. A copy of the damaged data was kept.",
        'warn',
        7000,
      );
    }
    const { state: woken, result } = await saveStore.mutate('wake');
    state.value = woken;
    sound.configure(state.value.settings);
    handleEffects(result.effects);
    ready.value = true;

    saveStore.onExternalChange((ext) => {
      state.value = ext;
      sound.configure(state.value.settings);
    });

    if (typeof window !== 'undefined') {
      // Guard against stacking a second clock if init() ever runs twice on one page.
      if (tickTimer !== undefined) window.clearInterval(tickTimer);
      tickTimer = window.setInterval(() => {
        nowTick.value = Date.now();
      }, 1000);
    }
  }

  const biome = computed(() => activeBiome(state.value));
  const sky = computed(() => skyAt(nowTick.value, state.value.settings.cycle, state.value.settings.manualHour, biome.value));
  const weather = computed(() => activeWeather(state.value, nowTick.value));
  const nextEventEta = computed(() => nextEventEtaMs(state.value, nowTick.value));
  const stageDef = computed(() => STAGES.find((s) => s.id === state.value.stage) ?? STAGES[0]);
  const expansion = computed(() => expansionStatus(state.value));
  const treatsCount = computed(() => state.value.inventory[TREAT_ID] ?? 0);
  const bloomingCount = computed(() => state.value.objects.filter((o) => o.plant && isBlooming(o, nowTick.value)).length);
  const waterableCount = computed(() => state.value.objects.filter((o) => o.plant && canWater(o, nowTick.value)).length);
  const plantCount = computed(() => state.value.objects.filter((o) => !!o.plant).length);
  const selectedCreature = computed(() =>
    state.value.creatures.find((c) => c.id === selectedCreatureId.value) ?? null,
  );
  const selectedCreatureEmotion = computed(() =>
    selectedCreature.value ? effectiveEmotion(selectedCreature.value, nowTick.value) : null,
  );
  const selectedObject = computed(() =>
    state.value.objects.find((o) => o.id === selectedObjectId.value) ?? null,
  );
  const selectedObjects = computed(() => {
    const idSet = new Set(selectedObjectIds.value);
    return state.value.objects.filter((o) => idSet.has(o.id));
  });

  // Advance onboarding tutorial steps automatically when objectives are met
  const checkTutorialAdvance = (actionName: string) => {
    const t = state.value.tutorial;
    if (t.done || t.skipped) return;
    // Fire-and-forget onboarding nudges: if storage briefly fails the step simply
    // re-advances on the next matching action, so failures are safely retriable.
    const advanceTutorial = (step: 3 | 4 | 5) => {
      void saveStore.mutate('setTutorial', { step }).then(
        (o) => (state.value = o.state),
        () => undefined,
      );
    };
    if (t.step === 2 && t.tappedTree && t.tappedPond && t.tappedCreature) {
      advanceTutorial(3);
    } else if (t.step === 3 && actionName === 'plantSeed') {
      advanceTutorial(4);
    } else if (t.step === 4 && (actionName === 'placeItem' || actionName === 'moveObject' || actionName === 'moveObjects')) {
      advanceTutorial(5);
    }
  }

  const act = async <K extends Parameters<SaveStore['mutate']>[0]>(
    name: K,
    payload?: Parameters<SaveStore['mutate']>[1],
  ): Promise<ActionResult> => {
    const { state: next, result } = await saveStore.mutate(name, payload);
    state.value = next;
    if (!result.ok) {
      if (result.reason) pushToast(result.reason, 'warn');
      sound.play('error');
      return result;
    }
    handleEffects(result.effects);
    checkTutorialAdvance(name);
    return result;
  }

  // Convenience actions with sound and UI state transitions
  const collectPickup = async (id: string) => {
    const r = await act('collectPickup', { id });
    if (r.ok) sound.play('collect');
    return r;
  }

  const toggleObjectInSelection = (id: string) => {
    const obj = state.value.objects.find((o) => o.id === id);
    if (!obj) return;
    const prevSingle =
      !multiSelectMode.value && selectedObjectId.value
        ? state.value.objects.find((o) => o.id === selectedObjectId.value)
        : undefined;
    multiSelectMode.value = true;
    selectedObjectId.value = null;
    selectedCreatureId.value = null;
    activeTab.value = 'none';

    if (prevSingle) {
      if (prevSingle.id === id) {
        selectedObjectIds.value = [id];
      } else {
        const base = new Set(selectedObjectIds.value);
        base.add(prevSingle.id);
        base.add(id);
        selectedObjectIds.value = [...base];
      }
      sound.play('click');
      return;
    }

    const exists = selectedObjectIds.value.includes(id);
    selectedObjectIds.value = exists
      ? selectedObjectIds.value.filter((x) => x !== id)
      : [...selectedObjectIds.value, id];
    sound.play('click');
  };

  const enterMultiSelect = (initialId?: string) => {
    const targetId = initialId ?? selectedObjectId.value ?? undefined;
    const obj = targetId ? state.value.objects.find((o) => o.id === targetId) : undefined;
    buildMode.value = { kind: 'none' };
    multiSelectMode.value = true;
    selectedObjectId.value = null;
    selectedCreatureId.value = null;
    activeTab.value = 'none';
    selectedObjectIds.value = obj ? [obj.id] : [];
    sound.play('click');
  };

  const selectSimilarObjects = () => {
    const cur = selectedObjects.value;
    if (!cur.length) return 0;
    const keyOf = (o: PlacedObject) => `${o.plant ? 'plant' : 'item'}:${o.type}`;
    const targets = new Set(cur.map(keyOf));
    const currentSet = new Set(selectedObjectIds.value);
    const additions = state.value.objects
      .filter((o) => targets.has(keyOf(o)) && !currentSet.has(o.id))
      .map((o) => o.id);
    if (!additions.length) return 0;
    selectedObjectIds.value = [...selectedObjectIds.value, ...additions];
    sound.play('click');
    return additions.length;
  };

  const clearMultiSelect = () => {
    selectedObjectIds.value = [];
    sound.play('click');
  };

  const exitMultiSelect = () => {
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    sound.play('click');
  };

  const tapObject = async (id: string, opts?: { multi?: boolean }) => {
    if (multiSelectMode.value || opts?.multi) {
      toggleObjectInSelection(id);
      return;
    }
    const obj = state.value.objects.find((o) => o.id === id);
    if (!obj) return;
    const wasSelected = selectedObjectId.value === id;
    selectedObjectId.value = id;
    selectedCreatureId.value = null;
    if (obj.plant) {
      if (isBlooming(obj, nowTick.value)) {
        await harvestPlant(id);
      } else if (wasSelected && canWater(obj, nowTick.value)) {
        await waterPlant(id);
      } else {
        sound.play('click');
      }
      return;
    }
    const tags = ITEM_BY_ID[obj.type]?.tags ?? [];
    if (tags.includes('tree') || tags.includes('bush')) {
      const r = await act('interact', { id });
      if (r.ok && r.data?.ready) sound.play('collect');
      else sound.play('click');
    } else {
      sound.play('click');
    }
  };

  const tapPond = async () => {
    sound.play('water');
    await act('tapPond');
  }

  const selectAndPetCreature = async (id: CreatureId) => {
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    selectedCreatureId.value = id;
    selectedObjectId.value = null;
    const r = await act('petCreature', { id });
    if (r.ok) {
      if (r.data?.annoyed) {
        sound.play('error');
        worldHooks.value.onCreatureAction?.(id, 'pet', r.data);
      } else {
        sound.play('pet');
        worldHooks.value.onCreatureReact?.(id, 'pet');
      }
    }
  };

  const feedCreature = async (id: CreatureId) => {
    const r = await act('feedCreature', { id });
    if (r.ok) {
      sound.play('feed');
      worldHooks.value.onCreatureReact?.(id, 'feed');
    }
  };

  const interactCreature = async (id: CreatureId, kind: CreatureInteractionKind) => {
    if (kind === 'pet') return selectAndPetCreature(id);
    if (kind === 'feed') return feedCreature(id);
    const r = await act('interactCreature', { id, kind });
    if (r.ok) {
      sound.play(kind === 'gift' || kind === 'cheer' ? 'collect' : 'click');
      if (r.data?.blockedByAnnoyance) {
        worldHooks.value.onCreatureReact?.(id, 'angry');
      } else {
        const reactKind = kind === 'observe' || kind === 'gift' || kind === 'follow' ? 'curious' : kind;
        worldHooks.value.onCreatureReact?.(id, reactKind);
      }
      worldHooks.value.onCreatureAction?.(id, kind, r.data);
    }
    return r;
  };

  const renameCreature = async (id: CreatureId, name: string) => {
    const r = await act('renameCreature', { id, name });
    if (r.ok) {
      sound.play('click');
      pushToast(`Renamed to ${name.trim()}!`);
    }
    return r;
  }

  const waterPlant = async (id: string) => {
    const r = await act('waterPlant', { id });
    if (r.ok) sound.play('water');
  };

  const waterAll = async () => {
    const r = await act('waterAll');
    if (r.ok) sound.play('water');
    return r;
  };

  const harvestPlant = async (id: string) => {
    const r = await act('harvestPlant', { id });
    if (r.ok) sound.play('harvest');
  };

  const harvestAll = async () => {
    const r = await act('harvestAll');
    if (r.ok) sound.play('harvest');
    return r;
  };

  const buyItem = async (key: string, qty = 1) => {
    const r = await act('buy', { key, qty });
    if (r.ok) {
      sound.play('collect');
      pushToast('Added to your bag!');
    }
    return r;
  };

  const sellItem = async (key: string, qty = 1) => {
    const r = await act('sellItem', { key, qty });
    if (r.ok) sound.play('collect');
    return r;
  };

  const startPlaceDecor = (itemId: string) => {
    buildMode.value = { kind: 'place-item', itemId, rot: 0 };
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    selectedObjectId.value = null;
    selectedCreatureId.value = null;
    activeTab.value = 'none';
    sound.play('click');
  }

  const startPlantSeed = (plantId: PlantId) => {
    buildMode.value = { kind: 'plant-seed', plantId };
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    selectedObjectId.value = null;
    selectedCreatureId.value = null;
    activeTab.value = 'none';
    sound.play('click');
  }

  const startMoveObject = (id: string) => {
    const o = state.value.objects.find((x) => x.id === id);
    if (!o) return;
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    selectedObjectId.value = null;
    activeTab.value = 'none';
    cursorCell.value = { gx: o.gx, gy: o.gy };
    buildMode.value = { kind: 'move-object', objectId: id, rot: o.rot };
    sound.play('click');
  }

  const startMoveSelected = () => {
    const objs = selectedObjects.value;
    if (!objs.length) return;
    if (objs.length === 1) {
      startMoveObject(objs[0].id);
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const o of objs) {
      for (const c of footprintCells(objDef(o), o.gx, o.gy, o.rot)) {
        if (c.gx < minX) minX = c.gx;
        if (c.gx > maxX) maxX = c.gx;
        if (c.gy < minY) minY = c.gy;
        if (c.gy > maxY) maxY = c.gy;
      }
    }
    const anchorGx = Math.round((minX + maxX) / 2);
    const anchorGy = Math.round((minY + maxY) / 2);
    multiSelectMode.value = false;
    selectedObjectId.value = null;
    activeTab.value = 'none';
    cursorCell.value = { gx: anchorGx, gy: anchorGy };
    buildMode.value = {
      kind: 'move-group',
      objectIds: objs.map((o) => o.id),
      anchorGx,
      anchorGy,
    };
    sound.play('click');
  };

  const rotatePlacement = () => {
    const bm = buildMode.value;
    if (bm.kind === 'place-item') {
      const def = ITEM_BY_ID[bm.itemId];
      if (!def?.rotatable) return;
      buildMode.value = { ...bm, rot: bm.rot === 1 ? 0 : 1 };
      sound.play('click');
    } else if (bm.kind === 'move-object') {
      const o = state.value.objects.find((x) => x.id === bm.objectId);
      const def = o && !o.plant ? ITEM_BY_ID[o.type] : undefined;
      if (!def?.rotatable) return;
      buildMode.value = { ...bm, rot: bm.rot === 1 ? 0 : 1 };
      sound.play('click');
    }
  };

  const cancelBuild = () => {
    const wasGroup = buildMode.value.kind === 'move-group';
    buildMode.value = { kind: 'none' };
    if (wasGroup && selectedObjects.value.length > 0) {
      multiSelectMode.value = true;
    } else {
      selectedObjectIds.value = [];
    }
    sound.play('click');
  }

  const commitPlacementAt = async (gx: number, gy: number) => {
    const bm = buildMode.value;
    if (bm.kind === 'place-item') {
      const r = await act('placeItem', { itemId: bm.itemId, gx, gy, rot: bm.rot });
      if (r.ok) {
        sound.play('place');
        // If player still has more of this item, keep placing; otherwise exit build mode
        if ((state.value.inventory[decorKey(bm.itemId)] ?? 0) <= 0) {
          buildMode.value = { kind: 'none' };
        }
      }
    } else if (bm.kind === 'plant-seed') {
      const r = await act('plantSeed', { plantId: bm.plantId, gx, gy });
      if (r.ok) {
        sound.play('place');
        if ((state.value.inventory[seedKey(bm.plantId)] ?? 0) <= 0) {
          buildMode.value = { kind: 'none' };
        }
      }
    } else if (bm.kind === 'move-object') {
      const r = await act('moveObject', { id: bm.objectId, gx, gy, rot: bm.rot });
      if (r.ok) {
        sound.play('place');
        buildMode.value = { kind: 'none' };
      }
    } else if (bm.kind === 'move-group') {
      const r = await act('moveObjects', {
        ids: bm.objectIds,
        dx: gx - bm.anchorGx,
        dy: gy - bm.anchorGy,
      });
      if (r.ok) {
        sound.play('place');
        buildMode.value = { kind: 'none' };
        multiSelectMode.value = false;
        selectedObjectIds.value = [];
      }
    }
  }

  const removeObject = async (id: string) => {
    const r = await act('removeObject', { id });
    if (r.ok) {
      sound.play('remove');
      if (selectedObjectId.value === id) selectedObjectId.value = null;
      selectedObjectIds.value = selectedObjectIds.value.filter((x) => x !== id);
      pushToast('Stored back in your bag.');
    }
  };

  const rotateObject = async (id: string) => {
    const r = await act('rotateObject', { id });
    if (r.ok) sound.play('click');
    return r;
  };

  const clearObstacle = async (id: string) => {
    const r = await act('clearObstacle', { id });
    if (r.ok) {
      sound.play('remove');
      if (selectedObjectId.value === id) selectedObjectId.value = null;
      selectedObjectIds.value = selectedObjectIds.value.filter((x) => x !== id);
    }
    return r;
  };

  const sellPlacedObject = async (id: string) => {
    const r = await act('sellPlacedObject', { id });
    if (r.ok) {
      sound.play('collect');
      if (selectedObjectId.value === id) selectedObjectId.value = null;
      selectedObjectIds.value = selectedObjectIds.value.filter((x) => x !== id);
    }
    return r;
  };

  const focusNextPickup = () => {
    const pk = state.value.pickups[0];
    if (!pk) return false;
    worldHooks.value.focusCell?.(pk.gx, pk.gy);
    sound.play('click');
    return true;
  };

  const setTimeOverride = async (cycle: CycleMode, manualHour: number | null = null) => {
    await updateSettings({ cycle, manualHour });
  };

  const updateSettings = async (patch: Partial<Settings>) => {
    const r = await act('setSettings', patch);
    if (r.ok) {
      sound.configure(state.value.settings);
      sound.play('click');
    }
  }

  const advanceTutorial = async (nextStep?: number, opts?: { skip?: boolean; replay?: boolean }) => {
    sound.play('click');
    if (opts?.replay) {
      await act('setTutorial', {
        step: 0,
        done: false,
        skipped: false,
        tappedTree: false,
        tappedPond: false,
        tappedCreature: false,
      });
      return;
    }
    if (opts?.skip) {
      await act('setTutorial', { done: true, skipped: true });
      return;
    }
    const step = nextStep ?? state.value.tutorial.step + 1;
    if (step >= 6) {
      await act('setTutorial', { step: 6, done: true });
    } else {
      await act('setTutorial', { step });
    }
  }

  const expandIsland = async () => {
    await act('expandIsland');
  }

  const maybeRollWorldEvent = async () => {
    await act('tickEvent', { night: sky.value.night > 0.5 });
  }

  const exportSave = (): string => {
    return saveStore.exportJson(state.value);
  }

  const previewImport = (json: string) => {
    return saveStore.previewImport(json);
  }

  const confirmImport = async (importedState: GameState) => {
    state.value = await saveStore.importState(importedState);
    sound.configure(state.value.settings);
    pushToast('Save data imported!', 'achievement');
  }

  const resetSave = async () => {
    state.value = await saveStore.reset();
    sound.configure(state.value.settings);
    selectedObjectId.value = null;
    multiSelectMode.value = false;
    selectedObjectIds.value = [];
    selectedCreatureId.value = null;
    buildMode.value = { kind: 'none' };
    pushToast('Started a fresh island.', 'info');
  }

  return {
    state,
    saveStore,
    ready,
    surface,
    activeTab,
    buildMode,
    cursorCell,
    selectedObjectId,
    multiSelectMode,
    selectedObjectIds,
    selectedCreatureId,
    selectedCreature,
    selectedObject,
    selectedObjects,
    toasts,
    welcomeLines,
    nowTick,
    biome,
    sky,
    weather,
    nextEventEta,
    stageDef,
    expansion,
    treatsCount,
    bloomingCount,
    waterableCount,
    plantCount,
    selectedCreatureEmotion,
    worldHooks,
    init,
    act,
    pushToast,
    collectPickup,
    tapObject,
    enterMultiSelect,
    toggleObjectInSelection,
    selectSimilarObjects,
    clearMultiSelect,
    exitMultiSelect,
    tapPond,
    selectAndPetCreature,
    feedCreature,
    interactCreature,
    renameCreature,
    waterPlant,
    waterAll,
    harvestPlant,
    harvestAll,
    buyItem,
    sellItem,
    startPlaceDecor,
    startPlantSeed,
    startMoveObject,
    startMoveSelected,
    rotatePlacement,
    rotateObject,
    cancelBuild,
    commitPlacementAt,
    removeObject,
    clearObstacle,
    sellPlacedObject,
    focusNextPickup,
    setTimeOverride,
    updateSettings,
    advanceTutorial,
    expandIsland,
    maybeRollWorldEvent,
    exportSave,
    previewImport,
    confirmImport,
    resetSave,
    PLANT_BY_ID,
    ITEM_BY_ID,
    CREATURE_BY_ID,
  };
});
