# Impossible-cycles audit — one-time sweep, 2026-07-27

> One-time audit from the road-to-enforcement-peer-disposition roadmap
> (deadlock class from the Source-Q intake: *a gate that requires a state
> another rule forbids reaching*). NOT a recurring lint — per the roadmap,
> recurring machinery only ships if a true cycle is found.

## Definition + method

A gate G and a rule/config R form an **impossible cycle** when G blocks an
action until state S holds, R forbids every path that could produce S, and
no sanctioned escape exists. Sweep method: enumerate every blocking layer —
the shared pre-commit hook chain (`src/scripts/install-hooks.sh` →
`.git/hooks/pre-commit`), the deterministic `block_no_verify` PreToolUse
guard (`src/scripts/hooks/block_no_verify.ts`, which removes the `--no-verify`
escape by design), the pre-push consistency mirror, and the CI required
checks (`rule-backstops.yml` gates + the two ratchets) — and for each ask
whether its required state can be made unreachable by another rule, a
setting, or an environmental precondition. Observed instances from the
operational record (memory + session evidence) were verified against the
current tree.

## Verdict

**No true impossible cycle found.** Every observed instance has a
sanctioned escape path that does not require violating a rule. Four
near-cycles (real friction, observed at least once each) and one
by-construction local-red are documented below so they stay accepted
limitations rather than silent ones.

## Findings

| # | Shape | Gate ↔ constraint | Observed | Escape (sanctioned) | Class |
|---|---|---|---|---|---|
| 1 | Stale/buggy pre-commit gate red on an unrelated commit, while `block_no_verify` forbids `--no-verify` | pre-commit chain ↔ no-bypass guard | yes (stale hook blocked roadmap commits) | patch the gate itself in its own commit — the hook chain does not gate edits to its own source; reinstall via `install-hooks.sh` | near-cycle, self-healing path exists |
| 2 | Fresh-worktree pre-commit false-fail: gate needs `node_modules` (tsx), fresh worktrees don't have it, `--no-verify` blocked | pre-commit chain ↔ worktree bootstrap | yes (twice, incl. 2026-07-27 canary worktree) | provision deps in the worktree (symlink or `npm ci`) — environmental precondition, not a rule conflict | precondition failure |
| 3 | Pre-push consistency mirror counts UNTRACKED roadmaps the pushed commits cannot contain | pre-push regen ↔ untracked working-tree state | yes | track or relocate the untracked file; the gate reads the tree, not the push set — friction accepted, documented | near-cycle |
| 4 | Roadmap PR-gate: archival requires `count_open == 0`, but the archive must ride the closing PR itself | roadmap-progress gate ↔ PR flow | was real | FIXED by design: the deterministic `roadmap:archive` sweep runs before the PR exists (PR-gate); inbound refs rewritten by the sweep | resolved cycle |
| 5 | Local `task ci` cannot go fully green under `tools: []` — the pipeline asserts a deployed-tools state the chosen config forbids | full local pipeline ↔ project config | yes (standing) | ACCEPTED by construction: `quality.local_auto_run: false` suppresses local full-pipeline runs; remote CI (which provisions the state) is the authoritative gate | by-construction local-red, documented |

## Pre-registered null, honored

The pre-registered null for this audit was "no cycles detected as of this
sweep = useful negative result". The result is the stronger variant: **no
unresolvable cycle**, four near-cycles with named escapes, one historical
cycle already engineered away (finding 4). No recurring lint is warranted;
the reopen condition is a FIFTH shape with no sanctioned escape — that
would justify the recurring machinery this audit deliberately does not
build (governance-on-governance).
