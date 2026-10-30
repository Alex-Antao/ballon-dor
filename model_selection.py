# Model selection for the Prediction model: which training window, how much weight on recent years and which criteria.
# TEMPORAL evaluation (as in a real forecast): to predict year Y, train only on years < Y.
# Reads feats.json (node dump.js > feats.json). Usage: PYTHONUTF8=1 python model_selection.py [--nested] [--extra]
# Writes model-selection.json (model-selection-extra.json with --extra). Does not touch fit-result.json.
import json, sys, time
import numpy as np
from scipy.optimize import linprog

D = json.load(open('feats.json', encoding='utf8'))
NAMES = ['prod', 'uStage', 'uWin', 'uProd', 'ntStage', 'ntWin', 'wcFinal', 'ntProd', 'title', 'cont', 'prodRel', 'uProdRel',
         'isAtt', 'goalsRel', 'uFinal', 'uWinXprod', 'ntWinXatt', 'ntFinal', 'prodXtitle']
FREE = {12}  # isAtt may be negative
L = 'elig'
YS = [int(y) for y in sorted(D, key=int) if D[y][L]['winner']]
TARGETS = [y for y in YS if 2010 <= y <= 2026]
F = {y: np.array([r['f'] for r in D[str(y)][L]['rows']], dtype=float) for y in YS}
# extra criteria from extra_criteria.py (reputation, top scorers, titles of midfielders…) go in columns 19+;
# they only enter the selection with --extra (otherwise they are only used for the "video style" comparison)
import extra_criteria
H = extra_criteria.history(D, L)
F = {y: np.hstack([F[y], extra_criteria.extra_matrix(D, L, y, H)]) for y in YS}
BASE = list(range(len(NAMES)))
NAMES = NAMES + [k for k, _ in extra_criteria.EXTRA]
EXTRA_ON = '--extra' in sys.argv
OUTF = 'model-selection-extra.json' if EXTRA_ON else 'model-selection.json'
WIN = {y: [r['n'] for r in D[str(y)][L]['rows']].index(D[str(y)][L]['winner']) for y in YS}
_cache = {}

def fit(train, idx, reg, half, T):
    """Weights (criteria idx only): each year's winner ahead of the others by a 0.05 margin; violations weighted by
    recency 0.5^((T-y)/half) (half=None → every year the same); L1 regularisation = reg."""
    key = (tuple(train), tuple(idx), reg, half, T)
    if key in _cache: return _cache[key]
    A, cw = [], []
    for y in train:
        f = F[y][:, idx]; w = WIN[y]
        rw = 1.0 if half is None else 0.5 ** ((T - y) / half)
        for i in range(len(f)):
            if i != w: A.append(f[w] - f[i]); cw.append(rw)
    A = np.array(A); m, n = A.shape
    c = np.r_[reg * np.ones(n), np.array(cw)]
    bounds = [((-3, 3) if idx[k] in FREE else (0, 3)) for k in range(n)] + [(0, None)] * m
    res = linprog(c, A_ub=np.c_[-A, -np.eye(m)], b_ub=-0.05 * np.ones(m), bounds=bounds, method='highs')
    w = res.x[:n]
    _cache[key] = w
    return w

def rank_of_winner(w, y, idx):
    # ties count against (with all-zero weights everyone ties, and that is not a hit)
    s = F[y][:, idx] @ w
    others = np.delete(s, WIN[y])
    return 1 + int(np.sum(others >= s[WIN[y]] - 1e-9))

def train_years(start, Y):
    """start > 0: years [start, Y-1]; start < 0: rolling window with the last -start years."""
    lo = start if start > 0 else Y + start
    return [y for y in YS if lo <= y < Y]

def rolling(cfg, idx, targets):
    """For each target year: train only on earlier years (see train_years), predict Y. Returns (hits, mean rank, ranks)."""
    start, half, reg = cfg
    rk = []
    for Y in targets:
        train = train_years(start, Y)
        w = fit(train, idx, reg, half, Y)
        rk.append(rank_of_winner(w, Y, idx))
    rk = np.array(rk)
    return int(np.sum(rk == 1)), float(rk.mean()), rk.tolist()

def score(r):  # ordering: more hits, then lower mean rank
    return (r[0], -r[1])

STARTS = [1956, 1970, 1980, 1990, 2000, 2005, -10, -15, -20, -25]   # negative = last N years
HALVES = [None, 20, 10, 5]
REGS = [0.005, 0.02, 0.1]
ALL = list(range(len(NAMES))) if EXTRA_ON else BASE

def grid(idx, targets):
    return {(s, h, r): rolling((s, h, r), idx, targets) for s in STARTS for h in HALVES for r in REGS}

def backward(cfg, idx, targets):
    """Backward elimination: drop the criterion whose removal most improves (or does not worsen) the temporal evaluation."""
    cur = list(idx); best = rolling(cfg, cur, targets); path = [(list(cur), best)]
    while len(cur) > 1:
        cands = [(score(rolling(cfg, [k for k in cur if k != j], targets)), j) for j in cur]
        sc, j = max(cands)
        if sc < score(best): break
        cur = [k for k in cur if k != j]; best = rolling(cfg, cur, targets); path.append((list(cur), best))
    return cur, best, path

def forward(cfg, targets, pool=ALL):
    cur, best = [], (-1, 99.0, [])
    while True:
        cands = [(score(rolling(cfg, sorted(cur + [j]), targets)), j) for j in pool if j not in cur]
        if not cands: break
        sc, j = max(cands)
        if sc <= score(best): break
        cur = sorted(cur + [j]); best = rolling(cfg, cur, targets)
    return cur, best

def label(cfg):
    s, h, r = cfg
    return f"train {('from ' + str(s)) if s > 0 else f'on the last {-s} years'}, {'no recency weight' if h is None else f'half-life {h} years'}, reg {r}"

out = {'targets': TARGETS, 'metric': 'temporal evaluation: for each target year, train only on earlier years'}
t0 = time.time()

# 0) reference: the single fit (all criteria, 1956+, no recency, reg 0.02)
base = rolling((1956, None, 0.02), ALL, TARGETS)
print(f"Reference (fit_weights.py: all criteria, from 1956): {base[0]}/{len(TARGETS)} hits, mean rank {base[1]:.2f}")
out['baseline'] = {'cfg': [1956, None, 0.02], 'hits': base[0], 'meanRank': base[1], 'ranks': base[2]}

# 1) windows / recency / regularisation with all criteria
G = grid(ALL, TARGETS)
top = sorted(G.items(), key=lambda kv: score(kv[1]), reverse=True)
print('\nTraining window and year weights (all criteria), best 8:')
for cfg, r in top[:8]: print(f"  {r[0]:2d}/{len(TARGETS)}  mean rank {r[1]:.2f}  — {label(cfg)}")
print('By training start (best recency/reg combination for each):')
for s in STARTS:
    c, r = max(((k, v) for k, v in G.items() if k[0] == s), key=lambda kv: score(kv[1]))
    print(f"  {('from ' + str(s)) if s > 0 else f'last {-s}'}: {r[0]:2d}/{len(TARGETS)}  mean rank {r[1]:.2f}  ({label(c)})")
out['grid'] = [{'cfg': list(k), 'hits': v[0], 'meanRank': v[1]} for k, v in top]
best_cfg = top[0][0]

# 2) criteria: backward elimination and forward selection, in the best configuration
bsel, bres, path = backward(best_cfg, ALL, TARGETS)
fsel, fres = forward(best_cfg, TARGETS)
print(f"\nCriteria (configuration: {label(best_cfg)}):")
print(f"  all ({len(ALL)}): {G[best_cfg][0]}/{len(TARGETS)}, mean rank {G[best_cfg][1]:.2f}")
print(f"  backward elimination → {len(bsel)} criteria: {bres[0]}/{len(TARGETS)}, mean rank {bres[1]:.2f}: {[NAMES[k] for k in bsel]}")
print(f"  forward selection → {len(fsel)} criteria: {fres[0]}/{len(TARGETS)}, mean rank {fres[1]:.2f}: {[NAMES[k] for k in fsel]}")
chosen, cres = (bsel, bres) if score(bres) >= score(fres) else (fsel, fres)
# refit the window with the chosen criteria
G2 = grid(chosen, TARGETS)
cfg2, r2 = max(G2.items(), key=lambda kv: score(kv[1]))
print(f"  with the chosen criteria, best configuration: {r2[0]}/{len(TARGETS)}, mean rank {r2[1]:.2f} — {label(cfg2)}")
out['selection'] = {'cfgAllFeatures': list(best_cfg), 'backward': [NAMES[k] for k in bsel], 'backwardRes': bres[:2],
                    'forward': [NAMES[k] for k in fsel], 'forwardRes': fres[:2], 'chosen': [NAMES[k] for k in chosen],
                    'cfg': list(cfg2), 'res': r2[:2], 'ranks': dict(zip(map(str, TARGETS), r2[2]))}

print('  temporal misses:', [(Y, D[str(Y)][L]['winner']) for Y, rk in zip(TARGETS, r2[2]) if rk != 1])

# 3) honest estimate: the choice (window + criteria) is also made only with each target year's past
if '--nested' in sys.argv:
    print('\nNested estimate (choice made only with years before the target):')
    nest = []
    for Y in TARGETS:
        val = [y for y in YS if Y - 12 <= y < Y and y >= 1990]          # validation years: the previous 12
        g = {k: rolling(k, ALL, val) for k in [(s_, h_, r_) for s_ in STARTS for h_ in HALVES for r_ in REGS] if k[0] < val[0]}
        c0 = max(g.items(), key=lambda kv: score(kv[1]))[0]
        sel, _, _ = backward(c0, ALL, val)
        g2 = {k: rolling(k, sel, val) for k in g}
        c1 = max(g2.items(), key=lambda kv: score(kv[1]))[0]
        w = fit(train_years(c1[0], Y), sel, c1[2], c1[1], Y)
        rk = rank_of_winner(w, Y, sel)
        nest.append(rk)
        print(f"  {Y}: picks {label(c1)}, {len(sel)} criteria → real winner ranked {rk} ({time.time() - t0:.0f}s)")
    out['nested'] = {'hits': int(sum(r == 1 for r in nest)), 'meanRank': float(np.mean(nest)), 'ranks': dict(zip(map(str, TARGETS), nest))}
    print(f"  total: {out['nested']['hits']}/{len(TARGETS)} hits, mean rank {out['nested']['meanRank']:.2f}")

# 4) OFFICIAL PROCEDURE (the only one validated honestly): all criteria; to predict year Y, pick the
#    window/recency/reg that would best have predicted the previous 12 years (≥ 1990) and train on the years < Y.
#    Years without 6 validation years (before 1996): train on every earlier year since 1956 (reg 0.02).
GRID = [(s_, h_, r_) for s_ in STARTS for h_ in HALVES for r_ in REGS]
def choose(Y):
    val = [y for y in YS if Y - 12 <= y < Y and y >= 1990]
    if len(val) < 6: return None
    g = {k: rolling(k, ALL, val) for k in GRID if k[0] < val[0]}
    return max(g.items(), key=lambda kv: score(kv[1]))[0]
print('\nOfficial procedure (window chosen only with the past, all criteria):')
temporal, nest2 = {}, []
for Y in [y for y in YS if y > YS[0] + 4] + [2027]:
    c1 = choose(Y) or (1956, None, 0.02)
    tr = train_years(c1[0], Y)
    if len(tr) < 5: continue
    w = fit(tr, ALL, c1[2], c1[1], Y)
    temporal[str(Y)] = {'weights': [round(float(x), 4) for x in w], 'train': [tr[0], tr[-1]], 'cfg': list(c1), 'label': label(c1)}
    if Y in F:
        rk = rank_of_winner(w, Y, ALL); temporal[str(Y)]['rank'] = rk
        if Y in TARGETS:
            nest2.append(rk); print(f"  {Y}: picks {label(c1)} → real winner ranked {rk}")
out['temporal'] = temporal
out['nestedWindow'] = {'hits': int(sum(r == 1 for r in nest2)), 'meanRank': float(np.mean(nest2)), 'ranks': dict(zip(map(str, TARGETS), nest2))}
old = [v['rank'] for k, v in temporal.items() if 'rank' in v and int(k) < 2010]
out['temporalOld'] = [int(sum(r == 1 for r in old)), len(old)]
print(f"  2010–2026: {out['nestedWindow']['hits']}/{len(TARGETS)} hits, mean rank {out['nestedWindow']['meanRank']:.2f}")
print(f"  1961–2009 (same rule; before 1996 train from 1956): {out['temporalOld'][0]}/{out['temporalOld'][1]}")
f27 = temporal['2027']
FN = [NAMES[k] for k in ALL]
out['final'] = {'features': FN, 'cfg': f27['cfg'], 'label': f27['label'], 'train': f27['train'],
                'weights': {n: v for n, v in zip(FN, f27['weights']) if abs(v) > 1e-6}}
print(f"  model for 2027: {f27['label']} (train {f27['train'][0]}–{f27['train'][1]})")
print('  weights:', out['final']['weights'])

# 5) "video style": fit 2010–2026 until every year is right in-sample, and see what it is worth predicting unseen years.
#    Each extra criterion is tested on its own on top of the 19 (official procedure = window chosen only with the past).
def procedure(idx):
    rk = []
    for Y in TARGETS:
        c1 = choose_idx(Y, idx)
        rk.append(rank_of_winner(fit(train_years(c1[0], Y), idx, c1[2], c1[1], Y), Y, idx))
    return int(sum(r == 1 for r in rk)), float(np.mean(rk))
def choose_idx(Y, idx):
    val = [y for y in YS if Y - 12 <= y < Y and y >= 1990]
    g = {k: rolling(k, idx, val) for k in GRID if k[0] < val[0]}
    return max(g.items(), key=lambda kv: score(kv[1]))[0]
print('\nVideo style (fit to 2010–2026, in-sample) vs prediction without seeing the year:')
vs = []
for extra in [None] + [k for k, _ in extra_criteria.EXTRA]:
    idx = BASE + ([NAMES.index(extra)] if extra else [])
    w = fit(TARGETS, idx, 0.005, None, 2027)
    ins = int(sum(rank_of_winner(w, y, idx) == 1 for y in TARGETS))
    h, m = procedure(idx)
    desc = dict(extra_criteria.EXTRA).get(extra, 'the 19 criteria only')
    vs.append({'extra': extra, 'desc': desc, 'inSample': ins, 'temporal': h, 'temporalRank': m})
    print(f"  {('+ ' + extra) if extra else '19 criteria':16s} in-sample {ins}/{len(TARGETS)} | unseen {h}/{len(TARGETS)} (rank {m:.2f})")
out['videoStyle'] = vs

json.dump(out, open(OUTF, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f'\n({time.time() - t0:.0f}s)')
