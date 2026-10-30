# Ballon d'Or Lab — project context

Goal: three algorithms that pick the Ballon d'Or winner (Prediction, Fair, Mine), compared year by year with the real vote since 1956 on a public site, plus a daily-updated forecast of the next award (2027).
Language: talk to the user in European Portuguese; everything in the repository (code, comments, data notes, docs, file and identifier names, commit messages) is in English.

## Layout
- `data-src/*.json` + `eras.js` → `node gen-data.js` → `data.js` (1956–2026, 803 rows, fields described at its top) + `sources.json`. Format and rules: `data-src/SPEC.md`. Confidence A/B/C per row; `cont` (midfielders/defenders/GKs) is a subjective estimate.
- `models.js`: Prediction (`predict`, `PRED_FEATURES`, 19 criteria; called "Historical" until 30/10/2026), Fair (individual only), Mine (individual + proportional team credit). Runs in Node and in the browser.
- `dump.js` → `feats.json` → `fit_weights.py` (single LP fit with a hinge → `fit-result.json`) and `model_selection.py` (temporal model selection → `model-selection.json`; `--nested` adds the slow nested estimate, `--awards` the trophies/awards study (`awardStudy`, ~10 min), `--extra` uses the reputation criteria, `--out FILE`). `extra_criteria.py` holds the 11 reputation/"star of the tournament" criteria (`EXTRA`) and the 8 trophy/award criteria (`AWARDS`). Python 3.14 with deps pinned in `requirements.txt` (numpy 2.5, scipy 1.18); on this machine run it as `py -3.14` (3.11 is still the default `python`).
- Trophies and awards per row (`cup`, `lgTop`, `gs`, `uTop`, `ntTop`, `ntBest`, `awConf`): `node verify/awards.js [blocks]` reads them from Wikipedia infoboxes and the Golden Shoe table (rules in the SPEC).
- Forecast: `forecast/update.js` (football-data.org via `forecast/football-data.js`, token in `FOOTBALL_DATA_TOKEN` env or `.env`; Wikipedia via verify/) → `forecast/2027.json` + `forecast/history.json`. Hand-kept candidates (non-scorers, cont, aliases) in `forecast/candidates.json`. League numbers are projected to a full season (raw values in gpNow/gNow/aNow). `FD_FIXTURES`, `NO_WIKI`, `AS_OF`, `FORECAST_OUT` for offline runs.
- Site: `site/` (index.html, styles.css, app.js) → `node build.js` → `dist/` (GitHub Pages at https://alex-antao.github.io/ballon-dor/; `sources.json` fetched only when a player's detail opens; the forecast goes into config.js). `node tools/serve.js` serves `dist/` on port 4173.
- Verification tools for the data: `verify/` (described in the SPEC).

## Workflow
`data-src/*.json` → `node gen-data.js` → `node dump.js > feats.json` → `python fit_weights.py` → `python model_selection.py [--nested]` → `npm test` → `npm run test:e2e` → `node build.js`.
If a change to the models or data is intended, refresh the golden rankings with `UPDATE_GOLDEN=1 npm test` and review the diff.

## Tests and CI
- `npm test` (node:test): `tests/unit/models.test.js` pins the reference results (Prediction 30/69, Fair 20/69, Mine 24/69 with the single fit; temporal 9/16 in 2010–2026; 2026 → Kane) and every model's full ranking (`tests/golden/rankings.json`); `tests/unit/data.test.js` checks data-src against the SPEC and that `gen-data.js` reproduces `data.js`/`sources.json`.
- `tests/unit/forecast.test.js` runs the forecast offline on made-up responses (`tests/fixtures/football-data`, regenerate with `node tests/fixtures/make-football-data.js`).
- `npm run test:e2e` (Playwright 1.63, `playwright.config.js`): `tools/e2e-build.js` builds `dist/` with a forecast made from the fixtures, then runs `tests/e2e/site.spec.js` on desktop Chromium, iPad Mini/iPhone 13 (WebKit) and Pixel 7. Install browsers once with `npx playwright install chromium webkit`.
- GitHub Actions: `ci.yml` (unit tests, data in sync, build, then e2e), `deploy.yml` (Pages after CI passes on main; needs a public repo and Pages source = GitHub Actions), `weights.yml` (reproduces `fit-result.json` and `model-selection.json` with `tools/check_results.py`, tolerance 2e-3, only when data/models/scripts change). `forecast.yml` (daily 06:30 UTC: update.js with the `FOOTBALL_DATA_TOKEN` secret, commit to main, `gh workflow run deploy.yml`). Dependabot monthly for npm, Actions and pip.

## Site (redesigned 30/10/2026)
Dark editorial theme with a gold accent (Fraunces + IBM Plex). Model colours validated for the dark surface with the dataviz validator: actual #b78a2e, Prediction #5b8def, Fair #22a38c, Mine #c45fc0 (Fair/Mine is in the 6–8 CVD band, so models are always labelled). Phone (< 700px): one model at a time (tabs or swipe), detail as a bottom sheet, bottom tab bar. Tablet (700–1099px): 2×2 grid, detail drawer. Desktop (≥ 1100px): all models side by side, sticky detail + tuning column, timeline of every year. Routes: no hash or `#/forecast` → 2027 forecast (shown as one more year, "Season so far" column instead of the vote); `#/years` → latest awarded year; `#/<year>`, `#/summary`, `#/method` (old `#a2026`, `#resumo`, `#metodo` still work). The Summary only counts awarded years. On the eligible list each year's Prediction uses that year's temporal weights (`temporal` in model-selection.json); 1956–1960 and the "Everyone" list use the single in-sample fit.

## Known gaps
- Reputation criteria and trophies/awards reach 15–16/16 when fitted to 2010–2026 but do not improve the honest forecast (see "Memorised fit" and "Trophies and awards" below).
- League strength is constant within a decade.
- What stays at confidence C is mostly before 1990 (players without a "Career statistics" table on English Wikipedia, tournaments without line-ups, Belgian titles, Argentina 1991–2014, West Germany before 1963, Messi 2026 in MLS). Assists stay estimated (aConf C).

## Step 1 (done) — data 1956–2025
User decisions: official top 10 per year + strong ineligibles (`elig: 0`, "Everyone" list); target of the "Everyone" list = France Football's retroactive winner (2016); window = calendar year up to 2021 (fallback `win: 'S'` → conf C), season from 2022; 2010–2021 redone as calendar years; assists estimated with `aConf`; league strength and cup weight per decade (eras.js); sources in sources.json; refits reported in-sample and LOO.
- Second automatic pass done (`verify/`): career table + season-page match boxes (calendar year counted match by match), league page (title, ≥ 1/3 of the games), European edition page (competition/stage by distance to the final), national-team line-ups. Manual corrections with reasons in `verify/overrides.json`.
- Confidence after the second pass: total A 52 / B 438 / C 313. 2010–2026: A 52 / B 116 / C 3; 1990–2009: B 166 / C 59; 1956–1989: B 156 / C 251. CY is at most B; seasons (2022+) can reach A. 178 rows on `win: "S"`.
- Refit with the second-pass data (fit-result.json):
  - train 2010–2025 (eligible): in-sample 14/15, LOO 9/15; only misses Modrić 2018 (→ Griezmann); 2026 → Mbappé.
  - train 1956–2025 (eligible): in-sample 30/69, LOO 27/69; 2010–2025 in-sample 8/15, LOO 8/15; 2026 → Kane.
  - train 1956–2025 ("Everyone"): in-sample 28/69, LOO 27/69; 2026 → Yamal.
  - Single fit: Prediction 30/69, Fair 20/69, Mine 24/69 (eligible). Fixed weights still do not explain 70 years of votes.
- Model selection (`model_selection.py`, TEMPORAL evaluation: to predict year Y, train only on years < Y). In 2010–2026 (16 years):
  - reference (19 criteria, train from 1956): 8/16.
  - window: from 1990/2000/2005 → 10/16; from 1956/1970/1980 → 8/16; rolling windows and recency weights do not help.
  - choosing criteria (backward elimination → 10 criteria) looked like 12/16, but making the choice only with each year's past gives 8/16 with mean rank 2.63: overfitting. The 19 criteria stay.
  - OFFICIAL PROCEDURE: 19 criteria; for each year pick the window/recency/reg that would best have predicted the previous 12 years → 9/16 without ever seeing the year (mean winner rank 1.88); 1961–2009 with the same rule 14/49. From 2013 it always picks "train from 2000". Model for 2027: train 2000–2026, reg 0.005, no recency. 2026 temporal forecast: Mbappé (Kane 2nd).
- "Memorised fit" (`memorisedFit`, fitting to the years being judged): with the 19 criteria the fit to 2010–2026 is 14/16 in-sample (misses Modrić 2018 and Messi 2023); adding ONE reputation criterion or "World Cup finalist who is not an attacker" → 16/16. Predicting unseen years none helps: 7–9/16 against 9/16 without them; all 11 together with window selection → 5/16. Conclusion: 16/16 is memorising; the Prediction keeps the 19 (`memorisedFit` in model-selection.json, table on the Method page).

## Step 2 (done 31/10/2026) — trophies and individual awards
- Collected for all 803 rows: 133 cups, 139 league top-scorer titles, 35 Golden Shoes, 54 continental and 36 tournament top-scorer titles, 39 tournament best-player awards; 169 rows awConf B.
- Study (`model_selection.py --awards`, rule fixed beforehand: 1961–2009 decides, 2010–2026 confirms). Base 19: 2010–2026 9/16 (rank 1.88), 1961–2009 14/49. Only the continental top-scorer title gained: 11/16 and 15/49, but mean rank 2.19 and it misses 2024, 2025 (8th), 2026; trophy count 15/49 but 7/16; the rest 8–9/16, 13–14/49. With 10 criteria tried this is within luck, so NOT adopted (user may decide otherwise).

## Next steps requested by the user
1. ~~Extend the data as far back as possible~~ (done, 1956–2026). To improve old C rows: Wikipedia in other languages (de/it/hu/fr) for career tables, RSSSF for old leagues.
2. ~~Add trophy/individual-award criteria~~ (done; none adopted, see Step 2).
3. ~~Forecast the next Ballon d'Or with automatic updates~~ (done 31/10/2026: forecast/, forecast.yml). First live run 2026-10-30: Prediction Raphinha, Yamal, Haaland, Mbappé, Olise, Kane. Keep `forecast/candidates.json` up to date with transfers; free football-data.org tier does not cover assists for non-scorers or other leagues.
