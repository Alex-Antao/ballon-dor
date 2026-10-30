const test = require('node:test');
const assert = require('node:assert/strict');
const { YEARS } = require('../../data.js');
const M = require('../../models.js');
const FIT = require('../../fit-result.json');
const SEL = require('../../selecao-result.json');
const G = require('./golden.js');

const years = Object.keys(YEARS).map(Number);
const top = (rows, fn) => M.rankYear(rows, fn)[0].r.name;

// Winners called correctly by each model over the years that have an award, up to `last`.
function hits(L, last, w = FIT.fits[L].weights) {
  const n = { hist: 0, fair: 0, mine: 0, years: 0 };
  for (const y of years) {
    const Y = YEARS[y], real = M.target(Y, L);
    if (!real || y > last) continue;
    const rows = M.listRows(Y, L), ctx = M.histCtx(rows);
    n.years++;
    if (top(rows, r => M.hist(r, typeof w === 'function' ? w(y) : w, ctx)) === real) n.hist++;
    if (top(rows, r => M.fair(r)) === real) n.fair++;
    if (top(rows, r => M.mine(r)) === real) n.mine++;
  }
  return n;
}

test('reference results, eligible list (single fit)', () => {
  assert.deepEqual(hits('elig', 2025), { hist: 30, fair: 20, mine: 24, years: 69 });
});

test('reference results, "all" list (single fit)', () => {
  assert.deepEqual(hits('all', 2025), { hist: 28, fair: 20, mine: 24, years: 69 });
});

test('2026: every model picks Harry Kane, the real winner', () => {
  const Y = YEARS[2026], rows = M.listRows(Y, 'elig'), ctx = M.histCtx(rows);
  assert.equal(Y.real, 'Harry Kane');
  assert.equal(top(rows, r => M.hist(r, FIT.fits.elig.weights, ctx)), 'Harry Kane');
  assert.equal(top(rows, r => M.fair(r)), 'Harry Kane');
  assert.equal(top(rows, r => M.mine(r)), 'Harry Kane');
});

test('temporal prediction 2010–2026 matches the stored model-selection result', () => {
  let hit = 0;
  for (const y of SEL.targets) {
    const Y = YEARS[y], rows = M.listRows(Y, 'elig'), ctx = M.histCtx(rows);
    if (top(rows, r => M.hist(r, SEL.temporal[y].weights, ctx)) === Y.real) hit++;
  }
  assert.equal(hit, SEL.nestedWindow.hits);
  assert.equal(hit, 9);
});

test('temporal weights never train on the year they predict', () => {
  for (const [y, t] of Object.entries(SEL.temporal)) assert.ok(t.train[1] < +y, `${y} trains up to ${t.train[1]}`);
});

test('feature vector length matches the feature list and the weights', () => {
  const rows = M.listRows(YEARS[2010], 'elig'), ctx = M.histCtx(rows);
  for (const r of rows) assert.equal(M.histFeatures(r, ctx).length, M.HIST_FEATURES.length);
  assert.equal(FIT.weights.length, M.HIST_FEATURES.length);
  for (const t of Object.values(SEL.temporal)) assert.equal(t.weights.length, M.HIST_FEATURES.length);
});

test('score parts add up to the score', () => {
  for (const y of [1960, 1990, 2010, 2026]) {
    const rows = M.listRows(YEARS[y], 'all'), ctx = M.histCtx(rows);
    for (const r of rows) {
      for (const s of [M.hist(r, FIT.weights, ctx), M.mine(r)]) {
        const sum = Object.values(s.parts).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - s.score) < 1e-9, `${y} ${r.name}: ${sum} vs ${s.score}`);
      }
    }
  }
});

test('the "Mine" sliders change the score in the expected direction', () => {
  const r = YEARS[2024].rows.find(x => x.name === 'Rodri');
  const base = M.mine(r).score;
  assert.ok(M.mine(r, { wCont: 0.5 }).score > base, 'more weight on non-attacking contribution helps a DM');
  const v = YEARS[2024].rows.find(x => x.name === 'Vinícius Júnior');
  assert.ok(M.mine(v, { euBonus: 0.8 }).score > M.mine(v).score, 'bigger Europe bonus helps a UCL scorer');
});

test('eligible list never contains ineligible players; target is in the list', () => {
  for (const y of years) {
    const Y = YEARS[y];
    for (const L of ['elig', 'all']) {
      const rows = M.listRows(Y, L), t = M.target(Y, L);
      if (L === 'elig') assert.ok(rows.every(r => r.elig !== 0));
      if (t) assert.ok(rows.some(r => r.name === t), `${y} ${L}: ${t}`);
    }
  }
});

test('full rankings match the golden file', () => {
  const now = G.rankings();
  if (process.env.UPDATE_GOLDEN) { G.save(now); return; }
  const g = G.load();
  assert.deepEqual(Object.keys(now), Object.keys(g));
  for (const y of Object.keys(g)) assert.deepEqual(now[y], g[y], `rankings changed in ${y}`);
});
