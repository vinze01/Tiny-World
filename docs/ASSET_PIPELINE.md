# TinyWorld — Procedural Pixel-Art Asset Pipeline

## Overview
TinyWorld generates 100% of its pixel-art sprites, isometric buildings, multi-stage plants, animated creature sprite sheets, UI icons, and Chrome extension icons programmatically from deterministic TypeScript modules under `src/art/`.

This architecture guarantees:
1. **Zero Copyright or Licensing Risk**: Every pixel is original and synthesized locally.
2. **Perfect Visual Consistency**: Every asset shares the same `32×16` isometric math, `#2A2236` outline pass, top-left lighting ramp, and soft ground shadow.
3. **Tiny Bundle Size & Instant Offline Loading**: No external network requests or multi-megabyte PNG downloads.

## Pipeline Modules (`src/art/`)

### 1. `pix.ts` — Core Pixel Painter & Isometric Projector
- **`Pix` Buffer**: Wraps a `Uint8ClampedArray` RGBA pixel buffer with pixel-aligned primitives:
  - `set`, `rect`, `line` (Bresenham)
  - `ellipse`, `ellipseFn`
  - `blob`: Painterly lit sphere/ellipsoid generator using top-left normal dot-product + deterministic spatial hash noise (`noise(x, y, seed)`) across a 4-tone color ramp (`ramp(baseHex)`).
  - `poly`: Scanline polygon rasterizer supporting per-pixel procedural shaders (roof shingles, cobblestone seams, wood planks, glass reflections).
  - `outline`: Automatic 1-pixel `#2A2236` outline around opaque silhouettes.
  - `shadow`: Soft translucent ground shadow rendered underneath sprites.
- **`Iso` Projector**: Converts footprint-local `(u, v, z)` coordinates into pixel coordinates `(ox + (u - v) * 16, oy + (u + v) * 8 - z)`.

### 2. `island.ts` — Floating Island, Basalt Cliff & Custom Terrain Generator
- Renders all **10 playable stages** (`8×8` Little Meadow through `36×36` Everdream Paradise) with a **unified green meadow base** across all stages by default (`island:<stage>:meadow:<0..2>`), generated lazily per stage via `ensureIslandTextures` (with optional visual biome override support in Settings).
- Synthesizes the tapered underside of hexagonal basalt columns using exact per-column floor scanning (`colFloorY[x]`) so every cliff skirt connects seamlessly.
- **Neighbor-Aware Procedural Terrain Patches (`buildCustomTerrainPatch`)**: Dynamically generates `32×16` isometric snow and sand tile textures with 4-bit cardinal neighbor awareness (`sameMask` and `otherMask`). Connected tiles form seamless snowfields and desert patches; outer edges show soft scalloped borders with subtle meadow grass blades peeking through; snow and sand borders interlock warmly with zero black or purple seams.

### 3. `nature.ts`, `decor.ts`, & `buildings.ts` — World Catalog Assets
- **116 Placeable Shop Items + 3 Natural Scenery Types** across `nature`, `furniture`, `lighting`, `paths`, `buildings`, `terrain`, and `seasonal`:
  - **Terrain & Landscaping (`island.ts`)**: `grass_patch`, `snow_patch`, `sand_patch`.
  - **Winter Collection (`decor.ts` & `nature.ts`)**: `snowman`, `snow_pine`, `ice_crystal`, `frozen_pond`, `winter_lantern`, `snow_bench` (rot 0/1), `ice_sculpture`, `snowy_fence` (rot 0/1).
  - **Christmas Collection (`decor.ts`)**: `christmas_tree`, `reindeer`, `gift_boxes`, `candy_cane`, `christmas_wreath`, `santas_sleigh` (rot 0/1), `festive_streetlamp`, `christmas_stall` (rot 0/1).
  - **Desert Collection (`decor.ts` & `nature.ts`)**: `cactus_small`, `cactus_tall`, `cactus_flower`, `desert_rock`, `desert_palm`, `desert_tent`, `oasis_fountain`, `desert_lantern`.
  - **Beach & Summer Collection (`decor.ts` & `nature.ts`)**: `beach_umbrella`, `beach_chair` (rot 0/1), `sandcastle`, `beach_towel` (rot 0/1), `seashell_cluster`, `tropical_plant`, `coconut_tree`, `picnic_umbrella` (rot 0/1).
  - **Classic Nature (`nature.ts`)**: `tree_big`, `oak`, `pine`, `birch`, `willow`, `cherry`, `cloud_tree`, `autumn_maple`, `star_willow`, `everdream_tree`, `crystal_cluster`, `basalt_spire`, `bush`, `mist_fern`, `ember_fern`, `mushrooms`, `glow_shrooms`, `flower_bed`, `rock`, `stones`, `log`, `reeds`, `wildflowers`.
  - **Classic Furniture, Lighting, Paths & Seasonal (`decor.ts`)**: Dedicated `rot: 0 | 1` directional sprites (`bench`, `stone_bench`, `picnic_table`, `hammock`, `hot_tub`, `bridge`, `stepping_stones`, `wood_deck`, `fence`, `sign`, `birdhouse`, `gazebo`, `hot_cocoa`, `moss_statue`, `stargazer`, `harvest_cart`, `snow_fort`, `dreamcatcher`, etc.), `campfire` (+ centered 2-frame `campfireFlame`), biome lanterns, and paths (`path`, `petal_path`, `lily_stepping`, `mosaic_path`, `frost_paving`, `amber_cobble`, `star_paving`, `zen_garden`).
  - **Isometric Buildings (`buildings.ts`)**: 14 multi-tile buildings (`cottage`, `shed`, `greenhouse`, `shelter`, `workshop`, `windmill`, `observatory`, `teahouse`, `sanctuary_bell`, `ski_lodge`, `alchemy_hut`, `bathhouse`, `planetarium`, `dream_pavilion`) each rendered cleanly in both `rot: 0` and `rot: 1`.

### 4. `plants.ts` — 5-Stage Gardening Sprites
- Generates `5` growth stages (`0: Seed`, `1: Sprout`, `2: Growing`, `3: Mature`, `4: Blooming`) for all **14 plant species** (`daisy`, `bluebell`, `sunflower`, `mushroom`, `berry`, `glowflower`, `waterlily`, `moonflower`, `starbloom`, `frostberry`, `mistorchid`, `emberpepper`, `novabloom`, `everdream_lotus`) = **70 distinct plant sprites**, with tall canvas clearance (`H = 50, gy = 42`) so mature blooms never clip.

### 5. `creatures.ts` — Pipkin Sprite Sheets
- Builds a horizontal sprite sheet (`19` frames × `28×28` px) for all **15 Pipkins** covering all 7 animations (`idle`, `walk`, `sleep`, `happy`, `curious`, `interact`, `eat`).

### 6. `atlas.ts` — Phaser Texture & UI Data-URI Registry
- `registerPhaserAssets(scene)` registers all canvas textures and sprite-sheet animations into Phaser's `TextureManager` and `AnimationManager` on startup, backed by shared builder maps (`ITEM_BUILDERS`, `ROTATED_BUILDERS`, `FX_BUILDERS`, `PICKUP_BUILDERS`, `UI_ICON_BUILDERS`).
- `iconUrl(key)` caches PNG Data-URIs for Vue UI medallions, inventory slots, shop cards, and journal entries.

## Code-to-Figma Export Pipeline
- All procedural artwork, island stages, animations, UI screens, and design tokens can be exported to Figma-ready PNG, crisp pixel SVG, GIF89a, APNG, and JSON formats via `npm run export:figma` and inspected locally via `npm run gallery`.
- See [FIGMA_INTEGRATION.md](./FIGMA_INTEGRATION.md) for the complete architecture, folder layout, Figma page guide, and round-trip workflow.
