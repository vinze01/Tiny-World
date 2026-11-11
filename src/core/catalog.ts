import type { BiomeId, CreatureDef, CreatureId, ItemDef, PlantDef, PlantId, Category } from './types';

export const MS_MIN = 60_000;

// ---------------------------------------------------------------- plants
export const PLANTS: PlantDef[] = [
  { id: 'daisy', name: 'Daisy', desc: 'A cheerful little flower that blooms quickly.', seedPrice: 3, growMinutes: 2.5, yield: 4, stage: 1 },
  { id: 'bluebell', name: 'Bluebell', desc: 'Nodding blue bells that ring when the breeze passes.', seedPrice: 5, growMinutes: 5, yield: 8, stage: 1 },
  { id: 'sunflower', name: 'Sunflower', desc: 'Tall and golden, always facing the light.', seedPrice: 6, growMinutes: 8, yield: 12, stage: 1 },
  { id: 'mushroom', name: 'Spotted Mushroom', desc: 'A plump red cap. Sprig adores these.', seedPrice: 6, growMinutes: 6, yield: 9, stage: 1 },
  { id: 'berry', name: 'Tiny Berry Bush', desc: 'Sweet berries — Pipkins go wild for the treats.', seedPrice: 12, growMinutes: 12, yield: 20, stage: 2, treats: 1 },
  { id: 'glowflower', name: 'Glow Flower', desc: 'Petals that softly shine once the sun goes down.', seedPrice: 18, growMinutes: 18, yield: 32, stage: 2 },
  { id: 'waterlily', name: 'Water Lily', desc: 'A radiant floating lotus that drifts gracefully in water.', seedPrice: 22, growMinutes: 10, yield: 38, stage: 3 },
  { id: 'moonflower', name: 'Moonflower', desc: 'Luminous silver petals bathed in soft moonlight.', seedPrice: 30, growMinutes: 15, yield: 55, stage: 4 },
  { id: 'starbloom', name: 'Starbloom', desc: 'Glitters with stardust. Pipkins flock to its fragrance.', seedPrice: 45, growMinutes: 22, yield: 80, stage: 5, treats: 2 },
  { id: 'frostberry', name: 'Frostberry Bush', desc: 'Crystalline winter berries sparkling with chilly sweetness.', seedPrice: 55, growMinutes: 24, yield: 98, stage: 6, treats: 2 },
  { id: 'mistorchid', name: 'Mist Orchid', desc: 'Velvet forest blossoms sustained by cool woodland fog.', seedPrice: 68, growMinutes: 26, yield: 125, stage: 7 },
  { id: 'emberpepper', name: 'Ember Pepper', desc: 'Warm glowing pods cherished by cozy fireside Pipkins.', seedPrice: 82, growMinutes: 28, yield: 155, stage: 8, treats: 2 },
  { id: 'novabloom', name: 'Novabloom', desc: 'Radiant cosmic flower spinning with tiny nebulae.', seedPrice: 100, growMinutes: 30, yield: 195, stage: 9 },
  { id: 'everdream_lotus', name: 'Everdream Lotus', desc: 'Prismatic crown lotus humming with island harmony.', seedPrice: 125, growMinutes: 34, yield: 250, stage: 10, treats: 3 },
];
export const PLANT_BY_ID = Object.fromEntries(PLANTS.map((p) => [p.id, p])) as Record<PlantId, PlantDef>;

/** progress fractions where each growth stage begins: seed, sprout, growing, mature, blooming */
export const PLANT_STAGE_AT = [0, 0.15, 0.4, 0.7, 1];
export const PLANT_STAGE_NAMES = ['Seed', 'Sprout', 'Growing', 'Mature', 'Blooming'];

// ---------------------------------------------------------------- items
const base = (o: Partial<ItemDef> & Pick<ItemDef, 'id' | 'name' | 'desc' | 'category' | 'price'>): ItemDef => ({
  stage: 1,
  w: 1,
  d: 1,
  layer: 'object',
  blocks: true,
  placeOn: 'land',
  rotatable: true,
  ...o,
});

export const ITEMS: ItemDef[] = [
  // nature
  base({ id: 'oak', name: 'Oak Tree', desc: 'A leafy friend that shades the whole meadow.', category: 'nature', price: 30, clearCost: 20, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'pine', name: 'Pine Tree', desc: 'Evergreen and cozy, with a lovely smell.', category: 'nature', price: 26, stage: 2, clearCost: 12, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'birch', name: 'Birch Tree', desc: 'Pale bark and pink-gold leaves.', category: 'nature', price: 24, stage: 2, clearCost: 12, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'bush', name: 'Round Bush', desc: 'Soft and bouncy. Great for hiding behind.', category: 'nature', price: 12, clearCost: 5, anim: 'sway', tags: ['bush'], rotatable: false }),
  base({ id: 'mushrooms', name: 'Mushroom Ring', desc: 'A fairy ring of tiny mushrooms.', category: 'nature', price: 9, clearCost: 4, tags: ['mushroom'], blocks: false, layer: 'ground' }),
  base({ id: 'log', name: 'Mossy Log', desc: 'A cozy fallen log with moss on top.', category: 'nature', price: 12, clearCost: 5, tags: ['log'] }),
  base({ id: 'reeds', name: 'Pond Reeds', desc: 'Swaying reeds. Grows in the water.', category: 'nature', price: 6, clearCost: 3, placeOn: 'water', anim: 'sway', rotatable: false }),
  base({ id: 'stones', name: 'Small Rock', desc: 'A little cluster of smooth garden stones.', category: 'nature', price: 6, clearCost: 3, rotatable: true, tags: ['rock'] }),
  base({ id: 'flower_bed', name: 'Flower Bed', desc: 'Lush pastel blossoms framing any cozy walk.', category: 'nature', price: 14, layer: 'ground', blocks: false, rotatable: true, tags: ['flower'] }),
  base({ id: 'willow', name: 'Weeping Willow', desc: 'Gentle trailing boughs that sway over the water.', category: 'nature', price: 35, stage: 3, clearCost: 20, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'crystal_cluster', name: 'Crystal Cluster', desc: 'Shimmering aquamarine crystals humming with energy.', category: 'nature', price: 28, stage: 3, clearCost: 12, light: true, tags: ['rock', 'crystal'] }),
  base({ id: 'cherry', name: 'Cherry Blossom', desc: 'Soft pink blossoms drifting in the afternoon breeze.', category: 'nature', price: 42, stage: 4, clearCost: 20, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'glow_shrooms', name: 'Glow Mushrooms', desc: 'Bioluminescent purple caps that light up the night.', category: 'nature', price: 20, stage: 4, clearCost: 8, light: true, layer: 'ground', blocks: false, tags: ['mushroom', 'light'] }),
  base({ id: 'cloud_tree', name: 'Cloud Tree', desc: 'A mythical golden tree rooted high in the heavens.', category: 'nature', price: 65, stage: 5, clearCost: 20, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'snow_pine', name: 'Frosted Pine', desc: 'Crisp pine needles crowned in powdery snow.', category: 'nature', price: 48, stage: 6, biome: 'frostfall', clearCost: 12, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'ice_crystal', name: 'Glacier Spire', desc: 'Clear glacial ice reflecting pastel daylight.', category: 'nature', price: 40, stage: 6, biome: 'frostfall', clearCost: 12, light: true, tags: ['rock', 'crystal'] }),
  base({ id: 'autumn_maple', name: 'Amber Maple', desc: 'Crimson and honey leaves whispering softly.', category: 'nature', price: 56, stage: 7, biome: 'mistwood', clearCost: 20, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'mist_fern', name: 'Dewy Fern', desc: 'Soft woodland fronds shining with morning mist.', category: 'nature', price: 22, stage: 7, biome: 'mistwood', clearCost: 5, anim: 'sway', tags: ['bush'], rotatable: false }),
  base({ id: 'ember_fern', name: 'Ember Frond', desc: 'Warm copper leaves pulsing beside hot springs.', category: 'nature', price: 60, stage: 8, biome: 'emberglow', clearCost: 8, light: true, anim: 'sway', tags: ['bush', 'fire'], rotatable: false }),
  base({ id: 'basalt_spire', name: 'Warm Basalt', desc: 'Smooth volcanic rock warmed from below.', category: 'nature', price: 45, stage: 8, biome: 'emberglow', clearCost: 12, tags: ['rock'] }),
  base({ id: 'star_willow', name: 'Astral Willow', desc: 'Luminous midnight branches dusted with stardust.', category: 'nature', price: 85, stage: 9, biome: 'starlight', clearCost: 20, light: true, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'everdream_tree', name: 'Everdream Blossom', desc: 'A shimmering prismatic tree in eternal spring.', category: 'nature', price: 110, stage: 10, biome: 'everdream', clearCost: 20, light: true, anim: 'sway', tags: ['tree'], rotatable: false }),

  // furniture
  base({ id: 'bench', name: 'Wooden Bench', desc: 'A place to sit and watch the clouds.', category: 'furniture', price: 20, tags: ['bench'] }),
  base({ id: 'fence', name: 'Picket Fence', desc: 'A tidy little fence segment.', category: 'furniture', price: 8 }),
  base({ id: 'sign', name: 'Signpost', desc: 'Points the way to nowhere in particular.', category: 'furniture', price: 10 }),
  base({ id: 'pot', name: 'Flower Pot', desc: 'Terracotta pot with a happy bloom.', category: 'furniture', price: 8, anim: 'sway' }),
  base({ id: 'mailbox', name: 'Cozy Mailbox', desc: 'Tiny sky-mail postbox tucked by the path.', category: 'furniture', price: 14, tags: ['decor'] }),
  base({ id: 'birdhouse', name: 'Birdhouse', desc: 'A tiny home on a post. Someone might move in.', category: 'furniture', price: 18 }),
  base({ id: 'tea_set', name: 'Garden Tea Table', desc: 'Warm ceramic cups awaiting an afternoon breeze.', category: 'furniture', price: 28, stage: 2, tags: ['bench', 'decor'] }),
  base({ id: 'stone_bench', name: 'Marble Bench', desc: 'Carved white marble, cool and smooth to the touch.', category: 'furniture', price: 32, stage: 3, tags: ['bench'] }),
  base({ id: 'well', name: 'Wishing Well', desc: 'Draw crystal island water under a shingled hood.', category: 'furniture', price: 55, stage: 3, tags: ['water', 'decor'] }),
  base({ id: 'picnic_table', name: 'Picnic Table', desc: 'A wooden bench and table draped in gingham.', category: 'furniture', price: 36, stage: 3, w: 2, d: 1, tags: ['bench'] }),
  base({ id: 'gazing_globe', name: 'Gazing Basin', desc: 'Clear mountain water reflecting the celestial sky.', category: 'furniture', price: 45, stage: 4, tags: ['decor'] }),
  base({ id: 'gazebo', name: 'Garden Arch', desc: 'A charming rose-covered trellis archway.', category: 'furniture', price: 50, stage: 4, anim: 'sway', tags: ['decor'] }),
  base({ id: 'hammock', name: 'Breezy Hammock', desc: 'Soft woven hammock strung between garden posts.', category: 'furniture', price: 52, stage: 5, w: 2, d: 1, anim: 'sway', tags: ['bench'] }),
  base({ id: 'stargazer', name: 'Brass Telescope', desc: 'Look closely at constellations and distant shooting stars.', category: 'furniture', price: 80, stage: 5, tags: ['decor'] }),
  base({ id: 'hot_cocoa', name: 'Cocoa Stand', desc: 'Steaming mugs served beneath a striped awning.', category: 'furniture', price: 62, stage: 6, biome: 'frostfall', anim: 'smoke', tags: ['decor'] }),
  base({ id: 'moss_statue', name: 'Pipkin Statue', desc: 'An ancient mossy carving Pipkins love to greet.', category: 'furniture', price: 70, stage: 7, biome: 'mistwood', tags: ['decor'] }),
  base({ id: 'hot_tub', name: 'Cedar Soak Tub', desc: 'Steaming mineral bath carved from warm cedar.', category: 'furniture', price: 95, stage: 8, biome: 'emberglow', w: 2, d: 1, anim: 'smoke', tags: ['water', 'fire'] }),
  base({ id: 'star_dial', name: 'Astral Sundial', desc: 'Gilded celestial rings tracking every star.', category: 'furniture', price: 88, stage: 9, biome: 'starlight', light: true, tags: ['decor'] }),
  base({ id: 'harmony_fountain', name: 'Dream Fountain', desc: 'Tiered marble fountain singing in everlasting bloom.', category: 'furniture', price: 140, stage: 10, biome: 'everdream', w: 2, d: 2, light: true, tags: ['water', 'decor'] }),

  // lighting
  base({ id: 'lantern', name: 'Garden Lantern', desc: 'Glows warmly at night. Ember loves these.', category: 'lighting', price: 15, light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'campfire', name: 'Campfire', desc: 'Crackling logs ringed with stones.', category: 'lighting', price: 30, light: true, anim: 'flicker', tags: ['light', 'fire'] }),
  base({ id: 'torches', name: 'Bamboo Torch', desc: 'A crackling natural flame torch for shoreline paths.', category: 'lighting', price: 22, stage: 3, light: true, anim: 'flicker', tags: ['light', 'fire'] }),
  base({ id: 'fairy_lights', name: 'Fairy Post', desc: 'Hanging glass lantern jars filled with warm fireflies.', category: 'lighting', price: 38, stage: 4, light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'celestial_lamp', name: 'Starlight Pillar', desc: 'A floating celestial orb radiating golden warmth.', category: 'lighting', price: 65, stage: 5, light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'ice_lantern', name: 'Frost Lantern', desc: 'Carved ice housing a gentle cool-blue flame.', category: 'lighting', price: 48, stage: 6, biome: 'frostfall', light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'willow_wisp_lamp', name: 'Wisp Brazier', desc: 'Stone lantern sheltering floating emerald wisps.', category: 'lighting', price: 58, stage: 7, biome: 'mistwood', light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'ember_brazier', name: 'Ember Brazier', desc: 'Cast-iron basin crackling with volcanic warmth.', category: 'lighting', price: 72, stage: 8, biome: 'emberglow', light: true, anim: 'flicker', tags: ['light', 'fire'] }),
  base({ id: 'nebula_orb', name: 'Nebula Lantern', desc: 'Suspended glass sphere swirling with twilight stardust.', category: 'lighting', price: 86, stage: 9, biome: 'starlight', light: true, anim: 'flicker', tags: ['light'] }),
  base({ id: 'aurora_beacon', name: 'Aurora Spire', desc: 'Tall crystal spire cascading prism light at dusk.', category: 'lighting', price: 120, stage: 10, biome: 'everdream', light: true, anim: 'flicker', tags: ['light'] }),

  // paths
  base({ id: 'path', name: 'Garden Path', desc: 'Cobbled stepping stones.', category: 'paths', price: 2, layer: 'ground', blocks: false, rotatable: false }),
  base({ id: 'wood_deck', name: 'Boardwalk Tile', desc: 'Warm timber decking for cozy patios.', category: 'paths', price: 4, stage: 2, layer: 'ground', blocks: false, rotatable: true }),
  base({ id: 'bridge', name: 'Little Bridge', desc: 'Lets you (and Pipkins) cross the water.', category: 'paths', price: 25, layer: 'ground', blocks: false, placeOn: 'water', tags: ['bridge'] }),
  base({ id: 'stepping_stones', name: 'Stepping Stones', desc: 'River rocks that let you and Pipkins hop across the water.', category: 'paths', price: 15, stage: 3, layer: 'ground', blocks: false, placeOn: 'water', tags: ['bridge'] }),
  base({ id: 'petal_path', name: 'Blossom Path', desc: 'Stone tiles dusted with soft pink petals.', category: 'paths', price: 6, stage: 4, layer: 'ground', blocks: false, rotatable: false }),
  base({ id: 'lily_stepping', name: 'Lotus Stepping', desc: 'Broad emerald pads strong enough to cross any stream.', category: 'paths', price: 20, stage: 4, layer: 'ground', blocks: false, placeOn: 'water', rotatable: false, tags: ['bridge'] }),
  base({ id: 'mosaic_path', name: 'Mosaic Tile', desc: 'Fine lapis and pearl tiles fit for a palace.', category: 'paths', price: 5, stage: 5, layer: 'ground', blocks: false, rotatable: false }),
  base({ id: 'frost_paving', name: 'Iceflag Path', desc: 'Smooth frosted flagstones with pale shimmer.', category: 'paths', price: 8, stage: 6, biome: 'frostfall', layer: 'ground', blocks: false, rotatable: false }),
  base({ id: 'amber_cobble', name: 'Forest Cobble', desc: 'Mossy woodland cobbles edged with autumn leaves.', category: 'paths', price: 10, stage: 7, biome: 'mistwood', layer: 'ground', blocks: false, rotatable: false }),
  base({ id: 'star_paving', name: 'Starlight Path', desc: 'Indigo flagstones inlaid with glowing constellations.', category: 'paths', price: 14, stage: 9, biome: 'starlight', light: true, layer: 'ground', blocks: false, rotatable: false }),

  // buildings
  base({ id: 'cottage', name: 'Tiny Cottage', desc: 'A snug home with a red-tiled roof.', category: 'buildings', price: 120, w: 2, d: 2, anim: 'smoke', tags: ['cottage', 'building'] }),
  base({ id: 'shed', name: 'Storage Shed', desc: 'Handy wooden shed for garden things.', category: 'buildings', price: 70, w: 2, d: 1, tags: ['building'] }),
  base({ id: 'greenhouse', name: 'Greenhouse', desc: 'Glass walls and plenty of sun for seedlings.', category: 'buildings', price: 160, stage: 2, w: 2, d: 2, tags: ['building'] }),
  base({ id: 'shelter', name: 'Pipkin Shelter', desc: 'A snug mossy den for sleepy Pipkins.', category: 'buildings', price: 90, stage: 2, w: 2, d: 1, tags: ['building', 'shelter'] }),
  base({ id: 'workshop', name: 'Workshop', desc: 'A busy little workshop with a chimney.', category: 'buildings', price: 140, stage: 2, w: 2, d: 2, anim: 'smoke', tags: ['building'] }),
  base({ id: 'windmill', name: 'Mini Windmill', desc: 'A breezy wooden mill with spinning cloth sails.', category: 'buildings', price: 180, stage: 3, w: 2, d: 2, anim: 'sway', tags: ['building'] }),
  base({ id: 'observatory', name: 'Moon Observatory', desc: 'A domed stone sanctum dedicated to stargazers.', category: 'buildings', price: 260, stage: 4, w: 2, d: 2, tags: ['building'] }),
  base({ id: 'teahouse', name: 'Cloud Teahouse', desc: 'Airy timber pavilion wafting soothing herbal steam.', category: 'buildings', price: 290, stage: 5, w: 2, d: 2, anim: 'smoke', tags: ['building'] }),
  base({ id: 'sanctuary_bell', name: 'Celestial Shrine', desc: 'A grand sanctuary ringing with golden peace.', category: 'buildings', price: 380, stage: 5, w: 2, d: 2, tags: ['building'] }),
  base({ id: 'ski_lodge', name: 'Frostwood Cabin', desc: 'Snow-capped log lodge glowing beside warm hearths.', category: 'buildings', price: 340, stage: 6, biome: 'frostfall', w: 2, d: 2, anim: 'smoke', light: true, tags: ['building', 'shelter'] }),
  base({ id: 'alchemy_hut', name: 'Mistwood Apothecary', desc: 'Gabled herbalist cottage bursting with moss and jars.', category: 'buildings', price: 410, stage: 7, biome: 'mistwood', w: 2, d: 2, anim: 'smoke', tags: ['building'] }),
  base({ id: 'bathhouse', name: 'Ember Bathhouse', desc: 'Cozy tiled springhouse venting soothing steam.', category: 'buildings', price: 480, stage: 8, biome: 'emberglow', w: 2, d: 2, anim: 'smoke', light: true, tags: ['building', 'water'] }),
  base({ id: 'planetarium', name: 'Starlight Dome', desc: 'Celestial rotunda tracing silver planets overhead.', category: 'buildings', price: 560, stage: 9, biome: 'starlight', w: 2, d: 2, light: true, tags: ['building'] }),
  base({ id: 'dream_pavilion', name: 'Everdream Pavilion', desc: 'Pastel conservatory uniting every Pipkin in comfort.', category: 'buildings', price: 700, stage: 10, biome: 'everdream', w: 2, d: 2, light: true, tags: ['building', 'shelter'] }),

  // seasonal / special
  base({ id: 'pumpkin', name: 'Autumn Pumpkin', desc: 'A plump pumpkin for harvest season.', category: 'seasonal', price: 10 }),
  base({ id: 'snowman', name: 'Snowman', desc: 'A jolly snowman with a carrot nose.', category: 'seasonal', price: 14 }),
  base({ id: 'spring_pinwheel', name: 'Pinwheel', desc: 'Bright pastel vanes spinning in the breeze.', category: 'seasonal', price: 12, stage: 2, anim: 'sway', rotatable: false }),
  base({ id: 'windchime', name: 'Wind Chime', desc: 'Gentle bamboo chimes whispering in the breeze.', category: 'seasonal', price: 16, stage: 3, anim: 'sway' }),
  base({ id: 'zen_garden', name: 'Zen Garden', desc: 'Raked sand spirals around balanced river stones.', category: 'seasonal', price: 24, stage: 4, layer: 'ground', blocks: false }),
  base({ id: 'snow_fort', name: 'Snow Lantern Fort', desc: 'Cozy snow igloo niche lit gently from inside.', category: 'seasonal', price: 36, stage: 6, biome: 'frostfall', light: true }),
  base({ id: 'harvest_cart', name: 'Harvest Cart', desc: 'Wooden barrow stacked high with autumn bounty.', category: 'seasonal', price: 48, stage: 7, biome: 'mistwood', w: 2, d: 1 }),
  base({ id: 'fire_spinners', name: 'Ember Pinwheel', desc: 'Warm bronze wheel twinkling gently at twilight.', category: 'seasonal', price: 54, stage: 8, biome: 'emberglow', light: true, anim: 'sway', rotatable: false }),
  base({ id: 'dreamcatcher', name: 'Starlight Arch', desc: 'Ribbons of stardust hanging from a silver frame.', category: 'seasonal', price: 92, stage: 10, biome: 'everdream', light: true }),

  // scenery that only exists from the start (never sold)
  base({ id: 'tree_big', name: 'Great Old Tree', desc: 'The big ancient tree rooted at the heart of the island.', category: 'nature', price: 0, scenery: true, protected: true, anim: 'sway', tags: ['tree'], rotatable: false }),
  base({ id: 'rock', name: 'Large Rock', desc: 'A sturdy old boulder resting on the meadow.', category: 'nature', price: 0, scenery: true, clearCost: 8, rotatable: false, tags: ['rock'] }),
  base({ id: 'wildflowers', name: 'Wild Flowers', desc: 'Tiny flowers that sprouted on their own.', category: 'nature', price: 0, scenery: true, clearCost: 2, layer: 'ground', blocks: false, rotatable: false, tags: ['flower'] }),
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, ItemDef>;
export const SHOP_ITEMS = ITEMS.filter((i) => !i.scenery);
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'furniture', label: 'Furniture' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'paths', label: 'Paths' },
  { id: 'buildings', label: 'Buildings' },
  { id: 'seasonal', label: 'Seasonal' },
];

export const TREAT_ID = 'food:treat';
export const TREAT_PRICE = 3;
export const seedKey = (p: PlantId | string) => `seed:${p}`;
export const decorKey = (i: string) => `decor:${i}`;

/** 50% Nature Token resale value for sellable inventory items. */
export const resaleValue = (price: number): number => Math.max(0, Math.floor(price * 0.5));

/** Clear cost for a locked natural obstacle, or 0 if protected / non-removable. */
export const obstacleClearCost = (typeId: string): number => {
  const def = ITEM_BY_ID[typeId];
  if (!def || def.protected) return 0;
  if (typeof def.clearCost === 'number') return def.clearCost;
  if (def.tags?.includes('tree')) return 12;
  if (def.tags?.includes('rock')) return 8;
  return 5;
};

// ---------------------------------------------------------------- creatures
export const CREATURES: CreatureDef[] = [
  { id: 'mossi', name: 'Mossi', species: 'Meadow Pipkin', desc: 'A tiny green woodland Pipkin with leaf-like ears. Calm, curious and a lover of all things that grow.', personality: ['Calm', 'Curious', 'Loves plants'], likes: 'Naps under bushes', unlockHint: 'Mossi lives on your island from the very start.' },
  { id: 'bloop', name: 'Bloop', species: 'Droplet Pipkin', desc: 'A small blue jelly Pipkin that bounces everywhere. Easily distracted by anything shiny or wet.', personality: ['Playful', 'Energetic', 'Easily distracted'], likes: 'The pond', unlockHint: 'Something splashy lives in the pond. Try tapping the pond a few times.' },
  { id: 'ember', name: 'Ember', species: 'Flame Pipkin', desc: 'A warm-orange Pipkin with a glowing tail. Adventurous, friendly and a tiny bit mischievous.', personality: ['Adventurous', 'Friendly', 'Mischievous'], likes: 'Lanterns and campfires', unlockHint: 'Drawn to warm light. Place a lantern or a campfire.' },
  { id: 'puffin', name: 'Puffin', species: 'Cloud Pipkin', desc: 'A fluffy cream Pipkin with enormous ears. Sleepy, gentle and very affectionate.', personality: ['Sleepy', 'Gentle', 'Affectionate'], likes: 'Cozy cottages', unlockHint: 'Arrives when your island blossoms into the Blooming Grove.' },
  { id: 'sprig', name: 'Sprig', species: 'Fungal Pipkin', desc: 'A shy mushroom-capped Pipkin. Observant, helpful and happiest tending the garden.', personality: ['Shy', 'Observant', 'Helpful'], likes: 'Mushrooms', unlockHint: 'Grows near mushrooms. Harvest a Spotted Mushroom.' },
  { id: 'frosty', name: 'Frosty', species: 'Snowflake Pipkin', desc: 'An icy-blue Pipkin wearing crystal-tufted ears. Calm and tidy, forever admiring snowfall.', personality: ['Calm', 'Tidy', 'Serene'], likes: 'Snowfall and frost pines', unlockHint: 'Glides onto the island when you reach Frostfall Haven (Stage 6).' },
  { id: 'nimbus', name: 'Nimbus', species: 'Breeze Pipkin', desc: 'A billowy sky-cream Pipkin that floats lazily near windmills and high perches.', personality: ['Dreamy', 'Gentle', 'Breezy'], likes: 'Cloud trees and windmills', unlockHint: 'Rides the high winds once you reach Cloud Sanctuary (Stage 5) or place a Windmill.' },
  { id: 'glimmer', name: 'Glimmer', species: 'Prism Pipkin', desc: 'A sparkling violet Pipkin fascinated by crystal spires and glowing blossoms.', personality: ['Curious', 'Dazzled', 'Friendly'], likes: 'Crystals and wishing wells', unlockHint: 'Place or discover a Crystal Cluster to invite Glimmer.' },
  { id: 'cinder', name: 'Cinder', species: 'Hearth Pipkin', desc: 'A terracotta-scarlet Pipkin wrapped in soot-soft warmth. Bold and protective of firepits.', personality: ['Bold', 'Warm', 'Steady'], likes: 'Campfires and bathhouses', unlockHint: 'Arrives with Emberglow Valley (Stage 8) or after lighting a warm hearth.' },
  { id: 'luna', name: 'Luna', species: 'Crescent Pipkin', desc: 'A deep-indigo nocturnal Pipkin with golden crescent ears. Quietest beneath the stars.', personality: ['Shy', 'Nocturnal', 'Observant'], likes: 'Moonflowers and observatories', unlockHint: 'Drawn to moonlight — reach Moonlit Garden (Stage 4) or harvest a Moonflower.' },
  { id: 'pebble', name: 'Pebble', species: 'Terrapin Pipkin', desc: 'A round mossy-stone Pipkin who loves garden benches, paths, and counting pebbles.', personality: ['Patient', 'Stoic', 'Cozy'], likes: 'Garden stones and benches', unlockHint: 'Clear rocks or place Garden Stones while welcoming visitors on Stage 3+.' },
  { id: 'wisp', name: 'Wisp', species: 'Mist Pipkin', desc: 'A pale sage spirit Pipkin trailing soft mist droplets among forest ferns.', personality: ['Quiet', 'Graceful', 'Caring'], likes: 'Mist orchids and fog', unlockHint: 'Materializes in Mistwood Hollow (Stage 7) or rainy/foggy gardens.' },
  { id: 'astra', name: 'Astra', species: 'Star Pipkin', desc: 'A star-crowned cosmic Pipkin twinkling gently whenever shooting stars pass.', personality: ['Radiant', 'Energetic', 'Wonder-filled'], likes: 'Starblooms and telescopes', unlockHint: 'Visits Starlight Isles (Stage 9) or bright night gardens with Starlight lighting.' },
  { id: 'flurry', name: 'Flurry', species: 'Scarf Pipkin', desc: 'A rosy-cheeked winter sprite bundled in a plum wool scarf, always chasing drifts.', personality: ['Playful', 'Lively', 'Cheeky'], likes: 'Snowmen and cocoa stands', unlockHint: 'Appears alongside a Snowman or Cocoa Stand on Frostfall Haven (Stage 6+).' },
  { id: 'bloom', name: 'Bloom', species: 'Harmony Pipkin', desc: 'A petal-crowned royal Pipkin spreading evergreen harmony across floating isles.', personality: ['Radiant', 'Affectionate', 'Kind'], likes: 'Every flower and friend', unlockHint: 'Crowned guardian of Everdream Paradise (Stage 10).' },
];
export const CREATURE_BY_ID = Object.fromEntries(CREATURES.map((c) => [c.id, c])) as Record<CreatureId, (typeof CREATURES)[number]>;

export const AFFECTION_LEVELS = [0, 15, 40, 90, 180, 300];
export const AFFECTION_REWARDS = [0, 5, 10, 20, 30, 50];
export const affectionLevel = (a: number) => {
  let l = 0;
  for (let i = 0; i < AFFECTION_LEVELS.length; i++) if (a >= AFFECTION_LEVELS[i]) l = i;
  return l;
};

// ---------------------------------------------------------------- stages
export interface StageDef {
  id: number;
  name: string;
  biome: BiomeId;
  blurb: string;
  playable: boolean;
  /** requirements to expand *into* this stage */
  cost: number;
  needDecor: number;
  needHarvests: number;
  gridW: number;
  gridH: number;
}
export const STAGES: StageDef[] = [
  { id: 1, name: 'Little Meadow', biome: 'meadow', blurb: 'A tiny patch of land, a friendly Pipkin, and room to dream.', playable: true, cost: 0, needDecor: 0, needHarvests: 0, gridW: 8, gridH: 8 },
  { id: 2, name: 'Blooming Grove', biome: 'breeze', blurb: 'Expands to 12×12 with fertile groves and room for cottages.', playable: true, cost: 180, needDecor: 4, needHarvests: 2, gridW: 12, gridH: 12 },
  { id: 3, name: 'Crystal Pond', biome: 'crystal', blurb: 'Expands to 16×16 with shimmering waterways and riverbanks.', playable: true, cost: 320, needDecor: 8, needHarvests: 6, gridW: 16, gridH: 16 },
  { id: 4, name: 'Moonlit Garden', biome: 'mist', blurb: 'Expands to 20×20 with twilit terraces and calm mist.', playable: true, cost: 500, needDecor: 12, needHarvests: 10, gridW: 20, gridH: 20 },
  { id: 5, name: 'Cloud Sanctuary', biome: 'sky', blurb: 'Expands to 24×24 high above the clouds with sunlit glades.', playable: true, cost: 750, needDecor: 16, needHarvests: 15, gridW: 24, gridH: 24 },
  { id: 6, name: 'Frostfall Haven', biome: 'frostfall', blurb: 'Expands to 26×26 with snowy highlands and crystal ice pools.', playable: true, cost: 1050, needDecor: 20, needHarvests: 20, gridW: 26, gridH: 26 },
  { id: 7, name: 'Mistwood Hollow', biome: 'mistwood', blurb: 'Expands to 28×28 with amber autumn clearings and mossy springs.', playable: true, cost: 1400, needDecor: 24, needHarvests: 25, gridW: 28, gridH: 28 },
  { id: 8, name: 'Emberglow Valley', biome: 'emberglow', blurb: 'Expands to 30×30 with cozy geothermal springs and warm stone.', playable: true, cost: 1800, needDecor: 28, needHarvests: 30, gridW: 30, gridH: 30 },
  { id: 9, name: 'Starlight Isles', biome: 'starlight', blurb: 'Expands to 32×32 with celestial starstone terraces and sky pools.', playable: true, cost: 2250, needDecor: 32, needHarvests: 36, gridW: 32, gridH: 32 },
  { id: 10, name: 'Everdream Paradise', biome: 'everdream', blurb: 'Expands to a grand 36×36 archipelago of meadow, snow, spring, and starlight.', playable: true, cost: 2800, needDecor: 36, needHarvests: 42, gridW: 36, gridH: 36 },
];
export const MAX_PLAYABLE_STAGE = 10;

export const stageBiome = (stage: number): BiomeId => {
  const s = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))];
  return s?.biome ?? 'meadow';
};

// ---------------------------------------------------------------- achievements
export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number;
}
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_steps', name: 'First Steps', desc: 'Open your island for the first time.', reward: 3 },
  { id: 'green_thumb', name: 'Green Thumb', desc: 'Grow your first flower to full bloom.', reward: 5 },
  { id: 'new_friend', name: 'New Friend', desc: 'Discover another Pipkin.', reward: 8 },
  { id: 'cozy_corner', name: 'Cozy Corner', desc: 'Place five decorations.', reward: 8 },
  { id: 'little_explorer', name: 'Little Explorer', desc: 'Discover ten unique things.', reward: 12 },
  { id: 'night_owl', name: 'Night Owl', desc: 'Visit your island at night.', reward: 5 },
  { id: 'snack_time', name: 'Snack Time', desc: 'Feed a Pipkin a treat.', reward: 3 },
  { id: 'builder', name: 'Little Builder', desc: 'Place a building on your island.', reward: 10 },
  { id: 'harvest_ten', name: 'Bountiful', desc: 'Harvest ten plants.', reward: 10 },
  { id: 'best_friends', name: 'Best Friends', desc: 'Reach heart level 3 with a Pipkin.', reward: 12 },
  { id: 'tidy_island', name: 'Trailblazer', desc: 'Clear five natural obstacles to make room.', reward: 12 },
  { id: 'thrifty_trader', name: 'Market Helper', desc: 'Sell spare items from your Bag.', reward: 8 },
  { id: 'blooming_grove', name: 'Blooming Grove', desc: 'Expand your island into the Blooming Grove.', reward: 20 },
  { id: 'crystal_pond', name: 'Crystal Pond', desc: 'Expand your island into the Crystal Pond.', reward: 25 },
  { id: 'moonlit_garden', name: 'Moonlit Garden', desc: 'Expand your island into the Moonlit Garden.', reward: 35 },
  { id: 'cloud_sanctuary', name: 'Cloud Sanctuary', desc: 'Expand your island into the Cloud Sanctuary.', reward: 45 },
  { id: 'frostfall_haven', name: 'Frostfall Haven', desc: 'Expand your island into Frostfall Haven.', reward: 55 },
  { id: 'mistwood_hollow', name: 'Mistwood Hollow', desc: 'Expand your island into Mistwood Hollow.', reward: 65 },
  { id: 'emberglow_valley', name: 'Emberglow Valley', desc: 'Expand your island into Emberglow Valley.', reward: 75 },
  { id: 'starlight_isles', name: 'Starlight Isles', desc: 'Expand your island into Starlight Isles.', reward: 85 },
  { id: 'everdream_paradise', name: 'Everdream Paradise', desc: 'Expand your island into Everdream Paradise.', reward: 120 },
  { id: 'full_family', name: 'Cozy Gathering', desc: 'Befriend five Pipkins on your island.', reward: 25 },
  { id: 'growing_circle', name: 'Circle of Friends', desc: 'Befriend ten unique Pipkins.', reward: 50 },
  { id: 'paradise_kin', name: 'Pipkin Paradise', desc: 'Befriend all fifteen Pipkins.', reward: 100 },
  { id: 'rainy_day', name: 'Rainy Day', desc: 'Watch a gentle rain shower.', reward: 5 },
];

// ---------------------------------------------------------------- events
export interface EventDef {
  id: string;
  name: string;
  desc: string;
  weight: number;
  nightOnly?: boolean;
  dayOnly?: boolean;
}
export const EVENTS: EventDef[] = [
  { id: 'butterfly', name: 'Butterfly Visit', desc: 'A butterfly fluttered over and left a sparkle behind.', weight: 3, dayOnly: true },
  { id: 'rareflower', name: 'Rare Flower', desc: 'A rare flower popped up on its own.', weight: 2 },
  { id: 'shinystone', name: 'Shiny Stone', desc: 'A Pipkin dug up something shiny.', weight: 2 },
  { id: 'shootingstar', name: 'Shooting Star', desc: 'A star streaked across the night sky. Make a wish!', weight: 3, nightOnly: true },
  { id: 'mushroomgrow', name: 'Mushroom Sprout', desc: 'A mushroom sprouted near the tree.', weight: 2 },
  { id: 'twofriends', name: 'Pipkin Pals', desc: 'Two Pipkins stopped to say hello.', weight: 2 },
  { id: 'rain', name: 'Gentle Rain', desc: 'A soft shower watered your garden.', weight: 2 },
  { id: 'gift', name: 'Mysterious Gift', desc: 'A little gift appeared. Who left it?', weight: 1 },
];
export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export const MAX_PICKUPS = 6;
export const OFFLINE_CAP_MS = 24 * 60 * MS_MIN;
export const MAX_OFFLINE_EVENTS = 3;
export const SCHEMA_VERSION = 2;

export const STARTING_TOKENS = 30;
export const STARTING_SEEDS: Record<string, number> = { [seedKey('daisy')]: 2 };
export const NAME_MAX = 14;
export const allCreatureIds: CreatureId[] = CREATURES.map((c) => c.id);
