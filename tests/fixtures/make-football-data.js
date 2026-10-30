// Writes small, made-up football-data.org responses used by tests/unit/forecast.test.js (FD_FIXTURES).
// Not real data: a handful of teams and players per league, enough to exercise every rule of forecast/update.js.
// Usage: node tests/fixtures/make-football-data.js
const fs = require('fs');
const path = require('path');
const { fixtureFile } = require('../../forecast/football-data.js');

const DIR = path.join(__dirname, 'football-data');
fs.mkdirSync(DIR, { recursive: true });
const T = (id, name, shortName, tla) => ({ id, name, shortName, tla });
const teams = {
  PL: [T(65, 'Manchester City FC', 'Man City', 'MCI'), T(64, 'Liverpool FC', 'Liverpool', 'LIV'), T(57, 'Arsenal FC', 'Arsenal', 'ARS')],
  PD: [T(86, 'Real Madrid CF', 'Real Madrid', 'RMA'), T(81, 'FC Barcelona', 'Barça', 'FCB'), T(80, 'RCD Espanyol de Barcelona', 'Espanyol', 'ESP')],
  BL1: [T(5, 'FC Bayern München', 'Bayern', 'FCB'), T(4, 'Borussia Dortmund', 'Dortmund', 'BVB')],
  SA: [T(108, 'FC Internazionale Milano', 'Inter', 'INT'), T(109, 'Juventus FC', 'Juventus', 'JUV')],
  FL1: [T(524, 'Paris Saint-Germain FC', 'PSG', 'PSG'), T(548, 'AS Monaco FC', 'Monaco', 'ASM')],
  DED: [T(678, 'AFC Ajax', 'Ajax', 'AJA'), T(674, 'PSV', 'PSV', 'PSV')],
  PPL: [T(1903, 'Sport Lisboa e Benfica', 'Benfica', 'SLB'), T(498, 'Sporting Clube de Portugal', 'Sporting CP', 'SCP')],
};
const P = (id, name, position, section, nationality) => ({ id, name, position, section, nationality });
const scorers = {
  PL: [[P(1, 'Erling Haaland', 'Centre-Forward', 'Offence', 'Norway'), 65, 10, 14, 2], [P(2, 'Mohamed Salah', 'Right Winger', 'Offence', 'Egypt'), 64, 10, 8, 6]],
  PD: [[P(3, 'Kylian Mbappé', 'Centre-Forward', 'Offence', 'France'), 86, 11, 12, 3], [P(4, 'Lamine Yamal Nasraoui Ebana', 'Right Winger', 'Offence', 'Spain'), 81, 11, 6, 7]],
  BL1: [[P(5, 'Harry Kane', 'Centre-Forward', 'Offence', 'England'), 5, 9, 15, 4], [P(6, 'Michael Olise', 'Right Winger', 'Offence', 'France'), 5, 9, 5, 6]],
  SA: [[P(7, 'Lautaro Martínez', 'Centre-Forward', 'Offence', 'Argentina'), 108, 10, 7, 1]],
  FL1: [[P(8, 'Ousmane Dembélé', 'Right Winger', 'Offence', 'France'), 524, 10, 8, 4], [P(9, 'Vítor Ferreira', 'Central Midfield', 'Midfield', 'Portugal'), 524, 10, 2, 3]],
  DED: [[P(10, 'Some Striker', 'Centre-Forward', 'Offence', 'Netherlands'), 674, 10, 9, null]],
  PPL: [[P(11, 'Viktor Gyökeres Jr', 'Centre-Forward', 'Offence', 'Sweden'), 1903, 9, 8, 2]],
};
const write = (p, body) => fs.writeFileSync(fixtureFile(DIR, p), JSON.stringify(body, null, 1) + '\n');
for (const code of Object.keys(teams)) {
  write(`/competitions/${code}/standings?season=2026`, { standings: [{ stage: 'REGULAR_SEASON', type: 'TOTAL',
    table: teams[code].map((team, i) => ({ position: i + 1, team, playedGames: 10 - (code === 'BL1' ? 1 : 0), points: 25 - 3 * i })) }] });
  write(`/competitions/${code}/scorers?season=2026&limit=100`, { scorers: scorers[code].map(([player, tid, gp, g, a]) => ({
    player, team: teams[code].find(t => t.id === tid), playedMatches: gp, goals: g, assists: a, penalties: 0 })) });
}
const all = Object.values(teams).flat(), team = id => all.find(t => t.id === id);
const match = (stage, h, a, status, winner) => ({ stage, status, homeTeam: team(h), awayTeam: team(a), score: { winner } });
write('/competitions/CL/matches?season=2026', { matches: [
  match('LEAGUE_STAGE', 65, 86, 'FINISHED', 'HOME_TEAM'), match('LEAGUE_STAGE', 5, 524, 'FINISHED', 'DRAW'),
  match('LEAGUE_STAGE', 81, 64, 'FINISHED', 'AWAY_TEAM'), match('LAST_16', 524, 108, 'SCHEDULED', null),
] });
write('/competitions/CL/scorers?season=2026&limit=100', { scorers: [
  { player: scorers.BL1[0][0], team: team(5), playedMatches: 3, goals: 5, assists: 1, penalties: 0 },
  { player: scorers.PL[0][0], team: team(65), playedMatches: 3, goals: 3, assists: 0, penalties: 0 },
] });
console.log('fixtures written to', DIR);
