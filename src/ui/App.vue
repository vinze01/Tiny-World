<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ITEM_BY_ID,
  PLANT_BY_ID,
  PLANT_STAGE_NAMES,
  affectionLevel,
  obstacleClearCost,
  obstacleClearReward,
  resaleValue,
} from '../core/catalog';
import { effectiveEmotion } from '../core/actions';
import { WEATHER_META } from '../core/events';
import { canMoveObjects, footprintCells } from '../core/grid';
import { canWater, isBlooming, msToBloom, plantProgress, plantStage } from '../core/plants';
import type {
  BiomeId,
  CreatureInteractionKind,
  CycleMode,
  EmotionType,
  PlacedObject,
  PlantId,
} from '../core/types';
import { iconUrl } from '../art/atlas';
import WorldCanvas from '../game/WorldCanvas.vue';
import { useGameStore, type ActiveTab, type SurfaceMode } from '../stores/gameStore';
import CreaturesPanel from './CreaturesPanel.vue';
import InventoryShopDrawer from './InventoryShopDrawer.vue';
import JournalPanel from './JournalPanel.vue';
import OnboardingCard from './OnboardingCard.vue';
import SettingsModal from './SettingsModal.vue';

const props = defineProps<{ mode: SurfaceMode }>();
const store = useGameStore();

const showTimeMenu = ref(false);
const showMoreCreatureActions = ref(false);
const pendingConfirm = ref<null | 'clear' | 'sell'>(null);
// True when the island save could not be loaded (e.g. IndexedDB unavailable)
const initError = ref(false);

watch(
  () => store.selectedObjectId,
  () => {
    pendingConfirm.value = null;
  },
);

watch(
  () => store.selectedCreatureId,
  () => {
    showMoreCreatureActions.value = false;
  },
);

/** Escape closes any open panel — keyboard users shouldn't need the mouse to dismiss. */
const onWindowKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && store.activeTab !== 'none') {
    store.activeTab = 'none';
  }
};

const retryInit = () => {
  window.location.reload();
};

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
  // Storage failures (private mode, quota, corrupted environment) must surface to the
  // player instead of leaving a silent blank screen; the save itself is untouched.
  store.init(props.mode).catch(() => {
    initError.value = true;
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydown);
});

const toggleTab = (tab: ActiveTab) => {
  showTimeMenu.value = false;
  store.activeTab = store.activeTab === tab ? 'none' : tab;
};

const openFullWorld = () => {
  const url =
    typeof chrome !== 'undefined' && chrome.runtime?.getURL
      ? chrome.runtime.getURL('game.html')
      : 'game.html';
  window.open(url, '_blank');
};

const openSidePanel = async () => {
  try {
    if (typeof chrome !== 'undefined' && chrome.sidePanel?.open && chrome.windows?.getCurrent) {
      const win = await chrome.windows.getCurrent();
      if (win.id !== undefined) {
        await chrome.sidePanel.open({ windowId: win.id });
        return;
      }
    }
  } catch {
    // Fallback if sidePanel API requires user gesture or isn't supported in standalone tab
  }
  window.open('sidepanel.html', '_blank');
};

const phaseLabel = computed(() => {
  const p = store.sky.phase;
  if (p === 'morning') return '🌅 Morning';
  if (p === 'day') return '☀️ Daytime';
  if (p === 'sunset') return '🌇 Sunset';
  return '🌙 Night';
});

const weatherBadge = computed(() => {
  const meta = WEATHER_META[store.weather];
  return meta ? `${meta.icon} ${meta.label}` : String(store.weather);
});

const BIOME_NAMES: Record<BiomeId, string> = {
  meadow: 'Sunny Meadow',
  breeze: 'Blooming Grove',
  crystal: 'Crystal Pond',
  mist: 'Moonlit Garden',
  sky: 'Cloud Sanctuary',
  frostfall: 'Frostfall Haven',
  mistwood: 'Mistwood Hollow',
  emberglow: 'Emberglow Valley',
  starlight: 'Starlight Isles',
  everdream: 'Everdream Paradise',
};

const biomeLabel = computed(() => BIOME_NAMES[store.biome] ?? store.biome);

const etaLabel = computed(() => {
  const ms = Math.max(0, store.nextEventEta);
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec <= 1) return 'Soon';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const manualHourVal = computed(() => store.state.settings.manualHour ?? 12);

const formattedHour = computed(() => {
  const h = manualHourVal.value;
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
});

const setCyclePreset = (cycle: CycleMode, hour?: number) => {
  void store.setTimeOverride(cycle, hour ?? manualHourVal.value);
};

const onHourSlider = (ev: Event) => {
  const val = Number((ev.target as HTMLInputElement).value);
  void store.setTimeOverride('custom', val);
};

const cellsFor = (o: PlacedObject) => {
  const def = o.plant ? undefined : ITEM_BY_ID[o.type];
  return def ? footprintCells(def, o.gx, o.gy, o.rot ?? 0) : [{ gx: o.gx, gy: o.gy }];
};

const overlappingObject = computed(() => {
  const cur = store.selectedObject;
  if (!cur) return null;
  const curCells = new Set(cellsFor(cur).map((c) => `${c.gx},${c.gy}`));
  const other = store.state.objects.find(
    (o) => o.id !== cur.id && cellsFor(o).some((c) => curCells.has(`${c.gx},${c.gy}`)),
  );
  if (!other) return null;
  const label = other.plant
    ? PLANT_BY_ID[other.type as PlantId]?.name ?? other.type
    : ITEM_BY_ID[other.type]?.name ?? other.type;
  return { id: other.id, label };
});

const selectedPlantInfo = computed(() => {
  const o = store.selectedObject;
  if (!o?.plant) return null;
  const def = PLANT_BY_ID[o.type as PlantId];
  const stg = plantStage(o, store.nowTick);
  const pct = Math.round(plantProgress(o, store.nowTick) * 100);
  const remSec = Math.ceil(msToBloom(o, store.nowTick) / 1000);
  const remLabel =
    remSec <= 0 ? 'Ready to harvest!' : remSec >= 60 ? `${Math.ceil(remSec / 60)}m left` : `${remSec}s left`;
  return {
    id: o.id,
    name: def.name,
    stageName: PLANT_STAGE_NAMES[stg],
    pct,
    remLabel,
    blooming: isBlooming(o, store.nowTick),
    waterable: canWater(o, store.nowTick),
    yield: def.yield,
    icon: iconUrl(`plant:${def.id}`),
  };
});

const selectedDecorInfo = computed(() => {
  const o = store.selectedObject;
  if (!o || o.plant) return null;
  const def = ITEM_BY_ID[o.type];
  if (!def) return null;
  const clearCost = obstacleClearCost(o.type);
  const clearReward = o.locked ? obstacleClearReward(o.type) : null;
  const isProtected = !!def.protected || clearCost <= 0;
  const sellPrice = o.locked ? 0 : resaleValue(def.price);
  return {
    id: o.id,
    name: def.name,
    desc: def.desc,
    locked: !!o.locked,
    protected: isProtected,
    clearCost,
    clearReward,
    sellPrice,
    highValue: def.price >= 25,
    rotatable: def.rotatable,
    icon: iconUrl(`item:${def.id}`),
  };
});

const EMOTION_META: Record<EmotionType, { icon: string; label: string }> = {
  happy: { icon: '😊', label: 'Happy' },
  curious: { icon: '🧐', label: 'Curious' },
  sleepy: { icon: '😴', label: 'Sleepy' },
  excited: { icon: '✨', label: 'Excited' },
  shy: { icon: '🌸', label: 'Shy' },
  annoyed: { icon: '💢', label: 'Annoyed' },
  angry: { icon: '😤', label: 'Grumpy' },
  relaxed: { icon: '🌿', label: 'Relaxed' },
};

const creatureMood = computed(() => {
  const c = store.selectedCreature;
  if (!c) return null;
  const emo: EmotionType = store.selectedCreatureEmotion ?? effectiveEmotion(c, store.nowTick);
  const info = EMOTION_META[emo] ?? {
    icon: '✨',
    label: String(emo).charAt(0).toUpperCase() + String(emo).slice(1),
  };
  const recentPets = (c.petWindowTimestamps ?? []).filter((t) => store.nowTick - t <= 20_000).length;
  return {
    emotion: emo,
    icon: info.icon,
    label: info.label,
    annoyed: emo === 'annoyed' || emo === 'angry',
    nearAnnoyed: recentPets >= 3 && emo !== 'annoyed' && emo !== 'angry',
  };
});

const EXTRA_CREATURE_ACTIONS: { kind: CreatureInteractionKind; label: string }[] = [
  { kind: 'wave', label: '👋 Wave' },
  { kind: 'call', label: '📣 Call' },
  { kind: 'observe', label: '🔍 Observe' },
  { kind: 'gift', label: '🎁 Gift' },
  { kind: 'follow', label: '🐾 Follow' },
  { kind: 'rest', label: '😴 Rest' },
];

if (typeof window !== 'undefined') {
  // Test/dev bridge: exposed in dev builds and E2E runs (?e2e=1) only.
  // Production pages never receive a global handle into game state.
  if (!import.meta.env.PROD || new URLSearchParams(window.location.search).has('e2e')) {
    (window as unknown as { __twStore?: unknown }).__twStore = store;
  }
}

const canRotatePlacement = computed(() => {
  const bm = store.buildMode;
  if (bm.kind === 'place-item') return ITEM_BY_ID[bm.itemId]?.rotatable ?? false;
  if (bm.kind === 'move-object') {
    const o = store.state.objects.find((x) => x.id === bm.objectId);
    return o && !o.plant ? (ITEM_BY_ID[o.type]?.rotatable ?? false) : false;
  }
  return false;
});

const buildBannerLabel = computed(() => {
  const bm = store.buildMode;
  if (bm.kind === 'place-item') {
    const d = ITEM_BY_ID[bm.itemId];
    return `Placing ${d?.name ?? bm.itemId}`;
  }
  if (bm.kind === 'plant-seed') {
    const p = PLANT_BY_ID[bm.plantId];
    return `Planting ${p?.name ?? bm.plantId} Seed`;
  }
  if (bm.kind === 'move-object') {
    const o = store.state.objects.find((x) => x.id === bm.objectId);
    if (o?.plant) {
      const p = PLANT_BY_ID[o.type as PlantId];
      return `Moving ${p?.name ?? 'Plant'} (keeps growth)`;
    }
    const d = o ? ITEM_BY_ID[o.type] : undefined;
    return `Moving ${d?.name ?? 'item'} to a new tile`;
  }
  if (bm.kind === 'move-group') {
    return `Moving ${bm.objectIds.length} items together`;
  }
  return '';
});

const objectDisplayName = (o: PlacedObject) =>
  o.plant
    ? (PLANT_BY_ID[o.type as PlantId]?.name ?? o.type)
    : (ITEM_BY_ID[o.type]?.name ?? o.type);

const multiSelectSummary = computed(() => {
  const objs = store.selectedObjects;
  const count = objs.length;
  if (count === 0) {
    return {
      count: 0,
      summary: 'Click plants, trees, scenery, furniture, or buildings to select them',
      similarExtra: 0,
      similarLabel: '',
    };
  }
  const counts = new Map<string, { label: string; n: number }>();
  const targetKeys = new Set<string>();
  const selectedSet = new Set(objs.map((o) => o.id));
  for (const o of objs) {
    const k = `${o.plant ? 'plant' : 'item'}:${o.type}`;
    targetKeys.add(k);
    const prev = counts.get(k);
    if (prev) prev.n++;
    else counts.set(k, { label: objectDisplayName(o), n: 1 });
  }
  const entries = [...counts.values()];
  const head = entries
    .slice(0, 2)
    .map((e) => (entries.length === 1 || e.n > 1 ? `${e.n}× ${e.label}` : e.label))
    .join(', ');
  const summary = entries.length > 2 ? `${head} +${entries.length - 2} more` : head;

  const extraCount = store.state.objects.filter(
    (o) => !selectedSet.has(o.id) && targetKeys.has(`${o.plant ? 'plant' : 'item'}:${o.type}`),
  ).length;
  const similarLabel =
    entries.length === 1
      ? `+ All ${entries[0].label} (+${extraCount})`
      : `+ Same Type (+${extraCount})`;

  return { count, summary, similarExtra: extraCount, similarLabel };
});

const groupMoveStatus = computed(() => {
  const bm = store.buildMode;
  if (bm.kind !== 'move-group') return null;
  const idSet = new Set(bm.objectIds);
  const objs = store.state.objects.filter((o) => idSet.has(o.id));
  const chk = canMoveObjects(
    store.state,
    objs,
    store.cursorCell.gx - bm.anchorGx,
    store.cursorCell.gy - bm.anchorGy,
  );
  return {
    ok: chk.ok,
    text: chk.ok ? 'Valid spot' : `${chk.reason ?? 'Blocked'} (${chk.blockedIds.length})`,
  };
});
</script>

<template>
  <div class="app-shell" :class="`surface-${props.mode}`">
    <WorldCanvas v-if="store.ready" />

    <!-- Load-failure screen: keeps the player informed instead of a silent blank page -->
    <div v-if="initError" class="init-error-backdrop">
      <div class="init-error tw-panel" role="alert">
        <img class="init-error-icon" :src="iconUrl('ui:token')" alt="" width="36" height="36" />
        <h2 class="tw-title">Tiny World couldn't wake up</h2>
        <p>
          Your island lives in this browser's local storage, which isn't responding right now
          (private browsing or storage restrictions can cause this). Your saved progress has
          not been deleted.
        </p>
        <button type="button" class="tw-btn tw-btn-gold" @click="retryInit">Try Again</button>
      </div>
    </div>

    <!-- TOP HUD & QUICK GARDEN BAR -->
    <div class="hud-top-stack">
      <header class="hud-top">
        <div class="hud-row-main">
          <div class="hud-left">
            <button
              type="button"
              class="tw-panel stage-pill"
              :title="`${store.stageDef.name} (${biomeLabel}) — View Island Stage & Progression`"
              @click="toggleTab('expand')"
            >
              <span class="tw-title">{{ store.stageDef.name }}</span>
              <span class="sub-chip">Stage {{ store.state.stage }} · {{ biomeLabel }}</span>
            </button>
          </div>

          <div class="hud-right">
            <div class="tw-panel token-banner" aria-label="Nature Tokens balance">
              <img class="pixel-icon" :src="iconUrl('ui:token')" alt="Tokens" width="20" height="20" />
              <span class="token-val">{{ store.state.tokens.toLocaleString() }}</span>
            </div>

            <button
              v-if="props.mode === 'popup'"
              type="button"
              class="tw-btn tw-btn-gold"
              title="Open Side Panel"
              @click="openSidePanel"
            >
              Side Panel
            </button>
            <button
              v-if="props.mode !== 'full'"
              type="button"
              class="tw-btn tw-btn-primary"
              title="Open Full-Page Tiny World"
              @click="openFullWorld"
            >
              Full World ↗
            </button>
          </div>
        </div>

        <div class="hud-status-strip">
          <div class="time-weather-pair">
            <div class="time-ctrl-wrap">
              <button
                type="button"
                class="mini-pill clickable"
                title="Adjust Time of Day Preview"
                @click="showTimeMenu = !showTimeMenu"
              >
                {{ phaseLabel }}
                <span v-if="store.state.settings.cycle !== 'real'" class="override-dot">
                  ·
                  {{
                    store.state.settings.cycle === 'custom'
                      ? formattedHour
                      : store.state.settings.cycle === 'fast'
                        ? 'Fast'
                        : 'Fixed'
                  }}
                </span>
              </button>

              <div v-if="showTimeMenu" class="tw-panel time-popover" role="dialog" aria-label="Time Preview Controls">
                <div class="popover-head">
                  <strong class="tw-title">Sky &amp; Time Preview</strong>
                  <button type="button" class="tw-btn tw-btn-sm" aria-label="Close time controls" @click="showTimeMenu = false">
                    ✕
                  </button>
                </div>
                <div class="preset-grid">
                  <button
                    type="button"
                    class="tw-btn tw-btn-sm"
                    :class="{ 'tw-btn-gold': store.state.settings.cycle === 'real' }"
                    @click="setCyclePreset('real')"
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    class="tw-btn tw-btn-sm"
                    :class="{ 'tw-btn-gold': store.state.settings.cycle === 'custom' && Math.abs(manualHourVal - 7.5) < 0.6 }"
                    @click="setCyclePreset('custom', 7.5)"
                  >
                    🌅 Morning
                  </button>
                  <button
                    type="button"
                    class="tw-btn tw-btn-sm"
                    :class="{ 'tw-btn-gold': store.state.settings.cycle === 'day' }"
                    @click="setCyclePreset('day', 13)"
                  >
                    ☀️ Daytime
                  </button>
                  <button
                    type="button"
                    class="tw-btn tw-btn-sm"
                    :class="{ 'tw-btn-gold': store.state.settings.cycle === 'custom' && Math.abs(manualHourVal - 18.25) < 0.6 }"
                    @click="setCyclePreset('custom', 18.25)"
                  >
                    🌇 Sunset
                  </button>
                  <button
                    type="button"
                    class="tw-btn tw-btn-sm"
                    :class="{ 'tw-btn-gold': store.state.settings.cycle === 'night' }"
                    @click="setCyclePreset('night', 22.5)"
                  >
                    🌙 Night
                  </button>
                </div>
                <label class="hour-slider-row">
                  <span>Hour: <strong>{{ formattedHour }}</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="23.75"
                    step="0.25"
                    aria-label="Manual sky hour slider"
                    :value="manualHourVal"
                    @input="onHourSlider"
                  />
                </label>
                <small class="time-note">Visual preview only · Plant growth &amp; Night Owl stay real-time.</small>
              </div>
            </div>

            <span class="mini-pill" :title="`Weather in ${biomeLabel}`">
              {{ weatherBadge }}
            </span>
          </div>

          <button
            v-if="store.state.pickups.length"
            type="button"
            class="pickup-alert active clickable"
            title="Click to focus next sparkle on the island"
            @click="store.focusNextPickup()"
          >
            ✨ {{ store.state.pickups.length }} waiting
          </button>
          <span v-else class="pickup-alert idle" title="Time until the next island sparkle">
            ✨
            <template v-if="props.mode === 'full'">
              {{ etaLabel === 'Soon' ? 'Next sparkle soon' : `Next sparkle in ${etaLabel}` }}
            </template>
            <template v-else>{{ etaLabel }}</template>
          </span>
        </div>
      </header>

      <!-- GARDEN QUICK BAR -->
      <div
        v-if="store.plantCount > 0 && store.activeTab === 'none' && store.buildMode.kind === 'none' && !store.multiSelectMode"
        class="tw-panel garden-bar"
        role="region"
        aria-label="Garden quick actions"
      >
        <button
          type="button"
          class="tw-btn tw-btn-sm tw-btn-gold"
          :disabled="store.bloomingCount === 0"
          @click="store.harvestAll()"
        >
          🌸 Harvest All ({{ store.bloomingCount }})
        </button>
        <button
          type="button"
          class="tw-btn tw-btn-sm tw-btn-primary"
          :disabled="store.waterableCount === 0"
          @click="store.waterAll()"
        >
          💧 Water All ({{ store.waterableCount }})
        </button>
      </div>
    </div>

    <!-- WELCOME BACK BANNER -->
    <div v-if="store.welcomeLines.length" class="tw-panel welcome-toast" role="status">
      <div>
        <strong class="tw-title">Welcome back to your island!</strong>
        <ul>
          <li v-for="(line, i) in store.welcomeLines" :key="i">{{ line }}</li>
        </ul>
      </div>
      <button type="button" class="tw-btn" @click="store.welcomeLines = []">Got it</button>
    </div>

    <!-- TOAST NOTIFICATIONS -->
    <div class="toast-stack" aria-live="polite">
      <div v-for="t in store.toasts" :key="t.id" class="tw-panel toast-item" :class="t.kind">
        {{ t.text }}
      </div>
    </div>

    <!-- ONBOARDING CARD -->
    <div class="onboard-slot">
      <OnboardingCard v-if="store.ready && store.activeTab === 'none'" />
    </div>

    <!-- BUILD / PLACEMENT TOOLBAR -->
    <div v-if="store.buildMode.kind !== 'none'" class="tw-panel build-bar" role="region" aria-label="Placement controls">
      <div class="build-head">
        <span class="build-title">{{ buildBannerLabel }}</span>
        <span
          v-if="groupMoveStatus"
          class="group-status-pill"
          :class="groupMoveStatus.ok ? 'ok' : 'blocked'"
        >
          {{ groupMoveStatus.text }}
        </span>
      </div>
      <div class="build-btns">
        <button
          type="button"
          class="tw-btn tw-btn-primary"
          @click="store.commitPlacementAt(store.cursorCell.gx, store.cursorCell.gy)"
        >
          ✓ Place Here ({{ store.cursorCell.gx }},{{ store.cursorCell.gy }})
        </button>
        <button
          v-if="canRotatePlacement"
          type="button"
          class="tw-btn"
          @click="store.rotatePlacement()"
        >
          ↻ Rotate (R)
        </button>
        <button type="button" class="tw-btn" @click="store.cancelBuild()">Cancel (Esc)</button>
      </div>
    </div>

    <!-- MULTI-SELECT BAR -->
    <div
      v-else-if="store.multiSelectMode && store.activeTab === 'none'"
      class="tw-panel inspector-bar multi-bar"
      role="region"
      aria-label="Multi-select objects"
    >
      <div class="insp-meta">
        <strong>Multi-Select ({{ multiSelectSummary.count }})</strong>
        <small>{{ multiSelectSummary.summary }}</small>
      </div>
      <div class="insp-actions">
        <button
          type="button"
          class="tw-btn tw-btn-primary"
          :disabled="multiSelectSummary.count === 0"
          @click="store.startMoveSelected()"
        >
          Move ({{ multiSelectSummary.count }})
        </button>
        <button
          v-if="multiSelectSummary.similarExtra > 0"
          type="button"
          class="tw-btn tw-btn-gold"
          @click="store.selectSimilarObjects()"
        >
          {{ multiSelectSummary.similarLabel }}
        </button>
        <button
          v-if="multiSelectSummary.count > 0"
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.clearMultiSelect()"
        >
          Clear
        </button>
        <button type="button" class="tw-btn" aria-label="Exit multi-select" @click="store.exitMultiSelect()">
          Done
        </button>
      </div>
    </div>

    <!-- OBJECT / PLANT / CREATURE INSPECTOR -->
    <div
      v-else-if="selectedPlantInfo && store.activeTab === 'none'"
      class="tw-panel inspector-bar"
      role="region"
      aria-label="Selected plant"
    >
      <img class="pixel-icon" :src="selectedPlantInfo.icon" :alt="selectedPlantInfo.name" width="32" height="32" />
      <div class="insp-meta">
        <strong>{{ selectedPlantInfo.name }}</strong>
        <small>{{ selectedPlantInfo.stageName }} ({{ selectedPlantInfo.pct }}%) · {{ selectedPlantInfo.remLabel }}</small>
      </div>
      <div class="insp-actions">
        <button
          v-if="selectedPlantInfo.blooming"
          type="button"
          class="tw-btn tw-btn-gold"
          @click="store.harvestPlant(selectedPlantInfo.id)"
        >
          🌸 Harvest (+{{ selectedPlantInfo.yield }})
        </button>
        <button
          v-else
          type="button"
          class="tw-btn tw-btn-primary"
          :disabled="!selectedPlantInfo.waterable"
          @click="store.waterPlant(selectedPlantInfo.id)"
        >
          💧 Water
        </button>
        <button
          type="button"
          class="tw-btn"
          title="Move plant to another soil tile without uprooting"
          @click="store.startMoveObject(selectedPlantInfo.id)"
        >
          Move
        </button>
        <button
          type="button"
          class="tw-btn"
          title="Select multiple objects or plants to move together"
          @click="store.enterMultiSelect(selectedPlantInfo.id)"
        >
          Multi-Select
        </button>
        <button type="button" class="tw-btn" @click="store.removeObject(selectedPlantInfo.id)">Uproot</button>
        <button
          v-if="overlappingObject"
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.selectedObjectId = overlappingObject.id"
        >
          ⇄ {{ overlappingObject.label }}
        </button>
        <button type="button" class="tw-btn" aria-label="Close inspector" @click="store.selectedObjectId = null">✕</button>
      </div>
    </div>

    <div
      v-else-if="selectedDecorInfo && store.activeTab === 'none'"
      class="tw-panel inspector-bar"
      role="region"
      aria-label="Selected object"
    >
      <img class="pixel-icon" :src="selectedDecorInfo.icon" :alt="selectedDecorInfo.name" width="32" height="32" />
      <div class="insp-meta">
        <strong>{{ selectedDecorInfo.name }}</strong>
        <small>{{ selectedDecorInfo.desc }}</small>
        <small
          v-if="selectedDecorInfo.locked && !selectedDecorInfo.protected && selectedDecorInfo.clearReward"
          class="clear-reward-hint"
        >
          Clear reward: +1 {{ selectedDecorInfo.clearReward.label }} → Bag
        </small>
      </div>
      <div class="insp-actions">
        <button
          v-if="selectedDecorInfo.rotatable"
          type="button"
          class="tw-btn"
          @click="store.rotateObject(selectedDecorInfo.id)"
        >
          ↻ Rotate
        </button>
        <button type="button" class="tw-btn" @click="store.startMoveObject(selectedDecorInfo.id)">Move</button>
        <button
          type="button"
          class="tw-btn"
          title="Select multiple objects to move together"
          @click="store.enterMultiSelect(selectedDecorInfo.id)"
        >
          Multi-Select
        </button>

        <template v-if="selectedDecorInfo.locked">
          <span v-if="selectedDecorInfo.protected" class="locked-chip">Essential Landmark · Protected</span>
          <template v-else-if="pendingConfirm === 'clear'">
            <button
              type="button"
              class="tw-btn tw-btn-danger"
              :disabled="store.state.tokens < selectedDecorInfo.clearCost"
              @click="
                store.clearObstacle(selectedDecorInfo.id);
                pendingConfirm = null;
              "
            >
              Confirm Clear (-{{ selectedDecorInfo.clearCost }} 🪙<template v-if="selectedDecorInfo.clearReward"> · +{{ selectedDecorInfo.clearReward.label }}</template>)
            </button>
            <button type="button" class="tw-btn" @click="pendingConfirm = null">Cancel</button>
          </template>
          <button
            v-else
            type="button"
            class="tw-btn tw-btn-gold"
            :disabled="store.state.tokens < selectedDecorInfo.clearCost"
            :title="
              selectedDecorInfo.clearReward
                ? `Clear for ${selectedDecorInfo.clearCost} Tokens and keep +1 ${selectedDecorInfo.clearReward.label} in Bag`
                : `Clear for ${selectedDecorInfo.clearCost} Tokens`
            "
            @click="pendingConfirm = 'clear'"
          >
            🪓 Clear (-{{ selectedDecorInfo.clearCost }} 🪙)
          </button>
        </template>

        <template v-else>
          <button type="button" class="tw-btn" @click="store.removeObject(selectedDecorInfo.id)">Store</button>
          <template v-if="selectedDecorInfo.sellPrice > 0">
            <template v-if="selectedDecorInfo.highValue && pendingConfirm === 'sell'">
              <button
                type="button"
                class="tw-btn tw-btn-danger"
                @click="
                  store.sellPlacedObject(selectedDecorInfo.id);
                  pendingConfirm = null;
                "
              >
                Confirm Sell (+{{ selectedDecorInfo.sellPrice }} 🪙)
              </button>
              <button type="button" class="tw-btn" @click="pendingConfirm = null">Cancel</button>
            </template>
            <button
              v-else
              type="button"
              class="tw-btn tw-btn-gold"
              @click="
                selectedDecorInfo.highValue
                  ? (pendingConfirm = 'sell')
                  : store.sellPlacedObject(selectedDecorInfo.id)
              "
            >
              💰 Sell (+{{ selectedDecorInfo.sellPrice }})
            </button>
          </template>
        </template>

        <button
          v-if="overlappingObject"
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.selectedObjectId = overlappingObject.id"
        >
          ⇄ {{ overlappingObject.label }}
        </button>
        <button type="button" class="tw-btn" aria-label="Close inspector" @click="store.selectedObjectId = null">✕</button>
      </div>
    </div>

    <div
      v-else-if="store.selectedCreature && store.activeTab === 'none'"
      class="tw-panel inspector-bar creature-inspector"
      role="region"
      aria-label="Selected Pipkin"
    >
      <img
        class="pixel-icon"
        :src="iconUrl(`creature:${store.selectedCreature.id}`)"
        :alt="store.selectedCreature.name"
        width="34"
        height="34"
      />
      <div class="insp-meta">
        <div class="creature-head-line">
          <strong>{{ store.selectedCreature.name }} ♥ Lv.{{ affectionLevel(store.selectedCreature.affection) }}</strong>
          <span
            v-if="creatureMood"
            class="mood-pill"
            :class="{ annoyed: creatureMood.annoyed, warn: creatureMood.nearAnnoyed }"
          >
            {{ creatureMood.icon }} {{ creatureMood.label }}
          </span>
        </div>
        <small v-if="creatureMood?.annoyed" class="soothe-hint">
          Needs space — try Cheer, Berry Treat, or Rest to soothe.
        </small>
        <small v-else>{{ store.CREATURE_BY_ID[store.selectedCreature.id].likes }}</small>
      </div>
      <div class="insp-actions">
        <button
          type="button"
          class="tw-btn tw-btn-gold"
          @click="store.selectAndPetCreature(store.selectedCreature.id)"
        >
          ♥ Pet
        </button>
        <button
          type="button"
          class="tw-btn tw-btn-primary"
          :disabled="store.treatsCount < 1"
          @click="store.feedCreature(store.selectedCreature.id)"
        >
          🍓 Feed ({{ store.treatsCount }})
        </button>
        <button
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.interactCreature(store.selectedCreature.id, 'cheer')"
        >
          ✨ Cheer
        </button>
        <button
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.interactCreature(store.selectedCreature.id, 'play')"
        >
          🎲 Play
        </button>
        <button
          type="button"
          class="tw-btn tw-btn-sm"
          @click="showMoreCreatureActions = !showMoreCreatureActions"
        >
          {{ showMoreCreatureActions ? 'Less ▴' : 'More ▾' }}
        </button>
        <button type="button" class="tw-btn tw-btn-sm" @click="store.activeTab = 'creatures'">Details</button>
        <button type="button" class="tw-btn tw-btn-sm" aria-label="Close inspector" @click="store.selectedCreatureId = null">✕</button>
      </div>
      <div v-if="showMoreCreatureActions" class="extra-creature-actions">
        <button
          v-for="act in EXTRA_CREATURE_ACTIONS"
          :key="act.kind"
          type="button"
          class="tw-btn tw-btn-sm"
          @click="store.interactCreature(store.selectedCreature.id, act.kind)"
        >
          {{ act.label }}
        </button>
      </div>
    </div>

    <!-- MODAL / DRAWER OVERLAY -->
    <div v-if="store.activeTab !== 'none'" class="panel-overlay" @click.self="store.activeTab = 'none'">
      <InventoryShopDrawer
        v-if="store.activeTab === 'inventory' || store.activeTab === 'shop'"
        :mode="store.activeTab"
      />
      <CreaturesPanel v-else-if="store.activeTab === 'creatures'" />
      <JournalPanel
        v-else-if="
          store.activeTab === 'journal' ||
          store.activeTab === 'achievements' ||
          store.activeTab === 'expand'
        "
        :initial-view="store.activeTab"
      />
      <SettingsModal v-else-if="store.activeTab === 'settings'" />
    </div>

    <!-- BOTTOM DOCK -->
    <nav class="hud-bottom" aria-label="Game Menu">
      <div class="tw-panel dock">
        <button
          type="button"
          class="tw-btn dock-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'inventory' }"
          @click="toggleTab('inventory')"
        >
          🎒 Bag
        </button>
        <button
          type="button"
          class="tw-btn dock-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'shop' }"
          @click="toggleTab('shop')"
        >
          🏪 Shop
        </button>
        <button
          type="button"
          class="tw-btn dock-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'creatures' }"
          @click="toggleTab('creatures')"
        >
          🐾 Pipkins
        </button>
        <button
          type="button"
          class="tw-btn dock-btn"
          :class="{
            'tw-btn-gold':
              store.activeTab === 'journal' ||
              store.activeTab === 'achievements' ||
              store.activeTab === 'expand',
          }"
          @click="toggleTab('journal')"
        >
          📖 Journal
        </button>
        <button
          type="button"
          class="tw-btn dock-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'settings' }"
          aria-label="Settings"
          @click="toggleTab('settings')"
        >
          ⚙️
        </button>
      </div>

      <div v-if="props.mode !== 'popup'" class="cam-controls">
        <button type="button" class="tw-btn" title="Zoom In" aria-label="Zoom In" @click="store.worldHooks.zoomBy?.(0.3)">
          ＋
        </button>
        <button type="button" class="tw-btn" title="Zoom Out" aria-label="Zoom Out" @click="store.worldHooks.zoomBy?.(-0.3)">
          －
        </button>
        <button type="button" class="tw-btn" title="Center Island" aria-label="Center Island" @click="store.worldHooks.centerCamera?.()">
          ⌖
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* Load-failure screen */
.init-error-backdrop {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(26, 22, 38, 0.82);
}
.init-error {
  max-width: 420px;
  padding: 24px 26px;
  text-align: center;
  display: grid;
  gap: 12px;
  justify-items: center;
}
.init-error p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-soft);
}
.init-error-icon {
  image-rendering: pixelated;
}

.app-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.hud-top-stack {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  pointer-events: none;
  z-index: 25;
}
.hud-top {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 7px;
  pointer-events: none;
}
.hud-row-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.hud-left,
.hud-right,
.hud-status-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  pointer-events: auto;
  flex-wrap: wrap;
}
.hud-right {
  margin-left: auto;
  flex-wrap: nowrap;
}
.stage-pill {
  padding: 5px 11px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  cursor: pointer;
}
.stage-pill .tw-title {
  font-size: 14px;
  line-height: 1.1;
}
.sub-chip {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-soft);
}
.time-weather-pair {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 6px;
  min-width: 278px;
}
.time-weather-pair .time-ctrl-wrap > .mini-pill,
.time-weather-pair > .mini-pill {
  width: 100%;
}
.mini-pill,
.pickup-alert {
  background: rgba(255, 248, 224, 0.94);
  border: 2px solid var(--wood-dark);
  border-radius: 999px;
  padding: 4px 10px;
  min-height: 28px;
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 800;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  gap: 4px;
}
.pickup-alert.active {
  background: linear-gradient(180deg, #fff5c8 0%, #f5dc82 100%);
}
.pickup-alert.idle {
  opacity: 0.9;
}
.clickable {
  cursor: pointer;
  transition: transform 0.08s ease, filter 0.12s ease;
}
.clickable:hover {
  filter: brightness(1.04);
}
.clickable:active {
  transform: translateY(1px);
}
.override-dot {
  color: var(--forest-dark);
  font-weight: 800;
}
.time-ctrl-wrap {
  position: relative;
}
.time-popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: min(290px, 88vw);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 38;
}
.popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.hour-slider-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.hour-slider-row input[type='range'] {
  width: 100%;
  accent-color: var(--forest);
}
.time-note {
  font-size: 10.5px;
  color: var(--ink-soft);
  line-height: 1.25;
}
.token-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
}
.token-val {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--wood-dark);
}
.garden-bar {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 6px;
  min-width: 278px;
  padding: 6px 8px;
  pointer-events: auto;
}
.garden-bar .tw-btn {
  width: 100%;
  min-height: 28px;
  padding: 4px 10px;
  font-size: 11.5px;
  white-space: nowrap;
  justify-content: center;
}
.welcome-toast {
  position: absolute;
  top: 132px;
  left: 50%;
  transform: translateX(-50%);
  width: min(420px, 92vw);
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  z-index: 30;
  font-size: 12.5px;
}
.welcome-toast ul {
  margin: 4px 0 0;
  padding-left: 18px;
}
.toast-stack {
  position: absolute;
  top: 54px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 35;
  pointer-events: none;
  max-width: min(300px, 72vw);
}
.toast-item {
  padding: 6px 11px;
  font-size: 12px;
  font-weight: 800;
}
.toast-item.achievement {
  background: linear-gradient(180deg, #fff5cc 0%, #f3d678 100%);
}
.toast-item.warn {
  border-color: var(--danger);
}
.onboard-slot {
  position: absolute;
  left: 10px;
  bottom: 64px;
  z-index: 22;
  pointer-events: none;
}
.build-bar,
.inspector-bar {
  position: absolute;
  left: 50%;
  bottom: 62px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  padding: 7px 12px;
  max-width: 95vw;
  z-index: 25;
}
.creature-inspector {
  max-width: min(560px, 95vw);
}
.creature-head-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.mood-pill {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e5f2e1;
  color: var(--forest-dark);
  border: 1px solid var(--forest);
}
.mood-pill.warn {
  background: #fff2cc;
  color: #7c5800;
  border-color: var(--gold-dark);
}
.mood-pill.annoyed {
  background: #fde3e3;
  color: #8f2323;
  border-color: var(--danger);
}
.soothe-hint {
  color: #9e2a2a !important;
  font-weight: 700;
}
.locked-chip {
  font-size: 11px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--cream-lo);
  color: var(--ink-soft);
}
.clear-reward-hint {
  display: block;
  color: var(--forest-dark);
  font-weight: 700;
}
.extra-creature-actions {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-top: 4px;
  border-top: 1px dashed var(--wood);
}
.build-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.build-title {
  font-weight: 800;
  font-size: 13px;
}
.group-status-pill {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--wood-dark);
}
.group-status-pill.ok {
  background: #e5f2e1;
  color: var(--forest-dark);
  border-color: var(--forest);
}
.group-status-pill.blocked {
  background: #fde3e3;
  color: #8f2323;
  border-color: var(--danger);
}
.multi-bar {
  max-width: min(620px, 95vw);
}
.build-btns,
.insp-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.insp-meta {
  display: flex;
  flex-direction: column;
  min-width: 110px;
  flex: 1 1 130px;
}
.insp-meta strong {
  font-size: 13px;
}
.insp-meta small {
  font-size: 11px;
  color: var(--ink-soft);
}
.panel-overlay {
  position: absolute;
  inset: 0;
  background: rgba(16, 20, 30, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 10px;
}
.hud-bottom {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  z-index: 20;
}
.dock {
  display: flex;
  gap: 5px;
  padding: 5px 7px;
  pointer-events: auto;
}
.dock-btn {
  padding: 6px 10px;
  font-size: 12.5px;
}
.cam-controls {
  display: flex;
  gap: 4px;
  pointer-events: auto;
}

/* Compact popup (420px) & side panel (380px) overrides so HUD controls stay evenly sized without overlap */
.surface-popup .hud-top-stack,
.surface-sidepanel .hud-top-stack {
  top: 6px;
  left: 6px;
  right: 6px;
  gap: 8px;
}
.surface-popup .hud-top,
.surface-sidepanel .hud-top {
  gap: 6px;
}
.surface-popup .stage-pill,
.surface-sidepanel .stage-pill {
  padding: 4px 8px;
}
.surface-popup .stage-pill .tw-title,
.surface-sidepanel .stage-pill .tw-title {
  font-size: 12px;
  white-space: nowrap;
}
.surface-popup .sub-chip,
.surface-sidepanel .sub-chip {
  font-size: 9.5px;
  white-space: nowrap;
}
.surface-popup .hud-right,
.surface-sidepanel .hud-right {
  gap: 4px;
}
.surface-popup .token-banner,
.surface-sidepanel .token-banner {
  padding: 3px 8px;
}
.surface-popup .token-val,
.surface-sidepanel .token-val {
  font-size: 13.5px;
}
.surface-popup .hud-right .tw-btn,
.surface-sidepanel .hud-right .tw-btn {
  padding: 4px 7px;
  font-size: 11px;
  white-space: nowrap;
}
.surface-popup .time-weather-pair,
.surface-sidepanel .time-weather-pair {
  min-width: 248px;
  gap: 5px;
}
.surface-popup .mini-pill,
.surface-popup .pickup-alert,
.surface-sidepanel .mini-pill,
.surface-sidepanel .pickup-alert {
  padding: 3px 8px;
  min-height: 26px;
  font-size: 11px;
}
.surface-popup .garden-bar,
.surface-sidepanel .garden-bar {
  min-width: 248px;
  padding: 5px 7px;
  gap: 5px;
}
.surface-popup .garden-bar .tw-btn,
.surface-sidepanel .garden-bar .tw-btn {
  min-height: 26px;
  padding: 4px 6px;
  font-size: 11px;
}
.surface-popup .welcome-toast,
.surface-sidepanel .welcome-toast {
  top: 136px;
}
.surface-popup .toast-stack,
.surface-sidepanel .toast-stack {
  top: 136px;
  right: 6px;
  max-width: 240px;
}
.surface-popup .toast-item,
.surface-sidepanel .toast-item {
  font-size: 11px;
  padding: 4px 8px;
}
.surface-popup .dock-btn,
.surface-sidepanel .dock-btn {
  padding: 5px 7px;
  font-size: 11.5px;
}
</style>
