// Builds the forecast for the next Ballon d'Or (season 2026/27, award in 2027) from live data.
//   football-data.org: standings, scorers (goals, assists, games) of 7 leagues and the Champions League, CL stages
//   Wikipedia (verify/ tools): Europa/Conference League stage and goals (match boxes, qualifiers left out), domestic
//   cup winners, Golden Shoe, 2027 national-team tournaments (AFC Asian Cup, Africa Cup of Nations, Gold Cup) and their
//   top scorer / best player
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
  // 1) the leading scorers of the covered leagues, 2) last year's Ballon d'Or nominees (Wikipedia; club from the
  // player's infobox), 3) the hand-kept list (candidates.json). A player found in several sources is one row.
  const quick = P => ((P.league.g + 0.75 * (P.league.a || 0)) * leagueStrength(P.lg, YEAR) + 0.5 * (P.cl.g + 0.75 * (P.cl.a || 0)));
  const excluded = new Set(CAND.exclude);
  const listed = Object.values(players);
  const findPlayer = name => listed.find(p => alias(p.player.name) === name) || listed.find(p => samePerson(p.player.name, name));
  const auto = listed.filter(P => P.lg && !excluded.has(alias(P.player.name))).sort((a, b) => quick(b) - quick(a)).slice(0, POOL);
  const pool = new Map(auto.map(P => [alias(P.player.name), { P }]));
  const W = NO_WIKI ? null : { wp: require('../verify/wp.js'), eu: require('../verify/eu.js'), nt: require('../verify/nt.js'), aw: require('../verify/awards.js') };
  const rows = [], warnings = [];
  if (W) {
    let noms = [];
    try { noms = nominees(W.wp.raw(`${YEAR - 1} Ballon d'Or`)); } catch (e) { warnings.push(`${YEAR - 1} nominees not read (${e.message})`); }
    for (const nom of noms) {
      const P = findPlayer(nom.name), key = P ? alias(P.player.name) : nom.name;
      if (excluded.has(key)) continue;
      if (pool.has(key)) { pool.get(key).nominee = true; continue; }
      if (P) { pool.set(key, { P, nominee: true }); continue; }
      let cur = null;
      try { cur = currentClub(W, W.aw.titleOf(nom.name, YEAR)); } catch (e) { /* reported just below */ }
      if (!cur) { warnings.push(`${nom.name} (${YEAR - 1} nominee): current club not found on Wikipedia`); continue; }
      pool.set(key, { nominee: true, manual: { name: key, team: cur, pos: (KNOWN[key] || {}).pos || nom.pos, infobox: true } });
    }
  }
  for (const c of CAND.players) {
    const P = findPlayer(c.name);
    pool.set(c.name, Object.assign(pool.get(c.name) || {}, { P, manual: c }));
  }

  // Prior per-game rates for the end-of-season estimate: the player's last season in the data, else the median of
  // the last ten years' candidates in the same group (attackers / the rest).
  const recent = Object.keys(YEARS).map(Number).filter(y => y >= YEAR - 10 && y < YEAR).flatMap(y => YEARS[y].rows).filter(r => r.gp >= 10);
  const median = xs => { const v = xs.slice().sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : 0; };
  const group = att => recent.filter(r => isAttPos(r.pos) === att);
  const PRIOR = Object.fromEntries([true, false].map(att => [att, { g: median(group(att).map(r => r.g / r.gp)), a: median(group(att).map(r => r.a / r.gp)), from: 'a typical candidate' }]));
  const last = {};
  for (const r of (YEARS[YEAR - 1] || { rows: [] }).rows) if (r.gp >= 10) last[r.name] = { g: r.g / r.gp, a: r.a / r.gp, from: `their ${YEAR - 1} season` };

  // ---------- rows ----------
  for (const [name, { P, manual, nominee }] of pool) {
    const m = manual || {};
    let team = P && P.team, lg = m.lg || (P && P.lg);
    let T = team && teams[team.id];
    if (!T && m.team) {
      // within the given league, an exact name first ("FC Barcelona" is also inside "RCD Espanyol de Barcelona");
      // a club read from an infobox has no league, so only an exact name or an alias counts ("Inter Miami" ≠ "Inter")
      const want = (CAND.clubAliases || {})[m.team] || m.team;
      const inLg = Object.values(teams).filter(t => !m.lg || t.lg === m.lg);
      const exact = t => [t.team.name, t.team.shortName, t.team.tla].filter(Boolean).some(n => norm(n) === norm(want));
      const e = inLg.find(exact) || (m.infobox ? null : inLg.find(t => sameTeam(want, t.team)));
      if (e) { T = e; team = e.team; lg = m.lg || e.lg; }
    }
    if (!T) { warnings.push(`${name}: club "${m.team || (team && team.name)}" not found in the covered leagues`); continue; }
    const CLT = clTeams[team.id];
    const fromLists = !!P;
    const pos = m.pos || (KNOWN[name] || {}).pos || (P ? posOf(P.player) : 'CM');
    // games and goals so far: the scorer lists; else this season's row of the player's Wikipedia career table;
    // else an estimate from the club's games (share) with no goals
    const wk = !P && W ? seasonSoFar(W, W.aw.titleOf(name, YEAR), warnings, name) : null;
    const est = n => Math.round((m.share ?? 0.85) * n);
    const league = P ? P.league : wk ? { gp: wk.lg[0], g: wk.lg[1], a: null } : { gp: est(T.played), g: 0, a: null };
    const cl = P ? P.cl : wk ? { gp: CLT ? wk.eu[0] : 0, g: CLT ? wk.eu[1] : 0, a: null } : { gp: CLT ? est(CLT.played) : 0, g: 0, a: null };
    // What the models score: the expected end-of-season league numbers (so far + the rest of the season at a pace
    // pulled towards the prior), because the models were fitted on whole seasons. The Champions League stays as it is.
    const prior = last[name] || PRIOR[isAttPos(pos)];
    const share = fromLists || wk ? Math.min(1, league.gp / Math.max(1, T.played)) : (m.share ?? 0.85);
    const L = expectLeague(league, T.played, ROUNDS[T.lg], share, prior);
    const r = {
      name, club: team.shortName || team.name, lg, pos,
      gp: L.gp + cl.gp, g: L.g + cl.g, a: L.a + (cl.a || 0),
      gpNow: league.gp + cl.gp, gNow: league.g + cl.g, aNow: league.a == null ? null : league.a + (cl.a || 0),
      uT: CLT ? 'UCL' : '', uG: cl.g, uA: cl.a || 0, uANow: cl.a ?? null, uS: CLT ? CLT.stage : 0,
      ntGP: 0, ntG: 0, ntA: 0, ntT: '', ntS: 0,
      title: T.position === 1 ? 1 : 0, cup: 0, lgTop: P && league.g > 0 && league.g === leaders[lg] ? 1 : 0, gs: 0,
      uTop: P && cl.g > 0 && cl.g === clTop ? 1 : 0, ntTop: 0, ntBest: 0,
      cont: null, rank: null, elig: 1, win: 'P',
      conf: fromLists ? 'A' : wk ? 'B' : 'C', aConf: fromLists && league.a != null ? 'A' : 'C', awConf: NO_WIKI ? 'B' : 'A',
      sources: [...sources], note: '', fdId: P ? P.player.id : null, y: YEAR,
    };
    if (nominee) r.nominee = 1;
    if (!isAttPos(r.pos)) r.cont = m.cont ?? (KNOWN[name] || {}).cont ?? 5;
    const notes = [`As of ${asOf}: ${T.played} of ${ROUNDS[T.lg]} league games played by ${r.club}, ${ordinal(T.position)} in the league`,
      `end of season estimated from the pace so far pulled towards ${prior.from} (${prior.g.toFixed(2)} goals and ${prior.a.toFixed(2)} assists a game)`];
    if (nominee) notes.push(`${YEAR - 1} Ballon d'Or nominee`);
    if (wk) notes.push('not on a scorer list: games and goals from the Wikipedia career table, assists unknown');
    else if (!fromLists) notes.push(`not on a scorer list: games estimated as ${Math.round((m.share ?? 0.85) * 100)}% of the club's`);
    if (!isAttPos(r.pos) && m.cont == null && (KNOWN[name] || {}).cont == null) notes.push('cont 5 by default (not rated)');
    if (W) wiki(W, r, team, notes, warnings, !fromLists && !m.infobox);
    if (wk) r.sources.push('https://en.wikipedia.org/wiki/' + encodeURI(W.aw.titleOf(name, YEAR).replace(/ /g, '_')));
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
  // "current_club" or "currentclub"; an empty value must not run on to the next line
  const m = txt.match(/\|[ \t]*current_?club[ \t]*=[ \t]*([^\n]*)/i);
  return m ? W.wp.strip(m[1]).trim() : null;
}

// Wikipedia: Europa/Conference League stage and goals (clubs not in the CL), cup winner, Golden Shoe, 2027 tournaments.
// handKept = the club came from candidates.json, so it is checked against the infobox.
function wiki(W, r, team, notes, warnings, handKept) {
  const club = team.shortName || team.name;
  try {
    if (handKept) {
      const cur = currentClub(W, W.aw.titleOf(r.name, YEAR));
      if (cur && !sameTeam(cur, team)) warnings.push(`${r.name}: Wikipedia says the current club is ${cur}, not ${team.name} as in candidates.json (transfer?)`);
    }
    if (!r.uT) {
      // the edition pages link clubs by their short name ("Benfica" for "SL Benfica")
      const bare = n => n.replace(/\b(FC|CF|SL|SC|AS|AC|SV|SSC|RC|CD|UD|AFC|OSC|SK|BC)\b\.?/g, '').replace(/\s+/g, ' ').trim();
      const names = [...new Set([club, team.name].flatMap(n => [n, bare(n)]))].filter(n => n.length >= 4);
      const e = W.eu.euStage(`${SEASON}–${String(SEASON + 1).slice(2)}`, YEAR, { link: null, names });
      if (e && !e.none && e.level > 0) {
        const ed = W.wp.rawT(e.edition).title || e.edition;   // "UEFA Europa Conference League" redirects to the new name
        r.uT = e.uT; r.uS = e.uS; r.sources.push('https://en.wikipedia.org/wiki/' + encodeURI(ed.replace(/ /g, '_')));
        // football-data.org only covers the Champions League: games and goals in this competition from its match boxes
        const so = euSoFar(W, ed, r.name, team);
        Object.assign(r, { gp: r.gp + so.gp, g: r.g + so.g, gpNow: r.gpNow + so.gp, gNow: r.gNow + so.g, uG: so.g, uANow: null });
        notes.push(`${ed}: ${e.reached.toLowerCase()}, ${so.g} goal${so.g === 1 ? '' : 's'} in the club's ${so.gp} matches so far (Wikipedia match boxes; assists unknown)`);
      }
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

const isAttPos = p => ['FW', 'W', 'AM'].includes(p);
// Same person in two spellings: every word of the shorter name is a word of the longer one ("Lamine Yamal" in
// "Lamine Yamal Nasraoui Ebana"); one-word names must match exactly.
function samePerson(a, b) {
  const w = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const [x, y] = [w(a), w(b)].sort((p, q) => p.length - q.length);
  if (!x.length) return false;
  if (x.length === 1) return y.length === 1 && x[0] === y[0];
  return x.every(t => y.includes(t));
}
// Nominees of the men's award: the first table of the page's "Ballon d'Or" section (the page also lists the women's
// award, the Kopa and Yashin trophies and the coaches). [{ name, pos }].
function nominees(text) {
  const POS = { forward: 'FW', midfielder: 'CM', defender: 'DF', goalkeeper: 'GK' };
  const sec = text.search(/==\s*(Men's )?Ballon d'Or\s*==/i);
  const from = text.indexOf('{|', Math.max(0, sec)), to = text.indexOf('\n|}', from);
  if (from < 0 || to < 0) return [];
  const out = [];
  for (const row of text.slice(from, to).split(/\n\|-/)) {
    const n = row.match(/\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)/i);
    if (!n) continue;
    const p = row.match(/\[\[(?:[^\]|]*\|)?(Forward|Midfielder|Defender|Goalkeeper)\]\]/i);
    out.push({ name: `${n[1].trim()} ${n[2].trim()}`.trim(), pos: p ? POS[p[1].toLowerCase()] : 'FW' });
  }
  return out;
}
// Expected end-of-season league numbers. Each per-game rate is shrunk towards the prior with the weight of K games,
// so a hot start of a few games does not run to a 40-goal season; the remaining games follow the player's share
// of the club's games so far. Unknown assists (null) come from the prior alone.
const K = 10;
function expectLeague(so, played, rounds, share, prior) {
  const rest = Math.max(0, rounds - played) * share;
  const rate = (x, p) => (x + K * p) / (so.gp + K);
  return { gp: Math.round(so.gp + rest), g: Math.round(so.g + rest * rate(so.g, prior.g)),
           a: Math.round(so.a == null ? (so.gp + rest) * prior.a : so.a + rest * rate(so.a, prior.a)) };
}
// Goals in a Europa/Conference League edition from the match boxes of its league-phase, knockout-phase and final
// pages (qualifiers left out, as in the data); games = the club's matches played so far.
function euSoFar(W, ed, name, team) {
  const seen = new Set(), o = { gp: 0, g: 0 };
  for (const t of [`${ed} league phase`, `${ed} knockout phase`, `${ed} final`]) {
    for (const m of W.wp.matches(t)) {
      const side = sameTeam(m.team1, team) ? m.goals1 : sameTeam(m.team2, team) ? m.goals2 : null;
      if (side == null || !/\d/.test(m.score) || seen.has(m.date + m.team1 + m.team2)) continue;
      seen.add(m.date + m.team1 + m.team2); o.gp++;
      for (const [who, n] of Object.entries(W.wp.scorers(side))) if (samePerson(who, name)) o.g += n;
    }
  }
  return o;
}
// This season's rows of a player's Wikipedia career table: { lg: [games, goals], eu: [games, goals] } or null.
function seasonSoFar(W, title, warnings, name) {
  try {
    const want = [`${SEASON}–${String(SEASON + 1).slice(2)}`, `${SEASON}-${String(SEASON + 1).slice(2)}`];
    const rows = (W.wp.career(title) || []).filter(r => want.includes((r.season || '').replace(/\s/g, '')) && !/total/i.test(r.club || ''));
    if (!rows.length) return null;
    const LG = k => /^(League|Liga|Division)/i.test(k), EU = k => /Europe|Continental|UEFA|Champions/i.test(k) && !/national/i.test(k);
    const sum = test => rows.reduce((acc, r) => { const k = Object.keys(r.comp).find(test), v = k ? r.comp[k] : [0, 0]; return [acc[0] + (+v[0] || 0), acc[1] + (+v[1] || 0)]; }, [0, 0]);
    return { lg: sum(LG), eu: sum(EU) };
  } catch (e) { warnings.push(`${name}: Wikipedia career table not read (${e.message})`); return null; }
}

if (require.main === module) {
  // the live forecast reads this season's pages: cached Wikipedia pages older than 12 hours are fetched again
  process.env.WP_MAX_AGE_H = process.env.WP_MAX_AGE_H || '12';
  main().catch(e => { console.error(e.message); process.exit(1); });
}
module.exports = { samePerson, nominees, expectLeague };
