import type { BiomeId, Category, CreatureId, PlantId, Terrain } from '../../src/core/types';
import {
  CREATURES,
  ITEMS,
  PLANTS,
  PLANT_STAGE_NAMES,
  STAGES,
  TREAT_ID,
} from '../../src/core/catalog';
import {
  ANIM_ORDER,
  ANIM_RATES,
  FRAME,
  FRAME_DEFS,
} from '../../src/art/creatures';
import {
  FX_BUILDERS,
  ITEM_BUILDERS,
  PICKUP_KEYS,
  ROTATED_BUILDERS,
  SEED_COL,
  UI_ICON_BUILDERS,
} from '../../src/art/atlas';
import { TERRAIN_KINDS } from '../../src/art/island';

export type AssetCategory =
  | 'creatures'
  | 'buildings'
  | 'decorations'
  | 'nature'
  | 'plants'
  | 'islands'
  | 'effects'
  | 'ui'
  | 'catalogs';

export type AssetKind =
  | 'sprite'
  | 'spritesheet'
  | 'animation'
  | 'terrain-tile'
  | 'island-stage'
  | 'island-preview'
  | 'progression'
  | 'icon'
  | 'ui-component'
  | 'ui-screenshot'
  | 'token'
  | 'catalog';

export interface VariantFile {
  label: string;
  format: 'png' | 'svg' | 'gif' | 'apng' | 'json';
  path: string;
  width?: number;
  height?: number;
  scale?: number;
  sha256?: string;
  lossless?: boolean;
}

export interface AssetAnimationMeta {
  name: string;
  frames: number;
  rate: number;
  repeat: boolean;
  seq?: number[];
  frameWidth: number;
  frameHeight: number;
}

export interface AssetRecord {
  id: string;
  name: string;
  category: AssetCategory;
  subcategory?: string;
  kind: AssetKind;
  sourceModule: string;
  catalogId?: string;
  rotatable?: boolean;
  rotation?: 0 | 1;
  stageMin?: number;
  biome?: BiomeId;
  footprint?: [number, number];
  nativeWidth: number;
  nativeHeight: number;
  anchorX?: number;
  anchorY?: number;
  primaryFile: string;
  files: VariantFile[];
  animation?: AssetAnimationMeta;
  tags: string[];
  status: 'pending' | 'exported' | 'cached' | 'skipped' | 'error';
  error?: string;
}

export interface DiscoveryAudit {
  creatureCount: number;
  plantCount: number;
  itemCount: number;
  stageCount: number;
  missingItemBuilders: string[];
  extraItemBuilders: string[];
  missingRotatedBuilders: string[];
  missingSeedColors: string[];
  missingFxBuilders: string[];
}

export interface AssetManifest {
  schemaVersion: number;
  generator: string;
  generatedAt: string;
  figmaTargetUrl: string;
  figmaMaxDimensionPx: number;
  summary: {
    totalAssets: number;
    totalFiles: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
    browserCapturesIncluded: boolean;
  };
  audit: DiscoveryAudit;
  assets: AssetRecord[];
}

export const FIGMA_TARGET_URL = 'https://www.figma.com/design/TCEjXAmLGD0mgNZc4nbWW0/Untitled';
export const BIOMES: BiomeId[] = [
  'meadow',
  'breeze',
  'crystal',
  'mist',
  'sky',
  'frostfall',
  'mistwood',
  'emberglow',
  'starlight',
  'everdream',
];
export const PALETTE_BIOMES: BiomeId[] = ['meadow', 'frostfall', 'mistwood', 'emberglow', 'starlight', 'everdream'];
export const TIMES_OF_DAY = ['morning', 'day', 'sunset', 'night'] as const;
export type TimeOfDayPreset = (typeof TIMES_OF_DAY)[number];

export interface WeatherShowcaseSpec {
  id: string;
  stage: number;
  biome: BiomeId;
  weather: 'rain' | 'snow' | 'fog' | 'wind' | 'sparkles';
  tod: TimeOfDayPreset;
  label: string;
}

export const WEATHER_SHOWCASES: WeatherShowcaseSpec[] = [
  { id: 'weather-rain-day', stage: 4, biome: 'meadow', weather: 'rain', tod: 'day', label: 'Stage 4 Meadow Rain (Day)' },
  { id: 'weather-frostfall-snow', stage: 3, biome: 'frostfall', weather: 'snow', tod: 'morning', label: 'Stage 3 Frostfall Snow (Morning)' },
  { id: 'weather-mistwood-fog', stage: 5, biome: 'mistwood', weather: 'fog', tod: 'morning', label: 'Stage 5 Mistwood Fog (Morning)' },
  { id: 'weather-emberglow-wind', stage: 7, biome: 'emberglow', weather: 'wind', tod: 'sunset', label: 'Stage 7 Emberglow Wind (Sunset)' },
  { id: 'weather-starlight-sparkles', stage: 9, biome: 'starlight', weather: 'sparkles', tod: 'night', label: 'Stage 9 Starlight Sparkles (Night)' },
  { id: 'weather-everdream-sparkles', stage: 10, biome: 'everdream', weather: 'sparkles', tod: 'sunset', label: 'Stage 10 Everdream Sanctuary (Sunset)' },
];

export const ITEM_SOURCE_MODULE: Record<Category, string> = {
  nature: 'src/art/nature.ts',
  furniture: 'src/art/decor.ts',
  lighting: 'src/art/decor.ts',
  paths: 'src/art/decor.ts',
  seasonal: 'src/art/decor.ts',
  buildings: 'src/art/buildings.ts',
};

// Pumpkin and snowman use seasonal catalog category but live inside nature.ts
const NATURE_MODULE_SEASONAL_IDS = new Set(['pumpkin', 'snowman']);

export function itemCategoryFolder(category: Category): { category: AssetCategory; dir: string; subcategory: string } {
  if (category === 'buildings') {
    return { category: 'buildings', dir: 'buildings', subcategory: 'buildings' };
  }
  if (category === 'nature') {
    return { category: 'nature', dir: 'nature', subcategory: 'nature' };
  }
  return { category: 'decorations', dir: `decorations/${category}`, subcategory: category };
}

export function itemSourceFile(id: string, category: Category): string {
  if (NATURE_MODULE_SEASONAL_IDS.has(id)) return 'src/art/nature.ts';
  return ITEM_SOURCE_MODULE[category];
}

export function runDiscoveryAudit(): DiscoveryAudit {
  const itemIds = new Set(ITEMS.map((i) => i.id));
  const missingItemBuilders = ITEMS.filter((i) => !ITEM_BUILDERS[i.id]).map((i) => i.id);
  const extraItemBuilders = Object.keys(ITEM_BUILDERS).filter((id) => !itemIds.has(id));
  const missingRotatedBuilders = ITEMS.filter((i) => i.rotatable && i.w !== i.d && !ROTATED_BUILDERS[i.id]).map((i) => i.id);
  const missingSeedColors = PLANTS.filter((p) => SEED_COL[p.id] === undefined).map((p) => p.id);
  const missingFxBuilders = ['fx:flame0', 'fx:flame1', 'fx:heart', 'fx:sparkle', 'fx:zzz', 'fx:drop', 'fx:raindrop', 'fx:snowflake', 'fx:petal', 'fx:ember', 'fx:fog', 'fx:glow']
    .filter((k) => !FX_BUILDERS[k]);

  return {
    creatureCount: CREATURES.length,
    plantCount: PLANTS.length,
    itemCount: ITEMS.length,
    stageCount: STAGES.length,
    missingItemBuilders,
    extraItemBuilders,
    missingRotatedBuilders,
    missingSeedColors,
    missingFxBuilders,
  };
}

export function buildPlannedInventory(): AssetRecord[] {
  const records: AssetRecord[] = [];

  // 1. Creatures (sprites, spritesheets, animations, state preview grid)
  for (const creature of CREATURES) {
    records.push({
      id: `creature:${creature.id}`,
      name: creature.name,
      category: 'creatures',
      subcategory: 'pipkin',
      kind: 'sprite',
      sourceModule: 'src/art/creatures.ts',
      catalogId: creature.id,
      nativeWidth: FRAME,
      nativeHeight: FRAME,
      anchorX: FRAME / 2,
      anchorY: FRAME - 3,
      primaryFile: `creatures/sprites/${creature.id}.png`,
      files: [],
      tags: ['pipkin', 'creature', creature.species.toLowerCase(), ...creature.personality],
      status: 'pending',
    });

    const sheetW = FRAME * ANIM_ORDER.reduce((sum, a) => sum + FRAME_DEFS[a].length, 0);
    records.push({
      id: `creature-sheet:${creature.id}`,
      name: `${creature.name} Spritesheet`,
      category: 'creatures',
      subcategory: 'spritesheet',
      kind: 'spritesheet',
      sourceModule: 'src/art/creatures.ts',
      catalogId: creature.id,
      nativeWidth: sheetW,
      nativeHeight: FRAME,
      primaryFile: `creatures/spritesheets/${creature.id}-sheet.png`,
      files: [],
      tags: ['pipkin', 'spritesheet', creature.id],
      status: 'pending',
    });

    records.push({
      id: `creature-preview:${creature.id}`,
      name: `${creature.name} Pose Gallery`,
      category: 'creatures',
      subcategory: 'preview',
      kind: 'progression',
      sourceModule: 'src/art/creatures.ts',
      catalogId: creature.id,
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `creatures/previews/${creature.id}-poses.png`,
      files: [],
      tags: ['pipkin', 'poses', 'expressions', creature.id],
      status: 'pending',
    });

    for (const anim of ANIM_ORDER) {
      const cfg = ANIM_RATES[anim];
      const frames = cfg.seq ? cfg.seq.length : FRAME_DEFS[anim].length;
      records.push({
        id: `creature-anim:${creature.id}:${anim}`,
        name: `${creature.name} (${anim})`,
        category: 'creatures',
        subcategory: anim,
        kind: 'animation',
        sourceModule: 'src/art/creatures.ts',
        catalogId: creature.id,
        nativeWidth: FRAME,
        nativeHeight: FRAME,
        primaryFile: `creatures/animations/${creature.id}-${anim}.apng`,
        files: [],
        animation: {
          name: anim,
          frames,
          rate: cfg.rate,
          repeat: cfg.repeat,
          seq: cfg.seq,
          frameWidth: FRAME,
          frameHeight: FRAME,
        },
        tags: ['pipkin', 'animation', anim, creature.id],
        status: 'pending',
      });
    }
  }

  // 2. Buildings, Decorations & Nature (from catalog ITEMS + ROTATED_BUILDERS)
  for (const item of ITEMS) {
    const dest = itemCategoryFolder(item.category);
    const srcMod = itemSourceFile(item.id, item.category);
    records.push({
      id: `item:${item.id}`,
      name: item.name,
      category: dest.category,
      subcategory: dest.subcategory,
      kind: 'sprite',
      sourceModule: srcMod,
      catalogId: item.id,
      rotatable: Boolean(item.rotatable || ROTATED_BUILDERS[item.id]),
      rotation: 0,
      stageMin: item.stage,
      footprint: [item.w, item.d],
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `${dest.dir}/${item.id}.png`,
      files: [],
      tags: [dest.category, item.category, item.id, `stage-${item.stage}`],
      status: 'pending',
    });

    if (ROTATED_BUILDERS[item.id]) {
      records.push({
        id: `item:${item.id}:rot1`,
        name: `${item.name} (Rotated)`,
        category: dest.category,
        subcategory: dest.subcategory,
        kind: 'sprite',
        sourceModule: srcMod,
        catalogId: item.id,
        rotatable: true,
        rotation: 1,
        stageMin: item.stage,
        footprint: [item.d, item.w],
        nativeWidth: 0,
        nativeHeight: 0,
        primaryFile: `${dest.dir}/${item.id}-rot1.png`,
        files: [],
        tags: [dest.category, item.category, item.id, 'rotated'],
        status: 'pending',
      });
    }
  }

  // 3. Plants (seeds, 5 growth stages, progression strip & growth loop animation)
  for (const plant of PLANTS) {
    records.push({
      id: `plant-seed:${plant.id}`,
      name: `${plant.name} Seed Packet`,
      category: 'plants',
      subcategory: 'seeds',
      kind: 'sprite',
      sourceModule: 'src/art/atlas.ts',
      catalogId: plant.id,
      stageMin: plant.stage,
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `plants/seeds/${plant.id}-seed.png`,
      files: [],
      tags: ['plant', 'seed', plant.id, `stage-${plant.stage}`],
      status: 'pending',
    });

    for (let s = 0; s < PLANT_STAGE_NAMES.length; s++) {
      records.push({
        id: `plant-stage:${plant.id}:${s}`,
        name: `${plant.name} — ${PLANT_STAGE_NAMES[s]}`,
        category: 'plants',
        subcategory: `stage-${s}`,
        kind: 'sprite',
        sourceModule: 'src/art/plants.ts',
        catalogId: plant.id,
        stageMin: plant.stage,
        nativeWidth: 30,
        nativeHeight: 50,
        primaryFile: `plants/growth-stages/${plant.id}-s${s}.png`,
        files: [],
        tags: ['plant', 'growth-stage', PLANT_STAGE_NAMES[s].toLowerCase(), plant.id],
        status: 'pending',
      });
    }

    records.push({
      id: `plant-progression:${plant.id}`,
      name: `${plant.name} Growth Cycle`,
      category: 'plants',
      subcategory: 'previews',
      kind: 'progression',
      sourceModule: 'src/art/plants.ts',
      catalogId: plant.id,
      stageMin: plant.stage,
      nativeWidth: 150,
      nativeHeight: 50,
      primaryFile: `plants/previews/${plant.id}-progression.png`,
      files: [],
      animation: {
        name: 'growth-cycle',
        frames: 5,
        rate: 2,
        repeat: true,
        frameWidth: 30,
        frameHeight: 50,
      },
      tags: ['plant', 'progression', 'animation', plant.id],
      status: 'pending',
    });
  }

  // 4. Islands: terrain tiles across biomes + raw procedural island stages 1..10 + animated water
  const kindBiomes: Record<Exclude<Terrain, 'void'>, BiomeId[]> = {
    grass: ['meadow', 'frostfall', 'mistwood', 'emberglow', 'starlight', 'everdream'],
    plot: ['meadow', 'frostfall', 'starlight'],
    water: ['meadow', 'emberglow', 'everdream'],
    sand: ['meadow'],
    snow: ['frostfall'],
    ice: ['frostfall'],
    autumn: ['mistwood'],
    hotspring: ['emberglow'],
    starstone: ['starlight'],
  };
  for (const kind of TERRAIN_KINDS) {
    const biomesForKind = kindBiomes[kind] ?? ['meadow'];
    for (const biome of biomesForKind) {
      records.push({
        id: `terrain:${kind}:${biome}`,
        name: `Terrain Tile: ${kind} (${biome})`,
        category: 'islands',
        subcategory: 'terrain',
        kind: 'terrain-tile',
        sourceModule: 'src/art/island.ts',
        biome,
        nativeWidth: 0,
        nativeHeight: 0,
        primaryFile: `islands/terrain/tile-${kind}-${biome}.png`,
        files: [],
        tags: ['terrain', 'tile', kind, biome],
        status: 'pending',
      });
    }
  }

  for (const st of STAGES) {
    records.push({
      id: `island-stage:${st.id}`,
      name: `Stage ${st.id}: ${st.name} (Raw Terrain)`,
      category: 'islands',
      subcategory: 'stages',
      kind: 'island-stage',
      sourceModule: 'src/art/island.ts',
      stageMin: st.id,
      biome: st.biome,
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `islands/stages/stage-${st.id}.png`,
      files: [],
      animation: {
        name: 'water-shimmer',
        frames: 3,
        rate: 3,
        repeat: true,
        frameWidth: 0,
        frameHeight: 0,
      },
      tags: ['island', 'terrain', `stage-${st.id}`, st.biome],
      status: 'pending',
    });

    for (const tod of TIMES_OF_DAY) {
      records.push({
        id: `island-preview:stage-${st.id}:${tod}`,
        name: `Stage ${st.id} — ${st.name} (${tod})`,
        category: 'islands',
        subcategory: 'previews',
        kind: 'island-preview',
        sourceModule: 'src/game/WorldScene.ts',
        stageMin: st.id,
        biome: st.biome,
        nativeWidth: 1200,
        nativeHeight: 840,
        primaryFile: `islands/previews/stage-${st.id}-${tod}.png`,
        files: [],
        tags: ['island', 'scene', 'preview', `stage-${st.id}`, st.biome, tod],
        status: 'pending',
      });
    }
  }

  for (const wspec of WEATHER_SHOWCASES) {
    records.push({
      id: `island-weather:${wspec.id}`,
      name: wspec.label,
      category: 'islands',
      subcategory: 'weather-previews',
      kind: 'island-preview',
      sourceModule: 'src/game/WorldScene.ts',
      stageMin: wspec.stage,
      biome: wspec.biome,
      nativeWidth: 1200,
      nativeHeight: 840,
      primaryFile: `islands/previews/${wspec.id}.png`,
      files: [],
      tags: ['island', 'weather', wspec.weather, wspec.biome, wspec.tod],
      status: 'pending',
    });
  }

  // 5. Effects & Pickups
  for (const fxKey of Object.keys(FX_BUILDERS)) {
    const slug = fxKey.replace(/^fx:/, '');
    records.push({
      id: fxKey,
      name: `FX: ${slug}`,
      category: 'effects',
      subcategory: 'fx',
      kind: 'sprite',
      sourceModule: 'src/art/fx.ts',
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `effects/${slug}.png`,
      files: [],
      tags: ['fx', 'particle', slug],
      status: 'pending',
    });
  }

  records.push({
    id: 'fx-anim:flame',
    name: 'Campfire Flame (Animated)',
    category: 'effects',
    subcategory: 'animated-fx',
    kind: 'animation',
    sourceModule: 'src/art/decor.ts',
    nativeWidth: 14,
    nativeHeight: 18,
    primaryFile: 'effects/flame.apng',
    files: [],
    animation: { name: 'flame', frames: 2, rate: 5, repeat: true, frameWidth: 14, frameHeight: 18 },
    tags: ['fx', 'animation', 'flame'],
    status: 'pending',
  });

  records.push({
    id: 'fx-anim:butterfly',
    name: 'Butterfly (Animated)',
    category: 'effects',
    subcategory: 'animated-fx',
    kind: 'animation',
    sourceModule: 'src/art/fx.ts',
    nativeWidth: 0,
    nativeHeight: 0,
    primaryFile: 'effects/butterfly.apng',
    files: [],
    animation: { name: 'butterfly', frames: 2, rate: 6, repeat: true, frameWidth: 0, frameHeight: 0 },
    tags: ['fx', 'animation', 'butterfly'],
    status: 'pending',
  });

  for (const key of PICKUP_KEYS) {
    records.push({
      id: `pickup:${key}`,
      name: `Pickup: ${key}`,
      category: 'effects',
      subcategory: 'pickups',
      kind: 'sprite',
      sourceModule: 'src/art/fx.ts',
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `effects/pickup-${key}.png`,
      files: [],
      tags: ['pickup', key],
      status: 'pending',
    });
  }

  // 6. UI Icons, Tokens, SVGs, Extension Icons
  for (const uiKey of Object.keys(UI_ICON_BUILDERS)) {
    const slug = uiKey.replace(':', '-');
    records.push({
      id: uiKey,
      name: `UI Icon: ${uiKey}`,
      category: 'ui',
      subcategory: 'icons',
      kind: 'icon',
      sourceModule: 'src/art/atlas.ts',
      catalogId: uiKey === 'food:treat' ? TREAT_ID : undefined,
      nativeWidth: 0,
      nativeHeight: 0,
      primaryFile: `ui/icons/${slug}.png`,
      files: [],
      tags: ['ui', 'icon', slug],
      status: 'pending',
    });
  }

  for (const size of [16, 48, 128] as const) {
    records.push({
      id: `ext-icon:${size}`,
      name: `Chrome Extension Icon ${size}×${size}`,
      category: 'ui',
      subcategory: 'extension-icons',
      kind: 'icon',
      sourceModule: 'public/icons/',
      nativeWidth: size,
      nativeHeight: size,
      primaryFile: `ui/icons/ext-icon-${size}.png`,
      files: [],
      tags: ['extension', 'icon', `${size}x${size}`],
      status: 'pending',
    });
  }

  const vectorComponents: { id: string; name: string; file: string; w: number; h: number }[] = [
    { id: 'ui-vec:panel', name: 'Storybook Panel Frame (.tw-panel)', file: 'ui/components/tw-panel.svg', w: 360, h: 200 },
    { id: 'ui-vec:buttons', name: 'Storybook Buttons & States (.tw-btn)', file: 'ui/components/tw-buttons-states.svg', w: 560, h: 180 },
    { id: 'ui-vec:medallion', name: 'Island Crest & Badge Tokens (.tw-medallion)', file: 'ui/components/tw-medallion.svg', w: 280, h: 140 },
    { id: 'ui-vec:heart-bar', name: 'Pipkin Bond Heart Meter', file: 'ui/components/tw-heart-bar.svg', w: 220, h: 72 },
    { id: 'ui-vec:sky-cycle', name: '24h Day/Night Sky Gradient Ramp', file: 'ui/components/tw-sky-gradients.svg', w: 680, h: 240 },
  ];
  for (const vc of vectorComponents) {
    records.push({
      id: vc.id,
      name: vc.name,
      category: 'ui',
      subcategory: 'components',
      kind: 'ui-component',
      sourceModule: 'src/ui/theme.css',
      nativeWidth: vc.w,
      nativeHeight: vc.h,
      primaryFile: vc.file,
      files: [],
      tags: ['ui', 'vector', 'svg', 'component'],
      status: 'pending',
    });
  }

  records.push({
    id: 'ui-tokens:design-tokens',
    name: 'TinyWorld Design Tokens & Figma Variables',
    category: 'ui',
    subcategory: 'tokens',
    kind: 'token',
    sourceModule: 'src/ui/theme.css',
    nativeWidth: 0,
    nativeHeight: 0,
    primaryFile: 'design-tokens.json',
    files: [],
    tags: ['tokens', 'colors', 'typography', 'spacing', 'radii', 'figma-variables'],
    status: 'pending',
  });

  return records;
}

export function isPlantId(id: string): id is PlantId {
  return PLANTS.some((p) => p.id === id);
}

export function isCreatureId(id: string): id is CreatureId {
  return CREATURES.some((c) => c.id === id);
}
