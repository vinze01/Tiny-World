// TinyWorld Workspace Organizer — Local Figma Plugin (Dynamic-Page Safe)
// Organizes existing uploaded frames on Page 1 into 7 structured Figma pages
// without cloning, deleting, resizing, or regenerating any original artwork.

const PAGES = [
  { key: '01', name: '01 \u2014 Design System' },
  { key: '02', name: '02 \u2014 World & Islands' },
  { key: '03', name: '03 \u2014 Creatures (Pipkins)' },
  { key: '04', name: '04 \u2014 Plants & Nature' },
  { key: '05', name: '05 \u2014 Buildings & Decorations' },
  { key: '06', name: '06 \u2014 UI Components & Screens' },
  { key: '07', name: '07 \u2014 Concepts & Future Designs' },
];

const PAGE_BY_KEY = Object.fromEntries(PAGES.map((p) => [p.key, p.name]));

const SECTION_PAD_X = 48;
const SECTION_PAD_TOP = 64;
const SECTION_PAD_BOTTOM = 48;
const ITEM_GAP_X = 48;
const ITEM_GAP_Y = 48;
const SECTION_GAP_X = 96;
const SECTION_GAP_Y = 120;

const STAGE_ORDER = [
  '01', '02', '03', '04', '05',
  '06', '07', '08', '09', '10',
];

const PIPKIN_SPECIES = [
  'Astra', 'Bloom', 'Bloop', 'Cinder', 'Ember',
  'Flurry', 'Frosty', 'Glimmer', 'Luna', 'Mossi',
  'Nimbus', 'Pebble', 'Puffin', 'Sprig', 'Wisp',
];

const UI_SURFACE_ORDER = [
  'Screen - Extension Popup',
  'Screen - Side Panel',
  'Screen - Onboarding Card',
  'Screen - Full World Day',
  'Screen - Full World Night Glow',
];

const UI_SHOP_ORDER = [
  'Screen - Shop Buildings',
  'Screen - Shop Furniture',
  'Screen - Shop Seeds',
  'Screen - Shop Terrain',
  'Screen - Shop Seasonal',
  'Screen - Inventory Bag',
  'Screen - Expand Island',
];

const UI_OVERLAY_ORDER = [
  'Screen - Creatures Panel',
  'Screen - Creature Inspector',
  'Screen - Journal Discoveries',
  'Screen - Achievements List',
  'Screen - Garden Quickbar',
  'Screen - Object Inspector',
  'Screen - Placement Mode',
  'Screen - Settings Modal',
  'Screen - Time Preview Popover',
  'Screen - Welcome Back Toast',
];

const UI_COMP_ORDER = [
  'UI Component - Top HUD',
  'UI Component - Bottom Dock',
  'UI Component - Onboarding Card',
  'UI Component - Shop Drawer',
  'UI Component - Creatures Panel',
  'UI Component - Journal Panel',
  'UI Component - Settings Modal',
];

const UI_ICON_ORDER = [
  'UI Icon Vector - Extension 16',
  'UI Icon - Extension 48',
  'UI Icon - Extension 128',
  'UI Icon Vector - Nature Token',
  'UI Icon Vector - Food Treat',
  'UI Icon Vector - Pond',
];

const UI_VECTOR_ORDER = [
  'UI Vector - Button States',
  'UI Vector - Panel',
  'UI Vector - Medallion',
  'UI Vector - Heart Bar',
];

const WEATHER_ORDER = [
  'Weather - Rain Shower',
  'Weather - Frostfall Snow',
  'Weather - Emberglow Wind',
  'Weather - Mistwood Fog',
  'Weather - Everdream Sparkles',
  'Weather - Starlight Sparkles',
];

const TOD_ORDER = [
  'Island Stage 10 - Morning',
  'Island Stage 10 - Sunset',
  'Island Stage 10 - Night',
];

const CONCEPT_SECTIONS = [
  'Future Biomes & Stage 11+ Concepts',
  'New Pipkin Species Explorations',
  'HUD, Modal & Extension UI Redesigns',
];

/**
 * Fix UTF-8 mojibake (e.g. from multipart upload filenames) while keeping meaningful frame names intact.
 */
function normalizeFrameName(rawName) {
  if (typeof rawName !== 'string') return '';
  let name = rawName
    .replace(/\u00e2\u20ac\u201d/g, '\u2014')
    .replace(/\u00e2\u0080\u0094/g, '\u2014')
    .trim();
  if (/^Catalog\s+\S{1,6}\s+All TinyWorld Assets$/i.test(name)) {
    name = 'Catalog \u2014 All TinyWorld Assets';
  }
  return name;
}

function indexOrder(list, value, fallback) {
  const idx = list.indexOf(value);
  return idx === -1 ? fallback : idx;
}

/**
 * Classify a top-level uploaded artwork frame into its exact destination page & section.
 * Returns null if the frame is genuinely unknown/uncategorized.
 */
function classifyFrame(rawName) {
  const name = normalizeFrameName(rawName);

  // Page 01 — Design System
  if (name === 'Catalog \u2014 All TinyWorld Assets' || name === 'Catalog - All TinyWorld Assets') {
    return { pageKey: '01', section: 'Master Asset Index', order: 0, species: null, kind: 'catalog' };
  }
  if (name === 'UI Vector - Sky Gradients') {
    return { pageKey: '01', section: 'Biome Sky & Lighting Palettes', order: 0, species: null, kind: 'vector' };
  }
  if (name.startsWith('UI Vector - ')) {
    return {
      pageKey: '01',
      section: 'UI Vector Controls & Panels',
      order: indexOrder(UI_VECTOR_ORDER, name, 50),
      species: null,
      kind: 'vector',
    };
  }

  // Page 02 — World & Islands
  if (name === 'Catalog - Islands Stages 1-10' || name === 'Catalog - Terrain & Islands') {
    return { pageKey: '02', section: 'Islands Overview Catalog', order: 0, species: null, kind: 'catalog' };
  }
  if (/^Terrain Patch\b/i.test(name) || /^Terrain Transition\b/i.test(name)) {
    return { pageKey: '02', section: 'Customizable Biome Patches & Transitions', order: 5, species: null, kind: 'terrain' };
  }
  const stageDayMatch = /^Island Stage (\d+)\s*-\s*.+\(Day\)$/i.exec(name);
  if (stageDayMatch) {
    const stageNum = stageDayMatch[1].padStart(2, '0');
    return {
      pageKey: '02',
      section: 'Island Progression (Stages 01\u201310 \u2014 Daytime)',
      order: indexOrder(STAGE_ORDER, stageNum, parseInt(stageNum, 10) || 99),
      species: null,
      kind: 'stage',
    };
  }
  if (TOD_ORDER.includes(name) || /^Island Stage \d+\s*-\s*(Morning|Sunset|Night)$/i.test(name)) {
    return {
      pageKey: '02',
      section: 'Time-of-Day Lighting (Stage 10)',
      order: indexOrder(TOD_ORDER, name, 20),
      species: null,
      kind: 'tod',
    };
  }
  if (name.startsWith('Weather - ')) {
    return {
      pageKey: '02',
      section: 'Weather & Biome Effects',
      order: indexOrder(WEATHER_ORDER, name, 30),
      species: null,
      kind: 'weather',
    };
  }

  // Page 03 — Creatures (Pipkins)
  if (name === 'Catalog - Creatures') {
    return { pageKey: '03', section: 'Creatures Master Catalog', order: 0, species: null, kind: 'catalog' };
  }
  const pipkinVectorMatch = /^Pipkin Vector - (.+)$/.exec(name);
  if (pipkinVectorMatch) {
    const species = pipkinVectorMatch[1].trim();
    return {
      pageKey: '03',
      section: `Pipkin \u2014 ${species}`,
      order: 0,
      species,
      kind: 'pipkin-vector',
    };
  }
  const pipkinPosesMatch = /^Pipkin Poses - (.+)$/.exec(name);
  if (pipkinPosesMatch) {
    const species = pipkinPosesMatch[1].trim();
    return {
      pageKey: '03',
      section: `Pipkin \u2014 ${species}`,
      order: 1,
      species,
      kind: 'pipkin-poses',
    };
  }

  // Page 04 — Plants & Nature
  if (name === 'Catalog - Plants' || /^Plant\b/i.test(name)) {
    return { pageKey: '04', section: 'Plants & Growth Stages', order: 0, species: null, kind: 'plants' };
  }
  if (name === 'Catalog - Nature' || /^Nature\b/i.test(name)) {
    return { pageKey: '04', section: 'Trees, Rocks, Crystals & Natural Scenery', order: 0, species: null, kind: 'nature' };
  }

  // Page 05 — Buildings & Decorations
  if (name === 'Catalog - Buildings' || /^Building\b/i.test(name)) {
    return { pageKey: '05', section: 'Buildings & Structures', order: 0, species: null, kind: 'buildings' };
  }
  if (name === 'Catalog - Decorations' || /^Decoration\b/i.test(name) || /^Seasonal\b/i.test(name)) {
    return { pageKey: '05', section: 'Furniture, Lighting, Paths & Seasonal Decor', order: 0, species: null, kind: 'decorations' };
  }

  // Page 06 — UI Components & Screens
  if (name.startsWith('UI Icon Vector - ') || name.startsWith('UI Icon - ')) {
    return {
      pageKey: '06',
      section: 'UI & Extension Icons',
      order: indexOrder(UI_ICON_ORDER, name, 40),
      species: null,
      kind: 'ui-icon',
    };
  }
  if (name.startsWith('UI Component - ')) {
    return {
      pageKey: '06',
      section: 'Extracted UI Component Specimens',
      order: indexOrder(UI_COMP_ORDER, name, 40),
      species: null,
      kind: 'ui-component',
    };
  }
  if (UI_SURFACE_ORDER.includes(name)) {
    return {
      pageKey: '06',
      section: 'Extension Surfaces (Popup, Side Panel & Full World)',
      order: indexOrder(UI_SURFACE_ORDER, name, 40),
      species: null,
      kind: 'ui-screen',
    };
  }
  if (UI_SHOP_ORDER.includes(name)) {
    return {
      pageKey: '06',
      section: 'Shop, Bag & Island Expansion Screens',
      order: indexOrder(UI_SHOP_ORDER, name, 40),
      species: null,
      kind: 'ui-screen',
    };
  }
  if (UI_OVERLAY_ORDER.includes(name) || name.startsWith('Screen - ')) {
    return {
      pageKey: '06',
      section: 'Creatures, Journal & Gameplay Overlays',
      order: indexOrder(UI_OVERLAY_ORDER, name, 99),
      species: null,
      kind: 'ui-screen',
    };
  }

  return null;
}

/**
 * Collect ONLY top-level artwork nodes (or children directly inside Section containers)
 * without descending into Frame sub-layers.
 */
function collectPageFrames(page) {
  const frames = [];
  for (const child of page.children) {
    if (child.type === 'SECTION') {
      for (const grand of child.children) {
        if (grand.type === 'FRAME') {
          frames.push({ node: grand, currentPage: page });
        }
      }
    } else if (child.type === 'FRAME') {
      frames.push({ node: child, currentPage: page });
    }
  }
  return frames;
}

function resizeSectionSafe(sec, w, h) {
  const safeW = Math.max(100, Math.ceil(w));
  const safeH = Math.max(100, Math.ceil(h));
  if (typeof sec.resizeWithoutConstraints === 'function') {
    sec.resizeWithoutConstraints(safeW, safeH);
  } else if (typeof sec.resize === 'function') {
    sec.resize(safeW, safeH);
  }
  return { width: safeW, height: safeH };
}

/**
 * Lay out frames inside a SectionNode using fixed column wrap grids and return the section bounds.
 */
function populateSectionGrid(section, entries, maxCols) {
  const sorted = [...entries].sort((a, b) => {
    if (a.plan.order !== b.plan.order) return a.plan.order - b.plan.order;
    return normalizeFrameName(a.node.name).localeCompare(normalizeFrameName(b.node.name));
  });

  const rows = [];
  for (let i = 0; i < sorted.length; i += maxCols) {
    rows.push(sorted.slice(i, i + maxCols));
  }

  let cursorY = SECTION_PAD_TOP;
  let maxRowRight = SECTION_PAD_X;

  for (const row of rows) {
    let cursorX = SECTION_PAD_X;
    let rowMaxH = 0;

    // Align vertical centers cleanly when pairing small sprites with taller sheets or icons of varying sizes
    const tallestInRow = Math.max(...row.map((e) => e.node.height || 0));

    for (const entry of row) {
      const node = entry.node;
      const fixedName = normalizeFrameName(node.name);
      if (fixedName && fixedName !== node.name) {
        node.name = fixedName;
      }
      section.appendChild(node);
      node.x = cursorX;
      // Keep bottom/top clean: center smaller items against taller companions in Pipkin rows; top-align uniform cards
      const h = node.height || 0;
      const w = node.width || 0;
      node.y = entry.centerVertically ? cursorY + Math.round((tallestInRow - h) / 2) : cursorY;

      cursorX += w + ITEM_GAP_X;
      if (h > rowMaxH) rowMaxH = h;
    }

    const rowRight = cursorX - ITEM_GAP_X;
    if (rowRight > maxRowRight) maxRowRight = rowRight;
    cursorY += rowMaxH + ITEM_GAP_Y;
  }

  const totalW = rows.length ? maxRowRight + SECTION_PAD_X : 640;
  const totalH = rows.length ? cursorY - ITEM_GAP_Y + SECTION_PAD_BOTTOM : 320;
  const size = resizeSectionSafe(section, totalW, totalH);
  return size;
}

function getOrCreateTargetPages(root, figmaApi) {
  const existingPages = [...root.children];
  const assigned = new Map();

  // Reuse pages whose names already match 01..07 (case-insensitive on prefix key)
  for (const page of existingPages) {
    for (const def of PAGES) {
      if (!assigned.has(def.key) && (page.name === def.name || page.name.startsWith(`${def.key} `))) {
        page.name = def.name;
        assigned.set(def.key, page);
      }
    }
  }

  // Convert bare Page 1 (id 0:1 or first page) to Page 01 if Page 01 wasn't matched yet
  if (!assigned.has('01')) {
    const firstFree = existingPages.find((p) => !Array.from(assigned.values()).includes(p));
    if (firstFree) {
      firstFree.name = PAGE_BY_KEY['01'];
      assigned.set('01', firstFree);
    }
  }

  for (const def of PAGES) {
    if (!assigned.has(def.key)) {
      const created = figmaApi.createPage();
      created.name = def.name;
      assigned.set(def.key, created);
    }
  }

  // Ensure exact visual ordering 01 -> 07
  for (let i = 0; i < PAGES.length; i++) {
    const page = assigned.get(PAGES[i].key);
    root.insertChild(i, page);
  }

  return assigned;
}

function buildSection(page, title, figmaApi) {
  const sec = figmaApi.createSection();
  sec.name = title;
  if (typeof sec.setPluginData === 'function') {
    sec.setPluginData('twOrganizer', 'section');
  }
  page.appendChild(sec);
  return sec;
}

function layoutPage01(page, entries, figmaApi) {
  const bySec = groupBySection(entries);
  let cursorY = 0;

  if (bySec.has('UI Vector Controls & Panels')) {
    const sec = buildSection(page, 'UI Vector Controls & Panels', figmaApi);
    const size = populateSectionGrid(sec, bySec.get('UI Vector Controls & Panels'), 4);
    sec.x = 0;
    sec.y = cursorY;
    cursorY += size.height + SECTION_GAP_Y;
  }
  if (bySec.has('Biome Sky & Lighting Palettes')) {
    const sec = buildSection(page, 'Biome Sky & Lighting Palettes', figmaApi);
    const size = populateSectionGrid(sec, bySec.get('Biome Sky & Lighting Palettes'), 2);
    sec.x = 0;
    sec.y = cursorY;
    cursorY += size.height + SECTION_GAP_Y;
  }
  if (bySec.has('Master Asset Index')) {
    const sec = buildSection(page, 'Master Asset Index', figmaApi);
    const size = populateSectionGrid(sec, bySec.get('Master Asset Index'), 1);
    sec.x = 0;
    sec.y = cursorY;
  }
}

function layoutPage02(page, entries, figmaApi) {
  const bySec = groupBySection(entries);
  let cursorY = 0;

  const order = [
    { name: 'Islands Overview Catalog', cols: 1 },
    { name: 'Island Progression (Stages 01\u201310 \u2014 Daytime)', cols: 5 },
    { name: 'Time-of-Day Lighting (Stage 10)', cols: 3 },
    { name: 'Weather & Biome Effects', cols: 3 },
  ];

  for (const def of order) {
    if (!bySec.has(def.name)) continue;
    const sec = buildSection(page, def.name, figmaApi);
    const size = populateSectionGrid(sec, bySec.get(def.name), def.cols);
    sec.x = 0;
    sec.y = cursorY;
    cursorY += size.height + SECTION_GAP_Y;
  }
}

function layoutPage03(page, entries, figmaApi) {
  const bySec = groupBySection(entries);
  let cursorY = 0;

  if (bySec.has('Creatures Master Catalog')) {
    const sec = buildSection(page, 'Creatures Master Catalog', figmaApi);
    const size = populateSectionGrid(sec, bySec.get('Creatures Master Catalog'), 1);
    sec.x = 0;
    sec.y = cursorY;
    cursorY += size.height + SECTION_GAP_Y;
  }

  // Group all remaining species sections cleanly 3-wide in canonical species order
  const speciesTitles = Array.from(bySec.keys())
    .filter((t) => t.startsWith('Pipkin \u2014 '))
    .sort((a, b) => {
      const sa = a.replace('Pipkin \u2014 ', '');
      const sb = b.replace('Pipkin \u2014 ', '');
      const ia = indexOrder(PIPKIN_SPECIES, sa, 999);
      const ib = indexOrder(PIPKIN_SPECIES, sb, 999);
      return ia !== ib ? ia - ib : sa.localeCompare(sb);
    });

  const COLS = 3;
  for (let rowStart = 0; rowStart < speciesTitles.length; rowStart += COLS) {
    const slice = speciesTitles.slice(rowStart, rowStart + COLS);
    let cursorX = 0;
    let rowMaxH = 0;

    for (const title of slice) {
      const sec = buildSection(page, title, figmaApi);
      const groupEntries = bySec.get(title).map((e) => ({ ...e, centerVertically: true }));
      const size = populateSectionGrid(sec, groupEntries, 2);
      sec.x = cursorX;
      sec.y = cursorY;
      cursorX += size.width + SECTION_GAP_X;
      if (size.height > rowMaxH) rowMaxH = size.height;
    }

    cursorY += rowMaxH + SECTION_GAP_Y;
  }
}

function layoutHorizontalPairs(page, entries, sectionOrder, figmaApi) {
  const bySec = groupBySection(entries);
  let cursorX = 0;
  let cursorY = 0;
  let rowMaxH = 0;
  let count = 0;

  for (const name of sectionOrder) {
    if (!bySec.has(name)) continue;
    const sec = buildSection(page, name, figmaApi);
    const size = populateSectionGrid(sec, bySec.get(name), 2);
    sec.x = cursorX;
    sec.y = cursorY;
    cursorX += size.width + SECTION_GAP_X;
    if (size.height > rowMaxH) rowMaxH = size.height;
    count += 1;
    if (count % 2 === 0) {
      cursorX = 0;
      cursorY += rowMaxH + SECTION_GAP_Y;
      rowMaxH = 0;
    }
  }
}

function layoutPage06(page, entries, figmaApi) {
  const bySec = groupBySection(entries);
  let cursorY = 0;

  const order = [
    { name: 'UI & Extension Icons', cols: 6, center: true },
    { name: 'Extracted UI Component Specimens', cols: 4, center: false },
    { name: 'Extension Surfaces (Popup, Side Panel & Full World)', cols: 3, center: false },
    { name: 'Shop, Bag & Island Expansion Screens', cols: 3, center: false },
    { name: 'Creatures, Journal & Gameplay Overlays', cols: 3, center: false },
  ];

  for (const def of order) {
    if (!bySec.has(def.name)) continue;
    const sec = buildSection(page, def.name, figmaApi);
    const items = bySec.get(def.name).map((e) => ({ ...e, centerVertically: def.center }));
    const size = populateSectionGrid(sec, items, def.cols);
    sec.x = 0;
    sec.y = cursorY;
    cursorY += size.height + SECTION_GAP_Y;
  }
}

function layoutPage07(page, figmaApi) {
  // Preserve any user-created concepts already placed on page 07; add starter sections only when empty
  const existingTitles = new Set(
    page.children.filter((c) => c.type === 'SECTION').map((c) => c.name),
  );
  let cursorX = 0;
  for (const title of CONCEPT_SECTIONS) {
    if (existingTitles.has(title)) continue;
    const sec = buildSection(page, title, figmaApi);
    resizeSectionSafe(sec, 1280, 840);
    sec.x = cursorX;
    sec.y = 0;
    cursorX += 1280 + SECTION_GAP_X;
  }
}

function groupBySection(entries) {
  const map = new Map();
  for (const entry of entries) {
    const key = entry.plan.section;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return map;
}

/**
 * Inspect the entire document without mutating anything. Returns planned distribution + snapshot.
 */
async function scanWorkspace(figmaApi) {
  const root = figmaApi.root;
  const snapshots = [];
  const plannedCounts = Object.fromEntries(PAGES.map((p) => [p.name, 0]));
  const uncategorized = [];

  for (const page of root.children) {
    await page.loadAsync();
    const frames = collectPageFrames(page);
    for (const { node, currentPage } of frames) {
      const normalized = normalizeFrameName(node.name);
      const plan = classifyFrame(node.name);
      const snap = {
        id: node.id,
        originalName: node.name,
        normalizedName: normalized,
        width: node.width,
        height: node.height,
        sourcePageId: currentPage.id,
        sourcePageName: currentPage.name,
        plan,
      };
      snapshots.push(snap);
      if (plan) {
        const targetPageName = PAGE_BY_KEY[plan.pageKey];
        plannedCounts[targetPageName] = (plannedCounts[targetPageName] || 0) + 1;
      } else {
        uncategorized.push({ id: node.id, name: node.name, width: node.width, height: node.height, page: currentPage.name });
      }
    }
  }

  return {
    totalFrames: snapshots.length,
    plannedCounts,
    uncategorized,
    pagesPresent: root.children.map((p) => ({ id: p.id, name: p.name })),
    snapshots,
  };
}

/**
 * Remove ONLY empty sections created during this/prior organizer passes (never user content).
 */
function cleanupEmptyOrganizerSections(pagesMap) {
  for (const page of pagesMap.values()) {
    for (const child of [...page.children]) {
      if (child.type === 'SECTION' && child.children.length === 0) {
        const tag = typeof child.getPluginData === 'function' ? child.getPluginData('twOrganizer') : '';
        if (tag === 'section') {
          child.remove();
        }
      }
    }
  }
}

/**
 * Perform full non-destructive organization across all 7 Figma pages + post-run validation audit.
 */
async function organizeDocument(figmaApi) {
  const preScan = await scanWorkspace(figmaApi);

  // Resolve real node references indexed by ID after all pages are loaded
  const nodeById = new Map();
  for (const page of figmaApi.root.children) {
    for (const { node } of collectPageFrames(page)) {
      nodeById.set(node.id, node);
    }
  }

  const pageMap = getOrCreateTargetPages(figmaApi.root, figmaApi);
  for (const p of pageMap.values()) {
    await p.loadAsync();
  }

  // Group matched frames by target page key
  const entriesByPage = Object.fromEntries(PAGES.map((p) => [p.key, []]));
  for (const snap of preScan.snapshots) {
    if (!snap.plan) continue;
    const node = nodeById.get(snap.id);
    if (!node) continue;
    entriesByPage[snap.plan.pageKey].push({ node, plan: snap.plan, snap });
  }

  // Move and lay out frames page by page
  layoutPage01(pageMap.get('01'), entriesByPage['01'], figmaApi);
  layoutPage02(pageMap.get('02'), entriesByPage['02'], figmaApi);
  layoutPage03(pageMap.get('03'), entriesByPage['03'], figmaApi);
  layoutHorizontalPairs(pageMap.get('04'), entriesByPage['04'], [
    'Plants & Growth Stages',
    'Trees, Rocks, Crystals & Natural Scenery',
  ], figmaApi);
  layoutHorizontalPairs(pageMap.get('05'), entriesByPage['05'], [
    'Buildings & Structures',
    'Furniture, Lighting, Paths & Seasonal Decor',
  ], figmaApi);
  layoutPage06(pageMap.get('06'), entriesByPage['06'], figmaApi);
  layoutPage07(pageMap.get('07'), figmaApi);

  cleanupEmptyOrganizerSections(pageMap);

  // Validation pass: re-scan entire document and verify strict invariants
  const afterSnapshots = [];
  const finalCountsByPage = {};
  const finalPageOrder = figmaApi.root.children.map((p) => p.name);
  const seenIds = new Set();
  const duplicateIds = [];
  const misplaced = [];
  const dimensionChanges = [];

  for (const page of figmaApi.root.children) {
    await page.loadAsync();
    const frames = collectPageFrames(page);
    finalCountsByPage[page.name] = frames.length;
    for (const { node } of frames) {
      if (seenIds.has(node.id)) duplicateIds.push(node.id);
      seenIds.add(node.id);
      afterSnapshots.push({ id: node.id, name: node.name, width: node.width, height: node.height, pageName: page.name });
    }
  }

  const preById = new Map(preScan.snapshots.map((s) => [s.id, s]));
  const afterById = new Map(afterSnapshots.map((s) => [s.id, s]));
  const missingIds = [];

  for (const [id, before] of preById.entries()) {
    const after = afterById.get(id);
    if (!after) {
      missingIds.push({ id, name: before.originalName });
      continue;
    }
    if (after.width !== before.width || after.height !== before.height) {
      dimensionChanges.push({
        id,
        name: after.name,
        before: [before.width, before.height],
        after: [after.width, after.height],
      });
    }
    if (before.plan) {
      const expectedPage = PAGE_BY_KEY[before.plan.pageKey];
      if (after.pageName !== expectedPage) {
        misplaced.push({ id, name: after.name, expectedPage, actualPage: after.pageName });
      }
    }
  }

  // Navigate to Page 01 so the user lands right at the start of the organized workspace
  const page01 = pageMap.get('01');
  if (typeof figmaApi.setCurrentPageAsync === 'function') {
    await figmaApi.setCurrentPageAsync(page01);
  }
  if (figmaApi.viewport && typeof figmaApi.viewport.scrollAndZoomIntoView === 'function' && page01.children.length > 0) {
    figmaApi.viewport.scrollAndZoomIntoView(page01.children);
  }

  const movedCount = preScan.snapshots.filter((s) => {
    if (!s.plan) return false;
    const after = afterById.get(s.id);
    return after && after.pageName === PAGE_BY_KEY[s.plan.pageKey];
  }).length;

  const validationPassed =
    preScan.totalFrames === afterSnapshots.length &&
    missingIds.length === 0 &&
    duplicateIds.length === 0 &&
    dimensionChanges.length === 0 &&
    misplaced.length === 0 &&
    preScan.uncategorized.length === 0 &&
    PAGES.every((def, i) => finalPageOrder[i] === def.name);

  return {
    validationPassed,
    beforeTotalFrames: preScan.totalFrames,
    afterTotalFrames: afterSnapshots.length,
    movedCount,
    pagesCreatedOrVerified: finalPageOrder,
    countsByPage: finalCountsByPage,
    uncategorized: preScan.uncategorized,
    missingIds,
    duplicateIds,
    dimensionChanges,
    misplaced,
  };
}

function bootPlugin() {
  const PANEL_WIDTH = 380;
  figma.showUI(__html__, { width: PANEL_WIDTH, height: 540, themeColors: true });

  if (typeof figma.root.setRelaunchData === 'function') {
    figma.root.setRelaunchData({
      organize: 'Organize TinyWorld frames into Pages 01-07',
    });
  }

  figma.ui.onmessage = async (msg) => {
    try {
      if (msg.type === 'scan') {
        const report = await scanWorkspace(figma);
        figma.ui.postMessage({ type: 'scan-result', report });
        return;
      }

      if (msg.type === 'organize') {
        const result = await organizeDocument(figma);
        figma.ui.postMessage({ type: 'organize-result', result });
        figma.notify(
          result.validationPassed
            ? `TinyWorld organized: ${result.movedCount} frames across 7 pages (0 errors).`
            : `TinyWorld finished with ${result.uncategorized.length} uncategorized / check panel.`,
        );
        return;
      }

      if (msg.type === 'jump-page' && msg.pageName) {
        const target = figma.root.children.find((p) => p.name === msg.pageName);
        if (target) {
          await target.loadAsync();
          await figma.setCurrentPageAsync(target);
          if (target.children.length > 0) {
            figma.viewport.scrollAndZoomIntoView(target.children);
          }
          figma.notify(`Opened ${target.name}`);
        }
        return;
      }

      if (msg.type === 'close') {
        figma.closePlugin();
      }
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      figma.ui.postMessage({ type: 'error', message });
      figma.notify(`Organizer error: ${message}`, { error: true });
    }
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.__twOrganizerExports = {
    PAGES,
    PAGE_BY_KEY,
    PIPKIN_SPECIES,
    normalizeFrameName,
    classifyFrame,
    collectPageFrames,
    scanWorkspace,
    organizeDocument,
  };
}

if (typeof figma !== 'undefined' && typeof figma.showUI === 'function') {
  bootPlugin();
}
