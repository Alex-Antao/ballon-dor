// Golden rankings: every model's full ranking for every year and candidate list, computed from the current
// data and weights. Tests compare against tests/golden/rankings.json; refresh it on purpose with
//   UPDATE_GOLDEN=1 npm test
// and review the diff (a change means a model, the data or the weights changed).
const fs = require('fs');
const path = require('path');
const { YEARS } = require('../../data.js');
const M = require('../../models.js');
const FIT = require('../../fit-result.json');
const SEL = require('../../model-selection.json');

const FILE = path.join(__dirname, '..', 'golden', 'rankings.json');
const LISTS = ['elig', 'all'];
const round = x => Math.round(x * 1e6) / 1e6;

function rankings() {
  const out = {};
  for (const y of Object.keys(YEARS)) {
    out[y] = {};
    for (const L of LISTS) {
      const rows = M.listRows(YEARS[y], L), ctx = M.predCtx(rows);
      const rank = fn => M.rankYear(rows, fn).map(x => [x.r.name, round(x.score)]);
      const o = {
        pred: rank(r => M.predict(r, FIT.fits[L].weights, ctx)),
        fair: rank(r => M.fair(r)),
        mine: rank(r => M.mine(r)),
      };
      const t = SEL.temporal[y];
      if (L === 'elig' && t) o.temporal = rank(r => M.predict(r, t.weights, ctx));
      out[y][L] = o;
    }
  }
  return out;
}

function load() { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function save(g) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(g, null, 1) + '\n'); }

module.exports = { rankings, load, save, FILE };
