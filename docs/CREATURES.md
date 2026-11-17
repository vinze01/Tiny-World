# Tiny World — Pipkin Creatures Guide

Pipkins are tiny magical creatures that live peacefully on floating islands. Each Pipkin has a distinct silhouette, color palette, animation profile, personality-weighted finite-state machine, and organic discovery condition.

## 1. All Fifteen Pipkins

| ID | Default Name | Species | Personality | Discovery Condition |
|---|---|---|---|---|
| `mossi` | **Mossi** | Meadow Pipkin | Calm, Curious, Loves plants | Lives on your island from the very start |
| `bloop` | **Bloop** | Droplet Pipkin | Playful, Energetic, Easily distracted | Tap the pond 3 times |
| `ember` | **Ember** | Flame Pipkin | Adventurous, Friendly, Mischievous | Place any warm light (`lantern`, `campfire`, torches, braziers) |
| `puffin` | **Puffin** | Cloud Pipkin | Sleepy, Gentle, Affectionate | Expand island to Stage 2 (Blooming Grove) |
| `sprig` | **Sprig** | Fungal Pipkin | Shy, Observant, Helpful | Harvest a Spotted Mushroom |
| `frosty` | **Frosty** | Snowflake Pipkin | Calm, Tidy, Serene | Expand to Frostfall Haven (Stage 6) |
| `nimbus` | **Nimbus** | Breeze Pipkin | Dreamy, Gentle, Breezy | Reach Cloud Sanctuary (Stage 5) or place a Windmill |
| `glimmer` | **Glimmer** | Prism Pipkin | Curious, Dazzled, Friendly | Place a Crystal Cluster / Glacier Spire or reach Stage 3 |
| `cinder` | **Cinder** | Hearth Pipkin | Bold, Warm, Steady | Reach Emberglow Valley (Stage 8) or place warm hearth/bathhouse furniture |
| `luna` | **Luna** | Crescent Pipkin | Shy, Nocturnal, Observant | Reach Moonlit Garden (Stage 4) or harvest a Moonflower |
| `pebble` | **Pebble** | Terrapin Pipkin | Patient, Stoic, Cozy | Reach Stage 3+ while clearing rocks or placing stone benches |
| `wisp` | **Wisp** | Mist Pipkin | Quiet, Graceful, Caring | Reach Mistwood Hollow (Stage 7) or harvest Mist Orchids |
| `astra` | **Astra** | Star Pipkin | Radiant, Energetic, Wonder-filled | Reach Starlight Isles (Stage 9) or place Starlight lighting/observatory |
| `flurry` | **Flurry** | Scarf Pipkin | Playful, Lively, Cheeky | Place a Snowman or Cocoa Stand in Frostfall Haven (Stage 6+) |
| `bloom` | **Bloom** | Harmony Pipkin | Radiant, Affectionate, Kind | Crowned guardian unlocked at Everdream Paradise (Stage 10) |

## 2. Animations (`src/art/creatures.ts`)
Every Pipkin supports 7 frame-based animations registered as `<id>:<anim>`:
- `idle`: Gentle breathing squash-and-stretch with periodic eye blinks.
- `walk`: Playful hops with alternating feet and ear/tail secondary bounce.
- `sleep`: Settled posture, closed eyes, and floating `zzz` emotes.
- `happy`: Energetic high hop with beaming eyes and open smile.
- `curious`: Alternating head tilts (`±3px`) with wide observant eyes and `?` emote.
- `interact`: Raised tiny arms with species-specific emote (`leaf`, `drop`, `sparkle`, `heart`).
- `eat`: Happy munching cycle triggered when fed a Berry Treat.

## 3. Finite-State Machine AI (`src/core/creatureAI.ts`)
Each Pipkin runs an offline-capable finite-state machine (`tickActor`) across six states:
1. **`idle`**: Pause and breathe between activities.
2. **`wander`**: Pathfind via 4-neighbor BFS (`findPath` on `walkGrid`, up to `maxLen = 96`) to a walkable tile or follow nearby companions.
3. **`inspect`**: Pathfind adjacent to a preferred Point of Interest (`tree`, `flower`, `plant`, `pond`, `mushroom`, `light`, `bench`, `water`, `crystal`, `fire`, `building`) and tilt head curiously.
4. **`interact`**: Perform a charming species reaction at a POI or playfully interact nearby without blocking active garden/pickup clicks.
5. **`rest`**: Relax near a cozy object (`bush`, `light`, `cottage`, `shelter`, `bench`, `hotspring`).
6. **`sleep`**: Curl up for a nap; sleep weight increases `8×` during nighttime and adapts dynamically to weather (`rain`/`snow` encourages sheltering).

## 4. Emotional States, Annoyance & 10-Action Bar
- **Dynamic Moods (`effectiveEmotion`)**: Every Pipkin tracks a mood (`happy`, `curious`, `sleepy`, `excited`, `shy`, `annoyed`, `angry`, `relaxed`) rendered as a badge in the Inspector & Companions panel.
- **Rolling-Window Annoyance**: Repeatedly spam-petting within a short rolling window fills `petWindowTimestamps` and temporarily shifts a Pipkin into `'annoyed'` (with `sweat` / `angry` emotes and retreat hops); personality tolerance adjusts threshold, natural decay restores calm over time, and **Cheer** / **Feed Treat** / **Rest** immediately soothe annoyance.
- **Ten Contextual Actions**: Players can **`Pet`** (`petCreature`), **`Feed`** (`feedCreature`, `+6` affection), or use `interactCreature` (`play`, `wave`, `call`, `observe`, `gift`, `cheer`, `follow`, `rest`) with direct actor pathfinding & emotes.
- **Affection Levels**: Thresholds at `0, 15, 40, 90, 180, 300` affection (`Lv. 0` → `Lv. 5`), awarding `5, 10, 20, 30, 50` bonus Nature Tokens on level-up.
- **Rename (`renameCreature`)**: Players can give any befriended Pipkin a custom sanitized name (up to 14 characters).
