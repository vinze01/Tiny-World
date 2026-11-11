# TinyWorld — Art Direction & Visual Design System

## 1. Visual Identity & Aesthetic Goals
TinyWorld portrays a handcrafted miniature floating island diorama viewed from a 2:1 isometric perspective. Drawing conceptual inspiration from the reference artwork (`World.jpg`, `Atmosphere.jpg`, `Surroundings.jpg`, and `Interface.jpg`), the art direction balances:
- **Layered Isometric Diorama (`World.jpg` & `Atmosphere.jpg`)**: A rounded floating island with lush grass edges, recessed water pond, cobblestone building plot, hanging vines, and a tapered underside of hexagonal basalt columns fading into cool atmospheric shadow.
- **Bold, Readable Pixel Art (`Surroundings.jpg`)**: Crisp nearest-neighbor sprites with dark plum outlines (`#2A2236`), painterly 4-tone foliage clusters, and top-left directional lighting.
- **Storybook Parchment & Medallion UI (`Interface.jpg`)**: Warm cream parchment cards, dark wood borders, circular bronze/gold item medallions, and golden token banners that keep the island as the visual centerpiece.

## 2. Color Palette

### UI & Storybook Palette
| Token | Hex | Usage |
|---|---|---|
| Warm Cream | `#F7F0DD` / `#FFFAF0` | Primary parchment panels & cards |
| Aged Parchment | `#E8DCC0` | Inset shadows, secondary rows, ledger backgrounds |
| Forest Green | `#527A58` / `#38583D` | Primary action buttons, completion badges |
| Soft Sage | `#A8C5A0` | Trait pills, positive accents |
| Warm Wood | `#8B684B` / `#5E432D` | Panel borders, medallion frames, button shadows |
| Golden Yellow | `#E8C46A` / `#B88C28` | Active tabs, token counter, heart level badges |
| Muted Sky | `#A7D5E8` | Daytime horizon & water highlights |
| Dark Ink | `#303D35` / `#55665B` | High-contrast body copy and secondary labels |

### World & Sprite Palette
- **Universal Outline**: `#2A2236` (deep plum-charcoal, softer and warmer than pure black).
- **Grass Ramp**: `#4C9E3F` → `#62B84A` → `#77CD54` → `#98DF68`.
- **Basalt & Cliff Ramp**: Warm brown-grey (`#483226` → `#AA7C5E`) transitioning into cool indigo-slate (`#3C4A72` → `#8AA4CA`) toward the lower tip of the floating island.
- **Pond Water Ramp**: `#2A88A8` → `#38A8C6` → `#4CC4DE` → `#A8F0FA` (animated 3-frame ripple).

## 3. Pixel Scale & Isometric Projection
- **Logical Tile Footprint**: `32 × 16` pixels (`TILE_W = 32`, `TILE_H = 16`, standard 2:1 isometric diamond).
- **Projection Math**:
  - `worldX = (gx - gy) * 16`
  - `worldY = (gx + gy) * 8`
- **Filtering**: `pixelArt: true`, `antialias: false`, `roundPixels: true`, and CSS `image-rendering: pixelated` across all canvases and UI `<img class="pixel-icon">` elements.
- **Lighting Direction**: Consistent top-left light source (`-0.55x, -0.8y`). Left-facing isometric planes receive full light (`pal[3]` / `pal[2]`), while right-facing isometric planes receive shade (`pal[1]`). Ground shadows project slightly to the bottom-right (`+2px, +1px`) at ~25% opacity.

### 4. Character Proportions (Pipkins)
- **Frame Size**: `28 × 28` pixels per animation frame across all **15 Pipkins** (`mossi`, `bloop`, `ember`, `puffin`, `sprig`, `frosty`, `nimbus`, `glimmer`, `cinder`, `luna`, `pebble`, `wisp`, `astra`, `flurry`, `bloom`).
- **Silhouette**: Compact, rounded 1-head-tall body (`rx: 6–9.5px`, `ry: 5.6–8.5px`) so each Pipkin remains immediately recognizable even at Chrome extension popup scale.
- **Emotion Tint & Badges**: Pipkins subtly shift tint / aura and emit contextual emotes based on emotional state (`happy`, `curious`, `sleepy`, `excited`, `shy`, `annoyed`, `angry`, `relaxed`).

## 5. Animation & Weather Conventions
- **Creatures**: 7 animations per Pipkin (`idle`, `walk`, `sleep`, `happy`, `curious`, `interact`, `eat`) driven by squash-and-stretch (`sq`), hop height, head tilt, ear/tail secondary motion, and eye/mouth expressions.
- **Environment & Biomes**:
  - Ten distinct biome palettes across Stages 1–10 (`meadow`, `breeze`, `crystal`, `mist`, `sky`, `frostfall`, `mistwood`, `emberglow`, `starlight`, `everdream`) supporting powdery `snow`, reflective `ice`, `autumn` earth, steaming `hotspring`, and luminous `starstone` terrain.
  - Island underside basalt columns follow exact per-column lowest solid terrain floors (`colFloorY[x]`) for clean silhouettes at every stage size (`8×8` through `36×36`).
  - Gentle sinusoidal island bobbing (`1.6px` amplitude, disabled when Reduced Motion is active), 3-frame animated water ripples, hanging vine sway, foliage breeze sway (`±1.6°`), centered 2-frame flickering campfire flames (`setOrigin(0.5, 0.92)`), and user-configurable weather particles (`clear`, `cloudy`, `rain`, `snow`, `fog`, `wind`, `sparkles`) scaled by `particleDensity` (`low`, `normal`, `high`).

## 6. Asset Naming Conventions
- Terrain & Island: `island:<stage>:<biome>:<waterFrame>` (generated lazily via `ensureIslandTextures` on stage or biome preview switch)
- Placed Items: `item:<id>` / `item:<id>:<0|1>` (supports `rot: 0 | 1` variants for rotatable furniture, paths, and buildings)
- Plants: `plant:<id>:<stage0..4>` (for all 14 plant species = 70 sprites) and `seed:<id>`
- Creatures: `creature:<id>` spritesheet with frames `<anim>_<index>` and Phaser animation keys `<id>:<anim>`
- FX & Pickups: `fx:<name>` and `pickup:<kind>` (accented with glowing camera-focus halos)
