// The forecast pipeline, run offline on made-up football-data.org responses (tests/fixtures/football-data),
// and the shape of the committed forecast/2027.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const POS = ['FW', 'W', 'AM', 'CM', 'DM', 'DF', 'GK'];

function run() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bdo-fc-'));
  execFileSync(process.execPath, ['forecast/update.js'], { cwd: ROOT, stdio: 'pipe',
    env: { ...process.env, FD_FIXTURES: path.join(ROOT, 'tests', 'fixtures', 'football-data'), NO_WIKI: '1', AS_OF: '2026-10-30', FORECAST_OUT: out } });
  return { fc: JSON.parse(fs.readFileSync(path.join(out, '2027.json'), 'utf8')), hist: JSON.parse(fs.readFileSync(path.join(out, 'history.json'), 'utf8')) };
}
const { fc, hist } = run();
const row = n => fc.rows.find(r => r.name === n);

test('builds rows from scorer lists, standings and Champions League matches', () => {
  const kane = row('Harry Kane');
  assert.deepEqual([kane.gpNow, kane.gNow, kane.aNow, kane.uG, kane.uA, kane.uT], [12, 20, 5, 5, 1, 'UCL']);
  // Bundesliga numbers projected from 9 to 34 games; Champions League numbers left as they are
  assert.deepEqual([kane.gp, kane.g, kane.a], [Math.round(9 * 34 / 9) + 3, Math.round(15 * 34 / 9) + 5, Math.round(4 * 34 / 9) + 1]);
  assert.equal(kane.title, 1, 'Bayern lead their league');
  assert.equal(kane.lgTop, 1, 'most Bundesliga goals so far');
  assert.equal(kane.uTop, 1, 'most Champions League goals so far');
  assert.equal(row('Ousmane Dembélé').uS, 1, 'PSG have a round-of-16 tie');
  assert.equal(row('Viktor Gyökeres Jr').uT, '', 'Benfica are not in the Champions League fixtures');
});

test('aliases, positions and the hand-kept candidates', () => {
  assert.ok(row('Lamine Yamal') && !row('Lamine Yamal Nasraoui Ebana'), 'alias applied');
  assert.equal(row('Vitinha').pos, 'CM');
  assert.equal(row('Vitinha').conf, 'A', 'on a scorer list');
  const rodri = row('Rodri');
  assert.equal(rodri.conf, 'C', 'not on a scorer list: games estimated');
  assert.equal(rodri.gpNow, Math.round(0.85 * 10) + Math.round(0.85 * 1));
  assert.equal(rodri.cont, 9.5);
  assert.equal(row('Achraf Hakimi').club, 'PSG', 'club matched by name, not by a code inside another name');
});

test('rows follow the data-src format and every model ranks every candidate', () => {
  for (const r of fc.rows) {
    assert.ok(POS.includes(r.pos), r.name);
    for (const k of ['gp', 'g', 'a', 'uG', 'uA', 'uS', 'ntGP', 'ntG', 'ntA', 'ntS', 'title', 'cup', 'lgTop', 'gs', 'uTop', 'ntTop', 'ntBest'])
      assert.ok(Number.isInteger(r[k]) && r[k] >= 0, `${r.name} ${k}`);
    assert.equal(r.cont == null, ['FW', 'W', 'AM'].includes(r.pos), `${r.name} cont`);
    assert.equal(r.win, 'P');
  }
  for (const k of ['pred', 'fair', 'mine']) {
    assert.equal(fc.rankings[k].length, fc.rows.length, k);
    assert.ok(fc.rankings[k].every(([n, s]) => typeof n === 'string' && Number.isFinite(s)), k);
  }
  assert.equal(hist.length, 1);
  assert.equal(hist[0].date, '2026-10-30');
});

test('committed forecast/2027.json, if present, is well formed', () => {
  const f = path.join(ROOT, 'forecast', '2027.json');
  if (!fs.existsSync(f)) return;
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(c.year, 2027);
  assert.match(c.asOf, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(c.rows.length >= 10);
  assert.equal(c.rankings.pred.length, c.rows.length);
});
