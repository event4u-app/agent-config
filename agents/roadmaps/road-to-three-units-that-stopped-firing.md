---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-routing-assurance-live-floors
    relation: extends
    note: "Archived parent. Its 5.3 canary (2026-11-03) found three units that fire on their baseline prompt 0 of 3 times; this file carries them rather than leaving them as a line in an evidence report."
---
# Road to three units that stopped firing

> **Source:** `agents/evidence/metrics/routing-canary-20261103.md` § Rerun.
> The parent's 5.3 canary classified nine units REGRESSION at one run each; a
> rerun at three runs each cleared four as noise, left two at 2/3, and left three
> at **0/3**: `type-design`, `react-shadcn-ui`, `project-analysis-core`. All three
> fired on the same prompt at the 2026-10-27 baseline. None of the three changed
> its `description` since then, so the cause is not in the obvious place.

## Goal

Each of the three either fires on its baseline prompt again, or carries a
recorded reason why that prompt is no longer its job. The two 2/3 units
(`dependency-upgrade`, `wireframe`) are measured at the same repetition count
alongside, so nothing is fixed against a single-run number.

## Phase 1 — locate the cause before touching a skill

- [ ] **1.1 Read the three traces.** For each 0/3 run, which skill (if any) the
      run invoked instead, from the kept trace (`invokedFromTrace`).
      verify: one table per unit — run, invoked skill, catalogue sha — committed
      under `agents/evidence/metrics/`.
- [ ] **1.2 Separate host from catalogue.** Rerun the three units at three runs
      each on the frozen baseline catalogue (`1c967b17…`, materialised with
      `git archive 9e226440b6`) on today's host. Fires there → the catalogue
      change is the cause; does not fire → the host change is.
      verify: the rerun artefact names host version and catalogue sha, and the
      table from 1.1 gains a column with the verdict.

## Phase 2 — repair, measured

- [ ] **2.1 Repair the cause 1.2 names** — a description edit that restores the
      routing criterion the competing skill took, or a recorded reason the
      prompt now belongs to that skill (a corpus edit moving the positive).
      verify: the three units at three runs each reach the floor restated as a
      rate (`docs/contracts/routing-assurance-metrics.md` § 6.2) on today's
      catalogue, classified by `compile_trigger_evals --classify`.

## Acceptance Criteria

- [ ] AC-1 — No unit of the five stays REGRESSION at three runs without a
      recorded reason.
- [ ] AC-2 — Every live run goes through the host CLI, and its record names the
      CLI version.
