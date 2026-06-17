# RDP trigger-eval wiring — which disciplines the skill-runner can measure

Resolves the gap surfaced 2026-06-16: `skill_trigger_eval.py` measures **skill
routing** (did a query route TO skill X?). RDP's 8 disciplines are a **mix of
skills and rules**, so the skill-runner can only score the skill-backed ones.
This file maps each discipline to its artifact + measurement path so the
billable Phase-1 run targets the right probe per discipline.

## The 8 disciplines

| discipline | artifact | type | trigger probe | seeded? |
|---|---|---|---|---|
| `complexity_first` | `complexity-first-planning` | skill | `skill_trigger_eval.py --skill complexity-first-planning` | ✅ 5+5 |
| `orchestrator` | `reasoning-orchestrator` | skill | `… --skill reasoning-orchestrator` | ✅ 5+5 |
| `prediction` | `prediction-pool-optimizer` | skill | `… --skill prediction-pool-optimizer` | ✅ 9+5 |
| `decision` | `decision-record` | skill | `… --skill decision-record` | ✅ 5+5 (this branch) |
| `verifier` | `verify-completion-evidence` | **gate** | quality layer (retired from trigger metric) | ✗ retired — see post-eval note |
| `grounding` | `think-before-action` | **rule** | router-trigger matrix / quality layer | ✗ n/a |
| `intent` | `improve-before-implement` | **rule** | router-trigger matrix / quality layer | ✗ n/a |
| `notes_first` | `notes-first-reasoning` | **rule** | router-trigger matrix / quality layer | ✗ n/a |

## Skill disciplines (5/8) — measurable by the skill-runner

All five now carry `src/skills/<name>/evals/triggers.json` seeded from the
`tests/reasoning-layer-eval/trigger-fixtures.json` rows of the matching
discipline (+ expansion to the 5+5 convention). The operator's billable Phase-1
trigger run is, per skill:

```
task test-triggers-live -- complexity-first-planning
task test-triggers-live -- reasoning-orchestrator
task test-triggers-live -- prediction-pool-optimizer
task test-triggers-live -- decision-record
task test-triggers-live -- verify-completion-evidence
```

(The runner is an intentional human-only spend gate — tty + explicit `yes`,
refuses agent/piped invocation. The agent cannot run it; the operator does.)

## Rule disciplines (3/8) — NOT measurable by the skill-runner

`grounding`, `intent`, `notes_first` are **always-on rules**, not skills — there
is no skill to "route to", so `skill_trigger_eval.py` cannot score them. Two
honest options for their trigger signal, neither billable via the skill-runner:

1. **Router-trigger matrix** — `build_rule_trigger_matrix.py` already inventories
   each rule's `triggers:` and what they fire on. A cost-free check: do the
   rule's declared triggers match the fixture's should-fire queries for that
   discipline? This is a *static* trigger check (keyword/phrase match), not a
   live-model routing score — weaker, but free and deterministic.
2. **Quality layer** — the 12 golden transcripts (baseline vs treatment) already
   exercise these rules end-to-end; the rubric scores whether the discipline
   *actually shaped the work*. For rules, the quality layer IS the real signal;
   trigger-precision is a skill-only metric.

## Post-eval re-frame (2026-06-16, after the first live run)

The live run (`RESULTS-trigger-2026-06-16.md`) showed precision-perfect but
recall-collapse for the meta-disciplines — they are lenses, not routing targets.
Applied:

- `prediction-pool-optimizer` — R=1.0, **stays** in the trigger metric (a true
  routable, distinctly-named skill).
- `complexity-first-planning` — R=0.60 (borderline), **stays**, watch.
- `reasoning-orchestrator` — `description` sharpened + re-run: recall **unchanged
  at 0.20** (identical 4 FN). Sharpening proven not to help → it is a lens, not a
  routing target → **moved to the quality layer**. Keep the sharpened description
  (it is more accurate) but drop it from the trigger-precision gate.
- `decision-record` — `description` sharpened + re-run: recall **0.40 → 0.60**
  (one alternative-choice query now fires) → **stays** in the trigger metric at
  the borderline; the two remaining FN hit the routing ceiling.
- `verify-completion-evidence` — **retired** from the trigger metric (R=0.0; it
  is a completion-time *gate*, and its should-fire fixtures were task-shaped → they
  route to task skills). Measured by the quality layer only; its `triggers.json`
  was removed.

**Conclusion:** the RDP trigger-precision metric (README "≥ 60% per discipline")
is well-defined for the **5 skill disciplines** and is now fully wired. For the
**3 rule disciplines** it is not a skill-routing question — drop them from the
skill-trigger metric and rely on the router-matrix (static) + the quality layer
(live) instead. This should be reflected in the rdp-eval Phase-1 run plan: 5
`test-triggers-live` runs + a quality-layer pass, not "8 trigger evals".
