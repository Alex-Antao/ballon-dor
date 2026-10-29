// Exporta as features do Histórico (calculadas em models.js) para o ajuste em lp3.py, por ano e por lista.
const {YEARS}=require('./data.js');const M=require('./models.js');
const o={};
for(const y of Object.keys(YEARS)){const Y=YEARS[y];o[y]={};
 for(const L of ['elig','all']){const rows=M.listRows(Y,L),c=M.histCtx(rows);
  o[y][L]={real:M.target(Y,L),rows:rows.map(r=>({n:r.name,f:M.histFeatures(r,c)}))};}}
console.log(JSON.stringify(o));
