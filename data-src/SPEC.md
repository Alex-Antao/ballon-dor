# Source data specification (data-src/*.json)

Each `data-src/YYYY-YYYY.json` file covers a block of years. `gen-data.js` merges them into `data.js` (no sources) and `sources.json` (sources only). `tests/unit/data.test.js` checks the rules below.

## Format

```json
{
  "1998": {
    "label": "Calendar year 1998 (+ World Cup 1998)",
    "award": "Ballon d’Or (France Football; European journalists)",
    "winner": "Zinedine Zidane",
    "winnerAll": null,
    "winnerAllNote": "",
    "window": "CY",
    "notes": "free text (English) about the year's particulars",
    "rows": [
      { "name": "Zinedine Zidane", "club": "Juventus", "lg": "SA", "pos": "AM",
        "gp": 0, "g": 0, "a": 0, "uT": "UCL", "uG": 0, "uA": 0, "uS": 4,
        "ntGP": 0, "ntG": 0, "ntA": 0, "ntT": "WC", "ntS": 5,
        "title": 1, "cup": 0, "lgTop": 0, "gs": 0, "uTop": 0, "ntTop": 0, "ntBest": 1,
        "cont": null, "rank": 1, "elig": 1,
        "win": "CY", "conf": "A", "aConf": "C", "awConf": "A",
        "sources": ["https://..."], "note": "" }
    ]
  }
}
```

## Year / window
- `window`: `CY` = calendar year (1 Jan–31 Dec of year Y). Applies to EVERY year up to 2021 (incl. 2010–2015, FIFA Ballon d’Or). `P` = official season (2022+: the season ending in Y; 2023 includes the 2022 World Cup).
- `winner`: official Ballon d'Or winner that year (`null` if not awarded, e.g. 2020).
- `winnerAll`: only set when France Football (2016) RETROACTIVELY gave the award to a player who was ineligible that year (e.g. Pelé, Maradona). Otherwise `null`. Confirm on the web.
- `label`, `award`, `notes` in English.

## Rows (candidates)
- Top 10 of the official vote (ties count: include everyone tied for 10th).
- Plus, when relevant, 1–3 INELIGIBLE players who would have been strong candidates (`elig: 0`, `rank: null`). France Football's retroactive winner, if any, must be there.
- `elig`: 1956–1994 European players only; 1995–2006 any nationality but at a European club; 2007+ everyone. 1 = could win under that year's rules.

## Scope of the statistics (the same for everyone)
Only the national LEAGUE + CONTINENTAL CLUB COMPETITION + FINAL TOURNAMENT of a national-team competition. Domestic cups, super cups, Intercontinental/Club World Cup, qualifiers and friendlies do NOT count.

With `window: CY`, count what was played between 1 Jan and 31 Dec of Y (second half of season Y-1/Y + first half of Y/Y+1; calendar-year leagues, such as Brazil/USSR/Scandinavia, count the year). If the split cannot be obtained, use the season ending in Y (`win: "S"`, and `conf` becomes "C"). With `window: P`, `win: "P"`.

- `name`: as in the current data.js when the player already exists (e.g. "Lionel Messi", "Cristiano Ronaldo", "Andrés Iniesta").
- `club`: main club in the window (if they moved, "Club A / Club B"), under its usual English name and spelt the same way in every row (a club's former name, such as "CDNA Sofia" or "Újpesti Dózsa", stays for the years it was used). `lg` = league of the club where they played most games.
- `lg` (codes): EPL (English top flight, incl. First Division), LL, BL (West German Bundesliga; before 1963 Oberliga = GER), SA, L1, ERE, POR, SCO, BEL, AUT, SUI, SWE, DEN, NOR, TUR, GRE, URS, RUS, UKR, YUG, TCH, HUN, POL, ROU, BUL, DDR, BRA, ARG, URU, MEX, MLS, KSA. Other → 3-letter code, explained in `note`.
- `pos`: FW (centre-forward), W (winger/wide forward), AM (attacking midfielder/10), CM, DM, DF, GK.
- `gp/g/a`: games/goals/assists in the league + continental competition.
- `uT`: continental competition whose knockout phase took place in the window (for CY, the edition ending in Y; if the player was in two, the more important one). Codes: UCL (European Champion Clubs' Cup / Champions League), CWC (Cup Winners' Cup), UEL (UEFA Cup / Europa League / Inter-Cities Fairs Cup), ECL (Conference League), LIB (Libertadores), SUD (Sudamericana), "" none.
- `uG/uA`: continental goals/assists in the window (a subset of g/a).
- `uS`: stage reached in that edition, counted by distance to the final: 0 = out before the round of 16 or did not play, 1 = round of 16 (or equivalent round: 16 teams), 2 = quarter-finals, 3 = semi-finals, 4 = lost final, 5 = winner. Formats with groups (UCL 1992/93, 1993/94; old Libertadores) → equivalent by distance to the final. Do NOT discount by competition: the weight of each competition is handled in models.js.
- `ntT`: WC, EURO, COPA, AFCON, ASIAN, GOLD or "" (the Confederations Cup and the Olympic Games do NOT count). `ntGP/ntG/ntA` games/goals/assists in the final tournament only. `ntS` final-tournament stage on the same 0–5 scale (group stage = 0; formats with a second group/league stage → equivalent by distance to the final; Copa América as a league: 1st = 5, 2nd = 4, 3rd/4th = 3, rest = 1). Euro 1960–1976 (4 teams): semi-finals = 3.
- `nlGP/nlG/nlS` (optional): UEFA Nations League Finals (final four: 2019, 2021, 2023, 2025), only on rows of players who played in them; kept apart from `ntT` because 2021 also had the Euro. Games and goals from the Finals line-ups and match boxes (assists not collected); `nlS` 3 = semi-final (incl. the third-place match), 4 = lost final, 5 = winner. Filled by `node verify/nations-league.js --write`.
- `uOpp/uOppN` (optional, UEFA competitions only): strength of the opponents of the continental goals, filled by `node verify/opponents.js --write`.
  - Each opponent's strength comes from the UEFA club ranking used for that season's draws (5-year coefficients, Bert Kassies' database, `verify/kassies.js`; the 1960 ranking for earlier seasons). It is √(opponent's coefficient / coefficient of the club ranked 32nd), kept within 0.3–2. With the 32nd club as reference, the candidates' average Champions League goal is worth about 1.
  - `uOpp` is the mean over the player's goals in the window, read from the match boxes of the edition pages, with qualifiers left out. With no goal found, it is the mean over the club's matches in the window.
  - `uOppN` is the number of goals it was read from (0 = the club's matches).
  - A club missing from the ranking because it had no European points in the previous five years gets the lowest value. A name found in no ranking is left out of the mean.
  - Fair and Custom weight continental goals and assists by `uOpp` instead of the competition weight × league strength. The Prediction does not use it.
- `title`: 1 if they were league champion in a league whose season ended in the window, with a relevant role (≥1/3 of the games).
- Trophies and individual awards (0/1), filled by `node verify/awards.js` from Wikipedia infoboxes and the European Golden Shoe table, for the season ending in the window (calendar-year leagues: the year):
  - `cup`: the player's club won the main domestic cup (for "Club A / Club B": A in a calendar year, B in a season).
  - `lgTop`: top scorer of the league (shared counts). `gs`: European Golden Shoe (awarded from 1967–68; none 1991–1996).
  - `uTop`: top scorer of the continental edition in `uT`. `ntTop` / `ntBest`: top scorer / best player of the tournament in `ntT`.
  - `awConf`: A if every page was found, B if some were missing (that award stays 0 and the note says which).
- `cont`: only for CM/DM/DF/GK (null for FW/W/AM). Non-attacking contribution 0–10, a SUBJECTIVE ESTIMATE. Calibration of the current data: Neuer 2014 = 10, Rodri 2024 = 10, Buffon 2017 = 9.5, Van Dijk 2019 = 9.5, Modrić 2018 = 9.5, Kanté 2021 = 9.5, Xavi = 9, Thiago Silva 2013 = 9, Carvajal 2024 = 9, Iniesta = 8.5, Jorginho 2021 = 8.5, Vitinha 2025 = 8.5, Hakimi 2025 = 8.5. An elite candidate is typically between 7 and 10.
- `rank`: position in the official vote (ties = same position). `null` if not voted for/ineligible.
- `conf` (numbers other than assists): A = verified in ≥1 reliable source for that window; B = partly verified (e.g. season totals verified, calendar-year split estimated from known games); C = estimate, or `win: "S"` in a CY year.
- `aConf`: confidence of a/uA/ntA (before ~2005 usually C = estimated).
- `sources`: URLs actually consulted for that row. `note`: doubts, disagreements between sources, etc.

## Rules decided after the first pass
- **Europe without an edition ending in Y:** `uT` = competition played in the autumn of Y, `uS` = 0. `g`/`uG` (and `gp`) include ALL continental games of the calendar year (from both editions); `uT`/`uS` refer to the edition ending in Y when there is one.
- **Revoked titles:** what was known at the time of the vote (December of Y) counts. Juventus 2004/05 counts in 2005 (only revoked in 2006); Juventus 2005/06 does not count in 2006; Marseille 1992/93 does not count in 1993.
- **Two national-team tournaments in the same year** (e.g. AFCON + World Cup): keep the one with the higher `ntS` × NTMULT (tie → higher output); the other goes in `note`.
- **Brazil before 1971:** state championship + national tournament as `lg: "BRA"`.
- Extra leagues accepted: EN2 (English second tier), ITB (Serie B), CZE, PER, CHN.

## Verification method (second pass)
- Read Wikipedia as wikitext: `curl -s "https://en.wikipedia.org/w/index.php?title=TITLE&action=raw"` (other languages: swap `en`). Find titles with `https://en.wikipedia.org/w/api.php?action=opensearch&search=...&format=json`.
- Useful sources: club season pages (`2012–13 FC Barcelona season`, with match-by-match scorers → allow counting the calendar year), the pages of the national-team tournaments and of each European edition, the player's career statistics, RSSSF (`www.rsssf.org`), eu-football.info (national-team games).
- Do NOT use transfermarkt, fbref or worldfootball (anti-bot protection) and never fake the user agent. Avoid WebSearch (shared quota).
- Confidence per row = the weakest component of (gp/g, uG/uS, nt*, title):
  - A: calendar-year numbers (or season numbers, if window P) counted from match-by-match data or from official totals for that exact window.
  - B: season totals verified and calendar-year split estimated with partial data.
  - C: estimate.
- `aConf`: A/B only when a source records assists; otherwise C.

### Tools (verify/)
`node verify/resolve.js` (names → Wikipedia titles in `verify/titles.json`; namesakes per era with a `Name@2010` key), then per block `node verify/verify.js 2010-2014.json [years]` (proposals in `verify/work/prop/`, report on screen), `node verify/big.js 2010-2014.json` (large differences to review by hand) and `node verify/apply.js 2010-2014.json` (writes to data-src; manual corrections in `verify/overrides.json`). Page cache in `verify/work/` (not versioned). To re-apply a block, always start from the clean file (`git checkout`), otherwise the "Changed: …" note loses the old values.
- Club (`club.js`): the player's "Career statistics" table (league + Europe column per season) + the match boxes of the season pages (`{{football box}}`, Date/Scorers tables, `{{X matches|…}}` templates expanded through the API). Calendar-year goals counted match by match (scaled if the page does not match the table); games = season games × share of the club's games in the year (so CY is at most B). Incomplete page → 50%; no page at all → season ending in the year (`win: "S"`, C). B teams/reserves ignored.
- Title (`club.js`): `champions` field of the infobox of that season's league page; counts with ≥ 10 league games.
- European competition/stage (`eu.js`): round sections of the page of the edition ending in Y (and sub-pages), stage = distance to the final; champion from the `champion(s)`/`champion_other` field. If the club played the knockout phase of a competition, that one stays (e.g. Atlético 2009/10 → UEL won, not the UCL group stage). No edition ending in Y → the autumn competition with `uS` 0.
- National team (`nt.js`): the tournament's sub-pages (groups, knockout stage, final and matches with an article of their own); games = in the starting line-up or on as a substitute (`{{subon}}`); goals from the boxes; the team's stage from the furthest round (champion from the tournament infobox). Games without a line-up on Wikipedia → `ntGP` does not go down and the component stays B. Formats with a second group stage (World Cups 1974–82, Euro 1980, Copa América < 1993) → `ntS` stays manual.
