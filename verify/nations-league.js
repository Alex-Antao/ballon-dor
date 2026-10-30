// UEFA Nations League Finals (final four: June 2019, Oct 2021, June 2023, June 2025) per row, read from the line-ups and
// goals in the match boxes of the Finals page and its match pages (verify/nt.js).
// Usage: node verify/nations-league.js [--write]   → prints what it finds; --write puts nlGP/nlG/nlS into data-src.
//   nlGP/nlG  games/goals in the Finals (assists are not collected)
//   nlS       stage of the player's team: 3 semi-final (incl. the third-place match), 4 lost final, 5 winner
// Only rows of players who played in the Finals get the fields; the page is added to `sources`.
const fs = require('fs');
const path = require('path');
const N = require('./nt.js');
const A = require('./awards.js');

const SRC = path.join(__dirname, '..', 'data-src');
const YEARS = [2019, 2021, 2023, 2025];
const url = t => 'https://en.wikipedia.org/wiki/' + encodeURI(t.replace(/ /g, '_'));
const write = process.argv.includes('--write');

for (const f of fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f))) {
  const file = path.join(SRC, f), text = fs.readFileSync(file, 'utf8'), blk = JSON.parse(text);
  const indent = (text.match(/^\{\r?\n( +)"/) || [, '  '])[1].length;   // keep each block's own indentation
  let changed = false;
  for (const [y, Y] of Object.entries(blk)) {
    if (!YEARS.includes(+y)) continue;
    for (const r of Y.rows) {
      const s = N.ntStats(A.titleOf(r.name, +y), 'NL', +y, r.win);
      if (s.issue) { console.log(`${y} ${r.name}: ${s.issue}`); continue; }
      if (!s.apps && !s.goals) continue;
      const stage = Math.max(3, s.stage);   // every team in the Finals reached the semi-finals
      console.log(`${y} ${r.name} (${s.team}): ${s.apps} games, ${s.goals} goals, stage ${stage}`);
      if (!write) continue;
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        if (['nlGP', 'nlG', 'nlS'].includes(k)) continue;
        out[k] = v;
        if (k === 'ntS') Object.assign(out, { nlGP: s.apps, nlG: s.goals, nlS: stage });
      }
      if (!(out.sources || []).includes(url(s.main))) out.sources = [...(out.sources || []), url(s.main)];
      Object.keys(r).forEach(k => delete r[k]); Object.assign(r, out);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(blk, null, indent) + '\n');
}
