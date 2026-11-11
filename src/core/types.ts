/** Shared game-state types. Everything in GameState must be JSON-serialisable. */

export type Category = 'nature' | 'furniture' | 'lighting' | 'paths' | 'buildings' | 'seasonal';
export type Layer = 'ground' | 'object';
export type PlaceOn = 'land' | 'water' | 'any';
export type Terrain =
  | 'void'
  | 'grass'
  | 'plot'
  | 'water'
  | 'sand'
  | 'snow'
  | 'ice'
  | 'autumn'
  | 'hotspring'
  | 'starstone';
export type BiomeId =
  | 'meadow'
  | 'breeze'
  | 'crystal'
  | 'mist'
  | 'sky'
  | 'frostfall'
  | 'mistwood'
  | 'emberglow'
  | 'starlight'
  | 'everdream';
export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'wind' | 'sparkles';
export type EmotionType = 'happy' | 'curious' | 'sleepy' | 'excited' | 'shy' | 'annoyed' | 'angry' | 'relaxed';
export type CreatureInteractionKind =
  | 'pet'
  | 'feed'
  | 'play'
  | 'wave'
  | 'call'
  | 'observe'
  | 'gift'
  | 'cheer'
  | 'follow'
  | 'rest';
export type ParticleDensity = 'low' | 'normal' | 'high';
export type PlantId =
  | 'daisy'
  | 'sunflower'
  | 'bluebell'
  | 'mushroom'
  | 'berry'
  | 'glowflower'
  | 'waterlily'
  | 'moonflower'
  | 'starbloom'
  | 'frostberry'
  | 'mistorchid'
  | 'emberpepper'
  | 'novabloom'
  | 'everdream_lotus';
export type CreatureId =
  | 'mossi'
  | 'bloop'
  | 'ember'
  | 'puffin'
  | 'sprig'
  | 'frosty'
  | 'nimbus'
  | 'glimmer'
  | 'cinder'
  | 'luna'
  | 'pebble'
  | 'wisp'
  | 'astra'
  | 'flurry'
  | 'bloom';
export type DayPhase = 'morning' | 'day' | 'sunset' | 'night';
export type CycleMode = 'real' | 'fast' | 'day' | 'night' | 'custom';

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  category: Category;
  price: number;
  /** island stage required before it appears in the shop */
  stage: number;
  /** footprint (cells) when not rotated */
  w: number;
  d: number;
  layer: Layer;
  /** blocks creature walking and other objects */
  blocks: boolean;
  placeOn: PlaceOn;
  rotatable: boolean;
  /** ambient behaviour hints for the renderer */
  anim?: 'sway' | 'flicker' | 'smoke' | 'none';
  light?: boolean;
  /** items that scenery spawns with and the player cannot pick up */
  scenery?: boolean;
  /** nature token cost to permanently clear a locked scenery obstacle */
  clearCost?: number;
  /** essential landmark obstacle that cannot be removed */
  protected?: boolean;
  /** optional biome theme tag */
  biome?: BiomeId;
  /** hint used by creature AI to find points of interest */
  tags?: string[];
}

export interface PlantDef {
  id: PlantId;
  name: string;
  desc: string;
  seedPrice: number;
  growMinutes: number;
  yield: number;
  stage: number;
  /** treats produced on harvest */
  treats?: number;
}

export interface CreatureDef {
  id: CreatureId;
  name: string;
  species: string;
  desc: string;
  personality: string[];
  likes: string;
  unlockHint: string;
}

export interface PlacedObject {
  id: string;
  type: string;
  gx: number;
  gy: number;
  /** 0 | 1 – 1 means mirrored */
  rot: 0 | 1;
  placedAt: number;
  locked?: boolean;
  plant?: PlantRuntime;
}

export interface PlantRuntime {
  plantedAt: number;
  /** shaved growth time in ms from watering */
  bonusMs: number;
  waterCount: number;
}

export type PickupKind = 'sparkle' | 'gift' | 'stone' | 'rareflower' | 'mushroom' | 'wish';

export interface Pickup {
  id: string;
  kind: PickupKind;
  amount: number;
  gx: number;
  gy: number;
  createdAt: number;
  /** optional bonus item id granted along with tokens (e.g. a free seed) */
  bonusItem?: string;
}

export interface CreatureState {
  id: CreatureId;
  name: string;
  affection: number;
  discoveredAt: number;
  lastPetRewardAt: number;
  lastPetAt: number;
  lastFedAt: number;
  petCount: number;
  fedCount: number;
  /** recent pet timestamps used for annoyance rolling window */
  petWindowTimestamps?: number[];
  /** timestamp until which this creature stays annoyed from excessive petting */
  annoyedUntil?: number;
  /** current lightweight emotional state */
  emotion?: EmotionType;
  /** timestamp until emotion reverts naturally */
  emotionUntil?: number;
  /** cooldown / timestamp tracking for contextual interactions */
  interactionCooldowns?: Record<string, number>;
}

export interface Settings {
  sound: boolean;
  volume: number; // 0..1
  ambient: boolean;
  reducedMotion: boolean;
  cycle: CycleMode;
  hints: boolean;
  /** manual 24-hour visual override when cycle === 'custom' (0..23.99), visual only */
  manualHour: number | null;
  /** whether dynamic weather effects render */
  weatherEnabled: boolean;
  /** weather/ambient particle density */
  particleDensity: ParticleDensity;
  /** optional biome sky/palette preview override, visual only */
  biomeOverride: BiomeId | null;
}

export interface Tutorial {
  step: number;
  done: boolean;
  /** persisted flags for step objectives */
  tappedTree: boolean;
  tappedPond: boolean;
  tappedCreature: boolean;
  skipped: boolean;
}

export interface Stats {
  opens: number;
  nightVisits: number;
  pondTaps: number;
  treeTaps: number;
  decorPlaced: number;
  buildingsPlaced: number;
  lightsPlaced: number;
  planted: number;
  watered: number;
  tokensEarned: number;
  tokensSpent: number;
  pets: number;
  feeds: number;
  harvested: Record<string, number>;
  bloomed: number;
  clearedObstacles?: number;
  itemsSold?: number;
  pipkinInteractions?: number;
}

export interface EventsState {
  lastEventAt: number;
  recent: string[];
  rainUntil: number;
  counts: Record<string, number>;
  weather?: WeatherType;
  weatherUntil?: number;
}

export interface GameState {
  schema: number;
  rev: number;
  seed: number;
  createdAt: number;
  lastActive: number;
  tokens: number;
  stage: number;
  inventory: Record<string, number>;
  objects: PlacedObject[];
  pickups: Pickup[];
  creatures: CreatureState[];
  discovered: Record<string, number>;
  achievements: Record<string, number>;
  stats: Stats;
  events: EventsState;
  forage: Record<string, number>;
  settings: Settings;
  tutorial: Tutorial;
  nextId: number;
}

export type Effect =
  | { type: 'tokens'; amount: number; gx?: number; gy?: number }
  | { type: 'achievement'; id: string }
  | { type: 'discover'; id: string }
  | { type: 'creature-arrived'; id: CreatureId }
  | { type: 'toast'; text: string }
  | { type: 'level-up'; creature: CreatureId; level: number }
  | { type: 'bloom'; objectId: string }
  | { type: 'emotion'; creature: CreatureId; emotion: EmotionType; emote?: string }
  | { type: 'weather'; weather: WeatherType }
  | { type: 'cleared'; objectId: string; cost: number; gx: number; gy: number }
  | { type: 'sold'; id: string; qty: number; amount: number }
  | {
      type: 'fx';
      name: 'butterfly' | 'shootingstar' | 'rain' | 'dig' | 'twoFriends' | 'sparkle' | 'confetti' | 'clear';
      creature?: CreatureId;
      gx?: number;
      gy?: number;
    }
  | { type: 'expanded'; stage: number }
  | { type: 'welcome-back'; lines: string[] };

export interface ActionResult {
  ok: boolean;
  reason?: string;
  effects: Effect[];
  data?: Record<string, unknown>;
}

export interface Ctx {
  now: number;
  rng: () => number;
}
