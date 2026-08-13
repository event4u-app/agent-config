# Findings: feat-close-gate-reds-blockers
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 4b82a4bee715311aca36281d5490b82b447af9a8690ac73cb74423f0e01efb95 | diff: cfeeacc81c2b09f18d7e5fcfd7a312b05dd0b209 | reviewer: r2-fresh-subagent-feat-close-gate-reds-blockers | prompt_hash: 29efe97366cecb7f7ca4b1f2a08f4e7a415002fcb7b10db3c014090d231ad8f3 -->

<!-- context-manifest: v1
inputs:
  diff_sha: cfeeacc81c2b09f18d7e5fcfd7a312b05dd0b209
  scope_hash: 4b82a4bee715311aca36281d5490b82b447af9a8690ac73cb74423f0e01efb95
  roadmap: agents/roadmaps/archive/road-to-local-only-gate-reds.md
  roadmap_hash: cb09032b2ff9e5a248fa0999993484fa965d33cc327b6ebca404d21fdd97a5be
  ac_hash: 1438494c3dc1452f2504e2f8565d58313c734da2e18642969cdd7be17aaf0863
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T09:08:14Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
**Skipped:** no code surface for this completion — twenty changed files, all records, contracts, workflow wiring and manifest values; `check_completion_review` classifies the diff as 0 code paths of 20, scope 4b82a4bee715311aca36281d5490b82b447af9a8690ac73cb74423f0e01efb95, declared 2026-08-13

## What was attempted, and why this is a skip rather than a clean bill

An independent R2 reviewer WAS dispatched over this scope and did **not** complete: it terminated on an account spend limit after 20 tool calls, having written nothing. No verdict exists and none is claimed here. Per the hard-blocker rule this is surfaced rather than retried — a spend ceiling is not cleared by trying again.

What was done instead is **self-verification, which is not a review** and is labelled as such. Every number this branch commits was re-derived by running the command, not by reading the prose:

- 109 shared rules / 24 `paths:` disagreements — `report_carrier_divergence`.
- All six rules named as carrying an Iron Law do carry one; `roadmap-progress-sync` carries three — grep over the rule headings.
- 3-of-3 release recurrence, 7 marked lines — counted per release head against `git tag --list`.
- `undeclared_local_only` 167 → 166 and the parsed population — read from the gate exit code and its green summary line.

That self-check found a real defect this branch had introduced, recorded here because a skip that hides one is worse than no artefact: wiring `check_gate_coverage` into `consistency.yml` made it CI-reachable while it remained in no local chain, i.e. `undeclared_ci_only` — the mirror image of the defect this roadmap closed, whose own message reads *"a contributor discovers this failure only after pushing"*. It was missed on the first pass because the verification grep was keyed on `CI ↔ local parity`, a line printed only on the green path. Repaired by wiring the gate into the `task ci` chain; parity now exits 0 at 360.

Two committed numbers were stale as a consequence (359 → 360) and one committed claim over-reached (that 443 minus the phantoms explains today's total — it does not, the two totals are not comparable term by term). Both corrected.

**Residual risk, stated rather than resolved:** the floor lowering 380 → 340 and the two additions to the only required status check have had no independent eyes on them. That is the part a reviewer would most usefully have checked.
