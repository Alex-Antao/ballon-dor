// Builds the static site into dist/ (published to GitHub Pages).
//   dist/index.html            from site/index.html (asset URLs get a content hash for cache busting)
//   dist/assets/styles.css     site/styles.css
//   dist/assets/app.js         site/app.js
//   dist/assets/data.js        data.js wrapped for the browser (window.BDO_DATA)
//   dist/assets/models.js      models.js (window.BDO_MODELS)
//   dist/assets/config.js      weights and model selection (window.BDO_CONFIG)
//   dist/sources.json          per-row sources, fetched only when a player's detail is opened
// The live forecast (forecast/2027.json + history.json) goes into config.js when present; FORECAST_DIR=<dir> reads it
// from elsewhere (the e2e tests build with a forecast made from fixtures).
// Usage: node build.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname, OUT = path.join(ROOT, 'dist'), A = path.join(OUT, 'assets');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(A, { recursive: true });

const fit = JSON.parse(read('fit-result.json'));
const sel = JSON.parse(read('model-selection.json'));
const FCD = process.env.FORECAST_DIR || path.join(ROOT, 'forecast');
const fcFile = fs.existsSync(FCD) && fs.readdirSync(FCD).filter(f => /^\d{4}\.json$/.test(f)).sort().pop();
const forecast = fcFile ? JSON.parse(fs.readFileSync(path.join(FCD, fcFile), 'utf8')) : null;
if (forecast) {
  const hf = path.join(FCD, 'history.json');
  // the page only needs recent leaders: the last 120 updates, top 3 per model
  const hist = fs.existsSync(hf) ? JSON.parse(fs.readFileSync(hf, 'utf8')) : [];
  forecast.history = hist.slice(-120).map(h => ({ date: h.date, pred: h.pred.slice(0, 3), fair: h.fair.slice(0, 3), mine: h.mine.slice(0, 3) }));
  delete forecast.warnings;
}
const pick = (o, ks) => Object.fromEntries(ks.filter(k => k in o).map(k => [k, o[k]]));
const config = { weights: fit.weights, fits: fit.fits,
  selection: pick(sel, ['targets', 'baseline', 'nestedWindow', 'nested', 'selection', 'temporal', 'temporalOld', 'final', 'memorisedFit']), forecast };

const data = read('data.js').replace(/if \(typeof module[^\n]*\n?/, '');
const files = {
  'styles.css': read('site/styles.css'),
  'app.js': read('site/app.js'),
  'data.js': '(function(){\n' + data + '\nwindow.BDO_DATA={YEARS,LEAGUE_ERA,CUP_ERA,NTMULT,leagueStrength,cupWeight};\n})();\n',
  'models.js': read('models.js'),
  'config.js': 'window.BDO_CONFIG=' + JSON.stringify(config) + ';\n',
};
let html = read('site/index.html');
for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(path.join(A, name), body);
  const h = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10);
  html = html.replace(`assets/${name}"`, `assets/${name}?v=${h}"`);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
fs.copyFileSync(path.join(ROOT, 'sources.json'), path.join(OUT, 'sources.json'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const size = f => fs.statSync(path.join(OUT, f)).size;
const list = ['index.html', ...Object.keys(files).map(f => 'assets/' + f), 'sources.json'];
console.log(list.map(f => `${f.padEnd(18)} ${(size(f) / 1024).toFixed(0).padStart(5)} KB`).join('\n'));
