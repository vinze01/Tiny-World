import type Phaser from 'phaser';
import { CREATURES, PLANTS } from '../core/catalog';
import type { BiomeId, CreatureId, CustomTerrainKind, PlantId } from '../core/types';
import {
  alchemyHut, bathhouse, cottage, dreamPavilion, greenhouse, observatory, planetarium,
  sanctuaryBell, shed, shelter, skiLodge, teahouse, windmill, workshop,
} from './buildings';
import { ANIM_ORDER, ANIM_RATES, FRAME, FRAME_DEFS, buildCreatureSheet, drawPipkin } from './creatures';
import {
  amberCobble, auroraBeacon, beachChair, beachTowel, beachUmbrella, bench, birdhouse, bridge,
   campfireBase, campfireFlame, candyCane, celestialLamp, christmasStall, christmasTree,
  christmasWreath, desertLantern, desertTent, dreamcatcher, emberBrazier, fairyLights, fence,
  festiveStreetlamp, fireSpinners, frostPaving, frozenPond, gazingGlobe, gazebo, giftBoxes,
  hammock, harmonyFountain, harvestCart, hotCocoa, hotTub, iceLantern, iceSculpture, lantern,
  lilyStepping, mailbox, mosaicPath, mossStatue, nebulaOrb, oasisFountain, path, petalPath,
  picnicTable, picnicUmbrella, pot, reindeer, sandcastle, santasSleigh, seashellCluster, sign,
  snowBench, snowFort, snowyFence, springPinwheel, starDial, stargazer, starPaving,
  steppingStones, stoneBench, teaSet, torches, well, willowWispLamp, windchime, winterLantern,
  woodDeck, zenGarden,
} from './decor';
import {
  angryEmote, butterfly, cloud, coin, drop, emberFx, firefly, fogWispFx, glow, heart,
  leafFx, moon, musicEmote, note, petalFx, pickupSprite, question, raindrop, shyEmote,
  snowflakeFx, sparkle, star, sun, sweatEmote, zzz,
} from './fx';
import { buildCustomTerrainPatch, buildIsland, terrainPatchSprite, type IslandTex } from './island';
import {
  autumnMaple, basaltSpire, birch, bush, cactusFlower, cactusSmall, cactusTall, cherry,
  cloudTree, coconutTree, crystalCluster, desertPalm, desertRock, emberFern, everdreamTree,
  flowerBed, glowShrooms, iceCrystal, log, mistFern, mushroomRing, oakSmall, pine, pumpkin,
  reeds, rock, snowPine, snowman, starWillow, stones, treeBig, tropicalPlant, wildflowers,
  willow, type SpriteDef,
} from './nature';
import { plantSprite } from './plants';
import { Pix, ramp, lighten } from './pix';

export interface SpriteMeta { w: number; h: number; ax: number }

export const ITEM_BUILDERS: Record<string, () => SpriteDef> = {
  // terrain & landscaping
  grass_patch: () => terrainPatchSprite('grass'),
  snow_patch: () => terrainPatchSprite('snow'),
  sand_patch: () => terrainPatchSprite('sand'),

  // nature
  tree_big: treeBig, oak: oakSmall, pine, birch, bush, rock, stones, log, reeds,
  mushrooms: mushroomRing, wildflowers, flower_bed: flowerBed, pumpkin, snowman,
  willow, crystal_cluster: crystalCluster, cherry, glow_shrooms: glowShrooms, cloud_tree: cloudTree,
  snow_pine: snowPine, ice_crystal: iceCrystal, autumn_maple: autumnMaple, mist_fern: mistFern,
  ember_fern: emberFern, basalt_spire: basaltSpire, star_willow: starWillow, everdream_tree: everdreamTree,
  cactus_small: cactusSmall, cactus_tall: () => cactusTall(0), cactus_flower: cactusFlower,
  desert_rock: () => desertRock(0), desert_palm: desertPalm, tropical_plant: tropicalPlant,
  coconut_tree: coconutTree,

  // furniture
  bench, fence, sign, pot, birdhouse, mailbox, tea_set: teaSet, well, hammock,
  stone_bench: stoneBench, picnic_table: picnicTable, gazing_globe: gazingGlobe, gazebo, stargazer,
  hot_cocoa: hotCocoa, moss_statue: mossStatue, hot_tub: hotTub, star_dial: starDial, harmony_fountain: harmonyFountain,

  // lighting
  lantern, campfire: campfireBase, torches, fairy_lights: fairyLights, celestial_lamp: celestialLamp,
  ice_lantern: iceLantern, willow_wisp_lamp: willowWispLamp, ember_brazier: emberBrazier,
  nebula_orb: nebulaOrb, aurora_beacon: auroraBeacon,

  // paths
  path, wood_deck: woodDeck, bridge, stepping_stones: steppingStones, petal_path: petalPath,
  lily_stepping: lilyStepping, mosaic_path: mosaicPath, frost_paving: frostPaving,
  amber_cobble: amberCobble, star_paving: starPaving,

  // buildings
  cottage, shed, greenhouse, shelter, workshop,
  windmill, observatory, sanctuary_bell: sanctuaryBell,
  teahouse, ski_lodge: skiLodge, alchemy_hut: alchemyHut, bathhouse, planetarium, dream_pavilion: dreamPavilion,

  // seasonal (winter, christmas, desert, summer, other)
  frozen_pond: frozenPond, winter_lantern: () => winterLantern(0), snow_bench: () => snowBench(0),
  ice_sculpture: () => iceSculpture(0), snowy_fence: () => snowyFence(0),
  christmas_tree: christmasTree, reindeer: () => reindeer(0), gift_boxes: () => giftBoxes(0),
  candy_cane: () => candyCane(0), christmas_wreath: () => christmasWreath(0),
  santas_sleigh: () => santasSleigh(0), festive_streetlamp: festiveStreetlamp,
  christmas_stall: () => christmasStall(0),
  desert_tent: () => desertTent(0), oasis_fountain: oasisFountain, desert_lantern: () => desertLantern(0),
  beach_umbrella: () => beachUmbrella(0), beach_chair: () => beachChair(0),
  sandcastle: () => sandcastle(0), beach_towel: () => beachTowel(0),
  seashell_cluster: seashellCluster, picnic_umbrella: () => picnicUmbrella(0),
  spring_pinwheel: springPinwheel, windchime, zen_garden: zenGarden,
  snow_fort: snowFort, harvest_cart: harvestCart, fire_spinners: fireSpinners, dreamcatcher,
};

export const ROTATED_BUILDERS: Record<string, (rot: 0 | 1) => SpriteDef> = {
  bench, fence, sign, birdhouse, mailbox, tea_set: teaSet, well, hammock, hot_cocoa: hotCocoa,
  moss_statue: mossStatue, hot_tub: hotTub, star_dial: starDial, harmony_fountain: harmonyFountain,
  bridge, wood_deck: woodDeck, stone_bench: stoneBench, picnic_table: picnicTable, gazebo,
  snow_fort: snowFort, harvest_cart: harvestCart, dreamcatcher,
  cactus_tall: cactusTall, desert_rock: desertRock,
  winter_lantern: winterLantern, snow_bench: snowBench, ice_sculpture: iceSculpture, snowy_fence: snowyFence,
  reindeer, gift_boxes: giftBoxes, candy_cane: candyCane, christmas_wreath: christmasWreath,
  santas_sleigh: santasSleigh, christmas_stall: christmasStall,
  desert_tent: desertTent, desert_lantern: desertLantern,
  beach_umbrella: beachUmbrella, beach_chair: beachChair, sandcastle, beach_towel: beachTowel,
  picnic_umbrella: picnicUmbrella,
  cottage, shed, greenhouse, shelter, workshop,
  windmill, observatory, sanctuary_bell: sanctuaryBell,
  teahouse, ski_lodge: skiLodge, alchemy_hut: alchemyHut, bathhouse, planetarium, dream_pavilion: dreamPavilion,
};

export const seedBag = (col: number): SpriteDef => {
  const p = new Pix(20, 22);
  const bag = ramp(0xc99c62);
  p.blob(10, 14, 7, 6.5, bag, 0.15, 3);
  p.rect(7, 5, 6, 3, bag[2]);
  p.set(6, 4, bag[3]); p.set(13, 4, bag[2]);
  p.rect(6, 7, 8, 2, 0xc84a4a);
  p.ellipse(10, 14, 2.5, 2.5, col);
  p.set(10, 14, 0xfff6a8);
  p.set(9, 16, 0x4a9a42); p.set(10, 17, 0x4a9a42);
  p.outline();
  return { pix: p, ax: 10 };
};

export const treatSprite = (): SpriteDef => {
  const p = new Pix(20, 20);
  const b = ramp(0xe84a6a);
  p.blob(10, 11, 5.5, 5.5, b, 0.1, 2);
  p.set(8, 9, 0xffc4d4); p.set(7, 10, 0xffc4d4);
  p.set(9, 5, 0x4a9a42); p.set(10, 5, 0x66bd47); p.set(11, 5, 0x4a9a42); p.set(10, 4, 0x66bd47);
  p.outline();
  return { pix: p, ax: 10 };
};

export const SEED_COL: Record<PlantId, number> = {
  daisy: 0xfffaf0,
  sunflower: 0xffd23a,
  bluebell: 0x7a9cff,
  mushroom: 0xe84a4a,
  berry: 0xe83a5a,
  glowflower: 0x8ae8f0,
  waterlily: 0xff8fb3,
  moonflower: 0xc4b5fd,
  starbloom: 0xfde047,
  frostberry: 0x7dd3fc,
  mistorchid: 0xc084fc,
  emberpepper: 0xf97316,
  novabloom: 0x818cf8,
  everdream_lotus: 0xf472b6,
};

let built = false;
const metas = new Map<string, SpriteMeta>();
const icons = new Map<string, string>();
const islands = new Map<string, IslandTex>();

export const UI_ICON_BUILDERS: Record<string, () => SpriteDef> = {
  'food:treat': () => treatSprite(),
  'ui:token': () => coin(16),
  'item:pond': () => drop(),
};

export const FX_BUILDERS: Record<string, () => SpriteDef> = {
  'fx:flame0': () => campfireFlame(0),
  'fx:flame1': () => campfireFlame(1),
  'fx:heart': () => heart(),
  'fx:sparkle': () => sparkle(),
  'fx:zzz': () => zzz(),
  'fx:drop': () => drop(),
  'fx:leaf': () => leafFx(),
  'fx:note': () => note(),
  'fx:question': () => question(),
  'fx:star': () => star(),
  'fx:angry': () => angryEmote(),
  'fx:sweat': () => sweatEmote(),
  'fx:shy': () => shyEmote(),
  'fx:music': () => musicEmote(),
  'fx:raindrop': () => raindrop(),
  'fx:snowflake': () => snowflakeFx(),
  'fx:petal': () => petalFx(),
  'fx:ember': () => emberFx(),
  'fx:fog': () => fogWispFx(),
  'fx:firefly': () => firefly(),
  'fx:glow': () => glow(),
  'fx:bfly0': () => butterfly(0),
  'fx:bfly1': () => butterfly(1),
  'fx:cloud0': () => cloud(0),
  'fx:cloud1': () => cloud(1),
  'fx:cloud2': () => cloud(2),
  'fx:moon': () => moon(),
  'fx:sun': () => sun(),
  'fx:token': () => coin(14),
};

export const PICKUP_KEYS = ['sparkle', 'gift', 'stone', 'rareflower', 'mushroom', 'wish'] as const;

export const PICKUP_BUILDERS: Record<string, () => SpriteDef> = Object.fromEntries(
  PICKUP_KEYS.map((k) => [`pickup:${k}`, () => pickupSprite(k)]),
);

const ensureBuilt = () => {
  if (built) return;
  built = true;
  const saveIcon = (k: string, d: SpriteDef) => {
    metas.set(k, { w: d.pix.w, h: d.pix.h, ax: d.ax });
    if (typeof document !== 'undefined') icons.set(k, d.pix.toCanvas().toDataURL());
  };
  for (const [id, fn] of Object.entries(ITEM_BUILDERS)) {
    const rotFn = ROTATED_BUILDERS[id];
    if (rotFn) {
      const d0 = rotFn(0);
      saveIcon(`item:${id}`, d0);
      saveIcon(`item:${id}:0`, d0);
      saveIcon(`decor:${id}`, d0);
      const d1 = rotFn(1);
      saveIcon(`item:${id}:1`, d1);
    } else {
      const d = fn();
      saveIcon(`item:${id}`, d);
      saveIcon(`decor:${id}`, d);
    }
  }
  for (const pl of PLANTS) {
    for (let s = 0; s <= 4; s++) {
      const d = plantSprite(pl.id, s);
      metas.set(`plant:${pl.id}:${s}`, { w: d.pix.w, h: d.pix.h, ax: d.ax });
      if (s === 4) saveIcon(`plant:${pl.id}`, d);
    }
    saveIcon(`seed:${pl.id}`, seedBag(SEED_COL[pl.id]));
  }
  for (const c of CREATURES) {
    const pix = drawPipkin(c.id, FRAME_DEFS.idle[0]);
    saveIcon(`creature:${c.id}`, { pix, ax: FRAME / 2 });
  }
  for (const [k, build] of Object.entries(UI_ICON_BUILDERS)) saveIcon(k, build());
};

/** Data-URI icon for Vue panels. Generated once and cached. */
export const iconUrl = (key: string): string => {
  ensureBuilt();
  return icons.get(key) ?? icons.get('ui:token') ?? '';
};

export const spriteMeta = (key: string): SpriteMeta => {
  ensureBuilt();
  return metas.get(key) ?? { w: 32, h: 32, ax: 16 };
};

export const itemTexKey = (id: string, rot: 0 | 1 = 0): { key: string; flip: boolean } => {
  ensureBuilt();
  if (metas.has(`item:${id}:${rot}`)) {
    return { key: `item:${id}:${rot}`, flip: false };
  }
  return { key: `item:${id}`, flip: rot === 1 };
};

export const islandTexKey = (stage: number, biome: BiomeId, frame: number) =>
  `island:${stage}:${biome}:${frame}`;

export const customTerrainTexKey = (kind: CustomTerrainKind, sameMask: number, otherMask = 0) =>
  `terrain:custom:${kind}:${sameMask & 15}:${otherMask & 15}`;

const customTerrainCache = new Map<string, IslandTex>();

export const getCustomTerrainTex = (kind: CustomTerrainKind, sameMask: number, otherMask = 0): IslandTex => {
  const key = customTerrainTexKey(kind, sameMask, otherMask);
  let t = customTerrainCache.get(key);
  if (!t) {
    t = buildCustomTerrainPatch(kind, sameMask & 15, otherMask & 15);
    customTerrainCache.set(key, t);
  }
  return t;
};

export const ensureCustomTerrainTexture = (
  scene: Phaser.Scene,
  kind: CustomTerrainKind,
  sameMask: number,
  otherMask = 0,
): string => {
  const key = customTerrainTexKey(kind, sameMask, otherMask);
  if (!scene.textures.exists(key)) {
    const tex = getCustomTerrainTex(kind, sameMask, otherMask);
    scene.textures.addCanvas(key, tex.pix.toCanvas());
  }
  return key;
};

export const getIsland = (stage: number, frame: number, biomeOverride?: BiomeId | null): IslandTex => {
  const b: BiomeId = biomeOverride ?? 'meadow';
  const k = `${stage}:${b}:${frame}`;
  let t = islands.get(k);
  if (!t) {
    t = buildIsland(stage, frame, b);
    islands.set(k, t);
  }
  return t;
};

/** Lazily render & upload the 3 water-animation island frames for a specific stage & biome. */
export const ensureIslandTextures = (scene: Phaser.Scene, stage: number, biomeOverride?: BiomeId | null) => {
  const b: BiomeId = biomeOverride ?? 'meadow';
  const tex = scene.textures;
  for (const f of [0, 1, 2]) {
    const key = islandTexKey(stage, b, f);
    if (!tex.exists(key)) {
      const isl = getIsland(stage, f, b);
      tex.addCanvas(key, isl.pix.toCanvas());
    }
  }
};

/** Register sprites, FX, pickups and creatures in Phaser's shared TextureManager / AnimationManager. */
export const registerPhaserAssets = (scene: Phaser.Scene) => {
  ensureBuilt();
  const tex = scene.textures;
  if (tex.exists('item:tree_big')) return;
  const add = (key: string, d: SpriteDef) => {
    metas.set(key, { w: d.pix.w, h: d.pix.h, ax: d.ax });
    tex.addCanvas(key, d.pix.toCanvas());
  };
  for (const [id, fn] of Object.entries(ITEM_BUILDERS)) {
    const rotFn = ROTATED_BUILDERS[id];
    if (rotFn) {
      add(`item:${id}`, rotFn(0));
      add(`item:${id}:0`, rotFn(0));
      add(`item:${id}:1`, rotFn(1));
    } else {
      add(`item:${id}`, fn());
    }
  }
  for (const pl of PLANTS) for (let s = 0; s <= 4; s++) add(`plant:${pl.id}:${s}`, plantSprite(pl.id, s));
  ensureIslandTextures(scene, 1, 'meadow');

  for (const [k, build] of Object.entries(FX_BUILDERS)) add(k, build());
  for (const [k, build] of Object.entries(PICKUP_BUILDERS)) add(k, build());

  // creature sprite sheets + animations
  for (const c of CREATURES) {
    const { sheet, frames } = buildCreatureSheet(c.id);
    const key = `creature:${c.id}`;
    const t = tex.addCanvas(key, sheet.toCanvas())!;
    for (const f of frames) t.add(f.name, 0, f.x, 0, FRAME, FRAME);
    for (const anim of ANIM_ORDER) {
      const spec = ANIM_RATES[anim];
      const count = FRAME_DEFS[anim].length;
      const seq = spec.seq ?? Array.from({ length: count }, (_, i) => i);
      scene.anims.create({
        key: `${c.id}:${anim}`,
        frames: seq.map((n) => ({ key, frame: `${anim}_${n}` })),
        frameRate: spec.rate,
        repeat: spec.repeat ? -1 : 0,
      });
    }
  }
  scene.anims.create({ key: 'flame', frames: [{ key: 'fx:flame0' }, { key: 'fx:flame1' }], frameRate: 5, repeat: -1 });
  scene.anims.create({ key: 'bfly', frames: [{ key: 'fx:bfly0' }, { key: 'fx:bfly1' }], frameRate: 8, repeat: -1 });
};

export { lighten };
export type { CreatureId };
