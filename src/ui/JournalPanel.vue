<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  ACHIEVEMENTS,
  CREATURES,
  EVENTS,
  ITEMS,
  MAX_PLAYABLE_STAGE,
  PLANTS,
  STAGES,
} from '../core/catalog';
import type { BiomeId } from '../core/types';
import { iconUrl } from '../art/atlas';
import { useGameStore } from '../stores/gameStore';

const props = defineProps<{ initialView?: 'journal' | 'achievements' | 'expand' }>();
const store = useGameStore();
const sub = ref<'journal' | 'achievements' | 'expand'>(props.initialView ?? 'journal');

const STAGE_GRIDS: Record<number, string> = {
  1: '8×8',
  2: '12×12',
  3: '16×16',
  4: '20×20',
  5: '24×24',
  6: '26×26',
  7: '28×28',
  8: '30×30',
  9: '32×32',
  10: '36×36',
};

const BIOME_LABELS: Record<BiomeId, string> = {
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

const fmtDate = (ts?: number): string => {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString();
};

const journalGroups = computed(() => {
  const d = store.state.discovered;
  return [
    {
      title: 'Pipkins',
      items: CREATURES.map((c) => ({
        id: `creature:${c.id}`,
        name: c.name,
        desc: c.desc,
        icon: iconUrl(`creature:${c.id}`),
        foundAt: d[`creature:${c.id}`],
      })),
    },
    {
      title: 'Garden Plants',
      items: PLANTS.map((p) => ({
        id: `plant:${p.id}`,
        name: p.name,
        desc: p.desc,
        icon: iconUrl(`plant:${p.id}`),
        foundAt: d[`plant:${p.id}`],
      })),
    },
    {
      title: 'Island Decorations & Scenery',
      items: ITEMS.filter((i) => !['rock', 'wildflowers'].includes(i.id)).map((i) => ({
        id: `item:${i.id}`,
        name: i.name,
        desc: i.desc,
        icon: iconUrl(`item:${i.id}`),
        foundAt: d[`item:${i.id}`],
      })),
    },
    {
      title: 'World Events',
      items: EVENTS.map((e) => ({
        id: `event:${e.id}`,
        name: e.name,
        desc: e.desc,
        icon: iconUrl('ui:token'),
        foundAt: d[`event:${e.id}`],
      })),
    },
  ];
});

const totalDiscoverable = computed(() => journalGroups.value.reduce((a, g) => a + g.items.length, 0));
const totalDiscovered = computed(() =>
  journalGroups.value.reduce((a, g) => a + g.items.filter((i) => !!i.foundAt).length, 0),
);
</script>

<template>
  <section class="tw-panel journal-panel" aria-label="Discovery Journal & Milestones">
    <header class="panel-head">
      <div class="sub-tabs">
        <button
          type="button"
          class="tw-btn"
          :class="{ 'tw-btn-gold': sub === 'journal' }"
          @click="sub = 'journal'"
        >
          📖 Journal ({{ totalDiscovered }}/{{ totalDiscoverable }})
        </button>
        <button
          type="button"
          class="tw-btn"
          :class="{ 'tw-btn-gold': sub === 'achievements' }"
          @click="sub = 'achievements'"
        >
          🏆 Achievements ({{ Object.keys(store.state.achievements).length }}/{{ ACHIEVEMENTS.length }})
        </button>
        <button
          type="button"
          class="tw-btn"
          :class="{ 'tw-btn-gold': sub === 'expand' }"
          @click="sub = 'expand'"
        >
          🌿 Island Stage
        </button>
      </div>
      <button type="button" class="tw-btn" aria-label="Close panel" @click="store.activeTab = 'none'">✕</button>
    </header>

    <!-- DISCOVERY JOURNAL -->
    <div v-if="sub === 'journal'" class="body tw-scroll">
      <div v-for="grp in journalGroups" :key="grp.title" class="j-section">
        <h3 class="sec-title">{{ grp.title }}</h3>
        <div class="j-grid">
          <div
            v-for="item in grp.items"
            :key="item.id"
            class="j-card"
            :class="{ unfound: !item.foundAt }"
          >
            <span class="tw-medallion sm">
              <img
                class="pixel-icon"
                :class="{ silhouette: !item.foundAt }"
                :src="item.icon"
                :alt="item.foundAt ? item.name : 'Undiscovered'"
                width="32"
                height="32"
              />
            </span>
            <div class="j-meta">
              <strong>{{ item.foundAt ? item.name : '???' }}</strong>
              <p>{{ item.foundAt ? item.desc : 'Yet to be discovered on your island.' }}</p>
              <small v-if="item.foundAt">Discovered {{ fmtDate(item.foundAt) }}</small>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ACHIEVEMENTS -->
    <div v-else-if="sub === 'achievements'" class="body tw-scroll">
      <div class="ach-list">
        <div
          v-for="a in ACHIEVEMENTS"
          :key="a.id"
          class="ach-card"
          :class="{ unlocked: !!store.state.achievements[a.id] }"
        >
          <div class="ach-icon">{{ store.state.achievements[a.id] ? '🌟' : '🔒' }}</div>
          <div class="ach-info">
            <strong>{{ a.name }}</strong>
            <p>{{ a.desc }}</p>
            <small v-if="store.state.achievements[a.id]">
              Unlocked {{ fmtDate(store.state.achievements[a.id]) }}
            </small>
          </div>
          <div class="ach-reward">+{{ a.reward }}</div>
        </div>
      </div>
    </div>

    <!-- ISLAND PROGRESSION -->
    <div v-else class="body tw-scroll">
      <div v-if="store.expansion" class="expand-box">
        <div class="expand-top">
          <h3 class="tw-title">Next Stage: Stage {{ store.expansion.next.id }} — {{ store.expansion.next.name }}</h3>
          <span v-if="store.expansion.next.biome" class="biome-pill">
            {{ BIOME_LABELS[store.expansion.next.biome] }} · {{ STAGE_GRIDS[store.expansion.next.id] ?? '' }}
          </span>
        </div>
        <p>{{ store.expansion.next.blurb }}</p>
        <ul class="req-list">
          <li :class="{ done: store.expansion.decor >= store.expansion.needDecor }">
            Place decorations: {{ store.expansion.decor }} / {{ store.expansion.needDecor }}
          </li>
          <li :class="{ done: store.expansion.harvests >= store.expansion.needHarvests }">
            Harvest plants: {{ store.expansion.harvests }} / {{ store.expansion.needHarvests }}
          </li>
          <li :class="{ done: store.expansion.canAfford }">
            Nature Tokens: {{ store.state.tokens }} / {{ store.expansion.cost }}
          </li>
        </ul>
        <button
          type="button"
          class="tw-btn tw-btn-primary"
          :disabled="!store.expansion.ready"
          @click="store.expandIsland()"
        >
          Expand Island ({{ store.expansion.cost }} Tokens)
        </button>
      </div>
      <div v-else class="expand-box">
        <h3 class="tw-title">Final Island Stage Reached!</h3>
        <p>Your floating sanctuary spans all {{ MAX_PLAYABLE_STAGE }} realms of TinyWorld.</p>
      </div>

      <div class="stage-list">
        <div
          v-for="st in STAGES"
          :key="st.id"
          class="stage-card"
          :class="{ current: st.id === store.state.stage, future: st.id > store.state.stage }"
        >
          <div class="stage-head">
            <div>
              <strong>Stage {{ st.id }} — {{ st.name }}</strong>
              <span v-if="st.biome || STAGE_GRIDS[st.id]" class="stage-sub">
                {{ st.biome ? BIOME_LABELS[st.biome] : '' }} · {{ STAGE_GRIDS[st.id] ?? '' }}
              </span>
            </div>
            <span v-if="st.id === store.state.stage" class="stage-tag active">Current</span>
            <span v-else-if="st.id < store.state.stage" class="stage-tag">Unlocked</span>
            <span v-else-if="st.id <= MAX_PLAYABLE_STAGE" class="stage-tag">Locked</span>
            <span v-else class="stage-tag">Future Update</span>
          </div>
          <p>{{ st.blurb }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.journal-panel {
  width: min(560px, 95vw);
  max-height: 76vh;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  border-bottom: 2px solid var(--cream-lo);
  padding-bottom: 8px;
}
.sub-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sec-title {
  margin: 2px 0 6px;
  font-size: 13px;
  font-weight: 800;
  color: var(--wood-dark);
  text-transform: uppercase;
}
.j-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.j-card {
  display: flex;
  gap: 10px;
  align-items: center;
  background: var(--cream-hi);
  border: 2px solid var(--wood);
  border-radius: 10px;
  padding: 8px;
}
.j-card.unfound {
  opacity: 0.65;
}
.tw-medallion.sm {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}
.silhouette {
  filter: brightness(0) opacity(0.5);
}
.j-meta strong {
  font-size: 13px;
}
.j-meta p {
  margin: 2px 0;
  font-size: 11.5px;
  color: var(--ink-soft);
}
.j-meta small {
  font-size: 10.5px;
  color: var(--forest);
  font-weight: 700;
}
.ach-list,
.stage-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ach-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--cream-hi);
  border: 2px solid var(--wood);
  border-radius: 10px;
  padding: 8px 10px;
  opacity: 0.72;
}
.ach-card.unlocked {
  opacity: 1;
  border-color: var(--forest);
  background: #f4faef;
}
.ach-icon {
  font-size: 20px;
}
.ach-info {
  flex: 1;
}
.ach-info p {
  margin: 2px 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.ach-reward {
  font-weight: 800;
  color: var(--wood-dark);
  background: var(--gold);
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 12px;
}
.expand-box {
  background: linear-gradient(180deg, #eef6ea 0%, #dfeed8 100%);
  border: 2px solid var(--forest);
  border-radius: 12px;
  padding: 12px;
}
.expand-box h3 {
  margin: 0 0 4px;
}
.req-list {
  margin: 8px 0 10px;
  padding-left: 18px;
  font-size: 13px;
}
.req-list li.done {
  color: var(--forest-dark);
  font-weight: 800;
}
.stage-card {
  background: var(--cream-hi);
  border: 2px solid var(--wood);
  border-radius: 10px;
  padding: 9px 11px;
}
.expand-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}
.biome-pill,
.stage-sub {
  font-size: 11px;
  font-weight: 700;
  color: var(--forest-dark);
  background: #dfeed8;
  padding: 1px 7px;
  border-radius: 999px;
  margin-left: 6px;
}
.stage-card.current {
  border-color: var(--forest);
}
.stage-card.future {
  opacity: 0.68;
}
.stage-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stage-tag {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 8px;
  background: var(--cream-lo);
}
.stage-tag.active {
  background: var(--forest);
  color: #fff;
}
</style>
