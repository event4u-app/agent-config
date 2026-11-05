"""Build one council prompt per group: question, candidate files, and source lines
extracted from the subject checkout (not the reader's paraphrase)."""
import json, os, re, sys

TC = os.path.dirname(os.path.abspath(__file__))
WORK = os.path.join(os.path.dirname(TC), 'oracle-work')
CTX = 3


def snippet(subject_dir, ref):
    m = re.match(r'^(.+?):(\d+)(?:[-,]\d+)*$', ref.strip())
    if not m:
        return None
    rel, line = m.group(1), int(m.group(2))
    p = os.path.join(subject_dir, rel)
    if not os.path.isfile(p):
        return f'--- {ref}: FILE NOT FOUND at the pin'
    lines = open(p, errors='replace').read().split('\n')
    lo, hi = max(1, line - CTX), min(len(lines), line + CTX)
    body = '\n'.join(f'{n:>5}  {lines[n - 1][:220]}' for n in range(lo, hi + 1))
    return f'--- {rel}:{lo}-{hi}\n{body}'


def probe_hits(subject_dir, rel, tokens, limit=3):
    p = os.path.join(subject_dir, rel)
    if not os.path.isfile(p):
        return [f'--- {rel}: FILE NOT FOUND at the pin']
    lines = open(p, errors='replace').read().split('\n')
    out = []
    for i, l in enumerate(lines, 1):
        if any(t and t in l for t in tokens):
            out.append(snippet(subject_dir, f'{rel}:{i}'))
            if len(out) >= limit:
                break
    return out or [f'--- {rel}: none of {tokens} appears in the file']


def tokens_of(q):
    toks = []
    for k in ('probe', 'probe_to'):
        v = q.get(k)
        if isinstance(v, str):
            toks += [w for w in re.split(r'[\s:\\/]+', v) if len(w) > 3 and not w.isupper()]
    return toks


def main(group):
    packet = json.load(open(os.path.join(TC, f'{group}.json')))
    answers = {a['id']: a for a in json.load(open(os.path.join(TC, f'answers-{group}.json')))}
    subject = 'larasend' if group.startswith('ls') else 'unopim'
    sd = os.path.join(WORK, subject)
    parts = [open(os.path.join(TC, 'judge-instructions.md')).read(), f'\nSubject: `{subject}` at its registered pin.\n']
    for it in packet:
        q, a = it['question'], answers.get(it['id'])
        parts.append(f"\n\n========== ITEM {it['id']} ==========")
        parts.append('Question (registered, verbatim):\n' + json.dumps({k: q[k] for k in q if k not in ('truth',)}, indent=1, default=str))
        parts.append(f"\nReference engine (oracle) status: {it['oracle']['status']}; its open list: {json.dumps(it['oracle'].get('open', []))}")
        if a is None:
            parts.append('\nNo reader answer for this item.')
            continue
        cand = {}
        for f in a.get('answer_files', []):
            cand.setdefault(f['path'], {'proposed_by_reader': True, 'reader_reason': f.get('reason'), 'refs': f.get('evidence', [])})
        for f in it['oracle'].get('files') or []:
            cand.setdefault(f, {'proposed_by_reader': False, 'refs': []})['listed_by_oracle'] = True
        for f in a.get('oracle_files', []):
            if f['path'] in cand:
                cand[f['path']]['reader_on_oracle_file'] = f'{f["verdict"]}: {f.get("reason")}'
        for f in a.get('excluded', []):
            cand.setdefault(f['path'], {'proposed_by_reader': False, 'refs': []})['reader_excluded_because'] = f.get('reason')
        parts.append(f"\nReader notes: answerable_as_registered={a.get('answerable_as_registered')}; {a.get('notes', '')}")
        if a.get('open_followed'):
            parts.append(f"Reader on the oracle's open list: {a['open_followed']}")
        parts.append(f'\nCandidate files ({len(cand)}):')
        for path, c in cand.items():
            meta = {k: v for k, v in c.items() if k != 'refs'}
            parts.append(f'\n* {path}  {json.dumps(meta)}')
            snips = [s for s in (snippet(sd, r) for r in c['refs'][:3]) if s]
            if not snips:
                snips = probe_hits(sd, path, tokens_of(q))
            parts.extend(snips)
    out = os.path.join(TC, f'judge-{group}.md')
    open(out, 'w').write('\n'.join(parts))
    print(out, sum(len(p) for p in parts), 'chars')


if __name__ == '__main__':
    main(sys.argv[1])
