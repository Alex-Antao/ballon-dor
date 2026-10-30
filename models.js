// Ballon d'Or decision algorithms. Shared between Node (pipeline, tests) and the browser (site).
(function (root) {
  const DATA = (typeof module !== 'undefined' && typeof require !== 'undefined') ? require('./data.js') : root.BDO_DATA;
  const { leagueStrength, cupWeight, NTMULT } = DATA;

  const tanh = Math.tanh;
  const isAtt = p => p === 'FW' || p === 'W' || p === 'AM';
  // Reference output per game of an elite candidate in each position (position adjustment)
  const POS_BENCH = { FW: 1.0, W: 0.85, AM: 0.80, CM: 0.50, DM: 0.40, DF: 0.35, GK: 0 };

  // ---------- Shared pieces ----------
  // Weight of the continental competition in that era (European Cup/UCL = 1). With no competition given, output counts as UCL.
  const cupW = r => cupWeight(r.uT || 'UCL', r.y);
  // Continental stage on the UCL scale (0–5): stage reached × weight of the competition in that era
  const uStageEff = r => r.uS * cupWeight(r.uT, r.y);
  const ntWinW = r => r.ntS === 5 ? ({ AFCON: 0.6, ASIAN: 0.5, GOLD: 0.5 }[r.ntT] || 1) : 0;

  function parts(r, o) {
    const aw = o.assistW, lm = leagueStrength(r.lg, r.y), nm = NTMULT[r.ntT] || 1, cw = cupW(r);
    const club = (r.g + aw * r.a) * lm;
    const eu = o.euBonus * cw * (r.uG + aw * r.uA) * lm;  // extra credit for continental-cup opposition
    const nt = (r.ntG + aw * r.ntA) * nm * (o.ntBoost || 1);
    return { club, eu, nt, total: club + eu + nt, games: r.gp + r.ntGP,
             uProd: cw * (r.uG + aw * r.uA), nProd: r.ntG + aw * r.ntA };
  }

  // Individual score 0–100 adjusted for position, league strength and games played (Bayesian shrinkage)
  function individual(r, o) {
    const p = parts(r, o), bench = POS_BENCH[r.pos];
    let out = 0, rateS = 0, volS = 0;
    if (bench > 0) {
      const mu = bench * 0.5;
      const rate = (p.total + o.shrinkK * mu) / (p.games + o.shrinkK);
      rateS = rate / bench;
      volS = p.total / (bench * 50);
      out = 100 * tanh(0.8 * (o.rateShare * rateS + (1 - o.rateShare) * volS));
    }
    let final = out, contPart = 0;
    if (!isAtt(r.pos) && r.cont != null) {
      const wc = r.pos === 'GK' ? o.wContGK : o.wCont;
      contPart = wc * r.cont * 10;
      final = (1 - wc) * out + contPart;
    }
    return { final, out, rateS, volS, contPart, prod: p };
  }

  // ---------- Algorithm 2: "Fair" (individual performance only) ----------
  const FAIR_DEFAULT = { assistW: 0.75, euBonus: 0.15, ntBoost: 1, shrinkK: 10, rateShare: 0.55, wCont: 0.22, wContGK: 0.45 };
  function fair(r, o) {
    o = Object.assign({}, FAIR_DEFAULT, o);
    const s = individual(r, o);
    return { score: s.final, parts: { 'Adjusted output (goals + assists)': s.out * (isAtt(r.pos) ? 1 : (1 - (r.pos === 'GK' ? o.wContGK : o.wCont))),
                                       'Non-attacking contribution (estimated)': s.contPart } };
  }

  // ---------- Algorithm 3: "Mine" ----------
  // Individual (≈80%) + team credit PROPORTIONAL to the player's own contribution (≈20%)
  const MINE_DEFAULT = { assistW: 0.70, euBonus: 0.30, ntBoost: 1.10, shrinkK: 12, rateShare: 0.50, wCont: 0.22, wContGK: 0.40, wTeam: 0.20 };
  function mine(r, o) {
    o = Object.assign({}, MINE_DEFAULT, o);
    const s = individual(r, o);
    const na = !isAtt(r.pos) && r.cont != null;
    const euContrib = s.prod.uProd + (na ? (r.cont / 10) * 4 : 0);
    const ntContrib = s.prod.nProd + (na ? (r.cont / 10) * 3 : 0);
    const euCredit = 0.45 * (uStageEff(r) / 5) * Math.min(1, euContrib / 6);
    const ntCredit = 0.35 * (r.ntS / 5) * Math.min(1, ntContrib / 4);
    const lgCredit = 0.20 * r.title * Math.min(1, s.prod.club / 20);
    const team = 100 * (euCredit + ntCredit + lgCredit);
    const score = (1 - o.wTeam) * s.final + o.wTeam * team;
    return { score, parts: {
      'Adjusted output (goals + assists)': (1 - o.wTeam) * s.out * (na ? (1 - (r.pos === 'GK' ? o.wContGK : o.wCont)) : 1),
      'Non-attacking contribution (estimated)': (1 - o.wTeam) * s.contPart,
      'Team credit (proportional to contribution)': o.wTeam * team } };
  }

  // ---------- Algorithm 1: "Prediction" (weights fitted to the winners of earlier years) ----------
  const PRED_FEATURES = [
    ['prod',      'Total output (goals + assists, league-adjusted)'],
    ['uStage',    'Stage reached in the continental cup'],
    ['uWin',      'Continental champion (UCL = 1)'],
    ['uProd',     'Goals + assists in the continental cup'],
    ['ntStage',   'Stage in the national-team tournament'],
    ['ntWin',     'National-team champion'],
    ['wcFinal',   'World Cup finalist/champion'],
    ['ntProd',    'Goals + assists in the national-team tournament'],
    ['title',     'League champion'],
    ['cont',      'Non-attacking contribution (estimated)'],
    ['prodRel',   "Output relative to the year's rivals"],
    ['uProdRel',  'Continental output relative to rivals'],
    ['isAtt',     'Attacking position (voter bias)'],
    ['goalsRel',  "Goals relative to the year's top scorer"],
    ['uFinal',    'Reached the continental final'],
    ['uWinXprod', 'Continental champion × relative output'],
    ['ntWinXatt', 'National-team champion × attacker'],
    ['ntFinal',   'Reached the national-team final'],
    ['prodXtitle','Relative output × league champion'],
  ];
  // ctx = the year's maxima (for the relative features)
  function predCtx(rows) {
    const o = { assistW: 0.75, euBonus: 0, ntBoost: 1 };
    return { mx: Math.max(...rows.map(r => parts(r, o).total / 50)), mu: Math.max(...rows.map(r => Math.min(parts(r, o).uProd, 20) / 10)),
             gm: Math.max(...rows.map(r => r.g)) };
  }
  function predFeatures(r, c) {
    const p = parts(r, { assistW: 0.75, euBonus: 0, ntBoost: 1 });
    const prod = p.total / 50, uProd = Math.min(p.uProd, 20) / 10, ntProd = Math.min(p.nProd, 14) / 8;
    const att = isAtt(r.pos) ? 1 : 0, cs = cupWeight(r.uT, r.y), uWin = r.uS === 5 ? cs : 0;
    const ntWin = ntWinW(r), title = r.title;
    const prodRel = c.mx ? prod / c.mx : 0;
    return [prod, uStageEff(r) / 5, uWin, uProd, r.ntS / 5, ntWin, (r.ntT === 'WC' && r.ntS >= 4) ? 1 : 0, ntProd, title,
            (!att && r.cont != null) ? r.cont / 10 : 0, prodRel, c.mu ? uProd / c.mu : 0, att, c.gm ? r.g / c.gm : 0,
            r.uS >= 4 ? cs : 0, prodRel * uWin, ntWin * att, r.ntS >= 4 ? 1 : 0, prodRel * title];
  }
  function predict(r, w, c) {
    const f = predFeatures(r, c);
    let s = 0; const parts_ = {};
    f.forEach((x, i) => { s += w[i] * x; if (w[i] * x) parts_[PRED_FEATURES[i][1]] = w[i] * x; });
    return { score: s, parts: parts_ };
  }

  // ---------- Utilities ----------
  // Two lists per year: 'elig' = only those who could win under that year's rules; 'all' = everyone (incl. ineligible).
  const listRows = (Y, list) => list === 'all' ? Y.rows : Y.rows.filter(r => r.elig !== 0);
  // Target of each list: the official winner; in the 'all' list, France Football's retroactive winner when there is one.
  const target = (Y, list) => list === 'all' ? (Y.winnerAll || Y.winner) : Y.winner;
  function rankYear(rows, fn) {
    const sc = rows.map(r => ({ r, ...fn(r) }));
    sc.sort((a, b) => b.score - a.score);
    return sc;
  }

  const api = { POS_BENCH, isAtt, parts, uStageEff, listRows, target, individual, fair, mine, predict, predFeatures, predCtx, PRED_FEATURES, rankYear,
                FAIR_DEFAULT, MINE_DEFAULT };
  if (typeof module !== 'undefined') module.exports = api; else root.BDO_MODELS = api;
})(typeof window !== 'undefined' ? window : globalThis);
