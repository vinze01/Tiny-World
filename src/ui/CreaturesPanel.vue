<script setup lang="ts">
import { ref } from 'vue';
import { effectiveEmotion } from '../core/actions';
import { AFFECTION_LEVELS, CREATURES, TREAT_ID, affectionLevel } from '../core/catalog';
import type { CreatureId, EmotionType } from '../core/types';
import { iconUrl } from '../art/atlas';
import { useGameStore } from '../stores/gameStore';

const store = useGameStore();
const editingId = ref<CreatureId | null>(null);
const draftName = ref('');
const expandedHints = ref<Record<string, boolean>>({});

const startEdit = (id: CreatureId, currentName: string) => {
  editingId.value = id;
  draftName.value = currentName;
};

const saveEdit = async (id: CreatureId) => {
  const r = await store.renameCreature(id, draftName.value);
  if (r.ok) editingId.value = null;
};

const toggleHint = (id: string) => {
  expandedHints.value = { ...expandedHints.value, [id]: !expandedHints.value[id] };
};

const progressPercent = (affection: number): number => {
  const lvl = affectionLevel(affection);
  const lo = AFFECTION_LEVELS[lvl] ?? 0;
  const hi = AFFECTION_LEVELS[lvl + 1];
  if (hi === undefined) return 100;
  return Math.min(100, Math.round(((affection - lo) / (hi - lo)) * 100));
};

const EMOTION_LABELS: Record<EmotionType, { icon: string; label: string }> = {
  happy: { icon: '😊', label: 'Happy' },
  curious: { icon: '🧐', label: 'Curious' },
  sleepy: { icon: '😴', label: 'Sleepy' },
  excited: { icon: '✨', label: 'Excited' },
  shy: { icon: '🌸', label: 'Shy' },
  annoyed: { icon: '💢', label: 'Annoyed' },
  angry: { icon: '😤', label: 'Grumpy' },
  relaxed: { icon: '🌿', label: 'Relaxed' },
};

const moodBadge = (emo: EmotionType) => {
  return (
    EMOTION_LABELS[emo] ?? {
      icon: '✨',
      label: String(emo).charAt(0).toUpperCase() + String(emo).slice(1),
    }
  );
};
</script>

<template>
  <section class="tw-panel creatures-panel" aria-label="Pipkin Companions">
    <header class="panel-head">
      <h2 class="tw-title">Pipkin Friends ({{ store.state.creatures.length }} / {{ CREATURES.length }})</h2>
      <div class="treat-pill">
        <img class="pixel-icon" :src="iconUrl(TREAT_ID)" alt="Treat" width="20" height="20" />
        <span>{{ store.treatsCount }} Treats</span>
      </div>
      <button type="button" class="tw-btn" aria-label="Close panel" @click="store.activeTab = 'none'">✕</button>
    </header>

    <div class="cards tw-scroll">
      <article v-for="def in CREATURES" :key="def.id" class="pipkin-card">
        <template v-if="store.state.creatures.find((c) => c.id === def.id)">
          <div
            v-for="c in [store.state.creatures.find((x) => x.id === def.id)!]"
            :key="c.id"
            class="card-inner"
          >
            <div class="avatar-col">
              <span class="tw-medallion">
                <img class="pixel-icon" :src="iconUrl(`creature:${c.id}`)" :alt="c.name" width="44" height="44" />
              </span>
              <span class="lvl-badge">♥ Lv. {{ affectionLevel(c.affection) }}</span>
            </div>

            <div class="info-col">
              <div class="name-row">
                <template v-if="editingId === c.id">
                  <input
                    v-model="draftName"
                    class="name-input"
                    maxlength="14"
                    aria-label="Pipkin name"
                    @keydown.enter="saveEdit(c.id)"
                  />
                  <button type="button" class="tw-btn tw-btn-primary tw-btn-sm" @click="saveEdit(c.id)">Save</button>
                  <button type="button" class="tw-btn tw-btn-sm" @click="editingId = null">Cancel</button>
                </template>
                <template v-else>
                  <strong class="cname">{{ c.name }}</strong>
                  <span class="species-tag">{{ def.name }}</span>
                  <span
                    class="mood-chip"
                    :class="{ annoyed: ['annoyed', 'angry'].includes(effectiveEmotion(c, store.nowTick)) }"
                  >
                    {{ moodBadge(effectiveEmotion(c, store.nowTick)).icon }}
                    {{ moodBadge(effectiveEmotion(c, store.nowTick)).label }}
                  </span>
                  <button type="button" class="tw-btn rename-btn" @click="startEdit(c.id, c.name)">Rename</button>
                </template>
              </div>

              <p class="cdesc">{{ def.desc }}</p>
              <div class="traits">
                <span v-for="p in def.personality" :key="p" class="trait-chip">{{ p }}</span>
                <span class="trait-chip fav">Likes: {{ def.likes }}</span>
              </div>

              <div class="heart-bar" :title="`Affection: ${c.affection}`">
                <div class="heart-fill" :style="{ width: `${progressPercent(c.affection)}%` }" />
              </div>

              <div class="actions-row">
                <button type="button" class="tw-btn tw-btn-gold tw-btn-sm" @click="store.selectAndPetCreature(c.id)">
                  ♥ Pet
                </button>
                <button
                  type="button"
                  class="tw-btn tw-btn-primary tw-btn-sm"
                  :disabled="store.treatsCount < 1"
                  @click="store.feedCreature(c.id)"
                >
                  🍓 Feed
                </button>
                <button
                  type="button"
                  class="tw-btn tw-btn-sm"
                  @click="store.interactCreature(c.id, 'play')"
                >
                  🎲 Play
                </button>
                <button
                  type="button"
                  class="tw-btn tw-btn-sm"
                  @click="store.interactCreature(c.id, 'cheer')"
                >
                  ✨ Cheer
                </button>
                <button
                  type="button"
                  class="tw-btn tw-btn-sm"
                  @click="store.interactCreature(c.id, 'call')"
                >
                  📣 Call
                </button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="card-inner locked">
            <div class="avatar-col">
              <span class="tw-medallion">
                <img
                  class="pixel-icon silhouette"
                  :src="iconUrl(`creature:${def.id}`)"
                  alt="Undiscovered Pipkin"
                  width="44"
                  height="44"
                />
              </span>
            </div>
            <div class="info-col">
              <div class="name-row">
                <strong class="cname">??? ({{ def.name }})</strong>
                <button type="button" class="tw-btn tw-btn-sm" @click="toggleHint(def.id)">
                  {{ expandedHints[def.id] ? 'Hide Hint ▴' : 'Discovery Hint ▾' }}
                </button>
              </div>
              <p v-if="expandedHints[def.id]" class="cdesc">{{ def.unlockHint }}</p>
              <p v-else class="cdesc">Undiscovered companion — expand hint for clues.</p>
            </div>
          </div>
        </template>
      </article>
    </div>
  </section>
</template>

<style scoped>
.creatures-panel {
  width: min(540px, 95vw);
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
  gap: 8px;
  border-bottom: 2px solid var(--cream-lo);
  padding-bottom: 8px;
}
.panel-head h2 {
  margin: 0;
  font-size: 17px;
}
.treat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--cream-lo);
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 800;
}
.cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pipkin-card {
  background: var(--cream-hi);
  border: 2px solid var(--wood);
  border-radius: 12px;
  padding: 10px;
}
.card-inner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.card-inner.locked {
  opacity: 0.78;
  align-items: center;
}
.silhouette {
  filter: brightness(0) opacity(0.55);
}
.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.lvl-badge {
  font-size: 11px;
  font-weight: 800;
  color: var(--wood-dark);
  background: var(--gold);
  padding: 1px 7px;
  border-radius: 8px;
}
.info-col {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.cname {
  font-size: 15px;
}
.species-tag {
  font-size: 11px;
  color: var(--ink-soft);
  background: var(--cream-lo);
  padding: 1px 6px;
  border-radius: 6px;
}
.rename-btn {
  padding: 2px 7px;
  font-size: 11px;
}
.name-input {
  font-family: var(--font-body);
  font-size: 13px;
  padding: 3px 7px;
  border: 2px solid var(--wood-dark);
  border-radius: 7px;
  width: 130px;
}
.cdesc {
  margin: 4px 0 6px;
  font-size: 12.5px;
  color: var(--ink-soft);
}
.traits {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
}
.trait-chip {
  font-size: 11px;
  font-weight: 700;
  background: #e2eedd;
  color: var(--forest-dark);
  padding: 2px 7px;
  border-radius: 999px;
}
.trait-chip.fav {
  background: #f5e6c4;
  color: var(--wood-dark);
}
.heart-bar {
  height: 8px;
  background: var(--cream-lo);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid var(--wood);
}
.heart-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff7a90, #ffaf52);
  transition: width 0.25s ease;
}
.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.mood-chip {
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 999px;
  background: #e5f2e1;
  color: var(--forest-dark);
  border: 1px solid var(--forest);
}
.mood-chip.annoyed {
  background: #fde3e3;
  color: #8f2323;
  border-color: var(--danger);
}
</style>
