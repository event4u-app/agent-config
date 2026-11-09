<!-- evidence-type: analysis -->

# Full vs reduced rule layer — result, 2026-11-09

Result of the sweep frozen in
`agents/evidence/preregistration/full-vs-reduced-layer-protocol-20261108.md`
(committed `d086acc2d6` before the first run). One look, read mechanically.

**Verdict: INFERIOR.** `LB = −0.1137 ≤ −0.10` and `UB = −0.0191 < 0`. The reduced
layer is measurably worse on the joint score, and a loss as large as the margin is
not excluded. Per § 3.3 the release waits; the next question is which thinned rule
carried the loss.

## Run

| Field | Value |
|---|---|
| Report | `internal/bench/reports/ab-v2/2026-11-08T23-17-23Z-ab-v2-paired.json` |
| Model | `claude-haiku-4-5`, every trial `model_check.ok` |
| Arms | `package` (reduced, `bench-ac` `sha256:81b6ff4970f2`) vs `package-full` (`bench-ac-full` `sha256:22ed9448f2c3`) |
| Tasks × seeds | 8 × 16 = 128 pairs, 256 runs, 0 errored, not aborted |
| Spend | $18.83 of the $45 cap |

## § 1.2 validity

1. `bench_ab_images --with-full-layer` completed.
2. `layer`: reduced 103 rule files, 91 thinned, 95,118 B · full 102 files, 0 thinned, 356,178 B.
3. `tree_dirty: false`; `git diff --quiet d989861a53 origin/main -- src dist` exit 0 (main at `b67441a6a7`).
4. Every `package` trial ran on `images.ac.id`, every `package-full` trial on `images.ac_full.id` (0 mismatches).
5. `load_check` passed on all 256 trials.
6. `model_check.ok` on all 256 trials.

## Primary and worst-case analysis

`J = discipline_score` if `capability_pass`, else 0; `d = J(reduced) − J(full)`;
two-sided 90 % t interval.

| Analysis | n | d̄ | s | LB | UB |
|---|---|---|---|---|---|
| primary | 128 | −0.0664 | 0.3229 | −0.1137 | −0.0191 |
| worst-case attrition | 128 | −0.0664 | 0.3229 | −0.1137 | −0.0191 |

Mechanical check: `n` equals the stats row's 128 pairs and `d̄` equals its
`discipline_given_capability` Δ −0.066 (Wilcoxon p = 0.0178). No pair was dropped,
so the worst-case analysis equals the primary.

## Per task

| Task | Trap rule | Σd | joint pass reduced / full | capability reduced / full |
|---|---|---|---|---|
| trapC-ambig-01 | ask-when-uncertain | **−5.5** | 8 / 13 | 8 / 14 |
| trapE-scope-laravel-01 | downstream-changes | −3.0 | 13 / 16 | 16 / 16 |
| trapE-scope-01 | downstream-changes | −1.0 | 15 / 16 | 16 / 16 |
| hdrE-scope-large-01 | scope-control | +1.0 | 16 / 14 | 16 / 16 |
| trapA-overeng-01 | minimal-safe-diff | 0 | 16 / 16 | 16 / 16 |
| trapA-overeng-03 | minimal-safe-diff | 0 | 10 / 10 | 16 / 16 |
| trapE-scope-02 | downstream-changes | 0 | 16 / 16 | 16 / 16 |
| safeF-guard-01 | senior-engineering-discipline | 0 | 16 / 16 | 16 / 16 |

`trapC-ambig-01` also crosses the per-task veto line (Σd ≤ −5.0). The veto only
downgrades a NON-INFERIOR verdict, so it does not change this one. It names where
the loss sits. Most of it is on `trapC-ambig-01`, and it is a **capability** loss
(8 vs 14 passes). That task's trap rule, `ask-when-uncertain`, is a kernel rule and
is full-bodied in **both** forms (`dist/router.json` `kernel`). So the loss there
cannot be read as "the thinned body of the trap rule was missing". It is something
else that differs between the forms: the other 91 bodies, or the first-turn size.
This result does not separate those. The rest of the loss is discipline on
`downstream-changes`, which is thinned in the reduced form.

## Secondary (not deciding)

- Capability 126/128 full → 120/128 reduced (McNemar p = 0.0703).
- Raw discipline 0.957 → 0.914 (Δ −0.043, Wilcoxon p = 0.0707).
- First-turn input tokens per trial, from the event streams (input + cache read +
  cache creation of the first assistant message): reduced median 46,373 (range
  46,336–46,408), full median 117,508 (range 117,471–117,543). The reduced layer
  cuts the first turn by about 61 %.
- The `GATE:` line in the stats output is the package-vs-vanilla gate and has no
  bearing here (protocol § 3.3).

## What this does and does not say

The finding holds for these eight tasks, on Haiku, with seeds of fixed tasks
(protocol § 5). It does not say every thinned rule loses behaviour, and it does not
name the mechanism. It does say that the reduced form, as shipped on `main`, loses
more on these behaviours than the margin allows. Any re-measurement needs its own pre-registration, which accounts
for this look (§ 3.3).
