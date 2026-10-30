// Lists large differences between the proposals and data-src (for manual review).
// Usage: node big.js <block> [years...]
const fs = require('fs');
const path = require('path');
const [file, ...only] = process.argv.slice(2);
const blk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data-src', file), 'utf8'));
for (const [ys, Y] of Object.entries(blk)) {
  if (only.length && !only.includes(ys)) continue;
  const pf = path.join(__dirname, 'work', 'prop', ys + '.json');
  if (!fs.existsSync(pf)) continue;
  const props = JSON.parse(fs.readFileSync(pf));
  for (const r of Y.rows) {
    const P = props.find(p => p.name === r.name);
    if (!P) continue;
    const flags = [];
    const d = (k, lim) => { const v = P.set[k]; if (v != null && Math.abs(v - r[k]) >= lim) flags.push(`${k} ${r[k]}→${v}`); };
    d('gp', 8); d('g', 5); d('uG', 3); d('ntG', 2); d('ntS', 1); d('title', 1); d('uS', 1); d('ntGP', 2);
    if (P.set.uT != null && P.set.uT !== r.uT) flags.push(`uT ${r.uT}→${P.set.uT}`);
    const st = !P.seasons ? 'NO-CLUB' : P.clubOk === false ? 'incomplete-club' : '';
    if (flags.length || st) console.log(ys, r.name.padEnd(22), st, flags.join(', '), P.issues.filter(i => !/table goals/.test(i)).join(' | ').slice(0, 120));
  }
}
