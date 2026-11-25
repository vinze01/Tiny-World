import { sound } from './assets/game-sound.js';
import { setupFeatureDemos } from './feature-demos.js';

// Frame indices and repeated poses follow ANIM_ORDER and ANIM_RATES in src/art/creatures.ts.
const interactFrames = [14, 15, 16];
const pipkinSequences = {
  idle: [0, 0, 1, 0, 0, 1, 0, 2],
  walk: [3, 4, 5, 6],
  sleep: [7, 8],
  happy: [9, 10, 11, 10, 9, 10, 11, 10],
  curious: [12, 13],
  interact: interactFrames,
  // As in the game, the grumpy pose uses the interact frames with an anger emote.
  grumpy: interactFrames,
  eat: [17, 18, 17, 18, 19, 18],
};
const activeReactions = new WeakMap();

const playPipkinReaction = (sprite, animation, fps, still) => {
  activeReactions.get(sprite)?.cancel();
  const frames = pipkinSequences[animation];
  const hold = animation === 'grumpy' ? 1400 : 650;
  const position = (frame) => `calc(-1 * var(--frame-size) * ${frame}) 0px`;
  if (still) {
    const pose = { backgroundPosition: position(frames[1]) };
    activeReactions.set(sprite, sprite.animate([pose, pose], hold));
    return;
  }
  const frameDuration = 1000 / fps;
  const duration = Math.max(hold, frames.length * frameDuration);
  const keyframes = frames.map((frame, index) => ({
    backgroundPosition: position(frame),
    offset: index * frameDuration / duration,
    easing: 'steps(1, end)',
  }));
  keyframes.push({ backgroundPosition: position(frames[frames.length - 1]), offset: 1 });
  activeReactions.set(sprite, sprite.animate(keyframes, duration));
};

// Match the pet window, grumpy duration and species tolerances in src/core/actions.ts.
const petWindow = 18_000;
const grumpyDuration = 28_000;
const petTolerance = { mossi: 5, bloop: 4, ember: 4, puffin: 5, sprig: 3 };

const setupPipkinActions = (card, name, feedback, getPlayback) => {
  const sprite = card.querySelector('.pipkin-sprite');
  const tolerance = petTolerance[card.dataset.pipkin];
  const grumpyMessage = `${name} is grumpy. Give them some space or a treat.`;
  let pets = [];
  let grumpyUntil = 0;
  let grumpyTimer;

  const clearGrumpy = () => {
    clearTimeout(grumpyTimer);
    grumpyUntil = 0;
    pets = [];
    sprite.classList.remove('is-grumpy');
  };

  const react = (animation, effect, message) => {
    const { fps, still } = getPlayback();
    sound.play(effect);
    feedback.hidden = false;
    feedback.textContent = message;
    playPipkinReaction(sprite, animation, fps, still);
  };

  card.querySelectorAll('[data-pipkin-action]').forEach((button) => {
    const action = button.dataset.pipkinAction;
    if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', `${button.textContent} ${name}`);
    button.addEventListener('click', () => {
      const now = performance.now();
      const isGrumpy = grumpyUntil > now;
      if (action === 'feed') {
        clearGrumpy();
        react('eat', 'feed', isGrumpy ? `${name} calmed down after a treat.` : `${name} munched on a treat.`);
        return;
      }
      pets = [...pets.filter((time) => now - time <= petWindow), now].slice(-(tolerance + 1));
      if (!isGrumpy && pets.length <= tolerance) {
        react('happy', 'pet', `${name} enjoyed the pet!`);
        return;
      }
      grumpyUntil = now + grumpyDuration;
      sprite.classList.add('is-grumpy');
      clearTimeout(grumpyTimer);
      grumpyTimer = setTimeout(() => {
        clearGrumpy();
        if (feedback.textContent === grumpyMessage) feedback.textContent = `${name} has calmed down.`;
      }, grumpyDuration);
      react('grumpy', 'error', grumpyMessage);
    });
  });
};

const setupStageFilters = () => {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.island-card');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((button) => {
        button.classList.toggle('active', button === btn);
        button.setAttribute('aria-pressed', String(button === btn));
      });
      sound.play('click');
      const { filter } = btn.dataset;
      cards.forEach((card) => {
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });
};

const setupSound = () => {
  const toggle = document.getElementById('showcase-sound');
  let enabled = false;

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    sound.configure({ sound: enabled, volume: 0.5, ambient: false });
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.querySelector('.sound-icon').textContent = enabled ? '🔊' : '🔇';
    toggle.querySelector('.sound-label').textContent = enabled ? 'Sound on' : 'Sound off';
    sound.play('click');
  });
  toggle.hidden = false;
};

const setupGarden = () => {
  const garden = document.querySelector('.garden-demo');
  const sprite = garden.querySelector('img');
  const status = document.getElementById('garden-status');
  const action = document.getElementById('garden-action');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const stages = [
    { image: 'daisy-seed.png', button: 'Plant daisy', sound: 'place', message: 'Daisy harvested. The patch is ready to plant again.' },
    { image: 'daisy-s1.png', button: 'Water daisy', sound: 'water', message: 'A daisy sprouted. Give it a drink.' },
    { image: 'daisy-s4.png', button: 'Harvest daisy', sound: 'harvest', message: 'The daisy is in bloom and ready to harvest.' },
  ];
  let stage = 0;
  let transition;

  action.addEventListener('click', () => {
    sound.play(stages[stage].sound);
    stage = (stage + 1) % stages.length;
    const next = stages[stage];
    sprite.src = `./assets/garden/${next.image}`;
    action.textContent = next.button;
    status.textContent = next.message;
    transition?.cancel();
    if (!reducedMotion.matches) {
      transition = sprite.animate(
        [{ translate: '0 6px', opacity: 0.45 }, { translate: '0 0', opacity: 1 }],
        { duration: 260, easing: 'ease-out' },
      );
    }
  });
  garden.hidden = false;
};

const setupPipkinGallery = () => {
  const roster = document.querySelector('.pipkin-roster');
  const controls = document.querySelector('.pipkin-controls');
  const pose = document.getElementById('pipkin-pose');
  const fps = document.getElementById('pipkin-fps');
  const readout = document.getElementById('pipkin-fps-value');
  const playback = document.getElementById('pipkin-playback');
  const actionTemplate = document.getElementById('pipkin-action-template');
  const feedback = document.querySelector('.pipkin-feedback');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let paused = reducedMotion.matches;
  let inView = false;
  let frameRequest;
  let lastTime;
  let frameIndex = 0;
  let frameElapsed = 0;

  const drawFrame = () => {
    roster.style.setProperty('--pipkin-frame', pipkinSequences[pose.value][frameIndex]);
  };

  const tick = (time) => {
    frameElapsed += time - (lastTime ?? time);
    lastTime = time;
    const frameDuration = 1000 / fps.valueAsNumber;
    const steps = Math.floor(frameElapsed / frameDuration);
    if (steps > 0) {
      frameElapsed %= frameDuration;
      frameIndex = (frameIndex + steps) % pipkinSequences[pose.value].length;
      drawFrame();
    }
    frameRequest = requestAnimationFrame(tick);
  };

  const updatePlayback = () => {
    cancelAnimationFrame(frameRequest);
    lastTime = undefined;
    playback.textContent = paused ? 'Play' : 'Pause';
    if (!paused && inView && !document.hidden) {
      frameRequest = requestAnimationFrame(tick);
    }
  };

  roster.querySelectorAll('.pipkin-card').forEach((card) => {
    const name = card.querySelector('h4').textContent;
    card.append(actionTemplate.content.cloneNode(true));
    setupPipkinActions(card, name, feedback, () => ({
      fps: fps.valueAsNumber,
      still: paused || reducedMotion.matches,
    }));
  });

  const updatePose = () => {
    roster.classList.toggle('preview-grumpy', pose.value === 'grumpy');
    frameIndex = 0;
    frameElapsed = 0;
    drawFrame();
  };
  pose.addEventListener('change', () => {
    sound.play('click');
    updatePose();
  });
  fps.addEventListener('input', () => {
    readout.value = `${fps.value} FPS`;
    frameElapsed = 0;
  });
  playback.addEventListener('click', () => {
    sound.play('click');
    paused = !paused;
    updatePlayback();
  });
  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      paused = true;
      updatePlayback();
    }
  });
  document.addEventListener('visibilitychange', updatePlayback);
  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    updatePlayback();
  }).observe(roster);

  updatePose();
  updatePlayback();
  controls.hidden = false;
};

const animateShowcaseCards = () => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      if (!reducedMotion.matches) {
        target.animate(
          [{ opacity: 0.35, translate: '0 14px' }, { opacity: 1, translate: '0 0' }],
          { duration: 420, easing: 'ease-out' },
        );
      }
    });
  });
  document.querySelectorAll('.terrain-card, .island-card, .feature-box, .surface-card')
    .forEach((card) => observer.observe(card));
};

const setupLightbox = () => {
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-img');
  const title = document.getElementById('lightbox-title');
  document.querySelectorAll('[data-lightbox]').forEach((button) => {
    const preview = button.querySelector('img');
    button.addEventListener('click', () => {
      image.src = preview.currentSrc || preview.src;
      image.alt = preview.alt;
      title.textContent = button.dataset.lightbox;
      sound.play('click');
      lightbox.showModal();
    });
  });
  lightbox.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', ({ target }) => {
    if (target === lightbox) lightbox.close();
  });
};

setupStageFilters();
setupSound();
setupGarden();
setupPipkinGallery();
setupFeatureDemos(setupPipkinActions);
setupLightbox();
animateShowcaseCards();
