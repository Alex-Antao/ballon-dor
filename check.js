const {YEARS}=require('./data.js');const M=require('./models.js');const W=require('./fit-result.json').weights;
let ok=0,n=0;
for(const y of Object.keys(YEARS)){const rows=YEARS[y].rows,c=M.histCtx(rows);
 const h=M.rankYear(rows,r=>M.hist(r,W,c)),f=M.rankYear(rows,r=>M.fair(r)),m=M.rankYear(rows,r=>M.mine(r));
 if(YEARS[y].real&&y<=2025){n++;if(h[0].r.name===YEARS[y].real)ok++;}
 console.log(y,(YEARS[y].real||'—').slice(0,14).padEnd(14),'|H',h[0].r.name.slice(0,14).padEnd(14),'|J',f[0].r.name.slice(0,14).padEnd(14),'|M',m[0].r.name.slice(0,14));}
console.log('hist',ok,n);
