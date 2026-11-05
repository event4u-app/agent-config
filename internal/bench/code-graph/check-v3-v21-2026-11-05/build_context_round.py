"""Check v2.1 context round: every edge a judge ruled UNSURE goes back to THAT judge with
the context UNSURE replies ask for — the from-file's import/use lines, the declaration of
the receiver it calls through, and route-group prefix / registration lines — still blind.

usage: build_context_round.py <prefix>   (reads edge-ids-<prefix>.json, edge-rulings-<prefix>-*.json, edges-*.json)
writes context-prompt-<prefix>.<provider>.md and context-ids-<prefix>.json
"""
import glob, hashlib, json, os, re, sys

V21 = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(V21, '..', '..', 'oracle-work')
sys.path.insert(0, V21)
from build_edge_prompts import snippet  # noqa: E402


def lines_of(sd, rel):
    p = os.path.join(sd, rel)
    return open(p, errors='replace').read().split('\n') if os.path.isfile(p) else []


def pick(lines, pred, limit):
    out = [i for i, l in enumerate(lines, 1) if pred(l)]
    return out[:limit]


def context(sd, e):
    frm = lines_of(sd, e['from_file'])
    blocks = []
    imports = pick(frm, lambda l: re.match(r'\s*(use |import |require|namespace )', l) is not None, 25)
    if imports:
        blocks.append(f"--- {e['from_file']} (imports)\n" + '\n'.join(f'{n:>5}  {frm[n - 1][:200]}' for n in imports))
    src = frm[int(e['from_line']) - 1] if 0 < int(e['from_line']) <= len(frm) else ''
    recv = re.findall(r'\$this->(\w+)->|\$(\w+)->\w+\(|(\w+)\.\w+\(', src)
    names = {x for t in recv for x in t if x and x != 'this'}
    for name in sorted(names)[:2]:
        decl = pick(frm, lambda l, n=name: re.search(rf'(\${n}\b|\b{n}\b)', l) is not None and re.search(r'(function|private|protected|public|readonly|const |let |import|=)', l) is not None, 4)
        if decl:
            blocks.append(f"--- {e['from_file']} (declarations of {name})\n" + '\n'.join(f'{n:>5}  {frm[n - 1][:200]}' for n in decl))
    if e.get('kind') == 'route' or re.search(r'routes/', e['from_file'] + e['to_file']):
        for rel in sorted({e['from_file'], e['to_file'], 'bootstrap/app.php'}):
            ls_ = lines_of(sd, rel)
            hit = pick(ls_, lambda l: re.search(r"(prefix\(|->group\(|Route::(middleware|prefix|group|name)|api:|web:|withRouting|->name\('\w+\.?'\))", l) is not None, 12)
            if hit:
                blocks.append(f'--- {rel} (route groups / registration)\n' + '\n'.join(f'{n:>5}  {ls_[n - 1][:200]}' for n in hit))
    return blocks


def main(prefix):
    subject = 'larasend' if prefix == 'ls' else 'unopim'
    sd = os.path.join(WORK, subject)
    ids = json.load(open(os.path.join(V21, f'edge-ids-{prefix}.json')))
    edges = {}
    for f in glob.glob(os.path.join(V21, 'edges-*.json')):
        if not os.path.basename(f).startswith(f'edges-{prefix}'):
            continue
        for it in json.load(open(f)):
            for e in it['edges']:
                edges.setdefault(f"{e['from_file']}:{e['from_line']}->{e['to_file']}:{e['to_line']}", e)
    unsure = {}
    for f in sorted(glob.glob(os.path.join(V21, f'edge-rulings-{prefix}-*.json'))):
        if '.' in os.path.basename(f)[:-5]:
            continue
        for r in json.load(open(f))['responses']:
            t = r['text']
            for x in json.loads(t[t.index('{'):t.rindex('}') + 1])['edges']:
                if x['verdict'] == 'UNSURE' and x['id'] in ids:
                    unsure.setdefault(r['provider'], []).append(x['id'])
    instr = open(os.path.join(V21, 'edge-judge-instructions.md')).read()
    for prov, eids in unsure.items():
        parts = [instr, '\nThese edges come back with more context: the source file\'s imports, the declarations of the receiver the call goes through, and route registration / group prefixes where routes are involved.\n',
                 f'\nSubject: `{subject}` at its registered pin.\n']
        for eid in sorted(eids, key=lambda i: hashlib.sha256(i.encode()).hexdigest()):
            e = edges[ids[eid]]
            claim = {'id': eid, 'from': f"{e['from_file']}:{e['from_line']}", 'to_symbol': e['to_symbol'], 'to': f"{e['to_file']}:{e['to_line']}", 'kind': e.get('kind')}
            if e.get('note'):
                claim['note'] = e['note']
            parts += [f'\n\n===== EDGE {eid} =====', json.dumps(claim), snippet(sd, e['from_file'], int(e['from_line'])),
                      snippet(sd, e['to_file'], int(e['to_line']))] + context(sd, e)
        open(os.path.join(V21, f'context-prompt-{prefix}.{prov}.md'), 'w').write('\n'.join(parts))
        print(prefix, prov, len(eids), 'UNSURE edges')


if __name__ == '__main__':
    main(sys.argv[1])
