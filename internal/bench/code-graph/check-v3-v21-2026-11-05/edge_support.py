"""Distinct edges by final judge support (after the context round)."""
import glob, json, os, sys
from collections import Counter

D = sys.argv[1]


def parse(t):
    return json.loads(t[t.index('{'):t.rindex('}') + 1])


for prefix in ('ls', 'uo'):
    ids = json.load(open(os.path.join(D, f'edge-ids-{prefix}.json')))
    v = {}
    for f in sorted(glob.glob(os.path.join(D, f'edge-rulings-{prefix}-*.json'))):
        for r in json.load(open(f))['responses']:
            for x in parse(r['text'])['edges']:
                v.setdefault(r['provider'], {})[x['id']] = x['verdict']
    for prov in ('openai', 'google'):
        p = os.path.join(D, f'context-rulings-{prefix}.{prov}.txt')
        if os.path.exists(p):
            for x in parse(open(p).read())['edges']:
                if v[prov].get(x['id']) == 'UNSURE':
                    v[prov][x['id']] = x['verdict']
    c = Counter()
    for eid in ids:
        a, b = v['openai'].get(eid, 'NONE'), v['google'].get(eid, 'NONE')
        n = (a == 'VALID') + (b == 'VALID')
        c['both VALID' if n == 2 else 'one VALID' if n == 1 else 'none VALID'] += 1
        if 'INVALID' in (a, b):
            c['any INVALID'] += 1
        if n == 1:
            c[f"only {'openai' if a == 'VALID' else 'google'} VALID"] += 1
    print(prefix, len(ids), dict(c))
