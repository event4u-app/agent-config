---
complexity: lightweight
review_by: 2026-12-13
---

# Stub: road to three gates the canary could not kill

> **Stub — not active work.** Opened as the disposition for a red check that
> appeared in front of `drain/local-gates-wired-20261013` and is not that
> change's to fix. A line in a pull-request body is not a disposition, which
> is why this file exists rather than a sentence there.

## What was observed, and how

`gate-canary.yml` runs on `schedule` (05:00 UTC on the 1st) and
`workflow_dispatch`, and **its monthly cron had never fired** — the only runs
in its history are the two manual dispatches that drain made on 2026-10-13 to
test a job it was adding to the same file. So the first time the canary ever
ran, it reported this:

```
❌ check_beta_review_markers:       stayed GREEN over a planted defect
❌ check_prefix_stable_mutation:    stayed GREEN over a planted defect
❌ check_loss_class_declared:       stayed GREEN over a planted defect
❌ check_no_currency_in_cost_surfaces: stayed GREEN over a planted defect
❌ DISAGREEMENT [dead_gate] check_beta_review_markers: census records 170
   unit(s) read, but the canary could not make it fail
```

`check_gate_coverage --canary` plants one declared violation per gate, runs
the gate, records red/green and deletes the plant in a `finally`. A gate that
stays green over its own planted violation is dead by that definition — it
reads a corpus and cannot go red, so whatever it is registered to enforce is
enforced by nothing.

**Not caused by the change that found it**, and that is checkable rather than
asserted: its diff removes zero lines from `gate-canary.yml` (purely additive,
a second job), touches `src/config/gate-coverage.yml` not at all, and contains
none of the four gate scripts.

## Why three and not four

`check_beta_review_markers` already has live owners — four stub roadmaps name
it. The other three have **no live file naming them at all**, which is the
same unowned-red shape `road-to-local-gates-wired-while-they-are-green` Phase 3
was written for, arriving on a different surface:

- `check_prefix_stable_mutation`
- `check_loss_class_declared`
- `check_no_currency_in_cost_surfaces`

## Promotion gates (all required)

1. **Reproduce per gate, locally.** Run `check_gate_coverage --canary` scoped
   to one gate and read its recipe in `src/config/gate-coverage.yml`. A
   plant the gate's scan root never opens is a defect in the RECIPE, not in
   the gate, and the two repairs are different — do not start editing a gate
   before that question is answered.
2. **Decide per gate, not as a batch.** Each outcome is one of: fix the gate
   so the plant reds it · fix the recipe so it plants where the gate looks ·
   or record the gate as reporting-only and remove its `enforced` claim. The
   third is a real answer and must not be reached for first.
3. **One change per gate**, each with the canary run that proves it now reds.

## What this stub deliberately does not claim

That the four are dead *on the trunk*. The canary has one observation, on a
branch, from a manual dispatch; no scheduled run exists to compare against.
The finding is "the first run of this canary reported four", and the first
promotion gate is where that becomes a per-gate verdict.

## Seed content on promotion

- No new gate and no new script. The repair surface is the existing gates and
  their `gate-coverage.yml` recipes.
- The canary's own ledger is the evidence artefact; it is uploaded as a run
  artifact already and needs no new writer.
