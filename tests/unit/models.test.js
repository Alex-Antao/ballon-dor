const test = require('node:test');
const assert = require('node:assert/strict');
const { YEARS } = require('../../data.js');
const M = require('../../models.js');
const FIT = require('../../fit-result.json');
const SEL = require('../../model-selection.json');
const G = require('./golden.js');

const years = Object.keys(YEARS).map(Number);
const top = (rows, fn) => M.rankYear(rows, fn)[0].r.name;

// Winners called correctly by each model over the years that have an award, up to `last`.
function hits(L, last, w = FIT.fits[L].weights) {
  const n = { pred: 0, fair: 0, mine: 0, years: 0 };
  for (const y of years) {
    const Y = YEARS[y], winner = M.target(Y, L);
    if (!winner || y > last) continue;
    const rows = M.listRows(Y, L), ctx = M.predCtx(rows);
    n.years++;
    if (top(rows, r => M.predict(r, typeof w === 'function' ? w(y) : w, ctx)) === winner) n.pred++;
    if (top(rows, r => M.fair(r)) === winner) n.fair++;
    if (top(rows, r => M.mine(r)) === winner) n.mine++;
  }
  return n;
}

test('reference results, eligible list (single fit)', () => {
  assert.deepEqual(hits('elig', 2025), { pred: 30, fair: 20, mine: 23, years: 69 });
});

test('reference results, "all" list (single fit)', () => {
  assert.deepEqual(hits('all', 2025), { pred: 30, fair: 20, mine: 23, years: 69 });
});

test('2026: every model picks Harry Kane, the real winner', () => {
  const Y = YEARS[2026], rows = M.listRows(Y, 'elig'), ctx = M.predCtx(rows);
  assert.equal(Y.winner, 'Harry Kane');
  assert.equal(top(rows, r => M.predict(r, FIT.fits.elig.weights, ctx)), 'Harry Kane');
  assert.equal(top(rows, r => M.fair(r)), 'Harry Kane');
  assert.equal(top(rows, r => M.mine(r)), 'Harry Kane');
});

test('temporal prediction 2010–2026 matches the stored model-selection result', () => {
  let hit = 0;
  for (const y of SEL.targets) {
    const Y = YEARS[y], rows = M.listRows(Y, 'elig'), ctx = M.predCtx(rows);
    if (top(rows, r => M.predict(r, SEL.temporal[y].weights, ctx)) === Y.winner) hit++;
  }
  assert.equal(hit, SEL.nestedWindow.hits);
  assert.equal(hit, 9);
});

test('the models count the Nations League Finals only if the study adopted them', () => {
  assert.equal(SEL.nlStudy.adopted, 'N0');
  assert.equal(M.NL_W, 0);
  const r = YEARS[2025].rows.find(x => x.name === 'Lamine Yamal'), rows = M.listRows(YEARS[2025], 'elig');
  assert.equal(r.nlS, 4, 'the data keeps them');
  assert.ok(M.predFeatures(r, M.predCtx(rows, 0.4), 0.4)[7] > M.predFeatures(r, M.predCtx(rows))[7], 'the study variant counts his Finals goals');
});

test('Fair and Custom weight European goals by the opponents; the Prediction does not', () => {
  const r = YEARS[2025].rows.find(x => x.name === 'Raphinha'), rows = M.listRows(YEARS[2025], 'elig');
  assert.ok(r.uOpp > 0 && r.uOppN > 0, 'the data has his opponents');
  const weak = { ...r, uOpp: 0.3 };
  for (const f of [M.fair, M.mine]) {
    assert.ok(f(r).score > f(weak).score, `${f.name}: goals against stronger clubs count more`);
    assert.equal(f(r, { oppW: 0 }).score, f(weak, { oppW: 0 }).score, `${f.name}: oppW 0 = the competition weight`);
  }
  const ctx = M.predCtx(rows);
  assert.deepEqual(M.predFeatures(r, ctx), M.predFeatures(weak, ctx));
});

test('temporal weights never train on the year they predict', () => {
  for (const [y, t] of Object.entries(SEL.temporal)) assert.ok(t.train[1] < +y, `${y} trains up to ${t.train[1]}`);
});

test('feature vector length matches the feature list and the weights', () => {
  const rows = M.listRows(YEARS[2010], 'elig'), ctx = M.predCtx(rows);
  for (const r of rows) assert.equal(M.predFeatures(r, ctx).length, M.PRED_FEATURES.length);
  assert.equal(FIT.weights.length, M.PRED_FEATURES.length);
  for (const t of Object.values(SEL.temporal)) assert.equal(t.weights.length, M.PRED_FEATURES.length);
});

test('score parts add up to the score', () => {
  for (const y of [1960, 1990, 2010, 2026]) {
    const rows = M.listRows(YEARS[y], 'all'), ctx = M.predCtx(rows);
    for (const r of rows) {
      for (const s of [M.predict(r, FIT.weights, ctx), M.mine(r)]) {
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
