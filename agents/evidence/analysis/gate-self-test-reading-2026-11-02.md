<!-- evidence-type: analysis -->

# Gate self-test and argv reading — 2026-11-02

Measured for `road-to-checks-that-name-their-catch` (steps 0.3, 1.2, 2.1, 3.2)
at `9a6bf98a05` plus that roadmap's working tree. Every number below names the
command that reproduces it.

## 1. Self-tests — what ran, and what was green for the wrong reason

```bash
./scripts-run src/scripts/run_gate_self_tests
```

| Reading | Count |
|---|---|
| `src/scripts/*.ts` calling `runSelfTest`, discovered | 114 (+1 added by this roadmap: `check_gate_contracts`) |
| Red on a fresh worktree before this roadmap | 3 — `check_review_schema`, `check_beta_review_markers`, `check_host_loadability` |
| Green only because a crash counted as a catch | 7 gates |
| Wall time, all self-tests, 17 parallel jobs (local) | 18–20 s |

The 7 crash-greens surfaced once the harness stopped reading an uncaught
exception as a reject (step 1.2):

- `check_claims` — the self-test fixture copied six of the gate's seven `_lib`
  imports; **every case** died on `Cannot find module './_lib/claims_site_sweep.js'`.
  Its 7 reject cases were green, its 5 accept cases red, and the self-test
  reported 7/12 rather than "never ran".
- `check_argument_hint`, `check_depth_budget`, `check_input_references`,
  `check_inputs_parity`, `check_source_size_budget`, `lint_deny_text` — the
  dead-scope / empty-corpus case threw `DeadScopeError` uncaught. Now caught by
  `exitOnDeadScope` (`_lib/dead_scope_exit.ts`) and asserted as a `refuse` (exit 2).

## 2. Unknown flags

```bash
./scripts-run src/scripts/check_gate_contracts --all
```

Every `check_*`/`lint_*` gate (348) run with `--definitely-not-a-flag`, 60 s cap:

| Exit | Gates |
|---|---|
| 0 (flag silently ignored) | 186 |
| 2 | 131 |
| 1 | 29 |
| 3 | 1 |
| timeout | 1 |

The 186 are listed in `src/config/gate-argv-permissive.json`, shrink-only. The
source plan measured 175 on 2026-10-21: the population grew by 11 in twelve days
while nothing counted it.

## 3. Self-test cases that read the live tree

Not linted (decision E9 in the roadmap — the pattern has more legitimate than
illegitimate hits). Named here so a CI-only red is traceable:

- `check_generator_sync` — "the shipped registry against this tree → accept".
  It went red in this very change when a roadmap was added before the owned-digest
  was regenerated.
- `lint_adapter_tier` — "the real tree is green, and its contract block matches".
