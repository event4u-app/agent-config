# Pre-registered measurement — road-to-roadmap-situational-awareness (ADR-054)

<!-- evidence-type: analysis -->

- **Pinned commit:** `origin/main` at `2a7a8e221` (full: `2a7a8e221cfd92f980861cc275409f38852385e3`)
- **Measured:** 2026-08-23, before the Phase 2 wiring merges
- **Probe:** `agent-config roadmap:context --json`, plus `gh pr list --state open`
- **Context fingerprint at measurement:** `ac612ab43f8f0892`

## M1 — active roadmaps already closed in an open PR

**Baseline: 0 / 15.** Zero, because the repository currently has **zero open
pull requests** at all.

| Commit | Date | Figure |
|---|---|---|
| `33d7f74af` | 2026-08-16 | 4 / 24 (#1545, #1546, #1547, #1551) — drafted |
| `f6703b78a` | 2026-08-22 | 2 / 22 (#1546, #1547) — re-measured at authoring |
| `2a7a8e221` | 2026-08-23 | **0 / 15** — measured here |

**This is a null, and it is the strongest available evidence for the defect the
roadmap was written about.** D1b claimed the sample "halved itself in six days"
and inferred that a screen taken once is wrong within a week. The sequence
4/24 → 2/22 → 0/15 does not merely halve, it drains: every roadmap-completing PR
in the drafted sample has merged, and the active estate itself shrank by nine
files. A one-shot screen taken on 2026-08-16 would today be wrong about **every**
row it reported. The decay rate is the measurement that matters, exactly as the
roadmap said.

**What it does NOT license.** A zero here says nothing about whether the probe
helps — it says the population is empty at this instant. The denominator moved
too (24 → 22 → 15), so the three figures are not a clean time series over one
cohort; they are three snapshots of an estate that is being drained in parallel.
Stated rather than smoothed over.

## M2 — (active roadmap, open PR) pairs with file overlap

**Baseline: 0 pairs**, under the cited-path heuristic, and trivially so: with
zero open PRs there is no right-hand side to intersect against. The drafted
figure was 4 pairs at `f6703b78a` (#1546 against `road-to-org-pack-fitness`,
`road-to-standing-payload-diet`, `road-to-council-seat-selection`,
`road-to-skill-delivery-over-mcp`); all four disappeared with #1546.

The mechanism is asserted independently of this number, which is the point of
AC-6: `computeOverlaps` is pinned against in-test fixtures and injected `gh`
responses, never a live PR number, so an empty live population cannot leave the
overlap logic unverified. See `tests/scripts/roadmap_context.test.ts`.

## M3 — forward measurement, NOT YET TAKEN

**Status: pending by construction.** M3 is defined over "the next 10
`process-*` runs after Phase 5 lands", so it cannot be taken in the change that
lands Phase 5. Recording it as pending rather than inventing a figure.

Two counts, and the method for each:

1. **`superseded-by` markers written.** Expected value **0** for the
   foreseeable future, and not because the mechanism works: the marker-writing
   reaction is step **5.3**, held deferred as owner-reserved. `superseded` exists
   only as a terminal-outcome *report*. A non-zero count before 5.3 is taken up
   would itself be the defect — count it as one.
   Method: `grep -rn 'superseded-by:' agents/roadmaps/`.
2. **PRs opening `CONFLICTING` at first push.** Method:
   `gh pr view <n> --json mergeable` immediately after the first push of each
   `process-*` PR, recorded per run.

**Honest-null path, restated with what changed.** If M3 shows no reduction in
`CONFLICTING`-at-first-push over 10 runs, the refresh trigger is removed — which
is now a one-line revert of the `### Context refresh` subsection in
`roadmap-process-loop.md`, not a settings default flipped to `off`. The step-5.1
re-scope (see `situational-awareness-cadence-key-decision.md`) changed the
mechanism, not the exit condition. The probe (Phase 1) and the relation table
(Phase 4) are kept regardless: they produce evidence rather than claim a net win.

**Kill criterion, unchanged:** one wrong `superseded-by` marker — a step marked
done whose work was not on `origin/main` — removes reaction (e) permanently and
returns that case to the ambiguity halt.

## Population drift worth recording

The roadmap's own figures assumed 22 active roadmaps. The tree at `2a7a8e221` carries
**15** active files, of which **9** are non-draft (the other 6 are
`status: draft`). Every count in the roadmap body that reads "22" is therefore
stale, and the `relates:` ratchet baseline was set from the measured 9 rather
than from the drafted 22 — see `src/config/gate-violation-baselines.json`.
