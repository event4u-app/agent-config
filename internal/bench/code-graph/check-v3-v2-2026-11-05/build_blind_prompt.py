"""Check v2: one blind judge prompt per group (registration § Check v2).

Judges see the question and, per candidate, path + source lines only. No provenance,
no reader notes, no oracle status. Calibration items (oracle-complete, outside the
sample) are mixed in unmarked, with decoys: files carrying the probe token that are
not oracle references.

usage: build_blind_prompt.py <group> <v1-dir> <truth.yaml> <corpus.yaml> <work-dir> <out-dir>
"""
import hashlib, json, os, re, subprocess, sys

import yaml

CTX = 3
SKIP = re.compile(r'(^|/)(vendor|node_modules|lang|storage|build|dist)/')


def snippet(sd, rel, line):
    p = os.path.join(sd, rel)
    if not os.path.isfile(p):
        return f'--- {rel}:{line}: FILE NOT FOUND at the pin'
    lines = open(p, errors='replace').read().split('\n')
    lo, hi = max(1, line - CTX), min(len(lines), line + CTX)
    return f'--- {rel}:{lo}-{hi}\n' + '\n'.join(f'{n:>5}  {lines[n - 1][:220]}' for n in range(lo, hi + 1))


def tokens_of(q):
    toks = []
    for k in ('probe', 'probe_to'):
        v = q.get(k)
        if isinstance(v, str):
            toks += [w for w in re.split(r'[\s:\\/]+', v) if len(w) > 3 and not w.isupper()]
    return toks


def probe_lines(sd, rel, toks, limit=3):
    p = os.path.join(sd, rel)
    if not os.path.isfile(p):
        return []
    out = []
    for i, l in enumerate(open(p, errors='replace').read().split('\n'), 1):
        if any(re.search(rf'\b{re.escape(t)}\b', l) for t in toks):
            out.append(i)
            if len(out) >= limit:
                break
    return out


def cited(refs, rel):
    lines = []
    for r in refs:
        m = re.match(r'^(.+?):(\d+)', r.strip())
        if m and m.group(1) == rel:
            lines.append(int(m.group(2)))
    return lines


def decoys(sd, q, gold, declared, limit=3):
    toks = tokens_of(q)
    if not toks:
        return []
    r = subprocess.run(['grep', '-rlw', '--include=*.php', '--include=*.ts', '--include=*.js', '--include=*.vue', toks[0], '.'],
                       cwd=sd, capture_output=True, text=True)
    hits = sorted(p[2:] for p in r.stdout.split('\n') if p.startswith('./'))
    hits = [p for p in hits if not SKIP.search(p) and p not in gold and p != declared]
    hits.sort(key=lambda p: hashlib.sha256(f'{q["id"]}:{p}'.encode()).hexdigest())
    return hits[:limit]


def main(group, v1, truth_path, corpus_path, work, out):
    truth = yaml.safe_load(open(truth_path))
    corpus = {q['id']: q for q in yaml.safe_load(open(corpus_path))['questions']}
    items = {i['id']: i for i in truth['items']}
    sample = set(truth['human_check']['sample'])
    subject = 'larasend' if group.startswith('ls') else 'unopim'
    sd = os.path.join(work, subject)
    answers = {a['id']: a for a in json.load(open(os.path.join(v1, f'answers-{group}.json')))}
    packet = json.load(open(os.path.join(v1, f'packet-{group}.json')))

    entries = []  # (id, {path: [lines]})
    calibration = {}
    for it in packet:
        iid, q, a = it['id'], it['question'], answers[it['id']]
        refs = [r for f in a.get('answer_files', []) for r in f.get('evidence', [])]
        cand = {f['path'] for f in a.get('answer_files', [])} | set(items[iid].get('oracle_files', items[iid].get('files')) or [])
        cand |= {f['path'] for f in a.get('excluded', [])}
        entries.append((iid, q, cand, refs))
    # Calibration items of this subject, only into the 'partial' group (one place each).
    if group.endswith('partial'):
        for iid, it in items.items():
            if it['status'] == 'oracle' and iid not in sample and iid.startswith(group[:2]):
                q = corpus[iid]
                gold = set(it['files'])
                dec = decoys(sd, q, gold, (q.get('declared_in') or '').split(':')[0])
                calibration[iid] = {'gold': sorted(gold), 'decoys': dec}
                entries.append((iid, q, gold | set(dec), []))
    entries.sort(key=lambda e: hashlib.sha256(e[0].encode()).hexdigest())

    parts = [open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'judge-instructions.md')).read(),
             f'\nSubject: `{subject}` at its registered pin.\n']
    for iid, q, cand, refs in entries:
        parts.append(f'\n\n========== ITEM {iid} ==========')
        shown = {k: q[k] for k in ('question', 'probe', 'probe_to', 'declared_in', 'expected') if k in q}
        parts.append('Question (registered, verbatim):\n' + json.dumps(shown, indent=1))
        ordered = sorted(cand, key=lambda p: hashlib.sha256(f'{iid}:{p}'.encode()).hexdigest())
        parts.append(f'\nCandidate files ({len(ordered)}):')
        for p in ordered:
            lines = sorted(set(cited(refs, p)) | set(probe_lines(sd, p, tokens_of(q))))[:5]
            parts.append(f'\n* {p}')
            parts.extend(snippet(sd, p, n) for n in lines) if lines else parts.append(f'--- {p}: no probe token in the file')
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, f'judge-prompt-{group}.md'), 'w').write('\n'.join(parts))
    if calibration:
        cal_path = os.path.join(out, 'calibration.json')
        prev = json.load(open(cal_path)) if os.path.exists(cal_path) else {}
        prev.update(calibration)
        json.dump(prev, open(cal_path, 'w'), indent=1)
    print(group, len(entries), 'items', len(calibration), 'calibration', sum(len(x) for x in parts), 'chars')


if __name__ == '__main__':
    main(*sys.argv[1:7])
