# TinyWorld — A little world, just for you.

**TinyWorld** is a cozy miniature floating-island game delivered as a Google Chrome Manifest V3 extension. Designed for short, peaceful breaks (30 seconds to 5 minutes), it gives you a handcrafted pixel-art diorama with **15** expressive **Pipkin** creatures, offline-progressing plants, customizable decorations and isometric buildings across **10 playable biome stages**, a gentle day/night cycle with ambient weather, and delightful random world events.

---

## ✨ Key Features

- **Handcrafted Isometric Diorama**: A `32×16` isometric floating island with animated water ripples, cobblestone paths, hot springs, ice/snow/starstone terrain, overhanging foliage, and a tapered underside of hexagonal basalt columns.
- **15 Original Pipkin Creatures**: Befriend **Mossi**, **Bloop**, **Ember**, **Puffin**, **Sprig**, **Frosty**, **Nimbus**, **Glimmer**, **Cinder**, **Luna**, **Pebble**, **Wisp**, **Astra**, **Flurry**, and **Bloom**—each with 7 sprite-sheet animations (`idle`, `walk`, `sleep`, `happy`, `curious`, `interact`, `eat`), personality-weighted finite-state-machine AI with annoyance/soothing moods, 10 contextual interactions, petting, Berry Treat feeding, affection levels, and custom naming.
- **Offline Timestamp Gardening**: Plant and grow **14 plant species** (from **Daisy**, **Bluebell**, and **Sunflower** up to **Moonflower**, **Starbloom**, and **Everdream Lotus**) across 5 visual stages (`Seed` → `Sprout` → `Growing` → `Mature` → `Blooming`), with batch **`Water All`** / **`Harvest All`** controls. Plants never wither or die when you are away, and Daisies regrow from sprouts.
- **84 Shop Items & Island Customization**: Place Nature, Furniture, Lighting, Paths, Buildings, and Seasonal decor (including **Tiny Cottage**, **Greenhouse**, **Mini Windmill**, **Starlight Observatory**, and **Dreamlight Lantern**), with live valid/invalid tile previews, rotation (`R`), obstacle clearing, and 50% bag/placed-item resale.
- **10 Playable Island Stages & Biomes**: Expand strictly outward from `(0, 0)` from **Stage 1 — Little Meadow (`8×8`)** through **Stage 10 — Everdream Paradise (`36×36`)**, keeping all existing placements in place.
- **Day/Night Cycle, Sky Slider & Weather FX**: Auto or manual sky time preview (`Morning`, `Daytime`, `Sunset`, `Night`, plus 24h slider), biome weather previews (`clear`, `cloudy`, `rain`, `snow`, `fog`, `wind`, `sparkles`) with configurable particle density, **25 Achievements**, and a **Discovery Journal**.
- **Three Chrome Extension Surfaces**:
  - **Popup (`popup.html`)**: Compact view for quick check-ins, harvesting, and petting Pipkins.
  - **Side Panel (`sidepanel.html`)**: Companion view alongside your browsing.
  - **Full-Page World (`game.html`)**: Expansive view for island building and decorating.
- **Authoritative Local Persistence**: Automatic IndexedDB saving (schema `v2`, with `v0`/`v1` save migrations) using Web Locks + BroadcastChannel multi-window synchronization, FNV-1a checksums, rolling backup recovery, and manual JSON Export/Import.
- **Code-to-Figma Design Tooling (Dev-Only)**: Automated pixel-accurate asset/token exporter (`npm run export:figma`), interactive **Local Asset Gallery** (`npm run gallery`), and offline Figma organizer plugin (`tools/figma-organizer-plugin/`).

---

## 🚀 Installation & Development

### Prerequisites
- **Node.js** `v20+` (tested on `v24.22.1`) and **npm** `v10+`
- **Google Chrome** `v116+` (or Microsoft Edge)

### 1. Install Dependencies & Build
```bash
npm install
npm run icons
npm run build
```
This compiles TypeScript, verifies Vue templates via `vue-tsc`, and outputs the production Manifest V3 extension into `dist/`.

### 2. Load Unpacked Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `dist/` folder inside this repository.
4. Pin **TinyWorld** to your Chrome toolbar and click the island icon to open the popup—or click **Full World ↗** / **Side Panel** from inside the popup!

### 3. Run Automated Tests & Dev Asset Tools
```bash
# Run all 62 Vitest unit & integration tests across 6 suites
npm test

# Run the Playwright real-browser E2E suite across Full-Page, Popup, and Side Panel surfaces
npm run test:e2e

# Optional: generate Figma-ready sprites, animations, tokens & UI screenshots into figma-assets/
npm run export:figma

# Optional: inspect exported assets & tokens locally at http://127.0.0.1:4178
npm run gallery
```

---

## 📚 Documentation Index

- [`AGENTS.md`](./AGENTS.md) — Contributor & engineering rules for working in this repository
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — System architecture & multi-window concurrency design
- [`docs/ART_DIRECTION.md`](./docs/ART_DIRECTION.md) — Color palette, isometric specs, lighting, and UI style guide
- [`docs/ASSET_PIPELINE.md`](./docs/ASSET_PIPELINE.md) — Procedural pixel-art generator reference
- [`docs/CREATURES.md`](./docs/CREATURES.md) — All 15 Pipkin species, animations, moods, and FSM AI
- [`docs/GAME_DESIGN.md`](./docs/GAME_DESIGN.md) — Core loop, economy balancing, Stages 1–10 progression, and events
- [`docs/FIGMA_INTEGRATION.md`](./docs/FIGMA_INTEGRATION.md) — Code-to-Figma export pipeline, Local Gallery, and Figma workspace workflow
- [`docs/TESTING.md`](./docs/TESTING.md) — Unit, integration, and E2E testing matrix
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — Implemented v1.0.0 scope and future update ideas

---

## ⚠️ Notes

- **Audio Autoplay**: Per browser policies and cozy design rules, sound effects are disabled by default and can be toggled on at any time in **Settings (⚙️)**.
