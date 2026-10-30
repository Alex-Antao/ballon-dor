# Ajuste dos pesos do Histórico: programa linear com hinge (cada vencedor deve ficar à frente de todos os outros
# candidatos do seu ano por uma margem; minimiza a soma das violações + regularização L1).
# Lê feats.json (node dump.js > feats.json). Reporta sempre dentro da amostra e leave-one-year-out (LOO).
import json, numpy as np
from scipy.optimize import linprog
D = json.load(open('feats.json'))
names = ['prod','uStage','uWin','uProd','ntStage','ntWin','wcFinal','ntProd','title','cont','prodRel','uProdRel',
         'isAtt','goalsRel','uFinal','uWinXprod','ntWinXatt','ntFinal','prodXtitle']
free = {12}  # isAtt pode ser negativo
YS = sorted(D, key=int)

def years(lo, hi, L):
    return [y for y in YS if lo <= int(y) <= hi and D[y][L]['real']]

def fit(ys, L, reg=0.02):
    A = []; n = len(names)
    for y in ys:
        b = D[y][L]; rows = b['rows']
        idx = [i for i, r in enumerate(rows) if r['n'] == b['real']][0]
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
    ins = {y: pick(w, y, L) == D[y][L]['real'] for y in ys}
    loo = {y: pick(fit([z for z in ys if z != y], L), y, L) == D[y][L]['real'] for y in ys}
    sub = lambda d, a, b: (sum(v for y, v in d.items() if a <= int(y) <= b), sum(1 for y in d if a <= int(y) <= b))
    out = {'list': L, 'train': [lo, hi], 'n': len(ys), 'weights': [round(float(x), 4) for x in w],
           'inSample': sum(ins.values()), 'loo': sum(loo.values()),
           'inSample2010': sub(ins, 2010, 2025), 'loo2010': sub(loo, 2010, 2025),
           'misses': [[y, D[y][L]['real'], pick(w, y, L)] for y in ys if not ins[y]],
           'pred2026': pick(w, '2026', L) if '2026' in D else None}
    print(f"[{key}] lista={L} treino {lo}–{hi} ({len(ys)} anos): dentro {out['inSample']}/{len(ys)}, LOO {out['loo']}/{len(ys)}"
          f" | só 2010–2025: dentro {out['inSample2010'][0]}/{out['inSample2010'][1]}, LOO {out['loo2010'][0]}/{out['loo2010'][1]}"
          f" | 2026 → {out['pred2026']}")
    print('   pesos', {a: b for a, b in zip(names, out['weights']) if b})
    for y, r, p in out['misses']: print(f'   falha {y}: {r} → {p}')
    return out

fits = {'recent': run('recent', 2010, 2025, 'elig'),
        'elig': run('elig', 1956, 2025, 'elig'),
        'all': run('all', 1956, 2025, 'all')}
main = fits['elig']
json.dump({'weights': main['weights'], 'inSample': main['inSample'], 'loo': main['loo'], 'n': main['n'],
           'train': main['train'], 'fits': fits}, open('fit-result.json', 'w'), ensure_ascii=False, indent=1)
