<!-- evidence-type: analysis -->

# The two contracts lapsing 2026-09-23 and 2026-09-24, evaluated

Read 2026-09-11, completing the set the 2026-09-15 evaluation left owed:
`auto-orchestration-v1` (window 2026-09-23) and `write-engine` (2026-09-24).
Same three criteria, same rule — evidence decides, the date only asks, and
neither contract is given a new deadline.

Since 2026-09-11 a passed window no longer reds CI, so nothing here is under
time pressure. That is the point: these two are read because the review is due,
not because a build is about to break.

1. **Active enforcement or real exercise.**
2. **Consumer reliance.**
3. **No known pending incompatible change.**

## `auto-orchestration-v1` — the shapes are exercised, the document has drifted

| | Evidence |
|---|---|
| 1 | Met on the shapes, and one of them carries a gate. The host-capability manifest is resolved per session by `_lib/host_capability.ts`, whose `HostCapabilities` interface matches the contract's example field for field. The spawn brief has `lint_spawn_payload.ts` over it plus `_lib/subagent_spawn.ts` and `_lib/subagent_bundle.ts`. The telemetry object is written by `orchestration_record.ts` and read by `_lib/orchestration_savings.ts`, `routing_doctor.ts` and `explain_run.ts`. |
| 2 | Split, and the split matters. Reliance on the **shapes** is real and named above. Reliance on the **document** is not: `auto-orchestration-v1` is cited by ADR-105, two roadmap stubs and one review artefact — no code, no test, no rule. |
| 3 | The telemetry shape is still moving. |

**The finding is criterion 3, and it is measurable.** The contract pins

```json
{ "task_size_estimate": 0, "spawn_count": 0, "tiers": [], "token_delta": 0, "wall_clock_ms": 0, "outcome": "DONE", "verify_mode": "deterministic" }
```

while the live writer's `RecordInput` (`_lib/orchestration_record.ts`) carries
`token_delta_provenance`, `tier_chosen`, `tier_source`, `task_class` and
`dispatch_mode` beyond that set, and the aggregator's `OrchestrationRecord`
(`_lib/orchestration_savings.ts`) adds `dispatch_tokens`, `session_tier`,
`first_pass_success` and `escalated` — the last two documented in the code as
recent extensions ("pre-extension line / not measured").

This is **not a violation of the contract's own terms**: it declares the object
"additive, non-breaking, counts + ids only", and every addition above is
additive. It is a failure of the contract to still be one. A shape contract
exists so producers and consumers agree without re-deriving; an example that
enumerates neither what is written nor what is read has stopped doing that, and
a reader who trusts it will build against a shape from June.

Three `later/` roadmaps touch the same area
(`road-to-composite-dispatch-topology`,
`road-to-evidence-calibrated-model-orchestration`,
`road-to-zero-ceremony-host-primitives`), so more movement is expected rather
than hypothetical.

**Not promotable.** Two repairs, either of which is small: refresh the pinned
telemetry example against the live interfaces, or state that the example is
illustrative and name `_lib/orchestration_record.ts` as the source of truth for
the field set. The first keeps the contract's promise; the second retires a
promise it is not keeping. What is not acceptable is leaving an example that
reads as exhaustive and is not.

One thing the contract does get right and deserves recording: its activation
precondition already carries the always-on correction ("there is no more
`subagents.enabled`/`subagents.auto` setting"), so that half is current.

## `write-engine` — strongest reliance of any contract in this cohort, and no review has ever happened

| | Evidence |
|---|---|
| 1 | Met. Three test files exercise it (`detect_ai_tells.test.ts`, `drafting_channels_schema.test.ts`, `_cli/humanizer_runtime_check.test.ts`), `_lib/doctor_runtime_checks.ts` names its step 4b in a runtime probe, and `schemas/drafting-channels.schema.json` pins a shape it governs. |
| 2 | Met, and verified rather than taken from the header. All six declared consumers exist: `src/domains/gtm-marketing/ghostwriter/write/command.md`, `post-as/command.md`, `post-as/ghostwriter/command.md`, `post-as/me/command.md`, `humanize/command.md`, and `src/skills/humanizer/SKILL.md`. |
| 3 | Unknown — and that is the finding. |

**Criterion 3 cannot be answered, because the review it depends on has never
been done.** The contract says so itself, at length and honestly: its
`keep-beta-until` was extended to 2026-09-24 on 2026-08-25 as "an administrative
holding period, NOT approval", after the previous deadline (2026-08-13) expired
without a substantive review.

The reason it names for that miss was a gate defect — `check_beta_review_markers`
compared the date only against `today + 90` and had no floor, so a lapsed window
printed green. **That defect is fixed**: the floor landed 2026-08-25, and on
2026-09-11 the lapse stopped reding CI by owner decision, so the window now does
exactly what it claims to do and nothing more.

So the holding period's stated basis is gone, and what remains is the work it was
holding a place for. That work is a read of the contract against its six
consumers — not something to conclude from the outside, and not something a date
produces.

**Not promotable, and not for lack of evidence on criteria 1 and 2**, both of
which it meets more clearly than anything else in either cohort. It is blocked
on a review nobody has run, which is a different state from "the criteria fail"
and is recorded as such.

## What this does not do

No promotion, no new deadline, no contract text edited beyond the two named
repairs being *described* rather than applied — `auto-orchestration-v1`'s stale
example is a shape decision for whoever owns the telemetry, and `write-engine`
needs a review, not an edit.

`surface-tiers` was promoted to `stability: stable` in the same change, on the
evidence recorded in the 2026-09-15 evaluation.
