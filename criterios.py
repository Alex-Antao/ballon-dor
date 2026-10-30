# Critérios extra para o modelo Previsão, calculados a partir de feats.json (campo x de cada linha).
# Só usam informação conhecida antes da votação do ano: resultados oficiais dos anos anteriores e números do próprio ano.
import numpy as np

EXTRA = [
    ('bdoWins',     'Bolas de Ouro ganhas antes'),
    ('prevWinner',  'Ganhou a Bola de Ouro anterior'),
    ('podium3',     'Pódios nos 3 anos anteriores'),
    ('topScorer',   'Melhor marcador entre os candidatos'),
    ('uTopScorer',  'Melhor marcador europeu entre os candidatos'),
    ('ntTopScorer', 'Melhor marcador do torneio de seleções entre os candidatos'),
    ('ntWinMid',    'Campeão de seleções sem ser atacante'),
    ('wcFinalMid',  'Finalista do Mundial sem ser atacante'),
    ('uWinMid',     'Campeão europeu (UCL) sem ser atacante'),
    ('double',      'Campeão europeu (UCL) e de seleções no mesmo ano'),
    ('leagueUcl',   'Campeão nacional e europeu (UCL) no mesmo ano'),
]
ATT = {'FW', 'W', 'AM'}
NTW = {'WC': 1, 'EURO': 1, 'COPA': 0.8, 'AFCON': 0.5, 'ASIAN': 0.4, 'GOLD': 0.4}

def history(D, L):
    """{nome: [(ano, rank, venceu)]} a partir das votações oficiais."""
    h = {}
    for y in sorted(D, key=int):
        b = D[y][L]
        for r in b['rows']:
            rk = r['x']['rank']
            if rk or r['n'] == b['real']:
                h.setdefault(r['n'], []).append((int(y), rk, r['n'] == b['real']))
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
