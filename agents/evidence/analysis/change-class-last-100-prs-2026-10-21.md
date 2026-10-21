<!-- evidence-type: analysis -->

# Change class of the last 100 merged PRs

Measured 2026-10-21 against `origin/main`, for step 0.3 of
`road-to-a-step-that-costs-what-it-changes`. The classifier is
`src/scripts/classify_change_risk.ts`, unchanged; each PR is its squash commit
on the first-parent line, PRs #2444 to #2552.

## Result

| class | PRs | binding reason |
|---|---|---|
| R0 | 24 | every touched path is non-behavioural |
| R1 | 5 | test-only change |
| R2 | 35 | production code touched (34), unrecognised path shape (1) |
| R3 | 36 | override-list path |

Rows sum to 100. **R3 rate 0.36**, under the classifier's own 0.40 defect line;
the nightly drift readings had stood at 0.477 (30 days) and 0.536 (14 days).
R0 and R1 together are 29 of 100 — the share a depth table can lower.

What binds R3, by the first override-list path hit:

| path | PRs |
|---|---|
| `src/config/gate-violation-baselines.json` | 8 |
| `src/scripts/hooks/` | 5 |
| `src/config/routing-coverage-seed.json` | 5 |
| `src/config/agent-settings.template.yml` | 3 |
| `src/config/skill-body-budget.json` | 3 |
| one PR each: five other `src/config/*.json`, three workflows, `hooks/hooks.json`, `tests/scripts/hooks/`, `tests/fixtures/procedure-cursor-eval/`, `agents/roadmaps/later/` | 11 |

A ratchet baseline file is the largest single R3 driver: a PR that lowers or
raises one number in `gate-violation-baselines.json` is R3 by the override
list, whatever else it changes. That is by design (a ratchet move is a
governance move), and it is the first thing to look at if the R3 share rises
past the line.

## Reproduce

From the repository root, `npx tsx classify_last_100.mts`:

```ts
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const root = process.cwd();
const { classifyPaths, changedPaths } = await import(path.join(root, 'src/scripts/classify_change_risk.ts'));
const log = spawnSync('git', ['log', '--first-parent', '--format=%H %s', '-n', '400', 'origin/main'], { encoding: 'utf8' }).stdout;
const prs = log
    .split('\n')
    .map((l) => /^(\w+) .*\(#(\d+)\)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .slice(0, 100);
const tally: Record<string, number> = { R0: 0, R1: 0, R2: 0, R3: 0 };
for (const m of prs) tally[classifyPaths(changedPaths(`${m[1]}^..${m[1]}`, root)).cls] += 1;
console.log(JSON.stringify(tally));
```

The window moves with `origin/main`; this reading is pinned by its PR range.
