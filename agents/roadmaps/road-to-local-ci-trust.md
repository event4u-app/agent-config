---
status: active
complexity: moderate
---

# Road to a Trustworthy Local CI

**Goal.** `task ci` green on `main`, so it can serve as the pre-push gate — and the
CI↔local parity it depends on kept honest by a gate rather than by attention.

**Why.** A pre-push gate that is red for a reason the contributor did not cause either
blocks every push or trains people to ignore it, and the second is worse than no gate.
Getting there turned out to be the prerequisite for everything else in the hardening
request (2026-07-30), not a side quest.

## Phase 1 — task ci green on main

Landed in the `fix/task-ci-green-and-parity` PR: 11 pre-existing failures fixed
(Python-twin gate narrowed to the claim shape, 7 missing trigger-eval sets authored,
demo-shape conformance, a rule-vs-skill composition edge, 3 defaulted frontmatter
fields, an uncited context-spine declaration, 2 unclassified script clusters, 5
untagged contracts + their review markers, a dead catalog link, 2 stale command counts,
a deviating cluster dispatcher, an unstated auto_detect contract, a stale ownership
matrix). Every one was invisible to CI.

- [ ] **Kernel budget — 3 breaches, deferred by policy, not by choice.**
  `task lint-rule-budget` reports `kernel-bucket 27840 > 26000`,
  `non-destructive-by-default 4770 > 4000 override ceiling`, and
  `verify-before-complete 2865 > 2500 hard cap (no override)`. All three are
  pre-existing on `main` — this branch touches no rule under `src/rules/`.
  Fixing them means editing kernel rules, and `scope-control § Kernel-rule edits`
  requires an own PR with ≥ 24 h between merges (the soak guarantee, which no
  autonomous mandate lifts). So it cannot ride along with a gate-hardening PR.
  Verify: `task lint-rule-budget` exits 0.
  <!-- The trim is a preservation-guard problem, not a deletion problem: both rules
  are load-bearing safety floors. Route their bodies to a mechanics context (the P4
  pattern) rather than cutting obligations. -->

## Phase 2 — CI ↔ local parity

Landed in the same PR: `check_ci_local_parity` derives both sides (workflow
invocations vs the transitive `task ci` / `consistency` / pre-push closure) and fails
on undeclared drift in either direction. 10 CI-only repo-content gates wired into a
new `task preflight` (15s measured); 20 declared CI-only with reasons; 1 declared
local-only.

- [ ] **Wire `task preflight` into the pre-push hook.** Deliberately NOT done in the
  same PR: the hook must not go red on the kernel budget above, so this waits for
  Phase 1. Budget ceiling `pre_push_budget_seconds: 25` is already in the manifest;
  `check_enforcement_coverage` (30.7s) stays out by design.
  Verify: a push on a clean tree runs preflight and adds < 25s.

## Phase 3 — Post-CI fix loop

- [ ] **Watch CI after a push, diagnose the failure, prepare the fix — then stop at
  the push.** Bounded at N=3 per target per `autonomous-execution`. The push itself
  stays confirmed: `non-destructive-by-default` makes it a Hard Floor, and no setting
  lifts that, so an auto-push loop is not on the table. Generated-file merge conflicts
  are the exception that needs no confirmation — they are resolved by regenerating,
  which `/create-pr` already specifies.
  Verify: a red CI run produces a diagnosed fix in the working tree and one
  confirmation prompt, never a push.

## Noted, not scheduled

- [~] **`generate-tools` does not prune trees for inactive tools.** 38 dangling links
  had accumulated across `.claude/`, `.cursor/` and `.windsurf/` from sources deleted
  in earlier commits; `_filter_tool_dirs` / `_tool_active` means a deactivated tool's
  tree is never revisited. Cleaning them locally turned `check_bridge_derivation` and
  `check_host_loadability` green. Deferred on purpose: pruning could delete a tree a
  user still relies on, and with the links cleaned nothing is pressing.
- [~] **A tracked file changes on every test run.**
  `internal/reports/secret-scanner-adversarial.json` carries a `generated` date stamp
  its own test rewrites, and `consistency` ends with `git diff --quiet` — so a full
  test run leaves the tree dirty and blocks the next push until reverted. It blocked
  one on 2026-07-30.
- [~] **Five environment-dependent tests read live repo state instead of their
  fixture.** `explain_run` (×2) reads `agents/runtime/state`, `code_graph_refresh`
  escapes its tmp root, `build_mcp_registry_manifest` fails identically on `main` once
  its gitignored prereqs exist, `check_artefact_count_messaging` read a gitignored
  local file (fixed in #1048).
