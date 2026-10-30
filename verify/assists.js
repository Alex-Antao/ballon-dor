// Assists of the 2023–2026 rows from two APIs that record them:
//   2023–2025 (seasons 2022–23 to 2024–25): API-Football, the only seasons its free plan serves (key API_FOOTBALL_KEY,
//             responses cached in verify/work/api-football)
//   2026 (season 2025–26; MLS 2025): the Football API on RapidAPI (key RAPIDAPI_KEY, responses cached in
//             verify/work/football-api); it covers no World Cup, so ntA stays
// Usage: node verify/assists.js [years...] [--write]   (keys in the env or .env)
//   a/uA  league + the row's continental competition (uT), from the player's season statistics
//   ntA   the row's national-team tournament (API-Football: World Cup 2022 in season 2022, Euro/Copa América 2024)
//   aConf A when everything comes from the API, else B (A rows stay A); goals are compared as a check, never changed
// Without --write it prints the differences.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'data-src');
const env = fs.existsSync(path.join(ROOT, '.env')) ? fs.readFileSync(path.join(ROOT, '.env'), 'utf8') : '';
const envKey = k => process.env[k] || (env.match(new RegExp(`^\\s*${k}\\s*=\\s*"?([^"\\r\\n]+)`, 'm')) || [])[1]?.trim();
const norm = s => s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase();
const args = process.argv.slice(2), only = args.filter(a => /^\d{4}$/.test(a)).map(Number);
let calls = 0;
// the file name keeps each cache's own rule (verify/work/api-football also turns hyphens into _)
async function cached(dir, p, fetcher) {
  const f = path.join(__dirname, 'work', dir, p.replace(dir === 'api-football' ? /[^a-z0-9]+/gi : /[^a-z0-9-]+/gi, '_') + '.json');
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  calls++;
  const j = await fetcher();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(j));
  return j;
}
// the row's club in an API team name (a word of one inside the other)
const atClub = (team, club) => { const t = norm(team).replace(/\bpsg\b/, 'paris saint germain'), c = norm(club).replace(/\bpsg\b/, 'paris saint germain');
  return t.split(/[^a-z]+/).some(w => w.length > 2 && c.includes(w)) || c.split(/[^a-z]+/).some(w => w.length > 2 && t.includes(w)); };

// ---------- API-Football (2023–2025) ----------
const AF = {
  YEARS: [2023, 2024, 2025], SOURCE: 'https://www.api-football.com', NAME: 'API-Football',
  LG: { EPL: 39, LL: 140, SA: 135, BL: 78, L1: 61 }, CUP: { UCL: 2, UEL: 3, ECL: 848 }, NT: { WC: 1, EURO: 4, COPA: 9 },
  NT_SEASON: { WC: 2022, EURO: 2024, COPA: 2024 }, SEARCH: { 'Vinícius Júnior': 'Vinicius', 'Lamine Yamal': 'Yamal', 'Bernardo Silva': 'Bernardo' },
};
const afGet = p => cached('api-football', p, async () => {
  const key = envKey('API_FOOTBALL_KEY');
  if (!key) throw new Error('API_FOOTBALL_KEY missing');
  const j = await (await fetch('https://v3.football.api-sports.io' + p, { headers: { 'x-apisports-key': key } })).json();
  if (j.errors && Object.keys(j.errors).length) throw new Error(p + ' ' + JSON.stringify(j.errors));
  await new Promise(r => setTimeout(r, 6500));   // free plan: 10 requests a minute
  return j;
});
// the player's id: search in the row's league that season, keep the one at the row's club (exact name if several)
async function afId(r, season) {
  const q = AF.SEARCH[r.name] || norm(r.name).split(' ').pop();
  const res = await afGet(`/players?search=${encodeURIComponent(q)}&league=${AF.LG[r.lg]}&season=${season}`);
  let c = res.response.filter(p => p.statistics.some(st => atClub(st.team.name, r.club)));
  if (c.length > 1) c = c.filter(p => norm(p.player.name) === norm(r.name));
  return c.length === 1 ? c[0].player.id : null;
}
// season statistics, without the empty entries the API keeps for a former club
const afStats = async (id, season) => (await afGet(`/players?id=${id}&season=${season}`)).response[0].statistics.filter(s => s.games.appearences > 0);
const afSum = (st, ids, k) => st.filter(s => ids.includes(s.league.id)).reduce((t, s) => t + (s.goals[k] || 0), 0);
async function afRow(r, y) {
  const season = y - 1, id = AF.LG[r.lg] && await afId(r, season);
  if (!id) return null;
  const st = await afStats(id, season), eu = r.uT ? [AF.CUP[r.uT]] : [];
  let ntA = null;
  if (r.ntT && AF.NT[r.ntT]) {
    const ns = (AF.NT_SEASON[r.ntT] === season ? st : await afStats(id, AF.NT_SEASON[r.ntT])).filter(s => s.league.id === AF.NT[r.ntT]);
    if (ns.length && ns[0].goals.assists != null) ntA = ns[0].goals.assists;
  }
  return { g: afSum(st, [AF.LG[r.lg], ...eu], 'total'), a: afSum(st, [AF.LG[r.lg], ...eu], 'assists'), uA: afSum(st, eu, 'assists'), ntA,
           season: `${season}–${String(season + 1).slice(2)}` };
}

// ---------- Football API (2026) ----------
const FA = {
  YEARS: [2026], SOURCE: 'https://football-api.yuvron.online', NAME: 'the Football API', HOST: 'football-leagues1.p.rapidapi.com',
  LG: { EPL: 'premier-league', LL: 'la-liga', SA: 'serie-a', BL: 'bundesliga', L1: 'ligue-1', ERE: 'eredivisie', POR: 'primeira-liga',
        TUR: 'super-lig', MLS: 'mls', BRA: 'brasileirao', ARG: 'liga-profesional' },
  CUP: { UCL: 'champions-league', UEL: 'europa-league', ECL: 'conference-league' },
  CALENDAR: ['mls', 'brasileirao', 'liga-profesional'],   // leagues played in a calendar year: the year the season starts
  SEARCH: { Rodri: 'Rodri Hernández' },
};
const faGet = p => cached('football-api', p, async () => {
  const key = envKey('RAPIDAPI_KEY');
  if (!key) throw new Error('RAPIDAPI_KEY missing');
  const res = await fetch(`https://${FA.HOST}${p}`, { headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': FA.HOST } });
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`);
  return res.json();
});
const sameName = (a, b) => { const w = s => norm(s).split(/[^a-z]+/).filter(Boolean); const [x, y] = [w(a), w(b)].sort((p, q) => p.length - q.length);
  return x.length > 0 && (x.length > 1 || y.length === 1) && x.every(t => y.includes(t)); };
async function faRow(r, y) {
  const lg = FA.LG[r.lg];
  if (!lg) return null;
  const season = `${y - 1}-${String(y).slice(2)}`, lgSeason = FA.CALENDAR.includes(lg) ? String(y - 1) : season;
  const q = FA.SEARCH[r.name] || r.name;
  // the search misses some names with accents ("Krstović") and others without them ("dembele"), and namesakes come
  // first ("Luis Díaz"): try both spellings, then the surname, until a player has a season at the row's club
  const tried = new Set();
  for (const s of new Set([q, norm(q), norm(q).split(' ').pop()])) for (const p of (((await faGet('/search?q=' + encodeURIComponent(s))).data || {}).players || [])
    .filter(p => sameName(p.name, q) && !tried.has(p.id)).slice(0, 3)) {
    tried.add(p.id);
    const car = ((await faGet(`/players/${p.id}`)).data || {}).career || [];
    const L = car.find(e => e.competition === lg && e.season === lgSeason && atClub(e.team.name, r.club));
    if (!L) continue;
    const U = r.uT && FA.CUP[r.uT] ? car.find(e => e.competition === FA.CUP[r.uT] && e.season === season) : null;
    const s = k => (L.stats[k] || 0) + (U ? U.stats[k] || 0 : 0);
    return { g: s('goals'), a: s('assists'), uA: U ? U.stats.assists || 0 : 0, ntA: null, season: lgSeason === season ? season.replace('-', '–') : `${season.replace('-', '–')}; ${lg.toUpperCase()} ${lgSeason}` };
  }
  return null;
}

(async () => {
  const write = args.includes('--write');
  for (const f of fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f))) {
    const file = path.join(SRC, f), text = fs.readFileSync(file, 'utf8'), blk = JSON.parse(text);
    const indent = (text.match(/^\{\r?\n( +)"/) || [, '  '])[1].length;
    let changed = false;
    for (const [y, Y] of Object.entries(blk)) {
      const src = AF.YEARS.includes(+y) ? AF : FA.YEARS.includes(+y) ? FA : null;
      if (!src || (only.length && !only.includes(+y))) continue;
      for (const r of Y.rows) {
        const v = await (src === AF ? afRow : faRow)(r, +y);
        if (!v) { console.log(`${y} ${r.name}: not found`); continue; }
        // goals far apart mean the API counts other games (Messi 2026: MLS play-offs), so its assists are not this row's
        if (Math.abs(v.g - r.g) > 2) { console.log(`${y} ${r.name}: goals ${r.g} here, ${v.g} at ${src.NAME}: other scope, skipped`); continue; }
        const all = !r.ntT || v.ntA != null;
        const diff = [['a', r.a, v.a], ['uA', r.uA, v.uA], ['ntA', r.ntA, v.ntA ?? r.ntA]].filter(([, o, n]) => o !== n);
        console.log(`${y} ${r.name}: ${diff.map(([k, o, n]) => `${k} ${o}→${n}`).join(', ') || 'assists unchanged'}` +
          (v.g !== r.g ? ` (goals differ: ${r.g} here, ${v.g} at ${src.NAME}; kept)` : ''));
        if (!write) continue;
        const was = `a ${r.a}, uA ${r.uA}, ntA ${r.ntA}`;
        Object.assign(r, { a: v.a, uA: v.uA, ntA: v.ntA ?? r.ntA, aConf: all || r.aConf === 'A' ? 'A' : 'B' });
        if (!r.sources.includes(src.SOURCE)) r.sources.push(src.SOURCE);
        r.note = `${r.note ? r.note.replace(/ Assists from (API-Football|the Football API)[^.]*\./, '') + ' ' : ''}Assists from ${src.NAME} (season ${v.season}` +
          `${r.ntT ? `, ${r.ntT} ${v.ntA != null ? 'too' : 'kept: not recorded there'}` : ''}); before: ${was}.`;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, JSON.stringify(blk, null, indent) + '\n');
  }
  console.log(`(${calls} API calls)`);
})().catch(e => { console.error(e.message); process.exit(1); });
