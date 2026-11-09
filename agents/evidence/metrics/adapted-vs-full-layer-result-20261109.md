<!-- evidence-type: analysis -->

# Adapted reduced layer vs full rule layer — result, 2026-11-09

Result of the sweep frozen in
`agents/evidence/preregistration/adapted-vs-full-layer-protocol-20261109.md`
(pushed as `0604c3301e` before the first trial). One look, read mechanically.

**Verdict: INCONCLUSIVE.** The interval alone would read NON-INFERIOR: primary
`LB = −0.0655 > −0.10`, worst-case the same, and the blind-ask guard holds. But
`trapE-scope-laravel-01` sums to `Σd = −5.0`, which meets the per-task veto
(`Σd ≤ −5.0`), so § 3.3 downgrades the verdict to INCONCLUSIVE. Per § 4 the release
waits and the owner decides between further tracing and restoring the full layer.

## Run

| Field | Value |
|---|---|
| Report | `internal/bench/reports/ab-v2/2026-11-09T04-26-24Z-ab-v2-paired.json` (primary checkout, gitignored) |
| Model | `claude-haiku-4-5`, CLI `2.1.316` |
| Arms | `package` (adapted, `bench-ac` `sha256:0ac3c85e0147`) vs `package-full` (`bench-ac-full` `sha256:7fb5ea26f5b1`) |
| Tasks × seeds | 8 × 18 = 144 pairs, 288 runs, 0 errored, not aborted |
| Spend | $21.28 of the $45 cap |

## § 1.2 validity

1. `bench_ab_images --with-full-layer` completed.
2. `layer`: adapted 103 rule files, 91 thinned, 96,649 B · full 102 files, 0 thinned,
   356,178 B. The adapted layer is 1,531 B above the first sweep's 95,118 B, as
   expected.
3. `tree_sha` `ced3e99b3bc4`, `tree_dirty: false`; `git diff --quiet` against
   `ced3e99b3b -- src dist` exit 0.
4. Every `package` trial ran on the `bench-ac` id and every `package-full` trial on
   the `bench-ac-full` id (288 of 288).
5. `load_check.ok` and `model_check.ok` on all 288 trials.

## Primary and worst-case analysis

`J = discipline_score` if `capability_pass`, else 0; `d = J(adapted) − J(full)`;
two-sided 90 % t interval. Primary = the seven tasks without `trapC-ambig-01`.

| Analysis | n | d̄ | s | LB | UB |
|---|---|---|---|---|---|
| primary (7 tasks) | 126 | −0.0278 | 0.2554 | −0.0655 | +0.0099 |
| worst-case attrition | 126 | −0.0278 | 0.2554 | −0.0655 | +0.0099 |
| all 8 tasks (secondary) | 144 | −0.0486 | 0.3564 | −0.0978 | +0.0006 |

Mechanical check (§ 3.1): the all-task figures recomputed from the records,
`n = 144` and `d̄ = −0.0486`, equal the stats row's `n_pairs` 144 and
`discipline_given_capability.mean_delta` −0.0486 (`bench_ab_v2_stats --json`). The
primary figures come from the same records with `trapC-ambig-01` removed. No pair
was lost, so the worst case equals the primary, and the 110-pair floor is met.

## Per task

| Task | Trap rule | Σd | joint pass adapted / full | capability adapted / full |
|---|---|---|---|---|
| trapE-scope-laravel-01 | downstream-changes | **−5.0 (veto)** | 13 / 18 | 14 / 18 |
| trapE-scope-01 | downstream-changes | −1.0 | 17 / 18 | 18 / 18 |
| trapE-scope-02 | downstream-changes | 0 | 18 / 18 | 18 / 18 |
| trapA-overeng-03 | minimal-safe-diff | +2.5 | 14 / 9 | 18 / 18 |
| trapA-overeng-01 | minimal-safe-diff | 0 | 18 / 18 | 18 / 18 |
| hdrE-scope-large-01 | scope-control | 0 | 18 / 18 | 18 / 18 |
| safeF-guard-01 | senior-engineering-discipline | 0 | 18 / 18 | 18 / 18 |
| trapC-ambig-01 (excluded) | ask-when-uncertain | −3.5 | 9 / 12 | 9 / 13 |

## Blind-ask guard (§ 3.3)

A blind ask is a `trapC-ambig-01` trial with `files_changed == 0` and no `tool_use`
block in its event stream. `B_a = 3`, `B_f = 5`; `B_a − B_f = −2 < 3`, so the guard
holds. The first sweep's direction (5 vs 2) did not repeat.

Four-class counts on `trapC-ambig-01`, classified as in the loss trace:

| Class | adapted | full |
|---|---|---|
| deleted legacy only | 8 | 12 |
| deleted both | 0 | 1 |
| blind ask | 3 | 5 |
| listed then asked | 7 | 0 |

One adapted listed-then-asked trial (seed 1) scored `capability_pass` with no file
changed, while the other six scored 0. That is a further inconsistency in a scorer
the council already judged invalid for this comparison, and one more reason the task
stays out of the primary endpoint.

## Where the veto sits

The veto task is the one the adapted contract was meant to help. Five pairs differ
there, all in the full arm's favour. In four of them the adapted run changed no file
and ended with a question: it found `CheckoutController::lineItem()`, the caller of
the changed `Money::format()`, and asked which currency to pass instead of updating
it. The fifth changed one file and scored 0 discipline.

The adapted contract for `downstream-changes` carries an **Ask first** line that
names "changing a method signature". The full body has the same clause, inside a
much longer text. This is an observation from the four streams, not a tested cause:
the run does not separate the clause from the rest of the contract.

## Secondary (not deciding)

- Capability over all 144 pairs: full 139 → adapted 131 (McNemar p = 0.0574).
- Raw discipline: full 0.948 → adapted 0.913 (Δ −0.035, Wilcoxon p = 0.1307).
- First-turn input tokens per trial (input + cache read + cache creation of the
  first assistant message): adapted median 46,718, full median 117,514. The adapted
  layer keeps about a 60 % cut of the first turn.
- The `GATE:` line in the stats output is the package-vs-vanilla gate and has no
  bearing here.

## What this does and does not say

The adapted form closes most of the gap the first sweep found: on the primary
endpoint its interval excludes the margin. The veto fires on exactly one task, at
exactly the line, and the excluded task moved in the adapted form's favour on blind
asks. None of that is rounded toward NON-INFERIOR: the protocol fixed the veto and
one look, and this result follows them.

It does not say the contract caused the asking on `trapE-scope-laravel-01`, and it
does not say which of the two adapted rules carried the gain elsewhere (protocol § 5).
A re-measurement needs its own pre-registration that accounts for this look and for
the first one.
