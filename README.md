# TinyWorld — A little world, just for you.

**TinyWorld** is a cozy miniature floating-island game delivered as a Google Chrome Manifest V3 extension. Designed for short, peaceful breaks (30 seconds to 5 minutes), it gives you a handcrafted pixel-art diorama with **15** expressive **Pipkin** creatures, offline-progressing plants, customizable decorations and isometric buildings across **10 playable biome stages**, a gentle day/night cycle with ambient weather, and delightful random world events.

---

## ✨ Key Features

- **Handcrafted Isometric Diorama & Unified Meadow Base**: A `32×16` isometric floating island with a consistent, soothing green meadow base across all 10 progression stages, animated water ripples, cobblestone paths, hot springs, overhanging foliage, and a tapered underside of hexagonal basalt columns.
- **Player-Controlled Terrain & Landscaping**: Customize ground tiles on your own terms using the **Terrain & Landscaping** shop category. Paint **Green Grass**, **Snow Patch**, or **Sand Patch** tiles non-destructively underneath existing buildings, plants, paths, decorations, and Pipkins with procedural neighbor-aware edge blending (continuous snowfields, sandy oases, soft scalloped grass borders, and seamless snow/sand transitions).
- **15 Original Pipkin Creatures**: Befriend **Mossi**, **Bloop**, **Ember**, **Puffin**, **Sprig**, **Frosty**, **Nimbus**, **Glimmer**, **Cinder**, **Luna**, **Pebble**, **Wisp**, **Astra**, **Flurry**, and **Bloom**—each with 7 sprite-sheet animations (`idle`, `walk`, `sleep`, `happy`, `curious`, `interact`, `eat`), personality-weighted finite-state-machine AI with annoyance/soothing moods, 10 contextual interactions, petting, Berry Treat feeding, affection levels, and custom naming.
- **Offline Timestamp Gardening**: Plant and grow **14 plant species** (from **Daisy**, **Bluebell**, and **Sunflower** up to **Moonflower**, **Starbloom**, and **Everdream Lotus**) across 5 visual stages (`Seed` → `Sprout` → `Growing` → `Mature` → `Blooming`), relocate growing plants without uprooting (`Move`), and use batch **`Water All`** / **`Harvest All`** controls. Plants never wither or die when you are away, and Daisies regrow from sprouts.
- **116 Shop Items & Seasonal Collections**: Browse Nature, Furniture, Lighting, Paths, Buildings, Terrain & Landscaping, and Seasonal decor with thematic filter pills (**Winter**, **Christmas**, **Desert**, **Beach & Summer**, **Classic**). Place **Christmas Trees**, **Reindeer**, **Santa's Sleigh**, **Snowmen**, **Cacti**, **Desert Tents**, **Oasis Fountains**, **Beach Umbrellas**, **Sandcastles**, **Starlight Observatories**, and more with live tile previews, in-place rotation (`R`), **`Multi-Select`** (`+ All [Type]`, Shift/Ctrl+Click) to move entire layouts together atomically, obstacle clearing with Bag rewards, and 50% resale.
- **10 Playable Island Stages & Progression**: Expand strictly outward from `(0, 0)` from **Stage 1 — Little Meadow (`8×8`)** through **Stage 10 — Everdream Paradise (`36×36`)**, keeping all existing placements in place while maintaining a unified green grass field.
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
# Run all 68 Vitest unit & integration tests across 6 suites
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

## 🔒 Privacy Policy

TinyWorld is an offline, local-first game. This policy applies to the TinyWorld Chrome extension.

**Data we collect: none.** TinyWorld has no accounts, no analytics, no telemetry, no advertising, and it never sends any data over the network. The extension makes no external requests — all artwork, audio, fonts, and code are packaged inside the extension itself.

**Data stored on your device:**

- **Game progress** (Nature Tokens, island stage, placed objects, plants, creature bonds, settings) is saved locally in your browser's IndexedDB storage under the `tinyworld` database, including an automatic rolling backup that protects against data corruption.
- **Nicknames** you type for your Pipkins are part of that same local save. Nothing else personal is stored.
- **Optional save backups** you create via *Settings → Backup & Restore* are saved as files you choose locally; importing one is validated before it replaces your save.

**Permissions:** TinyWorld requests a single permission, `sidePanel`, used only when you click *Side Panel* to dock the game next to your browser. It has no access to websites, browsing history, tabs content, or your identity.

**Data deletion:** You can erase everything by removing the extension (which deletes its storage), or reset in-game via *Settings → Reset Island*. Exported save files live only where you save them.

**Third-party links:** The Settings panel links to an external "Buy Me a Coffee" page, which opens only when you click it. No data is shared with that service by TinyWorld.

For questions, use the Support link on the Chrome Web Store listing.

---

## ☕ Support

If TinyWorld brings you a little peace during a busy day, consider supporting development:

- **[Buy Me a Coffee](https://buymeacoffee.com/vinze)** ☕ — every cup helps keep the Pipkins happy!

---

## ⚠️ Notes

- **Audio Autoplay**: Per browser policies, the synthesizer becomes active after your first click or key press in the game. Sound effects and ambient notes are on by default and can be toggled off at any time in **Settings (⚙️) → Audio**.
