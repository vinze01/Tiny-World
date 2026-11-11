import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import '../tools/figma-organizer-plugin/code.js';

const plugin = (globalThis as Record<string, any>).__twOrganizerExports;

const REAL_94_FRAMES = [
  ['7:2', 'Catalog \u00e2\u20ac\u201d All TinyWorld Assets', 2400, 2535],
  ['7:3', 'UI Vector - Button States', 560, 180],
  ['7:34', 'UI Vector - Sky Gradients', 680, 240],
  ['7:115', 'UI Vector - Medallion', 280, 140],
  ['7:130', 'UI Vector - Panel', 360, 200],
  ['7:141', 'UI Vector - Heart Bar', 220, 72],
  ['7:151', 'UI Component - Bottom Dock', 401, 49],
  ['7:152', 'Catalog - Creatures', 1920, 745],
  ['7:153', 'UI Component - Creatures Panel', 540, 608],
  ['7:154', 'UI Component - Onboarding Card', 350, 163],
  ['7:155', 'Catalog - Nature', 1920, 1131],
  ['7:156', 'UI Component - Top HUD', 1264, 75],
  ['7:157', 'UI Component - Settings Modal', 480, 608],
  ['7:158', 'Catalog - Plants', 1920, 1213],
  ['7:159', 'UI Component - Journal Panel', 560, 608],
  ['7:160', 'Catalog - Buildings', 1920, 829],
  ['7:161', 'Catalog - Decorations', 1920, 1551],
  ['7:162', 'UI Component - Shop Drawer', 560, 608],
  ['7:163', 'Catalog - Islands Stages 1-10', 1920, 1357],
  ['8:2', 'UI Icon Vector - Food Treat', 80, 80],
  ['8:63', 'UI Icon Vector - Pond', 20, 20],
  ['8:71', 'UI Icon - Extension 128', 128, 128],
  ['8:72', 'UI Icon Vector - Nature Token', 64, 64],
  ['8:147', 'UI Icon Vector - Extension 16', 64, 64],
  ['8:169', 'Screen - Side Panel', 380, 700],
  ['8:170', 'Screen - Full World Night Glow', 1280, 800],
  ['8:171', 'Screen - Creatures Panel', 1280, 800],
  ['8:172', 'UI Icon - Extension 48', 48, 48],
  ['8:173', 'Screen - Full World Day', 1280, 800],
  ['8:174', 'Screen - Shop Furniture', 1280, 800],
  ['8:175', 'Screen - Onboarding Card', 1280, 800],
  ['8:176', 'Screen - Extension Popup', 420, 560],
  ['8:177', 'Screen - Achievements List', 1280, 800],
  ['8:178', 'Screen - Shop Buildings', 1280, 800],
  ['8:179', 'Screen - Expand Island', 1280, 800],
  ['8:180', 'Screen - Journal Discoveries', 1280, 800],
  ['8:181', 'Screen - Garden Quickbar', 1280, 800],
  ['8:182', 'Screen - Shop Seeds', 1280, 800],
  ['8:183', 'Screen - Placement Mode', 1280, 800],
  ['8:184', 'Screen - Time Preview Popover', 1280, 800],
  ['8:185', 'Screen - Welcome Back Toast', 1280, 800],
  ['8:186', 'Screen - Creature Inspector', 1280, 800],
  ['8:187', 'Screen - Object Inspector', 1280, 800],
  ['8:188', 'Screen - Inventory Bag', 1280, 800],
  ['8:189', 'Screen - Settings Modal', 1280, 800],
  ['8:190', 'Pipkin Vector - Flurry', 112, 112],
  ['8:306', 'Pipkin Vector - Bloom', 112, 112],
  ['8:441', 'Pipkin Vector - Ember', 112, 112],
  ['8:596', 'Pipkin Vector - Pebble', 112, 112],
  ['8:705', 'Pipkin Vector - Sprig', 112, 112],
  ['8:840', 'Pipkin Vector - Luna', 112, 112],
  ['8:981', 'Pipkin Vector - Cinder', 112, 112],
  ['8:1106', 'Pipkin Vector - Bloop', 112, 112],
  ['8:1235', 'Pipkin Vector - Puffin', 112, 112],
  ['8:1444', 'Pipkin Vector - Mossi', 112, 112],
  ['8:1609', 'Pipkin Vector - Wisp', 112, 112],
  ['8:1717', 'Pipkin Poses - Nimbus', 512, 256],
  ['8:1718', 'Pipkin Vector - Glimmer', 112, 112],
  ['8:1866', 'Pipkin Vector - Nimbus', 112, 112],
  ['8:2030', 'Pipkin Vector - Frosty', 112, 112],
  ['8:2178', 'Pipkin Poses - Sprig', 512, 256],
  ['8:2179', 'Pipkin Poses - Flurry', 512, 256],
  ['8:2180', 'Pipkin Poses - Cinder', 512, 256],
  ['8:2181', 'Pipkin Poses - Bloop', 512, 256],
  ['8:2182', 'Pipkin Poses - Astra', 512, 256],
  ['8:2183', 'Pipkin Poses - Puffin', 512, 256],
  ['8:2184', 'Pipkin Poses - Luna', 512, 256],
  ['8:2185', 'Pipkin Poses - Glimmer', 512, 256],
  ['8:2186', 'Pipkin Poses - Mossi', 512, 256],
  ['8:2187', 'Pipkin Poses - Pebble', 512, 256],
  ['8:2188', 'Pipkin Poses - Frosty', 512, 256],
  ['8:2189', 'Pipkin Poses - Ember', 512, 256],
  ['8:2190', 'Pipkin Poses - Bloom', 512, 256],
  ['8:2191', 'Pipkin Poses - Wisp', 512, 256],
  ['8:2192', 'Pipkin Vector - Astra', 112, 112],
  ['8:2325', 'Island Stage 02 - Mossy Meadow (Day)', 1200, 840],
  ['8:2326', 'Island Stage 09 - Frostfall Spire (Day)', 1200, 840],
  ['8:2327', 'Island Stage 06 - Sakura Terrace (Day)', 1200, 840],
  ['8:2328', 'Island Stage 05 - Starry Ridge (Day)', 1200, 840],
  ['8:2329', 'Island Stage 03 - Whispering Woods (Day)', 1200, 840],
  ['8:2330', 'Island Stage 04 - Sunlit Harbor (Day)', 1200, 840],
  ['8:2331', 'Weather - Rain Shower', 1200, 840],
  ['8:2332', 'Island Stage 08 - Mistwood Hollow (Day)', 1200, 840],
  ['8:2333', 'Island Stage 01 - Sprout Glade (Day)', 1200, 840],
  ['8:2334', 'Island Stage 07 - Emberglow Grove (Day)', 1200, 840],
  ['8:2335', 'Island Stage 10 - Morning', 1200, 840],
  ['8:2336', 'Island Stage 10 - Night', 1200, 840],
  ['8:2337', 'Island Stage 10 - Sunset', 1200, 840],
  ['8:2338', 'Weather - Frostfall Snow', 1200, 840],
  ['8:2339', 'Weather - Mistwood Fog', 1200, 840],
  ['8:2340', 'Weather - Emberglow Wind', 1200, 840],
  ['8:2341', 'Island Stage 10 - Starlight Sanctuary (Day)', 1200, 840],
  ['8:2342', 'Weather - Starlight Sparkles', 1200, 840],
  ['8:2343', 'Weather - Everdream Sparkles', 1200, 840],
] as const;

function createMockFigma(frames: ReadonlyArray<readonly [string, string, number, number]>) {
  let seq = 1000;

  class MockNode {
    id: string;
    type: string;
    name: string;
    parent: any = null;
    children: any[] = [];
    pluginData = new Map<string, string>();
    x = 0;
    y = 0;
    width = 0;
    height = 0;

    constructor(id: string, type: string, name: string, width = 0, height = 0) {
      this.id = id;
      this.type = type;
      this.name = name;
      this.width = width;
      this.height = height;
    }

    appendChild(child: any) {
      if (child.parent && child.parent !== this) {
        child.parent.children = child.parent.children.filter((c: any) => c !== child);
      }
      if (!this.children.includes(child)) {
        this.children.push(child);
      }
      child.parent = this;
    }

    insertChild(index: number, child: any) {
      if (child.parent) {
        child.parent.children = child.parent.children.filter((c: any) => c !== child);
      }
      this.children.splice(index, 0, child);
      child.parent = this;
    }

    remove() {
      if (this.parent) {
        this.parent.children = this.parent.children.filter((c: any) => c !== this);
        this.parent = null;
      }
    }

    setPluginData(k: string, v: string) {
      this.pluginData.set(k, v);
    }

    getPluginData(k: string) {
      return this.pluginData.get(k) ?? '';
    }

    resizeWithoutConstraints(w: number, h: number) {
      this.width = w;
      this.height = h;
    }

    async loadAsync() {
      return undefined;
    }
  }

  const root = new MockNode('0:0', 'DOCUMENT', 'Untitled');
  const page1 = new MockNode('0:1', 'PAGE', 'Page 1');
  root.appendChild(page1);

  for (const [id, name, w, h] of frames) {
    const f = new MockNode(id, 'FRAME', name, w, h);
    // Simulate nested child frame inside UI Vector - Button States (must stay nested!)
    if (id === '7:3') {
      f.appendChild(new MockNode('7:6', 'FRAME', 'btn-secondary', 116, 39));
    }
    page1.appendChild(f);
  }

  let currentPage = page1;
  const mockFigma: any = {
    root,
    get currentPage() {
      return currentPage;
    },
    createPage() {
      const p = new MockNode(`page:${++seq}`, 'PAGE', `Page ${root.children.length + 1}`);
      root.appendChild(p);
      return p;
    },
    createSection() {
      return new MockNode(`sec:${++seq}`, 'SECTION', 'Section');
    },
    async setCurrentPageAsync(page: any) {
      currentPage = page;
    },
    viewport: {
      scrolledIntoView: null as any,
      scrollAndZoomIntoView(nodes: any) {
        this.scrolledIntoView = nodes;
      },
    },
  };

  return { mockFigma, root, page1 };
}

describe('TinyWorld Figma Organizer Local Plugin', () => {
  it('validates manifest.json and HTML contract for dynamic-page Figma execution', () => {
    const manifest = JSON.parse(readFileSync(resolve('tools/figma-organizer-plugin/manifest.json'), 'utf8'));
    const html = readFileSync(resolve('tools/figma-organizer-plugin/ui.html'), 'utf8');
    expect(manifest.main).toBe('code.js');
    expect(manifest.ui).toBe('ui.html');
    expect(manifest.documentAccess).toBe('dynamic-page');
    expect(manifest.editorType).toEqual(['figma']);
    expect(html).toContain("type: 'scan'");
    expect(html).toContain("type: 'organize'");
  });

  it('classifies and organizes all 94 real uploaded Page 1 frames into 7 pages without deletion, duplication, or dimension drift', async () => {
    expect(REAL_94_FRAMES).toHaveLength(94);
    const { mockFigma, root } = createMockFigma(REAL_94_FRAMES);

    const scan = await plugin.scanWorkspace(mockFigma);
    expect(scan.totalFrames).toBe(94);
    expect(scan.uncategorized).toEqual([]);

    const result = await plugin.organizeDocument(mockFigma);
    expect(result.validationPassed).toBe(true);
    expect(result.beforeTotalFrames).toBe(94);
    expect(result.afterTotalFrames).toBe(94);
    expect(result.movedCount).toBe(94);
    expect(result.uncategorized).toEqual([]);
    expect(result.missingIds).toEqual([]);
    expect(result.duplicateIds).toEqual([]);
    expect(result.dimensionChanges).toEqual([]);
    expect(result.misplaced).toEqual([]);

    expect(result.pagesCreatedOrVerified).toEqual([
      '01 \u2014 Design System',
      '02 \u2014 World & Islands',
      '03 \u2014 Creatures (Pipkins)',
      '04 \u2014 Plants & Nature',
      '05 \u2014 Buildings & Decorations',
      '06 \u2014 UI Components & Screens',
      '07 \u2014 Concepts & Future Designs',
    ]);

    expect(result.countsByPage).toEqual({
      '01 \u2014 Design System': 6,
      '02 \u2014 World & Islands': 20,
      '03 \u2014 Creatures (Pipkins)': 31,
      '04 \u2014 Plants & Nature': 2,
      '05 \u2014 Buildings & Decorations': 2,
      '06 \u2014 UI Components & Screens': 33,
      '07 \u2014 Concepts & Future Designs': 0,
    });

    // Verify nested frame 7:6 remained nested inside 7:3 UI Vector - Button States
    const page01 = root.children[0];
    const controlsSec = page01.children.find((s: any) => s.name === 'UI Vector Controls & Panels');
    const btnStates = controlsSec.children.find((f: any) => f.id === '7:3');
    expect(btnStates.children.map((c: any) => c.id)).toEqual(['7:6']);

    // Verify UTF-8 mojibake fix on 7:2 Catalog frame
    const indexSec = page01.children.find((s: any) => s.name === 'Master Asset Index');
    expect(indexSec.children[0].name).toBe('Catalog \u2014 All TinyWorld Assets');

    // Verify Page 03 groups Pipkins by species with Vector left of Poses and vertically centered
    const page03 = root.children[2];
    const mossiSec = page03.children.find((s: any) => s.name === 'Pipkin \u2014 Mossi');
    expect(mossiSec.children).toHaveLength(2);
    const [vec, poses] = mossiSec.children;
    expect(vec.name).toBe('Pipkin Vector - Mossi');
    expect(poses.name).toBe('Pipkin Poses - Mossi');
    expect(vec.x).toBeLessThan(poses.x);
    expect(vec.y).toBe(64 + (256 - 112) / 2);
    expect(poses.y).toBe(64);

    // Verify Stage 01..10 ordering on Page 02
    const page02 = root.children[1];
    const stagesSec = page02.children.find((s: any) => s.name.includes('Stages 01'));
    expect(stagesSec.children.map((c: any) => c.name.slice(0, 15))).toEqual([
      'Island Stage 01',
      'Island Stage 02',
      'Island Stage 03',
      'Island Stage 04',
      'Island Stage 05',
      'Island Stage 06',
      'Island Stage 07',
      'Island Stage 08',
      'Island Stage 09',
      'Island Stage 10',
    ]);

    // Verify re-running organizeDocument is completely idempotent
    const secondRun = await plugin.organizeDocument(mockFigma);
    expect(secondRun.validationPassed).toBe(true);
    expect(secondRun.afterTotalFrames).toBe(94);
    expect(secondRun.countsByPage).toEqual(result.countsByPage);
  });

  it('normalizes both Latin-1 C1 and Windows-1252 mojibake on Catalog - All TinyWorld Assets', () => {
    expect(plugin.normalizeFrameName('Catalog \u00e2\u0080\u0094 All TinyWorld Assets')).toBe(
      'Catalog \u2014 All TinyWorld Assets',
    );
    expect(plugin.normalizeFrameName('Catalog \u00e2\u20ac\u201d All TinyWorld Assets')).toBe(
      'Catalog \u2014 All TinyWorld Assets',
    );
    expect(plugin.classifyFrame('Catalog \u00e2\u0080\u0094 All TinyWorld Assets')).toMatchObject({
      pageKey: '01',
      section: 'Master Asset Index',
    });
  });

  it('flags unknown frames as uncategorized without deleting or losing them', async () => {
    const customFrames: ReadonlyArray<readonly [string, string, number, number]> = [
      ...REAL_94_FRAMES,
      ['99:1', 'Mystery Concept Doodle', 400, 300],
    ];
    const { mockFigma, root } = createMockFigma(customFrames);
    const result = await plugin.organizeDocument(mockFigma);

    expect(result.beforeTotalFrames).toBe(95);
    expect(result.afterTotalFrames).toBe(95);
    expect(result.movedCount).toBe(94);
    expect(result.validationPassed).toBe(false);
    expect(result.uncategorized).toHaveLength(1);
    expect(result.uncategorized[0].name).toBe('Mystery Concept Doodle');
    // Still safely present on first page and untouched!
    expect(root.children[0].children.some((n: any) => n.id === '99:1')).toBe(true);
  });
});
