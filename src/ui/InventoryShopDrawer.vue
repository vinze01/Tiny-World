<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  CATEGORIES,
  ITEMS,
  PLANTS,
  SHOP_ITEMS,
  STAGES,
  TREAT_ID,
  TREAT_PRICE,
  decorKey,
  resaleValue,
  seedKey,
} from '../core/catalog';
import type { BiomeId, Category, PlantId, SeasonalTheme } from '../core/types';
import { iconUrl } from '../art/atlas';
import { useGameStore } from '../stores/gameStore';

const props = defineProps<{ mode: 'inventory' | 'shop' }>();
const store = useGameStore();

type ShopCat = 'all' | 'seeds' | Category | 'treats';
type SortMode = 'default' | 'price-asc' | 'price-desc' | 'stage' | 'unlocked';
type SeasonalFilter = 'all' | SeasonalTheme;

const shopCat = ref<ShopCat>('seeds');
const seasonalFilter = ref<SeasonalFilter>('all');
const searchQuery = ref('');
const sortBy = ref<SortMode>('default');
const qty = ref(1);
const selectedShopKey = ref<string>(seedKey('daisy'));

const SEASONAL_FILTERS: { id: SeasonalFilter; label: string }[] = [
  { id: 'all', label: 'All Themes' },
  { id: 'winter', label: '❄️ Winter' },
  { id: 'christmas', label: '🎄 Christmas' },
  { id: 'desert', label: '🌵 Desert' },
  { id: 'summer', label: '🏖️ Beach & Summer' },
  { id: 'other', label: '🍂 Classic' },
];

const SEASON_TAG: Record<SeasonalTheme, string> = {
  winter: 'Winter',
  christmas: 'Christmas',
  desert: 'Desert',
  summer: 'Summer',
  other: 'Seasonal',
};

// Bag sell state
interface BagEntry {
  key: string;
  id: string;
  kind: 'seed' | 'decor' | 'treat';
  name: string;
  desc: string;
  count: number;
  unitPrice: number;
  unitResale: number;
  icon: string;
}

const selectedSellKey = ref<string | null>(null);
const sellQty = ref(1);
const confirmHighValueSell = ref(false);

const BIOME_TAG: Record<BiomeId, string> = {
  meadow: 'Meadow',
  breeze: 'Grove',
  crystal: 'Crystal',
  mist: 'Moonlit',
  sky: 'Sky',
  frostfall: 'Frost',
  mistwood: 'Mistwood',
  emberglow: 'Emberglow',
  starlight: 'Starlight',
  everdream: 'Everdream',
};

interface ShopEntry {
  key: string;
  name: string;
  desc: string;
  price: number;
  resale: number;
  stage: number;
  biome?: BiomeId;
  seasonGroup?: SeasonalTheme;
  icon: string;
  owned: number;
}

const allShopEntries = computed<ShopEntry[]>(() => {
  const inv = store.state.inventory;
  const seedList: ShopEntry[] = PLANTS.map((p) => ({
    key: seedKey(p.id),
    name: `${p.name} Seed`,
    desc: `${p.desc} Blooms in ${p.growMinutes}m, yields ${p.yield} tokens.`,
    price: p.seedPrice,
    resale: resaleValue(p.seedPrice),
    stage: p.stage,
    icon: iconUrl(seedKey(p.id)),
    owned: inv[seedKey(p.id)] ?? 0,
  }));
  const treatEntry: ShopEntry = {
    key: TREAT_ID,
    name: 'Pipkin Berry Treat',
    desc: 'A sweet berry snack that Pipkins adore (+6 affection).',
    price: TREAT_PRICE,
    resale: resaleValue(TREAT_PRICE),
    stage: 1,
    icon: iconUrl(TREAT_ID),
    owned: inv[TREAT_ID] ?? 0,
  };
  const itemEntries: ShopEntry[] = SHOP_ITEMS.map((i) => ({
    key: decorKey(i.id),
    name: i.name,
    desc: i.desc,
    price: i.price,
    resale: resaleValue(i.price),
    stage: i.stage,
    biome: i.biome,
    seasonGroup: i.seasonGroup,
    icon: iconUrl(decorKey(i.id)),
    owned: inv[decorKey(i.id)] ?? 0,
  }));
  return [...seedList, ...itemEntries, treatEntry];
});

const shopEntries = computed<ShopEntry[]>(() => {
  const inv = store.state.inventory;
  const q = searchQuery.value.trim().toLowerCase();
  let list: ShopEntry[];

  if (q || shopCat.value === 'all') {
    list = allShopEntries.value;
  } else if (shopCat.value === 'seeds') {
    list = PLANTS.map((p) => ({
      key: seedKey(p.id),
      name: `${p.name} Seed`,
      desc: `${p.desc} Blooms in ${p.growMinutes}m, yields ${p.yield} tokens.`,
      price: p.seedPrice,
      resale: resaleValue(p.seedPrice),
      stage: p.stage,
      icon: iconUrl(seedKey(p.id)),
      owned: inv[seedKey(p.id)] ?? 0,
    }));
  } else if (shopCat.value === 'treats') {
    list = [
      {
        key: TREAT_ID,
        name: 'Pipkin Berry Treat',
        desc: 'A sweet berry snack that Pipkins adore (+6 affection).',
        price: TREAT_PRICE,
        resale: resaleValue(TREAT_PRICE),
        stage: 1,
        icon: iconUrl(TREAT_ID),
        owned: inv[TREAT_ID] ?? 0,
      },
    ];
  } else if (shopCat.value === 'seasonal') {
    list = SHOP_ITEMS.filter((i) => {
      if (seasonalFilter.value === 'all') {
        return i.category === 'seasonal' || Boolean(i.seasonGroup);
      }
      return i.seasonGroup === seasonalFilter.value;
    }).map((i) => ({
      key: decorKey(i.id),
      name: i.name,
      desc: i.desc,
      price: i.price,
      resale: resaleValue(i.price),
      stage: i.stage,
      biome: i.biome,
      seasonGroup: i.seasonGroup,
      icon: iconUrl(decorKey(i.id)),
      owned: inv[decorKey(i.id)] ?? 0,
    }));
  } else {
    list = SHOP_ITEMS.filter((i) => i.category === shopCat.value).map((i) => ({
      key: decorKey(i.id),
      name: i.name,
      desc: i.desc,
      price: i.price,
      resale: resaleValue(i.price),
      stage: i.stage,
      biome: i.biome,
      seasonGroup: i.seasonGroup,
      icon: iconUrl(decorKey(i.id)),
      owned: inv[decorKey(i.id)] ?? 0,
    }));
  }

  if (q) {
    list = list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.desc.toLowerCase().includes(q) ||
        (e.biome && BIOME_TAG[e.biome].toLowerCase().includes(q)) ||
        (e.seasonGroup && SEASON_TAG[e.seasonGroup].toLowerCase().includes(q)),
    );
  }

  const curStage = store.state.stage;
  if (sortBy.value === 'price-asc') {
    list = [...list].sort((a, b) => a.price - b.price || a.stage - b.stage);
  } else if (sortBy.value === 'price-desc') {
    list = [...list].sort((a, b) => b.price - a.price || a.stage - b.stage);
  } else if (sortBy.value === 'stage') {
    list = [...list].sort((a, b) => a.stage - b.stage || a.price - b.price);
  } else if (sortBy.value === 'unlocked') {
    list = [...list].sort((a, b) => {
      const aLock = a.stage > curStage ? 1 : 0;
      const bLock = b.stage > curStage ? 1 : 0;
      return aLock - bLock || a.stage - b.stage || a.price - b.price;
    });
  }

  return list;
});

const activeShopItem = computed<ShopEntry | null>(() => {
  return shopEntries.value.find((e) => e.key === selectedShopKey.value) ?? shopEntries.value[0] ?? null;
});

const lockedReason = computed(() => {
  const item = activeShopItem.value;
  if (!item) return '';
  if (item.stage > store.state.stage) {
    const st = STAGES.find((s) => s.id === item.stage);
    return `Unlocks at Stage ${item.stage}${st ? ` (${st.name})` : ''}`;
  }
  if (store.state.tokens < item.price * qty.value) {
    return `Need ${item.price * qty.value - store.state.tokens} more Tokens`;
  }
  return '';
});

const selectCategory = (c: ShopCat) => {
  shopCat.value = c;
  if (c !== 'seasonal') seasonalFilter.value = 'all';
  searchQuery.value = '';
  qty.value = 1;
  const first = shopEntries.value[0];
  if (first) selectedShopKey.value = first.key;
};

const selectSeasonalFilter = (sf: SeasonalFilter) => {
  seasonalFilter.value = sf;
  qty.value = 1;
  const first = shopEntries.value[0];
  if (first) selectedShopKey.value = first.key;
};

const buyCurrent = async () => {
  const item = activeShopItem.value;
  if (!item) return;
  const r = await store.buyItem(item.key, qty.value);
  if (r.ok) qty.value = 1;
};

const bagSeeds = computed<BagEntry[]>(() =>
  PLANTS.map((p) => ({
    key: seedKey(p.id),
    id: p.id,
    kind: 'seed' as const,
    name: `${p.name} Seed`,
    desc: p.desc,
    count: store.state.inventory[seedKey(p.id)] ?? 0,
    unitPrice: p.seedPrice,
    unitResale: resaleValue(p.seedPrice),
    icon: iconUrl(seedKey(p.id)),
  })).filter((x) => x.count > 0),
);

const bagDecor = computed<BagEntry[]>(() =>
  ITEMS.filter((i) => !i.scenery)
    .map((i) => ({
      key: decorKey(i.id),
      id: i.id,
      kind: 'decor' as const,
      name: i.name,
      desc: i.desc,
      count: store.state.inventory[decorKey(i.id)] ?? 0,
      unitPrice: i.price,
      unitResale: resaleValue(i.price),
      icon: iconUrl(decorKey(i.id)),
    }))
    .filter((x) => x.count > 0),
);

const bagTreatEntry = computed<BagEntry | null>(() => {
  if (store.treatsCount <= 0) return null;
  return {
    key: TREAT_ID,
    id: TREAT_ID,
    kind: 'treat',
    name: 'Pipkin Berry Treat',
    desc: 'Sweet snack for Pipkins.',
    count: store.treatsCount,
    unitPrice: TREAT_PRICE,
    unitResale: resaleValue(TREAT_PRICE),
    icon: iconUrl(TREAT_ID),
  };
});

const allBagEntries = computed<BagEntry[]>(() => [
  ...bagSeeds.value,
  ...bagDecor.value,
  ...(bagTreatEntry.value ? [bagTreatEntry.value] : []),
]);

const activeSellEntry = computed<BagEntry | null>(() => {
  if (!selectedSellKey.value) return null;
  return allBagEntries.value.find((e) => e.key === selectedSellKey.value) ?? null;
});

watch(activeSellEntry, (val) => {
  if (!val) {
    selectedSellKey.value = null;
    confirmHighValueSell.value = false;
  } else if (sellQty.value > val.count) {
    sellQty.value = val.count;
  }
});

const openSell = (entry: BagEntry) => {
  selectedSellKey.value = entry.key;
  sellQty.value = 1;
  confirmHighValueSell.value = false;
};

const executeSell = async () => {
  const entry = activeSellEntry.value;
  if (!entry) return;
  if (entry.unitPrice >= 25 && !confirmHighValueSell.value) {
    confirmHighValueSell.value = true;
    return;
  }
  const amount = Math.max(1, Math.min(entry.count, sellQty.value));
  const res = await store.sellItem(entry.key, amount);
  if (res.ok) {
    confirmHighValueSell.value = false;
    sellQty.value = 1;
  }
};
</script>

<template>
  <section class="tw-panel drawer" :aria-label="props.mode === 'shop' ? 'Island Shop' : 'Your Bag'">
    <header class="drawer-head">
      <div class="tab-switch">
        <button
          type="button"
          class="tw-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'inventory' }"
          @click="store.activeTab = 'inventory'"
        >
          Bag
        </button>
        <button
          type="button"
          class="tw-btn"
          :class="{ 'tw-btn-gold': store.activeTab === 'shop' }"
          @click="store.activeTab = 'shop'"
        >
          Shop
        </button>
      </div>
      <div class="head-right">
        <span class="token-mini">
          <img class="pixel-icon" :src="iconUrl('ui:token')" alt="Tokens" width="16" height="16" />
          <strong>{{ store.state.tokens.toLocaleString() }}</strong>
        </span>
        <button type="button" class="tw-btn" aria-label="Close panel" @click="store.activeTab = 'none'">✕</button>
      </div>
    </header>

    <!-- INVENTORY -->
    <div v-if="props.mode === 'inventory'" class="drawer-body tw-scroll">
      <h3 class="sec-title">Seeds to Plant</h3>
      <div v-if="bagSeeds.length" class="medallion-grid">
        <div v-for="s in bagSeeds" :key="s.key" class="bag-card">
          <button
            type="button"
            class="medallion-item"
            :title="`Plant ${s.name}`"
            @click="store.startPlantSeed(s.id as PlantId)"
          >
            <span class="tw-medallion">
              <img class="pixel-icon" :src="s.icon" :alt="s.name" width="32" height="32" />
              <span class="tw-badge">{{ s.count }}</span>
            </span>
            <span class="med-label">{{ s.name }}</span>
          </button>
          <button
            v-if="s.unitResale > 0"
            type="button"
            class="tw-btn tw-btn-sm sell-chip"
            :class="{ 'tw-btn-gold': selectedSellKey === s.key }"
            @click="openSell(s)"
          >
            Sell +{{ s.unitResale }}
          </button>
        </div>
      </div>
      <p v-else class="empty-hint">
        No seeds in your bag. Visit the Shop to pick up Daisy or Sunflower seeds!
      </p>

      <h3 class="sec-title">Terrain, Decorations &amp; Buildings</h3>
      <div v-if="bagDecor.length" class="medallion-grid">
        <div v-for="d in bagDecor" :key="d.key" class="bag-card">
          <button
            type="button"
            class="medallion-item"
            :title="`Place ${d.name}`"
            @click="store.startPlaceDecor(d.id)"
          >
            <span class="tw-medallion">
              <img class="pixel-icon" :src="d.icon" :alt="d.name" width="34" height="34" />
              <span class="tw-badge">{{ d.count }}</span>
            </span>
            <span class="med-label">{{ d.name }}</span>
          </button>
          <button
            v-if="d.unitResale > 0"
            type="button"
            class="tw-btn tw-btn-sm sell-chip"
            :class="{ 'tw-btn-gold': selectedSellKey === d.key }"
            @click="openSell(d)"
          >
            Sell +{{ d.unitResale }}
          </button>
        </div>
      </div>
      <p v-else class="empty-hint">
        Your placed items live on the island. Buy new decorations in the Shop or store existing ones to rearrange.
      </p>

      <h3 class="sec-title">Pipkin Treats</h3>
      <div class="treat-row">
        <img class="pixel-icon" :src="iconUrl(TREAT_ID)" alt="Treat" width="28" height="28" />
        <span>You have <strong>{{ store.treatsCount }}</strong> Berry Treats.</span>
        <div class="treat-btns">
          <button type="button" class="tw-btn tw-btn-sm" @click="store.activeTab = 'creatures'">Feed</button>
          <button
            v-if="bagTreatEntry && bagTreatEntry.unitResale > 0"
            type="button"
            class="tw-btn tw-btn-sm"
            :class="{ 'tw-btn-gold': selectedSellKey === bagTreatEntry.key }"
            @click="openSell(bagTreatEntry)"
          >
            Sell +{{ bagTreatEntry.unitResale }}
          </button>
        </div>
      </div>

      <!-- SELL LEDGER -->
      <div v-if="activeSellEntry" class="ledger-box sell-ledger" role="region" aria-label="Sell item from Bag">
        <div class="ledger-icon">
          <span class="tw-medallion">
            <img class="pixel-icon" :src="activeSellEntry.icon" :alt="activeSellEntry.name" width="34" height="34" />
          </span>
        </div>
        <div class="ledger-info">
          <div class="ledger-title">
            <strong>Sell {{ activeSellEntry.name }}</strong>
            <span class="owned-pill">Owned: {{ activeSellEntry.count }}</span>
          </div>
          <p class="ledger-desc">
            50% resale value: <strong>{{ activeSellEntry.unitResale }} Tokens</strong> each
            (Shop {{ activeSellEntry.unitPrice }}).
          </p>
          <div class="ledger-math">
            Selling {{ sellQty }} = <strong>+{{ activeSellEntry.unitResale * sellQty }} Tokens</strong>
          </div>
        </div>
        <div class="ledger-actions">
          <div class="qty-presets">
            <button
              type="button"
              class="tw-btn tw-btn-sm"
              :class="{ 'tw-btn-gold': sellQty === 1 }"
              @click="
                sellQty = 1;
                confirmHighValueSell = false;
              "
            >
              1
            </button>
            <button
              type="button"
              class="tw-btn tw-btn-sm"
              :disabled="activeSellEntry.count < 5"
              :class="{ 'tw-btn-gold': sellQty === 5 }"
              @click="
                sellQty = 5;
                confirmHighValueSell = false;
              "
            >
              5
            </button>
            <button
              type="button"
              class="tw-btn tw-btn-sm"
              :class="{ 'tw-btn-gold': sellQty === activeSellEntry.count && activeSellEntry.count > 1 }"
              @click="
                sellQty = activeSellEntry.count;
                confirmHighValueSell = false;
              "
            >
              All ({{ activeSellEntry.count }})
            </button>
          </div>
          <div class="sell-confirm-row">
            <button
              type="button"
              class="tw-btn tw-btn-sm"
              :class="confirmHighValueSell ? 'tw-btn-danger' : 'tw-btn-gold'"
              @click="executeSell"
            >
              {{
                confirmHighValueSell
                  ? `Confirm Sell (+${activeSellEntry.unitResale * sellQty})`
                  : activeSellEntry.unitPrice >= 25
                    ? `Sell (+${activeSellEntry.unitResale * sellQty})…`
                    : `Sell (+${activeSellEntry.unitResale * sellQty})`
              }}
            </button>
            <button
              type="button"
              class="tw-btn tw-btn-sm"
              @click="
                selectedSellKey = null;
                confirmHighValueSell = false;
              "
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- SHOP (Interface.jpg inspired medallion grid + purchase ledger) -->
    <div v-else class="drawer-body tw-scroll">
      <div class="shop-toolbar">
        <input
          v-model="searchQuery"
          type="search"
          class="shop-search"
          placeholder="Search seeds, decor, buildings, biome…"
          aria-label="Search shop items"
        />
        <select v-model="sortBy" class="shop-sort" aria-label="Sort shop items">
          <option value="default">Sort: Default</option>
          <option value="unlocked">Unlocked First</option>
          <option value="stage">Stage ↑</option>
          <option value="price-asc">Price ↑</option>
          <option value="price-desc">Price ↓</option>
        </select>
      </div>

      <div class="cat-bar" role="tablist" aria-label="Shop categories">
        <button
          type="button"
          class="tw-btn cat-pill"
          :class="{ 'tw-btn-primary': shopCat === 'all' }"
          @click="selectCategory('all')"
        >
          ✨ All
        </button>
        <button
          type="button"
          class="tw-btn cat-pill"
          :class="{ 'tw-btn-primary': shopCat === 'seeds' && !searchQuery.trim() }"
          @click="selectCategory('seeds')"
        >
          🌱 Seeds
        </button>
        <button
          v-for="c in CATEGORIES"
          :key="c.id"
          type="button"
          class="tw-btn cat-pill"
          :class="{ 'tw-btn-primary': shopCat === c.id && !searchQuery.trim() }"
          @click="selectCategory(c.id)"
        >
          {{ c.label }}
        </button>
        <button
          type="button"
          class="tw-btn cat-pill"
          :class="{ 'tw-btn-primary': shopCat === 'treats' && !searchQuery.trim() }"
          @click="selectCategory('treats')"
        >
          🍓 Treats
        </button>
      </div>

      <div
        v-if="shopCat === 'seasonal' && !searchQuery.trim()"
        class="cat-bar sub-cat-bar"
        role="tablist"
        aria-label="Seasonal themes"
      >
        <button
          v-for="sf in SEASONAL_FILTERS"
          :key="sf.id"
          type="button"
          class="tw-btn cat-pill"
          :class="{ 'tw-btn-gold': seasonalFilter === sf.id }"
          @click="selectSeasonalFilter(sf.id)"
        >
          {{ sf.label }}
        </button>
      </div>

      <div v-if="shopEntries.length" class="medallion-grid">
        <button
          v-for="entry in shopEntries"
          :key="entry.key"
          type="button"
          class="medallion-item"
          :class="{ 'is-locked': entry.stage > store.state.stage }"
          @click="
            selectedShopKey = entry.key;
            qty = 1;
          "
        >
          <span class="tw-medallion" :class="{ active: activeShopItem?.key === entry.key }">
            <img class="pixel-icon" :src="entry.icon" :alt="entry.name" width="34" height="34" />
            <span class="tw-badge">{{ entry.price }}</span>
          </span>
          <span class="med-label">
            {{ entry.name }}
            <small v-if="entry.stage > store.state.stage" class="lock-tag">Stage {{ entry.stage }}</small>
            <small v-else-if="entry.seasonGroup" class="biome-tag">{{ SEASON_TAG[entry.seasonGroup] }}</small>
            <small v-else-if="entry.biome" class="biome-tag">{{ BIOME_TAG[entry.biome] }}</small>
          </span>
        </button>
      </div>
      <p v-else class="empty-hint">No items match "{{ searchQuery }}".</p>

      <div v-if="activeShopItem" class="ledger-box">
        <div class="ledger-icon">
          <span class="tw-medallion">
            <img class="pixel-icon" :src="activeShopItem.icon" :alt="activeShopItem.name" width="36" height="36" />
          </span>
        </div>
        <div class="ledger-info">
          <div class="ledger-title">
            <strong>{{ activeShopItem.name }}</strong>
            <span class="owned-pill">Owned: {{ activeShopItem.owned }}</span>
            <span class="owned-pill">Stage {{ activeShopItem.stage }}</span>
            <span v-if="activeShopItem.seasonGroup" class="owned-pill">{{ SEASON_TAG[activeShopItem.seasonGroup] }}</span>
            <span v-else-if="activeShopItem.biome" class="owned-pill">{{ BIOME_TAG[activeShopItem.biome] }}</span>
          </div>
          <p class="ledger-desc">{{ activeShopItem.desc }}</p>
          <div class="ledger-math">
            Unit {{ activeShopItem.price }} × {{ qty }} =
            <strong>{{ activeShopItem.price * qty }} Tokens</strong>
            <span class="resale-note"> · Resells {{ activeShopItem.resale }}/ea</span>
          </div>
          <p v-if="lockedReason" class="lock-reason">{{ lockedReason }}</p>
        </div>
        <div class="ledger-actions">
          <div class="qty-box">
            <button type="button" class="tw-btn" aria-label="Decrease quantity" @click="qty = Math.max(1, qty - 1)">
              −
            </button>
            <span class="qty-val">{{ qty }}</span>
            <button type="button" class="tw-btn" aria-label="Increase quantity" @click="qty = Math.min(20, qty + 1)">
              +
            </button>
          </div>
          <button
            type="button"
            class="tw-btn tw-btn-primary"
            :disabled="
              activeShopItem.stage > store.state.stage ||
              store.state.tokens < activeShopItem.price * qty
            "
            @click="buyCurrent"
          >
            {{ activeShopItem.stage > store.state.stage ? `Stage ${activeShopItem.stage} Required` : 'Confirm Purchase' }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  max-height: 76vh;
  width: min(560px, 95vw);
  padding: 12px 14px;
}
.drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--cream-lo);
}
.tab-switch,
.head-right,
.treat-btns {
  display: flex;
  align-items: center;
  gap: 6px;
}
.treat-btns {
  margin-left: auto;
}
.token-mini {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--cream-lo);
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12.5px;
  border: 1.5px solid var(--wood);
}
.bag-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.sell-chip {
  padding: 2px 7px;
  font-size: 10.5px;
}
.shop-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.shop-search {
  flex: 1 1 180px;
  padding: 5px 9px;
  border: 2px solid var(--wood-dark);
  border-radius: 9px;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  background: #fffdf8;
  color: var(--ink);
}
.shop-sort {
  padding: 5px 8px;
  border: 2px solid var(--wood-dark);
  border-radius: 9px;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 700;
  background: #fffdf8;
  color: var(--ink);
}
.medallion-item.is-locked {
  opacity: 0.56;
}
.lock-tag,
.biome-tag {
  display: block;
  font-size: 10px;
  font-weight: 800;
  color: var(--wood-dark);
}
.lock-tag {
  color: var(--danger);
}
.biome-tag {
  color: var(--forest-dark);
}
.resale-note {
  font-size: 11px;
  color: var(--ink-soft);
}
.lock-reason {
  margin: 4px 0 0;
  font-size: 11.5px;
  font-weight: 800;
  color: #9e2a2a;
}
.qty-presets,
.sell-confirm-row {
  display: flex;
  gap: 5px;
  justify-content: center;
}
.sell-ledger {
  background: linear-gradient(180deg, #f9eccb 0%, #ebd7a5 100%);
}
.drawer-body {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sec-title {
  margin: 4px 0 2px;
  font-size: 13px;
  font-weight: 800;
  color: var(--wood-dark);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cat-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.sub-cat-bar {
  padding: 5px 7px;
  background: var(--cream-lo);
  border-radius: 10px;
  border: 1.5px solid var(--wood);
}
.cat-pill {
  padding: 4px 9px;
  font-size: 12px;
}
.medallion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 10px 8px;
  padding: 4px 2px;
}
.medallion-item {
  background: none;
  border: none;
  padding: 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: var(--ink);
  font-family: var(--font-body);
}
.medallion-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.med-label {
  font-size: 11.5px;
  font-weight: 700;
  text-align: center;
  line-height: 1.15;
}
.empty-hint {
  margin: 2px 0 6px;
  font-size: 12.5px;
  color: var(--ink-soft);
}
.treat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--cream-lo);
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 13px;
}
.ledger-box {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background: linear-gradient(180deg, #efe2c2 0%, #e2d0a8 100%);
  border: 2px solid var(--wood-dark);
  border-radius: 12px;
  padding: 10px 12px;
}
.ledger-info {
  flex: 1 1 180px;
  min-width: 0;
}
.ledger-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}
.owned-pill {
  font-size: 11px;
  background: var(--cream-hi);
  border: 1px solid var(--wood);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 700;
}
.ledger-desc {
  margin: 3px 0 5px;
  font-size: 12px;
  color: var(--ink-soft);
}
.ledger-math {
  font-size: 12.5px;
}
.ledger-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.qty-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.qty-val {
  min-width: 24px;
  text-align: center;
  font-weight: 800;
}
</style>
