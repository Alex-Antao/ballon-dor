// Builds the forecast for the next Ballon d'Or (season 2026/27, award in 2027) from live data.
//   football-data.org: standings, scorers (goals, assists, games) of 7 leagues and the Champions League, CL stages
//   Wikipedia (verify/ tools): Europa/Conference League stage, domestic cup winners, Golden Shoe, 2027 national-team
//   tournaments (AFC Asian Cup, Africa Cup of Nations, Gold Cup) and their top scorer / best player
// Writes forecast/2027.json (rows in the data-src format plus each model's ranking) and appends forecast/history.json.
// Usage: node forecast/update.js   (needs FOOTBALL_DATA_TOKEN; FD_FIXTURES=<dir> runs offline from saved responses,
//        NO_WIKI=1 skips Wikipedia, AS_OF=YYYY-MM-DD overrides the date, FORECAST_OUT=<dir> writes elsewhere)
const fs = require('fs');
const path = require('path');
const FD = require('./football-data.js');
const { YEARS, leagueStrength } = require('../data.js');
const M = require('../models.js');

const DIR = __dirname, OUT = process.env.FORECAST_OUT || DIR;
const CAND = JSON.parse(fs.readFileSync(path.join(DIR, 'candidates.json'), 'utf8'));
const SEASON = CAND.season, YEAR = CAND.year;
const LEAGUES = { PL: 'EPL', PD: 'LL', BL1: 'BL', SA: 'SA', FL1: 'L1', DED: 'ERE', PPL: 'POR' };
const ROUNDS = { EPL: 38, LL: 38, BL: 34, SA: 38, L1: 34, ERE: 34, POR: 34 };   // league games in a full season
// last known position and non-attacking contribution of players already in the historical data
const KNOWN = {};
for (const y of Object.keys(YEARS).sort()) for (const r of YEARS[y].rows) KNOWN[r.name] = { pos: r.pos, cont: r.cont };
const POOL = 30;   // attackers taken from the scorer lists, on top of candidates.json
const TOURNAMENTS = ['ASIAN', 'AFCON', 'GOLD'];   // national-team finals inside the 2026/27 season
const STAGE = { LAST_16: 1, QUARTER_FINALS: 2, SEMI_FINALS: 3, FINAL: 4 };
const NO_WIKI = !!process.env.NO_WIKI;
const asOf = process.env.AS_OF || new Date().toISOString().slice(0, 10);

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(fc|cf|afc|sc|ac|as|ssc|club|de|calcio)\b/g, '').replace(/[^a-z0-9]/g, '');
const alias = n => CAND.aliases[n] || n;
function posOf(p) {
  const s = `${p.position || ''} ${p.section || ''}`;
  if (/goalkeeper/i.test(s)) return 'GK';
  if (/back|defen/i.test(s)) return 'DF';
  if (/defensive mid/i.test(s)) return 'DM';
  if (/attacking mid/i.test(s)) return 'AM';
  if (/wing/i.test(s)) return 'W';
  if (/mid/i.test(s)) return 'AM';   // a midfielder on a scorer list; true holding players are in candidates.json
  return 'FW';
}
// a club named in candidates.json: exact three-letter code, or a name/short name that equals or contains the other (≥ 5 letters)
const sameTeam = (want, team) => {
  const w = norm(want);
  if (team.tla && want.trim().toUpperCase() === team.tla) return true;
  return [team.name, team.shortName].filter(Boolean).map(norm).some(n => n === w || (Math.min(n.length, w.length) >= 5 && (n.includes(w) || w.includes(n))));
};

async function main() {
  // ---------- football-data.org ----------
  const teams = {};          // team id → { team, lg, position, played }
  const players = {};        // player id → { player, team, lg, league:{gp,g,a}, cl:{gp,g,a} }
  const leaders = {};        // lg → most goals so far
  const sources = ['https://www.football-data.org'];
  for (const [code, lg] of Object.entries(LEAGUES)) {
    const st = await FD.get(`/competitions/${code}/standings?season=${SEASON}`);
    const table = (st.standings.find(s => s.type === 'TOTAL') || st.standings[0]).table;
    for (const row of table) teams[row.team.id] = { team: row.team, lg, position: row.position, played: row.playedGames };
    const sc = await FD.get(`/competitions/${code}/scorers?season=${SEASON}&limit=100`);
    leaders[lg] = Math.max(0, ...sc.scorers.map(s => s.goals || 0));
    for (const s of sc.scorers) {
      const P = players[s.player.id] = players[s.player.id] || { player: s.player, team: s.team, lg, league: { gp: 0, g: 0, a: 0 }, cl: { gp: 0, g: 0, a: 0 } };
      P.team = s.team; P.lg = lg;
      P.league = { gp: s.playedMatches || 0, g: s.goals || 0, a: s.assists ?? null };
    }
  }
  const clm = await FD.get(`/competitions/CL/matches?season=${SEASON}`);
  const clTeams = {};         // team id → { stage, played }
  for (const m of clm.matches) {
    for (const side of ['homeTeam', 'awayTeam']) {
      const id = m[side].id; if (!id) continue;
      const T = clTeams[id] = clTeams[id] || { stage: 0, played: 0, team: m[side] };
      T.stage = Math.max(T.stage, STAGE[m.stage] || 0);
      if (m.status === 'FINISHED') T.played++;
      if (m.stage === 'FINAL' && m.status === 'FINISHED' && m.score.winner === (side === 'homeTeam' ? 'HOME_TEAM' : 'AWAY_TEAM')) T.stage = 5;
    }
  }
  const cls = await FD.get(`/competitions/CL/scorers?season=${SEASON}&limit=100`);
  const clTop = Math.max(0, ...cls.scorers.map(s => s.goals || 0));
  for (const s of cls.scorers) {
    const P = players[s.player.id] = players[s.player.id] || { player: s.player, team: s.team, lg: (teams[s.team.id] || {}).lg, league: { gp: 0, g: 0, a: 0 }, cl: { gp: 0, g: 0, a: 0 } };
    P.cl = { gp: s.playedMatches || 0, g: s.goals || 0, a: s.assists ?? null };
  }

  // ---------- candidate pool ----------
  const quick = P => ((P.league.g + 0.75 * (P.league.a || 0)) * leagueStrength(P.lg, YEAR) + 0.5 * (P.cl.g + 0.75 * (P.cl.a || 0)));
  const excluded = new Set(CAND.exclude);
  const auto = Object.values(players).filter(P => P.lg && !excluded.has(alias(P.player.name))).sort((a, b) => quick(b) - quick(a)).slice(0, POOL);
  const pool = new Map(auto.map(P => [alias(P.player.name), { P }]));
  for (const c of CAND.players) {
    const P = Object.values(players).find(p => alias(p.player.name) === c.name);
    pool.set(c.name, Object.assign(pool.get(c.name) || {}, { P, manual: c }));
  }

  // ---------- rows ----------
  const W = NO_WIKI ? null : { wp: require('../verify/wp.js'), eu: require('../verify/eu.js'), nt: require('../verify/nt.js'), aw: require('../verify/awards.js') };
  const rows = [], warnings = [];
  for (const [name, { P, manual }] of pool) {
    const m = manual || {};
    let team = P && P.team, lg = m.lg || (P && P.lg);
    let T = team && teams[team.id];
    if (!T && m.team) {
      // within the given league, an exact name first ("FC Barcelona" is also inside "RCD Espanyol de Barcelona")
      const inLg = Object.values(teams).filter(t => !m.lg || t.lg === m.lg);
      const exact = t => [t.team.name, t.team.shortName, t.team.tla].filter(Boolean).some(n => norm(n) === norm(m.team));
      const e = inLg.find(exact) || inLg.find(t => sameTeam(m.team, t.team));
      if (e) { T = e; team = e.team; lg = m.lg || e.lg; }
    }
    if (!T) { warnings.push(`${name}: club "${m.team || (team && team.name)}" not found in the covered leagues`); continue; }
    const CLT = clTeams[team.id];
    const fromLists = !!P;
    // the models score the season so far as it is, with no projection to a full season
    const league = P ? P.league : { gp: Math.round((m.share ?? 0.85) * T.played), g: 0, a: null };
    const cl = P ? P.cl : { gp: CLT ? Math.round((m.share ?? 0.85) * CLT.played) : 0, g: 0, a: null };
    const r = {
      name, club: team.shortName || team.name, lg, pos: m.pos || (KNOWN[name] || {}).pos || (P ? posOf(P.player) : 'CM'),
      gp: league.gp + cl.gp, g: league.g + cl.g, a: (league.a || 0) + (cl.a || 0),
      uT: CLT ? 'UCL' : '', uG: cl.g, uA: cl.a || 0, uS: CLT ? CLT.stage : 0,
      ntGP: 0, ntG: 0, ntA: 0, ntT: '', ntS: 0,
      title: T.position === 1 ? 1 : 0, cup: 0, lgTop: P && league.g > 0 && league.g === leaders[lg] ? 1 : 0, gs: 0,
      uTop: P && cl.g > 0 && cl.g === clTop ? 1 : 0, ntTop: 0, ntBest: 0,
      cont: null, rank: null, elig: 1, win: 'P',
      conf: fromLists ? 'A' : 'C', aConf: fromLists && league.a != null ? 'A' : 'C', awConf: NO_WIKI ? 'B' : 'A',
      sources: [...sources], note: '', fdId: P ? P.player.id : null, y: YEAR,
    };
    if (!['FW', 'W', 'AM'].includes(r.pos)) r.cont = m.cont ?? (KNOWN[name] || {}).cont ?? 5;
    const notes = [`As of ${asOf}: ${T.played} of ${ROUNDS[T.lg]} league games played by ${r.club}, ${ordinal(T.position)} in the league`];
    if (!fromLists) notes.push(`not on a scorer list: games estimated as ${Math.round((m.share ?? 0.85) * 100)}% of the club's`);
    if (!['FW', 'W', 'AM'].includes(r.pos) && m.cont == null && (KNOWN[name] || {}).cont == null) notes.push('cont 5 by default (not rated)');
    if (W) wiki(W, r, team, notes, warnings, !fromLists);
    r.note = notes.join('; ') + '.';
    rows.push(r);
  }

  // ---------- models ----------
  const SEL = JSON.parse(fs.readFileSync(path.join(DIR, '..', 'model-selection.json'), 'utf8'));
  const w = (SEL.temporal[String(YEAR)] || {}).weights;
  const ctx = M.predCtx(rows);
  const rank = fn => M.rankYear(rows, fn).map(x => [x.r.name, Math.round(x.score * 1e4) / 1e4]);
  const rankings = { pred: w ? rank(r => M.predict(r, w, ctx)) : [], fair: rank(r => M.fair(r)), mine: rank(r => M.mine(r)) };
  const out = { season: `${SEASON}/${String(SEASON + 1).slice(2)}`, year: YEAR, asOf, window: 'P',
                label: `Season ${SEASON}/${String(SEASON + 1).slice(2)} so far`, leagues: Object.values(LEAGUES), rows, rankings, warnings };
  fs.writeFileSync(path.join(OUT, `${YEAR}.json`), JSON.stringify(out, null, 1) + '\n');

  const HF = path.join(OUT, 'history.json');
  const hist = fs.existsSync(HF) ? JSON.parse(fs.readFileSync(HF, 'utf8')) : [];
  const snap = { date: asOf, pred: rankings.pred.slice(0, 10), fair: rankings.fair.slice(0, 10), mine: rankings.mine.slice(0, 10) };
  const i = hist.findIndex(h => h.date === asOf);
  if (i >= 0) hist[i] = snap; else hist.push(snap);
  fs.writeFileSync(HF, JSON.stringify(hist, null, 1) + '\n');
  console.log(`forecast ${YEAR} as of ${asOf}: ${rows.length} candidates; Prediction top 3: ${rankings.pred.slice(0, 3).map(x => x[0]).join(', ')}`);
  warnings.forEach(x => console.warn('warning:', x));
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// Current club in the player's infobox, read fresh (not from the page cache) so a summer transfer shows up.
function currentClub(W, title) {
  const url = t => `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(t.replace(/ /g, '_'))}&action=raw`;
  let txt = W.wp.get(url(title));
  const redirect = txt.match(/^#REDIRECT\s*\[\[([^\]|#]+)/i);
  if (redirect) txt = W.wp.get(url(redirect[1]));
  const m = txt.match(/\|\s*current_club\s*=\s*([^\n]*)/);
  return m ? W.wp.strip(m[1]).trim() : null;
}

// Wikipedia: Europa/Conference League stage (clubs not in the CL), cup winner, Golden Shoe, 2027 tournaments.
// handKept = the club came from candidates.json, so it is checked against the infobox.
function wiki(W, r, team, notes, warnings, handKept) {
  const club = team.shortName || team.name;
  try {
    if (handKept) {
      const cur = currentClub(W, W.aw.titleOf(r.name, YEAR));
      if (cur && !sameTeam(cur, team)) warnings.push(`${r.name}: Wikipedia says the current club is ${cur}, not ${team.name} as in candidates.json (transfer?)`);
    }
    if (!r.uT) {
      const e = W.eu.euStage(`${SEASON}–${String(SEASON + 1).slice(2)}`, YEAR, { link: null, names: [club, team.name] });
      if (e && !e.none && e.uS != null) { r.uT = e.uT; r.uS = e.uS; r.sources.push('https://en.wikipedia.org/wiki/' + encodeURI(e.edition.replace(/ /g, '_'))); notes.push(`${e.edition}: ${e.reached}`); }
    }
    const aw = W.aw.awards(r, YEAR, 'P');
    r.cup = aw.o.cup; r.gs = aw.o.gs;
    r.sources.push(...aw.src.filter(u => !r.sources.includes(u)));
    const title = W.aw.titleOf(r.name, YEAR);
    for (const ntT of TOURNAMENTS) {
      const s = W.nt.ntStats(title, ntT, YEAR, 'P');
      if (s && !s.issue && s.team) {
        Object.assign(r, { ntT, ntGP: s.apps, ntG: s.goals, ntS: s.stage });
        const a2 = W.aw.awards(r, YEAR, 'P');
        r.ntTop = a2.o.ntTop; r.ntBest = a2.o.ntBest;
        notes.push(`${s.main}: ${s.apps} games, ${s.goals} goals`);
        break;
      }
    }
  } catch (e) { warnings.push(`${r.name}: Wikipedia lookup failed (${e.message})`); r.awConf = 'B'; }
}

main().catch(e => { console.error(e.message); process.exit(1); });
