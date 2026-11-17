# Tiny World — Development Roadmap

## Implemented in v1.0.0 (Current Release)
- **All 10 Playable Island Stages & Biomes (`8×8` through `36×36`)**:
  - `Stage 1` Little Meadow, `Stage 2` Blooming Grove, `Stage 3` Crystal Pond, `Stage 4` Moonlit Garden, `Stage 5` Cloud Sanctuary, `Stage 6` Frostfall Haven, `Stage 7` Mistwood Hollow, `Stage 8` Emberglow Valley, `Stage 9` Starlight Isles, and `Stage 10` Everdream Paradise.
  - Strict `(0, 0)`-anchored outward ring expansions preserve existing player placement coordinates across every upgrade.
- **All 15 Pipkins** (`Mossi`, `Bloop`, `Ember`, `Puffin`, `Sprig`, `Frosty`, `Nimbus`, `Glimmer`, `Cinder`, `Luna`, `Pebble`, `Wisp`, `Astra`, `Flurry`, `Bloom`) with emotional states, rolling-window annoyance & soothing, 10 contextual player interactions, BFS pathfinding (`maxLen = 96`), and 7 sprite-sheet animations each.
- **14 Multi-Stage Plants** with 5 growth stages each (70 sprites) and offline timestamp growth, plus one-click **`Water All`** and **`Harvest All`**.
- **84 Shop Items** across all 6 categories with in-place rotation, Shop search/sort/biome filtering, obstacle clearing for Nature Tokens, and 50% Bag/placed-item selling.
- **Visual Sky Time Slider, Weather System & Biome Previews**: Weather FX with density settings, synchronized manual time/biome previews, Pickup countdown/camera focus, **25 Achievements**, **Discovery Journal**, and IndexedDB persistence (schema `v2` with automatic `v0`/`v1` save migrations).

## Future Ideas (Post-v1.0.0)
- **Layout Presets**: Save & switch between multiple island decoration arrangements.
- **Postcard Snapshot Tool**: Export a clean high-resolution PNG of your decorated island and Pipkins to share with friends.
- **Seasonal Limited Festivals**: Rotating seasonal visitor hats and limited-edition holiday lanterns.
