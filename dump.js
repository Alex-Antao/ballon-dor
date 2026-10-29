const {YEARS}=require('./data.js');const M=require('./models.js');
const o={};for(const y of Object.keys(YEARS))o[y]={real:YEARS[y].real,rows:YEARS[y].rows.map(r=>({n:r.name,pos:r.pos,g:r.g,a:r.a,uS:r.uS,ntS:r.ntS,title:r.title,f:M.histFeatures(r,M.histCtx(YEARS[y].rows)).slice(0,10)}))};
console.log(JSON.stringify(o));
