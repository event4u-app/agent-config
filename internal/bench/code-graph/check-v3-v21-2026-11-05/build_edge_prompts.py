"""Check v2.1: blind edge-judge prompts. One file per subject, edges deduplicated across
items (the same edge is judged once), listed in hashed order with both ends' source.

usage: build_edge_prompts.py <subject-prefix> <edges.json>... ; writes edge-prompt-<prefix>-<n>.md chunks
"""
import hashlib, json, os, sys

V21 = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(V21, '..', '..', 'oracle-work')
CTX = 2
CHUNK = 160


def snippet(sd, rel, line):
    p = os.path.join(sd, rel)
    if not os.path.isfile(p):
        return f'--- {rel}:{line}: FILE NOT FOUND at the pin'
    lines = open(p, errors='replace').read().split('\n')
    if not 1 <= line <= len(lines):
        return f'--- {rel}:{line}: LINE OUT OF RANGE (file has {len(lines)} lines)'
    lo, hi = max(1, line - CTX), min(len(lines), line + CTX)
    return f'--- {rel}:{lo}-{hi}\n' + '\n'.join(f'{n:>5}  {lines[n - 1][:220]}' for n in range(lo, hi + 1))


def key(e):
    return f"{e['from_file']}:{e['from_line']}->{e['to_file']}:{e['to_line']}"


def main(prefix, files):
    subject = 'larasend' if prefix == 'ls' else 'unopim'
    sd = os.path.join(WORK, subject)
    edges = {}
    for f in files:
        for item in json.load(open(f)):
            for e in item['edges']:
                edges.setdefault(key(e), e)
    ordered = sorted(edges.items(), key=lambda kv: hashlib.sha256(kv[0].encode()).hexdigest())
    ids = {}
    instr = open(os.path.join(V21, 'edge-judge-instructions.md')).read()
    for c in range(0, len(ordered), CHUNK):
        parts = [instr, f'\nSubject: `{subject}` at its registered pin.\n']
        for k, e in ordered[c:c + CHUNK]:
            eid = 'E' + hashlib.sha256(k.encode()).hexdigest()[:10]
            ids[eid] = k
            claim = {'id': eid, 'from': f"{e['from_file']}:{e['from_line']}", 'to_symbol': e['to_symbol'],
                     'to': f"{e['to_file']}:{e['to_line']}", 'kind': e.get('kind')}
            if e.get('note'):
                claim['note'] = e['note']
            parts += [f'\n\n===== EDGE {eid} =====', json.dumps(claim), snippet(sd, e['from_file'], int(e['from_line'])),
                      snippet(sd, e['to_file'], int(e['to_line']))]
        open(os.path.join(V21, f'edge-prompt-{prefix}-{c // CHUNK}.md'), 'w').write('\n'.join(parts))
    json.dump(ids, open(os.path.join(V21, f'edge-ids-{prefix}.json'), 'w'), indent=1)
    print(prefix, len(ordered), 'distinct edges in', (len(ordered) + CHUNK - 1) // CHUNK, 'prompt(s)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2:])
