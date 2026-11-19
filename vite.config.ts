import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { referenceAudio } from './dev/referenceAudio.ts';
import { grooveAudition } from './dev/grooves.ts';

export default defineConfig({
  plugins: [svelte(), referenceAudio(), grooveAudition()],
  // the same for workers (MapLibre's, the MP3 encoder's)
  worker: { format: 'es' },
  build: {
    // Vite's default (Safari 16.4 and up) leaves in syntax older iPhones
    // can't read: MapLibre 6's class static blocks broke the map on iOS 15
    // and 16.0-16.3 ("Unexpected token '{'"). Rewritten for Safari 15.
    target: ['es2022', 'chrome111', 'edge111', 'firefox114', 'safari15'],
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        slicer: resolve(import.meta.dirname, 'slicer.html'),
      },
    },
  },
});
