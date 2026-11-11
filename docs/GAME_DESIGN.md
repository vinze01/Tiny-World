# TinyWorld — Game Design Document

## 1. Core Gameplay Loop (30 Seconds to 5 Minutes)
1. **Visit**: Open TinyWorld via the toolbar popup, side panel, or full-page tab.
2. **Observe**: See the current time of day (Morning, Daytime, Sunset, Night), weather, newly bloomed flowers, and Pipkins wandering or napping.
3. **Collect**: Tap sparkling event pickups, shake the Great Old Tree for acorns, splash the pond, or harvest blooming flowers for **Nature Tokens**.
4. **Interact**: Pet, feed Berry Treats to, or interact with all **15 Pipkins** via 10 contextual actions (`Pet`, `Feed`, `Play`, `Wave`, `Call`, `Observe`, `Gift`, `Cheer`, `Follow`, `Rest`), monitor their mood, and level up affection.
5. **Grow, Clear & Decorate**: Plant 14 species on grass/water tiles, use **`Water All` / `Harvest All`** batch controls, clear unwanted rocks/logs/trees (`clearObstacle`) for Nature Tokens (while protecting the Great Old Tree), rotate placed items/buildings in place (`rotateObject`), sell spare items/placements at 50% value (`sellItem`, `sellPlacedObject`), and arrange 84 shop decorations cleanly.
6. **Return Anytime**: Everything saves automatically in IndexedDB (`SCHEMA_VERSION = 2`). Plants grow and gentle world events occur via timestamp math while closed—never punishing inactivity.

## 2. Economy & Balancing (`src/core/catalog.ts`)
- **Single Currency**: **Nature Tokens** (starting balance: `30` Tokens + `2` Daisy seeds).
- **Obstacle Clearing (`clearObstacle`) & 50% Resale (`resaleValue`)**:
  - Natural scenery obstacles (`rock`, `stones`, `log`, `bush`, `pine`, `birch`, `crystal_cluster`, etc.) can be cleared permanently for Nature Tokens to reclaim buildable space; `tree_big` (Great Old Tree) is protected (`protected: true`).
  - Unused seeds, treats, decorations, buildings, or placed objects can be sold back for `50%` of shop price.
- **Replenishing & Non-Grindy**:
  - Shaking trees (`+2` Tokens) and bushes (`+1` Token) replenishes every 6 minutes.
  - Petting Pipkins grants `+1` Token every 3 minutes, plus affection level-up bonuses (`+5` to `+50` Tokens).
  - **25 Achievements** award `+3` to `+120` Tokens on unlock.
- **Gardening Economy (14 Plants across Stages 1–10)**:
  | Plant | Stage | Seed Cost | Grow Time | Harvest Yield |
  |---|---|---|---|---|
  | Daisy | 1 | 3 | 2.5 min | 4 (regrows from sprout for free!) |
  | Bluebell | 1 | 5 | 5 min | 8 |
  | Spotted Mushroom | 1 | 6 | 6 min | 9 |
  | Sunflower | 1 | 6 | 8 min | 12 |
  | Tiny Berry Bush | 2 | 12 | 12 min | 20 (+1 Treat) |
  | Glow Flower | 2 | 18 | 18 min | 32 |
  | Water Lily | 3 | 22 | 10 min | 38 |
  | Moonflower | 4 | 30 | 15 min | 55 |
  | Starbloom | 5 | 45 | 22 min | 80 (+2 Treats) |
  | Frostberry Bush | 6 | 55 | 24 min | 98 (+2 Treats) |
  | Mist Orchid | 7 | 68 | 26 min | 125 |
  | Ember Pepper | 8 | 82 | 28 min | 155 (+2 Treats) |
  | Novabloom | 9 | 100 | 30 min | 195 |
  | Everdream Lotus | 10 | 125 | 34 min | 250 (+3 Treats) |

## 3. World Progression (Stages 1–10, `(0, 0)`-Anchored)
All expansions add perimeter ring terrain strictly outward from `(0, 0)` so existing trees, decorations, and player layouts never shift coordinates:
- **Stage 1 — Little Meadow** (`8×8`, `meadow`)
- **Stage 2 — Blooming Grove** (`12×12`, `breeze`)
- **Stage 3 — Crystal Pond** (`16×16`, `crystal`)
- **Stage 4 — Moonlit Garden** (`20×20`, `mist`)
- **Stage 5 — Cloud Sanctuary** (`24×24`, `sky`)
- **Stage 6 — Frostfall Haven** (`26×26`, `frostfall`)
- **Stage 7 — Mistwood Hollow** (`28×28`, `mistwood`)
- **Stage 8 — Emberglow Valley** (`30×30`, `emberglow`)
- **Stage 9 — Starlight Isles** (`32×32`, `starlight`)
- **Stage 10 — Everdream Paradise** (`36×36`, `everdream`)

## 4. Weather, Sky Preview & World Events (`src/core/events.ts`, `src/core/daycycle.ts`)
- **Separated Weather System**: Biome-weighted ambient weather (`clear`, `cloudy`, `rain`, `snow`, `fog`, `wind`, `sparkles`) transitions independently of pickup event cooldowns (`nextEventEtaMs`), toggleable via Settings with selectable particle density (`low`, `normal`, `high`).
- **Visual Sky & Biome Previews**: Clicking the HUD clock opens preset sky modes (`Auto`, `Morning`, `Daytime`, `Sunset`, `Night`) plus a 24h `manualHour` slider (`cycle: 'custom'`) and Settings supports `biomeOverride`; both are strictly visual previews synchronized across extension surfaces without affecting plant growth timestamps, cooldowns, or real-clock Night Owl checks.
- **8 Gentle Random Events** (`MAX_PICKUPS = 6`): Butterfly Visit, Rare Flower, Shiny Stone, Shooting Star, Mushroom Sprout, Pipkin Pals, Gentle Rain, and Mysterious Gift.
