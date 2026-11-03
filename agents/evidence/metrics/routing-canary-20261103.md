<!-- evidence-type: analysis -->

# Routing canary — regression states against the frozen baseline, 2026-11-03

**Roadmap:** `road-to-routing-assurance-live-floors` 5.3.
**Baseline:** `routing-baseline-20261027.json` (host 2.1.311, catalogue `1c967b17…`).
**Floors:** `docs/contracts/routing-assurance-floors.json`.
**Rows:** `routing-canary-20261103.json` (the run), `routing-regression-20261103.json`
(the classification, written by `compile_trigger_evals --classify`).

## What ran

The baseline protocol's selection (`--baseline-plan --units 999 --per-unit 1`)
over today's corpus, cut to the 134 units that carry a registered floor — the
135th floored unit has no positive left in the corpus. `claude plugin eval`,
host **2.1.316**, `claude-opus-5-5`, `--runs 1`, `--ablation none`, on **today's**
catalogue (`59abaf19…`, commit `f9054d0f10`): a regression check measures the
catalogue as it ships, not the frozen one. CLI estimate 22.82 USD, through the
subscription CLI (AC-7). No run errored.

## Result

| State | Units |
|---|---:|
| PASSED | 122 |
| ROUTING_CHANGED | 3 |
| REGRESSION | 9 |
| UNKNOWN | 0 |

Mean recall 0.478 against the baseline's 0.541. Gate: **red**.

REGRESSION (baseline fired, canary did not): `ai-council`, `dependency-upgrade`,
`description-assist`, `project-analysis-core`, `react-shadcn-ui`,
`readme-writing`, `skill-reviewer`, `type-design`, `wireframe`.
ROUTING_CHANGED: `adversarial-review` (0 → 1), `existing-ui-audit` and
`judge-bug-hunter` (recall 0 both times, a different skill invoked).

## What the red does and does not say

- It is the scheduled canary's signal, as the contract states: the failure is
  the maintainer notification, and no PR is gated by a live result.
- Three confounds are named, not resolved: the host moved from 2.1.311 to
  2.1.316; the catalogue grew (3.3 already measured recall falling with catalogue
  size); and one run per unit makes every per-unit recall 0 or 1. Seven of the
  nine regressed units have a `SKILL.md` byte-identical to the baseline's, so the
  skill text is not the first suspect.
- The instrument to separate noise from regression already exists (6.1, opt-in
  repetitions): a rerun of the nine units at a repetition count is what turns
  this into a verdict — and it ran, below.

## Rerun — the nine REGRESSION units at three runs each

Same host, model and catalogue, `--runs 3`; rows in
`routing-canary-rerun-20261103.json`. CLI estimate 5.16 USD. No run errored.

| Fired | Units |
|---|---|
| 3/3 — noise at n=1 | `ai-council`, `description-assist`, `readme-writing`, `skill-reviewer` |
| 2/3 | `dependency-upgrade`, `wireframe` |
| **0/3 — stable** | `project-analysis-core`, `react-shadcn-ui`, `type-design` |

The three stable ones did not change their `description` since the baseline
(`react-shadcn-ui` changed only a link and a provenance sentence in its body).
They, and the two 2/3 units, are carried by
`agents/roadmaps/road-to-routing-assurance-live-floors-carried.md`, which locates the
cause — host or catalogue — before any skill is edited.
