# Cross-model parity eval — re-scoped design

> Design artifact for `road-to-opt-measurement-unblock` Phase 3 step 1. It
> re-scopes the archive's most-deferred item (deferred across 4+ roadmaps) to the
> **smallest capability** that produces a real cross-vendor parity signal, so the
> build-vs-defer decision (step 2) rests on a concrete design, not the generic
> "the harness doesn't exist". Writing this design is autonomous; **building and
> running it is a maintainer cost decision** (step 2/3), disclosed and gated.

## What changed since the last deferral

| Original blocker | Status now |
|---|---|
| No delegable-task corpus | **RESOLVED** — `internal/bench/orchestration/corpus/` exists (`orch-*` orchestration tasks + `pv-*` production-validator tasks) |
| Harness cannot execute model-emitted subagent calls | **STILL TRUE** — do not assume it away; re-scope around it |

The corpus blocker no longer holds, so the item is re-openable — but only if we
stop trying to build the thing that is still blocked (a full in-host harness that
runs arbitrary model-emitted subagent calls).

## The re-scope: council-transport execution, not an in-host harness

**Don't** build a harness that executes model-emitted subagent calls end-to-end
(the still-open blocker). **Do** reuse the capability that already exists: the AI
council transport dispatches the *same* prompt to *multiple vendors* through
`consult(members: ExternalAIClient[], …)` in
[`src/scripts/ai_council/orchestrator.ts`](../../src/scripts/ai_council/orchestrator.ts).

The smallest capability that yields a cross-model parity signal:

1. **Task adapter.** Render each corpus task (`internal/bench/orchestration/corpus/*.md`)
   into a single self-contained council prompt: the task + its rubric, asking the
   model to *produce the findings it would surface* (not to actually spawn
   subagents). This sidesteps the subagent-execution blocker — we measure the
   model's **finding output on the delegable task**, not its ability to drive a
   live subagent runtime.
2. **≥ 2 vendors, same corpus.** Dispatch the identical prompt set to two distinct
   vendors via the existing `ExternalAIClient` array — no new transport, no new
   auth surface beyond what the council already has.
3. **Per-host finding-count distribution.** For each (host × task), record the
   count and the findings; aggregate to a per-host distribution over the corpus.
4. **Blind judged quality (optional, gated).** If a quality signal beyond raw
   counts is wanted, reuse the blind second-judge + Cohen's κ from
   [`check_quality_regression.ts`](../../src/scripts/check_quality_regression.ts)
   — the same discipline the Phase-1 rerun uses. This is the billable half; the
   count distributions (step 3) are cheap and already informative.

**Explicitly out of scope:** running the models' emitted subagent calls, a
persistent multi-host runtime, any new vendor integration. If the signal needs
more than council-transport can give, that is a *separate, later* build — named,
not assumed.

## What the signal feeds — `finding_floor` calibration

`finding_floor` is an **inert mechanism today** (referenced in
`run_skill_evals.ts` / `skill_linter.ts` / `evals.schema.json`); its recorded
deferral reason was exactly the missing calibration input this eval produces. The
per-host finding-count distributions calibrate the floor:

- Derive the floor from the **cross-host lower envelope** (e.g. a low percentile of
  the per-task finding counts across vendors) so the gate fires on a host/task that
  under-produces relative to the cross-vendor norm, not relative to one vendor.
- Once calibrated, promote `finding_floor` from inert to an **enforcing CI gate**
  (its intended end state).

## Build-vs-defer decision inputs (for step 2, maintainer)

- **Cost:** the count-distribution pass (steps 1–3) is `N_tasks × N_vendors`
  council calls — small and cheap; render the `council:estimate`-class disclosure
  before the first call. The judged-quality half (step 4) roughly doubles it.
- **Value:** unblocks `finding_floor` (arms a real CI gate) **and** produces the
  first honest cross-vendor parity number the portfolio has ever had.
- **Defer condition:** if built later, park with the concrete missing capability
  named — here it would be "council-transport task-adapter for the orchestration
  corpus", never the generic "harness doesn't exist".

## Exit criteria mapping

- This design doc **exists** (step 1 — done by writing this). ✓
- Explicit **build/defer decision recorded** (step 2 — maintainer, cost attached). ⏳
- If built: `finding_floor` calibration data exists and the gate is armed
  (step 3 — gated on the decision + spend). ⏳
