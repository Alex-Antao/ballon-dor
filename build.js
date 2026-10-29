const fs=require('fs');
let t=fs.readFileSync('site.src.html','utf8');
const fit=JSON.parse(fs.readFileSync('fit-result.json','utf8'));
const data=fs.readFileSync('data.js','utf8').replace(/if \(typeof module[^\n]*\n?/,'');
const wrapData='(function(){\n'+data+'\nwindow.BDO_DATA={YEARS,LEAGUE,NTMULT};\n})();';
t=t.replace('/*DATA*/',()=>wrapData).replace('/*MODELS*/',()=>fs.readFileSync('models.js','utf8'))
 .replace('/*WEIGHTS*/[]',()=>JSON.stringify(fit.weights)).replace('/*STATS*/{}',()=>JSON.stringify({inSample:fit.inSample,loo:fit.loo,n:fit.n}));
fs.writeFileSync('index.html',t);console.log(t.length);
