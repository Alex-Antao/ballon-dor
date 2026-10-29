// Algoritmos de decisão da Bola de Ouro. Código partilhado entre Node (validação) e browser (site).
(function (root) {
  const DATA = (typeof module !== 'undefined' && typeof require !== 'undefined') ? require('./data.js') : root.BDO_DATA;
  const { leagueStrength, cupWeight, NTMULT } = DATA;

  const tanh = Math.tanh;
  const isAtt = p => p === 'FW' || p === 'W' || p === 'AM';
  // Produção "de referência" por jogo de um candidato de elite em cada posição (ajuste por posição)
  const POS_BENCH = { FW: 1.0, W: 0.85, AM: 0.80, CM: 0.50, DM: 0.40, DF: 0.35, GK: 0 };

  // ---------- Peças comuns ----------
  // Peso da competição continental na época (Taça dos Campeões/UCL = 1). Sem prova indicada, a produção conta como UCL.
  const cupW = r => cupWeight(r.uT || 'UCL', r.y);
  // Fase continental na escala UCL (0–5): fase atingida × peso da prova nessa época
  const uStageEff = r => r.uS * cupWeight(r.uT, r.y);
  const ntWinW = r => r.ntS === 5 ? ({ AFCON: 0.6, ASIAN: 0.5, GOLD: 0.5 }[r.ntT] || 1) : 0;

  function parts(r, o) {
    const aw = o.assistW, lm = leagueStrength(r.lg, r.y), nm = NTMULT[r.ntT] || 1, cw = cupW(r);
    const club = (r.g + aw * r.a) * lm;
    const eu = o.euBonus * cw * (r.uG + aw * r.uA) * lm;  // crédito extra pela oposição europeia
    const nt = (r.ntG + aw * r.ntA) * nm * (o.ntBoost || 1);
    return { club, eu, nt, total: club + eu + nt, games: r.gp + r.ntGP,
             uProd: cw * (r.uG + aw * r.uA), nProd: r.ntG + aw * r.ntA };
  }

  // Pontuação individual 0–100 ajustada por posição, força da liga e minutos (encolhimento bayesiano)
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

  // ---------- Algoritmo 2: "Justo" (só desempenho individual) ----------
  const FAIR_DEFAULT = { assistW: 0.75, euBonus: 0.15, ntBoost: 1, shrinkK: 10, rateShare: 0.55, wCont: 0.22, wContGK: 0.45 };
  function fair(r, o) {
    o = Object.assign({}, FAIR_DEFAULT, o);
    const s = individual(r, o);
    return { score: s.final, parts: { 'Produção ajustada (golos+assist.)': s.out * (isAtt(r.pos) ? 1 : (1 - (r.pos === 'GK' ? o.wContGK : o.wCont))),
                                       'Contributo não ofensivo (estimado)': s.contPart } };
  }

  // ---------- Algoritmo 3: "O meu" ----------
  // Individual (≈80%) + crédito de equipa PROPORCIONAL ao contributo do próprio jogador (≈20%)
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
      'Produção ajustada (golos+assist.)': (1 - o.wTeam) * s.out * (na ? (1 - (r.pos === 'GK' ? o.wContGK : o.wCont)) : 1),
      'Contributo não ofensivo (estimado)': (1 - o.wTeam) * s.contPart,
      'Crédito de equipa (proporcional ao contributo)': o.wTeam * team } };
  }

  // ---------- Algoritmo 1: "Histórico" (regras calibradas para reproduzir os vencedores) ----------
  const HIST_FEATURES = [
    ['prod',      'Produção total (golos+assist., ajustada à liga)'],
    ['uStage',    'Fase atingida na Europa'],
    ['uWin',      'Campeão europeu (UCL)'],
    ['uProd',     'Golos+assist. na Europa'],
    ['ntStage',   'Fase no torneio de seleções'],
    ['ntWin',     'Campeão de seleções'],
    ['wcFinal',   'Finalista/campeão do Mundial'],
    ['ntProd',    'Golos+assist. no torneio de seleções'],
    ['title',     'Campeão nacional'],
    ['cont',      'Contributo não ofensivo (estimado)'],
    ['prodRel',   'Produção relativa aos rivais do ano'],
    ['uProdRel',  'Produção europeia relativa aos rivais'],
    ['isAtt',     'Posição ofensiva (viés dos votantes)'],
    ['goalsRel',  'Golos relativos ao melhor marcador do ano'],
    ['uFinal',    'Chegou à final europeia'],
    ['uWinXprod', 'Campeão europeu × produção relativa'],
    ['ntWinXatt', 'Campeão de seleções × atacante'],
    ['ntFinal',   'Chegou à final do torneio de seleções'],
    ['prodXtitle','Produção relativa × campeão nacional'],
  ];
  // ctx = máximos do ano (para features relativas)
  function histCtx(rows) {
    const o = { assistW: 0.75, euBonus: 0, ntBoost: 1 };
    return { mx: Math.max(...rows.map(r => parts(r, o).total / 50)), mu: Math.max(...rows.map(r => Math.min(parts(r, o).uProd, 20) / 10)),
             gm: Math.max(...rows.map(r => r.g)) };
  }
  function histFeatures(r, c) {
    const p = parts(r, { assistW: 0.75, euBonus: 0, ntBoost: 1 });
    const prod = p.total / 50, uProd = Math.min(p.uProd, 20) / 10, ntProd = Math.min(p.nProd, 14) / 8;
    const att = isAtt(r.pos) ? 1 : 0, cs = cupWeight(r.uT, r.y), uWin = r.uS === 5 ? cs : 0;
    const ntWin = ntWinW(r), title = r.title;
    const prodRel = c.mx ? prod / c.mx : 0;
    return [prod, uStageEff(r) / 5, uWin, uProd, r.ntS / 5, ntWin, (r.ntT === 'WC' && r.ntS >= 4) ? 1 : 0, ntProd, title,
            (!att && r.cont != null) ? r.cont / 10 : 0, prodRel, c.mu ? uProd / c.mu : 0, att, c.gm ? r.g / c.gm : 0,
            r.uS >= 4 ? cs : 0, prodRel * uWin, ntWin * att, r.ntS >= 4 ? 1 : 0, prodRel * title];
  }
  function hist(r, w, c) {
    const f = histFeatures(r, c);
    let s = 0; const parts_ = {};
    f.forEach((x, i) => { s += w[i] * x; if (w[i] * x) parts_[HIST_FEATURES[i][1]] = w[i] * x; });
    return { score: s, parts: parts_ };
  }

  // ---------- Utilitários ----------
  // Duas listas por ano: 'elig' = só quem podia ganhar segundo as regras do ano; 'all' = todos (incl. inelegíveis).
  const listRows = (Y, list) => list === 'all' ? Y.rows : Y.rows.filter(r => r.elig !== 0);
  // Alvo de cada lista: vencedor oficial; na lista 'all', o retroativo da France Football quando existe.
  const target = (Y, list) => list === 'all' ? (Y.realAll || Y.real) : Y.real;
  function rankYear(rows, fn) {
    const sc = rows.map(r => ({ r, ...fn(r) }));
    sc.sort((a, b) => b.score - a.score);
    return sc;
  }

  const api = { POS_BENCH, isAtt, parts, uStageEff, listRows, target, individual, fair, mine, hist, histFeatures, histCtx, HIST_FEATURES, rankYear,
                FAIR_DEFAULT, MINE_DEFAULT };
  if (typeof module !== 'undefined') module.exports = api; else root.BDO_MODELS = api;
})(typeof window !== 'undefined' ? window : globalThis);
