import { mount } from 'svelte';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import './theme.css';
import { sharePageId, STUDIO_PATH } from '../lib/roundware';
import { rw } from '../lib/rw';

// Three pages, each loading only its own code: the map (home), the studio,
// and one BeatVox's share page (/b/<id>). Each starts a Roundware session,
// so its listens and events are counted.
const target = document.getElementById('app')!;
const path = location.pathname.replace(/\/+$/, '') || '/';
const shareId = sharePageId(location.pathname);
const revox = new URLSearchParams(location.search).get('revox');

if (shareId !== null) {
  rw.startVisit();
  import('../share/SharePage.svelte').then(({ default: SharePage }) => mount(SharePage, { target, props: { id: shareId } }));
} else if (path === STUDIO_PATH) {
  rw.startVisit();
  import('./App.svelte').then(({ default: App }) => mount(App, { target }));
} else if (revox) {
  // reVox links made before the studio moved to /studio
  location.replace(`${STUDIO_PATH}?revox=${encodeURIComponent(revox)}`);
} else {
  rw.startVisit();
  import('../map/MapPage.svelte').then(({ default: MapPage }) => mount(MapPage, { target }));
}
