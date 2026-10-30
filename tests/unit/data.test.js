// Data validation: data-src/*.json against the rules in data-src/SPEC.md, and data.js / sources.json in sync with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'data-src');
const files = fs.readdirSync(SRC).filter(f => /^\d{4}(-\d{4})?\.json$/.test(f)).sort();
const blocks = files.map(f => [f, JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'))]);
const all = blocks.flatMap(([f, b]) => Object.entries(b).map(([y, Y]) => [f, +y, Y]));
const { LEAGUE_ERA, CUP_ERA, NTMULT } = require(path.join(ROOT, 'data.js'));

const POS = ['FW', 'W', 'AM', 'CM', 'DM', 'DF', 'GK'], ATT = ['FW', 'W', 'AM'];

test('block files cover every year from 1956 to 2026 once', () => {
  const ys = all.map(x => x[1]).sort((a, b) => a - b);
  assert.equal(ys[0], 1956);
  assert.equal(ys[ys.length - 1], 2026);
  assert.equal(new Set(ys).size, ys.length);
  assert.equal(ys.length, 2026 - 1956 + 1);
  for (const [f, y] of all) {
    const [a, b = a] = f.replace('.json', '').split('-').map(Number);
    assert.ok(y >= a && y <= b, `${y} is outside ${f}`);
  }
});

test('year fields', () => {
  for (const [, y, Y] of all) {
    assert.equal(Y.window, y <= 2021 ? 'CY' : 'P', `${y} window`);
    for (const k of ['label', 'award']) assert.equal(typeof Y[k], 'string', `${y} ${k}`);
    assert.ok(Array.isArray(Y.rows) && Y.rows.length >= (Y.winner ? 10 : 5), `${y} rows`);
    if (y === 2020) assert.equal(Y.winner, null, '2020 was not awarded');
    else assert.equal(typeof Y.winner, 'string', `${y} winner`);
  }
});

test('row fields have the right types and ranges', () => {
  for (const [, y, Y] of all) for (const r of Y.rows) {
    const at = `${y} ${r.name}`;
    for (const k of ['gp', 'g', 'a', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntS']) {
      assert.ok(Number.isInteger(r[k]) && r[k] >= 0, `${at}: ${k}=${r[k]}`);
    }
    assert.ok(POS.includes(r.pos), `${at}: pos ${r.pos}`);
    assert.ok(r.uS <= 5 && r.ntS <= 5, `${at}: stage`);
    assert.ok(r.uG <= r.g && r.uA <= r.a, `${at}: Europe is a subset of the totals`);
    assert.ok([0, 1].includes(r.title) && [0, 1].includes(r.elig), `${at}: title/elig`);
    assert.ok(['A', 'B', 'C'].includes(r.conf) && ['A', 'B', 'C'].includes(r.aConf), `${at}: confidence`);
    assert.ok(['CY', 'S', 'P'].includes(r.win), `${at}: win ${r.win}`);
    assert.ok(r.uT in CUP_ERA, `${at}: uT ${r.uT}`);
    assert.ok(r.ntT in NTMULT, `${at}: ntT ${r.ntT}`);
    assert.ok(r.lg in LEAGUE_ERA, `${at}: league ${r.lg} has no strength`);
    if (!r.uT) assert.equal(r.uS, 0, `${at}: stage without a competition`);
    if (!r.ntT) assert.ok(!r.ntGP && !r.ntG && !r.ntA && !r.ntS, `${at}: national-team numbers without a tournament`);
    if (ATT.includes(r.pos)) assert.ok(r.cont == null, `${at}: attackers have no cont`);
    else assert.ok(typeof r.cont === 'number' && r.cont >= 0 && r.cont <= 10, `${at}: cont ${r.cont}`);
    if (r.rank != null) assert.ok(Number.isInteger(r.rank) && r.rank >= 1, `${at}: rank`);
    assert.ok(Array.isArray(r.sources) && r.sources.every(u => /^https?:\/\//.test(u)), `${at}: sources`);
    assert.equal(typeof r.note, 'string', `${at}: note`);
  }
});

test('window rules: CY years use CY or S rows, season years use P; S means confidence C', () => {
  for (const [, y, Y] of all) for (const r of Y.rows) {
    if (Y.window === 'P') assert.equal(r.win, 'P', `${y} ${r.name}`);
    else assert.ok(r.win === 'CY' || r.win === 'S', `${y} ${r.name}`);
    if (r.win === 'S') assert.equal(r.conf, 'C', `${y} ${r.name}: win S must be C`);
  }
});

test('candidates: official top 10 (ties included), unique names, winner ranked 1st and eligible', () => {
  for (const [, y, Y] of all) {
    const names = Y.rows.map(r => r.name);
    assert.equal(new Set(names).size, names.length, `${y}: repeated player`);
    if (!Y.winner) continue;
    // a few years also carry a strong candidate ranked below 10th (e.g. Kane 13th in 2025)
    const top10 = Y.rows.filter(r => r.rank != null && r.rank <= 10);
    assert.ok(top10.length >= 10, `${y}: ${top10.length} in the top 10`);
    assert.ok(Math.max(...top10.map(r => r.rank)) <= top10.length, `${y}: rank gaps`);
    const w = Y.rows.find(r => r.name === Y.winner);
    assert.ok(w && w.rank === 1 && w.elig === 1, `${y}: winner ${Y.winner}`);
    assert.ok(Y.rows.filter(r => r.elig === 0).every(r => r.rank == null), `${y}: ineligible with a rank`);
    if (Y.winnerAll) assert.ok(Y.rows.some(r => r.name === Y.winnerAll && r.elig === 0), `${y}: retroactive winner ${Y.winnerAll}`);
  }
});

test('eligibility: everyone is eligible from 2007', () => {
  for (const [, y, Y] of all) if (y >= 2007) assert.ok(Y.rows.every(r => r.elig === 1), `${y}`);
});

test('gen-data.js reproduces data.js and sources.json exactly', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bdo-'));
  for (const f of ['gen-data.js', 'eras.js']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
  fs.cpSync(SRC, path.join(tmp, 'data-src'), { recursive: true });
  execFileSync(process.execPath, ['gen-data.js'], { cwd: tmp, stdio: 'pipe' });
  for (const f of ['data.js', 'sources.json']) {
    const a = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
    const b = fs.readFileSync(path.join(tmp, f), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(a === b, `${f} is stale: run node gen-data.js`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});
