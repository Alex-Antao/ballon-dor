// 2.ª passagem: para cada linha de um bloco, obtém valores da Wikipédia e compara com o data-src.
// Uso: node verify.js <ficheiro do bloco> [anos...]   → escreve verify/work/prop/<ano>.json e imprime resumo
const fs = require('fs');
const path = require('path');
const C = require('./club.js');
const N = require('./nt.js');
const E = require('./eu.js');
const REPO = path.join(__dirname, '..', 'data-src') + '/';
const [file, ...only] = process.argv.slice(2);
const blk = JSON.parse(fs.readFileSync(REPO + file, 'utf8'));
const OUT = path.join(__dirname, 'work', 'prop');
fs.mkdirSync(OUT, { recursive: true });
// Prova continental mais importante jogada na época e fase atingida nela (0–5, pela distância à final)
function uStage(rounds) {
  const comps = [['UCL', /champions league|european cup/i], ['CWC', /cup winners/i], ['UEL', /europa league|uefa cup|fairs cup|inter-cities/i], ['ECL', /conference league/i],
                 ['LIB', /libertadores/i], ['SUD', /sudamericana/i]];
  // prova cuja fase a eliminar o clube jogou (se jogou em duas, a mais importante); senão a mais importante
  const found = [];
  for (const [uT, re] of comps) {
    const rs = rounds.filter(r => re.test(r) && !/qualif|play-off|playoff/i.test(r));
    if (!rounds.some(r => re.test(r))) continue;
    let s = 0, fin = null, ko = false;
    for (const r of rs) {
      const c = r.toLowerCase();
      let v = 0;
      if (/knockout|round of|last 16|last 32|quarter|semi|\bfinal\b|\bqf\b|\bsf\b|\br16\b/.test(c)) ko = true;
      if (/\bfinal\b/.test(c) && !/semi|quarter|eighth/.test(c)) { v = 4; fin = r; }
      else if (/semi|\bsf\b/.test(c)) v = 3;
      else if (/quarter|\bqf\b/.test(c)) v = 2;
      else if (/round of 16|last 16|eighth|1\/8|\br16\b/.test(c)) v = 1;
      s = Math.max(s, v);
    }
    if (s === 4) { if (/\sW\s*$/.test(fin)) s = 5; else if (!/\sL\s*$/.test(fin)) s = null; }
    found.push({ uT, uS: s, ko });
  }
  return found.find(f => f.ko) || found[0] || null;
}
const url = t => 'https://en.wikipedia.org/wiki/' + encodeURI(t.replace(/ /g, '_'));

for (const [ys, Y] of Object.entries(blk)) {
  if (only.length && !only.includes(ys)) continue;
  const y = +ys, win = Y.window;
  const props = [];
  console.log(`\n=== ${y} (${win}) ===`);
  for (const r of Y.rows) {
    const P = { name: r.name, src: [], issues: [], set: {} };
    let club = null, nt = null;
    try { club = C.clubWindow(r.name, y, win, r.lg); } catch (e) { P.issues.push('clube: ' + e.message); }
    if (club) {
      P.title = club.title; P.src.push(url(club.title));
      P.issues.push(...club.issues);
      club.seasons.forEach(S => { if (S.page) P.src.push(url(S.page)); });
      if (club.seasons.length) {
        P.set.gp = club.gp; P.set.g = club.g; P.set.uG = club.uG;
        P.clubOk = club.ok; P.gExact = club.gExact; P.gpEst = club.gpEst;
        P.sMode = !!club.sMode; P.partial = !!club.partial; P.noEu = !!club.noEu;
        P.seasons = club.seasons.map(S => `${S.club} ${S.season} L${JSON.stringify(S.lg)} E${JSON.stringify(S.eu)}${S.euKey ? '' : '(sem col. Europa)'}`);
        P.chk = club.seasons.flatMap(S => [S.Lchk, S.Uchk].filter(Boolean));
      }
      // título: ≥ 1/3 dos jogos de liga do clube (sem página de época: 1/3 de 34); jogos desconhecidos → não decide;
      // Argentina 1991–2014 (Apertura/Clausura, dois campeões por época) → manual
      // (e RFA antes da Bundesliga: o campeão era decidido na fase final nacional, não nas Oberligen regionais)
      const shortARG = (r.lg === 'ARG' && y >= 1991 && y <= 2014) || r.lg === 'GER';
      if (club.titleChk && club.titleChk.length && !shortARG && club.titleChk.every(t => t.apps != null)) {
        const t = club.titleChk.find(t => t.won) || club.titleChk[0];
        const need = t => Math.ceil((t.rounds || 34) / 3);
        P.titleChk = `${t.page}: campeão ${t.champ} → ${t.won ? 'SIM' : 'não'} (${t.apps} j, mínimo ${need(t)})`;
        P.set.title = club.titleChk.some(t => t.won && t.apps >= need(t)) ? 1 : 0;
        club.titleChk.forEach(t => P.src.push(url(t.page)));
      }
      if (club.uRounds) P.uRounds = club.uRounds;
      // fase europeia pela página da edição que termina em y (clube onde fez mais jogos de liga nessa época)
      const sea = a => a === 1999 ? '1999–2000' : `${a}–${String(a + 1).slice(2)}`;
      const sY = sea(y - 1), sN = sea(y);
      const pick = part => club.seasons.filter(S => S.part === part).sort((a, b) => (b.lg[0] || 0) - (a.lg[0] || 0))[0];
      const S1 = pick(y) || pick('CY');
      const who = S => ({ link: S.clubLink, names: [S.club.replace(/\s*\(.*\)/, '').trim()] });
      try {
        if (S1) {
          const e = E.euStage(sY, y, who(S1));
          if (e && !e.none) { P.euEd = e; P.src.push(url(e.edition)); }
          else if (e && e.none) {
            // sem edição a terminar em y: prova jogada no outono (uS 0), se houver
            const S2 = win === 'CY' ? (pick(y + 1) || S1) : null;
            const e2 = S2 ? E.euStage(sN, y + 1, who(S2)) : null;
            P.euNone = e2 && !e2.none ? { uT: e2.uT, why: `só outono (${e2.edition})` } : { uT: '', why: 'sem prova europeia nas edições consultadas' };
            if (e2 && !e2.none) P.src.push(url(e2.edition));
          }
        }
      } catch (err) { P.issues.push('edição europeia: ' + err.message); }
    }
    if (r.ntT) {
      try { nt = N.ntStats(club && club.title || C.titleFor(r.name, y), r.ntT, y, win); } catch (e) { P.issues.push('selecção: ' + e.message); }
      if (nt && !nt.issue && nt.team) {
        P.set.ntGP = nt.apps; P.set.ntG = nt.goals; P.set.ntS = nt.stage;
        P.ntInfo = `${nt.main} ${nt.team}: ${nt.apps}/${nt.teamGames} j, ${nt.goals} g, fase ${nt.stage} (campeão ${nt.champ})` + (nt.noLineup ? ` [${nt.noLineup} jogos sem onze]` : '');
        P.ntLineups = !nt.noLineup && nt.matches.every(m => m.lineup);
        P.ntTeamGames = nt.teamGames;
        P.src.push(url(nt.main));
      } else P.issues.push('selecção: ' + (nt && nt.issue || 'jogador não encontrado no torneio'));
    }
    P.src = [...new Set(P.src)];
    props.push(P);
    const diff = Object.entries(P.set).filter(([k, v]) => r[k] !== v).map(([k, v]) => `${k} ${r[k]}→${v}`);
    console.log(`${r.name.padEnd(22)} ${diff.join(', ') || '(igual)'}${P.gExact === false ? ' [golos inexatos]' : ''}${P.clubOk === false ? ' [clube incompleto]' : ''}`);
    if (P.issues.length) console.log('   ! ' + P.issues.join(' | '));
    if (P.titleChk) console.log('   t ' + P.titleChk);
    if (P.ntInfo) console.log('   n ' + P.ntInfo);
    if (P.uRounds) {
      const u = uStage(P.uRounds);
      if (u) { P.set.uT = u.uT; if (u.uS != null) P.set.uS = u.uS; P.uOk = u.uS != null; }
      P.uSrc = 'época';
    }
    if (P.euEd) {
      const e = P.euEd;
      if (P.uOk && (P.set.uT !== e.uT || P.set.uS !== e.uS)) P.issues.push(`fase europeia: página de época ${P.set.uT} ${P.set.uS} ≠ edição ${e.uT} ${e.uS}`);
      if (e.uS != null) { P.set.uT = e.uT; P.set.uS = e.uS; P.uOk = true; P.uSrc = 'edição'; }
    } else if (P.euNone) { P.set.uT = P.euNone.uT; P.set.uS = 0; P.uOk = true; P.uSrc = P.euNone.why; }
    if (P.uOk) console.log(`   u ${r.uT} ${r.uS} → ${P.set.uT} ${P.set.uS} (${P.uSrc}${P.euEd ? ': ' + P.euEd.edition + ' / ' + P.euEd.reached : ''})`);
  }
  fs.writeFileSync(path.join(OUT, ys + '.json'), JSON.stringify(props, null, 1));
}
