// Validação rápida em Node: vencedor previsto por cada algoritmo, por ano (lista dos elegíveis; * = lista 'todos' difere).
const {YEARS}=require('./data.js');const M=require('./models.js');const FIT=require('./fit-result.json');
const W={elig:FIT.fits?FIT.fits.elig.weights:FIT.weights,all:FIT.fits?FIT.fits.all.weights:FIT.weights};
const top=(rows,fn)=>M.rankYear(rows,fn)[0].r.name;
const st={};
for(const y of Object.keys(YEARS)){const Y=YEARS[y];const line=[];
 for(const L of ['elig','all']){const rows=M.listRows(Y,L),c=M.histCtx(rows),real=M.target(Y,L);
  const p={H:top(rows,r=>M.hist(r,W[L],c)),J:top(rows,r=>M.fair(r)),M:top(rows,r=>M.mine(r))};
  for(const k in p){const s=st[L+k]=st[L+k]||{ok:0,n:0};if(real&&+y<=2025){s.n++;if(p[k]===real)s.ok++;}}
  if(L==='elig'||real!==M.target(Y,'elig')||rows.length!==M.listRows(Y,'elig').length)
   line.push((L==='all'?'*':' ')+(real||'—').slice(0,14).padEnd(14)+' |H '+p.H.slice(0,14).padEnd(14)+' |J '+p.J.slice(0,14).padEnd(14)+' |M '+p.M.slice(0,14).padEnd(14));}
 console.log(y,line.join('  '));}
for(const k in st)console.log(k,st[k].ok+'/'+st[k].n);
