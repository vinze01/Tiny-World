import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from '../ui/App.vue';
import '../ui/theme.css';
import type { SurfaceMode } from '../stores/gameStore';

export const mountSurface = (mode: SurfaceMode) => {
  const app = createApp(App, { mode });
  app.use(createPinia());
  app.mount('#app');
}
