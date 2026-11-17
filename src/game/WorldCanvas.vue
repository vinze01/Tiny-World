<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Phaser from 'phaser';
import { WorldScene } from './WorldScene';
import { useGameStore } from '../stores/gameStore';

const store = useGameStore();
const host = ref<HTMLDivElement | null>(null);
let game: Phaser.Game | null = null;
let ro: ResizeObserver | null = null;

const onVisibilityChange = () => {
  if (!game) return;
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
}

onMounted(() => {
  if (!host.value) return;
  const rect = host.value.getBoundingClientRect();
  const scene = new WorldScene(store);
  game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent: host.value,
    width: Math.max(300, Math.floor(rect.width || 420)),
    height: Math.max(240, Math.floor(rect.height || 420)),
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    transparent: false,
    audio: { noAudio: true },
    scene: [scene],
  });

  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e || !game) return;
      const w = Math.max(260, Math.floor(e.contentRect.width));
      const h = Math.max(220, Math.floor(e.contentRect.height));
      game.scale.resize(w, h);
    });
    ro.observe(host.value);
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  ro?.disconnect();
  game?.destroy(true);
  game = null;
  // Drop closures into the destroyed scene so the outliving store can never
  // call into dead Phaser objects after the canvas is gone.
  store.worldHooks = {};
});
</script>

<template>
  <div
    ref="host"
    class="world-canvas"
    role="application"
    aria-label="TinyWorld miniature floating island. Use arrow keys or WASD to move the tile cursor, Enter or Space to interact, R to rotate items."
    tabindex="0"
  />
</template>

<style scoped>
.world-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
}
.world-canvas :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  image-rendering: pixelated;
}
</style>
