import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BiomeId } from '../../src/core/types';
import { CREATURES, ITEMS, PLANTS, STAGES } from '../../src/core/catalog';
import { skyAt } from '../../src/core/daycycle';
import { WEATHER_META } from '../../src/core/events';
import { SEED_COL } from '../../src/art/atlas';
import { TILE_H, TILE_W } from '../../src/core/grid';
import { SPECIES } from '../../src/art/creatures';
import { cliffPaletteFor, grassPaletteFor } from '../../src/art/island';
import { OUTLINE } from '../../src/art/pix';
import { BIOMES, FIGMA_TARGET_URL, PALETTE_BIOMES } from './inventory';

export function numToHex(color: number): string {
  return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
}

function parseRootCssVars(cssText: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) return vars;
  const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rootMatch[1])) !== null) {
    vars[m[1].trim()] = m[2].trim();
  }
  return vars;
}

function extractCssClassRules(cssText: string): {
  radii: Record<string, string>;
  shadows: Record<string, string>;
} {
  const radii: Record<string, string> = {};
  const shadows: Record<string, string> = {};
  const blockRe = /(\.[a-zA-Z0-9_-]+(?:\s*,\s*\.[a-zA-Z0-9_-]+)*)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(cssText)) !== null) {
    const sel = m[1].trim();
    const body = m[2];
    const rad = body.match(/border-radius\s*:\s*([^;]+);/);
    if (rad) radii[sel] = rad[1].trim();
    const sh = body.match(/box-shadow\s*:\s*([^;]+);/);
    if (sh) shadows[sel] = sh[1].trim().replace(/\s+/g, ' ');
  }
  return { radii, shadows };
}

export interface GeneratedTokensBundle {
  designTokens: Record<string, unknown>;
  figmaVariables: Record<string, unknown>;
  componentSvgs: { filename: string; svg: string }[];
}

export function buildTokensBundle(rootDir: string): GeneratedTokensBundle {
  const themeCssPath = resolve(rootDir, 'src/ui/theme.css');
  const themeCss = readFileSync(themeCssPath, 'utf8');
  const cssVars = parseRootCssVars(themeCss);
  const { radii: cssRadii, shadows: cssShadows } = extractCssClassRules(themeCss);

  const colorTokens: Record<string, { $value: string; $type: 'color'; cssVar: string; role: string }> = {};
  const colorRoles: Record<string, string> = {
    '--cream': 'Primary storybook parchment card surface',
    '--cream-hi': 'Elevated parchment highlight and bevel top edge',
    '--cream-lo': 'Inset parchment well and subtle divider tone',
    '--forest': 'Primary cozy action green (plant/confirm)',
    '--forest-dark': 'Primary green outline & pressed bevel border',
    '--sage': 'Muted botanical accent for secondary chips & tags',
    '--wood': 'Warm timber chrome & storybook border trim',
    '--wood-dark': 'Dark timber ink outline & frame shadow',
    '--gold': 'Nature Token & milestone highlight gold',
    '--gold-dark': 'Gold bevel border & warm bronze shadow',
    '--sky': 'Cozy cerulean badge & water/weather accent',
    '--ink': 'Primary high-contrast storybook body ink',
    '--ink-soft': 'Secondary caption & subtitle ink',
    '--danger': 'Destructive action / remove / low warning accent',
  };

  for (const [k, v] of Object.entries(cssVars)) {
    if (v.startsWith('#') || v.startsWith('rgb')) {
      colorTokens[k.replace(/^--/, '')] = {
        $value: v,
        $type: 'color',
        cssVar: k,
        role: colorRoles[k] ?? 'Theme CSS variable',
      };
    }
  }

  const skyPresets: Record<BiomeId, Record<string, { hour: number; top: string; bot: string; tint: string; night: number }>> =
    {} as Record<BiomeId, Record<string, { hour: number; top: string; bot: string; tint: string; night: number }>>;
  const sampleHours = [
    { name: 'dawn', hour: 5 },
    { name: 'morning', hour: 7 },
    { name: 'day', hour: 12 },
    { name: 'goldenHour', hour: 17 },
    { name: 'sunset', hour: 18.5 },
    { name: 'twilight', hour: 20 },
    { name: 'night', hour: 23 },
  ];
  for (const biome of BIOMES) {
    skyPresets[biome] = {};
    for (const s of sampleHours) {
      const k = skyAt(0, 'custom', s.hour, biome);
      skyPresets[biome][s.name] = {
        hour: s.hour,
        top: numToHex(k.skyTop),
        bot: numToHex(k.skyBottom),
        tint: numToHex(k.tint),
        night: Number(k.night.toFixed(3)),
      };
    }
  }

  const creaturePalettes: Record<string, {
    name: string;
    species: string;
    personality: string[];
    rx: number;
    ry: number;
    body: string;
    belly: string;
    cheek: string;
    fuzz: string;
  }> = {};
  for (const c of CREATURES) {
    const sp = SPECIES[c.id];
    creaturePalettes[c.id] = {
      name: c.name,
      species: c.species,
      personality: c.personality,
      rx: sp.rx,
      ry: sp.ry,
      body: numToHex(sp.body),
      belly: numToHex(sp.belly),
      cheek: numToHex(sp.cheek),
      fuzz: numToHex(sp.fuzz),
    };
  }

  const biomePalettes: Record<BiomeId, {
    grass: string[];
    cliff: string[];
  }> = {} as Record<BiomeId, { grass: string[]; cliff: string[] }>;
  for (const biome of BIOMES) {
    biomePalettes[biome] = {
      grass: grassPaletteFor(biome).map((hex) => numToHex(hex)),
      cliff: cliffPaletteFor(biome).map((hex) => numToHex(hex)),
    };
  }

  const plantSeedColors: Record<string, string> = {};
  for (const p of PLANTS) {
    plantSeedColors[p.id] = numToHex(SEED_COL[p.id]);
  }

  const designTokens = {
    $schema: 'https://tr.designtokens.org/format/',
    meta: {
      project: 'Tiny World',
      figmaUrl: FIGMA_TARGET_URL,
      sourceFiles: [
        'src/ui/theme.css',
        'src/core/daycycle.ts',
        'src/art/pix.ts',
        'src/art/island.ts',
        'src/art/creatures.ts',
        'src/art/atlas.ts',
      ],
    },
    color: {
      ui: colorTokens,
      artCore: {
        pixelOutline: { $value: numToHex(OUTLINE), $type: 'color', role: 'Global sprite dark-plum pixel outline' },
        highlightGlow: { $value: '#ffe27a', $type: 'color', role: 'Selection / hover diamond highlight' },
        validPlacement: { $value: '#6ee86e', $type: 'color', role: 'Valid isometric tile placement tint' },
        invalidPlacement: { $value: '#ff6262', $type: 'color', role: 'Blocked isometric tile placement tint' },
        waterableHint: { $value: '#38bdf8', $type: 'color', role: 'Plant needs water tile outline' },
        harvestableHint: { $value: '#fb923c', $type: 'color', role: 'Plant mature ready-to-harvest outline' },
        annoyedTint: { $value: '#ffb4b4', $type: 'color', role: 'Over-tapped Pipkin grumpy tint' },
        nightLanternGlow: { $value: '#ffcc68', $type: 'color', role: 'Warm campfire / lantern glow halo' },
        nightCrystalGlow: { $value: '#7af0ff', $type: 'color', role: 'Cool crystal / mushroom bioluminescence' },
        nightArcaneGlow: { $value: '#c084fc', $type: 'color', role: 'Starlight / alchemy / arcane glow' },
      },
      creatures: creaturePalettes,
      biomes: biomePalettes,
      seedPackets: plantSeedColors,
      skyCycle: skyPresets,
      weather: WEATHER_META,
    },
    typography: {
      fontDisplay: { $value: cssVars['--font-display'] ?? "'Pixelify Sans', sans-serif", $type: 'fontFamily' },
      fontBody: { $value: cssVars['--font-body'] ?? "'Nunito Variable', sans-serif", $type: 'fontFamily' },
      scale: {
        caption: { fontSize: 10, lineHeight: 1.25, fontWeight: 700, family: 'body' },
        label: { fontSize: 12, lineHeight: 1.3, fontWeight: 700, family: 'body' },
        body: { fontSize: 13, lineHeight: 1.4, fontWeight: 600, family: 'body' },
        cardTitle: { fontSize: 15, lineHeight: 1.25, fontWeight: 800, family: 'display' },
        panelTitle: { fontSize: 18, lineHeight: 1.2, fontWeight: 700, family: 'display' },
        hudCounter: { fontSize: 16, lineHeight: 1, fontWeight: 800, family: 'display' },
      },
    },
    spacing: {
      xs: { $value: '4px', $type: 'dimension' },
      sm: { $value: '8px', $type: 'dimension' },
      md: { $value: '12px', $type: 'dimension' },
      lg: { $value: '16px', $type: 'dimension' },
      xl: { $value: '24px', $type: 'dimension' },
    },
    radii: {
      sm: { $value: '8px', $type: 'dimension' },
      md: { $value: '12px', $type: 'dimension' },
      lg: { $value: '16px', $type: 'dimension' },
      pill: { $value: '999px', $type: 'dimension' },
      extracted: cssRadii,
    },
    shadows: {
      panel: { $value: cssShadows['.tw-panel'] ?? '0 6px 0 rgba(59,45,35,0.22), 0 12px 24px rgba(24,20,36,0.25)', $type: 'shadow' },
      button: { $value: cssShadows['.tw-btn'] ?? '0 2px 0 var(--wood-dark)', $type: 'shadow' },
      extracted: cssShadows,
    },
    isometric: {
      tileWidthPx: TILE_W,
      tileHeightPx: TILE_H,
      projectionRatio: '2:1',
    },
    surfaces: {
      popup: { width: 420, height: 560, entry: 'popup.html' },
      sidepanel: { width: 380, height: 700, entry: 'sidepanel.html' },
      full: { width: 1280, height: 800, entry: 'game.html' },
    },
    progression: {
      stages: STAGES.map((s) => ({ stage: s.id, name: s.name, gridW: s.gridW, gridH: s.gridH, biome: s.biome, cost: s.cost })),
      catalogTotals: {
        creatures: CREATURES.length,
        plants: PLANTS.length,
        items: ITEMS.length,
      },
    },
  };

  // Figma Variables JSON structure compatible with official Tokens Studio & Figma Variables import
  const figmaVariables = {
    version: '1.0.0',
    targetFigmaFile: FIGMA_TARGET_URL,
    collections: [
      {
        name: 'Tiny World / UI Storybook Theme',
        modes: ['Default (Storybook Cream)'],
        variables: Object.entries(colorTokens).map(([name, tok]) => ({
          name: `ui/${name}`,
          type: 'COLOR',
          value: tok.$value,
          description: `${tok.cssVar} — ${tok.role}`,
        })),
      },
      {
        name: 'Tiny World / Pixel Art Master Palette',
        modes: ['Master'],
        variables: [
          { name: 'art/outline', type: 'COLOR', value: numToHex(OUTLINE), description: 'Global sprite outline' },
          ...Object.entries(creaturePalettes).flatMap(([id, pal]) => [
            { name: `creatures/${id}/body`, type: 'COLOR', value: pal.body },
            { name: `creatures/${id}/belly`, type: 'COLOR', value: pal.belly },
            { name: `creatures/${id}/cheek`, type: 'COLOR', value: pal.cheek },
            { name: `creatures/${id}/fuzz`, type: 'COLOR', value: pal.fuzz },
          ]),
        ],
      },
      {
        name: 'Tiny World / Day Cycle Sky Modes',
        modes: ['morning', 'day', 'sunset', 'night'],
        variables: BIOMES.flatMap((biome) => [
          {
            name: `sky/${biome}/top`,
            type: 'COLOR',
            valuesByMode: {
              morning: skyPresets[biome].morning.top,
              day: skyPresets[biome].day.top,
              sunset: skyPresets[biome].sunset.top,
              night: skyPresets[biome].night.top,
            },
          },
          {
            name: `sky/${biome}/bottom`,
            type: 'COLOR',
            valuesByMode: {
              morning: skyPresets[biome].morning.bot,
              day: skyPresets[biome].day.bot,
              sunset: skyPresets[biome].sunset.bot,
              night: skyPresets[biome].night.bot,
            },
          },
          {
            name: `sky/${biome}/world-tint`,
            type: 'COLOR',
            valuesByMode: {
              morning: skyPresets[biome].morning.tint,
              day: skyPresets[biome].day.tint,
              sunset: skyPresets[biome].sunset.tint,
              night: skyPresets[biome].night.tint,
            },
          },
        ]),
      },
    ],
  };

  const c = (name: string, fallback: string) => cssVars[name] ?? fallback;
  const cream = c('--cream', '#f9f1df');
  const creamHi = c('--cream-hi', '#fffaf0');
  const creamLo = c('--cream-lo', '#ebd9b9');
  const forest = c('--forest', '#4b9b58');
  const forestDark = c('--forest-dark', '#2d6838');
  const wood = c('--wood', '#7a5a42');
  const woodDark = c('--wood-dark', '#4a3525');
  const gold = c('--gold', '#f2b840');
  const goldDark = c('--gold-dark', '#b57b16');
  const ink = c('--ink', '#3b2d23');
  const inkSoft = c('--ink-soft', '#6e5a4a');
  const danger = c('--danger', '#d9534f');
  const skyCol = c('--sky', '#69b4e3');

  const panelSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 200" width="360" height="200">
  <g id="tw-panel">
    <rect id="panel-drop-shadow" x="14" y="20" width="332" height="166" rx="16" fill="${ink}" fill-opacity="0.24"/>
    <rect id="panel-outer-border" x="14" y="14" width="332" height="166" rx="16" fill="${woodDark}"/>
    <rect id="panel-inner-fill" x="17" y="17" width="326" height="160" rx="13" fill="${cream}"/>
    <rect id="panel-top-bevel" x="19" y="19" width="322" height="26" rx="11" fill="${creamHi}"/>
    <line id="panel-header-divider" x1="28" y1="54" x2="332" y2="54" stroke="${creamLo}" stroke-width="2"/>
    <text id="panel-title" x="30" y="42" font-family="Pixelify Sans, sans-serif" font-size="16" font-weight="700" fill="${ink}">Storybook Panel (.tw-panel)</text>
    <rect id="panel-content-well" x="30" y="68" width="300" height="92" rx="10" fill="${creamLo}" stroke="${wood}" stroke-opacity="0.35" stroke-width="1.5"/>
    <text id="panel-body-sample" x="44" y="94" font-family="Nunito, sans-serif" font-size="13" font-weight="700" fill="${ink}">Cream parchment body with 3px wood-dark frame</text>
    <text id="panel-caption-sample" x="44" y="114" font-family="Nunito, sans-serif" font-size="11" font-weight="600" fill="${inkSoft}">Background: ${cream} • Border: ${woodDark} • Radius: 16px</text>
  </g>
</svg>
`;

  const buttonsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 180" width="560" height="180">
  <rect x="0" y="0" width="560" height="180" rx="14" fill="${cream}"/>
  <text x="20" y="30" font-family="Pixelify Sans, sans-serif" font-size="15" font-weight="700" fill="${ink}">Storybook Button Specimens (.tw-btn variants &amp; states)</text>
  <g id="btn-secondary" transform="translate(20,48)">
    <rect x="0" y="3" width="116" height="36" rx="10" fill="${woodDark}"/>
    <rect x="0" y="0" width="116" height="36" rx="10" fill="${creamHi}" stroke="${wood}" stroke-width="2"/>
    <text x="58" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="13" font-weight="800" fill="${ink}">Secondary</text>
  </g>
  <g id="btn-primary" transform="translate(152,48)">
    <rect x="0" y="3" width="116" height="36" rx="10" fill="${forestDark}"/>
    <rect x="0" y="0" width="116" height="36" rx="10" fill="${forest}" stroke="${forestDark}" stroke-width="2"/>
    <text x="58" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="13" font-weight="800" fill="#ffffff">Primary</text>
  </g>
  <g id="btn-gold" transform="translate(284,48)">
    <rect x="0" y="3" width="116" height="36" rx="10" fill="${goldDark}"/>
    <rect x="0" y="0" width="116" height="36" rx="10" fill="${gold}" stroke="${goldDark}" stroke-width="2"/>
    <text x="58" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="13" font-weight="800" fill="${ink}">Gold / Buy</text>
  </g>
  <g id="btn-danger" transform="translate(416,48)">
    <rect x="0" y="3" width="120" height="36" rx="10" fill="#8f2926"/>
    <rect x="0" y="0" width="120" height="36" rx="10" fill="${danger}" stroke="#8f2926" stroke-width="2"/>
    <text x="60" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="13" font-weight="800" fill="#ffffff">Danger</text>
  </g>
  <g id="btn-pressed" transform="translate(20,108)">
    <rect x="0" y="2" width="116" height="34" rx="10" fill="${forest}" stroke="${forestDark}" stroke-width="2"/>
    <text x="58" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="#ffffff">Pressed (+2px)</text>
  </g>
  <g id="btn-disabled" transform="translate(152,108)" opacity="0.48">
    <rect x="0" y="0" width="116" height="36" rx="10" fill="${creamLo}" stroke="${wood}" stroke-width="2"/>
    <text x="58" y="23" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="${inkSoft}">Disabled</text>
  </g>
  <g id="btn-pill-active" transform="translate(284,110)">
    <rect x="0" y="0" width="116" height="32" rx="16" fill="${skyCol}" stroke="${woodDark}" stroke-width="2"/>
    <text x="58" y="20" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="${ink}">Active Tool</text>
  </g>
  <g id="btn-pill-badge" transform="translate(416,112)">
    <rect x="0" y="0" width="120" height="28" rx="14" fill="${creamHi}" stroke="${goldDark}" stroke-width="2"/>
    <text x="60" y="18" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="${ink}">120 Tokens</text>
  </g>
</svg>
`;

  const medallionSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 140" width="280" height="140">
  <rect x="0" y="0" width="280" height="140" rx="14" fill="${cream}"/>
  <g id="medallion-token" transform="translate(20,24)">
    <rect x="0" y="3" width="144" height="42" rx="21" fill="${woodDark}"/>
    <rect x="0" y="0" width="144" height="42" rx="21" fill="${creamHi}" stroke="${woodDark}" stroke-width="2.5"/>
    <circle cx="23" cy="21" r="13" fill="${gold}" stroke="${goldDark}" stroke-width="2"/>
    <text x="23" y="25" text-anchor="middle" font-family="Pixelify Sans, sans-serif" font-size="12" font-weight="700" fill="${ink}">N</text>
    <text x="46" y="26" font-family="Pixelify Sans, sans-serif" font-size="16" font-weight="700" fill="${ink}">1,250</text>
  </g>
  <g id="badge-stage" transform="translate(20,82)">
    <rect x="0" y="0" width="240" height="32" rx="10" fill="${creamLo}" stroke="${wood}" stroke-width="1.5"/>
    <circle cx="18" cy="16" r="6" fill="${forest}"/>
    <text x="34" y="20" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="${ink}">Stage 5 • Whispering Canopy</text>
  </g>
  <g id="badge-weather" transform="translate(178,29)">
    <rect x="0" y="0" width="82" height="32" rx="16" fill="${skyCol}" stroke="${woodDark}" stroke-width="2"/>
    <text x="41" y="20" text-anchor="middle" font-family="Nunito, sans-serif" font-size="12" font-weight="800" fill="${ink}">Sunny</text>
  </g>
</svg>
`;

  const heartSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 72" width="220" height="72">
  <rect x="0" y="0" width="220" height="72" rx="12" fill="${cream}" stroke="${woodDark}" stroke-width="2"/>
  <text x="16" y="22" font-family="Nunito, sans-serif" font-size="11" font-weight="800" fill="${inkSoft}">Pipkin Affection / Bond Bar</text>
  <g id="hearts-row" transform="translate(16,32)">
    <rect x="0" y="0" width="188" height="24" rx="12" fill="${creamLo}"/>
    <path transform="translate(10,3)" d="M9 16 C4 12 1 9 1 5 A4 4 0 0 1 9 3 A4 4 0 0 1 17 5 C17 9 14 12 9 16 Z" fill="#e85872" stroke="${woodDark}" stroke-width="1.5"/>
    <path transform="translate(46,3)" d="M9 16 C4 12 1 9 1 5 A4 4 0 0 1 9 3 A4 4 0 0 1 17 5 C17 9 14 12 9 16 Z" fill="#e85872" stroke="${woodDark}" stroke-width="1.5"/>
    <path transform="translate(82,3)" d="M9 16 C4 12 1 9 1 5 A4 4 0 0 1 9 3 A4 4 0 0 1 17 5 C17 9 14 12 9 16 Z" fill="#e85872" stroke="${woodDark}" stroke-width="1.5"/>
    <path transform="translate(118,3)" d="M9 16 C4 12 1 9 1 5 A4 4 0 0 1 9 3 A4 4 0 0 1 17 5 C17 9 14 12 9 16 Z" fill="#f5a5b3" stroke="${woodDark}" stroke-width="1.5"/>
    <path transform="translate(154,3)" d="M9 16 C4 12 1 9 1 5 A4 4 0 0 1 9 3 A4 4 0 0 1 17 5 C17 9 14 12 9 16 Z" fill="#ffffff" stroke="${inkSoft}" stroke-width="1.5"/>
  </g>
</svg>
`;

  const gradDefs: string[] = [];
  const biomeRows: string[] = [];
  const tods: ('morning' | 'day' | 'sunset' | 'night')[] = ['morning', 'day', 'sunset', 'night'];
  PALETTE_BIOMES.forEach((biome, bi) => {
    const y = 38 + bi * 32;
    biomeRows.push(`<text x="16" y="${y + 16}" font-family="Nunito, sans-serif" font-size="11" font-weight="800" fill="${ink}">${biome}</text>`);
    tods.forEach((tod, ti) => {
      const k = skyPresets[biome][tod];
      const gid = `sky-${biome}-${tod}`;
      gradDefs.push(
        `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${k.top}"/><stop offset="100%" stop-color="${k.bot}"/></linearGradient>`,
      );
      const x = 104 + ti * 140;
      biomeRows.push(
        `<rect x="${x}" y="${y}" width="128" height="24" rx="6" fill="url(#${gid})" stroke="${woodDark}" stroke-width="1"/>`,
        `<circle cx="${x + 114}" cy="${y + 12}" r="6" fill="${k.tint}" stroke="#ffffff" stroke-width="1"/>`,
        `<text x="${x + 8}" y="${y + 15}" font-family="Nunito, sans-serif" font-size="10" font-weight="700" fill="${tod === 'night' ? '#ffffff' : '#1e1b2e'}">${tod}</text>`,
      );
    });
  });

  const skySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 240" width="680" height="240">
  <defs>${gradDefs.join('')}</defs>
  <rect x="0" y="0" width="680" height="240" rx="14" fill="${cream}" stroke="${woodDark}" stroke-width="2"/>
  <text x="16" y="24" font-family="Pixelify Sans, sans-serif" font-size="14" font-weight="700" fill="${ink}">Biome Day-Cycle Sky Ramps &amp; World Tints (circle = lighting tint)</text>
  ${biomeRows.join('\n  ')}
</svg>
`;

  return {
    designTokens,
    figmaVariables,
    componentSvgs: [
      { filename: 'ui/components/tw-panel.svg', svg: panelSvg },
      { filename: 'ui/components/tw-buttons-states.svg', svg: buttonsSvg },
      { filename: 'ui/components/tw-medallion.svg', svg: medallionSvg },
      { filename: 'ui/components/tw-heart-bar.svg', svg: heartSvg },
      { filename: 'ui/components/tw-sky-gradients.svg', svg: skySvg },
    ],
  };
}
