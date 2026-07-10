# Quality-Eval Expansion, Default-Flip Gates & Rollout/Monitoring Plan

Phases 7–8 of `road-to-frontier-quality-operating-system`. The governed plan
for expanding the eval corpus, the default-flip gates, and reversible/observable
rollout. Extends [`eval-harness.md`](eval-harness.md); executed in follow-up
implementation roadmaps.

## Phase 7 — quality-eval expansion + default-flip gates

- **Expand the golden corpus** (`check_token_quality_golden` or a sibling) with
  frontier tasks: currentness (FQ-01), memory non-application (FQ-04), artifact
  routing (FQ-07), tool priority (FQ-02), citation discipline (FQ-10/FQ-11),
  concise natural prose, safe refusal formatting.
- **Cross-pressure cases per new rule/contract:** user preference vs criticism
  (FQ-05 wins), inline brevity vs file request (FQ-07 file wins), internal data
  vs public web (FQ-08/FQ-02 internal wins), currentness vs stable knowledge
  (FQ-01), connected app vs browser (FQ-08 app wins), source quality vs
  convenience (FQ-11 quality wins). These encode the conflict tie-breakers from
  `mechanism-matrix.md` as tests.
- **Default-flip gates** (per `eval-harness.md`): advisory → routed → default-on
  only when trigger-eval recall is green, negative precision is green, and
  paired quality does not regress on existing coding/roadmap tasks.
- **Maintainer-visible report:** a generated view listing which mechanisms
  remain advisory and why (capability-gated, precision not yet green, or awaiting
  the follow-up implementation). This is the honest "what is NOT default-on"
  surface.

## Phase 8 — runtime rollout, monitoring, rollback, re-harvest

- **Staged rollout:** ship new contracts behind rollout flags / opt-in packs
  where supported; otherwise document the staged merge order and **do not change
  multiple routing defaults in one PR** (mirrors the kernel slow-rollout ethos).
- **Per-mechanism rollback:** each default-on mechanism records files to revert,
  the flag to disable, the eval that should fail if the rollback is incomplete,
  and the user-visible behaviour that should disappear.
- **Monitoring hooks (package development):** trigger traces in eval output,
  misroute examples captured under `agents/roadmap-assets/frontier-quality/`, and
  a **changelog entry when a behaviour moves advisory → default**.
- **Re-harvest cadence:** repeat the source-anonymous mechanism review after
  major host/tool changes or a new prompt family — but the mechanism-matrix
  discipline (`mechanism-matrix.md` § convention) is REQUIRED before any new
  adoption roadmap, so one external corpus never becomes permanent truth.

## Reversibility invariant

```
ADOPTION IS REVERSIBLE, OBSERVABLE, AND REPEATABLE.
NO MECHANISM GOES DEFAULT-ON WITHOUT A NAMED ROLLBACK + A RED-ON-ROLLBACK EVAL.
NO EXTERNAL CORPUS IS TREATED AS PERMANENT TRUTH — THE MATRIX GATES RE-HARVEST.
```

## Disposition

Phases 7–8 are the rollout/monitoring PLAN. The corpus expansion, the flip
executions, and the monitoring wiring land in the follow-up implementation
roadmaps (each gated by the flip-gates here). No src change in this program
roadmap (acceptance §5).
