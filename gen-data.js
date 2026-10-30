// Junta data-src/*.json + eras.js em data.js (dados sem fontes) e sources.json (fontes por ano/jogador).
// Uso: node gen-data.js   (falha se houver erros de validação; avisos não bloqueiam)
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'data-src');
const files = fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f)).sort();
const eras = fs.readFileSync(path.join(__dirname, 'eras.js'), 'utf8');
const E = new Function(eras + '\nreturn { LEAGUE_ERA, CUP_ERA, NTMULT };')();

const FIELDS = ['name', 'club', 'lg', 'pos', 'gp', 'g', 'a', 'uT', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntT', 'ntS',
                'title', 'cont', 'rank', 'elig', 'win', 'conf', 'aConf'];
const NUM = ['gp', 'g', 'a', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntS', 'title', 'elig'];
const POS = new Set(['FW', 'W', 'AM', 'CM', 'DM', 'DF', 'GK']);
const ATT = new Set(['FW', 'W', 'AM']);

const errors = [], warns = [];
const YEARS = {}, SOURCES = {};

for (const f of files) {
  const blk = JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));
  for (const [y, Y] of Object.entries(blk)) {
    const at = `${f} ${y}`;
    if (YEARS[y]) errors.push(`${at}: ano repetido`);
    if (!['CY', 'P'].includes(Y.window)) errors.push(`${at}: window inválida ${Y.window}`);
    const rows = [], seen = new Set();
    SOURCES[y] = {};
    for (const r0 of Y.rows) {
      const r = {};
      for (const k of FIELDS) r[k] = r0[k];
      const w = `${at} ${r.name}`;
      if (seen.has(r.name)) errors.push(`${w}: jogador repetido`);
      seen.add(r.name);
      for (const k of NUM) if (typeof r[k] !== 'number' || !isFinite(r[k])) errors.push(`${w}: ${k} não numérico (${r[k]})`);
      if (!POS.has(r.pos)) errors.push(`${w}: pos ${r.pos}`);
      if (!['A', 'B', 'C'].includes(r.conf) || !['A', 'B', 'C'].includes(r.aConf)) errors.push(`${w}: conf/aConf`);
      if (!['CY', 'S', 'P'].includes(r.win)) errors.push(`${w}: win ${r.win}`);
      if (r.uS < 0 || r.uS > 5 || r.ntS < 0 || r.ntS > 5) errors.push(`${w}: fase fora de 0–5`);
      if (r.uG > r.g || r.uA > r.a) warns.push(`${w}: produção europeia > total`);
      if (!(r.uT in E.CUP_ERA)) errors.push(`${w}: uT ${r.uT}`);
      if (r.uS > 0 && !r.uT) { warns.push(`${w}: uS>0 sem uT → UCL`); r.uT = 'UCL'; }
      if (!(r.ntT in E.NTMULT)) errors.push(`${w}: ntT ${r.ntT}`);
      if (!(r.lg in E.LEAGUE_ERA)) warns.push(`${w}: liga ${r.lg} sem força definida (usa valor por defeito)`);
      if (ATT.has(r.pos)) r.cont = null;
      else if (r.cont == null) warns.push(`${w}: ${r.pos} sem cont`);
      if (r.rank == null) r.rank = null;
      if (r.win === 'S' && r.conf !== 'C') { warns.push(`${w}: win S mas conf ${r.conf} → C`); r.conf = 'C'; }
      rows.push(r);
      if (r0.sources && r0.sources.length || r0.note) SOURCES[y][r.name] = { sources: r0.sources || [], note: r0.note || '' };
    }
    const elig = rows.filter(r => r.elig);
    if (Y.real && !elig.some(r => r.name === Y.real)) errors.push(`${at}: vencedor ${Y.real} não está entre os elegíveis`);
    if (Y.realAll && !rows.some(r => r.name === Y.realAll)) errors.push(`${at}: realAll ${Y.realAll} não está nas linhas`);
    YEARS[y] = { label: Y.label, award: Y.award, real: Y.real, realAll: Y.realAll || null, realAllNote: Y.realAllNote || '',
                 window: Y.window, notes: Y.notes || '', rows };
    if (Y.notes) SOURCES[y]._notes = Y.notes;
  }
}

warns.forEach(w => console.warn('aviso:', w));
if (errors.length) { errors.forEach(e => console.error('ERRO:', e)); process.exit(1); }

const ys = Object.keys(YEARS).map(Number).sort((a, b) => a - b);
const cnt = { A: 0, B: 0, C: 0 }, acnt = { A: 0, B: 0, C: 0 };
let n = 0;
ys.forEach(y => YEARS[y].rows.forEach(r => { n++; cnt[r.conf]++; acnt[r.aConf]++; }));

const head = `// GERADO por gen-data.js a partir de data-src/*.json e eras.js — não editar à mão.
// Dataset: candidatos à Bola de Ouro ${ys[0]}–${ys[ys.length - 1]} (${n} linhas; conf A ${cnt.A} / B ${cnt.B} / C ${cnt.C}; assistências A ${acnt.A} / B ${acnt.B} / C ${acnt.C}).
// Especificação completa dos campos: data-src/SPEC.md. Fontes por linha: sources.json.
// Âmbito único: LIGA + COMPETIÇÃO CONTINENTAL DE CLUBES + FASE FINAL de torneio de seleções (sem taças nacionais nem qualificação).
// Janela (window): CY = ano civil (até 2021), P = época oficial (2022+). Por linha, win = CY/P ou S (recurso: época que termina em Y).
//
// Campos: name, club, lg, pos, gp, g, a, uT, uG, uA, uS, ntGP, ntG, ntA, ntT, ntS, title, cont, rank, elig, win, conf, aConf (+ y)
//  uT/uS   = competição continental (UCL/CWC/UEL/ECL/LIB/SUD) e fase 0..5 (sem desconto; o peso da prova está em CUP_ERA)
//  elig    = 1 se podia ganhar segundo as regras desse ano (lista "elegíveis"); 0 = só entra na lista "todos"
//  real    = vencedor oficial; realAll = vencedor retroativo da France Football (2016) quando o melhor era inelegível
//  cont    = contributo não ofensivo estimado 0–10 (ESTIMATIVA SUBJETIVA, null nos avançados)
//  conf    = A verificado em fontes, B parcialmente verificado/aproximado, C estimativa; aConf = o mesmo só para assistências
`;
const body = 'const YEARS = ' + JSON.stringify(YEARS, null, 0).replace(/\{"label"/g, '\n{"label"').replace(/\{"name"/g, '\n  {"name"') + ';\n' +
  `for (const y in YEARS) YEARS[y].rows.forEach(r => { r.y = +y; });\n\n`;
fs.writeFileSync(path.join(__dirname, 'data.js'), head + body + eras +
  `\nif (typeof module !== 'undefined') module.exports = { YEARS, LEAGUE_ERA, CUP_ERA, NTMULT, leagueStrength, cupWeight };\n`);
fs.writeFileSync(path.join(__dirname, 'sources.json'), JSON.stringify(SOURCES, null, 1));
console.log(`data.js: ${ys.length} anos, ${n} linhas (A ${cnt.A} / B ${cnt.B} / C ${cnt.C}); ${warns.length} avisos`);
