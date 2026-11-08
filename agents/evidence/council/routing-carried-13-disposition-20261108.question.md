<!-- evidence-type: analysis -->

# Disposition of step 1.3: two routing units the host handles directly

Repository `event4u/agent-config`, roadmap `road-to-routing-assurance-live-floors-carried`, step 1.3:

> **1.3 Repair the cause 1.2 names** — a description edit that restores the routing criterion the competing skill took, or a recorded reason the prompt now belongs to that skill (a corpus edit moving the positive).
> verify: the five units at three runs each reach the rate floor (0.90) on today's catalogue, classified by `compile_trigger_evals --classify`.

Three of the five units are closed. Two remain: `react-shadcn-ui` and `project-analysis-core`.

## What has been measured

The pass rule is the same everywhere: the run called `Skill` with the unit's own name.

| Series | `react-shadcn-ui` | `project-analysis-core` | What the misses did |
|---|---|---|---|
| Canary rerun, empty sandbox (2026-11-05) | 0/3 | 0/3 | asked for the material the prompt names |
| Frozen-catalogue rerun (1.2) | 0/3 | 0/3 | same; the cause is the host (2.1.311 → 2.1.316), not the catalogue |
| `description` edits ("Use when …") | no change | no change | reverted |
| Fixture series v1, pre-registered | 0/3 (also with Edit/Write granted) | 0/3 (20-file repository) | edited the component itself / read the repository and answered |
| Direct-output assessment (2026-11-08) | direct median 0.75 vs 1.0 with the skill | 0.80 vs 1.0 | direct output misses what the skill states (tokenised foreground, focus ring; missing lock file, uncertainty list) |
| **Prompt series v2**, pre-registered, prompts by an independent author | **0/9** (three realistic requests) | **0/6** (two realistic requests) | every run did the work itself: Read/Edit/Write, or Read ×20 and answer; no `Skill`, no subagent |

Sources:
- `agents/evidence/metrics/routing-carried-units-20261105.md`
- `routing-fixture-v1-20261105.md`
- `routing-direct-output-assessment-20261108.md`
- `routing-prompt-v2-20261108.md`

The floors are at `docs/contracts/routing-assurance-floors.json` (baseline recall 1.0 for both, floor 0.90). The baseline is from host 2.1.311 on 2026-10-27, when both units fired.

## Constraint

A recorded floor is a gate. Lowering it, or removing a unit from it, weakens that gate. The repository's rule is that such a change needs an independent verdict and a recorded reason; it may not be made silently. Retiring the two positives was ruled out by the direct-output assessment, because the direct handling falls short of the skills' stated value.

## Options considered (none preferred here)

- **(a) Keep 1.3 open and park the roadmap** under `later/`. The resume condition would be that a host-version change re-runs the v2 series. Nothing about the gap changes in the meantime.
- **(b) Record the two units as host-direct and take them out of the routing floor.** The floor would then measure only units the host routes. Recall for these two would still be recorded, but not gated. A reason and an independent verdict would be committed.
- **(c) Change what is measured for these two units.** The skills' value would be put where direct handling sees it, for example in always-loaded guidance, a hook, or the description's content. The floor for these units would become an output-quality floor (the assessment's rubric) instead of a routing floor. That requires a new contract and a measurement.
- **(d) Something else.** Name it.

## Questions

1. Which disposition, and why? If none of these, what?
2. What would have to be true for the chosen disposition to be wrong, and what observation would show it?
3. Does the chosen disposition weaken a gate? If so, what makes that acceptable, and what record must accompany it?

End with exactly one line in this form:
`STANCE: <a|b|c|d> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>`
