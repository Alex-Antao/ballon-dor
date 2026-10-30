// Trophies and individual awards per row, read from Wikipedia infoboxes and the Golden Shoe winners table.
// Usage: node verify/awards.js [block files...]   (default: every data-src block) → writes the fields into data-src.
//   cup     1 if the player's club won the main domestic cup whose final was in the window (season ending in Y)
//   lgTop   1 if top scorer (shared counts) of the league season ending in the window
//   gs      1 if European Golden Shoe winner for the season ending in the window (awarded since 1967–68)
//   uTop    1 if top scorer of the continental edition in uT (shared counts)
//   ntTop   1 if top scorer of the national-team tournament in ntT (shared counts)
//   ntBest  1 if best player of that tournament (Golden Ball / player of the tournament)
//   awConf  A if every page needed was found, B if some were missing (that award left at 0)
// Pages used are added to `sources`; missing pages are listed in the note ("Awards: ...").
const fs = require('fs');
const path = require('path');
const W = require('./wp.js');
const C = require('./club.js');
const E = require('./eu.js');
const N = require('./nt.js');

const SRC = path.join(__dirname, '..', 'data-src');
const TITLES = JSON.parse(fs.readFileSync(path.join(__dirname, 'titles.json'), 'utf8'));
const url = t => 'https://en.wikipedia.org/wiki/' + encodeURI(t.replace(/ /g, '_'));
const sea = y => y === 2000 ? '1999–2000' : `${y - 1}–${String(y).slice(2)}`;
// leagues played over a calendar year (season named after the year)
const CAL = new Set(['URS', 'RUS', 'BRA', 'ARG', 'SWE', 'NOR', 'MLS', 'CHN', 'PER', 'URU', 'DEN']);
const CUP_PAGES = {
  EPL: ['FA Cup'], EN2: ['FA Cup'], LL: ['Copa del Rey', 'Copa del Generalísimo'], SA: ['Coppa Italia'], ITB: ['Coppa Italia'],
  BL: ['DFB-Pokal'], GER: ['DFB-Pokal'], L1: ['Coupe de France'], ERE: ['KNVB Cup'], POR: ['Taça de Portugal'], SCO: ['Scottish Cup'],
  BEL: ['Belgian Cup'], AUT: ['Austrian Cup'], TUR: ['Turkish Cup'], GRE: ['Greek Football Cup'], URS: ['Soviet Cup'], RUS: ['Russian Cup'],
  UKR: ['Ukrainian Cup'], YUG: ['Yugoslav Cup', 'Marshal Tito Cup'], HUN: ['Magyar Kupa'], BRA: ['Copa do Brasil'], ARG: ['Copa Argentina'],
  DDR: ['FDGB-Pokal'], POL: ['Polish Cup'], ROU: ['Cupa României'], BUL: ['Bulgarian Cup'], TCH: ['Czechoslovak Cup'], CZE: ['Czech Cup'],
  SWE: ['Svenska Cupen'], DEN: ['Danish Cup'], NOR: ['Norwegian Football Cup'], SUI: ['Swiss Cup'], MLS: ['U.S. Open Cup'], KSA: ["King's Cup"],
};
const LG_EXTRA = { EN2: ['Football League Second Division'], ITB: ['Serie B'], CZE: ['Czech First League'], PER: ['Peruvian Primera División'],
                   CHN: ['Chinese Super League'], URU: ['Uruguayan Primera División'], MEX: ['Liga MX'], KSA: ['Saudi Pro League'],
                   ARG: ['Argentine Primera División'], LL: ['La Liga'], SA: ['Serie A'] };
const SCORER_KEYS = /^(league[ _]?top[ _]?scorer|top[ _]?goal[ _]?scorers?|top[ _]?scorers?|topscorers?|league topscorers?|scoring[ _]leaders?|top[ _]scorer\(s\))$/i;
const CHAMP_KEYS = /^(champions?|winners?|champion_other)$/i;

// ---------- names ----------
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const canon = {};
const C_ = t => { t = t.replace(/_/g, ' ').trim(); if (!(t in canon)) { try { canon[t] = W.rawT(t).title; } catch (e) { canon[t] = t; } } return canon[t]; };
const titleOf = (name, y) => (y >= 2000 && TITLES[name + '@2010']) || TITLES[name] || name;
// people mentioned in an infobox value: link targets, link texts, {{sortname}} and plain text
function people(raw) {
  const out = [];
  for (const m of (raw || '').matchAll(/\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g)) out.push({ link: m[1].trim(), text: (m[2] || m[1]).trim() });
  for (const m of (raw || '').matchAll(/\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)(?:\|([^|}]*))?/gi)) out.push({ link: (m[3] || `${m[1]} ${m[2]}`).trim(), text: `${m[1]} ${m[2]}`.trim() });
  if (!out.length) W.strip(raw).split(/,|\/| and |<br\s*\/?>|\n/).forEach(t => { t = t.replace(/\(.*$/, '').trim(); if (t) out.push({ link: null, text: t }); });
  return out;
}
function isPlayer(p, name, y) {
  const want = titleOf(name, y), n = norm(name), nt = norm(p.text);
  if (nt && (nt === n || nt === norm(want.replace(/\s*\(.*\)/, '')))) return true;
  const sur = s => s.split(' ').slice(-1)[0];
  if (nt && sur(nt) === sur(n) && nt.split(' ').length > 1 && nt[0] === n[0]) return true;
  if (p.link && (p.link === want || (norm(p.link).includes(sur(n)) && C_(p.link) === C_(want)))) return true;
  return false;
}

// ---------- pages ----------
function infobox(title) {
  const r = W.rawT(title);
  if (!r.text || r.text.length < 500) return null;
  const ib = W.templates(r.text, /^\s*Infobox/i)[0];
  return ib ? { title: r.title, p: W.params(ib.body) } : null;
}
function seasonPage(names, y, cal) {
  const tries = [];
  for (const nm of names) {
    if (cal) tries.push(`${y} ${nm}`);
    tries.push(`${sea(y)} ${nm}`, `${y - 1}–${y} ${nm}`, `${y} ${nm}`);
  }
  for (const t of [...new Set(tries)]) { const ib = infobox(t); if (ib) return ib; }
  return null;
}
const field = (ib, re) => Object.entries(ib.p).filter(([k]) => re.test(k.trim())).map(([, v]) => v).join(' ');

let shoe = null;
function goldenShoe() {
  if (shoe) return shoe;
  const t = W.raw('European Golden Shoe'), k = t.indexOf('== Winners');
  shoe = {};
  for (const g of W.tables(t.slice(k))) for (const row of g) {
    const s = row[0] && (row[0].txt.match(/^(\d{4})[–-](\d{2,4})/) || []);
    if (!s.length) continue;
    const y = +s[1] + 1;
    (shoe[y] = shoe[y] || []).push(...people(row[1] && row[1].raw));
  }
  return shoe;
}

// ---------- per row ----------
function awards(r, y, win) {
  const o = { cup: 0, lgTop: 0, gs: 0, uTop: 0, ntTop: 0, ntBest: 0 }, src = [], miss = [];
  // "Club A / Club B": in a calendar year A is the spring club (cup finals are in spring); in a season B is where it ended
  const all = r.club.split(/\s*\/\s*/), clubs = all.length > 1 ? [win === 'P' ? all[all.length - 1] : all[0]] : all;
  // league top scorer
  const lgNames = [...new Set([...(C.LG_PAGES[r.lg] || []), ...(LG_EXTRA[r.lg] || [])])];
  const lp = lgNames.length && seasonPage(lgNames, y, CAL.has(r.lg));
  if (lp) { src.push(url(lp.title)); o.lgTop = people(field(lp, SCORER_KEYS)).some(p => isPlayer(p, r.name, y)) ? 1 : 0; if (!field(lp, SCORER_KEYS)) miss.push('league top scorer'); }
  else miss.push('league season page');
  // domestic cup
  const cp = CUP_PAGES[r.lg] && seasonPage(CUP_PAGES[r.lg], y, CAL.has(r.lg));
  if (cp) {
    src.push(url(cp.title));
    const w = field(cp, CHAMP_KEYS);
    const names = people(w).flatMap(p => [p.text, p.link]).filter(Boolean);
    o.cup = names.some(n => clubs.some(c => C.sameClub(n, c))) ? 1 : 0;
    if (!w) miss.push('cup winner');
  } else if (CUP_PAGES[r.lg]) miss.push('cup page');
  // European Golden Shoe (since 1967–68; none awarded 1991–1996)
  if (y >= 1968) { const gs = goldenShoe()[y] || []; o.gs = gs.some(p => isPlayer(p, r.name, y)) ? 1 : 0; src.push(url('European Golden Shoe')); }
  // continental top scorer
  if (r.uT) {
    const eds = (E.editions(sea(y), y)[r.uT] || []);
    let ed = null;
    for (const t of eds) { ed = infobox(t); if (ed) break; }
    if (ed) { src.push(url(ed.title)); o.uTop = people(field(ed, /^top[ _]?scorers?$/i)).some(p => isPlayer(p, r.name, y)) ? 1 : 0; }
    else miss.push('continental edition page');
  }
  // national-team tournament: top scorer and best player
  if (r.ntT) {
    let tp = null;
    for (const t of N.tourTitle(r.ntT, y, win) || []) { tp = infobox(t); if (tp) break; }
    if (tp) {
      src.push(url(tp.title));
      o.ntTop = people(field(tp, /^top[ _]?scorers?$/i)).some(p => isPlayer(p, r.name, y)) ? 1 : 0;
      const best = field(tp, /^(player|best[ _]player|player of the tournament|golden[ _]ball)$/i);
      o.ntBest = people(best).some(p => isPlayer(p, r.name, y)) ? 1 : 0;
      if (!best) miss.push('tournament best player');
    } else miss.push('tournament page');
  }
  return { o, src, miss };
}

function run() {
  const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f)).sort();
  let n = 0;
  const counts = { cup: 0, lgTop: 0, gs: 0, uTop: 0, ntTop: 0, ntBest: 0, B: 0 };
  for (const f of files) {
    const F = path.join(SRC, f), text = fs.readFileSync(F, 'utf8');
    const ind = (/^\{\r?\n( +)/.exec(text) || [0, ' '])[1].length, blk = JSON.parse(text);
    for (const [ys, Y] of Object.entries(blk)) {
      const y = +ys;
      for (const r of Y.rows) {
        let res;
        try { res = awards(r, y, Y.window); } catch (e) { res = { o: { cup: 0, lgTop: 0, gs: 0, uTop: 0, ntTop: 0, ntBest: 0 }, src: [], miss: ['error: ' + e.message] }; }
        Object.assign(r, res.o);
        r.awConf = res.miss.length ? 'B' : 'A';
        r.sources = [...new Set([...(r.sources || []), ...res.src])];
        r.note = (r.note || '').replace(/\s*Awards: [^]*?\.(?= |$)/, '').trim();
        if (res.miss.length) r.note = (r.note ? r.note + ' ' : '') + 'Awards: not found on Wikipedia: ' + res.miss.join(', ') + '.';
        for (const k in res.o) counts[k] += res.o[k];
        if (res.miss.length) counts.B++;
        n++;
      }
      console.log(ys, Y.rows.filter(r => r.cup || r.lgTop || r.gs || r.uTop || r.ntTop || r.ntBest).map(r => `${r.name} [${['cup', 'lgTop', 'gs', 'uTop', 'ntTop', 'ntBest'].filter(k => r[k]).join(' ')}]`).join('; '));
    }
    // field order as in the SPEC
    const ORDER = ['name', 'club', 'lg', 'pos', 'gp', 'g', 'a', 'uT', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntT', 'ntS', 'title',
                   'cup', 'lgTop', 'gs', 'uTop', 'ntTop', 'ntBest', 'cont', 'rank', 'elig', 'win', 'conf', 'aConf', 'awConf', 'sources', 'note'];
    for (const Y of Object.values(blk)) Y.rows = Y.rows.map(r => { const o = {}; for (const k of ORDER) if (k in r) o[k] = r[k]; for (const k in r) if (!(k in o)) o[k] = r[k]; return o; });
    fs.writeFileSync(F, JSON.stringify(blk, null, ind) + '\n');
  }
  console.log(`${n} rows:`, counts);
}

module.exports = { awards, titleOf, isPlayer, people };
if (require.main === module) run();
