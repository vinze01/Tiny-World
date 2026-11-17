# Tiny World — Figma Integration & Code-to-Figma Asset Pipeline

## Overview

Tiny World synthesizes its visual artwork procedurally in TypeScript (`src/art/`, `src/game/`, `src/ui/`). Because no external PNG sprite sheets or Figma source files exist by default, the Code-to-Figma export pipeline renders, packages, validates, and catalogs **every** visual asset, UI screen, design token, and island scene into import-ready files for the target Figma workspace:

- **Target Figma Project**: `https://www.figma.com/design/TCEjXAmLGD0mgNZc4nbWW0/Untitled`

## 1. Procedural Art Architecture Recap

- **`src/art/pix.ts`**: `Pix` (`Uint8ClampedArray` RGBA buffer), `Iso` (`32×16` 2:1 isometric coordinate projection), global `#2A2236` (`OUTLINE = 0x2a2236`) pixel outline, top-left normal lighting ramps (`ramp`, `mixc`, `lighten`, `darken`), and ground shadows.
- **`src/art/atlas.ts`**: Registry & texture builder exposing `ITEM_BUILDERS`, `ROTATED_BUILDERS`, `FX_BUILDERS`, `PICKUP_BUILDERS`, `UI_ICON_BUILDERS`, `SEED_COL`, `seedBag`, `treatSprite`, `registerPhaserAssets`, and `iconUrl`.
- **`src/art/creatures.ts`**: All `15` Pipkin species (`SPECIES`, `FRAME = 28`, `FRAME_DEFS`, `ANIM_ORDER`, `ANIM_RATES`, `drawPipkin`, `buildCreatureSheet`).
- **`src/art/buildings.ts`**: All `14` isometric structures (with `rot: 0 | 1`).
- **`src/art/decor.ts`**: Furniture, lighting (plus `campfireFlame` frames), paths, and seasonal decorations.
- **`src/art/nature.ts`**: Trees, rocks, crystals, logs, springs, mushrooms, and seasonal outdoor scenery.
- **`src/art/plants.ts`**: `14` plant species across `5` growth stages (`Seed`, `Sprout`, `Growing`, `Mature`, `Blooming`, `30×50` px).
- **`src/art/island.ts`**: `10` island stages (`8×8` through `36×36`), `TERRAIN_KINDS` (`9` terrain surface types), `10` biomes, basalt cliff undersides, and `3` water shimmer frames (`buildIsland`, `buildTerrainTile`).
- **`src/art/fx.ts`**: Weather particles, emotion icons, glow halos, pickups, clouds, sun/moon, and coins.
- **`src/game/WorldScene.ts`**: Live Phaser 3 compositor applying 24h day-cycle sky gradients/tints, floating island bobbing, lantern glow, Pipkin animation, and weather particles.
- **`src/ui/`**: Vue 3 storybook HUD & modals styled with CSS custom properties in `src/ui/theme.css`.

## 2. How the Automated Exporter Works

Run the complete pipeline with:

```bash
npm run export:figma
```

Useful flags:

- `npm run export:figma -- --force` — Bypass SHA-256 incremental cache (`.export-cache.json`) and regenerate all outputs.
- `npm run export:figma -- --skip-browser` — Export all procedural sprites, animations, SVGs, and design tokens without launching headless Chromium (skips `islands/previews/`, `ui/screenshots/`, and `catalogs/`).
- `npm run export:figma -- --no-build` — Skip rebuilding `dist/` if you already ran `npm run build`.

### Pipeline Execution Stages (`scripts/figma/`)

1. **Dynamic Discovery (`inventory.ts`)**: Reads directly from `CREATURES`, `PLANTS`, `ITEMS`, `STAGES`, `TERRAIN_KINDS`, `FX_BUILDERS`, `PICKUP_BUILDERS`, `UI_ICON_BUILDERS`, and `ROTATED_BUILDERS` so newly added items/creatures/plants are picked up automatically with zero duplicated asset lists.
2. **Pure Codecs (`codecs.ts`)**: Generates deterministic RGBA PNGs (zlib level 9), lossless-palette GIF89a (`NETSCAPE2.0` infinite loops), 32-bit full-alpha APNGs (`acTL`, `fcTL`, `fdAT`), nearest-neighbor integer magnifications strictly clamped to `<= 4096px` for Figma safety, and horizontal run-length `<rect shape-rendering="crispEdges">` SVGs for compact icons and sprites.
3. **Procedural Raster & SVG Export (`render-assets.ts`)**: Executes inside a temporary Vite SSR server (`scripts/export-figma.mjs`) with incremental SHA-256 caching so untouched assets stay cached while modified sprites re-export cleanly.
4. **Design Tokens & Vector UI Specimens (`tokens.ts`)**: Parses CSS variables/rules directly from `src/ui/theme.css` alongside `daycycle.ts`, `island.ts`, `creatures.ts`, `pix.ts`, and `catalog.ts` to emit W3C Design Tokens (`design-tokens.json`), Figma Variables (`ui/tokens/figma-variables.json`), and clean SVG UI component templates.
5. **Live Browser Captures (`capture-browser.ts`)**: Launches headless Chromium against fresh `dist/` in an isolated context (never altering real player saves) to capture:
   - All `10` playable stages rendered through `WorldScene` at `morning`, `day`, `sunset`, and `night` (`40` PNGs) + `6` biome weather showcase previews (`rain`, `snow`, `fog`, `wind`, `sparkles`)
   - All extension UI surfaces (`popup` `420×560`, `sidepanel` `380×700`, `game.html` `1280×800`) and modals/inspectors + tight DOM component crops
   - `7` labeled visual catalog boards (`catalogs/*.png`) strictly `<= 4096px`
6. **Manifest & QA Validation (`validate.ts`)**: Writes `figma-assets/manifest.json`, decodes PNG headers/dimensions/CRCs/transparency, validates APNG/GIF/SVG/JSON structure, verifies pixel-exact equality against freshly built procedural buffers, and checks Figma dimension bounds.

> **Production Build Isolation**: `scripts/figma/`, `tools/asset-gallery/`, and `figma-assets/` are dev-only tools outside `vite.config.ts` entrypoints (`popup.html`, `sidepanel.html`, `game.html`), keeping the production `dist/` extension completely unaffected.

## 3. Export Folder Layout (`figma-assets/`)

```text
figma-assets/
├── manifest.json                 # Complete searchable metadata & checksum index
├── design-tokens.json            # Full W3C Design Tokens specification
├── README.md                     # Import quick-reference inside output bundle
├── catalogs/                     # Figma-safe (<4096px) labeled overview boards
│   ├── all-assets.png
│   ├── creatures.png
│   ├── buildings.png
│   ├── decorations.png
│   ├── nature.png
│   ├── plants.png
│   └── islands.png
├── creatures/
│   ├── sprites/                  # <id>.png (28×28), <id>@4x.png (112×112), <id>.svg
│   ├── spritesheets/             # <id>-sheet.png (560×28) & @4x (2240×112)
│   ├── animations/               # <id>-{idle,walk,sleep,happy,curious,interact,eat}.{gif,apng}
│   └── previews/                 # <id>-poses.png & @4x
├── buildings/                    # 14 buildings (<id>.png, @4x, <id>-rot1.png, @4x)
├── decorations/
│   ├── furniture/
│   ├── lighting/
│   ├── paths/
│   └── seasonal/
├── nature/                       # Trees, rocks, crystals, flora + rotated variants
├── plants/
│   ├── seeds/                    # 14 seed bags (.png, @4x, .svg)
│   ├── growth-stages/            # <id>-s0..s4 (.png, @4x, .svg)
│   └── previews/                 # 5-stage strips + animated <id>-growth.{gif,apng}
├── islands/
│   ├── terrain/                  # Isometric 32×16 tiles per biome + SVG
│   ├── stages/                   # Raw stage-1..10 PNG, safe @Nx PNG & water.gif
│   └── previews/                 # Live WorldScene renders (stages 1–10 × 4 ToD + weather)
├── effects/                      # FX particles, pickups, flame.{gif,apng}, butterfly.{gif,apng}
└── ui/
    ├── icons/                    # Token, treat, pond & extension icons (16/48/128 PNG + SVG)
    ├── components/               # Storybook panel/button/medallion/heart-bar/sky SVGs + UI crops
    ├── screenshots/              # Popup, sidepanel, full desktop, drawers, modals, inspectors
    └── tokens/                   # design-tokens.json + figma-variables.json
```

## 4. Recommended Figma File Organization

Inside `https://www.figma.com/design/TCEjXAmLGD0mgNZc4nbWW0/Untitled`, organize your workspace into 7 pages:

| Figma Page | Contents to Import |
| :--- | :--- |
| **`01 — Design System`** | Import `ui/tokens/figma-variables.json` via Figma Variables / Tokens Studio, place `ui/components/*.svg`, typography & swatch documentation |
| **`02 — World & Islands`** | `catalogs/islands.png`, `islands/stages/stage-*.png`, `islands/terrain/*`, and `islands/previews/stage-*-{morning,day,sunset,night}.png` |
| **`03 — Creatures (Pipkins)`** | `catalogs/creatures.png`, `creatures/sprites/*@4x.png`, animated `creatures/animations/*.gif` previews, and spritesheets |
| **`04 — Plants & Nature`** | `catalogs/plants.png`, `catalogs/nature.png`, `plants/previews/*-progression@4x.png`, seeds, and `nature/*@4x.png` |
| **`05 — Buildings & Decorations`** | `catalogs/buildings.png`, `catalogs/decorations.png`, and `rot 0` / `rot 1` pairs |
| **`06 — UI Components & Screens`** | `ui/screenshots/*.png`, `ui/components/comp-*.png`, and `ui/icons/*` |
| **`07 — Concepts & Future Designs`** | Scratchpad frames for new Pipkins, Stage 11+ biomes, or HUD redesigns |

## 5. Importing & Organizing Into Figma

1. **Automated Figma MCP Upload (`upload_assets`)**: Uploads PNGs and editable vector SVGs directly onto `Page 1` of `https://www.figma.com/design/TCEjXAmLGD0mgNZc4nbWW0/Untitled`. (Note: the Figma MCP integration exposes `upload_assets`, read tools, and code-connect/make workflows, and does not include a cross-page node-reparenting tool on Starter/View seats.)
2. **Organizing Existing Frames into Pages `01–07` (Local Figma Plugin)**:
   Use the included offline-safe Figma development plugin in [`tools/figma-organizer-plugin/`](../tools/figma-organizer-plugin/manifest.json) to move all uploaded frames from `Page 1` into `01 — Design System` through `07 — Concepts & Future Designs` with labeled Sections and automatic pre/post validation (zero duplication, deletion, or resizing):
   - Open your file in **Figma Desktop App**.
   - Run **Plugins → Development → Import plugin from manifest...** and select `tools/figma-organizer-plugin/manifest.json`.
   - Launch **Plugins → Development → Tiny World Workspace Organizer**, verify the scanned counts (`94` frames), and click **Organize Into 7 Pages**.
3. **Manual Batch Drag-and-Drop (Crisp Pixel Art)**:
   - Always drag **`@4x.png`** files (or `.svg` icons/sprites) onto your Figma canvas rather than scaling `1x` PNGs manually in Figma—Figma uses bilinear smoothing when resizing small bitmaps unless pre-scaled by an integer factor with nearest-neighbor sampling.
   - Drag animated **`.gif`** files directly from `creatures/animations/`, `plants/previews/`, or `effects/` into Figma Prototype frames for live looping animation previews.
   - Select imported bitmaps → leave Fill mode at **Crop / Fit** at `100%` native pixel size (`@4x` sprites render sharply at UI presentation scale).
4. **Importing Tokens & Variables**:
   - Use **Tokens Studio for Figma** (or Figma's **Variables → Import**) with `figma-assets/ui/tokens/figma-variables.json` or `figma-assets/design-tokens.json`.

## 6. Local Asset Gallery & Zip Bundle Downloader

Start the offline-first local gallery server:

```bash
npm run gallery
```

Open `http://127.0.0.1:4178` in your browser to:

- Search by name, catalog ID, tag, or source module (`src/art/*.ts`, `src/game/WorldScene.ts`, `src/ui/*`)
- Filter by category, unlock stage (`Stage 1–10`), or animation state
- Switch preview backgrounds (`Checkerboard`, `Storybook Cream`, `Sky Day`, `Starlit Night`, `Dark Slate`) and pixel magnification (`1x`, `2x`, `4x`, `8x`)
- Scrub creature spritesheet animation frames frame-by-frame with variable FPS playback
- Browse visual **Design Tokens** swatches and **Catalog Boards**
- Download individual PNG/SVG/GIF/APNG variants or click **Download Filtered Bundle (.zip)** to pack filtered assets into a single archive for drag-and-drop into Figma.

## 7. Designing New Visuals in Figma (Tiny World Constraints)

When drafting new sprites or UI updates inside `07 — Concepts & Future Designs`:

- **Isometric Geometry**: `32×16` px (`2:1` diamond), footprint multiples `(1×1, 2×1, 2×2, 3×3)`.
- **Lighting & Outlines**: Key light comes from **top-left** (`light → mid → dark → deep`), silhouette finished with `#2A2236` `1px` native outline.
- **Creature Frame Box**: `28×28` native pixels, anchor `(14, 25)` at bottom-center with soft ground shadow.
- **Plant Growth Box**: `30×50` native pixels across 5 stages (`Seed`, `Sprout`, `Growing`, `Mature`, `Blooming`).
- **Extension Popups**: Design responsive layouts inside `420×560` (Popup), `380×700` (Side Panel), and `1280×800` (Full World).

## 8. Code ↔ Figma Round-Trip Workflow

1. Edit or add visuals/UI in Figma (`07 — Concepts & Future Designs`).
2. Share the Figma frame URL or exported design specs back in chat.
3. Antigravity translates approved visuals into clean TypeScript (`src/art/*.ts`, `src/ui/*.vue`, `src/ui/theme.css`).
4. Run `npm run export:figma` to re-export updated PNGs/SVGs/tokens into `figma-assets/`.
5. Compare updated `catalogs/*.png` and `ui/screenshots/*.png` against Figma designs before shipping.

## 9. Verification & QA Checklist

- `npm run typecheck` — Verifies TypeScript across `src/`, `scripts/figma/`, and `tests/`.
- `npm test` — Runs unit tests including `tests/figma-export.test.ts` (codecs, discovery parity, tokens).
- `npm run build` — Confirms `dist/` extension bundle stays clean and excludes dev exporter/gallery tools.
- `npm run export:figma` — Generates & validates every PNG/APNG/GIF/SVG/JSON header, dimensions (`<= 4096px`), transparency, and pixel-exact equality.
- `npm run test:e2e` — Runs Playwright E2E regression tests on the built Chrome extension.

## 10. Troubleshooting

- **Browser executable not found during `export:figma`**: Set `PLAYWRIGHT_CHROMIUM_PATH` to your Chrome/Edge executable, or run `npm run export:figma -- --skip-browser` for headless Node-only sprite/token export.
- **Port `4178` in use for gallery**: Start with `GALLERY_PORT=4190 npm run gallery`.
- **Pixel blur in Figma**: Always import `@4x.png` or `.svg` variants instead of stretching `1x` PNGs inside Figma frames.
