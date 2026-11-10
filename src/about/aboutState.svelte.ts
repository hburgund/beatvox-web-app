// The About overlay's state, shared by every page, and its place in the URL.
//
// It opens over whatever page you're on (the map, the studio, a share page),
// so a beat in progress or Wander keeps going underneath. Its addresses:
// - /about, or /about#terms: the map with About open (a link to share);
// - #about or #about-terms on any page: About opened from a button there.
// Opening from a button adds a history entry, so Back closes it.

export const ABOUT_PATH = '/about';
export const SECTIONS = ['how', 'since', 'own', 'faq', 'privacy', 'terms', 'credits'] as const;
export type Section = (typeof SECTIONS)[number];

const asSection = (s: string): Section | null => ((SECTIONS as readonly string[]).includes(s) ? (s as Section) : null);
const onAboutPath = () => location.pathname.replace(/\/+$/, '') === ABOUT_PATH;

/** What the URL says: open or not, and which section. */
function fromUrl(): { open: boolean; section: Section | null } {
  const h = decodeURIComponent(location.hash.slice(1));
  if (onAboutPath()) return { open: true, section: asSection(h.replace(/^about-?/, '')) };
  if (h === 'about') return { open: true, section: null };
  if (h.startsWith('about-')) return { open: true, section: asSection(h.slice(6)) };
  return { open: false, section: null };
}

class About {
  open = $state(false);
  /** the section to show and scroll to, if any */
  section = $state<Section | null>(null);
  /** a history entry was added when it opened, so closing goes back */
  private pushed = false;

  constructor() {
    this.sync();
    addEventListener('popstate', () => this.sync());
    addEventListener('hashchange', () => this.sync());
  }

  /** Follow the URL (on load, Back and Forward). */
  private sync() {
    const u = fromUrl();
    if (!u.open) this.pushed = false;
    this.open = u.open;
    this.section = u.section;
  }

  show(section: Section | null = null) {
    const hash = section ? `#about-${section}` : '#about';
    if (this.open) {
      if (!onAboutPath()) history.replaceState(history.state, '', hash);
    } else {
      history.pushState(history.state, '', location.pathname + location.search + hash);
      this.pushed = true;
    }
    this.open = true;
    this.section = section;
  }

  hide() {
    if (!this.open) return;
    this.open = false;
    this.section = null;
    if (this.pushed) {
      this.pushed = false;
      history.back();
    } else if (onAboutPath()) {
      // opened straight from /about: the page underneath is the map
      history.replaceState(history.state, '', '/' + location.search);
    } else {
      history.replaceState(history.state, '', location.pathname + location.search);
    }
  }
}

export const about = new About();
