# AGENTS.md — Contributor & Agent Guide for Tiny World

## Repository Structure
- `src/core/` — **Pure TypeScript game logic** (zero DOM, Vue, or Phaser imports).
  - `types.ts`: Serializable `GameState` and action/effect contracts.
  - `catalog.ts`: Definitions and economy balancing for plants, decorations, buildings, Pipkins, stages, achievements, and random events.
  - `grid.ts`: `32×16` isometric coordinate math, terrain maps (`Stage 1`–`Stage 10`), single/group footprint collision checks (`canPlace`, `canMoveObjects`), walkability grid (`walkGrid`), and BFS pathfinding (`findPath`).
  - `plants.ts`: Timestamp-based plant growth (`plantProgress`, `plantStage`), watering, and sprout regrowth after harvest.
  - `daycycle.ts`: Morning / Daytime / Sunset / Night sky colors and lighting interpolation.
  - `events.ts`: Weighted random world events (`rollEvent`) and bounded offline progression (`applyOffline`).
  - `creatureAI.ts`: Pipkin finite-state machine (`idle`, `wander`, `inspect`, `interact`, `rest`, `sleep`).
  - `actions.ts`: Pure state mutators (`wake`, `collectPickup`, `interact`, `tapPond`, `buy`, `placeItem`, `moveObject`, `moveObjects`, `rotateObject`, `removeObject`, `plantSeed`, `waterPlant`, `harvestPlant`, `petCreature`, `feedCreature`, `renameCreature`, `expandIsland`, `setSettings`, `setTutorial`, `tickEvent`).
  - `persistence.ts`: Authoritative IndexedDB `SaveStore` using Web Locks, BroadcastChannel sync, checksums, rolling backup recovery, and JSON export/import validation.
- `src/art/` — **Procedural pixel-art asset pipeline** (`pix.ts`, `island.ts`, `nature.ts`, `decor.ts`, `buildings.ts`, `plants.ts`, `creatures.ts`, `fx.ts`, `atlas.ts`).
- `src/game/` — **Phaser 3 world renderer** (`WorldScene.ts`, `WorldCanvas.vue`).
- `src/ui/` — **Vue 3 storybook interface** (`App.vue`, `InventoryShopDrawer.vue`, `CreaturesPanel.vue`, `JournalPanel.vue`, `SettingsModal.vue`, `OnboardingCard.vue`, `theme.css`).
- `src/stores/` — Pinia reactive store (`gameStore.ts`).
- `src/audio/` — Procedural Web Audio synthesizer (`sound.ts`).
- `src/entries/` — Extension surface entrypoints (`popup.ts`, `sidepanel.ts`, `game.ts`).
- `tests/` — Vitest unit and integration tests (`core.test.ts`, `systems.test.ts`, `rotation.test.ts`, `persistence.test.ts`, `figma-export.test.ts`, `figma-organizer-plugin.test.ts`).
- `scripts/` — Icon generator (`make-icons.mjs`), Playwright E2E runner (`e2e.mjs`), and dev-only Code-to-Figma exporter (`export-figma.mjs`, `figma/`).
- `tools/` — Standalone dev tools (`asset-gallery/` local previewer and `figma-organizer-plugin/` local Figma workspace plugin).

## Key Engineering Rules
1. **Keep `src/core/` Pure**: Never import `window`, `document`, `phaser`, or `vue` inside `src/core/` (except Web Locks / BroadcastChannel / IndexedDB inside `persistence.ts`). Pass timestamps and RNG via `Ctx`.
2. **All Mutations Go Through `SaveStore.mutate`**: Never mutate `store.state` directly from Vue components when changing persistent game state; always invoke an action through `SaveStore` so multi-window locks and rolling backups stay authoritative.
3. **Maintain Pixel Art Coherence**: All world sprites must use `Pix` / `Iso` in `src/art/`, finish with `.outline(OUTLINE)` (`0x2a2236`), and use top-left lighting ramps.
4. **Verify Before Finishing**: Always run `npm test`, `npm run build`, and `npm run test:e2e` after changes.
