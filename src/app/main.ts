import { mount } from 'svelte';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import './theme.css';
import { sharePageId } from '../lib/roundware';

// /b/<id> is one BeatVox's share page; anything else is the studio.
// Each loads only its own code.
const target = document.getElementById('app')!;
const shareId = sharePageId(location.pathname);
if (shareId !== null) {
  import('../share/SharePage.svelte').then(({ default: SharePage }) => mount(SharePage, { target, props: { id: shareId } }));
} else {
  import('./App.svelte').then(({ default: App }) => mount(App, { target }));
}
