// Strength of the opponents of each row's continental goals (UEFA competitions), for the Fair and Custom models.
// Usage: node verify/opponents.js [years...] [--write]  → prints what it finds; --write puts uOpp/uOppN into data-src.
//   uOpp   mean strength of the opponents the player scored against (verify/kassies.js: sqrt of the opponent's UEFA
//          club coefficient over that of the 32nd club, 0.3–2). With no goal found, the mean over
//          the club's matches in the window (the assists, whose opponents are unknown, take the same value).
//   uOppN  goals matched to an opponent (0 = the club's matches were used)
// Matches come from the match boxes of the edition pages and their sub-pages (groups, knockout phase, final);
// qualifying rounds do not count (SPEC). Window CY: matches played in the year, from the editions ending in Y and Y+1;
// window P: the editions ending in Y. Opponents missing from every ranking are left out and listed.
const fs = require('fs');
const path = require('path');
const W = require('./wp.js');
const E = require('./eu.js');
const K = require('./kassies.js');
const { sameClub } = require('./club.js');
const A = require('./awards.js');

const SRC = path.join(__dirname, '..', 'data-src');
const UEFA = ['UCL', 'CWC', 'UEL', 'ECL'];
const url = t => 'https://en.wikipedia.org/wiki/' + encodeURI(t.replace(/ /g, '_'));
const args = process.argv.slice(2), write = args.includes('--write'), only = args.filter(a => /^\d{4}$/.test(a)).map(Number);
const yy = y => String(y).slice(2);

// Every match of an edition: the page, its sub-pages ({{main}}/{{further}} links with the same season) and the final
const edCache = {};
function editionMatches(title) {
  if (edCache[title]) return edCache[title];
  const r = W.rawT(title);
  if (!r.text) return (edCache[title] = { title: null, ms: [] });
  const season = r.title.match(/^\d{4}[–-]\d{2}/)[0];
  const subs = new Set([r.title, r.title + ' final']);
  for (const m of r.text.matchAll(/\{\{\s*(?:main|further|see also)\s*\|([^}]*)\}\}/gi))
    for (const t of m[1].split('|').map(x => x.trim())) if (t.startsWith(season) && !/qualif|=/i.test(t)) subs.add(t.replace(/#.*/, ''));
  const seen = new Set(), ms = [];
  for (const t of subs) {
    const p = W.rawT(t);
    if (!p.text) continue;
    for (const m of W.matches(p.title)) {
      if (/qualif/i.test(m.ctx + ' ' + m.round) || !m.team1 || !m.team2) continue;
      const k = m.date + '|' + m.team1 + '|' + m.team2;
      if (seen.has(k)) continue;
      seen.add(k); ms.push({ ...m, page: p.title });
    }
  }
  return (edCache[title] = { title: r.title, ms });
}

// Link target of a scorer = the player's page?
const linkCache = {};
function samePlayer(link, title) {
  if (link === title) return true;
  const last = title.replace(/\s*\(.*\)/, '').split(' ').pop();
  if (!link.includes(last)) return false;
  if (!(link in linkCache)) linkCache[link] = W.rawT(link).title;
  return linkCache[link] === title;
}

// Club names in the data that differ from the name in the match boxes
const CLUB = {
  'Man City': 'Manchester City', Lyon: 'Olympique Lyonnais', 'Stade de Reims': 'Reims', Verona: 'Hellas Verona',
};
function rowOpponents(r, y, win) {
  const title = A.titleOf(r.name, y), clubs = r.club.split(' / ').flatMap(c => CLUB[c] ? [c, CLUB[c]] : [c]);
  const ends = win === 'P' ? [y] : [y, y + 1];
  const goals = [], games = [], unknown = new Set(), pages = new Set();
  for (const e of ends) {
    const eds = E.editions(`${e - 1}–${yy(e)}`, e);
    for (const c of UEFA) for (const t of eds[c] || []) {
      const ed = editionMatches(t);
      for (const m of ed.ms) {
        if (win !== 'P' && m.year !== y) continue;
        const side = clubs.some(c => sameClub(m.team1, c)) ? 1 : clubs.some(c => sameClub(m.team2, c)) ? 2 : 0;
        if (!side) continue;
        const opp = side === 1 ? m.team2 : m.team1;
        const st = K.strength(opp, e);
        if (!st) { unknown.add(opp); continue; }
        pages.add(ed.title);
        games.push(st.f);
        const sc = W.scorers(side === 1 ? m.goals1 : m.goals2);
        for (const [who, n] of Object.entries(sc)) if (samePlayer(who, title)) for (let i = 0; i < n; i++) goals.push({ opp: st.name, f: st.f });
      }
    }
  }
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const uOpp = goals.length ? mean(goals.map(g => g.f)) : mean(games);
  return { uOpp: uOpp == null ? null : Math.round(uOpp * 100) / 100, uOppN: goals.length, games: games.length, goals, unknown: [...unknown], pages: [...pages] };
}

const summary = { rows: 0, set: 0, none: 0, byComp: {}, goalDiff: [] };
for (const f of fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f))) {
  const file = path.join(SRC, f), text = fs.readFileSync(file, 'utf8'), blk = JSON.parse(text);
  const indent = (text.match(/^\{\r?\n( +)"/) || [, '  '])[1].length;
  let changed = false;
  for (const [y, Y] of Object.entries(blk)) {
    if (only.length && !only.includes(+y)) continue;
    for (const r of Y.rows) {
      if (!UEFA.includes(r.uT) || !(r.uG + r.uA > 0)) continue;
      summary.rows++;
      const o = rowOpponents(r, +y, Y.window === 'P' ? 'P' : 'CY');
      const note = o.uOpp == null ? 'no match found' : `${o.uOpp.toFixed(2)} from ${o.uOppN ? o.uOppN + ' goal(s)' : o.games + ' club match(es)'}`;
      console.log(`${y} ${r.name} (${r.uT}, uG ${r.uG}): ${note}${o.uOppN && o.uOppN !== r.uG ? ` [boxes ${o.uOppN} goals]` : ''}${o.unknown.length ? ' | not ranked: ' + o.unknown.join(', ') : ''}`);
      if (o.uOpp == null) { summary.none++; continue; }
      summary.set++;
      (summary.byComp[r.uT] = summary.byComp[r.uT] || []).push(o.uOpp);
      if (o.uOppN) summary.goalDiff.push(o.uOppN - r.uG);
      if (!write) continue;
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        if (['uOpp', 'uOppN'].includes(k)) continue;
        out[k] = v;
        if (k === 'uS') Object.assign(out, { uOpp: o.uOpp, uOppN: o.uOppN });
      }
      for (const p of o.pages) if (!(out.sources || []).includes(url(p))) out.sources = [...(out.sources || []), url(p)];
      Object.keys(r).forEach(k => delete r[k]); Object.assign(r, out);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(blk, null, indent) + '\n');
}
const avg = xs => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2);
console.log(`\n${summary.rows} rows with UEFA goals/assists: ${summary.set} set, ${summary.none} without matches`);
for (const [c, xs] of Object.entries(summary.byComp)) console.log(`  ${c}: ${xs.length} rows, mean uOpp ${avg(xs)}`);
const d = summary.goalDiff;
console.log(`  goals in the boxes vs uG: equal ${d.filter(x => x === 0).length}, fewer ${d.filter(x => x < 0).length}, more ${d.filter(x => x > 0).length}`);
