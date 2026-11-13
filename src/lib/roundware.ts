// Roundware v3: sending a BeatVox to the BeatVox project.
//
// A new BeatVox is four assets, uploaded in this order:
//   1. the raw voice (audio, WAV)          tag beatvox-source
//   2. the mix, a seamless loop (MP3)      tag beatvox-mix,        parent = 1
//   3. the instrument (JSON)               tag beatvox-instrument, parent = 1
//   4. the recipe (JSON)                   tag beatvox-recipe,     parent = 2
// Another mix of a voice already sent (or a reVox of someone else's) is
// steps 2 and 4 only, with the mix's parent being that same raw voice, so
// every mix of a voice hangs off the original.
//
// Each device is a Roundware "participant": a device id kept in
// localStorage, exchanged once per page load for a token that goes with
// every request as X-Participant-Token.
//
// Usage is logged the way Roundware's own web app logs it, so the admin's
// stats fill in: a session per page load (start_session), an event for each
// moment that matters (POST /events/), and a listening-history row for every
// asset heard (POST on start, PATCH with its duration on stop). Logging never
// throws and never holds anything up. See `LogMode`.
//
// A session is a visit: kept in sessionStorage, so a refresh or going from
// the map to the studio carries on with it, until the tab closes or nothing
// has been logged for SESSION_IDLE_MS.

export const RW_API = 'https://api.roundware.app/api/3';
export const RW_PROJECT = 103;

/** BeatVox's own pages: the map is the home page. */
export const MAP_PATH = '/';
export const STUDIO_PATH = '/studio';
/** the map, opened on one mix */
export const mapUrl = (mixId?: number) => (mixId ? `${MAP_PATH}?m=${mixId}` : MAP_PATH);
/** the studio, opening that mix's vox to make your own beat with it */
export const revoxUrl = (mixId: number) => `${STUDIO_PATH}?revox=${mixId}`;

/** A BeatVox's own share page, on whatever site this app is served from. */
export const beatvoxShareUrl = (assetId: number, origin = globalThis.location?.origin ?? '') => `${origin}/b/${assetId}`;

/** The id in a share page's path (/b/<id>), or null for any other page. */
export function sharePageId(path: string): number | null {
  const m = /^\/b\/(\d+)\/?$/.exec(path);
  return m ? Number(m[1]) : null;
}

export const RW_TAGS = {
  source: 1124,
  revoxMix: 1125,
  instrument: 1126,
  recipe: 1127,
  mix: 1128,
  /** on a vox, and on mixes of it, whose maker lets others reVox it.
   *  Only sent once the live server lists the tag (see Session.sendToMap). */
  revoxAllowed: 1129,
  /** a BeatVox's share card: the animated ring GIF link previews show */
  card: 1130,
} as const;

/** JSON files (instrument, recipe) go as the project's "data" media type. */
export const RW_JSON = { mediaType: 'data', ext: 'json', type: 'application/json' } as const;

const DEVICE_KEY = 'beatvox.rw.device';
const SESSION_KEY = 'beatvox.rw.session';
/** a visit ends after this long with nothing logged or sent */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

interface KeptSession {
  id: number;
  project: number;
  /** when it was last used (ms) */
  last: number;
}

function readSession(): KeptSession | null {
  try {
    const k = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as KeptSession | null;
    return k && typeof k.id === 'number' && typeof k.last === 'number' ? k : null;
  } catch {
    return null;
  }
}

function keepSession(k: KeptSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(k));
  } catch {
    /* no storage: a session per page load */
  }
}

/**
 * Where usage logging goes: `send` to Roundware, `console` to the browser
 * console (the dev server, so testing doesn't fill the live stats), or `off`.
 */
export type LogMode = 'send' | 'console' | 'off';

/** Extra fields on an event: `data` is free text, `tags` comma-separated ids. */
export interface RwEventExtra {
  data?: string;
  tags?: string;
}

interface CallOpts {
  /** let the request outlive the page (a listen's last duration, on leaving) */
  keepalive?: boolean;
  retried?: boolean;
}

export interface RwProject {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  legal_agreement: string;
  sharing_url: string;
  auto_submit: boolean;
}

export interface RwAsset {
  id: number;
  file: string | null;
  parent_asset_id?: number | null;
  submitted: boolean;
}

export interface RwPlace {
  latitude: number;
  longitude: number;
}

export class RoundwareError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

/** A device id that stays the same between visits (when storage allows). */
function deviceId(make: () => string): string {
  try {
    const known = localStorage.getItem(DEVICE_KEY);
    if (known) return known;
    const id = make();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return make();
  }
}

export class Roundware {
  private token: Promise<{ token: string; participant: number }> | null = null;
  private session: Promise<number> | null = null;
  /** when this page last used the session (ms) */
  private lastUsed = 0;
  private project: Promise<RwProject> | null = null;
  private started = false;
  /** listens under way: their row, once the server has made it */
  private heard = new Map<number, Promise<{ id: number; t: number } | null>>();

  constructor(
    private newId: () => string,
    private api = RW_API,
    private projectId = RW_PROJECT,
    private log: LogMode = 'off',
  ) {}

  // ── Usage logging ─────────────────────────────────────────────────────

  /** A page has opened: start the visit's session, and close any listen when the page goes. */
  startVisit() {
    if (this.started || this.log === 'off') return;
    this.started = true;
    if (this.log === 'console') {
      const k = this.liveSession(Date.now());
      if (k) console.info('[roundware] carrying on session', k.id);
      else {
        console.info('[roundware] event', { event_type: 'start_session' });
        keepSession({ id: 0, project: this.projectId, last: Date.now() });
      }
    } else void this.visit().catch(() => {});
    globalThis.addEventListener?.('pagehide', () => {
      for (const asset of [...this.heard.keys()]) this.unhear(asset, true);
    });
  }

  /** Log an event: `start_record`, `play_stream`, `share_map` and the like. */
  event(type: string, extra: RwEventExtra = {}) {
    if (this.log === 'off') return;
    const body = { event_type: type, client_time: new Date().toISOString(), ...extra };
    if (this.log === 'console') {
      const k = readSession();
      if (k) keepSession({ ...k, last: Date.now() });
      return console.info('[roundware] event', body);
    }
    this.visit()
      .then((session_id) => this.call('POST', '/events/', { session_id, ...body }))
      .catch(() => {});
  }

  /** An asset started playing. A second call before `unhear` is ignored. */
  hear(asset: number) {
    if (this.log === 'off' || this.heard.has(asset)) return;
    const t = Date.now();
    if (this.log === 'console') {
      console.info('[roundware] listen', asset);
      this.heard.set(asset, Promise.resolve({ id: 0, t }));
      return;
    }
    const row = this.visit()
      .then((session_id) => this.call<{ id: number }>('POST', '/listeninghistoryitems/', { session_id, asset_id: asset, started_at: new Date(t).toISOString() }))
      .then(({ id }) => ({ id, t }))
      .catch(() => null);
    this.heard.set(asset, row);
  }

  /** It stopped: log how long it played (waiting for its row if that's still on the way). */
  unhear(asset: number, leaving = false) {
    const row = this.heard.get(asset);
    if (!row) return;
    this.heard.delete(asset);
    void row.then((r) => {
      if (!r) return;
      const duration_sec = Math.round((Date.now() - r.t) / 100) / 10;
      if (this.log === 'console') return console.info('[roundware] listened', asset, `${duration_sec} s`);
      return this.call('PATCH', `/listeninghistoryitems/${r.id}/`, { duration_sec }, { keepalive: leaving }).catch(() => {});
    });
  }

  getProject(): Promise<RwProject> {
    this.project ??= this.call<RwProject>('GET', `/projects/${this.projectId}/`).catch((e) => {
      this.project = null;
      throw e;
    });
    return this.project;
  }

  /** The ids of the project's tags the live server knows. */
  async tagIds(): Promise<Set<number>> {
    const tags = await this.call<{ id: number }[]>('GET', `/tags/?project_id=${this.projectId}`);
    return new Set(tags.map((t) => t.id));
  }

  /** Who this device is, once per page load. */
  private participant() {
    this.token ??= this.call<{ id: number; participant_token: string }>('POST', '/participants/', {
      project_id: this.projectId,
      device_id: deviceId(this.newId),
      client_type: 'web',
    })
      .then((p) => ({ token: p.participant_token, participant: p.id }))
      .catch((e) => {
        this.token = null;
        throw e;
      });
    return this.token;
  }

  /** The session kept from earlier in this visit, if it hasn't gone idle. */
  private liveSession(now: number): KeptSession | null {
    const k = readSession();
    return k && k.project === this.projectId && now - k.last < SESSION_IDLE_MS ? k : null;
  }

  /**
   * This visit's session: the one kept in this tab (a refresh, or another
   * BeatVox page), or a new one, logged with start_session, when there's
   * none or it went idle. (No timezone: the server wants a 4-character
   * offset and fails on a name.)
   */
  private visit() {
    const now = Date.now();
    if (this.session && now - this.lastUsed >= SESSION_IDLE_MS) this.session = null;
    this.lastUsed = now;
    if (!this.session) {
      const kept = this.liveSession(now);
      // the token still comes first: uploads need it
      const session = (this.session = kept
        ? this.participant().then(() => kept.id)
        : this.participant()
            .then(({ participant }) =>
              this.call<{ id: number }>('POST', '/sessions/', {
                project_id: this.projectId,
                participant_id: participant,
                client_type: 'web',
                client_system: navigator.userAgent.slice(0, 120),
              }),
            )
            .then((s) => {
              if (this.log === 'send') void this.call('POST', '/events/', { session_id: s.id, event_type: 'start_session', client_time: new Date().toISOString() }).catch(() => {});
              return s.id;
            }));
      session.catch(() => {
        if (this.session === session) this.session = null;
      });
    }
    void this.session.then((id) => keepSession({ id, project: this.projectId, last: now })).catch(() => {});
    return this.session;
  }

  async upload(fields: {
    mediaType: string;
    file: Blob;
    fileName: string;
    place: RwPlace;
    tags: number[];
    parent?: number;
    description?: string;
    agreedTerms?: string;
    recordedAt?: Date;
  }): Promise<RwAsset> {
    const session = await this.visit();
    const f = new FormData();
    f.set('project_id', String(this.projectId));
    f.set('session_id', String(session));
    f.set('media_type', fields.mediaType);
    f.set('latitude', String(fields.place.latitude));
    f.set('longitude', String(fields.place.longitude));
    f.set('tag_ids', fields.tags.join(','));
    if (fields.parent !== undefined) f.set('parent_asset_id', String(fields.parent));
    if (fields.description) f.set('description', fields.description);
    if (fields.agreedTerms) f.set('agreed_terms', fields.agreedTerms);
    if (fields.recordedAt) f.set('recorded_at', fields.recordedAt.toISOString());
    f.set('file', fields.file, fields.fileName);
    const asset = await this.call<RwAsset>('POST', '/assets/', f);
    if (!asset.file) throw new RoundwareError(`Roundware saved ${fields.fileName} without its file (asset ${asset.id}).`);
    this.event('upload_asset', { data: `asset_id:${asset.id}` });
    return asset;
  }

  private async call<T>(method: string, path: string, body?: object | FormData, opts: CallOpts = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (path !== '/participants/' && this.token) headers['X-Participant-Token'] = (await this.token).token;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await fetch(this.api + path, { method, headers, body: payload, keepalive: opts.keepalive });
    } catch {
      throw new RoundwareError("Couldn't reach Roundware. Check your connection and try again.");
    }
    if (res.status === 429 && !opts.retried && !opts.keepalive) {
      const wait = Math.min(10, Number(res.headers.get('Retry-After')) || 2);
      await new Promise((r) => setTimeout(r, wait * 1000));
      return this.call(method, path, body, { ...opts, retried: true });
    }
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const j = await res.json();
        detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
      } catch {
        /* not JSON */
      }
      throw new RoundwareError(`Roundware said ${res.status}: ${detail}`, res.status);
    }
    return res.json() as Promise<T>;
  }
}

/** What's been sent of one voice, so a retry or a second mix doesn't send it again. */
export interface SentVoice {
  instrumentId: string;
  voiceAsset: number;
  instrumentAsset?: number;
}

export interface SentMix {
  mixAsset: number;
  /** the share card (an animated GIF of the ring), and its address */
  cardAsset?: number;
  cardUrl?: string;
  recipeAsset?: number;
}

export type SendStep = 'voice' | 'mix' | 'instrument' | 'card' | 'recipe';
export const SEND_STEPS: SendStep[] = ['voice', 'mix', 'instrument', 'card', 'recipe'];
