// Aplica as propostas (verify/work/prop/<ano>.json) ao data-src, com regras de confiança do SPEC.
// Uso: node apply.js <ficheiro do bloco> [anos...]
// Overrides manuais em verify/overrides.json: { "ano": { "nome": { campo: valor, ..., "_note": "...", "_skip": ["g", ...] } } }
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', 'data-src') + '/';
const [file, ...only] = process.argv.slice(2);
const F = REPO + file;
const SRC = fs.readFileSync(F, 'utf8');
const IND = (/^\{\r?\n( +)/.exec(SRC) || [0, ' '])[1].length;
const blk = JSON.parse(SRC);
const D = __dirname;
const OV = fs.existsSync(path.join(D, 'overrides.json')) ? JSON.parse(fs.readFileSync(path.join(D, 'overrides.json'))) : {};
const BOILER = [/Estatísticas de memória[^.]*?\([^)]*\)\.\s*/g, /Estatísticas de memória, NÃO verificadas na web\.?\s*/g,
                /\s*\(WebFetch bloqueado[^)]*\)/g];
const rank = c => ({ A: 3, B: 2, C: 1 })[c];
const minC = (...cs) => cs.reduce((a, b) => rank(a) <= rank(b) ? a : b);
let changed = 0;

for (const [ys, Y] of Object.entries(blk)) {
  if (only.length && !only.includes(ys)) continue;
  const pf = path.join(__dirname, 'work', 'prop', ys + '.json');
  if (!fs.existsSync(pf)) continue;
  const props = JSON.parse(fs.readFileSync(pf));
  const ov = OV[ys] || {};
  for (const r of Y.rows) {
    const P = props.find(p => p.name === r.name);
    if (!P) continue;
    const o = ov[r.name] || {};
    const skip = new Set(o._skip || []);
    const msgs = [];
    const set = (k, v, why) => { if (skip.has(k) || v == null) return; if (r[k] !== v) { msgs.push(`${k} ${r[k]}→${v}`); r[k] = v; changed++; } };
    let cClub = null, cNt = null, cTit = null;
    const P_ = Y.window === 'P';
    // tabela de carreira sem coluna europeia e jogador com jogos europeus: não dá para separar → fica como estava
    const euGap = P.noEu && (r.uT || (P.set.uT && P.set.uT !== ''));
    if (P.seasons && P.clubOk !== false && !o._noClub && !euGap) {
      set('gp', P.set.gp); set('g', P.set.g); set('uG', P.set.uG);
      if (P.sMode) { cClub = 'C'; r.win = 'S'; }
      else { cClub = P_ ? 'A' : 'B'; r.win = P_ ? 'P' : 'CY'; }
    }
    if (P.set.ntS != null && r.ntT && !o._noNt) {
      // sem onzes em todos os jogos: jogos = o maior entre os contados e o anterior, limitado aos jogos da equipa
      if (P.ntLineups) set('ntGP', P.set.ntGP);
      else set('ntGP', Math.min(Math.max(P.set.ntGP, r.ntGP), P.ntTeamGames || 99));
      set('ntG', P.set.ntG);
      // formatos com 2.ª fase de grupos/liga: a fase fica a manual (escala pela distância à final)
      const yy = +ys, odd = (r.ntT === 'WC' && [1974, 1978, 1982].includes(yy)) || (r.ntT === 'EURO' && yy === 1980) || (r.ntT === 'COPA' && yy < 1993);
      if (!odd) set('ntS', P.set.ntS);
      cNt = P.ntLineups ? 'A' : 'B';
    } else if (!r.ntT) cNt = 'A';
    if (P.set.title != null && !o._noTitle) { set('title', P.set.title); cTit = 'A'; }
    // prova/fase continental (só automático desde 1992/93; antes os nomes das rondas não dão a distância à final)
    let cU = null;
    // (pela página da edição em qualquer ano; pelos jogos da página de época só desde 2006)
    if (P.uOk && (P.uSrc !== 'época' || +ys >= 2006) && !o._noU) { set('uT', P.set.uT); set('uS', P.set.uS); cU = 'A'; }
    else if (P.uRounds && !P.uRounds.length && cClub && !r.uS) { cU = 'A'; }
    if (o._uOk) cU = 'A';
    if (o._ntOk) cNt = 'A';
    for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) set(k, v);
    // confiança = componente mais fraca (sem verificação → C)
    const conf = cClub ? minC(cClub, cNt || 'C', cTit || (o._titleOk ? 'A' : 'C'), cU || 'C') : 'C';
    if (o.conf) r.conf = o.conf; else r.conf = r.win === 'S' ? 'C' : conf;
    r.sources = [...new Set([...(r.sources || []), ...P.src])];
    let note = r.note || '';
    for (const b of BOILER) note = note.replace(b, '');
    note = note.replace(/\s*2\.ª passagem[^]*$/, '').trim();
    // frases da 1.ª passagem que deixam de ser verdade quando o clube foi verificado
    if (cClub) note = note.replace(/[^.]*(NÃO verificad|de memória, NÃO)[^.]*\.\s*/g, '').trim();
    const extra = [];
    const inc = (P.issues || []).filter(i => /incompleta/.test(i)).map(i => i.replace(/: página.*$/, ''));
    const miss50 = (P.issues || []).filter(i => /divisão estimada a 50%\)$/.test(i) && /sem página/.test(i)).map(i => i.replace(/: sem página.*$/, ''));
    if (cClub && P.sMode) extra.push('liga+Europa da época que termina no ano, pela tabela de carreira (sem páginas de época com jogos para dividir o ano civil: win S)');
    else if (cClub) extra.push(P_ ? 'liga+Europa da tabela de carreira (época)' : `totais por época da tabela de carreira; golos do ano civil contados jogo a jogo nas páginas de época${inc.length ? ` (página incompleta em ${inc.join(', ')}: divisão estimada a 50%)` : ''}${miss50.length ? ` (sem página de jogos para ${miss50.join(', ')}: metade dos totais)` : ''}${!inc.length && !miss50.length && !P.gExact ? ' (pequena divergência com a tabela de carreira; escalado)' : ''}; jogos estimados pela proporção de jogos do clube no ano`);
    else if (euGap) extra.push('clube não alterado: a tabela de carreira não separa os jogos europeus');
    else extra.push('estatísticas de clube não verificadas (sem tabela de carreira utilizável)');
    if (cNt === 'A' && r.ntT) extra.push('seleção contada pelos onzes da Wikipédia');
    if (cTit) extra.push('título pela página da liga');
    if (cU === 'A' && P.uOk && !o._noU) extra.push('prova/fase continental ' + (P.uSrc === 'edição' ? `pela página da edição (${P.euEd.edition}: ${P.euEd.reached})` : P.uSrc === 'época' ? 'pelos jogos da página de época' : `verificada: ${P.uSrc}`));
    const miss = [!cClub && 'clube', r.ntT && cNt !== 'A' && cNt !== 'B' && 'seleção', !cTit && !o._titleOk && 'título', !cU && 'fase europeia'].filter(Boolean);
    if (miss.length) extra.push('por verificar: ' + miss.join(', '));
    if (o._note) extra.push(o._note);
    r.note = (note ? note + ' ' : '') + '2.ª passagem: ' + extra.join('; ') + '.' + (msgs.length ? ' Alterado: ' + msgs.join(', ') + '.' : '');
  }
}
// ordem dos campos como no SPEC
const ORDER = ['name', 'club', 'lg', 'pos', 'gp', 'g', 'a', 'uT', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntT', 'ntS',
               'title', 'cont', 'rank', 'elig', 'win', 'conf', 'aConf', 'sources', 'note'];
for (const Y of Object.values(blk)) Y.rows = Y.rows.map(r => {
  const o = {};
  for (const k of ORDER) if (k in r) o[k] = r[k];
  for (const k in r) if (!(k in o)) o[k] = r[k];
  return o;
});
fs.writeFileSync(F, JSON.stringify(blk, null, IND) + '\n');
console.log('alterações:', changed);
