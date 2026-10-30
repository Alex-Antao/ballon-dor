# Ballon d'Or Lab

Three algorithms that pick the Ballon d'Or winner, compared with the real vote every year from 1956 to 2026, and the groundwork for forecasting the next award.

- **Prediction** — a linear score over 19 criteria whose weights are fitted to past winners. Each year is predicted using only earlier years, so the hit rate is an honest forecast (9 of 16 in 2010–2026).
- **Fair** — individual performance only, adjusted for position, league strength and games played.
- **My model** — individual performance plus team credit in proportion to the player's own contribution; every weight can be tuned on the site.

It started as a reconstruction of the models in the video “I know who wins the Ballon d'Or 2026” (Pogorabona). It is not the video's model.

## Run it

```bash
npm ci
node build.js          # writes dist/
npm run serve          # http://localhost:4173
```

## Data and models

| Step | Command | Output |
|---|---|---|
| Merge the source data | `node gen-data.js` | `data.js`, `sources.json` |
| Export the features | `node dump.js > feats.json` | `feats.json` |
| Single fit of the weights | `python fit_weights.py` | `fit-result.json` |
| Temporal model selection | `python model_selection.py [--nested]` | `model-selection.json` |
| Build the site | `node build.js` | `dist/` |

The data format and the verification method are in [data-src/SPEC.md](data-src/SPEC.md). Every row carries a confidence grade (A verified, B partly verified, C estimate) and its sources.

## Tests

```bash
npm test               # models and data (node:test)
npx playwright install chromium webkit
npm run test:e2e       # site on phone, tablet and desktop (Playwright)
```

GitHub Actions runs both on every push, re-checks the fitted weights when the data or models change, and deploys `dist/` to GitHub Pages from `main`.
