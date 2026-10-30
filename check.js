// Quick check in Node: winner picked by each algorithm, per year (eligible list; * = the "all" list differs).
// The same numbers are asserted in tests/unit/models.test.js.
const {YEARS}=require('./data.js');const M=require('./models.js');const FIT=require('./fit-result.json');
const W={elig:FIT.fits.elig.weights,all:FIT.fits.all.weights};
const top=(rows,fn)=>M.rankYear(rows,fn)[0].r.name;
const st={};
for(const y of Object.keys(YEARS)){const Y=YEARS[y];const line=[];
 for(const L of ['elig','all']){const rows=M.listRows(Y,L),c=M.predCtx(rows),winner=M.target(Y,L);
  const p={P:top(rows,r=>M.predict(r,W[L],c)),F:top(rows,r=>M.fair(r)),M:top(rows,r=>M.mine(r))};
  for(const k in p){const s=st[L+k]=st[L+k]||{ok:0,n:0};if(winner&&+y<=2025){s.n++;if(p[k]===winner)s.ok++;}}
  if(L==='elig'||winner!==M.target(Y,'elig')||rows.length!==M.listRows(Y,'elig').length)
   line.push((L==='all'?'*':' ')+(winner||'—').slice(0,14).padEnd(14)+' |P '+p.P.slice(0,14).padEnd(14)+' |F '+p.F.slice(0,14).padEnd(14)+' |M '+p.M.slice(0,14).padEnd(14));}
 console.log(y,line.join('  '));}
for(const k in st)console.log(k,st[k].ok+'/'+st[k].n);
