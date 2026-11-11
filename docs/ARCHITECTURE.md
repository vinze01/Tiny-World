# TinyWorld — System Architecture

## 1. Architectural Overview
TinyWorld is a Chrome Manifest V3 extension structured into four cleanly separated layers so that all gameplay rules remain 100% deterministic, offline-capable, and unit-testable without a DOM or WebGL context:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Extension Surfaces (popup.html · sidepanel.html · game.html)            │
├───────────────────────────────────┬─────────────────────────────────────┤
│ Vue 3 Storybook UI (src/ui/)      │ Phaser 3 Isometric Engine (src/game)│
│ - HUD, Bag, Shop, Pipkins,        │ - WorldScene (2:1 isometric render) │
│   Journal, Onboarding, Settings   │ - Procedural Atlas (src/art/)       │
├───────────────────────────────────┴─────────────────────────────────────┤
│ Pinia Reactive Bridge & Web Audio Synthesizer (src/stores/, src/audio/) │
├─────────────────────────────────────────────────────────────────────────┤
│ Authoritative Persistence Layer (src/core/persistence.ts)               │
│ - IndexedDB + Web Locks + BroadcastChannel + Rolling Backup + Checksums │
├─────────────────────────────────────────────────────────────────────────┤
│ Pure Deterministic Game Core (src/core/)                                │
│ - types, catalog, grid, state, plants, daycycle, events, creatureAI,    │
│   actions (zero DOM / Phaser / Vue imports)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Multi-Window Concurrency & Authoritative Persistence (`src/core/persistence.ts`)
A user may have `popup.html`, `sidepanel.html`, and `game.html` open at the same time. To prevent duplicate rewards or lost writes:
1. **Cross-Context Web Locks**: Every state mutation executes inside `navigator.locks.request('tinyworld-save:tinyworld', ...)` (plus an in-process promise queue fallback).
2. **Read-Modify-Write Transaction**: Inside the lock, `SaveStore.mutate` reads the latest primary envelope from IndexedDB, clones it, runs the pure action mutator (`ACTIONS[name]`, including obstacle clearing, 50% Bag/placed-item selling, batch garden `harvestAll`/`waterAll`, in-place `rotateObject`, 10 Pipkin interactions, and expansion up to `MAX_PLAYABLE_STAGE = 10`), increments `state.rev` (`SCHEMA_VERSION = 2`), writes the previous valid envelope to `save.bak` (rolling backup), and commits the new envelope with a 32-bit FNV-1a checksum (`sum`) to `save`.
3. **Live BroadcastChannel Sync**: Upon commit, `BroadcastChannel('tinyworld-sync:tinyworld')` notifies all other open extension surfaces to re-read the authoritative state—including visual sky time (`cycle`, `manualHour`), `biomeOverride`, `weatherEnabled`, and `particleDensity` settings—while keeping simulation timestamps (`plantProgress`, cooldowns, `isRealNight`) strictly tied to wall-clock time.
4. **Schema Migrations & Corruption Recovery**: `MIGRATIONS` automatically upgrade legacy `v0` (`coins`) and `v1` saves to `v2` (unlocking previously locked path/stepping ground tiles and populating weather/visual settings) without losing player progress. If `save` fails checksum verification or schema validation on load, the broken payload is quarantined under `save.corrupt` and `SaveStore` automatically restores `save.bak`.

## 3. Chrome Extension Manifest V3 (`public/manifest.json`)
- **Surfaces**:
  - `action.default_popup`: `popup.html` (`420 × 580` compact island view with quick resource collection, creature petting, and one-click launchers for Side Panel and Full World).
  - `side_panel.default_path`: `sidepanel.html` (tall companion view alongside browsing).
  - `game.html`: Full-screen world-building & decorating experience.
- **Minimal Permissions**: Only `["sidePanel"]`. Zero host permissions, zero content scripts, zero background polling workers, zero external network requests, and strict CSP (`script-src 'self'; object-src 'self'`).
