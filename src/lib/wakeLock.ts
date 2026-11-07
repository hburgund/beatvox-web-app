// Keeps the screen on while a beat plays. Mobile browsers suspend audio when
// the screen locks, so this is what keeps BeatVox going on a phone.

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => (sentinel = null));
  } catch {
    // denied (low battery mode, unsupported); nothing to do
  }
}

// the browser drops the lock when the page is hidden; take it back on return
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void acquire();
  });
}

export function keepAwake(on: boolean) {
  wanted = on;
  if (on) void acquire();
  else if (sentinel) {
    void sentinel.release();
    sentinel = null;
  }
}
