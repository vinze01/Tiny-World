<script setup lang="ts">
import { computed, ref } from 'vue';
import { decorKey, seedKey } from '../core/catalog';
import { iconUrl } from '../art/atlas';
import { useGameStore } from '../stores/gameStore';

const store = useGameStore();
const mossiName = ref(store.state.creatures[0]?.name ?? 'Mossi');

const step = computed(() => store.state.tutorial.step);
const tut = computed(() => store.state.tutorial);

const confirmMossiName = async () => {
  if (mossiName.value.trim()) {
    await store.renameCreature('mossi', mossiName.value);
  }
  await store.advanceTutorial(2);
}

const quickStartFlower = () => {
  if ((store.state.inventory[seedKey('daisy')] ?? 0) > 0) {
    store.startPlantSeed('daisy');
  } else {
    store.activeTab = 'shop';
  }
}

const quickStartDecor = async () => {
  if ((store.state.inventory[decorKey('lantern')] ?? 0) < 1 && store.state.tokens >= 15) {
    await store.buyItem(decorKey('lantern'), 1);
  }
  if ((store.state.inventory[decorKey('lantern')] ?? 0) > 0) {
    store.startPlaceDecor('lantern');
  } else {
    store.activeTab = 'shop';
  }
}
</script>

<template>
  <aside
    v-if="!tut.done && !tut.skipped"
    class="tw-panel onboarding-card"
    role="region"
    aria-label="Welcome Guide"
  >
    <div class="onboard-top">
      <span class="step-pill">Step {{ step + 1 }} of 6</span>
      <button type="button" class="skip-link" @click="store.advanceTutorial(6, { skip: true })">
        Skip Tour
      </button>
    </div>

    <!-- Step 0: Welcome -->
    <div v-if="step === 0" class="step-body">
      <h3 class="tw-title">Welcome to Tiny World</h3>
      <p>
        A little floating island, just for you. Visit whenever you want a peaceful break—your world
        evolves gently without stress or timers.
      </p>
      <button type="button" class="tw-btn tw-btn-primary" @click="store.advanceTutorial(1)">
        Meet Your Pipkin →
      </button>
    </div>

    <!-- Step 1: Meet Mossi -->
    <div v-else-if="step === 1" class="step-body">
      <div class="mossi-row">
        <img class="pixel-icon" :src="iconUrl('creature:mossi')" alt="Mossi" width="42" height="42" />
        <div>
          <h3 class="tw-title">Meet Your First Pipkin</h3>
          <p>This leaf-eared woodland friend lives on your meadow. Would you like to give them a name?</p>
        </div>
      </div>
      <div class="name-box">
        <input
          v-model="mossiName"
          maxlength="14"
          class="name-input"
          aria-label="Name your Pipkin"
          @keydown.enter="confirmMossiName"
        />
        <button type="button" class="tw-btn tw-btn-primary" @click="confirmMossiName">Continue →</button>
      </div>
    </div>

    <!-- Step 2: Explore Your Island -->
    <div v-else-if="step === 2" class="step-body">
      <h3 class="tw-title">Explore Your Island</h3>
      <p>Click or tap around your island to say hello:</p>
      <ul class="check-list">
        <li :class="{ done: tut.tappedTree }">
          {{ tut.tappedTree ? '✓' : '○' }} Tap the Great Old Tree for acorns
        </li>
        <li :class="{ done: tut.tappedPond }">
          {{ tut.tappedPond ? '✓' : '○' }} Splash the Pond water
        </li>
        <li :class="{ done: tut.tappedCreature }">
          {{ tut.tappedCreature ? '✓' : '○' }} Pet {{ store.state.creatures[0]?.name ?? 'Mossi' }}
        </li>
      </ul>
      <button type="button" class="tw-btn" @click="store.advanceTutorial(3)">Next Step →</button>
    </div>

    <!-- Step 3: Plant Your First Flower -->
    <div v-else-if="step === 3" class="step-body">
      <h3 class="tw-title">Plant Your First Flower</h3>
      <p>
        You started with two Daisy seeds. Pick a sunny grass tile to plant one—it will grow even while
        you're away!
      </p>
      <div class="btn-row">
        <button type="button" class="tw-btn tw-btn-primary" @click="quickStartFlower">
          🌱 Plant a Daisy Seed
        </button>
        <button type="button" class="tw-btn" @click="store.advanceTutorial(4)">Next →</button>
      </div>
    </div>

    <!-- Step 4: Place Your First Decoration -->
    <div v-else-if="step === 4" class="step-body">
      <h3 class="tw-title">Place a Decoration</h3>
      <p>
        Cozy up your island! Place a Garden Lantern (warm lights might even attract a curious new
        Pipkin).
      </p>
      <div class="btn-row">
        <button type="button" class="tw-btn tw-btn-gold" @click="quickStartDecor">
          🏮 Get &amp; Place Lantern
        </button>
        <button type="button" class="tw-btn" @click="store.advanceTutorial(5)">Next →</button>
      </div>
    </div>

    <!-- Step 5: Your World Begins -->
    <div v-else class="step-body">
      <h3 class="tw-title">Your World Begins</h3>
      <p>
        Collect Nature Tokens, grow flowers, discover fifteen Pipkins, and expand your meadow across
        10 magical island biomes. Your island saves automatically and evolves between visits.
      </p>
      <button type="button" class="tw-btn tw-btn-primary" @click="store.advanceTutorial(6)">
        Enjoy Tiny World ✨
      </button>
    </div>
  </aside>
</template>

<style scoped>
.onboarding-card {
  width: min(350px, 92vw);
  padding: 10px 12px;
  pointer-events: auto;
}
.onboard-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.step-pill {
  font-size: 11px;
  font-weight: 800;
  background: var(--gold);
  color: var(--wood-dark);
  padding: 1px 7px;
  border-radius: 999px;
}
.skip-link {
  background: none;
  border: none;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink-soft);
  text-decoration: underline;
  cursor: pointer;
}
.step-body h3 {
  margin: 2px 0 4px;
  font-size: 15px;
}
.step-body p {
  margin: 0 0 8px;
  font-size: 12.5px;
  line-height: 1.35;
}
.mossi-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.name-box,
.btn-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.name-input {
  flex: 1;
  padding: 5px 8px;
  border: 2px solid var(--wood-dark);
  border-radius: 8px;
  font-family: var(--font-body);
  font-weight: 700;
}
.check-list {
  list-style: none;
  padding: 0;
  margin: 0 0 8px;
  font-size: 12.5px;
}
.check-list li.done {
  color: var(--forest-dark);
  font-weight: 800;
}
</style>
