const state = {
  manifest: null,
  tokens: null,
  view: 'assets',
  category: 'all',
  module: 'all',
  stage: 'all',
  animatedOnly: false,
  search: '',
  scale: 4,
  bg: 'checker',
  filtered: [],
  scrubTimer: null,
  scrubFrame: 0,
  scrubPlaying: true,
};

const els = {
  summary: document.getElementById('summary-line'),
  figmaLink: document.getElementById('figma-link'),
  downloadZip: document.getElementById('download-zip-btn'),
  viewTabs: document.querySelectorAll('.tab-btn'),
  assetsView: document.getElementById('assets-view'),
  tokensView: document.getElementById('tokens-view'),
  catalogsView: document.getElementById('catalogs-view'),
  search: document.getElementById('search-input'),
  moduleFilter: document.getElementById('module-filter'),
  stageFilter: document.getElementById('stage-filter'),
  animatedOnly: document.getElementById('animated-only'),
  bgMode: document.getElementById('bg-mode'),
  scaleBtns: document.querySelectorAll('.seg-btn'),
  categoryPills: document.getElementById('category-pills'),
  grid: document.getElementById('assets-grid'),
  modal: document.getElementById('inspector-modal'),
  inspClose: document.getElementById('insp-close'),
  inspTitle: document.getElementById('insp-title'),
  inspSub: document.getElementById('insp-subtitle'),
  inspStage: document.getElementById('insp-stage'),
  inspImg: document.getElementById('insp-img'),
  inspCanvas: document.getElementById('insp-canvas'),
  scrubberControls: document.getElementById('scrubber-controls'),
  scrubPlay: document.getElementById('scrub-play'),
  scrubRange: document.getElementById('scrub-range'),
  scrubLabel: document.getElementById('scrub-frame-label'),
  scrubFps: document.getElementById('scrub-fps'),
  inspMeta: document.getElementById('insp-meta'),
  inspFiles: document.getElementById('insp-files'),
};

function assetUrl(relPath) {
  return `/assets/${relPath.replace(/^\/+/, '')}`;
}

function previewFileFor(rec) {
  if (!rec.files || rec.files.length === 0) return null;
  const gif = rec.files.find((f) => f.format === 'gif');
  if (rec.kind === 'animation' && gif) return gif;
  const scaled = rec.files.find((f) => f.format === 'png' && f.label === `@${state.scale}x`);
  if (scaled) return scaled;
  return rec.files.find((f) => f.format === 'png') || rec.files[0];
}

function applyFilters() {
  if (!state.manifest) return;
  const q = state.search.trim().toLowerCase();
  state.filtered = state.manifest.assets.filter((r) => {
    if (r.status === 'skipped' || r.status === 'pending') return false;
    if (state.category !== 'all' && r.category !== state.category) return false;
    if (state.module !== 'all' && r.sourceModule !== state.module) return false;
    if (state.stage !== 'all' && String(r.stageMin || '') !== state.stage) return false;
    if (state.animatedOnly && !r.animation) return false;
    if (q) {
      const hay = [r.id, r.name, r.category, r.subcategory || '', r.sourceModule, ...(r.tags || [])]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  renderGrid();
}

function renderCategories() {
  const counts = { all: 0 };
  for (const r of state.manifest.assets) {
    if (r.status === 'skipped') continue;
    counts.all++;
    counts[r.category] = (counts[r.category] || 0) + 1;
  }
  const order = ['all', 'creatures', 'buildings', 'decorations', 'nature', 'plants', 'islands', 'effects', 'ui', 'catalogs'];
  els.categoryPills.innerHTML = '';
  for (const cat of order) {
    if (!counts[cat]) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `pill-btn${state.category === cat ? ' active' : ''}`;
    btn.textContent = `${cat === 'all' ? 'All Assets' : cat} (${counts[cat]})`;
    btn.addEventListener('click', () => {
      state.category = cat;
      renderCategories();
      applyFilters();
    });
    els.categoryPills.appendChild(btn);
  }
}

function renderGrid() {
  els.grid.innerHTML = '';
  if (state.filtered.length === 0) {
    els.grid.innerHTML = '<p>No assets match the current filters.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const rec of state.filtered) {
    const pf = previewFileFor(rec);
    const card = document.createElement('div');
    card.className = 'asset-card';

    const wrap = document.createElement('div');
    wrap.className = `thumb-wrap bg-${state.bg}`;
    if (pf && pf.format !== 'json') {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = assetUrl(pf.path);
      img.alt = rec.name;
      if (rec.nativeWidth && rec.nativeWidth <= 128 && pf.format !== 'svg') {
        img.style.width = `${Math.min(120, rec.nativeWidth * Math.min(state.scale, 4))}px`;
      }
      wrap.appendChild(img);
    } else {
      wrap.textContent = pf ? pf.format.toUpperCase() : 'TOKEN';
    }

    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = rec.name;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `<span>${rec.nativeWidth || '?'}×${rec.nativeHeight || '?'}px</span><span>${rec.category}</span>`;

    const badges = document.createElement('div');
    badges.className = 'card-badges';
    if (rec.stageMin) badges.innerHTML += `<span class="mini-tag">Stage ${rec.stageMin}</span>`;
    if (rec.animation) badges.innerHTML += `<span class="mini-tag">${rec.animation.frames}f Anim</span>`;
    if (rec.rotation === 1) badges.innerHTML += `<span class="mini-tag">Rot 1</span>`;

    card.append(wrap, title, meta, badges);
    card.addEventListener('click', () => openInspector(rec));
    frag.appendChild(card);
  }
  els.grid.appendChild(frag);
}

function stopScrubber() {
  if (state.scrubTimer) {
    clearInterval(state.scrubTimer);
    state.scrubTimer = null;
  }
}

function openInspector(rec) {
  stopScrubber();
  els.inspTitle.textContent = rec.name;
  els.inspSub.textContent = `${rec.id} · ${rec.sourceModule}`;
  els.inspStage.className = `insp-stage bg-${state.bg}`;

  const sheetRec =
    rec.kind === 'spritesheet'
      ? rec
      : rec.kind === 'sprite' && rec.category === 'creatures'
        ? state.manifest.assets.find((a) => a.id === `creature-sheet:${rec.catalogId}`)
        : null;

  if (sheetRec && sheetRec.files.find((f) => f.label === 'native')) {
    const sheetFile = sheetRec.files.find((f) => f.label === 'native');
    const frameW = 28;
    const frameH = 28;
    const img = new Image();
    img.onload = () => {
      const frameCount = Math.max(1, Math.floor(img.width / frameW));
      els.inspImg.classList.add('hidden');
      els.inspCanvas.classList.remove('hidden');
      els.scrubberControls.classList.remove('hidden');
      els.inspCanvas.width = frameW * 6;
      els.inspCanvas.height = frameH * 6;
      const ctx = els.inspCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      els.scrubRange.max = String(frameCount - 1);
      state.scrubFrame = 0;
      state.scrubPlaying = true;

      const drawFrame = () => {
        ctx.clearRect(0, 0, els.inspCanvas.width, els.inspCanvas.height);
        ctx.drawImage(
          img,
          state.scrubFrame * frameW,
          0,
          frameW,
          frameH,
          0,
          0,
          els.inspCanvas.width,
          els.inspCanvas.height,
        );
        els.scrubRange.value = String(state.scrubFrame);
        els.scrubLabel.textContent = `Frame ${state.scrubFrame + 1} / ${frameCount}`;
      };
      drawFrame();

      const restartTimer = () => {
        stopScrubber();
        if (!state.scrubPlaying) return;
        const fps = Math.max(1, Math.min(24, Number(els.scrubFps.value) || 6));
        state.scrubTimer = setInterval(() => {
          state.scrubFrame = (state.scrubFrame + 1) % frameCount;
          drawFrame();
        }, Math.round(1000 / fps));
      };
      restartTimer();
      els.scrubRange.oninput = () => {
        state.scrubPlaying = false;
        stopScrubber();
        state.scrubFrame = Number(els.scrubRange.value);
        drawFrame();
      };
      els.scrubPlay.onclick = () => {
        state.scrubPlaying = !state.scrubPlaying;
        restartTimer();
      };
      els.scrubFps.onchange = restartTimer;
    };
    img.src = assetUrl(sheetFile.path);
  } else {
    els.inspCanvas.classList.add('hidden');
    els.scrubberControls.classList.add('hidden');
    els.inspImg.classList.remove('hidden');
    const pf = previewFileFor(rec);
    els.inspImg.src = pf && pf.format !== 'json' ? assetUrl(pf.path) : '';
  }

  const rows = [
    ['Category', `${rec.category}${rec.subcategory ? ` / ${rec.subcategory}` : ''}`],
    ['Dimensions', `${rec.nativeWidth} × ${rec.nativeHeight} px`],
    ['Anchor', rec.anchorX !== undefined ? `(${rec.anchorX}, ${rec.anchorY})` : 'Center'],
    ['Source Module', rec.sourceModule],
    ['Catalog ID', rec.catalogId || '—'],
    ['Stage Unlock', rec.stageMin ? `Stage ${rec.stageMin}` : 'All Stages'],
  ];
  if (rec.animation) {
    rows.push(['Animation', `${rec.animation.frames} frames @ ${rec.animation.rate} fps`]);
  }
  els.inspMeta.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  els.inspFiles.innerHTML = '';
  for (const f of rec.files) {
    const row = document.createElement('div');
    row.className = 'variant-row';
    const dim = f.width ? ` (${f.width}×${f.height})` : '';
    row.innerHTML = `<span><strong>${f.format.toUpperCase()}</strong> · ${f.label}${dim}</span>`;
    const a = document.createElement('a');
    a.className = 'btn btn-secondary btn-sm';
    a.href = assetUrl(f.path);
    a.download = f.path.split('/').pop();
    a.textContent = 'Download';
    row.appendChild(a);
    els.inspFiles.appendChild(row);
  }

  els.modal.classList.remove('hidden');
}

function renderTokensView() {
  if (!state.tokens) return;
  const t = state.tokens;
  const sections = [];

  const renderSwatches = (title, items) => `
    <div class="tokens-section">
      <h3>${title}</h3>
      <div class="swatch-grid">
        ${items
          .map(
            ([name, hex, note]) => `
          <div class="swatch-card">
            <div class="swatch-color" style="background:${hex}"></div>
            <div class="swatch-info">
              <div class="swatch-name">${name}</div>
              <div class="swatch-val">${hex}${note ? ` · ${note}` : ''}</div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>`;

  const uiSwatches = Object.entries(t.color.ui || {}).map(([k, v]) => [k, v.$value, v.cssVar || '']);
  const artSwatches = Object.entries(t.color.artCore || {}).map(([k, v]) => [k, v.$value, 'artCore']);
  const creatureSwatches = Object.entries(t.color.creatures || {}).map(([id, c]) => [c.name, c.body, `${c.species}`]);
  sections.push(renderSwatches('UI Storybook Palette', uiSwatches));
  sections.push(renderSwatches('Core Pixel Art & Highlight Tokens', artSwatches));
  sections.push(renderSwatches('Pipkin Species Base Colors', creatureSwatches));

  els.tokensView.innerHTML = sections.join('');
}

function renderCatalogsView() {
  const boards = state.manifest.assets.filter((r) => r.category === 'catalogs');
  if (boards.length === 0) {
    els.catalogsView.innerHTML = '<p>No catalog boards exported yet. Run <code>npm run export:figma</code> without --skip-browser.</p>';
    return;
  }
  els.catalogsView.innerHTML = boards
    .map(
      (b) => `
    <div class="catalog-board-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h3 style="margin:0">${b.name} (${b.nativeWidth}×${b.nativeHeight}px)</h3>
        <a class="btn btn-secondary btn-sm" href="${assetUrl(b.primaryFile)}" download="${b.primaryFile.split('/').pop()}">Download PNG</a>
      </div>
      <img src="${assetUrl(b.primaryFile)}" alt="${b.name}" />
    </div>`,
    )
    .join('');
}

// Pure-JS uncompressed STORE ZIP builder
function crc32Bytes(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  const enc = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32Bytes(data);
    const lh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lh.set(nameBytes, 30);

    const ch = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);

    localParts.push(lh, data);
    centralParts.push(ch);
    offset += lh.length + data.length;
  }

  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

async function downloadFilteredBundle() {
  els.downloadZip.disabled = true;
  els.downloadZip.textContent = 'Bundling…';
  try {
    const targetFiles = new Set(['manifest.json', 'design-tokens.json']);
    for (const rec of state.filtered.slice(0, 400)) {
      if (rec.primaryFile) targetFiles.add(rec.primaryFile);
      const scaled = rec.files.find((f) => f.scale === 4 && f.format === 'png');
      if (scaled) targetFiles.add(scaled.path);
    }
    const entries = [];
    for (const rel of targetFiles) {
      const resp = await fetch(assetUrl(rel));
      if (!resp.ok) continue;
      const buf = new Uint8Array(await resp.arrayBuffer());
      entries.push({ name: `tinyworld-figma-assets/${rel}`, data: buf });
    }
    const blob = buildZip(entries);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tinyworld-figma-${state.category}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } finally {
    els.downloadZip.disabled = false;
    els.downloadZip.textContent = 'Download Filtered Bundle (.zip)';
  }
}

async function boot() {
  const [mResp, tResp] = await Promise.all([
    fetch('/assets/manifest.json'),
    fetch('/assets/design-tokens.json'),
  ]);
  if (!mResp.ok) {
    els.summary.textContent = 'manifest.json not found — run "npm run export:figma" first.';
    return;
  }
  state.manifest = await mResp.json();
  if (tResp.ok) state.tokens = await tResp.json();

  els.figmaLink.href = state.manifest.figmaTargetUrl;
  els.summary.textContent = `${state.manifest.summary.totalAssets} assets · ${state.manifest.summary.totalFiles} files · Generated ${new Date(state.manifest.generatedAt).toLocaleString()}`;

  const mods = Array.from(new Set(state.manifest.assets.map((a) => a.sourceModule))).sort();
  for (const mod of mods) {
    const opt = document.createElement('option');
    opt.value = mod;
    opt.textContent = mod;
    els.moduleFilter.appendChild(opt);
  }

  renderCategories();
  applyFilters();
  renderTokensView();
  renderCatalogsView();
}

els.search.addEventListener('input', () => {
  state.search = els.search.value;
  applyFilters();
});
els.moduleFilter.addEventListener('change', () => {
  state.module = els.moduleFilter.value;
  applyFilters();
});
els.stageFilter.addEventListener('change', () => {
  state.stage = els.stageFilter.value;
  applyFilters();
});
els.animatedOnly.addEventListener('change', () => {
  state.animatedOnly = els.animatedOnly.checked;
  applyFilters();
});
els.bgMode.addEventListener('change', () => {
  state.bg = els.bgMode.value;
  renderGrid();
});
els.scaleBtns.forEach((btn) =>
  btn.addEventListener('click', () => {
    els.scaleBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.scale = Number(btn.dataset.scale);
    renderGrid();
  }),
);
els.viewTabs.forEach((tab) =>
  tab.addEventListener('click', () => {
    els.viewTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.view = tab.dataset.view;
    els.assetsView.classList.toggle('hidden', state.view !== 'assets');
    els.tokensView.classList.toggle('hidden', state.view !== 'tokens');
    els.catalogsView.classList.toggle('hidden', state.view !== 'catalogs');
  }),
);

els.inspClose.addEventListener('click', () => {
  stopScrubber();
  els.modal.classList.add('hidden');
});
els.modal.querySelector('.modal-backdrop').addEventListener('click', () => {
  stopScrubber();
  els.modal.classList.add('hidden');
});
els.downloadZip.addEventListener('click', downloadFilteredBundle);

boot();
