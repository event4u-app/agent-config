---
adr: 223
status: proposed
date: 2026-08-11
decision: no-required-check-demotion-on-cost-grounds
supersedes: —
superseded_by: —
phase: road-to-inbox-harvest-2026-08-b
type: structural
review_trigger: >-
  Revisit when either (a) a per-OS failure attribution exists — at least 20
  recorded PR runs in which a macOS leg went red while its ubuntu twin stayed
  green, or 20 in which neither did — because the demotion question is a
  coverage question and no such record exists today, or (b) the required-status
  check list stops being a single entry, at which point "demotion" becomes a
  real lever rather than a description of an empty set. Nothing here expires on
  a date: a check set is either earning its cost or it is not, and both triggers
  are observable events rather than a calendar.
---

# ADR-223 — No required-check demotion on cost grounds; the cost is one vitest shard

## Status

**Proposed** · 2026-08-11. Records a decision *not* to change the required set,
with the measurement that decided it. Acceptance is the maintainer's call. This
record changes no enforcement by itself — it neither edits ruleset `17749383`
nor any workflow.

## Context

A CI-economy pass re-measured every PR-blocking job from GitHub Actions job
data (three most recent successful `tests.yml` runs on `main`, per-job
durations from `/actions/runs/<id>/jobs`) and wrote the result into
[`ci-cost-budget.md`](../contracts/ci-cost-budget.md). It planned to follow
that measurement with a required-check demotion — specifically "the macOS leg
and/or the `npm audit` PR gate" — and to record the demotion here.

Four facts from that measurement decide the question, and three of them were
not visible before it:

1. **The required set has exactly one member.** Ruleset `17749383` requires
   `Sync + Generate Tools Consistency` and nothing else
   ([`branch-protection-policy.md:59`](../contracts/branch-protection-policy.md)).
   Neither the macOS legs nor the `npm audit` gate is in it. There is no
   demotion to perform: they are already not required, and removing them from
   a PR would be a **trigger** change, not a required-check change.

2. **The same policy document recommends the opposite direction.**
   `branch-protection-policy.md:163` carries a "recommended minimum addition"
   list of checks that already run and pass on every feature PR. The standing
   proposal is to *enlarge* the required set, not shrink it.

3. **The cost is not spread across the check set — it is one shard.** Of 23
   matrix-expanded jobs, most run 45–170 s. Two do not: `node-tests` shard 3/4
   at 645 s (ubuntu) and 852 s (macOS), against 125–152 s for its sibling
   shards. In the slowest job, `Vitest (shard 3/4)` alone is 594 s of a 673 s
   job; everything else — checkout, setup-node, `npm ci`, the build — totals
   ~26 s. vitest shards by file *count*, not duration, so the
   subprocess-spawning suites hash-clump into one shard. Demoting the macOS
   leg would remove the 852 s job and leave the 645 s one, i.e. it would hide
   the outlier rather than fix it.

4. **The `npm audit` PR gate costs almost nothing and is already duplicated.**
   It is a step inside `static-checks` (`tests.yml:340`), a 131 s ubuntu-only
   job that is comfortably under the 5-minute ceiling, and the identical
   `npm audit --omit=dev --audit-level=high` runs again in
   `release-validation.yml:370`. Demoting it saves seconds and removes a
   pre-merge signal whose only remaining instance fires at release time, when
   the fix is more expensive.

What the measurement does **not** contain is the thing a demotion decision
actually needs: whether the macOS legs ever catch a regression the ubuntu legs
miss. That is a coverage question, and nothing in the tree records per-OS
failure attribution. The last 30 `tests.yml` runs on `main` are 20 success and
10 cancelled with zero failures, which is expected for a post-merge branch and
is therefore evidence of nothing either way.

## Decision

**No required-check demotion is proposed, and the required set stays at one
entry.** Concretely:

- The macOS legs stay on PRs. The cost case against them is really a case
  against one over-budget shard, and the coverage case for them is unmeasured.
- The `npm audit` PR gate stays. Its cost is inside the noise band and its
  removal would relocate a pre-merge signal to release time.
- Relief for the measured ceiling breach is sought in the shard clump —
  reducing the number of subprocess-spawning test files, so the clump
  re-balances — not in the check set. Re-sharding alone only moves the clump to
  a different shard number.

## Consequences

- The over-ceiling entry in `ci-cost-budget.md` stays open and named
  (`node-tests` shard 3/4). The contract's per-job ceiling continues to flag
  it every quarterly review until the clump is addressed, which is the correct
  behaviour for an unresolved cost.
- No ruleset write happens, so `branch-protection-policy.md`,
  `ci-green-floor.md` and `release-pr-gating.md` need no coordinated edit —
  the three-document change those files describe is not triggered.
- A future demotion proposal now has a stated evidence bar rather than a cost
  argument: per-OS failure attribution, named in `review_trigger` above.

## Alternatives considered

**Demote the macOS legs.** Rejected: it removes the single most expensive job
(852 s) and would look like a large saving, but the ubuntu twin of the same
shard is still 645 s and still over the ceiling, so the breach survives the
change. It also spends unmeasured cross-platform coverage to buy it — this
package ships an installer whose path handling differs by OS, which is exactly
where a macOS-only regression would live.

**Demote the `npm audit` PR gate.** Rejected on the numbers: it is a step in a
131 s job, and the same command already runs at release. The saving is inside
runner variance.

**Enlarge the required set instead**, per `branch-protection-policy.md:163`.
Not rejected — out of scope here. It is a maintainer ruleset action and a
different decision from the one this record was asked to make; nothing in the
measurement argues against it.

**Re-shard `node-tests` from 4 to N shards.** Rejected as a standalone fix:
with count-based sharding the spawning cluster lands in *some* shard whatever N
is. It becomes viable once the number of spawning files is reduced, and is
recorded there rather than here.

## References

- [`docs/contracts/ci-cost-budget.md`](../contracts/ci-cost-budget.md) — the
  re-measured baseline, the 5-minute ceiling, and the current breach.
- [`docs/contracts/branch-protection-policy.md`](../contracts/branch-protection-policy.md)
  — the one-entry required set (`:59`), the reported check names (`:56`), and
  the ruleset write path (`:158`).
- `.github/workflows/tests.yml` — `node-tests` shard matrix (`:198`),
  `static-checks` (`:244`), the `npm audit` step (`:340`).
- `.github/workflows/release-validation.yml:370` — the duplicate audit run.
