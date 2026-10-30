// Builds dist/ for the end-to-end tests with a forecast made offline from tests/fixtures/football-data,
// so the tests never depend on live data. Usage: node tools/e2e-build.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bdo-e2e-'));
const env = { ...process.env, FD_FIXTURES: path.join(ROOT, 'tests', 'fixtures', 'football-data'), NO_WIKI: '1', AS_OF: '2026-10-30', FORECAST_OUT: out };
execFileSync(process.execPath, ['forecast/update.js'], { cwd: ROOT, env, stdio: 'inherit' });
execFileSync(process.execPath, ['build.js'], { cwd: ROOT, env: { ...process.env, FORECAST_DIR: out }, stdio: 'inherit' });
