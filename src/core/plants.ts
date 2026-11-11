import { MS_MIN, PLANT_BY_ID, PLANT_STAGE_AT } from './catalog';
import { clamp } from './rng';
import type { PlacedObject, PlantId } from './types';

/** 0..1 growth progress. Negative elapsed time (clock moved backwards) counts as zero. */
export const plantProgress = (o: PlacedObject, now: number): number => {
  if (!o.plant) return 0;
  const def = PLANT_BY_ID[o.type as PlantId];
  if (!def) return 0;
  const total = def.growMinutes * MS_MIN;
  const elapsed = Math.max(0, now - o.plant.plantedAt) + o.plant.bonusMs;
  return clamp(elapsed / total, 0, 1);
}

/** 0 seed · 1 sprout · 2 growing · 3 mature · 4 blooming */
export const plantStage = (o: PlacedObject, now: number): number => {
  const p = plantProgress(o, now);
  let s = 0;
  for (let i = 0; i < PLANT_STAGE_AT.length; i++) if (p >= PLANT_STAGE_AT[i]) s = i;
  return s;
}

export const isBlooming = (o: PlacedObject, now: number) => !!o.plant && plantStage(o, now) === 4;

/** ms until fully bloomed (0 when done) */
export const msToBloom = (o: PlacedObject, now: number): number => {
  if (!o.plant) return 0;
  const def = PLANT_BY_ID[o.type as PlantId];
  const total = def.growMinutes * MS_MIN;
  return Math.max(0, total - (Math.max(0, now - o.plant.plantedAt) + o.plant.bonusMs));
}

export const MAX_WATERINGS = 2;
export const WATER_BONUS = 0.15;

export const canWater = (o: PlacedObject, now: number): boolean => {
  return !!o.plant && o.plant.waterCount < MAX_WATERINGS && plantProgress(o, now) < 1;
}

/** Watering shaves 15% of the total growth time (twice per growth cycle). */
export const applyWater = (o: PlacedObject) => {
  const def = PLANT_BY_ID[o.type as PlantId];
  o.plant!.bonusMs += def.growMinutes * MS_MIN * WATER_BONUS;
  o.plant!.waterCount += 1;
}

/** After harvesting, plants regrow from the sprout stage so there is no re-planting cost. */
export const resetAfterHarvest = (o: PlacedObject, now: number) => {
  const def = PLANT_BY_ID[o.type as PlantId];
  o.plant = { plantedAt: now - PLANT_STAGE_AT[1] * def.growMinutes * MS_MIN, bonusMs: 0, waterCount: 0 };
}
