# Tiny World — Testing & QA Guide

## 1. Automated Test Suite Overview

Tiny World uses a two-tier automated verification strategy:
1. **Vitest Unit & Integration Suite (`npm test`)**: **68 fast, deterministic tests across 6 test files** covering pure game rules, economy, plant relocation, atomic multi-select group moves, obstacle clearing, 50% selling, batch gardening (`waterAll`/`harvestAll`), Stages 1–10 coordinate invariance and unified green meadow terrain, player-customized terrain patches (`grass_patch`, `snow_patch`, `sand_patch`) with neighbor-aware edge blending masks and non-destructive under-placement, rotation (`rotateObject` + textures) across 23 dedicated directional items, 15 Pipkins + annoyance/10-action interactions, separated weather transitions, offline progression, clock edge cases, `v1 → v2` schema migrations, corruption recovery, multi-window IndexedDB concurrency, Figma asset export codecs/parity, and the local Figma organizer plugin.
2. **Playwright Real-Browser E2E Suite (`npm run test:e2e`)**: Launches headless Chrome/Edge against the production build (`dist/`), exercises `game.html`, `popup.html`, and `sidepanel.html`, verifies zero runtime/page errors, exercises Shop purchase, 50% Bag resale, Terrain patch purchase & placement (`customTerrain` persistence), plant relocation, atomic multi-select group moves, obstacle clearing rewards, asserts cross-window token synchronization, checks popup HUD vs toast spacing, and saves visual inspection screenshots in `test-results/`.

## 2. Test Matrix (`tests/`)

### `tests/core.test.ts` (34 tests)
- Single-collect guarantee on pickups (rapid repeated clicks cannot duplicate tokens).
- Tree & bush foraging cooldowns.
- Shop purchases, 50% resale selling (`sellItem` and `sellPlacedObject` with quantity/locked guards), and obstacle clearing (`clearObstacle`) with Bag rewards (`obstacleClearReward`: `rock` → `decor:stones`, `wildflowers` → `seed:daisy`, shop scenery kept in Bag) while protecting the Great Old Tree (`protected: true`).
- Batch gardening controls (`waterAll`, `harvestAll`) across multiple plants.
- Isometric grid placement validation: out-of-bounds, void corners, water vs. land rules (`reeds`, `bridge`), multi-tile footprints (`cottage` 2×2, `shed` 2×1), rotation (`rot: 0 | 1`), ground-layer (`path`) vs. object-layer stacking, non-destructive plant relocation preserving growth/waterings (`moveObject`), relocation of naturally generated scenery/landmarks, and atomic multi-select group translation (`moveObjects`, `canMoveObjects`).
- Full Stages 1 → 10 island expansion (`8×8` through `36×36`) verifying strict `(0, 0)` coordinate invariance, unlocked ground paths, and all 14 plant species + 15 Pipkin discovery unlocks.
- Unified green meadow terrain: asserts all 10 stages (`Stage 1`–`Stage 10`) have pure green meadow grass land by default (`GRASS` + `CLIFF` palettes, zero auto-generated biome strips).
- Customizable terrain patches: asserts purchasing & placing `snow_patch`, `sand_patch`, and `grass_patch` updates `state.customTerrain` non-destructively under existing paths, plants, buildings, and Pipkins; validates 4-bit neighbor masks (`sameMask` and `otherMask`) and persistence round-trip.
- Seasonal & desert decor: validates purchasing, inventory tracking, placement, and rotation across all 32 Winter, Christmas, Desert, and Beach/Summer items.
- Creature petting rate limits, rolling-window annoyance & soothing (`cheer`/`feedCreature`), all 10 contextual creature actions (`interactCreature`), affection level-up rewards, and name sanitization.

### `tests/systems.test.ts` (11 tests)
- Offline progression, 30-day inactivity cap (`OFFLINE_CAP_MS = 24h`, `MAX_PICKUPS = 6`), negative elapsed time, and extreme clock skew repair.
- Separated biome weather transitions (`rollWeather`, `activeWeather`, `nextEventEtaMs`), event cooldowns (`EVENT_MIN_GAP`), and Gentle Rain plant watering.
- Day/night cycle phase calculation, `custom` manual hour slider, and visual `biomeOverride` isolation from plant timestamps and real-clock `isRealNight`.
- Creature FSM AI (`tickActor`, `directActor`, `chooseState`, `react`), `36×36` BFS pathfinding (`maxLen = 96`), obstacle pocket recovery around the Great Old Tree, and nighttime sleep weighting.

### `tests/rotation.test.ts` (6 tests)
- Footprint dimension swapping and `rot: 0 | 1` texture registration across all dedicated rotatable decorations, paths, and buildings (`shed`, `shelter`, `windmill`, `observatory`, `sanctuary_bell`, `wood_deck`, etc.) plus in-place `rotateObject`.

### `tests/persistence.test.ts` (7 tests)
- Empty save initialization, rolling-backup corruption recovery, `v0` (`coins`) and `v1 → v2` schema migrations (preserving items/tokens while unlocking legacy locked ground tiles), JSON export/import validation, and concurrent `popup` + `full` `SaveStore` synchronization.

### `tests/figma-export.test.ts` (6 tests)
- Lossless PNG/GIF89a/APNG/crisp-pixel SVG codecs (`decodePng` verification), dynamic asset discovery parity across `CREATURES`/`PLANTS`/`ITEMS`/`STAGES`, design token extraction, isolated export validation, and SHA-256 cache reuse.

### `tests/figma-organizer-plugin.test.ts` (4 tests)
- Dynamic-page manifest contract validation, non-destructive classification and 7-page layout simulation across all 94 Figma frames, nested vector-frame preservation, Latin-1/Windows-1252 mojibake cleanup, idempotent re-runs, and unknown-frame safety.
