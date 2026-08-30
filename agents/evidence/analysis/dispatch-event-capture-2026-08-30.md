<!-- evidence-type: analysis -->

# Dispatch-event capture rate — measured, and it misses its own bar

> **Pre-registered** 2026-08-30 in `docs/CLAIMS.md`
> (`claim: dispatch-event-capture-reliability`), committed **before** any line
> of the corpus was counted. `road-to-experience-loop-broadening` step 1.1.

## Headline

**85.7 % — 905 of 1,056 dispatches recorded.** The pre-registered pass bar was
**≥ 95 %**. This is a **FAIL**, and therefore an **honest null** with the
consequence the pre-registration already fixed: the work rescales to skill
events, and no dispatch-event-based mechanism is authored on this evidence.

| | |
|---|---|
| Numerator | 905 — audit lines carrying an `orchestration` sub-object with `spawn_count >= 1` |
| Denominator | 1,056 — `Agent` tool-use blocks in the transcript stores whose hooks write to this checkout's audit dir |
| Rate | **85.7 %** (86.8 % of the raw 906 objects, one of which records `spawn_count: 0`) |
| Bar | ≥ 95 % over ≥ 50 dispatches |
| Power | n = 1,056, twenty-one times the pre-registered floor. **Not** underpowered. |
| Window | 2026-07-28T01:46:07Z → 2026-08-30T08:39:18Z |
| Verdict | **null** — measured, powered, and below bar |

## The denominator is the part that can be got wrong, so it is stated first

`CLAUDE_PROJECT_DIR` resolves to the **parent checkout** inside a git worktree,
so a session running in `<checkout>/.claude/worktrees/<name>` writes its audit
line into the **main** checkout's `agents/runtime/state/audit/`, while its
transcript lands in its own `~/.claude/projects/` directory. Counting only the
main checkout's transcripts therefore produces a denominator smaller than the
numerator — the first reading of this measurement returned 906 recorded against
485 observed, i.e. 187 %, which is how the effect was found rather than assumed.

The denominator is consequently **main checkout + every `.claude/worktrees/*`
session**: 485 + 571 = 1,056. Two further stores are **excluded** because they
are separate checkouts under `/private/tmp` and one sibling path, each carrying
its own audit directory (verified: 1 audit line apiece), contributing 19
dispatches that never had a route into this corpus.

## What moved, and what it does not license

The prior reading in this ledger is **0.27 %** (370 dispatches, 1 recorded
line), recorded under `claim: orchestration-observed-dispatch-cost`. That was
the model-carried era: the record step was an instruction, and instructions do
not fire. The `orchestration-record` concern on `post_tool_use` now emits
deterministically, and the rate moved from 0.27 % to 85.7 % — a factor of ~317.

That is a large real improvement and it is **still a null**. The bar was set at
95 % before the number was known, precisely so that an impressive-looking
reading could not be re-scoped into a pass after the fact. 85.7 % means roughly
one dispatch in seven is not recorded, so any per-asset rate computed over this
stream carries a ~14 % silent denominator hole — which is exactly the failure
mode Phase 6's own rule ("a missing signal counts as `unknown`, never as
success") exists to prevent, and it would be prevented by construction rather
than by luck only if the loop is built on the surface that does not have the
hole.

## Two secondary findings, recorded because they were in the same read

1. **`token_delta_provenance` is `estimated` on 905 of 906 lines** — exactly one
   line carries `measured`. Every cost figure derived from this stream is an
   estimate, and Phase 6.2's basis requirement is therefore not cosmetic.
2. **`dispatch_mode` is `null` on all 906 lines.** The form gate's selected mode
   is recorded nowhere, so the form-gate's value is unmeasurable from this
   corpus in either direction.

Neither was pre-registered; both are reported as observations, not as verdicts.

## Scope bound, stated before the reading and repeated here

The corpus is **one machine's gitignored runtime state**. It is not reproducible
from a clone, and the figure measures **this install**. It is never reported as
the package's capture rate, and no public claim is bound to it.
