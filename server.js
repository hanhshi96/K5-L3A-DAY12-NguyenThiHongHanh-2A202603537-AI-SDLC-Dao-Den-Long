// Web server for the 3D client + local leaderboard (no dependencies).
//   node server.js                                -> serve the game on http://localhost:5173
//   node server.js --export-leaderboard out.json  -> write {"entries":[...]} (top 10, ranked) and exit
// The leaderboard is stored on local disk in data/leaderboard.json (override: LEADERBOARD_FILE).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addEntry, sortEntries, validateEntry } from './src/leaderboard.js';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
const LB_FILE = process.env.LEADERBOARD_FILE || path.join(ROOT, 'data', 'leaderboard.json');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };

export function readLeaderboard() {
  try { return sortEntries(JSON.parse(fs.readFileSync(LB_FILE, 'utf8')).entries || []); } catch { return []; }
}
function writeLeaderboard(entries) {
  fs.mkdirSync(path.dirname(LB_FILE), { recursive: true });
  const tmp = `${LB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ entries }, null, 2) + '\n');
  fs.renameSync(tmp, LB_FILE); // atomic replace: no half-written file if the game is closed mid-write
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

export function startServer(port = 5173) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/api/leaderboard' && req.method === 'GET') return sendJson(res, 200, { entries: readLeaderboard() });
    if (p === '/api/leaderboard' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
      req.on('end', () => {
        let e;
        try { e = JSON.parse(body); } catch { return sendJson(res, 400, { errors: ['invalid JSON'] }); }
        const errors = validateEntry(e);
        if (errors.length) return sendJson(res, 400, { errors });
        const { entries, rank } = addEntry(readLeaderboard(), e);
        writeLeaderboard(entries);
        return sendJson(res, 200, { entries, rank });
      });
      return;
    }
    if (p === '/') { res.writeHead(302, { Location: '/src/web/index.html' }); return res.end(); }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--export-leaderboard');
  if (i !== -1) {
    const out = process.argv[i + 1];
    if (!out) { process.stderr.write('error: --export-leaderboard needs an output file\n'); process.exit(1); }
    fs.writeFileSync(out, JSON.stringify({ entries: readLeaderboard() }, null, 2) + '\n');
    process.exit(0);
  }
  const port = Number(process.env.PORT) || 5173;
  startServer(port).then(() => console.log(`Đảo Đèn Lồng: open http://localhost:${port}`));
}
