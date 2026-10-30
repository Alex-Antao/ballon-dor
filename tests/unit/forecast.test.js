// The forecast pipeline, run offline on made-up football-data.org responses (tests/fixtures/football-data),
// and the shape of the committed forecast/2027.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const { YEARS } = require('../../data.js');
const { expectLeague, nominees, samePerson } = require('../../forecast/update.js');
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
  // league + Champions League so far, as they are
  assert.deepEqual([kane.gpNow, kane.gNow, kane.aNow, kane.uG, kane.uA, kane.uT], [12, 20, 5, 5, 1, 'UCL']);
  // what the models score: Bundesliga 9 of 34 games played, the rest at a pace pulled towards his 2026 season
  const k26 = YEARS[2026].rows.find(r => r.name === 'Harry Kane');
  const L = expectLeague({ gp: 9, g: 15, a: 4 }, 9, 34, 1, { g: k26.g / k26.gp, a: k26.a / k26.gp });
  assert.deepEqual([kane.gp, kane.g, kane.a], [L.gp + 3, L.g + 5, L.a + 1]);
  assert.ok(kane.g > kane.gNow && kane.g < Math.round(15 * 34 / 9) + 5, 'between the goals so far and a straight-line projection');
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
  assert.equal(rodri.club, 'Barça', '"FC Barcelona" is matched exactly, not to "RCD Espanyol de Barcelona"');
  assert.equal(rodri.gpNow, Math.round(0.85 * 10) + (rodri.uT ? Math.round(0.85 * 1) : 0));
  assert.equal(rodri.aNow, null, 'assists unknown for a player on no scorer list');
  assert.equal(rodri.uANow, null, 'so are his Champions League assists (the site shows a dash)');
  assert.equal(row('Harry Kane').uANow, 1, 'known for a Champions League scorer');
  assert.equal(rodri.cont, 9.5);
  assert.equal(row('Achraf Hakimi').club, 'PSG', 'club matched by name, not by a code inside another name');
});

test('end-of-season estimate shrinks a hot start towards the prior', () => {
  const prior = { g: 0.5, a: 0.2 };
  const hot = expectLeague({ gp: 7, g: 8, a: 0 }, 7, 34, 1, prior);
  assert.equal(hot.gp, 34);
  assert.ok(hot.g < Math.round(8 * 34 / 7) && hot.g > 8 + 27 * 0.5, 'below the straight line, above the prior pace');
  assert.deepEqual(expectLeague({ gp: 34, g: 30, a: 9 }, 34, 34, 1, prior), { gp: 34, g: 30, a: 9 }, 'a finished season is unchanged');
  assert.equal(expectLeague({ gp: 5, g: 0, a: null }, 10, 38, 0.5, prior).a, Math.round(19 * 0.2), 'unknown assists from the prior');
});

test('Ballon d\'Or nominees table and name matching', () => {
  const text = `{|\n|-\n!scope="row" | 1\n|'''{{sortname|Harry|Kane}}'''\n|{{sort|3|[[Forward (association football)|Forward]]}}\n|-\n!scope="row" | 4\n|{{sortname|Rodri|}}\n|{{sort|2|[[Midfielder]]}}\n|}`;
  assert.deepEqual(nominees(text), [{ name: 'Harry Kane', pos: 'FW' }, { name: 'Rodri', pos: 'CM' }]);
  assert.ok(samePerson('Lamine Yamal Nasraoui Ebana', 'Lamine Yamal'));
  assert.ok(samePerson('Kylian Mbappe', 'Kylian Mbappé'));
  assert.ok(!samePerson('Rodri Sánchez', 'Rodri'), 'one-word names match only exactly');
  assert.ok(!samePerson('Luis Díaz', 'Luis Suárez'));
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
