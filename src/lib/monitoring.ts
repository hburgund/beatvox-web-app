// Error reporting: Sentry, when the build has VITE_SENTRY_DSN (set in
// Netlify's build environment). Off without it: the dev server, tests, and
// any build made without the key. The SDK is only loaded when it's on.
//
// On, errors in people's browsers reach Sentry, so failures that only happen
// on some phones (recording, audio starting, making a video) show up without
// anyone reporting them. Nothing personal goes with them, as on the
// Roundware web app and admin: no user, cookies, bodies or query parameters
// (Sentry's dataCollection collects all of those by default), no headers but
// the browser's User-Agent ("Safari 18 on iOS 18", which Sentry turns into
// the browser, OS and device tags: the point of all this), no session
// replay, no performance tracing, addresses without their query strings, and
// no console breadcrumbs. Netlify's deploy permalinks don't report: only its
// screenshot bot loads them, on a server with no graphics card. The Sentry
// project's "Prevent Storing of IP Addresses" covers the address it connects
// from. The About page's privacy note says it's there.

/** An address without its query string or fragment: they can carry anything (a reVox link's id, a place). */
export const scrubUrl = (url?: string): string | undefined => url?.replace(/[?#].*$/, '');

/** A Netlify deploy permalink (`<24 hex>--beatvox-lab.netlify.app`): nobody browses there; its screenshot bot does. */
export const isDeployPermalink = (hostname: string): boolean => /^[0-9a-f]{24}--/.test(hostname);

/** Which site this is: the live one, a Netlify deploy preview, or anywhere else. */
export function environment(hostname: string): 'live-site' | 'preview' | 'other' {
  if (hostname === 'beatvox.app') return 'live-site';
  if (hostname.endsWith('.netlify.app')) return 'preview';
  return 'other';
}

/** Noise every site sees, or things that go wrong by someone's own choice: not ours to fix. */
export const IGNORE_ERRORS: (string | RegExp)[] = [
  'ResizeObserver loop limit exceeded',
  'ResizeObserver loop completed with undelivered notifications',
  /^Non-Error promise rejection captured/,
  // a sound stopped or skipped before it started playing
  /The play\(\) request was interrupted/,
  // audio or the mic refused until a tap, or turned down: BeatVox asks again
  /NotAllowedError/,
];

export async function startErrorReporting(): Promise<boolean> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || isDeployPermalink(location.hostname)) return false;
  const Sentry = await import('@sentry/browser');
  Sentry.init({
    dsn,
    environment: environment(location.hostname),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    tracesSampleRate: 0,
    ignoreErrors: IGNORE_ERRORS,
    denyUrls: [/extensions\//i, /^chrome(-extension)?:\/\//i, /^moz-extension:\/\//i, /^safari(-web)?-extension:/i],
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'console') return null;
      if (crumb.data) {
        for (const key of ['url', 'from', 'to']) {
          if (typeof crumb.data[key] === 'string') crumb.data[key] = scrubUrl(crumb.data[key]);
        }
      }
      return crumb;
    },
    beforeSend(event) {
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        delete event.request.query_string;
        delete event.request.cookies;
        // only the User-Agent, for the browser, OS and device tags
        event.request.headers = { 'User-Agent': navigator.userAgent };
      }
      delete event.user;
      return event;
    },
  });
  return true;
}
