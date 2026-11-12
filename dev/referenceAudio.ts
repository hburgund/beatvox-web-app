// Dev-server-only plugin: lists and serves the private 2008 reference recordings
// from docs/ so the slicer lab can browse them. Never included in a build.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

const ROOT = path.resolve(import.meta.dirname, '../docs');
// samples/_hidden/ holds 2008 takes that are near-silent or under 2 s (see WHY.txt there); not listed.
const SOURCES: { dir: string; group: string; flat?: boolean; match?: RegExp; skip?: RegExp }[] = [
  { dir: 'beatvox-reference/samples', group: 'dec / ica', match: /^(dec|ica)_bvox/i },
  { dir: 'beatvox-reference/samples', group: '2008 visitors', skip: /^(dec|ica)_bvox/i },
  { dir: 'beatvox-reference/payc', group: 'payc' },
  { dir: 'beatvox-reference/speeches', group: 'speeches' },
  { dir: 'beatvox-reference', group: 'misc', flat: true },
  { dir: '.', group: 'reference output', flat: true },
];
const AUDIO = /\.(wav|aif|aiff|mp3)$/i;
const TYPES: Record<string, string> = { '.wav': 'audio/wav', '.aif': 'audio/aiff', '.aiff': 'audio/aiff', '.mp3': 'audio/mpeg' };

function list() {
  const out: { group: string; name: string; path: string }[] = [];
  for (const s of SOURCES) {
    const dir = path.join(ROOT, s.dir);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (!AUDIO.test(name) || !fs.statSync(full).isFile()) continue;
      if ((s.match && !s.match.test(name)) || s.skip?.test(name)) continue;
      out.push({ group: s.group, name, path: path.posix.join(s.dir, name) });
    }
  }
  return out;
}

export function referenceAudio(): Plugin {
  return {
    name: 'beatvox-reference-audio',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__ref', (req, res) => {
        const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
        if (url === '/' || url === '/list') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(list()));
          return;
        }
        const full = path.resolve(ROOT, '.' + url);
        if (!full.startsWith(ROOT + path.sep) || !AUDIO.test(full) || !fs.existsSync(full)) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        res.setHeader('Content-Type', TYPES[path.extname(full).toLowerCase()] ?? 'application/octet-stream');
        fs.createReadStream(full).pipe(res);
      });
    },
  };
}
