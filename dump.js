// Exports the Prediction features (computed in models.js) per year and list, for fit_weights.py and model_selection.py.
// fNL = the same with the Nations League Finals at weight 0.4 (study in model_selection.py, section 8).
// Usage: node dump.js > feats.json
const {YEARS}=require('./data.js');const M=require('./models.js');
const o={};
for(const y of Object.keys(YEARS)){const Y=YEARS[y];o[y]={};
 for(const L of ['elig','all']){const rows=M.listRows(Y,L),c=M.predCtx(rows),cNL=M.predCtx(rows,0.4);
  o[y][L]={winner:M.target(Y,L),rows:rows.map(r=>({n:r.name,f:M.predFeatures(r,c),fNL:M.predFeatures(r,cNL,0.4),
   x:{rank:r.rank,pos:r.pos,g:r.g,a:r.a,uG:r.uG,uS:r.uS,uT:r.uT,ntG:r.ntG,ntT:r.ntT,ntS:r.ntS,title:r.title,cont:r.cont,elig:r.elig,
     cup:r.cup,lgTop:r.lgTop,gs:r.gs,uTop:r.uTop,ntTop:r.ntTop,ntBest:r.ntBest}}))};}}
console.log(JSON.stringify(o));
