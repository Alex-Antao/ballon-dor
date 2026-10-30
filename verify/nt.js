// Final tournament of a national-team competition: a player's games, goals and stage reached.
const W = require('./wp.js');

function tourTitle(ntT, y, win) {
  // tournament whose finals took place in the window (P: season ending in y)
  const T = {
    WC: v => `${v} FIFA World Cup`, EURO: v => `UEFA Euro ${v}`, COPA: v => `${v} Copa América`,
    AFCON: v => `${v} Africa Cup of Nations`, ASIAN: v => `${v} AFC Asian Cup`, GOLD: v => `${v} CONCACAF Gold Cup`,
    NL: v => `${v} UEFA Nations League Finals`,
  }[ntT];
  if (!T) return null;
  const cands = [];
  if (win === 'P' && ntT === 'WC' && y === 2023) cands.push(T(2022));
  if (ntT === 'EURO' && y === 2021) cands.push(T(2020));
  if (ntT === 'COPA' && y === 2016) cands.push('Copa América Centenario');
  if (ntT === 'AFCON' || ntT === 'ASIAN') cands.push(T(y - 1));
  cands.push(T(y));
  return cands;
}

const stageOf = ctx => {
  const c = ctx.toLowerCase();
  if (/third|3rd/.test(c)) return 3;
  if (/semi/.test(c)) return 3;
  if (/quarter/.test(c)) return 2;
  if (/round of 16|eighth|second round|last 16/.test(c)) return 1;
  if (/\bfinal\b/.test(c) && !/final (tournament|round|stage)|finals\b/.test(c)) return 4;
  return 0;
};

function pagesOf(main) {
  const t = W.raw(main);
  const set = new Set([main]);
  const re = /(?:\[\[|\{\{:|\{\{#lst:|\{\{main\|)([^\]|#}]+)/gi; let m;
  const esc = main.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ok = new RegExp('^' + esc + ' (Group [A-L1-8]\\b|knockout (stage|phase)|final\\b|second round|final round|Group stage|round of (32|16))', 'i');
  while ((m = re.exec(t))) { const l = m[1].trim(); if (ok.test(l)) set.add(l.replace(/_/g, ' ')); }
  // matches with an article of their own, transcluded in the sub-pages ({{#lst:X|...}} / {{:X|...}})
  for (const p of [...set]) {
    const tr = /\{\{(?::|#lst:|#section:)([^|}#]+)/gi; let k;
    const s = W.raw(p);
    while ((k = tr.exec(s))) { const l = k[1].trim().replace(/_/g, ' '); if (l && !set.has(l)) set.add(l); }
  }
  return [...set];
}

const linkCache = {};
function same(link, title) {
  if (link === title) return true;
  const last = title.replace(/\s*\(.*\)/, '').split(' ').pop();
  if (!link.includes(last)) return false;
  if (!(link in linkCache)) linkCache[link] = W.rawT(link).title;
  return linkCache[link] === title;
}

function ntStats(title, ntT, y, win) {
  const cands = tourTitle(ntT, y, win) || [];
  let main = null;
  for (const c of cands) { const r = W.rawT(c); if (r.text.length > 2000) { main = r.title; break; } }
  if (!main) return { issue: 'tournament not found ' + cands.join('/') };
  const info = W.params((W.templates(W.raw(main), /^\s*Infobox (international )?football (competition|tournament)/i)[0] || { body: '' }).body);
  const code = s => (s || '').match(/\{\{\s*(?:fb|fbw|fb-rt|flagicon|flag)\s*\|\s*([A-Z]{3})/i)?.[1]?.toUpperCase() || W.strip(s);
  const champ = code(info.champion || info.champions || info.winner), second = code(info.second || info['runner-up'] || info['runners-up']);
  const res = { main, pages: [], apps: 0, goals: 0, team: null, matches: [] };
  const seen = new Set(), tcount = {};
  for (const pg of pagesOf(main)) {
    const t = W.raw(pg);
    const ms = W.matches(pg);
    if (!ms.length) continue;
    res.pages.push(pg);
    ms.forEach((m, i) => {
      const key = m.date + '|' + [m.team1, m.team2].sort().join('-');
      if (seen.has(key)) return;
      const chunk = t.slice(m.end, i + 1 < ms.length ? ms[i + 1].start : t.length);
      // line-up rows: "|GK ||'''1''' ||[[Hugo Lloris]]"; each line-up starts with the starting goalkeeper
      const lines = chunk.split('\n');
      let side = 0, sawLineup = false, appeared = 0, subsSec = false;
      for (const l of lines) {
        if (/Manager:|Coach:|Head coach:/i.test(l)) { subsSec = false; continue; }
        if (/^\|.*'''\s*(Substitut\w*|Reserves|Subs)\s*:?\s*'''/i.test(l)) subsSec = true;
        const mm = l.match(/^\|\s*[A-Z]{2,3}\s*\|\|.*?\[\[([^\]|#]+)/);
        if (!mm) continue;
        if (/^\|\s*GK/.test(l) && !subsSec) side++;
        if (!side) continue;
        sawLineup = true;
        if (side > 2) break;
        if (same(mm[1].trim(), title)) {
          if (!subsSec || /subon|sub on/i.test(l)) appeared = side;
        }
      }
      const s1 = W.scorers(m.goals1), s2 = W.scorers(m.goals2);
      let g = 0, gside = 0;
      for (const [s, sd] of [[s1, 1], [s2, 2]]) for (const p in s) if (same(p, title)) { g += s[p]; gside = sd; }
      if (appeared || g) {
        seen.add(key);
        const tm = (appeared || gside) === 1 ? m.team1 : m.team2;
        tcount[tm] = (tcount[tm] || 0) + 1;
        res.apps += appeared ? 1 : 0; res.goals += g;
        res.matches.push({ pg, ctx: m.ctx.replace(/^Matches > /, ''), round: m.round, date: m.date, vs: (appeared || gside) === 1 ? m.team2 : m.team1, g, app: !!appeared, lineup: sawLineup });
      }
    });
  }
  res.team = Object.entries(tcount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  // the team's stage: all of the team's games (and the player's own)
  const stg = (pg, m) => /group/i.test(pg + ' ' + m.ctx) && !/second|final round/i.test(pg + ' ' + m.ctx) ? 0 : stageOf((/ final$/i.test(pg) ? 'final ' : '') + m.ctx + ' ' + (m.round || ''));
  let st = Math.max(0, ...res.matches.map(m => stg(m.pg, m)));
  const allTeam = [], hasLineup = new Set();
  for (const pg of res.pages) {
    const ms = W.matches(pg), t = W.raw(pg);
    ms.forEach((m, i) => {
      if (!(res.team && (m.team1 === res.team || m.team2 === res.team))) return;
      const key = m.date + [m.team1, m.team2].sort().join('-');
      allTeam.push(key); st = Math.max(st, stg(pg, m));
      const chunk = t.slice(m.end, i + 1 < ms.length ? ms[i + 1].start : t.length);
      if (/^\|\s*GK\s*\|\|/m.test(chunk)) hasLineup.add(key);
    });
  }
  res.noLineup = new Set(allTeam.filter(k => !hasLineup.has(k))).size;
  const NAMES = { FRA: 'France', FRG: 'West Germany', GER: 'Germany', ITA: 'Italy', ESP: 'Spain', ENG: 'England', NED: 'Netherlands',
    POR: 'Portugal', BRA: 'Brazil', ARG: 'Argentina', URU: 'Uruguay', URS: 'Soviet Union', TCH: 'Czechoslovakia', DEN: 'Denmark',
    GRE: 'Greece', BEL: 'Belgium', YUG: 'Yugoslavia', CRO: 'Croatia', HUN: 'Hungary', CZE: 'Czech Republic', SWE: 'Sweden',
    CHI: 'Chile', COL: 'Colombia', SEN: 'Senegal', CMR: 'Cameroon', EGY: 'Egypt', ALG: 'Algeria', NGA: 'Nigeria', CIV: 'Ivory Coast',
    MEX: 'Mexico', USA: 'United States', POL: 'Poland', BUL: 'Bulgaria', ROU: 'Romania', SCO: 'Scotland', WAL: 'Wales', TUR: 'Turkey',
    RUS: 'Russia', PER: 'Peru', PAR: 'Paraguay', GHA: 'Ghana', MAR: 'Morocco', TUN: 'Tunisia', KOR: 'South Korea', JPN: 'Japan',
    QAT: 'Qatar', KSA: 'Saudi Arabia', AUS: 'Australia', NOR: 'Norway', SUI: 'Switzerland', AUT: 'Austria', IRL: 'Republic of Ireland' };
  const isTeam = (c, t) => c && t && (c === t || (NAMES[t] && c.replace(/\s*\(.*/, '').trim() === NAMES[t]));
  if (st === 4 && isTeam(champ, res.team)) st = 5;
  Object.assign(res, { champ, second, teamGames: new Set(allTeam).size, stage: st });
  return res;
}
module.exports = { ntStats, tourTitle };
