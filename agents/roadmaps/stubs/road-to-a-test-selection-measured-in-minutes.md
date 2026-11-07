---
complexity: lightweight
review_by: 2026-12-07
---

# Stub: road to a test selection measured in minutes

> **Stub — not active work.** Created 2026-11-07 from round `inbox-2026-11-za`: two
> reviews of the CI test selection (PR #2894, required since 2026-11-07) ask for its
> real effect, not its replay. It is a stub because the evidence needs elapsed time —
> a month of selected PR runs and full `push: main` runs — not effort.

## What is measured, and what is not

`docs/contracts/ci-test-selection.md` records a replay over 40 main merges: 39 would
have selected, at a mean of 513 of 2,491 test files. That is a file count. It says
nothing yet about Actions minutes, wall-clock wait, or the miss rate — a red `push: main`
run after a green selected PR run, which the contract itself defines as a selection
defect.

## Trigger

On or after 2026-12-07, or after 100 selected PR runs, whichever comes first.

## What it does then

1. Sum Actions minutes and wall-clock per PR for the 30 days before 2026-11-07 and the
   30 days after, from the run history (`gh run list --json`), same workflows.
2. Count selection misses: `push: main` reds whose failing test file the PR run did not
   select.
3. Record minutes saved, wait saved and the miss count in
   `agents/evidence/analysis/`, and file a defect for each miss.

## What it does NOT cover

Model-token cost of agent work — that is `road-to-proof-where-the-owner-sees-it`.
