// Name in data-src → English Wikipedia title with {{Infobox football biography}}.
const W = require('./wp.js');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SRC = path.join(__dirname, '..', 'data-src');
const names = [...new Set(fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f))
  .flatMap(f => Object.values(JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))).flatMap(Y => Y.rows.map(r => r.name))))];
const outF = path.join(__dirname, 'titles.json');
const out = fs.existsSync(outF) ? JSON.parse(fs.readFileSync(outF)) : {};
const isFb = t => !/\{\{\s*(disambig|hndis)/i.test(t) && /\{\{\s*Infobox (football|soccer) biography/i.test(t);
const canonical = t => W.rawT(t).title;
function search(q) {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=8&format=json`;
  try { return JSON.parse(W.get(url))[1]; } catch (e) { return []; }
}
for (const n of names) {
  if (out[n]) continue;
  let t = null;
  const tries = [n, n + ' (footballer)'];
  for (const c of tries) { const r = W.raw(c); if (r && isFb(r)) { t = canonical(c); break; } }
  if (!t) for (const c of search(n + ' footballer').concat(search(n))) { if (isFb(W.raw(c))) { t = canonical(c); break; } }
  out[n] = t || '?';
  console.log(n, '→', out[n]);
  fs.writeFileSync(outF, JSON.stringify(out, null, 1));
}
