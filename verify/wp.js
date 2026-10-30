// Wikipedia reading tools (wikitext via action=raw), with a local cache.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CACHE = path.join(__dirname, 'work', 'wpcache');
fs.mkdirSync(CACHE, { recursive: true });

const UA = 'BallonDorLab/0.1 (personal research script; curl)';
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function get(url) {
  for (let i = 0; i < 6; i++) {
    try {
      const o = execFileSync('curl', ['-s', '-L', '-A', UA, '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64e6 });
      const k = o.lastIndexOf('\n'), code = +o.slice(k + 1), body = o.slice(0, k);
      if (code === 200) { sleep(120); return body; }
      if (code === 404) return '';
    } catch (e) {}
    sleep(3000 * (i + 1));
  }
  throw new Error('could not fetch ' + url);
}
// Wikitext of a page (follows redirects). rawT also returns the final title.
function rawT(title, lang = 'en', depth = 0) {
  title = title.replace(/_/g, ' ').trim();
  title = title[0].toUpperCase() + title.slice(1);
  const key = lang + '_' + title.replace(/[^A-Za-z0-9\-.]+/g, '_').slice(0, 120) + '_' + require('crypto').createHash('md5').update(title).digest('hex').slice(0, 8);
  const f = path.join(CACHE, key + '.txt');
  let t;
  if (fs.existsSync(f)) t = fs.readFileSync(f, 'utf8');
  else {
    const url = `https://${lang}.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw`;
    t = get(url);
    fs.writeFileSync(f, t);
  }
  const m = t.match(/^\s*#REDIRECT\s*\[\[([^\]|#]+)/i);
  if (m && depth < 4) return rawT(m[1].trim().replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&amp;/g, '&'), lang, depth + 1);
  return { text: t, title };
}
const raw = (title, lang = 'en') => rawT(title, lang).text;

// Extracts balanced {{name ...}} blocks whose name matches re.
function templates(text, re) {
  const out = [];
  let i = 0;
  while ((i = text.indexOf('{{', i)) >= 0) {
    const head = text.slice(i + 2, i + 60);
    if (!re.test(head)) { i += 2; continue; }
    let d = 0, j = i;
    for (; j < text.length - 1; j++) {
      if (text[j] === '{' && text[j + 1] === '{') { d++; j++; }
      else if (text[j] === '}' && text[j + 1] === '}') { d--; j++; if (d === 0) break; }
    }
    out.push({ start: i, body: text.slice(i + 2, j - 1) });
    i = j + 1;
  }
  return out;
}

// Splits the top-level parameters of a template (ignores | inside [[ ]] and {{ }}).
function params(body) {
  const parts = []; let d = 0, cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i], n = body[i + 1];
    if ((c === '{' && n === '{') || (c === '[' && n === '[')) { d++; cur += c + n; i++; continue; }
    if ((c === '}' && n === '}') || (c === ']' && n === ']')) { d--; cur += c + n; i++; continue; }
    if (c === '|' && d === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  const o = { _name: parts[0].trim(), _pos: [] };
  for (const p of parts.slice(1)) {
    const m = p.match(/^\s*([\w\s]+?)\s*=([\s\S]*)$/);
    if (m) o[m[1].trim().toLowerCase()] = m[2].trim(); else o._pos.push(p.trim());
  }
  return o;
}

const strip = s => (s || '').replace(/\[\[(File|Image):[^\]]*\]\]/gi, '').replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '').replace(/\{\{efn[^}]*\}\}/gi, '')
  .replace(/\{\{(?:sort|sortname)\|[^|}]*\|([^}|]*)[^}]*\}\}/gi, '$1')
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/\{\{[^}]*\}\}/g, '').trim();
const link = s => { const m = (s || '').match(/\[\[([^\]|#]+)/); return m ? m[1].trim() : null; };

// Wiki tables → grids (rowspan/colspan expanded). Each cell: {raw, txt, hdr}
function tables(text) {
  const res = [];
  const lines = text.split('\n');
  let stack = [];
  for (const line of lines) {
    const l = line.trim();
    if (l.startsWith('{|')) { stack.push({ rows: [], cur: null }); continue; }
    if (!stack.length) continue;
    const T = stack[stack.length - 1];
    if (l.startsWith('|}')) { if (T.cur) T.rows.push(T.cur); res.push(T.rows); stack.pop(); continue; }
    if (l.startsWith('|-')) { if (T.cur) T.rows.push(T.cur); T.cur = []; continue; }
    if (l.startsWith('|+')) continue;
    if (l.startsWith('!') || l.startsWith('|')) {
      if (!T.cur) T.cur = [];
      const hdr = l[0] === '!';
      const body = l.slice(1);
      const cells = splitCells(body, hdr);
      for (const c of cells) T.cur.push({ ...c, hdr });
    } else if (T.cur && T.cur.length) {
      T.cur[T.cur.length - 1].raw += '\n' + line;
    }
  }
  return res.map(expand);
}
function splitCells(body, hdr) {
  // || separators (or !! in headers), outside [[ ]] and {{ }}
  const out = []; let d = 0, cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i], n = body[i + 1];
    if ((c === '{' && n === '{') || (c === '[' && n === '[')) { d++; cur += c + n; i++; continue; }
    if ((c === '}' && n === '}') || (c === ']' && n === ']')) { d--; cur += c + n; i++; continue; }
    if (d === 0 && ((c === '|' && n === '|') || (hdr && c === '!' && n === '!'))) { out.push(cur); cur = ''; i++; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(s => {
    // attributes: "rowspan=2 | content" (single | outside [[ ]])
    let attr = '', content = s, d2 = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if ((c === '{' && n === '{') || (c === '[' && n === '[')) { d2++; i++; continue; }
      if ((c === '}' && n === '}') || (c === ']' && n === ']')) { d2--; i++; continue; }
      if (c === '|' && d2 === 0) { attr = s.slice(0, i); content = s.slice(i + 1); break; }
    }
    if (attr && !/=/.test(attr)) { content = s; attr = ''; }
    const rs = +(attr.match(/rowspan\s*=\s*"?(\d+)/i) || [0, 1])[1];
    const cs = +(attr.match(/colspan\s*=\s*"?(\d+)/i) || [0, 1])[1];
    return { raw: content, txt: strip(content), rs, cs };
  });
}
function expand(rows) {
  const grid = []; const pend = []; // pend[col] = {cell, left}
  for (const r of rows) {
    const out = []; let col = 0, k = 0;
    const put = () => { while (pend[col] && pend[col].left > 0) { out[col] = pend[col].cell; pend[col].left--; col++; } };
    put();
    for (const c of r) {
      put();
      for (let s = 0; s < c.cs; s++) {
        out[col] = c;
        if (c.rs > 1) pend[col] = { cell: c, left: c.rs - 1 };
        col++;
      }
      k++;
    }
    put();
    grid.push(out);
  }
  return grid;
}

const num = t => { const m = (t || '').replace(/[,\s]/g, '').match(/^\(?(\d+)\)?$/); return m ? +m[1] : (/^[—–\-]$/.test((t || '').trim()) ? null : undefined); };

// A player's (club) career table: [{club, season, comp:{League:[a,g], 'National cup':..., Europe:..., Other:..., Total:...}}]
function career(player, lang = 'en') {
  const t = raw(player, lang);
  const sec = t.search(/==\s*Career statistics\s*==/i);
  const body = sec >= 0 ? t.slice(sec) : t;
  const tbs = tables(body);
  for (const g of tbs) {
    if (g.length < 3) continue;
    const h0 = g[0].map(c => c && c.txt).join('|');
    if (!/Season/i.test(h0) || !/League/i.test(h0)) continue;
    // two-row header: group (row 0) and sub-header (row 1)
    const H = [];
    const w = Math.max(...g.slice(0, 2).map(r => r.length));
    for (let c = 0; c < w; c++) {
      const a = g[0][c] ? g[0][c].txt : '', b = g[1] && g[1][c] && g[1][c].hdr ? g[1][c].txt : '';
      H.push({ grp: a.replace(/\s+/g, ' '), sub: b });
    }
    const out = [];
    for (const r of g.slice(2)) {
      if (!r.length || r.every(c => c && c.hdr)) continue;
      const row = { club: '', season: '', comp: {} };
      for (let c = 0; c < r.length; c++) {
        if (!r[c]) continue;
        const { grp, sub } = H[c] || {};
        if (/^Club|Team/i.test(grp)) { row.club = r[c].txt; row.clubLink = link(r[c].raw); }
        else if (/^Season/i.test(grp)) { row.season = r[c].txt.replace(/\s*\[.*$/, ''); row.seasonLink = link(r[c].raw); }
        else if (/Apps|Goals/i.test(sub)) {
          const k = grp.replace(/\s*\(.*\)/, '');
          row.comp[k] = row.comp[k] || [null, null];
          const v = num(r[c].txt);
          row.comp[k][/Apps/i.test(sub) ? 0 : 1] = v == null ? null : v;
          if (/Apps/i.test(sub)) row.comp[k].note = (row.comp[k].note || '') + (r[c].raw.match(/\{\{efn[^}]*\}\}/gi) || []).join(' ');
        } else if (/Division|League/i.test(sub) || /Division/i.test(grp)) row.div = r[c].txt;
      }
      if (row.season) out.push(row);
    }
    if (out.length) return out;
  }
  return null;
}

// Matches (football box) on a season page, with the competition taken from the heading.
function matches(title, lang = 'en') {
  const t = raw(title, lang);
  const heads = []; const re = /^(={2,5})\s*(.*?)\s*\1\s*$/gm; let m;
  while ((m = re.exec(t))) heads.push({ at: m.index, lvl: m[1].length, txt: strip(m[2]) });
  const ctx = at => { const st = []; for (const h of heads) { if (h.at > at) break; while (st.length && st[st.length - 1].lvl >= h.lvl) st.pop(); st.push(h); } return st.map(h => h.txt).join(' > '); };
  const boxes = templates(t, /^\s*(#invoke:\s*)?(football ?box|footballbox|fb ?box|footballbox collapsible)/i);
  const out = boxes.filter(b => /\|\s*(team1|home)\s*=/i.test(b.body)).map(b => {
    const p = params(b.body);
    const ym = (p.date || '').match(/(19|20)\d\d/);
    return { ctx: ctx(b.start), round: strip(p.round || ''), date: isoDate(p.date || ''), year: ym ? +ym[0] : null,
             team1: teamName(p.team1 || p.home || ''), team2: teamName(p.team2 || p.away || ''), score: strip(p.score || '') || (p.score || '').replace(/[^\d–\-()p ]/g, ''),
             goals1: p.goals1 || '', goals2: p.goals2 || '', result: p.result || '', start: b.start, end: b.start + b.body.length };
  });
  // templates that build the boxes from data ({{Bundesliga matches|2018–19|MUN}}): expand them through the API
  for (const tp of templates(t, /^\s*[A-Za-z .\-]+ matches\s*\|/)) {
    const html = expandT('{{' + tp.body + '}}', title, lang);
    for (const ev of html.split(/<div class="vevent">/).slice(1)) {
      const dm = ev.match(/dtstart[^>]*>(\d{4})-(\d\d)-(\d\d)/);
      const teams = [...ev.matchAll(/class="vcard attendee"[^>]*>([\s\S]*?)<\/td>/g)].map(x => strip(x[1].replace(/<[^>]+>/g, '')));
      const trs = ev.split(/<tr\b/);
      const tds = trs[2] ? [...trs[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1]) : [];
      const bg = (ev.match(/background:#([0-9A-Fa-f]{6})/) || [])[1] || '';
      const res = /^BBF3BB$/i.test(bg) ? 'W' : /^FFBBBB$/i.test(bg) ? 'L' : /^FFFFBB$/i.test(bg) ? 'D' : '';
      const fix = s => (s || '').replace(/<span class="fb-goal">\[\[File:[^\]]*\]\]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
      const g1 = tds.length >= 4 ? fix(tds[1]) : '', g2 = tds.length >= 4 ? fix(tds[3]) : '';
      out.push({ ctx: ctx(tp.start), round: (ev.match(/<small>([^<]*)<\/small>/) || [])[1] || '', date: dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : '',
                 year: dm ? +dm[1] : null, team1: teams[0] || '', team2: teams[1] || '', score: '', goals1: g1, goals2: g2, result: res, start: tp.start, end: tp.start });
    }
  }
  // table format (Date | Opponent | ... | Scorers), e.g. Manchester United pages
  const L = t.split('\n'); const offs = []; let acc = 0;
  for (const l of L) { offs.push(acc); acc += l.length + 1; }
  const spans = [];
  for (let a = 0, d = 0, st = -1; a < L.length; a++) {
    const l = L[a].trim();
    if (l.startsWith('{|')) { if (d === 0) st = a; d++; }
    else if (l.startsWith('|}') && d > 0) { d--; if (d === 0) spans.push([st, a]); }
  }
  for (const [sa, sb] of spans) {
    const i = offs[sa], j = offs[sb];
    const sub = L.slice(sa, sb + 1).join('\n');
    const g = tables(sub).pop() || [];
    const head = (g[0] || []).map(c => c && c.hdr ? c.txt : '');
    const di = head.findIndex(h => /^Date/i.test(h)), si = head.findIndex(h => /scorer/i.test(h));
    if (di >= 0 && si >= 0) {
      const ri = head.findIndex(h => /^(Round|Rd|Stage)/i.test(h));
      for (const r of g.slice(1)) {
        if (!r[di] || !r[si] || r[di].hdr) continue;
        const ym = (r[di].raw || '').match(/(19|20)\d\d/);
        out.push({ ctx: ctx(i), round: ri >= 0 && r[ri] ? r[ri].txt : '', date: r[di].txt, year: ym ? +ym[0] : null,
                   team1: '__US__', team2: '', score: '', goals1: r[si].raw, goals2: '', result: '', table: true, start: i, end: j });
      }
    }
  }
  // dates without a year ("18 July"): year from the season in the title (Jul–Dec → 1st year, Jan–Jun → 2nd)
  const sm = title.match(/(\d{4})[–-](\d{2,4})\b/);
  if (sm) {
    const y1 = +sm[1], y2 = y1 + 1;
    const MO = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    for (const m of out) if (!m.year) {
      const k = (m.date.toLowerCase().match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/) || [])[0];
      const n = (m.date.match(/^\s*\d{1,2}[./]\s*(\d{1,2})\b/) || [])[1];
      const mo = k ? MO.indexOf(k) + 1 : n ? +n : 0;
      if (mo) m.year = mo >= 7 ? y1 : y2;
    }
  }
  return out;
}
function expandT(text, title, lang = 'en') {
  const key = 'exp_' + require('crypto').createHash('md5').update(lang + title + text).digest('hex');
  const f = path.join(CACHE, key + '.txt');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const url = `https://${lang}.wikipedia.org/w/api.php?action=expandtemplates&format=json&prop=wikitext&title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
  let w = '';
  try { w = JSON.parse(get(url)).expandtemplates.wikitext || ''; } catch (e) { w = ''; }
  fs.writeFileSync(f, w);
  return w;
}
// {{fb|FRA}} / {{fb-rt|FRA|1974}} / {{#invoke:flagg|...|FRA}} → 3-letter code (national teams only); otherwise text
function teamName(s) {
  const t = s.match(/\{\{\s*(fb|fb-rt|fbw|fbw-rt|fbu|fbu-rt|fb-big|#invoke:\s*flagg?)\b[^{}]*\}\}/i);
  if (t && !strip(s.replace(t[0], ''))) { const ps = t[0].slice(2, -2).split('|').map(x => x.trim()); const c = ps.slice(1).find(x => /^[A-Z]{3}$/.test(x)); if (c) return c; }
  return strip(s);
}
function isoDate(s) {
  const m = (s || '').match(/\{\{\s*(?:start date|dts|date)[^|]*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/i);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  return strip(s);
}
// Goals from a goals1/goals2 text → {linkTarget: n}
function scorers(g, inline = false) {
  const o = {};
  const parts = g.split(/<br\s*\/?>|\n|\*/i).flatMap(s => s.split(/(?=\[\[(?!File:|Image:))/i));
  let last = null;
  for (const s of parts) {
    const L = link(s);
    if (L) last = L;
    const who = L || last;
    if (!who) continue;
    let n = 0;
    for (const gt of templates(s, /^\s*goals?\s*\|/i)) {
      const ps = gt.body.split('|').slice(1);
      for (let i = 0; i < ps.length; i += 2) if (/\d/.test(ps[i]) && !/o\.?g/i.test(ps[i + 1] || '')) n++;
      if (ps.some(x => /o\.?g/i.test(x))) { n = 0; }
    }
    if (!/\{\{\s*goals?\s*\|/i.test(s)) {
      const rest = s.replace(/\[\[[^\]]*\]\]/g, '').replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, '');
      const mm = rest.match(/\d+(\+\d+)?\s*(['′’]|&prime;|\{\{'\}\})/g);
      if (/o\.?\s?g\.?|own goal/i.test(rest)) n = 0;
      else if (mm) n += mm.length;
      else if (inline && L) { const k = rest.match(/^\s*\(?\s*(\d)\s*\)?/); n += k ? +k[1] : 1; }
    }
    if (n) o[who] = (o[who] || 0) + n;
  }
  return o;
}
function compClass(ctx) {
  const c = ctx.toLowerCase();
  if (/friendl|pre-season|preseason|tour\b|trophy|exhibition/.test(c) && !/champions|uefa|european/.test(c)) return 'X';
  if (/super ?cup|supercopa|supercoppa|supercup|community shield|charity shield|club world|intercontinental|trophée des champions|johan cruyff|recopa/.test(c)) return 'X';
  if (/champions league|european cup|europa league|uefa cup|cup winners|conference league|inter-cities|fairs cup|libertadores|sudamericana|uefa/.test(c)) return 'U';
  if (/\bcup\b|copa del rey|coppa italia|pokal|coupe de france|coupe de la ligue|taça|knvb|fa cup|league cup|efl cup|carabao|scottish cup|beker|copa|coupe/.test(c)) return 'X';
  if (/league|liga|serie a|bundesliga|ligue 1|division|eredivisie|primeira|premiership|championship|matches|results|campeonato|süper lig|super league/.test(c)) return 'L';
  return '?';
}

module.exports = { get, raw, rawT, templates, params, strip, link, tables, career, matches, scorers, compClass, num };
