// Applies the proposals (verify/work/prop/<year>.json) to data-src, with the confidence rules from the SPEC.
// Usage: node apply.js <block file> [years...]
// Manual overrides in verify/overrides.json: { "year": { "name": { field: value, ..., "_note": "...", "_skip": ["g", ...] } } }
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', 'data-src') + '/';
const [file, ...only] = process.argv.slice(2);
const F = REPO + file;
const SRC = fs.readFileSync(F, 'utf8');
const IND = (/^\{\r?\n( +)/.exec(SRC) || [0, ' '])[1].length;
const blk = JSON.parse(SRC);
const D = __dirname;
const OV = fs.existsSync(path.join(D, 'overrides.json')) ? JSON.parse(fs.readFileSync(path.join(D, 'overrides.json'))) : {};
// first-pass boilerplate that a verified row no longer needs
const BOILER = [/Statistics from memory[^.]*?\([^)]*\)\.\s*/g, /Statistics from memory, NOT verified on the web\.?\s*/g,
                /\s*\(WebFetch blocked[^)]*\)/g];
const rank = c => ({ A: 3, B: 2, C: 1 })[c];
const minC = (...cs) => cs.reduce((a, b) => rank(a) <= rank(b) ? a : b);
let changed = 0;

for (const [ys, Y] of Object.entries(blk)) {
  if (only.length && !only.includes(ys)) continue;
  const pf = path.join(__dirname, 'work', 'prop', ys + '.json');
  if (!fs.existsSync(pf)) continue;
  const props = JSON.parse(fs.readFileSync(pf));
  const ov = OV[ys] || {};
  for (const r of Y.rows) {
    const P = props.find(p => p.name === r.name);
    if (!P) continue;
    const o = ov[r.name] || {};
    const skip = new Set(o._skip || []);
    const msgs = [];
    const set = (k, v, why) => { if (skip.has(k) || v == null) return; if (r[k] !== v) { msgs.push(`${k} ${r[k]}→${v}`); r[k] = v; changed++; } };
    let cClub = null, cNt = null, cTit = null;
    const P_ = Y.window === 'P';
    // career table without a Europe column and a player with European games: cannot be separated → left as it was
    const euGap = P.noEu && (r.uT || (P.set.uT && P.set.uT !== ''));
    if (P.seasons && P.clubOk !== false && !o._noClub && !euGap) {
      set('gp', P.set.gp); set('g', P.set.g); set('uG', P.set.uG);
      if (P.sMode) { cClub = 'C'; r.win = 'S'; }
      else { cClub = P_ ? 'A' : 'B'; r.win = P_ ? 'P' : 'CY'; }
    }
    if (P.set.ntS != null && r.ntT && !o._noNt) {
      // no line-ups for every game: games = the larger of the counted and the previous value, capped at the team's games
      if (P.ntLineups) set('ntGP', P.set.ntGP);
      else set('ntGP', Math.min(Math.max(P.set.ntGP, r.ntGP), P.ntTeamGames || 99));
      set('ntG', P.set.ntG);
      // formats with a second group/league stage: the stage stays manual (scale by distance to the final)
      const yy = +ys, odd = (r.ntT === 'WC' && [1974, 1978, 1982].includes(yy)) || (r.ntT === 'EURO' && yy === 1980) || (r.ntT === 'COPA' && yy < 1993);
      if (!odd) set('ntS', P.set.ntS);
      cNt = P.ntLineups ? 'A' : 'B';
    } else if (!r.ntT) cNt = 'A';
    if (P.set.title != null && !o._noTitle) { set('title', P.set.title); cTit = 'A'; }
    // continental competition/stage
    let cU = null;
    // (from the edition page in any year; from the matches on the season page only since 2006)
    if (P.uOk && (P.uSrc !== 'season' || +ys >= 2006) && !o._noU) { set('uT', P.set.uT); set('uS', P.set.uS); cU = 'A'; }
    else if (P.uRounds && !P.uRounds.length && cClub && !r.uS) { cU = 'A'; }
    if (o._uOk) cU = 'A';
    if (o._ntOk) cNt = 'A';
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) set(k, v);
    // confidence = weakest component (unverified → C)
    const conf = cClub ? minC(cClub, cNt || 'C', cTit || (o._titleOk ? 'A' : 'C'), cU || 'C') : 'C';
    if (o.conf) r.conf = o.conf; else r.conf = r.win === 'S' ? 'C' : conf;
    r.sources = [...new Set([...(r.sources || []), ...P.src])];
    let note = r.note || '';
    for (const b of BOILER) note = note.replace(b, '');
    note = note.replace(/\s*Second pass[^]*$/, '').trim();
    // first-pass sentences that stop being true once the club has been verified
    if (cClub) note = note.replace(/[^.]*(NOT verified|from memory, NOT)[^.]*\.\s*/g, '').trim();
    const extra = [];
    const inc = (P.issues || []).filter(i => /incomplete/.test(i)).map(i => i.replace(/: season page.*$/, ''));
    const miss50 = (P.issues || []).filter(i => /split estimated at 50%\)$/.test(i) && /no season page/.test(i)).map(i => i.replace(/: no season page.*$/, ''));
    if (cClub && P.sMode) extra.push('league + Europe for the season ending in the year, from the career table (no season pages with matches to split the calendar year: win S)');
    else if (cClub) extra.push(P_ ? 'league + Europe from the career table (season)' : `season totals from the career table; calendar-year goals counted match by match on the season pages${inc.length ? ` (incomplete page for ${inc.join(', ')}: split estimated at 50%)` : ''}${miss50.length ? ` (no match page for ${miss50.join(', ')}: half of the totals)` : ''}${!inc.length && !miss50.length && !P.gExact ? ' (small mismatch with the career table; scaled)' : ''}; games estimated from the share of the club's games in the year`);
    else if (euGap) extra.push('club numbers unchanged: the career table does not separate European games');
    else extra.push('club statistics not verified (no usable career table)');
    if (cNt === 'A' && r.ntT) extra.push('national team counted from the Wikipedia line-ups');
    if (cTit) extra.push('title from the league page');
    if (cU === 'A' && P.uOk && !o._noU) extra.push('continental competition/stage ' + (P.uSrc === 'edition' ? `from the edition page (${P.euEd.edition}: ${P.euEd.reached})` : P.uSrc === 'season' ? 'from the matches on the season page' : `verified: ${P.uSrc}`));
    const miss = [!cClub && 'club', r.ntT && cNt !== 'A' && cNt !== 'B' && 'national team', !cTit && !o._titleOk && 'title', !cU && 'European stage'].filter(Boolean);
    if (miss.length) extra.push('to verify: ' + miss.join(', '));
    if (o._note) extra.push(o._note);
    r.note = (note ? note + ' ' : '') + 'Second pass: ' + extra.join('; ') + '.' + (msgs.length ? ' Changed: ' + msgs.join(', ') + '.' : '');
  }
}
// field order as in the SPEC
const ORDER = ['name', 'club', 'lg', 'pos', 'gp', 'g', 'a', 'uT', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntT', 'ntS',
               'title', 'cont', 'rank', 'elig', 'win', 'conf', 'aConf', 'sources', 'note'];
for (const Y of Object.values(blk)) Y.rows = Y.rows.map(r => {
  const o = {};
  for (const k of ORDER) if (k in r) o[k] = r[k];
  for (const k in r) if (!(k in o)) o[k] = r[k];
  return o;
});
fs.writeFileSync(F, JSON.stringify(blk, null, IND) + '\n');
console.log('changes:', changed);
