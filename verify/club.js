// A player's club statistics in a window (CY = calendar year, P = season ending in Y).
const W = require('./wp.js');
const fs = require('fs');
const path = require('path');
const TITLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'titles.json')));
const titleFor = (name, y) => (y >= 2000 && TITLES[name + '@2010']) || TITLES[name] || name;

const yy = y => String(y).slice(2);
const seasonKeys = y => [`${y - 1}–${yy(y)}`, `${y - 1}-${yy(y)}`, `${y - 1}–${y}`, `${y - 1}/${yy(y)}`];
const isSeason = (s, y) => seasonKeys(y).includes(s.replace(/\s/g, ''));
const LG = k => /^(League|Liga|Division)/i.test(k);
const EU = k => /Europe|Continental|UEFA|CONMEBOL|Champions|European|CAF|AFC|Libertadores/i.test(k) && !/national/i.test(k);

function matchSide(ms) {
  // "our" team = the most frequent name (unlinked) among team1/team2
  const f = {};
  ms.filter(m => !m.table).forEach(m => [m.team1, m.team2].forEach(t => { f[t] = (f[t] || 0) + 1; }));
  return Object.entries(f).sort((a, b) => b[1] - a[1])[0]?.[0];
}
const linkCache = {};
function samePlayer(link, title) {
  if (link === title) return true;
  const last = title.replace(/\s*\(.*\)/, '').split(' ').pop();
  if (!link.includes(last) && !title.includes(link.split(' ').pop())) return false;
  if (!(link in linkCache)) linkCache[link] = W.rawT(link).title;
  return linkCache[link] === title;
}

// Matches on a season page → {L:{y:{club,player}}, U:{...}, rounds:[...]} for the player
function seasonBoxes(page, title) {
  const ms = W.matches(page);
  if (!ms.length) return null;
  const side = matchSide(ms.filter(m => W.compClass(m.ctx) !== 'X'));
  const o = { page, side, n: ms.length, L: {}, U: {}, X: {}, unk: 0, uRounds: [] };
  for (const m of ms) {
    const k = W.compClass(m.ctx);
    if (k === '?') { o.unk++; continue; }
    const ours = m.table ? 1 : m.team1 === side ? 1 : m.team2 === side ? 2 : 0;
    if (!ours) continue;
    const sc = W.scorers(ours === 1 ? m.goals1 : m.goals2, !!m.table);
    let pg = 0;
    for (const p in sc) if (samePlayer(p, title)) pg += sc[p];
    const y = m.year || 0;
    const B = o[k][y] = o[k][y] || { club: 0, goals: 0 };
    B.club++; B.goals += pg;
    if (k === 'U') o.uRounds.push((m.ctx.split(' > ').slice(1).join('/') + ' ' + m.round).trim() + ' ' + m.score + ' ' + (m.result || ''));
  }
  return o;
}

function guessSeasonPage(row, s) {
  if (row.seasonLink && /season/i.test(row.seasonLink)) return row.seasonLink;
  const club = row.clubLink || row.club;
  const cands = [`${s} ${club} season`, `${s} ${club.replace(/ F\.C\.$| FC$| C\.F\.$| CF$/, '')} season`, `${s} ${club} F.C. season`];
  for (const c of cands) { const r = W.rawT(c); if (r.text && /football ?box|!\s*Scorers|!\s*Goalscorers/i.test(r.text)) return r.title; }
  return null;
}

// Result: {seasons:[...], gp, g, uG, est:{gp:bool}, issues:[]}
function clubWindow(name, y, win, lg) {
  const title = titleFor(name, y);
  const car = W.career(title);
  const res = { title, seasons: [], issues: [], lg };
  if (!car) { res.issues.push('no career table'); return res; }
  const want = win === 'P' ? [y] : [y, y + 1];
  for (const r of car) {
    if (/total/i.test(r.club) || /total/i.test(r.season) || /^career/i.test(r.club)) continue;
    if (/\b(II|B|U\d\d|reserves|youth|Castilla|Atlètic)\s*$/i.test(r.club.replace(/\s*\(.*\)/, ''))) continue;  // B teams/reserves
    let part = null;
    for (const e of want) if (isSeason(r.season, e)) part = e;          // season ending in e
    if (win !== 'P' && r.season.replace(/\s/g, '') === String(y)) part = 'CY';  // calendar-year league
    if (part == null) continue;
    const keys = Object.keys(r.comp);
    const lk = keys.find(LG), ek = keys.find(EU);
    const S = { club: r.club, clubLink: r.clubLink, season: r.season, div: r.div, part,
                lg: lk ? r.comp[lk] : [null, null], eu: ek ? r.comp[ek] : [null, null], euKey: ek, euNote: ek ? r.comp[ek].note : '' };
    if (part !== 'CY' && (win === 'CY' || part === y)) {
      const page = guessSeasonPage(r, r.season.replace(/\s/g, ''));
      S.page = page;
      if (page) S.box = seasonBoxes(page, title);
    }
    res.seasons.push(S);
  }
  // combine
  let gp = 0, g = 0, uG = 0, gpEst = false, gExact = true, ok = res.seasons.length > 0;
  res.noEu = res.seasons.some(S => !S.euKey);
  // table with empty league cells → unusable
  if (res.seasons.some(S => S.lg[0] == null || S.lg[1] == null)) {
    res.issues.push('career table missing league games/goals');
    Object.assign(res, { gp: null, g: null, uG: null, ok: false, gExact: false });
    return finish(res, y);
  }
  const split = res.seasons.filter(S => !(win === 'P' || S.part === 'CY'));
  // season well covered by the match page? (club games ≥ player games and ≥ 70% of the goals, in league and Europe)
  const covered = S => {
    if (!S.box) return false;
    for (const [k, apps, goals] of [['L', S.lg[0], S.lg[1]], ['U', S.eu[0], S.eu[1]]]) {
      if (!apps && !goals) continue;
      const T = Object.values(S.box[k]).reduce((a, b) => ({ club: a.club + b.club, goals: a.goals + b.goals }), { club: 0, goals: 0 });
      if (T.club < (apps || 0) || (goals && T.goals < 0.7 * goals)) return false;
    }
    return true;
  };
  split.forEach(S => { S.covered = covered(S); });
  // no season well covered: SPEC fallback = season ending in y (win "S")
  if (win === 'CY' && split.length && !split.some(S => S.covered)) {
    res.sMode = true;
    for (const S of res.seasons) if (S.part === y || S.part === 'CY') {
      gp += (S.lg[0] || 0) + (S.eu[0] || 0); g += (S.lg[1] || 0) + (S.eu[1] || 0); uG += S.eu[1] || 0;
    }
    res.issues.push('no season pages with every match: used the season ending in the year');
    Object.assign(res, { gp, g, uG, gpEst: false, gExact: false, ok: true });
  }
  for (const S of res.sMode ? [] : res.seasons) {
    const [la, lgl] = S.lg, [ea, eg] = S.eu;
    if (win === 'P' || S.part === 'CY') { gp += (la || 0) + (ea || 0); g += (lgl || 0) + (eg || 0); uG += eg || 0; continue; }
    const B = S.box;
    if (!S.covered) {
      // only this season lacks a complete page: half of the totals (estimate), the other one counted
      gExact = false; res.partial = true; gpEst = true;
      res.issues.push(`${S.season} ${S.club}: no season page with every match (split estimated at 50%)`);
      gp += ((la || 0) + (ea || 0)) * 0.5; g += Math.round(((lgl || 0) + (eg || 0)) * 0.5); uG += Math.round((eg || 0) * 0.5);
      continue;
    }
    const tot = k => Object.values(B[k]).reduce((a, b) => ({ club: a.club + b.club, goals: a.goals + b.goals }), { club: 0, goals: 0 });
    const inY = k => B[k][y] || { club: 0, goals: 0 };
    for (const [k, apps, goals] of [['L', la, lgl], ['U', ea, eg]]) {
      const T = tot(k), I = inY(k);
      S[k + 'chk'] = `${k}: table ${apps ?? '-'}gp/${goals ?? '-'}g; season boxes ${T.club}gp(club) ${T.goals}g; in ${y}: ${I.club}gp ${I.goals}g`;
      if ((goals || 0) !== T.goals) { gExact = false; res.issues.push(`${S.season} ${S.club} ${k}: table goals ${goals} ≠ boxes ${T.goals}`); }
      // complete page for this competition? (club games ≥ player games and counted goals ≥ 70% of the table)
      const complete = T.club >= (apps || 0) && (!goals || T.goals >= 0.7 * goals);
      S[k + 'complete'] = complete;
      if (!complete && (apps || goals)) { gExact = false; res.issues.push(`${S.season} ${S.club} ${k}: season page incomplete (year split estimated at 50%)`); }
      const share = complete && T.club ? I.club / T.club : 0.5;
      gp += (apps || 0) * share; gpEst = true;
      // goals: count from the boxes; scaled when it does not match the table
      const gy = !complete ? Math.round((goals || 0) * share) : (goals || 0) === T.goals ? I.goals : (T.goals ? Math.round((goals || 0) * I.goals / T.goals) : 0);
      g += gy; if (k === 'U') uG += gy;
    }
  }
  if (!res.sMode) Object.assign(res, { gp: Math.round(gp), g, uG, gpEst, gExact, ok });
  return finish(res, y);
}
function finish(res, y) {
  // title: league season that ended in the window
  res.titleChk = [];
  for (const S of res.seasons) {
    if (!(S.part === y || S.part === 'CY')) continue;
    const name = S.club.replace(/\s*\(.*\)/, '').trim();
    const champ = leagueChampion(S.season, S.div, res.lg, { link: S.clubLink, name });
    if (champ) {
      const won = sameClub(champ.name, S.club);
      // the club's league games that season (for the 1/3 threshold), from the season page if there is one
      const rounds = S.box ? Object.values(S.box.L).reduce((a, b) => a + b.club, 0) : 0;
      res.titleChk.push({ season: S.season, div: S.div, page: champ.page, champ: champ.name, won, apps: S.lg[0], rounds });
    }
  }
  // European stage in the edition ending in y
  // (season of the club where they played most league games; only if the page has all of the club's European games)
  const S1 = res.seasons.filter(S => S.part === y && S.box).sort((a, b) => (b.lg[0] || 0) - (a.lg[0] || 0))[0];
  if (S1) {
    const U = Object.values(S1.box.U).reduce((a, b) => a + b.club, 0);
    if (U >= (S1.eu[0] || 0) && (U > 0 || !(S1.eu[0] > 0))) res.uRounds = S1.box.uRounds;
  }
  return res;
}
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/dinamo/g, 'dynamo').replace(/kiev/g, 'kyiv').replace(/moskva/g, 'moscow').replace(/tbilisi/g, 'tbilisi')
  .replace(/\b(fc|cf|afc|f\.c\.|c\.f\.|ac|as|ss|sc|sv|vfb|vfl|tsv|fk|rc|ssc|ud|cd|sl|sporting clube de|club|de|calcio|1\.)\b/g, '').replace(/[^a-z0-9]/g, '');
function sameClub(a, b) {
  const cl = s => (s || '').replace(/\s*\(.*?\)/g, '').replace(/\d+(st|nd|rd|th)\b.*$/, '').trim();
  const AL = { internazionale: 'intermilan', inter: 'intermilan', fcinternazionalemilano: 'intermilan', milan: 'acmilan',
               bayernmunchen: 'bayernmunich', bayern: 'bayernmunich', psg: 'parissaintgermain', manutd: 'manchesterunited',
               atletico: 'atleticomadrid', atleticomadridsad: 'atleticomadrid', juve: 'juventus', barca: 'barcelona' };
  const k = s => { const n = norm(cl(s)); return AL[n] || n; };
  const x = k(a), z = k(b);
  if (!x || !z) return false;
  // equal, or one is a prefix of the other (e.g. "manchesterunited" / "manchesterunitedfc"); never "milan" ⊂ "intermilan"
  return x === z || x.startsWith(z) || z.startsWith(x);
}
// league page names per lg code (the career-table division is ambiguous: "First Division" exists in several countries)
const LG_PAGES = {
  EPL: ['Premier League', 'Football League First Division'], LL: ['La Liga'], SA: ['Serie A'], BL: ['Bundesliga'],
  GER: ['Oberliga'], L1: ['Ligue 1', 'French Division 1'], ERE: ['Eredivisie'], POR: ['Primeira Liga', 'Primeira Divisão'],
  SCO: ['Scottish Premiership', 'Scottish Premier League', 'Scottish Premier Division', 'Scottish Division One'],
  BEL: ['Belgian Pro League', 'Belgian First Division A', 'Belgian First Division'], AUT: ['Austrian Football Bundesliga'],
  SUI: ['Swiss Super League', 'Nationalliga A'], TUR: ['Süper Lig', '1.Lig'], GRE: ['Super League Greece', 'Alpha Ethniki'],
  URS: ['Soviet Top League'], RUS: ['Russian Premier League', 'Russian Top Division'], UKR: ['Ukrainian Premier League'],
  YUG: ['Yugoslav First League'], TCH: ['Czechoslovak First League'], HUN: ['Nemzeti Bajnokság I'], POL: ['Ekstraklasa'],
  ROU: ['Divizia A', 'Liga I'], BUL: ['A Group', 'First Professional Football League (Bulgaria)'], DDR: ['DDR-Oberliga'],
  SWE: ['Allsvenskan'], DEN: ['Danish 1st Division', 'Danish Superliga'], NOR: ['Eliteserien', '1. divisjon'],
  BRA: ['Campeonato Brasileiro Série A'], MLS: ['Major League Soccer season'],
};
function leagueChampion(season, div, lg, club) {
  const d = (div || '').replace(/\s*\(.*\)/, '').trim();
  const cands = [...new Set([d, ...(LG_PAGES[lg] || [])].filter(Boolean))];
  for (const nm of cands) {
    for (const s of [season, season.replace(/–(\d\d)$/, (m, a) => '–' + season.slice(0, 2) + a)]) {
      const r = W.rawT(`${s} ${nm}`);
      if (!r.text) continue;
      const ib = W.templates(r.text, /^\s*Infobox (football league season|football tournament season|sports season)/i)[0];
      if (!ib) continue;
      // the page must be the club's league (the club appears in it)
      const links = [...r.text.matchAll(/\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g)].flatMap(m => [m[1], m[2] || '']);
      if (!links.some(l => l && (l === club.link || sameClub(l, club.name) || (club.link && sameClub(l, club.link))))) continue;
      const p = W.params(ib.body);
      let c = p.champions || p.champion || p.winners;
      // empty infobox: 1st in the league table (Pos | Team ...)
      if (!c || !W.strip(c)) {
        for (const g of W.tables(r.text)) {
          const h = (g[0] || []).map(x => x && x.txt || '');
          const pi = h.findIndex(x => /^(Pos|Position|#)\b/i.test(x)), ti = h.findIndex(x => /^(Team|Club)\b/i.test(x));
          if (pi < 0 || ti < 0) continue;
          const row = g.slice(1).find(rw => rw[pi] && /^1\b/.test(rw[pi].txt));
          if (row && row[ti]) { c = row[ti].raw; break; }
        }
      }
      if (c && W.strip(c)) return { page: r.title, name: W.strip(c.replace(/\{\{[^}]*\}\}/g, m => /flagicon|fb/i.test(m) ? '' : m)).replace(/\s*\(.*$/, '') };
    }
  }
  return null;
}

module.exports = { clubWindow, titleFor, seasonBoxes };
