// Europa/Conference League numbers for the forecast from the Football API (football-api.yuvron.online, through RapidAPI):
// football-data.org's free tier only covers the Champions League, and Wikipedia's match boxes list goals but no assists.
// Key: env RAPIDAPI_KEY, or a line RAPIDAPI_KEY=... in the git-ignored .env. Free plan: 500 requests a month, two per
// player (search + season stats). Optional: with no key the assists stay unknown.
const fs = require('fs');
const path = require('path');

const HOST = 'football-leagues1.p.rapidapi.com';
const SLUG = { UEL: 'europa-league', ECL: 'conference-league' };

function key() {
  if (process.env.RAPIDAPI_KEY) return process.env.RAPIDAPI_KEY.trim();
  const env = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(env)) return null;
  const m = fs.readFileSync(env, 'utf8').match(/^\s*RAPIDAPI_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  return m ? m[1].trim() : null;
}

async function get(p) {
  const res = await fetch(`https://${HOST}${p}`, { headers: { 'X-RapidAPI-Key': key(), 'X-RapidAPI-Host': HOST } });
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.json();
}

// This season's { gp, g, a } of a player in a Europa/Conference League edition, or null when not found.
async function euStats(name, uT, samePerson) {
  if (!SLUG[uT]) return null;
  // the search misses accented names ("Krstović"), so it is tried again without the accents
  let p = null;
  for (const q of new Set([name, name.normalize('NFD').replace(/\p{Mn}/gu, '')])) {
    const s = await get('/search?q=' + encodeURIComponent(q));
    if ((p = ((s.data || {}).players || []).find(x => samePerson(x.name, name)))) break;
  }
  if (!p) return null;
  const d = (await get(`/${SLUG[uT]}/players/${p.id}`)).data;
  return d && d.stats ? { gp: d.stats.appearances || 0, g: d.stats.goals || 0, a: d.stats.assists || 0 } : null;
}

module.exports = { euStats, available: () => !!key() };
