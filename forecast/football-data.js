// Minimal football-data.org v4 client (free tier: 10 requests per minute).
// Token: env FOOTBALL_DATA_TOKEN, or a line FOOTBALL_DATA_TOKEN=... in a git-ignored .env at the repository root.
// With env FD_FIXTURES=<dir>, responses are read from <dir>/<path with / → _>.json instead (tests, offline runs).
const fs = require('fs');
const path = require('path');

const BASE = 'https://api.football-data.org/v4';
const GAP_MS = 6500;   // stay under 10 requests per minute
let last = 0;

function token() {
  if (process.env.FOOTBALL_DATA_TOKEN) return process.env.FOOTBALL_DATA_TOKEN.trim();
  const env = path.join(__dirname, '..', '.env');
  if (fs.existsSync(env)) {
    const m = fs.readFileSync(env, 'utf8').match(/^\s*FOOTBALL_DATA_TOKEN\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1].trim();
  }
  return null;
}
const fixtureFile = (dir, p) => path.join(dir, p.replace(/^\//, '').replace(/[/?=&]/g, '_') + '.json');

async function get(p) {
  if (process.env.FD_FIXTURES) {
    const f = fixtureFile(process.env.FD_FIXTURES, p);
    if (!fs.existsSync(f)) throw new Error(`no fixture for ${p} (${f})`);
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const t = token();
  if (!t) throw new Error('FOOTBALL_DATA_TOKEN is not set (env or .env)');
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(BASE + p, { headers: { 'X-Auth-Token': t } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 60_000)); continue; }
    if (!res.ok) throw new Error(`football-data.org ${res.status} for ${p}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error(`football-data.org: too many requests for ${p}`);
}

module.exports = { get, token, fixtureFile };
