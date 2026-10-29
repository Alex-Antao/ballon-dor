const fs=require('fs');
let t=fs.readFileSync('site.src.html','utf8');
const fit=JSON.parse(fs.readFileSync('fit-result.json','utf8'));
const data=fs.readFileSync('data.js','utf8').replace(/if \(typeof module[^\n]*\n?/,'');
const wrapData='(function(){\n'+data+'\nwindow.BDO_DATA={YEARS,LEAGUE_ERA,CUP_ERA,NTMULT,leagueStrength,cupWeight};\n})();';
t=t.replace('/*DATA*/',()=>wrapData).replace('/*MODELS*/',()=>fs.readFileSync('models.js','utf8'))
 .replace('/*WEIGHTS*/[]',()=>JSON.stringify(fit.weights)).replace('/*STATS*/{}',()=>JSON.stringify(fit.fits))
 .replace('/*SOURCES*/{}',()=>fs.readFileSync('sources.json','utf8'));
fs.writeFileSync('index.html',t);console.log(t.length);
