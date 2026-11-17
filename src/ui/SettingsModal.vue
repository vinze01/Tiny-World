<script setup lang="ts">
import { computed, ref } from 'vue';
import type { BiomeId, CycleMode, GameState, ParticleDensity } from '../core/types';
import { useGameStore } from '../stores/gameStore';

const store = useGameStore();
const importError = ref('');
const pendingImport = ref<GameState | null>(null);
const confirmReset = ref(false);

type SettingsCategory = 'audio' | 'visuals' | 'general';
const activeCategory = ref<SettingsCategory>('audio');

const CATEGORIES: { id: SettingsCategory; label: string }[] = [
  { id: 'audio', label: '🔊 Audio' },
  { id: 'visuals', label: '🎨 Visuals & Sky' },
  { id: 'general', label: '🧺 General' },
];

const BIOME_OPTIONS: { id: BiomeId; label: string }[] = [
  { id: 'meadow', label: 'Meadow Haven (Stage 1)' },
  { id: 'breeze', label: 'Blooming Grove (Stage 2)' },
  { id: 'crystal', label: 'Crystal Pond (Stage 3)' },
  { id: 'mist', label: 'Moonlit Garden (Stage 4)' },
  { id: 'sky', label: 'Cloud Sanctuary (Stage 5)' },
  { id: 'frostfall', label: 'Frostfall Haven (Stage 6)' },
  { id: 'mistwood', label: 'Mistwood Hollow (Stage 7)' },
  { id: 'emberglow', label: 'Emberglow Valley (Stage 8)' },
  { id: 'starlight', label: 'Starlight Isles (Stage 9)' },
  { id: 'everdream', label: 'Everdream Paradise (Stage 10)' },
];

const formattedManualHour = computed(() => {
  const h = store.state.settings.manualHour ?? 12;
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
});

const downloadSave = () => {
  const json = store.exportSave();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tinyworld-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const onFileSelected = async (ev: Event) => {
  importError.value = '';
  pendingImport.value = null;
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  const res = store.previewImport(text);
  if (!res.ok) {
    importError.value = res.error;
  } else {
    pendingImport.value = res.state;
  }
  input.value = '';
}

const applyImport = async () => {
  if (!pendingImport.value) return;
  await store.confirmImport(pendingImport.value);
  pendingImport.value = null;
}

const doReset = async () => {
  await store.resetSave();
  confirmReset.value = false;
  store.activeTab = 'none';
}
</script>

<template>
  <section class="tw-panel settings-panel" aria-label="Settings & Save Data">
    <header class="panel-head">
      <h2 class="tw-title">Settings &amp; Save Data</h2>
      <button type="button" class="tw-btn" aria-label="Close settings" @click="store.activeTab = 'none'">✕</button>
    </header>

    <nav class="cat-tabs" role="tablist" aria-label="Settings categories">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        type="button"
        role="tab"
        class="cat-tab"
        :class="{ active: activeCategory === cat.id }"
        :aria-selected="activeCategory === cat.id"
        @click="activeCategory = cat.id"
      >
        {{ cat.label }}
      </button>
    </nav>

    <div class="body tw-scroll">
      <!-- Audio -->
      <div v-show="activeCategory === 'audio'" class="cat-group">
        <div class="setting-row">
          <label for="chk-sound">
            <strong>Sound Effects</strong>
            <small>Gentle clicks, chimes &amp; Pipkin reactions</small>
          </label>
          <input
            id="chk-sound"
            type="checkbox"
            :checked="store.state.settings.sound"
            @change="store.updateSettings({ sound: ($event.target as HTMLInputElement).checked })"
          />
        </div>

        <div class="setting-row">
          <label for="rng-vol">
            <strong>Sound Volume</strong>
            <small>{{ Math.round(store.state.settings.volume * 100) }}%</small>
          </label>
          <input
            id="rng-vol"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="store.state.settings.volume"
            @input="store.updateSettings({ volume: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>

        <div class="setting-row">
          <label for="chk-ambient">
            <strong>Ambient Notes</strong>
            <small>Occasional soft wind-chime notes when sound is enabled</small>
          </label>
          <input
            id="chk-ambient"
            type="checkbox"
            :checked="store.state.settings.ambient"
            @change="store.updateSettings({ ambient: ($event.target as HTMLInputElement).checked })"
          />
        </div>
      </div>

      <!-- Visuals & Sky -->
      <div v-show="activeCategory === 'visuals'" class="cat-group">
        <div class="setting-row">
          <label for="sel-cycle">
            <strong>Day &amp; Night Cycle</strong>
            <small>Visual sky time (syncs across surfaces; growth &amp; Night Owl stay real-time)</small>
          </label>
          <select
            id="sel-cycle"
            :value="store.state.settings.cycle"
            @change="store.updateSettings({ cycle: ($event.target as HTMLSelectElement).value as CycleMode })"
          >
            <option value="real">Real-Time Clock</option>
            <option value="fast">Accelerated (6 min/day)</option>
            <option value="day">Cozy Daytime</option>
            <option value="night">Starry Night</option>
            <option value="custom">Custom Hour Slider</option>
          </select>
        </div>

        <div v-if="store.state.settings.cycle === 'custom'" class="setting-row">
          <label for="rng-manual-hour">
            <strong>Custom Sky Hour</strong>
            <small>{{ formattedManualHour }} (Visual preview only)</small>
          </label>
          <input
            id="rng-manual-hour"
            type="range"
            min="0"
            max="23.75"
            step="0.25"
            :value="store.state.settings.manualHour ?? 12"
            @input="store.setTimeOverride('custom', Number(($event.target as HTMLInputElement).value))"
          />
        </div>

        <div class="setting-row">
          <label for="chk-weather">
            <strong>Weather FX</strong>
            <small>Show biome petals, rain, snowflakes, steam, and fireflies</small>
          </label>
          <input
            id="chk-weather"
            type="checkbox"
            :checked="store.state.settings.weatherEnabled ?? true"
            @change="store.updateSettings({ weatherEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </div>

        <div class="setting-row">
          <label for="sel-density">
            <strong>Particle Density</strong>
            <small>Controls ambient petals, sparkles, and weather particle count</small>
          </label>
          <select
            id="sel-density"
            :value="store.state.settings.particleDensity ?? 'normal'"
            @change="store.updateSettings({ particleDensity: ($event.target as HTMLSelectElement).value as ParticleDensity })"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>

        <div class="setting-row">
          <label for="sel-biome">
            <strong>Biome Theme Preview</strong>
            <small>Preview any stage biome sky &amp; terrain palette visually</small>
          </label>
          <select
            id="sel-biome"
            :value="store.state.settings.biomeOverride ?? ''"
            @change="
              store.updateSettings({
                biomeOverride: (($event.target as HTMLSelectElement).value || null) as BiomeId | null,
              })
            "
          >
            <option value="">Auto (Current Stage)</option>
            <option v-for="b in BIOME_OPTIONS" :key="b.id" :value="b.id">{{ b.label }}</option>
          </select>
        </div>

        <div class="setting-row">
          <label for="chk-motion">
            <strong>Reduced Motion</strong>
            <small>Calms island bobbing, tree sway and drifting clouds</small>
          </label>
          <input
            id="chk-motion"
            type="checkbox"
            :checked="store.state.settings.reducedMotion"
            @change="store.updateSettings({ reducedMotion: ($event.target as HTMLInputElement).checked })"
          />
        </div>
      </div>

      <!-- General -->
      <div v-show="activeCategory === 'general'" class="cat-group">
        <div class="setting-row">
          <label>
            <strong>Onboarding Guide</strong>
            <small>Replay the welcome tour at any time</small>
          </label>
          <button
            type="button"
            class="tw-btn"
            @click="
              store.advanceTutorial(0, { replay: true });
              store.activeTab = 'none';
            "
          >
            Replay Tutorial
          </button>
        </div>

        <hr class="sep" />

        <h3 class="sec-title">Backup &amp; Restore</h3>
        <div class="backup-actions">
          <button type="button" class="tw-btn tw-btn-gold" @click="downloadSave">Export Save JSON</button>
          <label class="tw-btn file-label">
            Import Save JSON
            <input type="file" accept="application/json,.json" hidden @change="onFileSelected" />
          </label>
        </div>

        <p v-if="importError" class="err-msg" role="alert">{{ importError }}</p>

        <div v-if="pendingImport" class="confirm-box" role="alertdialog" aria-label="Confirm save import">
          <p>
            Replace your current island with this backup (Stage {{ pendingImport.stage }},
            {{ pendingImport.tokens }} Tokens, {{ pendingImport.creatures.length }} Pipkins)?
          </p>
          <div class="confirm-btns">
            <button type="button" class="tw-btn tw-btn-primary" @click="applyImport">Yes, Overwrite Save</button>
            <button type="button" class="tw-btn" @click="pendingImport = null">Cancel</button>
          </div>
        </div>

        <hr class="sep" />

        <div class="reset-zone">
          <button v-if="!confirmReset" type="button" class="tw-btn" @click="confirmReset = true">
            Reset Island…
          </button>
          <div v-else class="confirm-box">
            <p>Start a brand-new island? (You can export a backup first.)</p>
            <div class="confirm-btns">
              <button type="button" class="tw-btn" style="border-color: var(--danger)" @click="doReset">
                Confirm Reset
              </button>
              <button type="button" class="tw-btn" @click="confirmReset = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Always-visible support footer, independent of the selected category -->
    <footer class="support-foot">
      <div class="support-copy">
        <h3 class="sec-title">Support the Developer</h3>
        <p class="support-text">
          I've had a lot of fun bringing TinyWorld to life, and I hope you've enjoyed playing it too! If you'd like to support the project, consider buying me a coffee. 💛
        </p>
      </div>
      <a
        class="bmc-link"
        href="https://buymeacoffee.com/vinze"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="bmc-cup" aria-hidden="true">☕</span> Buy Me a Coffee
      </a>
    </footer>
  </section>
</template>

<style scoped>
.settings-panel {
  width: min(480px, 95vw);
  max-height: 82vh;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2px solid var(--cream-lo);
  padding-bottom: 8px;
}
.panel-head h2 {
  margin: 0;
  font-size: 17px;
}
.cat-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cat-tab {
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 12.5px;
  color: var(--ink-soft);
  background: var(--cream-hi);
  border: 2px solid var(--cream-lo);
  border-radius: 999px;
  padding: 6px 13px;
  cursor: pointer;
  transition: transform 0.08s ease, filter 0.12s ease;
}
.cat-tab:hover {
  filter: brightness(1.03);
  border-color: var(--wood);
}
.cat-tab.active {
  color: var(--wood-dark);
  background: linear-gradient(180deg, #f7dc88 0%, var(--gold) 100%);
  border-color: var(--wood-dark);
  box-shadow: 0 2px 0 var(--wood-dark);
}
.body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cat-group {
  display: contents;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--cream-hi);
  border: 1.5px solid var(--cream-lo);
  padding: 8px 10px;
  border-radius: 10px;
}
.setting-row label {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}
.setting-row small {
  color: var(--ink-soft);
  font-size: 11.5px;
}
.setting-row input[type='checkbox'] {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  accent-color: var(--forest);
  cursor: pointer;
}
.setting-row input[type='range'] {
  width: 150px;
  flex: 0 0 auto;
  accent-color: var(--forest);
  cursor: pointer;
}
.setting-row select {
  font-family: var(--font-body);
  font-weight: 700;
  padding: 5px 8px;
  border-radius: 8px;
  border: 2px solid var(--wood-dark);
  background: #fff;
}
.sep {
  border: none;
  border-top: 2px solid var(--cream-lo);
  margin: 2px 0;
}
.sec-title {
  margin: 0;
  font-size: 13px;
  font-weight: 800;
  color: var(--wood-dark);
  text-transform: uppercase;
}
.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.file-label {
  cursor: pointer;
}
.err-msg {
  margin: 2px 0;
  color: var(--danger);
  font-weight: 700;
  font-size: 12.5px;
}
.confirm-box {
  background: #fff4e4;
  border: 2px solid var(--wood-dark);
  border-radius: 10px;
  padding: 9px 11px;
  font-size: 12.5px;
}
.confirm-box p {
  margin: 0;
}
.confirm-btns {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}
.reset-zone {
  margin-top: 2px;
}
.support-foot {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 2px solid var(--cream-lo);
  padding-top: 10px;
}
.support-copy {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.support-text {
  margin: 0;
  font-size: 11.5px;
  color: var(--ink-soft);
  line-height: 1.35;
}
.bmc-link {
  flex: 0 0 auto;
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 13px;
  color: var(--ink);
  text-decoration: none;
  background: linear-gradient(180deg, #f7dc88 0%, var(--gold) 100%);
  border: 2px solid var(--wood-dark);
  border-radius: 10px;
  padding: 7px 14px;
  box-shadow: 0 2px 0 var(--wood-dark);
  cursor: pointer;
  transition: transform 0.08s ease, filter 0.08s ease;
}
.bmc-link:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}
.bmc-link:active {
  transform: translateY(1px);
  box-shadow: 0 0 0 var(--wood-dark);
}
.bmc-link:focus-visible {
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}
</style>
