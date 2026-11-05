"""Check v2.1: per-subject packets for the edge readers (the 14 closure items)."""
import json, os, sys

import yaml

REPO = '/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/.claude/worktrees/graph-that-wins'
B = f'{REPO}/internal/bench/code-graph'
OUT = os.path.dirname(os.path.abspath(__file__))
CLOSURE = {'ls-b-05', 'ls-b-06', 'uo-b-02', 'ls-c-tests-01', 'ls-c-tests-02', 'uo-c-tests-01', 'uo-c-tests-02', 'uo-c-tests-03',
           'ls-e-01', 'ls-e-02', 'ls-e-03', 'uo-e-01', 'uo-e-02', 'uo-e-03'}

corpus = {q['id']: q for q in yaml.safe_load(open(f'{B}/corpus-v3-2026-11-05.yaml'))['questions']}
truth = {i['id']: i for i in yaml.safe_load(open(f'{B}/truth-v3-2026-11-05.yaml'))['items']}
answers = {}
for g in ('ls-partial', 'uo-partial'):
    for a in json.load(open(f'{B}/check-v3-2026-11-05/answers-{g}.json')):
        answers[a['id']] = a
for subj in ('ls', 'uo'):
    packet = []
    for iid in sorted(i for i in CLOSURE if i.startswith(subj)):
        q, a, t = corpus[iid], answers[iid], truth[iid]
        pool = {f['path'] for f in a['answer_files']} | set(t.get('oracle_files', t['files'])) | {f['path'] for f in a.get('excluded', [])}
        packet.append({'id': iid, 'question': {k: q[k] for k in ('question', 'class', 'shape', 'probe', 'probe_to', 'declared_in') if k in q},
                       'candidate_files': sorted(pool)})
    json.dump(packet, open(f'{OUT}/edge-packet-{subj}.json', 'w'), indent=1)
    print(subj, len(packet), sum(len(p['candidate_files']) for p in packet), 'candidates')
