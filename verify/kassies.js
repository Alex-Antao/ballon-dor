// UEFA club ranking (5-year club coefficients) per season, read from Bert Kassies' database (kassiesa.net/uefa),
// which recomputes every ranking since 1960 with the method of its time. Pages cached in verify/work/kassies.
const W = require('./wp.js');
const fs = require('fs');
const path = require('path');
const CACHE = path.join(__dirname, 'work', 'kassies');
fs.mkdirSync(CACHE, { recursive: true });

// Ranking after the season ending in y (the one UEFA uses for the draws of the next season)
const method = y => y <= 1998 ? 1 : y <= 2003 ? 2 : y <= 2008 ? 3 : y <= 2017 ? 4 : 5;
const FIRST = 1960;
function page(y) {
  const f = path.join(CACHE, `trank${y}.html`);
  // the ranking of a season still being played changes after every round: re-read it after a day
  const fresh = fs.existsSync(f) && (y < new Date().getFullYear() - 1 || Date.now() - fs.statSync(f).mtimeMs < 864e5);
  if (fresh) return fs.readFileSync(f, 'utf8');
  const h = W.get(`https://kassiesa.net/uefa/data/method${method(y)}/trank${y}.html`);
  if (h) fs.writeFileSync(f, h);
  return h;
}

// Club name → comparable key: no accents, no club-type words ("FC", "AC", "Calcio"...)
const STOP = new Set(['fc', 'cf', 'ac', 'afc', 'sc', 'sv', 'fk', 'sk', 'cd', 'ud', 'rc', 'rcd', 'as', 'ss', 'ssc', 'us', 'bv', 'jk', 'ik', 'if',
  'nk', 'hnk', 'gnk', 'pfc', 'kv', 'krc', 'rsc', 'sl', 'cp', 'calcio', 'club', 'de', 'del', 'des', 'du', 'the', 'football', 'futbol', 'clube', 'and']);
const LATIN = { ł: 'l', Ł: 'l', ø: 'o', Ø: 'o', æ: 'ae', Æ: 'ae', đ: 'd', Đ: 'd', ı: 'i', ß: 'ss', œ: 'oe' };
const words = s => (s || '').replace(/[łŁøØæÆđĐıßœ]/g, ch => LATIN[ch]).normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()
  .replace(/\(.*?\)/g, '').split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w));
// Wikipedia name → name in the ranking, where the words alone do not match
const ALIAS = {
  'bayern munich': 'bayern munchen', 'inter milan': 'internazionale', 'inter': 'internazionale', 'dynamo kyiv': 'dinamo kiev',
  'dynamo kiev': 'dinamo kiev', 'crvena zvezda': 'red star belgrade', 'fcsb': 'steaua bucuresti', 'cologne': 'koln', 'nuremberg': 'nurnberg',
  'munich 1860': '1860 munchen', 'tsv 1860 munich': '1860 munchen', 'sporting': 'sporting lisbon', 'dynamo moscow': 'dinamo moscow',
  'partizan': 'partizan belgrade', 'rapid vienna': 'rapid wien', 'austria vienna': 'austria wien', 'austria memphis': 'austria wien',
  'legia warsaw': 'legia warszawa', 'olympiacos': 'olympiakos piraeus', 'sparta prague': 'sparta praha', 'slavia prague': 'slavia praha',
  'dukla prague': 'dukla praha', 'bohemians prague': 'bohemians praha', 'rangers': 'glasgow rangers', 'hamburg': 'hamburger', 'grasshopper': 'grasshoppers zurich',
  'ob': 'ob odense', 'boldklubben 1909': 'b1909 odense', 'b 1903': 'b1903 kobenhavn', 'vb': 'vejle bk', 'swarovski tirol': 'tirol innsbruck',
  'ujpesti dozsa': 'ujpest dozsa', 'wiener sport': 'wiener sportklub', 'progres niedercorn': 'progres niederkorn', 'cervena hviezda bratislava': 'red star bratislava',
  'vorwarts berlin': 'vorwarts frankfurt', 'lahden reipas': 'reipas lahti', 'diosgyori vtk': 'diosgyori miskolc', 'vitoria s c': 'vitoria guimaraes', 'zenit saint petersburg': 'zenit st petersburg',
  'vitoria guimaraes': 'vitoria guimaraes', 'st gallen': 'sankt gallen', 'copenhagen': 'kobenhavn', 'casino salzburg': 'austria salzburg',
  'kispest honved': 'honved budapest', 'oster': 'osters', 'vitosha sofia': 'levski sofia', 'cska red flag': 'cska sofia', 'gak': 'grazer ak',
  'tatabanyai banyasz': 'tatabanya', 'tj skoda plzen': 'viktoria plzen', 'halmstad': 'halmstads bk', 'espanol': 'espanyol',
  'ib vestmannaeyja': 'ibv vestmannaeyjar', 'vidi': 'videoton fehervar', 'uta arad': 'ut arad',
};
const key = s => { const w = words(s).join(' '); return words(ALIAS[w] || w).join(' '); };

const tables = {};
// Every club of the ranking after the season ending in y: [{ name, ctry, coef }], ranked; plus the country floors (2018+)
function ranking(y) {
  y = Math.max(FIRST, y);
  if (tables[y]) return tables[y];
  const h = page(y) || '';
  const clubs = [], floor = {};
  for (const m of h.matchAll(/<tr class="(clubline|countryline)[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...m[2].matchAll(/<t[dh]([^>]*)>([\s\S]*?)<\/t[dh]>/g)].map(x => ({ cls: x[1], txt: x[2].replace(/<[^>]+>/g, '').trim() }));
    const nums = c.map(x => parseFloat(x.txt)).filter((v, i) => !isNaN(v) && /\./.test(c[i].txt));
    if (m[1] === 'countryline') continue;
    const ni = c.findIndex(x => /aleft/.test(x.cls)) >= 0 ? c.findIndex(x => /aleft/.test(x.cls)) : 1;
    // methods 1–4: the last column is the ranking value; method 5: max(total points, 20% of the country coefficient)
    const coef = method(y) === 5 ? Math.max(nums[nums.length - 2] || 0, nums[nums.length - 1] || 0) : nums[nums.length - 1];
    if (c[ni] && coef != null) clubs.push({ name: c[ni].txt, ctry: c[ni + 1] ? c[ni + 1].txt : '', coef, key: key(c[ni].txt) });
    if (method(y) === 5 && c[ni + 1]) floor[c[ni + 1].txt] = nums[nums.length - 1];
  }
  clubs.sort((a, b) => b.coef - a.coef);
  return (tables[y] = { y, clubs, floor });
}

// Club in a ranking: same key, else every word of the shorter name in the longer one (only when unique)
function find(rk, team) {
  const k = key(team);
  if (!k) return null;
  const eq = rk.clubs.filter(c => c.key === k);
  if (eq.length === 1) return eq[0];
  const kw = k.split(' ');
  const sub = rk.clubs.filter(c => { const cw = c.key.split(' '); const [a, b] = kw.length <= cw.length ? [kw, cw] : [cw, kw]; return a.every(w => b.includes(w)); });
  return sub.length === 1 ? sub[0] : null;
}

// Strength of an opponent in a European match of the season ending in s, relative to a typical Champions League club
// (the 32nd of the ranking used for that season's draws, as many clubs as a Champions League group stage, so that the
// average Champions League goal of the candidates is worth about 1): sqrt of the ratio, kept within 0.3–2.
// A club missing from that ranking (no European points in the previous five years) gets its country's floor (2018+) or
// the lowest value of the table, when a ranking within ten years confirms the name; otherwise null.
const REF_RANK = 32, MIN_F = 0.3, MAX_F = 2;
function strength(team, s) {
  const rk = ranking(s - 1), ref = rk.clubs[REF_RANK - 1].coef;
  let c = find(rk, team);
  if (!c) {
    const near = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(d => [s - 1 + d, s - 1 - d]).filter(y => y >= FIRST && y <= new Date().getFullYear() + 1);
    let nx = null;
    for (const y of near) if ((nx = find(ranking(y), team))) break;
    if (!nx) return null;
    c = { name: nx.name, coef: rk.floor[nx.ctry] ?? rk.clubs[rk.clubs.length - 1].coef, debut: true };
  }
  return { name: c.name, coef: c.coef, ref, f: Math.min(MAX_F, Math.max(MIN_F, Math.sqrt(c.coef / ref))), debut: !!c.debut };
}

module.exports = { ranking, find, strength, key, REF_RANK, MIN_F, MAX_F };
