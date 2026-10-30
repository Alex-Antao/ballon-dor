// Assists for the forecast from the Football API (football-api.yuvron.online, through RapidAPI): football-data.org's
// free tier lists assists only for its top scorers and covers no Europa/Conference League, and Wikipedia's match boxes
// list goals but no assists. One request per competition: the season's 100 best assisters of the 7 leagues and the
// three UEFA club competitions (10 requests a run; free plan 500 a month).
// Key: env RAPIDAPI_KEY, or a line RAPIDAPI_KEY=... in the git-ignored .env. Optional: with no key the assists stay as
// football-data.org gives them (or unknown). Offline: FA_FIXTURES=<dir> reads <slug>.json from there instead, and the
// API is never called while FD_FIXTURES is set without it.
const fs = require('fs');
const path = require('path');

const HOST = 'football-leagues1.p.rapidapi.com';
const SLUG = { EPL: 'premier-league', LL: 'la-liga', SA: 'serie-a', BL: 'bundesliga', L1: 'ligue-1', ERE: 'eredivisie', POR: 'primeira-liga',
               UCL: 'champions-league', UEL: 'europa-league', ECL: 'conference-league' };
const LIMIT = 100;

function key() {
  if (process.env.RAPIDAPI_KEY) return process.env.RAPIDAPI_KEY.trim();
  const env = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(env)) return null;
  const m = fs.readFileSync(env, 'utf8').match(/^\s*RAPIDAPI_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  return m ? m[1].trim() : null;
}
const available = () => !!process.env.FA_FIXTURES || (!process.env.FD_FIXTURES && !!key());

async function get(p, slug) {
  if (process.env.FA_FIXTURES) {
    const f = path.join(process.env.FA_FIXTURES, slug + '.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { data: [] };
  }
  const res = await fetch(`https://${HOST}${p}`, { headers: { 'X-RapidAPI-Key': key(), 'X-RapidAPI-Host': HOST } });
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.json();
}

// This season's best assisters per competition code: { code: { rows: [{ name, team, short, a, g, gp }], floor } }.
// floor = the most assists a player missing from the list can have (0 when the list is complete).
async function assistLists(warnings) {
  const out = {};
  for (const [code, slug] of Object.entries(SLUG)) {
    try {
      const d = (await get(`/${slug}/stats/top-assists?limit=${LIMIT}`, slug)).data || [];
      const rows = d.map(x => ({ name: x.player.name, team: x.team.name, short: x.team.shortName, a: x.value, g: x.stats.goals, gp: x.stats.appearances }));
      out[code] = { rows, floor: rows.length < LIMIT ? 0 : Math.min(...rows.map(r => r.a)) };
    } catch (e) { warnings.push(`Football API: ${slug} assists not read (${e.message})`); }
  }
  return out;
}

// A player's line in a list: same person ("Rodri" also matches "Rodri Hernández") at the same club.
// { a, g, gp } when listed; { a: 0, absent: true } when missing from a list that ends at 1 assist (so 0 or 1);
// null when the list is missing or ends higher (unknown).
function assistsOf(list, name, isTeam, samePerson) {
  if (!list) return null;
  const one = name.split(' ').length === 1;
  const e = list.rows.find(x => (samePerson(x.name, name) || (one && x.name.split(' ')[0] === name)) && isTeam(x.team, x.short));
  if (e) return { a: e.a, g: e.g, gp: e.gp };
  return list.floor <= 1 ? { a: 0, absent: true, floor: list.floor } : null;
}

module.exports = { assistLists, assistsOf, available, SLUG, LIMIT };
