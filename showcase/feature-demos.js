import { sound } from './assets/game-sound.js';

const asset = (name) => `./assets/feature-demos/${name}.png`;

export const setupFeatureDemos = (setupPipkinActions) => {
  const demos = {
    meadow: setupMeadow,
    plants: setupGrowth,
    pipkin: (card) => {
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      setupPipkinActions(card, 'Mossi', card.querySelector('.demo-status'), () => ({
        fps: 9,
        still: reducedMotion.matches,
      }));
    },
    move: setupGroupMove,
    shop: setupShop,
    private: setupLocalSave,
  };
  document.querySelectorAll('.feature-box[data-demo]').forEach((card) => {
    demos[card.dataset.demo](card);
    const front = card.querySelector('.feature-front');
    const back = card.querySelector('.feature-back');
    const open = card.querySelector('.feature-open');
    const close = card.querySelector('.feature-close');

    const flip = (showBack) => {
      sound.play('click');
      card.classList.toggle('is-flipped', showBack);
      open.setAttribute('aria-expanded', String(showBack));
      const outgoing = showBack ? front : back;
      const incoming = showBack ? back : front;
      incoming.inert = false;
      (showBack ? close : open).focus({ preventScroll: true });
      outgoing.inert = true;
    };

    open.addEventListener('click', () => flip(true));
    close.addEventListener('click', () => flip(false));
    back.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') flip(false);
    });
    open.hidden = false;
  });
};

const setupMeadow = (card) => {
  const brushes = [...card.querySelectorAll('[data-brush]')];
  const status = card.querySelector('.demo-status');
  const grid = card.querySelector('.meadow-tiles');
  const terrain = { grass: 'tile-grass-meadow', snow: 'snow_patch', sand: 'sand_patch' };
  let brush = 'grass';

  brushes.forEach((button) => button.addEventListener('click', () => {
    brush = button.dataset.brush;
    brushes.forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
    sound.play('click');
  }));
  for (let n = 1; n <= 6; n++) {
    const tile = document.createElement('button');
    const image = new Image();
    tile.type = 'button';
    image.className = 'pixel-img';
    image.alt = '';
    const paint = (kind) => {
      tile.setAttribute('aria-label', `Meadow tile ${n}, ${kind}`);
      image.src = asset(terrain[kind]);
    };
    tile.append(image);
    paint('grass');
    tile.addEventListener('click', () => {
      paint(brush);
      status.textContent = `Tile ${n} is now ${brush}.`;
      sound.play('place');
    });
    grid.append(tile);
  }
};

const setupGrowth = (card) => {
  const slider = card.querySelector('input');
  const image = card.querySelector('img');
  const status = card.querySelector('.demo-status');
  const stages = ['Seed', 'Sprout', 'Growing leaves', 'Bud', 'Full bloom'];
  const update = () => {
    const stage = slider.valueAsNumber;
    image.src = `./assets/garden/daisy-s${stage}.png`;
    status.textContent = stages[stage];
    slider.setAttribute('aria-valuetext', stages[stage]);
  };
  slider.addEventListener('input', update);
  slider.addEventListener('change', () => sound.play(slider.valueAsNumber === 4 ? 'harvest' : 'click'));
  update();
};

const setupGroupMove = (card) => {
  const grid = card.querySelector('.move-tiles');
  const status = card.querySelector('.demo-status');
  const arrows = [...card.querySelectorAll('[data-shift]')];
  const items = [
    { name: 'Path', image: 'path', position: 0, selected: false },
    { name: 'Lantern', image: 'lantern', position: 3, selected: false },
  ];
  const width = 3;
  const tiles = Array.from({ length: 6 }, () => {
    const tile = document.createElement('button');
    const image = new Image();
    tile.type = 'button';
    image.className = 'pixel-img';
    image.alt = '';
    tile.append(image);
    grid.append(tile);
    return { tile, image };
  });
  const canShift = (dx) => items.some((item) => item.selected) && items.every(({ position, selected }) => {
    const column = position % width + dx;
    return !selected || (column >= 0 && column < width);
  });

  const render = () => {
    tiles.forEach(({ tile, image }, position) => {
      const item = items.find((entry) => entry.position === position);
      tile.disabled = !item;
      tile.setAttribute('aria-label', `${item?.name ?? 'Empty'}, row ${Math.floor(position / width) + 1}, column ${position % width + 1}`);
      if (item) {
        tile.setAttribute('aria-pressed', String(item.selected));
        image.src = asset(item.image);
      } else {
        tile.removeAttribute('aria-pressed');
        image.removeAttribute('src');
      }
      image.hidden = !item;
    });
    arrows.forEach((button) => button.setAttribute('aria-disabled', String(!canShift(Number(button.dataset.shift)))));
  };

  tiles.forEach(({ tile }, position) => tile.addEventListener('click', () => {
    const item = items.find((entry) => entry.position === position);
    if (!item) return;
    item.selected = !item.selected;
    status.textContent = `${items.filter((entry) => entry.selected).length} of ${items.length} selected.`;
    sound.play('click');
    render();
  }));
  arrows.forEach((button) => button.addEventListener('click', () => {
    const dx = Number(button.dataset.shift);
    if (!canShift(dx)) return;
    const selected = items.filter((item) => item.selected);
    selected.forEach((item) => { item.position += dx; });
    status.textContent = selected.length === 2 ? 'Moved both items together.' : `Moved the ${selected[0].name.toLowerCase()}.`;
    sound.play('place');
    render();
  }));
  render();
};

const setupShop = (card) => {
  const themes = [...card.querySelectorAll('[data-theme]')];
  const list = card.querySelector('.shop-samples');
  const catalog = {
    winter: [['Snowman', 'snowman'], ['Gift Boxes', 'gift_boxes']],
    desert: [['Desert Tent', 'desert_tent'], ['Small Cactus', 'cactus_small']],
    lighting: [['Garden Lantern', 'lantern'], ['Campfire', 'campfire']],
  };
  const show = (theme) => {
    themes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === theme)));
    list.replaceChildren(...catalog[theme].map(([name, file]) => {
      const entry = document.createElement('li');
      const image = new Image();
      image.src = asset(file);
      image.alt = '';
      image.className = 'pixel-img';
      entry.append(image, name);
      return entry;
    }));
  };
  themes.forEach((button) => button.addEventListener('click', () => {
    sound.play('click');
    show(button.dataset.theme);
  }));
  show('winter');
};

const setupLocalSave = (card) => {
  const key = 'tiny-world-showcase-pipkin-name';
  const defaultName = 'Mossi';
  const form = card.querySelector('form');
  const input = form.elements.pipkinName;
  const preview = card.querySelector('.local-save-name');
  const status = card.querySelector('.demo-status');
  const sanitizeName = (name) => name.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, input.maxLength);
  const showName = (name) => {
    input.value = name;
    preview.textContent = name;
  };
  const updateSave = (name) => {
    try {
      if (name) localStorage.setItem(key, name);
      else localStorage.removeItem(key);
      showName(name || defaultName);
      status.textContent = name ? 'Pipkin name saved in this browser.' : 'Name reset to Mossi.';
      sound.play(name ? 'collect' : 'remove');
    } catch {
      status.textContent = 'Local storage is unavailable in this browser.';
    }
  };
  try {
    const saved = sanitizeName(localStorage.getItem(key) ?? '');
    if (saved) {
      showName(saved);
      status.textContent = 'Pipkin name restored from this browser.';
    }
  } catch {
    status.textContent = 'Local storage is unavailable in this browser.';
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = sanitizeName(input.value);
    if (name) updateSave(name);
    else {
      status.textContent = 'Enter a Pipkin name to save it.';
      input.focus();
    }
  });
  form.querySelector('[data-reset-save]').addEventListener('click', () => updateSave(''));
};
