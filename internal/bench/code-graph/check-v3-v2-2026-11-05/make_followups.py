"""Round 2 for missing claims on scored items, and a re-ask for an item one judge skipped.

Both reuse the blind prompt shape: question + candidate path + source lines, nothing else.
"""
import json, os, re, sys

V2 = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(V2, 'out')
sys.path.insert(0, V2)
from build_blind_prompt import probe_lines, snippet, tokens_of  # noqa: E402

import yaml  # noqa: E402

REPO = '/Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/.claude/worktrees/graph-that-wins'
corpus = {q['id']: q for q in yaml.safe_load(open(f'{REPO}/internal/bench/code-graph/corpus-v3-2026-11-05.yaml'))['questions']}
WORK = os.path.join(V2, '..', '..', 'oracle-work')
instr = open(os.path.join(V2, 'judge-instructions.md')).read()


def item_block(iid, files_with_lines):
    q = corpus[iid]
    sd = os.path.join(WORK, q['subject'])
    shown = {k: q[k] for k in ('question', 'probe', 'probe_to', 'declared_in', 'expected') if k in q}
    parts = [f'\n\n========== ITEM {iid} ==========', 'Question (registered, verbatim):\n' + json.dumps(shown, indent=1),
             f'\nCandidate files ({len(files_with_lines)}):']
    for p, lines in files_with_lines:
        lines = sorted(set(lines) | set(probe_lines(sd, p, tokens_of(q))))[:5]
        parts.append(f'\n* {p}')
        parts.extend(snippet(sd, p, n) for n in lines) if lines else parts.append(f'--- {p}: no probe token in the file')
    return parts


# Round 2: the one missing claim on a scored item, shown with the line that implied it.
mw = 'app/Http/Middleware/ThrottleLarasendApiKey.php'
sd = os.path.join(WORK, 'larasend')
mw_lines = [i for i, l in enumerate(open(os.path.join(sd, mw)).read().split('\n'), 1) if re.search(r'function handle', l)][:1]
r2 = [instr, '\nSubject: `larasend` at its registered pin.\n'] + item_block('ls-c-route-03', [(mw, mw_lines), ('routes/api.php', [11])])
open(os.path.join(OUT, 'round2-prompt-ls-human.md'), 'w').write('\n'.join(r2))

# Re-ask: the item the Google judge skipped, with the same candidates the full prompt gave it.
full = open(os.path.join(OUT, 'judge-prompt-uo-human.md')).read()
block = full[full.index('========== ITEM uo-c-model-03'):]
nxt = block.find('========== ITEM', 10)
block = block if nxt < 0 else block[:nxt]
open(os.path.join(OUT, 'reask-prompt-uo-human.md'), 'w').write('\n'.join([instr, '\nSubject: `unopim` at its registered pin.\n', '\n\n' + block]))
print('ok')
