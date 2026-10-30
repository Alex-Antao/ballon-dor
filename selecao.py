# Seleção do modelo Histórico: que janela de treino, que peso dos anos recentes e que critérios usar.
# Avaliação TEMPORAL (como na previsão real): para prever o ano Y treina-se só com anos < Y.
# Lê feats.json (node dump.js > feats.json). Uso: PYTHONUTF8=1 python selecao.py [--aninhado]
# Escreve selecao-result.json. Não altera fit-result.json (pesos do site).
import json, sys, time
import numpy as np
from scipy.optimize import linprog

D = json.load(open('feats.json'))
NAMES = ['prod', 'uStage', 'uWin', 'uProd', 'ntStage', 'ntWin', 'wcFinal', 'ntProd', 'title', 'cont', 'prodRel', 'uProdRel',
         'isAtt', 'goalsRel', 'uFinal', 'uWinXprod', 'ntWinXatt', 'ntFinal', 'prodXtitle']
FREE = {12}  # isAtt pode ser negativo
L = 'elig'
YS = [int(y) for y in sorted(D, key=int) if D[y][L]['real']]
TARGETS = [y for y in YS if 2010 <= y <= 2026]
F = {y: np.array([r['f'] for r in D[str(y)][L]['rows']], dtype=float) for y in YS}
# critérios extra de criterios.py (reputação, melhores marcadores, títulos de médios…) ficam nas colunas 19+;
# só entram na seleção com --extra (sem isso servem apenas para a comparação "estilo vídeo")
import criterios
H = criterios.history(D, L)
F = {y: np.hstack([F[y], criterios.extra_matrix(D, L, y, H)]) for y in YS}
BASE = list(range(len(NAMES)))
NAMES = NAMES + [k for k, _ in criterios.EXTRA]
EXTRA_ON = '--extra' in sys.argv
OUTF = 'selecao-extra-result.json' if EXTRA_ON else 'selecao-result.json'
WIN = {y: [r['n'] for r in D[str(y)][L]['rows']].index(D[str(y)][L]['real']) for y in YS}
_cache = {}

def fit(train, idx, reg, half, T):
    """Pesos (só nos critérios idx): o vencedor de cada ano à frente dos outros por margem 0.05; violações pesadas por
    recência 0.5^((T-y)/half) (half=None → todos os anos iguais); regularização L1 = reg."""
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
    # empates contam contra (com pesos nulos todos empatam e isso não é um acerto)
    s = F[y][:, idx] @ w
    others = np.delete(s, WIN[y])
    return 1 + int(np.sum(others >= s[WIN[y]] - 1e-9))

def train_years(start, Y):
    """start > 0: anos [start, Y-1]; start < 0: janela deslizante com os últimos -start anos."""
    lo = start if start > 0 else Y + start
    return [y for y in YS if lo <= y < Y]

def rolling(cfg, idx, targets):
    """Para cada ano alvo: treino só com anos anteriores (ver train_years), prevê Y. Devolve (acertos, rank médio, ranks)."""
    start, half, reg = cfg
    rk = []
    for Y in targets:
        train = train_years(start, Y)
        w = fit(train, idx, reg, half, Y)
        rk.append(rank_of_winner(w, Y, idx))
    rk = np.array(rk)
    return int(np.sum(rk == 1)), float(rk.mean()), rk.tolist()

def score(r):  # ordenação: mais acertos, depois menor rank médio
    return (r[0], -r[1])

STARTS = [1956, 1970, 1980, 1990, 2000, 2005, -10, -15, -20, -25]   # negativos = últimos N anos
HALVES = [None, 20, 10, 5]
REGS = [0.005, 0.02, 0.1]
ALL = list(range(len(NAMES))) if EXTRA_ON else BASE

def grid(idx, targets):
    return {(s, h, r): rolling((s, h, r), idx, targets) for s in STARTS for h in HALVES for r in REGS}

def backward(cfg, idx, targets):
    """Eliminação para trás: retira o critério cuja saída mais melhora (ou não piora) a avaliação temporal."""
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
    return f"treino {('desde ' + str(s)) if s > 0 else f'com os últimos {-s} anos'}, {'sem peso de recência' if h is None else f'meia-vida {h} anos'}, reg {r}"

out = {'targets': TARGETS, 'metric': 'avaliação temporal: para cada ano alvo, treino só com anos anteriores'}
t0 = time.time()

# 0) referência: o ajuste atual (todos os critérios, 1956+, sem recência, reg 0.02)
base = rolling((1956, None, 0.02), ALL, TARGETS)
print(f"Referência (lp3 atual: todos os critérios, desde 1956): {base[0]}/{len(TARGETS)} acertos, rank médio {base[1]:.2f}")
out['baseline'] = {'cfg': [1956, None, 0.02], 'hits': base[0], 'meanRank': base[1], 'ranks': base[2]}

# 1) janelas / recência / regularização com todos os critérios
G = grid(ALL, TARGETS)
top = sorted(G.items(), key=lambda kv: score(kv[1]), reverse=True)
print('\nJanela de treino e peso dos anos (todos os critérios), melhores 8:')
for cfg, r in top[:8]: print(f"  {r[0]:2d}/{len(TARGETS)}  rank médio {r[1]:.2f}  — {label(cfg)}")
print('Por início do treino (melhor combinação de recência/reg para cada um):')
for s in STARTS:
    c, r = max(((k, v) for k, v in G.items() if k[0] == s), key=lambda kv: score(kv[1]))
    print(f"  {('desde ' + str(s)) if s > 0 else f'últimos {-s}'}: {r[0]:2d}/{len(TARGETS)}  rank médio {r[1]:.2f}  ({label(c)})")
out['grid'] = [{'cfg': list(k), 'hits': v[0], 'meanRank': v[1]} for k, v in top]
best_cfg = top[0][0]

# 2) critérios: eliminação para trás e seleção para a frente, na melhor configuração
bsel, bres, path = backward(best_cfg, ALL, TARGETS)
fsel, fres = forward(best_cfg, TARGETS)
print(f"\nCritérios (configuração: {label(best_cfg)}):")
print(f"  todos ({len(ALL)}): {G[best_cfg][0]}/{len(TARGETS)}, rank médio {G[best_cfg][1]:.2f}")
print(f"  eliminação para trás → {len(bsel)} critérios: {bres[0]}/{len(TARGETS)}, rank médio {bres[1]:.2f}: {[NAMES[k] for k in bsel]}")
print(f"  seleção para a frente → {len(fsel)} critérios: {fres[0]}/{len(TARGETS)}, rank médio {fres[1]:.2f}: {[NAMES[k] for k in fsel]}")
chosen, cres = (bsel, bres) if score(bres) >= score(fres) else (fsel, fres)
# reajustar janela com os critérios escolhidos
G2 = grid(chosen, TARGETS)
cfg2, r2 = max(G2.items(), key=lambda kv: score(kv[1]))
print(f"  com os critérios escolhidos, melhor configuração: {r2[0]}/{len(TARGETS)}, rank médio {r2[1]:.2f} — {label(cfg2)}")
out['selection'] = {'cfgAllFeatures': list(best_cfg), 'backward': [NAMES[k] for k in bsel], 'backwardRes': bres[:2],
                    'forward': [NAMES[k] for k in fsel], 'forwardRes': fres[:2], 'chosen': [NAMES[k] for k in chosen],
                    'cfg': list(cfg2), 'res': r2[:2], 'ranks': dict(zip(map(str, TARGETS), r2[2]))}

print('  falhas temporais:', [(Y, D[str(Y)][L]['real']) for Y, rk in zip(TARGETS, r2[2]) if rk != 1])

# 3) estimativa honesta: a escolha (janela + critérios) também é feita só com o passado de cada ano alvo
if '--aninhado' in sys.argv:
    print('\nEstimativa aninhada (escolha feita só com anos anteriores ao alvo):')
    nest = []
    for Y in TARGETS:
        val = [y for y in YS if Y - 12 <= y < Y and y >= 1990]          # anos de validação: os 12 anteriores
        g = {k: rolling(k, ALL, val) for k in [(s_, h_, r_) for s_ in STARTS for h_ in HALVES for r_ in REGS] if k[0] < val[0]}
        c0 = max(g.items(), key=lambda kv: score(kv[1]))[0]
        sel, _, _ = backward(c0, ALL, val)
        g2 = {k: rolling(k, sel, val) for k in g}
        c1 = max(g2.items(), key=lambda kv: score(kv[1]))[0]
        w = fit(train_years(c1[0], Y), sel, c1[2], c1[1], Y)
        rk = rank_of_winner(w, Y, sel)
        nest.append(rk)
        print(f"  {Y}: escolhe {label(c1)}, {len(sel)} critérios → vencedor real em {rk}.º ({time.time() - t0:.0f}s)")
    out['nested'] = {'hits': int(sum(r == 1 for r in nest)), 'meanRank': float(np.mean(nest)), 'ranks': dict(zip(map(str, TARGETS), nest))}
    print(f"  total: {out['nested']['hits']}/{len(TARGETS)} acertos, rank médio {out['nested']['meanRank']:.2f}")

# 4) PROCEDIMENTO OFICIAL (o único validado de forma honesta): critérios todos; para prever o ano Y escolhe-se a
#    janela/recência/reg que melhor teria previsto os 12 anos anteriores (≥ 1990) e treina-se com os anos < Y.
#    Anos sem 6 anos de validação (antes de 1996): treino com todos os anos anteriores desde 1956 (reg 0.02).
GRID = [(s_, h_, r_) for s_ in STARTS for h_ in HALVES for r_ in REGS]
def choose(Y):
    val = [y for y in YS if Y - 12 <= y < Y and y >= 1990]
    if len(val) < 6: return None
    g = {k: rolling(k, ALL, val) for k in GRID if k[0] < val[0]}
    return max(g.items(), key=lambda kv: score(kv[1]))[0]
print('\nProcedimento oficial (janela escolhida só com o passado, todos os critérios):')
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
            nest2.append(rk); print(f"  {Y}: escolhe {label(c1)} → vencedor real em {rk}.º")
out['temporal'] = temporal
out['nestedWindow'] = {'hits': int(sum(r == 1 for r in nest2)), 'meanRank': float(np.mean(nest2)), 'ranks': dict(zip(map(str, TARGETS), nest2))}
old = [v['rank'] for k, v in temporal.items() if 'rank' in v and int(k) < 2010]
out['temporalOld'] = [int(sum(r == 1 for r in old)), len(old)]
print(f"  2010–2026: {out['nestedWindow']['hits']}/{len(TARGETS)} acertos, rank médio {out['nestedWindow']['meanRank']:.2f}")
print(f"  1961–2009 (mesma regra; antes de 1996 treino desde 1956): {out['temporalOld'][0]}/{out['temporalOld'][1]}")
f27 = temporal['2027']
FN = [NAMES[k] for k in ALL]
out['final'] = {'features': FN, 'cfg': f27['cfg'], 'label': f27['label'], 'train': f27['train'],
                'weights': {n: v for n, v in zip(FN, f27['weights']) if abs(v) > 1e-6}}
print(f"  modelo para 2027: {f27['label']} (treino {f27['train'][0]}–{f27['train'][1]})")
print('  pesos:', out['final']['weights'])

# 5) "estilo vídeo": ajustar a 2010–2026 até acertar todos dentro da amostra, e ver quanto vale a prever sem ver o ano.
#    Cada critério extra é testado sozinho por cima dos 19 (procedimento oficial = janela escolhida só com o passado).
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
print('\nEstilo vídeo (ajuste a 2010–2026 dentro da amostra) vs previsão sem ver o ano:')
vs = []
for extra in [None] + [k for k, _ in criterios.EXTRA]:
    idx = BASE + ([NAMES.index(extra)] if extra else [])
    w = fit(TARGETS, idx, 0.005, None, 2027)
    ins = int(sum(rank_of_winner(w, y, idx) == 1 for y in TARGETS))
    h, m = procedure(idx)
    desc = dict(criterios.EXTRA).get(extra, 'só os 19 critérios')
    vs.append({'extra': extra, 'desc': desc, 'inSample': ins, 'temporal': h, 'temporalRank': m})
    print(f"  {('+ ' + extra) if extra else '19 critérios':16s} dentro {ins}/{len(TARGETS)} | sem ver o ano {h}/{len(TARGETS)} (rank {m:.2f})")
out['videoStyle'] = vs

json.dump(out, open(OUTF, 'w'), ensure_ascii=False, indent=1)
print(f'\n({time.time() - t0:.0f}s)')
