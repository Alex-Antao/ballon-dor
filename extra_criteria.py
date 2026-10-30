# Extra criteria for the Prediction model, computed from feats.json (the x field of each row).
# They only use information known before that year's vote: official results of earlier years and the year's own numbers.
import numpy as np

EXTRA = [
    ('bdoWins',     "Ballon d'Or wins before"),
    ('prevWinner',  "Won the previous Ballon d'Or"),
    ('podium3',     'Podiums in the previous 3 years'),
    ('topScorer',   'Top scorer among the candidates'),
    ('uTopScorer',  'Top European scorer among the candidates'),
    ('ntTopScorer', 'Top national-team tournament scorer among the candidates'),
    ('ntWinMid',    'National-team champion who is not an attacker'),
    ('wcFinalMid',  'World Cup finalist who is not an attacker'),
    ('uWinMid',     'European champion (UCL) who is not an attacker'),
    ('double',      'European (UCL) and national-team champion in the same year'),
    ('leagueUcl',   'League and European (UCL) champion in the same year'),
]
# Trophies and individual awards (fields filled by verify/awards.js from Wikipedia).
AWARDS = [
    ('cup',      'Domestic cup winner'),
    ('trophies', 'Major trophies in the year (league, cup, continental, national team)'),
    ('lgTop',    'League top scorer'),
    ('gs',       'European Golden Shoe'),
    ('uTop',     'Top scorer of the continental competition'),
    ('ntTop',    'Top scorer of the national-team tournament'),
    ('ntBest',   'Best player of the national-team tournament'),
    ('awards',   'Individual awards in the year (top scorer titles, Golden Shoe, best player)'),
]
ATT = {'FW', 'W', 'AM'}
NTW = {'WC': 1, 'EURO': 1, 'COPA': 0.8, 'AFCON': 0.5, 'ASIAN': 0.4, 'GOLD': 0.4}

def history(D, L):
    """{name: [(year, rank, won)]} from the official votes."""
    h = {}
    for y in sorted(D, key=int):
        b = D[y][L]
        for r in b['rows']:
            rk = r['x']['rank']
            if rk or r['n'] == b['winner']:
                h.setdefault(r['n'], []).append((int(y), rk, r['n'] == b['winner']))
    return h

def extra_matrix(D, L, y, H):
    rows = D[str(y)][L]['rows']
    X = [r['x'] for r in rows]
    mg = max(x['g'] for x in X); mu = max(x['uG'] for x in X); mn = max(x['ntG'] for x in X)
    out = []
    for r, x in zip(rows, X):
        past = [p for p in H.get(r['n'], []) if p[0] < y]
        wins = sum(1 for p in past if p[2])
        prev = any(p[0] == y - 1 and p[2] for p in past) or (y == 2021 and any(p[0] == 2019 and p[2] for p in past))
        pod = sum(1 for p in past if y - 3 <= p[0] < y and p[1] and p[1] <= 3)
        mid = x['pos'] not in ATT
        ntw = NTW.get(x['ntT'], 0) if x['ntS'] == 5 else 0
        ucl = x['uS'] == 5 and x['uT'] == 'UCL'
        out.append([min(wins / 3, 1), 1.0 if prev else 0.0, pod / 3,
                    1.0 if x['g'] == mg and mg > 0 else 0.0, 1.0 if x['uG'] == mu and mu > 0 else 0.0,
                    1.0 if x['ntG'] == mn and mn > 0 else 0.0,
                    ntw if mid else 0.0, 1.0 if (mid and x['ntT'] == 'WC' and x['ntS'] >= 4) else 0.0,
                    1.0 if (mid and ucl) else 0.0, 1.0 if (ucl and ntw) else 0.0, 1.0 if (ucl and x['title']) else 0.0])
    return np.array(out, dtype=float)

def award_matrix(D, L, y):
    out = []
    for r in D[str(y)][L]['rows']:
        x = r['x']
        trophies = x['title'] + x['cup'] + (1 if x['uS'] == 5 else 0) + (1 if x['ntS'] == 5 else 0)
        indiv = x['lgTop'] + x['gs'] + x['uTop'] + x['ntTop'] + x['ntBest']
        out.append([x['cup'], trophies / 4, x['lgTop'], x['gs'], x['uTop'], x['ntTop'], x['ntBest'], min(indiv / 3, 1)])
    return np.array(out, dtype=float)
