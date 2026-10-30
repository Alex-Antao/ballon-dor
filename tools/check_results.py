# Compares a freshly computed result JSON with the committed one, allowing tiny float differences between
# platforms (the LP solver can differ in the last digits). Used by the "Weights" workflow.
# Usage: python tools/check_results.py committed.json fresh.json [--ignore key ...]
import json, sys

TOL = 2e-3

def diff(a, b, path, out):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a or k not in b: out.append(f'{path}.{k}: only in {"committed" if k in a else "fresh"}')
            else: diff(a[k], b[k], f'{path}.{k}', out)
    elif isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b): out.append(f'{path}: length {len(a)} vs {len(b)}')
        else:
            for i, (x, y) in enumerate(zip(a, b)): diff(x, y, f'{path}[{i}]', out)
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        if abs(a - b) > TOL: out.append(f'{path}: {a} vs {b}')
    elif a != b:
        out.append(f'{path}: {a!r} vs {b!r}')

args = sys.argv[1:]
ignore = set(args[args.index('--ignore') + 1:]) if '--ignore' in args else set()
committed, fresh = (json.load(open(f, encoding='utf8')) for f in args[:2])
for k in ignore:
    committed.pop(k, None); fresh.pop(k, None)
out = []
diff(committed, fresh, '$', out)
if out:
    print(f'{args[0]} is out of date ({len(out)} differences):')
    print('\n'.join('  ' + d for d in out[:40]))
    sys.exit(1)
print(f'{args[0]}: reproduced (tolerance {TOL})')
