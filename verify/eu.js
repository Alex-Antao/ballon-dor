// Fase atingida por um clube numa edição europeia, lida na página da edição (distância à final).
const W = require('./wp.js');

const ROUND = /preliminary|qualifying|first round|second round|third round|fourth round|round of 32|round of 16|eighth|last 16|last 32|play-off round|knockout round play-offs|group stage|first group|second group|^group [a-h]$|quarter|semi|^finals?$/i;
const SKIP = /bracket|goalscorer|scorer|statistic|seed|draw|team|distribution|ranking|notes|references|see also|external|leg$|replay|^play-off$|venue|format|prize|squad/i;

function editions(season, y) {
  // season "2000–01"; y = ano em que termina
  const s = season;
  const out = { UCL: [y <= 1992 ? `${s} European Cup` : `${s} UEFA Champions League`],
                CWC: y <= 1999 ? [`${s} UEFA Cup Winners' Cup`, `${s} European Cup Winners' Cup`] : [],
                UEL: y <= 1971 ? [`${s} Inter-Cities Fairs Cup`] : y <= 2009 ? [`${s} UEFA Cup`] : [`${s} UEFA Europa League`],
                ECL: y >= 2022 ? [`${s} UEFA Europa Conference League`, `${s} UEFA Conference League`] : [],
                LIB: y >= 1960 ? [`${y} Copa Libertadores`] : [] };
  return out;
}

// Secções de ronda, por ordem, com o texto de cada uma (subpáginas {{main|...}} expandidas no lugar)
function roundSections(title, depth = 0) {
  const r = W.rawT(title);
  if (!r.text || r.text.length < 1500) return [];
  const t = r.text;
  const hs = [...t.matchAll(/^(={2,4})\s*(.*?)\s*\1\s*$/gm)].map(m => ({ at: m.index, end: m.index + m[0].length, lvl: m[1].length, txt: W.strip(m[2]) }));
  const out = [];
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    // fim da secção = próximo cabeçalho de nível <= h.lvl
    let j = i + 1; while (j < hs.length && hs[j].lvl > h.lvl) j++;
    const body = t.slice(h.end, j < hs.length ? hs[j].at : t.length);
    const main = (body.match(/\{\{\s*main\s*\|\s*([^|}#]+)/i) || [])[1];
    if (/knockout (phase|stage)|final phase|final stage/i.test(h.txt) && main && depth === 0) {
      const sub = roundSections(main.trim(), 1);
      if (sub.length) { out.push(...sub); i = j - 1; continue; }
    }
    if (SKIP.test(h.txt) || !ROUND.test(h.txt)) continue;
    let txt = body;
    // fase de grupos / final noutra página
    if (main && (/group/i.test(h.txt) || /^finals?$/i.test(h.txt) || body.length < 1500)) txt += W.raw(main.trim()).slice(0, 1e7);
    for (const m of body.matchAll(/\{\{\s*(?::|#lst:|#section-h:)([^|}#]+)/gi)) txt += W.raw(m[1].trim()).slice(0, 8000);
    // "Group A" pertence à fase de grupos que a contém
    let name = h.txt;
    if (/^group [a-h]$/i.test(h.txt)) {
      const par = [...hs.slice(0, i)].reverse().find(x => x.lvl < h.lvl && ROUND.test(x.txt) && !/^group [a-h]$/i.test(x.txt));
      name = par ? par.txt : 'Group stage';
    }
    const prev = out[out.length - 1];
    if (prev && prev.name === name) prev.txt += txt; else out.push({ name, txt });
  }
  // final com página própria
  if (depth === 0 && !out.some(s => /^finals?$/i.test(s.name))) {
    const f = W.rawT(title + ' final');
    if (f.text && f.text.length > 1500) out.push({ name: 'Final', txt: f.text.slice(0, 6000) });
  }
  return out;
}

function champion(title) {
  const t = W.raw(title);
  const m = t.match(/\|\s*(champions?|champion_other|winners?)\s*=([^\n]*)/i);
  return m ? m[2] : '';
}

// o clube aparece no texto? pelos links (resolvendo redireções); sem link conhecido, pelo nome exato do link
const canon = {};
const C = t => { t = t.replace(/_/g, ' ').trim(); if (!(t in canon)) canon[t] = W.rawT(t).title; return canon[t]; };
function mentions(txt, club) {
  const want = club.link ? C(club.link) : null;
  const words = club.names.flatMap(n => n.split(/[\s/]+/)).filter(w => w.length >= 4);
  for (const m of txt.matchAll(/\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g)) {
    const tgt = m[1].trim(), disp = (m[2] || tgt).trim();
    if (want) { if (tgt === club.link || ((words.some(w => tgt.includes(w))) && C(tgt) === want)) return true; }
    else if (club.names.includes(disp) || club.names.includes(tgt)) return true;
  }
  return false;
}

// club = {link, names:[...]} → {uT, uS, edition, rounds} ou null
function euStage(season, y, club) {
  const eds = editions(season, y);
  const found = [];
  let pages = 0;
  for (const [uT, titles] of Object.entries(eds)) {
    for (const ed of titles) {
      const secs = roundSections(ed);
      if (!secs.length) continue;
      if (uT !== 'LIB') pages++;
      const fi = secs.findIndex(s => /^finals?$/i.test(s.name));
      const hit = secs.map((s, i) => {
        let txt = s.txt;
        if (i === fi) {   // final: só as duas equipas da caixa do jogo (o texto à volta fala dos adversários anteriores)
          const bx = W.templates(txt, /^\s*(#invoke:\s*)?(football ?box|footballbox|fb ?box|infobox football match)/i).map(b => W.params(b.body)).filter(p => p.team1);
          if (bx.length) txt = bx.map(p => p.team1 + ' ' + p.team2).join(' ');
          // sem caixa do jogo: a final só conta se o clube também estiver na ronda anterior
          else if (i > 0 && !mentions(secs[i - 1].txt, club)) return false;
        }
        return mentions(txt, club);
      });
      // última ronda em que o clube aparece (a final já está protegida contra menções soltas)
      const reached = hit.lastIndexOf(true);
      if (reached < 0) break;
      const nm = secs[reached].name;
      let uS;
      if (fi >= 0 && reached === fi) uS = mentions(champion(ed), club) ? 5 : 4;
      else uS = fi >= 0 ? Math.max(0, 4 - (fi - reached)) : null;
      const ko = !/group|qualif|preliminary/i.test(nm);
      found.push({ uT, uS, edition: ed, reached: nm, ko, rounds: secs.map(s => s.name) });
      break;
    }
  }
  const order = ['UCL', 'CWC', 'UEL', 'ECL', 'LIB'];
  found.sort((a, b) => (b.ko - a.ko) || (order.indexOf(a.uT) - order.indexOf(b.uT)));
  if (!found.length) return pages >= 2 ? { none: true, pages } : null;   // clube ausente das edições consultadas
  return found[0];
}
module.exports = { euStage, roundSections };
