// The one Roundware client each page shares, so a visit is one session.
// The dev server logs usage to the console instead of the live stats; set
// localStorage `beatvox.rw.log` to `send` to log to Roundware from dev too.
import { Roundware, RW_API, RW_PROJECT, type LogMode } from './roundware';
import { newId } from './instrument';

function logMode(): LogMode {
  if (!import.meta.env.DEV) return 'send';
  try {
    return localStorage.getItem('beatvox.rw.log') === 'send' ? 'send' : 'console';
  } catch {
    return 'console';
  }
}

export const rw = new Roundware(newId, RW_API, RW_PROJECT, logMode());
