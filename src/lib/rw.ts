// The one Roundware client each page shares, so a visit is one session.
// The dev server logs usage to the console instead of the live stats; set
// localStorage `beatvox.rw.log` to `send` to log to Roundware from dev too.
// The events that matter most are also counted in GoatCounter
// (src/lib/count.ts); from the dev server, only to the console.
import { Roundware, RW_API, RW_PROJECT, type LogMode, type RwEventExtra } from './roundware';
import { newId } from './instrument';
import { countEvent } from './count';

function logMode(): LogMode {
  if (!import.meta.env.DEV) return 'send';
  try {
    return localStorage.getItem('beatvox.rw.log') === 'send' ? 'send' : 'console';
  } catch {
    return 'console';
  }
}

class CountedRoundware extends Roundware {
  override event(type: string, extra: RwEventExtra = {}) {
    super.event(type, extra);
    // the dev server has no /api/count
    countEvent(type, extra.data, import.meta.env.DEV ? 'console' : 'send');
  }
}

export const rw = new CountedRoundware(newId, RW_API, RW_PROJECT, logMode());
