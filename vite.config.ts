import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';
import { referenceAudio } from './dev/referenceAudio.ts';
import { grooveAudition } from './dev/grooves.ts';

export default defineConfig({
  plugins: [svelte(), referenceAudio(), grooveAudition()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        slicer: resolve(import.meta.dirname, 'slicer.html'),
      },
    },
  },
});
