# Fits the Prediction weights: linear program with a hinge (each winner must beat every other candidate of their
# year by a margin; minimises the sum of the violations + L1 regularisation).
# Reads feats.json (node dump.js > feats.json). Always reports in-sample and leave-one-year-out (LOO).
# Usage: python fit_weights.py [--out FILE]   → writes fit-result.json
import json, sys, numpy as np
sys.stdout.reconfigure(encoding="utf-8")  # names and arrows print fine on Windows consoles too
from scipy.optimize import linprog
D = json.load(open('feats.json', encoding='utf8'))
names = ['prod','uStage','uWin','uProd','ntStage','ntWin','wcFinal','ntProd','title','contTeam','prodRel','uProdRel',
         'isAtt','goalsRel','uFinal','uWinXprod','ntWinXatt','ntFinal','prodXtitle']
free = {12}  # isAtt may be negative
YS = sorted(D, key=int)

def years(lo, hi, L):
    return [y for y in YS if lo <= int(y) <= hi and D[y][L]['winner']]

def fit(ys, L, reg=0.02):
    A = []; n = len(names)
    for y in ys:
        b = D[y][L]; rows = b['rows']
        idx = [i for i, r in enumerate(rows) if r['n'] == b['winner']][0]
        for i, r in enumerate(rows):
            if i != idx: A.append(np.array(rows[idx]['f']) - np.array(r['f']))
    A = np.array(A); m = len(A)
    c = np.r_[reg * np.ones(n), np.ones(m)]
    res = linprog(c, A_ub=np.c_[-A, -np.eye(m)], b_ub=-0.05 * np.ones(m),
                  bounds=[((-3, 3) if i in free else (0, 3)) for i in range(n)] + [(0, None)] * m)
    return res.x[:n]

def pick(w, y, L):
    rows = D[y][L]['rows']
    return max(rows, key=lambda r: float(np.dot(w, r['f'])))['n']

def run(key, lo, hi, L):
    ys = years(lo, hi, L); w = fit(ys, L)
    ins = {y: pick(w, y, L) == D[y][L]['winner'] for y in ys}
    loo = {y: pick(fit([z for z in ys if z != y], L), y, L) == D[y][L]['winner'] for y in ys}
    sub = lambda d, a, b: (sum(v for y, v in d.items() if a <= int(y) <= b), sum(1 for y in d if a <= int(y) <= b))
    out = {'list': L, 'train': [lo, hi], 'n': len(ys), 'weights': [round(float(x), 4) for x in w],
           'inSample': sum(ins.values()), 'loo': sum(loo.values()),
           'inSample2010': sub(ins, 2010, 2025), 'loo2010': sub(loo, 2010, 2025),
           'misses': [[y, D[y][L]['winner'], pick(w, y, L)] for y in ys if not ins[y]],
           'pred2026': pick(w, '2026', L) if '2026' in D else None}
    print(f"[{key}] list={L} train {lo}–{hi} ({len(ys)} years): in-sample {out['inSample']}/{len(ys)}, LOO {out['loo']}/{len(ys)}"
          f" | 2010–2025 only: in-sample {out['inSample2010'][0]}/{out['inSample2010'][1]}, LOO {out['loo2010'][0]}/{out['loo2010'][1]}"
          f" | 2026 → {out['pred2026']}")
    print('   weights', {a: b for a, b in zip(names, out['weights']) if b})
    for y, r, p in out['misses']: print(f'   miss {y}: {r} → {p}')
    return out

fits = {'recent': run('recent', 2010, 2025, 'elig'),
        'elig': run('elig', 1956, 2025, 'elig'),
        'all': run('all', 1956, 2025, 'all')}
main = fits['elig']
json.dump({'weights': main['weights'], 'inSample': main['inSample'], 'loo': main['loo'], 'n': main['n'],
           'train': main['train'], 'fits': fits}, open(sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'fit-result.json', 'w', encoding='utf8'), ensure_ascii=False, indent=1)
