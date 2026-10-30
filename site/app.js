// Ballon d'Or Lab — single-page app. Routes: #/<year>, #/summary, #/method (old #a2026/#resumo/#metodo still work).
// Data: window.BDO_DATA (data.js), window.BDO_MODELS (models.js), window.BDO_CONFIG (weights and model selection);
// sources.json is fetched only when a player's detail is opened.
(function () {
  'use strict';
  const { YEARS, leagueStrength, cupWeight } = window.BDO_DATA;
  const M = window.BDO_MODELS;
  const CFG = window.BDO_CONFIG;
  const FITS = CFG.fits, SEL = CFG.selection || {};
  // The next award: the live forecast is one more year, with no winner yet (forecast/2027.json, updated daily).
  const FC = CFG.forecast || null;
  if (FC) YEARS[FC.year] = { label: FC.label, award: `Forecast as of ${FC.asOf}`, winner: null, winnerAll: null, winnerAllNote: '',
                             window: 'P', notes: '', rows: FC.rows.map(r => Object.assign({}, r, { y: FC.year })), forecast: true };

  // ---------- constants ----------
  const years = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
  const LAST = years[years.length - 1];
  const done = years.filter(y => !YEARS[y].forecast), DONE = done[done.length - 1];   // years already awarded
  const ALGS = [
    { k: 'real', n: 'Actual result', short: 'Actual', c: 'var(--c-real)', d: 'Official vote' },
    { k: 'pred', n: 'Prediction', short: 'Prediction', c: 'var(--c-pred)', d: 'Weights trained only on earlier years' },
    { k: 'fair', n: 'Fair', short: 'Fair', c: 'var(--c-fair)', d: 'Individual performance only' },
    { k: 'mine', n: 'Custom', short: 'Custom', c: 'var(--c-mine)', d: 'Individual + proportional team credit' },
  ];
  const MODELS = ['pred', 'fair', 'mine'];
  const LISTS = [['elig', 'Eligible only'], ['all', 'Everyone']];
  const CUPN = { UCL: 'European Cup/UCL', CWC: "Cup Winners' Cup", UEL: 'UEFA Cup/Europa League', ECL: 'Conference League', LIB: 'Libertadores', SUD: 'Sudamericana' };
  // Where a player's continental club competition is played: from the cup when there is one, else from the league
  // (MLS and South American clubs have no European cup, so "Europe" would be wrong for them).
  const UEFA_CUPS = ['UCL', 'CWC', 'UEL', 'ECL'];
  const LG_REGION = { BRA: 'South America', ARG: 'South America', PER: 'South America', MLS: 'North America' };
  const region = r => r.uT ? (UEFA_CUPS.includes(r.uT) ? 'Europe' : 'South America') : LG_REGION[r.lg] || 'Europe';
  const WIN = { CY: 'calendar year', S: 'season ending in the year (fallback)', P: 'season' };
  const STAGE = ['group stage/out', 'round of 16', 'quarter-finals', 'semi-finals', 'lost final', 'winner'];
  const POS = { FW: 'Forward', W: 'Winger', AM: 'Attacking midfielder', CM: 'Midfielder', DM: 'Defensive midfielder', DF: 'Defender', GK: 'Goalkeeper' };
  const SLIDERS = [
    ['wTeam', 'Team credit weight', 0, 0.6, 0.01, x => Math.round(x * 100) + '%'],
    ['euBonus', 'Continental-cup bonus (top opposition)', 0, 0.8, 0.05, x => '+' + Math.round(x * 100) + '%'],
    ['ntBoost', 'National-team tournament weight', 0.6, 1.6, 0.05, x => '×' + (+x).toFixed(2)],
    ['assistW', 'Value of an assist vs a goal', 0.3, 1, 0.05, x => (+x).toFixed(2)],
    ['wCont', 'Non-attacking contribution weight', 0, 0.6, 0.02, x => Math.round(x * 100) + '%'],
  ];
  const MQ = { phone: matchMedia('(max-width: 699px)'), desk: matchMedia('(min-width: 1100px)') };

  // ---------- state (list choice and "Custom" weights persist per viewer) ----------
  const MINE0 = Object.assign({}, M.MINE_DEFAULT);
  const stored = (() => { try { return JSON.parse(localStorage.getItem('bdo-lab') || '{}'); } catch (e) { return {}; } })();
  const st = {
    view: 'year', year: LAST, list: stored.list === 'all' ? 'all' : 'elig', sel: null, tab: 'real',
    mine: Object.assign({}, MINE0, stored.mine || {}),
  };
  const save = () => { try { localStorage.setItem('bdo-lab', JSON.stringify({ list: st.list, mine: st.mine })); } catch (e) { /* storage unavailable */ } };

  // ---------- helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const fmt = (x, d = 2) => (+x).toFixed(d);
  const alg = k => ALGS.find(a => a.k === k);
  const ICON = {
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    tap: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  };

  // Prediction weights for year y: on the eligible list, trained only on earlier years (an honest forecast);
  // otherwise the single in-sample fit.
  const temporalOf = y => (st.list === 'elig' || YEARS[y].forecast) && SEL.temporal && SEL.temporal[y] ? SEL.temporal[y] : null;
  const weightsOf = y => { const t = temporalOf(y); return t ? t.weights : (FITS[st.list] || FITS.elig).weights; };
  const predDesc = y => {
    const t = temporalOf(y);
    if (t) return `Weights trained only on ${t.train[0]}–${t.train[1]}`;
    return st.list === 'elig' ? 'Too few earlier years: fitted to every year (in-sample)' : 'Single fit to the winners (in-sample)';
  };
  const rowsOf = y => M.listRows(YEARS[y], st.list);
  const targetOf = y => M.target(YEARS[y], st.list);
  function compute(y) {
    const rows = rowsOf(y), ctx = M.predCtx(rows), w = weightsOf(y);
    return {
      pred: M.rankYear(rows, r => M.predict(r, w, ctx)),
      fair: M.rankYear(rows, r => M.fair(r)),
      mine: M.rankYear(rows, r => M.mine(r, st.mine)),
    };
  }
  const picksOf = y => { const res = compute(y); return Object.fromEntries(MODELS.map(k => [k, res[k][0].r.name])); };

  // ---------- routing ----------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    if (h === 'summary' || h === 'resumo') return { view: 'summary' };
    if (h === 'method' || h === 'metodo') return { view: 'method' };
    if (h === 'forecast' && FC) return { view: 'year', year: FC.year };
    if (h === 'years') return { view: 'year', year: DONE };
    const m = /^a?(\d{4})$/.exec(h);
    if (m && YEARS[m[1]]) return { view: 'year', year: +m[1] };
    return { view: 'year', year: FC && !h ? FC.year : DONE };
  }
  const go = hash => { if (location.hash !== hash) location.hash = hash; else route(); };
  function route() {
    const r = parseHash(), prevView = st.view, prevYear = st.year;
    st.view = r.view;
    if (r.year) st.year = r.year;
    if (r.view !== 'year' || r.year !== prevYear) { st.sel = null; closeDetail(false); }
    const nav = st.view === 'year' && YEARS[st.year].forecast ? 'forecast' : st.view;
    $$('[data-view]').forEach(a => { if (a.dataset.view === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = nav === 'forecast' ? `${st.year} forecast · Ballon d'Or Lab` : st.view === 'year' ? `${st.year} · Ballon d'Or Lab` : st.view === 'summary' ? "Summary · Ballon d'Or Lab" : "Method · Ballon d'Or Lab";
    render();
    if (prevView !== st.view) window.scrollTo(0, 0);
  }
  function render() { if (st.view === 'year') viewYear(); else if (st.view === 'summary') viewSummary(); else viewMethod(); }

  // ---------- year view ----------
  function yearSelect() {
    const dec = {};
    years.forEach(y => { (dec[Math.floor(y / 10) * 10] = dec[Math.floor(y / 10) * 10] || []).push(y); });
    return `<label class="year-pick"><span class="sr-only">Jump to year</span><select id="year-select">${Object.entries(dec).map(([d, ys]) =>
      `<optgroup label="${d}s">${ys.map(y => `<option value="${y}"${y === st.year ? ' selected' : ''}>${y}${YEARS[y].forecast ? ' — forecast' : YEARS[y].winner ? ' — ' + esc(YEARS[y].winner) : ' — not awarded'}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
  }
  function listToggle() {
    return `<div class="seg" role="group" aria-label="Candidate list">${LISTS.map(([k, l]) => `<button type="button" data-list="${k}" aria-pressed="${st.list === k}">${l}</button>`).join('')}</div>`;
  }
  function winnerLine(y) {
    const Y = YEARS[y], t = targetOf(y);
    if (Y.forecast) return `<span class="kicker">Forecast · as of ${esc(FC.asOf)}</span><strong>Not awarded yet</strong><span class="aw">Numbers of the ${esc(FC.season)} season so far; updated every day</span>`;
    if (!Y.winner) return `<span class="kicker">Ballon d'Or</span><strong>Not awarded</strong><span class="aw">France Football cancelled the 2020 edition (COVID-19)</span>`;
    if (t !== Y.winner) return `<span class="kicker">Retroactive winner (France Football, 2016)</span><strong>${esc(t)}</strong><span class="aw">Official winner: ${esc(Y.winner)}</span>`;
    return `<span class="kicker">Winner</span><strong>${esc(Y.winner)}</strong><span class="aw">${esc(Y.award)}</span>`;
  }
  function picksHtml(y, res) {
    const t = targetOf(y);
    return MODELS.map(k => {
      const a = alg(k), n = res[k][0].r.name, ok = t && n === t;
      return `<li class="pick" style="--c:${a.c}"><span class="swatch" aria-hidden="true"></span><span class="who"><small>${a.n} picks</small><b>${esc(n)}</b></span>
        <span class="res ${ok ? 'mark-ok' : 'mark-no'}">${!t ? '—' : ok ? '✓ right' : '✗ wrong'}</span></li>`;
    }).join('');
  }
  function timelineHtml() {
    const hits = {};
    years.forEach(y => { const t = targetOf(y), p = picksOf(y); hits[y] = MODELS.map(k => t && p[k] === t); });
    let out = '', prevDec = null;
    for (const y of years) {
      const d = Math.floor(y / 10);
      if (prevDec !== null && d !== prevDec) out += '<span class="decade" aria-hidden="true"></span>';
      prevDec = d;
      const label = `${y}: ${YEARS[y].forecast ? 'forecast' : YEARS[y].winner ? MODELS.map((k, i) => `${alg(k).n} ${hits[y][i] ? 'right' : 'wrong'}`).join(', ') : 'not awarded'}`;
      out += `<button type="button" data-y="${y}" aria-current="${y === st.year}" aria-label="${esc(label)}"><span class="y">${y}</span><span class="dots" aria-hidden="true">${MODELS.map((k, i) => `<i style="--c:${alg(k).c}" class="${hits[y][i] ? 'on' : ''}"></i>`).join('')}</span></button>`;
    }
    return out;
  }
  function colHtml(a, res, y) {
    const Y = YEARS[y], rows = rowsOf(y), t = targetOf(y);
    let items;
    if (a.k === 'real' && Y.forecast) {
      items = rows.slice().sort((p, q) => q.g + q.a - p.g - p.a || q.g - p.g).map((r, i) => ({ r, pos: i + 1, score: null, ga: `${r.g}+${r.a}` }));
    } else if (a.k === 'real') {
      const ranked = rows.filter(r => r.rank).sort((p, q) => p.rank - q.rank).map(r => ({ r, pos: r.rank, score: null }));
      const rest = rows.filter(r => !r.rank).sort((p, q) => (q.name === t) - (p.name === t)).map(r => ({ r, pos: '–', score: null, faded: r.name !== t, retro: r.name === t }));
      items = ranked.concat(rest);
    } else {
      const mx = Math.max(...res[a.k].map(x => x.score), 1e-9);
      items = res[a.k].map((x, i) => ({ r: x.r, pos: i + 1, score: x.score, w: Math.max(0, x.score) / mx * 100 }));
    }
    const li = items.map(it => {
      const r = it.r, isW = t && r.name === t;
      let tag = '';
      if (a.k === 'real') tag = it.retro ? '<span class="tag win">retroactive winner</span>' : (it.pos === 1 && r.name === Y.winner ? '<span class="tag win">winner</span>' : '');
      else tag = r.rank ? `<span class="tag ${isW && it.pos === 1 ? 'hit' : ''}">actual #${r.rank}</span>` : (isW && it.pos === 1 ? '<span class="tag hit">retroactive</span>' : '');
      if (r.elig === 0) tag += '<span class="tag">ineligible</span>';
      const score = it.ga || (it.score == null ? '' : (a.k === 'pred' ? fmt(it.score) : fmt(it.score, 0)));
      return `<li><button type="button" class="row${it.faded ? ' faded' : ''}${isW ? ' is-winner' : ''}" style="--c:${a.c}" data-n="${esc(r.name)}" aria-pressed="${st.sel === r.name}">
        <span class="pos">${it.pos}</span><span class="nm" title="${esc(r.name)}">${esc(r.name)}</span><span class="sc">${score}</span>
        <span class="sub"><span class="club">${esc(r.club)} · ${POS[r.pos]}</span>${tag}</span>
        ${it.score == null ? '' : `<span class="bar" aria-hidden="true"><i style="width:${it.w.toFixed(1)}%"></i></span>`}
      </button></li>`;
    }).join('');
    const desc = a.k === 'pred' ? predDesc(y) : a.d;
    return `<section class="col${st.tab === a.k ? ' active' : ''}" style="--c:${a.c}" data-k="${a.k}" id="col-${a.k}" role="tabpanel" aria-labelledby="tab-${a.k}">
      <header><h2><span class="swatch" aria-hidden="true"></span>${a.n}</h2><span>${esc(desc)}</span></header><ol class="list">${li}</ol></section>`;
  }
  const SEASON_COL = { k: 'real', n: 'Season so far', short: 'Numbers', c: 'var(--c-real)', d: 'Goals + assists, league and Champions League' };
  const algsOf = y => YEARS[y].forecast ? [SEASON_COL, ...ALGS.slice(1)] : ALGS;
  function boardHtml(y, res) {
    const as = algsOf(y);
    if (!as.some(a => a.k === st.tab)) st.tab = 'real';
    return `<div class="model-tabs" role="tablist" aria-label="Model">${as.map(a => `<button type="button" role="tab" id="tab-${a.k}" style="--c:${a.c}" data-tab="${a.k}" aria-selected="${st.tab === a.k}" aria-controls="col-${a.k}"><span class="swatch" aria-hidden="true"></span>${a.short}</button>`).join('')}</div>
      <div class="cols" id="cols">${as.map(a => colHtml(a, res, y)).join('')}</div>
      <p class="swipe-hint">Swipe sideways to switch model · tap a player for details</p>`;
  }
  function tuneHtml() {
    const m = st.mine;
    return `<details class="tune panel" id="tune"${MQ.desk.matches ? ' open' : ''}>
      <summary><h2><span class="swatch" style="--c:var(--c-mine)" aria-hidden="true"></span>Tune Custom</h2></summary>
      <p class="note">Move the weights and watch “Custom” change in every year, including the Summary.</p>
      <div class="sliders">${SLIDERS.map(([k, l, min, max, step, f]) => `<label for="s_${k}">${l}<b><span></span><span id="v_${k}" class="num">${f(m[k])}</span></b>
        <input type="range" id="s_${k}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${m[k]}"></label>`).join('')}</div>
      <button type="button" class="btn" id="reset">Reset to defaults</button></details>`;
  }

  function viewYear() {
    const y = st.year, Y = YEARS[y], res = compute(y);
    const i = years.indexOf(y), nIn = Y.rows.filter(r => r.elig === 0).length;
    const hist = Y.forecast && FC.history && FC.history.length > 1 ? ' Prediction leader on recent updates: ' + FC.history.slice(-8).map(h => `${h.date} ${h.pred[0] ? h.pred[0][0] : '—'}`).join(' · ') + '.' : '';
    const fcNote = Y.forecast ? `The forecast uses the same three models on the ${FC.season} season so far: league and Champions League numbers from football-data.org (${FC.leagues.join(', ')}), other European cups, domestic cups and the 2027 national-team tournaments from Wikipedia. League leaders count as champions until the season ends. Candidates: the leading scorers and assisters plus a hand-kept list of midfielders, defenders and goalkeepers.${hist}` : '';
    const notes = [fcNote, Y.notes, nIn ? `${nIn} ineligible candidate${nIn > 1 ? 's' : ''} this year: shown only in the “Everyone” list.` : '', Y.winnerAllNote].filter(Boolean).join(' ');
    $('#main').innerHTML = `<div class="year-view">
      <section class="hero" aria-label="${y}">
        <div class="year-nav">
          <button type="button" class="nav-btn" id="prev" aria-label="Previous year"${i <= 0 ? ' disabled' : ''}>${ICON.prev}</button>
          <div class="year-title"><h1 class="num">${y}</h1><span class="kicker">${esc(Y.label)}</span></div>
          <button type="button" class="nav-btn" id="next" aria-label="Next year"${i >= years.length - 1 ? ' disabled' : ''}>${ICON.next}</button>
          ${yearSelect()}
        </div>
        <div class="winner-line" id="winner">${winnerLine(y)}</div>
        <ul class="picks" id="picks" aria-label="Each model's pick">${picksHtml(y, res)}</ul>
      </section>
      <div class="timeline" id="timeline" aria-label="Years">${timelineHtml()}</div>
      <div class="timeline-legend" aria-hidden="true">${MODELS.map(k => `<span><span class="swatch" style="--c:${alg(k).c}"></span>${alg(k).n} right</span>`).join('')}</div>
      <div class="toolbar">${Y.forecast ? '' : listToggle()}${notes ? `<details class="about"><summary>About ${y}</summary><p class="note">${esc(notes)}</p></details>` : ''}</div>
      <div class="year-layout">
        <div class="board" id="board">${boardHtml(y, res)}</div>
        <aside class="side" aria-label="Player detail and tuning">
          <div class="detail panel${st.sel ? ' open' : ''}" id="detail" role="region" aria-label="Player detail" tabindex="-1">${detailHtml(y, res)}</div>
          ${tuneHtml()}
        </aside>
      </div></div>`;
    bindYear();
    const cur = $('#timeline [aria-current="true"]');
    if (cur) try { cur.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) { /* old browsers */ }
  }
  // Re-render only what depends on the models (keeps slider focus while dragging).
  function refreshYear() {
    const y = st.year, res = compute(y);
    $('#picks').innerHTML = picksHtml(y, res);
    $('#winner').innerHTML = winnerLine(y);
    const tl = $('#timeline'), sl = tl.scrollLeft; tl.innerHTML = timelineHtml(); tl.scrollLeft = sl;
    $('#board').innerHTML = boardHtml(y, res);
    $('#detail').innerHTML = detailHtml(y, res);
    bindBoard(); bindDetail();
  }

  function bindYear() {
    $('#prev').onclick = () => go('#/' + years[years.indexOf(st.year) - 1]);
    $('#next').onclick = () => go('#/' + years[years.indexOf(st.year) + 1]);
    $('#year-select').onchange = e => go('#/' + e.target.value);
    $$('#timeline button').forEach(b => b.onclick = () => go('#/' + b.dataset.y));
    $$('[data-list]').forEach(b => b.onclick = () => { st.list = b.dataset.list; st.sel = null; save(); closeDetail(false); viewYear(); });
    $$('#tune input[type=range]').forEach(inp => inp.oninput = () => {
      const k = inp.dataset.k; st.mine[k] = +inp.value; $('#v_' + k).textContent = SLIDERS.find(s => s[0] === k)[5](st.mine[k]); save(); refreshYear();
    });
    $('#reset').onclick = () => { st.mine = Object.assign({}, MINE0); save(); SLIDERS.forEach(([k, , , , , f]) => { $('#s_' + k).value = st.mine[k]; $('#v_' + k).textContent = f(st.mine[k]); }); refreshYear(); };
    bindBoard(); bindDetail();
  }
  function setTab(k, focus) {
    st.tab = k;
    $$('.model-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
    $$('#cols .col').forEach(c => c.classList.toggle('active', c.dataset.k === k));
    if (focus) { const b = $(`#tab-${k}`); if (b) { b.focus(); b.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } }
  }
  function bindBoard() {
    const tabs = $$('.model-tabs [role=tab]');
    tabs.forEach((b, i) => {
      b.onclick = () => setTab(b.dataset.tab);
      b.onkeydown = e => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); setTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true); }
      };
    });
    $$('#cols .row').forEach(b => b.onclick = () => openDetail(b.dataset.n, b));
    // swipe between models on phones
    const cols = $('#cols');
    let x0 = null, y0 = null;
    cols.addEventListener('touchstart', e => { if (!MQ.phone.matches) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    cols.addEventListener('touchend', e => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const ks = algsOf(st.year).map(a => a.k), i = ks.indexOf(st.tab);
      setTab(ks[(i + (dx < 0 ? 1 : -1) + ks.length) % ks.length]);
    }, { passive: true });
  }

  // ---------- player detail ----------
  let lastTrigger = null, sources = null, sourcesP = null;
  const loadSources = () => sourcesP || (sourcesP = fetch('sources.json').then(r => r.ok ? r.json() : {}).then(j => (sources = j)).catch(() => (sources = {})));
  function openDetail(name, trigger) {
    st.sel = st.sel === name && MQ.desk.matches ? null : name;
    lastTrigger = trigger || null;
    $$('#cols .row').forEach(b => b.setAttribute('aria-pressed', b.dataset.n === st.sel));
    const d = $('#detail');
    d.innerHTML = detailHtml(st.year, compute(st.year));
    bindDetail();
    if (!st.sel) return;
    if (!MQ.desk.matches) {
      d.classList.add('open'); $('#backdrop').hidden = false; document.body.style.overflow = 'hidden';
      const cb = $('#detail .close'); (cb || d).focus({ preventScroll: true });
    }
    if (!sources && !YEARS[st.year].forecast) loadSources().then(() => {
      if (st.sel !== name || st.view !== 'year') return;
      const d2 = $('#detail'), hadFocus = d2.contains(document.activeElement);
      d2.innerHTML = detailHtml(st.year, compute(st.year)); bindDetail();
      if (hadFocus) { const c = $('#detail .close'); (c && c.offsetParent ? c : d2).focus({ preventScroll: true }); }
    });
  }
  function closeDetail(restoreFocus = true) {
    const d = $('#detail');
    if (d) d.classList.remove('open');
    $('#backdrop').hidden = true; document.body.style.overflow = '';
    if (!MQ.desk.matches) { st.sel = null; $$('#cols .row').forEach(b => b.setAttribute('aria-pressed', 'false')); }
    if (restoreFocus && lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
  }
  function bindDetail() { const c = $('#detail .close'); if (c) c.onclick = () => closeDetail(); }
  $('#backdrop').onclick = () => closeDetail();
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#detail.open')) closeDetail(); });
  MQ.desk.addEventListener('change', () => { if (st.view === 'year') { closeDetail(false); viewYear(); } });

  function detailHtml(y, res) {
    if (!st.sel) return `<div class="empty-detail">${ICON.tap}Pick a player in any column to see their numbers and how each algorithm scores them.</div>`;
    const r = rowsOf(y).find(x => x.name === st.sel);
    if (!r) return '';
    const ctx = M.predCtx(rowsOf(y));
    const place = k => res[k].findIndex(x => x.r === r) + 1;
    const parts = { pred: M.predict(r, weightsOf(y), ctx).parts, fair: M.fair(r).parts, mine: M.mine(r, st.mine).parts };
    const brk = k => {
      const a = alg(k), e = Object.entries(parts[k]).filter(([, v]) => v >= (k === 'pred' ? 0.005 : 0.5)).sort((p, q) => q[1] - p[1]);
      const mx = Math.max(...e.map(x => x[1]), 1e-9);
      return `<div style="--c:${a.c}"><h3><span class="swatch" aria-hidden="true"></span>${a.n}<span class="num">${ord(place(k))} of ${res[k].length}</span></h3>
        ${e.length ? e.map(([n, v]) => `<div class="brk-row"><em title="${esc(n)}">${esc(n)}</em><span class="num">${fmt(v, k === 'pred' ? 2 : 0)}</span><span class="bb" aria-hidden="true"><i style="width:${(v / mx * 100).toFixed(1)}%"></i></span></div>`).join('') : '<p class="meta">No positive parts.</p>'}</div>`;
    };
    // Stat tiles: each number with its unit under it; the numbers wrap as a group instead of running out of the tile.
    const nums = (...p) => `<p class="nums">${p.map(([v, u]) => `<span><b>${v}</b>${u}</span>`).join('')}</p>`;
    const fact = (k, body, sub) => `<div class="fact"><span class="kicker">${k}</span>${body}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    const NONE = '<p class="nums"><span><b>—</b></span></p>';
    const reg = region(r);
    const lgK = r.uT ? `League + ${reg}` : 'League';
    const facts = [
      fact(YEARS[y].forecast ? `${lgK} · so far` : lgK, nums([r.gp, 'games'], [r.g, 'goals'], [r.a, 'assists'])),
      fact(reg, r.uT ? nums([r.uG, 'goals'], [r.uA, 'assists']) : NONE,
        r.uT ? `${CUPN[r.uT]}: ${STAGE[r.uS]} · weight ${fmt(cupWeight(r.uT, y))}` : reg === 'North America' ? 'CONCACAF cups are not counted' : 'no continental competition'),
      fact('National team', r.ntT ? nums([r.ntGP, 'games'], [r.ntG, 'goals'], [r.ntA, 'assists']) : NONE,
        r.ntT ? `${r.ntT}: ${STAGE[r.ntS]}` : 'no national-team tournament'),
      r.cont != null ? fact('Non-attacking*', nums([r.cont, 'of 10']), 'subjective estimate') : '',
    ].join('');
    const spec = [
      ['League', `${esc(r.lg)} <small>strength ${fmt(leagueStrength(r.lg, y))}</small>`],
      ['League title', r.title ? '<span class="mark-ok">Champion</span>' : 'No'],
      ['Window', WIN[r.win]],
    ].map(([k, v]) => `<div><dt class="kicker">${k}</dt><dd>${v}</dd></div>`).join('');
    // Wikipedia links are labelled with the article (one host repeated five times says nothing).
    const srcLabel = u => {
      try {
        const x = new URL(u), h = x.hostname.replace(/^www\./, ''), m = h.match(/^([\w-]+)\.wikipedia\.org$/);
        if (m && x.pathname.startsWith('/wiki/')) return decodeURIComponent(x.pathname.slice(6)).replace(/_/g, ' ') + (m[1] === 'en' ? '' : ` (${m[1]})`);
        return h;
      } catch (e) { return u; }
    };
    const sr = YEARS[y].forecast ? { sources: r.sources || [], note: r.note || '' } : sources ? (sources[y] || {})[r.name] : null;
    const srcH = !sr && !sources ? '<p class="src meta">Loading sources…</p>' : sr && (sr.sources.length || sr.note) ? `<div class="src"><span class="kicker">Sources</span><ul>${sr.sources.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(srcLabel(u))}</a></li>`).join('')}</ul></div>${sr.note ? `<details class="data-note"><summary>Data notes</summary><p>${esc(sr.note)}</p></details>` : ''}` : '';
    return `<div class="detail-head"><div><h2>${esc(r.name)}</h2><p class="who">${esc(r.club)} · ${POS[r.pos]}</p><div class="badges">
        <span class="conf conf-${r.conf}" title="Data confidence: A verified in sources, B partly verified/approximate, C estimate">data ${r.conf}</span>
        <span class="conf conf-${r.aConf}" title="Confidence of the assists only">assists ${r.aConf}</span>
        ${r.rank ? `<span class="tag">voted ${ord(r.rank)}</span>` : ''}${r.elig === 0 ? `<span class="tag" title="Ineligible under the ${y} rules">ineligible in ${y}</span>` : ''}</div></div>
        <button type="button" class="close" aria-label="Close">${ICON.close}</button></div>
      <dl class="spec">${spec}</dl>
      <div class="facts">${facts}</div>
      ${srcH}
      ${r.cont != null ? '<p class="note">*My subjective estimate for midfielders, defenders and goalkeepers, because goals and assists do not measure their impact.</p>' : ''}
      <div class="brk">${MODELS.map(brk).join('')}</div>`;
  }

  // ---------- summary ----------
  function stats() {
    const z = () => ({ w: 0, t3: 0, n: 0, w10: 0, n10: 0, cum: [] });
    const s = { pred: z(), fair: z(), mine: z() }, rows = [];
    done.forEach(y => {
      const res = compute(y), t = targetOf(y), row = { y, t, p: {} };
      MODELS.forEach(k => {
        const top = res[k].map(x => x.r.name), S = s[k];
        row.p[k] = top[0];
        if (t && y <= 2025) {
          S.n++; if (top[0] === t) S.w++; if (top.slice(0, 3).includes(t)) S.t3++;
          if (y >= 2010) { S.n10++; if (top[0] === t) S.w10++; }
        }
        S.cum.push([y, (S.cum.length ? S.cum[S.cum.length - 1][1] : 0) + (t && top[0] === t ? 1 : 0)]);
      });
      rows.push(row);
    });
    return { s, rows };
  }
  function viewSummary() {
    const { s, rows } = stats();
    const r26 = rows.find(o => o.y === 2026);
    const cards = MODELS.map(k => {
      const a = alg(k), S = s[k], ok26 = r26 && r26.t && r26.p[k] === r26.t;
      return `<div class="panel stat" style="--c:${a.c}"><h3><span class="swatch" aria-hidden="true"></span>${a.n}</h3>
        <p class="big num">${S.w}<small>/${S.n}</small></p><p class="meta">winners called right in ${done[0]}–2025</p>
        <ul><li><b class="num">${S.t3}/${S.n}</b> with the winner in the top 3</li><li><b class="num">${S.w10}/${S.n10}</b> in 2010–2025</li><li>2026: <b class="${ok26 ? 'mark-ok' : 'mark-no'}">${ok26 ? '✓ right' : '✗ wrong'}</b></li></ul></div>`;
    }).join('');
    const F = FITS[st.list] || FITS.elig;
    const note = st.list === 'elig' && SEL.temporal
      ? `On the eligible list, each year's Prediction is the forecast that would have been made at the time: weights trained only on earlier years, never seeing that year or later ones. In 2010–2026 it calls ${SEL.nestedWindow.hits} of ${SEL.targets.length}; in 1961–2009, ${SEL.temporalOld[0]} of ${SEL.temporalOld[1]}. In ${done[0]}–${done[0] + 4} there are too few earlier years, so the fit to every year is used (in-sample).`
      : `On the “Everyone” list the Prediction uses a single fit to the retroactive winners of ${F.train[0]}–${F.train[1]}, so the result is in-sample (${F.inSample}/${F.n}); leaving one year out, ${F.loo} of ${F.n}.`;
    const tbl = rows.map(o => {
      const cell = k => { const ok = o.t && o.p[k] === o.t; return `<td data-k="${alg(k).short}" class="${ok ? '' : 'miss'}">${esc(o.p[k])}${ok ? ' <span class="ok" aria-label="right">✓</span>' : ''}</td>`; };
      return `<tr><td class="num"><a href="#/${o.y}">${o.y}</a></td><td data-k="Winner"><b>${o.t ? esc(o.t) : 'not awarded'}</b></td>${cell('pred')}${cell('fair')}${cell('mine')}</tr>`;
    }).join('');
    $('#main').innerHTML = `<div class="page-head"><span class="kicker">Summary</span><h1>How often each model gets it right</h1>
        <p>${st.list === 'all' ? 'All candidates; the target is France Football’s retroactive winner when the best player was ineligible.' : 'Only players who could win under each year’s rules.'} “Custom” follows the sliders in the Years view.</p>${listToggle()}</div>
      <div class="stats">${cards}</div>
      <section class="panel chart-panel"><header><h2>Winners called right, cumulative</h2>
        <div class="legend">${MODELS.map(k => `<span><span class="swatch" style="--c:${alg(k).c}"></span>${alg(k).n}</span>`).join('')}</div></header>
        <div class="chart" id="cum-chart" role="img" aria-label="Cumulative number of winners called right by each model from ${done[0]} to ${DONE}: ${MODELS.map(k => `${alg(k).n} ${s[k].cum[s[k].cum.length - 1][1]}`).join(', ')}. The table below has every year."></div></section>
      <p class="note" style="margin-bottom:16px">${note} The Fair and Custom models were not fitted to the winners.</p>
      <section class="panel"><h2 style="margin-bottom:8px">Every year</h2><div class="scroll"><table class="years-table"><thead><tr><th>Year</th><th>Winner</th>${MODELS.map(k => `<th>${alg(k).n}</th>`).join('')}</tr></thead><tbody>${tbl}</tbody></table></div></section>`;
    $$('[data-list]').forEach(b => b.onclick = () => { st.list = b.dataset.list; save(); viewSummary(); });
    drawCum(s);
  }
  // Cumulative hits: one shared axis, 2px lines, direct labels at the end, crosshair tooltip.
  let cumState = null;
  function drawCum(s) {
    const el = $('#cum-chart');
    if (!el) return;
    cumState = s;
    const W = Math.max(300, el.clientWidth), H = W < 520 ? 230 : 280, m = { l: 34, r: W < 520 ? 74 : 96, t: 12, b: 26 };
    const maxY = Math.max(...MODELS.map(k => s[k].cum[s[k].cum.length - 1][1]), 1);
    const X = y => m.l + (y - done[0]) / (DONE - done[0]) * (W - m.l - m.r);
    const Y = v => H - m.b - v / maxY * (H - m.t - m.b);
    const step = maxY > 30 ? 10 : 5, ticks = [];
    for (let v = 0; v <= maxY; v += step) ticks.push(v);
    const xt = done.filter(y => y % (W < 520 ? 20 : 10) === 0);
    const path = k => s[k].cum.map(([y, v], i) => `${i ? 'L' : 'M'}${X(y).toFixed(1)},${Y(v).toFixed(1)}`).join('');
    // end labels, nudged apart so they never overlap
    const ends = MODELS.map(k => ({ k, v: s[k].cum[s[k].cum.length - 1][1], y: Y(s[k].cum[s[k].cum.length - 1][1]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <g class="grid">${ticks.map(v => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(v => `<text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`).join('')}${xt.map(y => `<text x="${X(y)}" y="${H - 6}" text-anchor="middle">${y}</text>`).join('')}</g>
      ${MODELS.map(k => `<path d="${path(k)}" fill="none" stroke="${getComputedStyle(document.documentElement).getPropertyValue('--c-' + k).trim()}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
      ${ends.map(e => `<text class="lbl" x="${W - m.r + 8}" y="${e.y + 4}">${alg(e.k).short} ${e.v}</text>`).join('')}
      <line class="hover-line" id="cum-hover" y1="${m.t}" y2="${H - m.b}" visibility="hidden"/>
      <g id="cum-dots"></g>
      <rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" id="cum-hit"/>
    </svg><div class="tip" id="cum-tip" hidden></div>`;
    const hit = $('#cum-hit'), tip = $('#cum-tip'), hl = $('#cum-hover'), dots = $('#cum-dots');
    const show = ev => {
      const box = el.getBoundingClientRect(), px = (ev.clientX - box.left) * (W / box.width);
      const y = Math.max(done[0], Math.min(DONE, Math.round(done[0] + (px - m.l) / (W - m.l - m.r) * (DONE - done[0]))));
      const i = done.indexOf(y);
      if (i < 0) return;
      hl.setAttribute('x1', X(y)); hl.setAttribute('x2', X(y)); hl.setAttribute('visibility', 'visible');
      dots.innerHTML = MODELS.map(k => `<circle cx="${X(y)}" cy="${Y(s[k].cum[i][1])}" r="4.5" fill="${getComputedStyle(document.documentElement).getPropertyValue('--c-' + k).trim()}" stroke="var(--panel)" stroke-width="2"/>`).join('');
      tip.innerHTML = `<b>${y}</b>${MODELS.map(k => `<div><span><span class="swatch" style="--c:${alg(k).c}"></span>${alg(k).short}</span><span class="num">${s[k].cum[i][1]}</span></div>`).join('')}`;
      tip.hidden = false;
      const tx = X(y) / W * box.width;
      tip.style.left = Math.min(box.width - tip.offsetWidth - 4, Math.max(4, tx + 12)) + 'px';
      tip.style.top = '8px';
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; hl.setAttribute('visibility', 'hidden'); dots.innerHTML = ''; });
  }
  let rz = null;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (st.view === 'summary' && cumState) drawCum(cumState); }, 120); });

  // ---------- method ----------
  function viewMethod() {
    const FA = FITS.all, n = SEL.targets ? SEL.targets.length : 0;
    const W27 = SEL.temporal && SEL.temporal['2027'] ? SEL.temporal['2027'].weights : CFG.weights;
    const hw = M.PRED_FEATURES.map((f, i) => [f[1], W27[i]]).filter(x => Math.abs(x[1]) > 0.001).sort((a, b) => b[1] - a[1]);
    const mxw = Math.max(...hw.map(x => x[1]));
    const AS = SEL.awardStudy || [], AB = AS[0];
    // criteria that predict more winners in both periods than the 19 alone
    const gain = AS.filter(v => v.extra.length && v.old[0] > AB.old[0] && v.hits >= AB.hits);
    const AWARD_NOTE = !AS.length ? '' : gain.length
      ? `Only ${gain.map(v => v.desc.toLowerCase()).join(' and ')} gained anything: ${gain.map(v => `${v.old[0]} of ${v.old[1]} in 1961–2009 instead of ${AB.old[0]}, ${v.hits} of ${n} in 2010–2026 instead of ${AB.hits}, but with the real winner ranked ${fmt(v.meanRank)} on average instead of ${fmt(AB.meanRank)}`).join('; ')}. With ${AS.length - 1} criteria tried, a year or two more is within what luck gives, so the Prediction keeps its ${M.PRED_FEATURES.length} criteria.`
      : `None of them predicts more winners in both periods, so the Prediction keeps its ${M.PRED_FEATURES.length} criteria.`;
    const V = SEL.memorisedFit || [], base = V.find(v => !v.extra), full = V.filter(v => v.extra && v.inSample === n);
    $('#main').innerHTML = `<div class="page-head"><span class="kicker">Method</span><h1>How it works</h1>
      <p>Three ways to pick the winner from the same numbers: one learnt from past votes, one that looks only at individual performance, and one of my own that mixes the two. Every year since 1956 has the official top 10 plus a few strong players who were not eligible at the time.</p></div>
      <div class="method"><div class="panel prose">
      <h3><span class="swatch" style="--c:var(--c-pred)"></span>Prediction</h3>
      <p>A linear score over ${M.PRED_FEATURES.length} criteria (attacking output, continental-cup stage, national team, league title, position, non-attacking contribution, and versions relative to the year's rivals). The weights come from a linear program that tries to put each winner ahead of every other candidate of their year. For years already awarded the answer is the real vote; what matters is predicting the next year. So the Prediction is judged the way it would be used: to predict year Y it is trained only on years before Y.</p>
      ${SEL.temporal ? `<p>How the training is chosen: for each year, among several windows (from 1956, 1970, 1980, 1990, 2000 or 2005, or only the last 10–25 years), recency weights and regularisation, the combination that would best have predicted the previous 12 years is kept. With this rule it calls ${SEL.nestedWindow.hits} of ${n} in 2010–2026 (real winner ranked ${fmt(SEL.nestedWindow.meanRank)} on average), against ${SEL.baseline.hits} of ${n} when always training on every year since 1956. Old votes hurt the forecast of recent ones: from 2013 on, the rule always picks “train from 2000”. For the next Ballon d'Or the model is: ${esc(SEL.final.label)}, training ${SEL.final.train[0]}–${SEL.final.train[1]} (weights alongside).</p>` : ''}
      ${SEL.nested ? `<p>I also tried keeping only some criteria. Looking at the same years it seemed much better (${SEL.selection.res[0]} of ${n} with ${SEL.selection.chosen.length} criteria), but making that choice only with each year's past drops it to ${SEL.nested.hits} of ${n}, with the real winner ranked ${fmt(SEL.nested.meanRank)} on average: it was overfitting. All ${M.PRED_FEATURES.length} criteria stay.</p>` : ''}
      ${base ? `<p>Fitting the weights to the very years they are judged on makes any model look good. With the ${M.PRED_FEATURES.length} criteria, a fit to 2010–2026 calls ${base.inSample} of ${n} of those same years; adding a single reputation or “star of the tournament” criterion gets ${n} of ${n} (any of: ${full.map(v => esc(v.desc)).join('; ')}). But calling years the model has already seen is memorising them. Predicting each year without seeing it, none of these criteria improves the Prediction: with them it gets between ${Math.min(...full.map(v => v.temporal))} and ${Math.max(...full.map(v => v.temporal))} of ${n}, against ${base.temporal} of ${n} without. So the Prediction does without them.</p>
      <div class="scroll"><table><thead><tr><th>Criteria</th><th>Fitted to 2010–2026 (in-sample)</th><th>Predicting unseen years</th></tr></thead><tbody>${V.map(v => `<tr><td>${v.extra ? `${M.PRED_FEATURES.length} + ` + esc(v.desc) : `The ${M.PRED_FEATURES.length} criteria only`}</td><td class="num">${v.inSample}/${n}</td><td class="num">${v.temporal}/${n}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <p>The “Everyone” list has a separate single fit to the retroactive winners: ${FA.inSample}/${FA.n} in-sample and ${FA.loo}/${FA.n} leaving one year out.</p>
      ${AS.length ? `<h3><span class="swatch" style="--c:var(--c-real)"></span>Trophies and individual awards</h3>
      <p>Every row also records the domestic cup, the league top-scorer title, the European Golden Shoe, the continental and national-team tournament top-scorer titles and the tournament's best-player award, read from Wikipedia. Each was tested on top of the ${M.PRED_FEATURES.length} criteria with the same rule as above (window chosen only with each year's past), on every year from 1961: 1961–2009 decides, 2010–2026 confirms.${AWARD_NOTE ? ' ' + AWARD_NOTE : ''}</p>
      <div class="scroll"><table><thead><tr><th>Added criterion</th><th>Fitted to 2010–2026</th><th>2010–2026 unseen</th><th>1961–2009 unseen</th></tr></thead><tbody>${AS.map(v => `<tr><td>${esc(v.extra.length ? v.desc : `The ${M.PRED_FEATURES.length} criteria only`)}</td><td class="num">${v.inSample}/${n}</td><td class="num">${v.hits}/${n}</td><td class="num">${v.old[0]}/${v.old[1]}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ${FC ? `<h3><span class="swatch" style="--c:var(--gold)"></span>The ${FC.year} forecast</h3>
      <p>Every morning a scheduled job reads the ${FC.season} season so far: standings, goals, assists and games in ${FC.leagues.length} leagues and the Champions League from football-data.org, and the Europa/Conference League stage, domestic cups, Golden Shoe and ${FC.year} national-team tournaments from Wikipedia. The models score the numbers so far as they are, with no projection to a full season, so early in the season output weighs less against titles, stages and position; league leaders count as champions until the season ends. Candidates are the leading scorers and assisters plus a hand-kept list of midfielders, defenders and goalkeepers, whose non-attacking contribution is my estimate. The Prediction uses the weights chosen for ${FC.year} (${esc(SEL.final ? SEL.final.label : '')}).</p>` : ''}
      <h3><span class="swatch" style="--c:var(--c-fair)"></span>Fair</h3>
      <p>Individual performance only, with no team trophies. Goals and assists adjusted for league strength in each decade, with a small bonus for continental club cups, compared with what an elite candidate in that position is expected to produce, and shrunk towards the average when there are few games. For midfielders, defenders and goalkeepers a subjective estimate of the non-attacking contribution is added.</p>
      <h3><span class="swatch" style="--c:var(--c-mine)"></span>Custom</h3>
      <p>About 80% individual performance and 20% team credit. Team credit only counts in proportion to what the player produced in continental cups, for the national team and in the league, so winning without contributing earns nothing. Output against top opposition (continental cups and national-team tournaments) weighs more. Every weight can be changed in the Years view.</p>
      <h2>Data limits</h2>
      <ul>
        <li>The same scope for everyone: league, continental club competition (UEFA and CONMEBOL cups) and national-team final tournaments. Domestic cups and qualifiers are left out of the match numbers.</li>
        <li>Each year has the official top 10 and, where it makes sense, a few strong ineligible players (only in the “Everyone” list). Eligibility: until 1994 Europeans only; 1995–2006 only players at European clubs; since 2007 everyone.</li>
        <li>Window: until 2021 voters judged the calendar year, so the numbers run January to December. When the season could not be split, the season ending that year is used, marked with confidence C. Since 2022 the season counts.</li>
        <li>Confidence: A verified in sources, B partly verified, C estimate. Assists have their own confidence: before about 2005 they are almost always estimated.</li>
        <li>League strength and the weight of the continental cups (Cup Winners' Cup, UEFA Cup, Libertadores) change by decade. They are my estimates, not fitted to the winners.</li>
        <li>The non-attacking contribution is my estimate and weighs a lot for midfielders and defenders.</li>
        <li>The models measure performance, not the narrative that sways voters, and with such a small sample any fit to the winners can overfit.</li>
      </ul>
      <h2>Sources</h2>
      <p>Vote results: Wikipedia, RSSSF and FIFA/France Football. Statistics: the sources consulted for each player appear in their detail in the Years view (sources.json in the repository).</p>
      </div>
      <aside class="side panel"><h2 style="margin-bottom:4px">Prediction weights for ${SEL.final ? SEL.final.train[1] + 1 : 'the next award'}</h2><p class="meta" style="margin-bottom:12px">${SEL.final ? esc(SEL.final.label) : ''}. Criteria with zero weight are hidden.</p>
        <div class="wbars">${hw.map(([l, v]) => `<div class="wbar"><em>${esc(l)}</em><span class="num">${fmt(v)}</span><span class="bb" aria-hidden="true"><i style="width:${(Math.max(0, v) / mxw * 100).toFixed(1)}%"></i></span></div>`).join('')}</div></aside></div>`;
  }

  if (!FC) $$('[data-view=forecast]').forEach(a => { a.hidden = true; });
  window.addEventListener('hashchange', route);
  route();
})();
