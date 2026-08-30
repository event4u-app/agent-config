# Subagent Response Contract (Phase 3 / A3)

The structured body a subagent returns inside the 4-status envelope. The status
([`subagent-steering`](subagent-steering.md): `DONE` / `DONE_WITH_CONCERNS` /
`NEEDS_CONTEXT` / `BLOCKED`) stays the envelope; this is the **body** the
orchestrator synthesises and re-verifies.

## Shape

```json
{
  "summary": "",
  "findings": [{ "title": "", "evidence_refs": ["file:line | id | path"], "mutating": false }],
  "risks": [],
  "confidence": "low | medium | high",
  "handoff": "",
  "artifact_paths": ["<runtime artifact dir path — where the FULL result lives on disk>"]
}
```

- **Refs, not bodies.** `evidence_refs` are ref tokens (`file:line`, ids, paths),
  never inline content — same minimal-slice / privacy floor as the spawn contract.
- `mutating` marks a finding whose action changes files/state (feeds the verify link).
- **The envelope is the ONLY return channel** (token-economy-dispatch Phase 6):
  a worker's full result lands on disk (runtime artifact dir, gitignored) and
  `artifact_paths` names where; the orchestrator consumes from those paths on
  demand, never via wholesale transcript ingestion. Committed size caps,
  validator-ERRORED (never silent truncation): `summary` ≤ 2,000 chars ·
  line-shaped fields (`handoff`, a risk, a finding title) ≤ 240 · arrays ≤ 40
  entries · one artifact ref ≤ 200 · the whole serialized envelope ≤ 12,000
  chars (~3k tokens against a measured ~251k spawn floor). Constants + checks:
  `src/scripts/_lib/subagent_response.ts`.

## The canonical shape, and the three-way divergence it resolves

**Reconciled 2026-08-22** (`road-to-subagent-envelope-adoption` Phase 0, AI
council 2/2 convergent). One contract existed in three mutually inconsistent
states, and the ledger's `0 valid envelopes of 1,845 stops` could not be cited
as evidence about any one of them, because a reader had to assume which.

```
THE BODY SCHEMA IS `validateResponse`'S FIVE REQUIRED FIELDS. PRODUCERS CONVERGE
ON IT; THE VALIDATOR IS NOT WIDENED TO THE UNION OF WHAT PRODUCERS HAPPEN TO SEND.
```

Direction chosen: **narrow the contract to what the validator already accepts**,
not widen the validator. Widening makes every future divergence legal by
construction, which is how one contract came to have three states.

## Why success is gated, and not accepted

```
AN UNVERIFIED SELF-REPORT IS INDISTINGUISHABLE FROM A RESULT.
A RETURN THAT CLAIMS SUCCESS AND SHOWS NO CHANGE AGAINST ITS OWN DECLARED
OUTPUT CONTRACT IS NOT EVIDENCE OF SUCCESS. IT IS EVIDENCE OF A CLAIM.
```

**The failure this prevents.** Every downstream aggregation reads the recorded
outcome, not the return. `src/scripts/extract_audit_patterns.ts` mines repeated
patterns from it, and the per-asset effectiveness report is built on the same
stream. A forged `success` does not stay one line: it becomes signal, and the
report then recommends keeping an asset that never worked and retiring one that
did. Nothing downstream can detect it, because at that point the forgery is
indistinguishable from the thing it imitates — which is the whole reason the
check has to happen where the record is written rather than where it is read.

**Why the gate reads the declared output contract and not the diff.** The
obvious rule — claimed success plus an empty diff is never a success — is wrong
here, and wrong in a way that is worse than doing nothing. Analysis, review and
read-only research dispatches are a large share of this repository's subagent
traffic, and every one of them legitimately produces no diff. The unconditional
rule would mark them all as failures and poison the same aggregation in the
opposite direction. **Zero diff may be valid, so "zero diff = failure" must not
be global.** The gate therefore fires only where the dispatch itself declared
that a code change was the expected output.

**An unmeasured diff is not an empty diff.** Where the producer did not measure,
the gate does not fire. Treating "not measured" as zero manufactures the same
forgery with the opposite sign, and an aggregation cannot tell the two apart any
better than it can tell a forged success from a real one.

Implemented by `envelopeOutcome` in `src/scripts/_lib/orchestration_record.ts`,
the tree's only cross-domain outcome mapping. Because it is the only one, the
mapping is **versioned**: lines carry `outcome_semantics`, and an absent field
means the pre-2026-08-30 unconditional semantics. `audit-log-v1` is append-only,
so a labelling change cannot be rolled back the way a gate can — a reader
aggregating across the cutover segments on that field rather than inferring from
a date.

### Per-field divergence, one row per field

| Field | spawn-contract (f) | `team_dispatch` model JSON (`:297`) | `subagent_response.ts` validator | `dispatch_r2_reviewer` |
|---|---|---|---|---|
| `summary` | — (not a field clause) | present | **required** | silent |
| `handoff` | — | **absent** | **required** | silent |
| `confidence` | — | **absent** | **required** (`low\|medium\|high`) | silent |
| `findings` | — | present, `{severity, evidence, suggested_fix, location}` | **required**, `{title, evidence_refs?, mutating?}` | silent |
| `risks` | — | **absent** | **required** | silent |
| `artifact_paths` | — | absent | optional | silent |
| `assumptions` | — | absent | optional | silent |
| `status` | — | present, 3 model values | **not a body field** | silent |

An empty cell is a finding, not a pass. `dispatch_r2_reviewer` is silent on
every row — 1,292 lines with **0** hits for `envelope`, `DONE_WITH_CONCERNS`,
`response.contract` or `response_contract`.

### Four boundaries, because "the contract" was conflating them

The council's sharpest correction: schema, lifecycle state, delivery and
classification were being treated as one thing.

1. **Body schema** — the five required fields above, plus the two optional ones.
2. **Lifecycle frame** — `DONE` / `DONE_WITH_CONCERNS` / `NEEDS_CONTEXT` from a
   model, plus `BLOCKED` orchestrator-side only (`team_dispatch.ts:391`'s
   `_MODEL_STATUSES` is the three-value set a model may send). **Not a body
   field**, which is why narrowing the body does not delete it.
3. **Delivery protocol** — serialize once, persist that exact serialization,
   then emit the identical value as the final text-only message. This is
   spawn-contract rule (f), and it **survives the narrowing**: its two clauses
   are delivery invariants, not fields, so they were never candidates for the
   validator's five.
4. **Classification** — validate and record against an explicit contract and
   classifier version.

### Who owns the delivery protocol — and it is not the model

`team_dispatch.ts:280` asks a **read-only** model with no command or filesystem
access to return its review JSON. That model **cannot** satisfy "disk copy
written first", so rule (f) is an impossible prompt obligation for this
producer. The trusted dispatcher owns it: parse the producer's response, project
it into the canonical body, add the lifecycle frame, write the durable copy,
then emit the identical serialized value.

Recorded rather than implemented here — the projection adapter is a mechanism
this roadmap's Phase 1 does not ship, and saying so is cheaper than a contract
clause nobody can satisfy.

### The validator is not the reason the rate is zero

Checked directly on 2026-08-22, because "zero valid envelopes over 1,845 stops"
has three possible causes and they need separating: a validator that rejects
valid input, producers that do not emit the fields, or a shape nobody can
produce.

`validateResponse` was run by hand against a minimal envelope
(`{summary, handoff, confidence, findings: [], risks: []}`) and a rich one
(with `findings[{title, evidence_refs, mutating}]` and `artifact_paths`).
**Both validate.** The `team_dispatch` model shape fails on four of five.

So the contract is implementable and the validator is correct; the rate is zero
because producers do not emit the shape. That removes the precondition one
council seat set before any narrowing.

## Durable copy — the envelope on disk before the message

```
THE FINAL MESSAGE IS A SINGLE TEXT-ONLY ENVELOPE. NEVER END ON A TOOL CALL.
THE SAME ENVELOPE IS WRITTEN TO THE RUNTIME ARTIFACT DIR BEFORE IT IS EMITTED.
DISK IS THE DURABLE CHANNEL. THE MESSAGE IS THE FAST CHANNEL.
A RETURN THAT WAS PAID FOR AND NEVER DELIVERED IS THE FAILURE THIS PREVENTS.
```

The envelope reaches the orchestrator twice, and the two copies are not two
result shapes:

- **The message** — the worker's final assistant message, text only, carrying
  the envelope verbatim. Fast, and the channel that can vanish.
- **The file** — the same envelope written into the runtime artifact dir
  (gitignored) as `response-envelope.json` *before* the final message is
  emitted, so it exists even when the message never arrives.

This does not weaken *the envelope is the ONLY return channel* above. That
clause governs what the orchestrator may **ingest** — one envelope shape, never
a wholesale transcript. The disk copy carries that same shape, so the
orchestrator still reads exactly one; what changes is that it can still read it
after a delivery failure.

**Why the ordering is load-bearing.** A subagent whose last block is a
`tool_use` delivers nothing to its parent on host 2.1.229 — measured with a
matched control dispatched in the same turn: `(no output)` after 3 tool uses and
18,242 tokens, against a control ending on assistant text that returned the
complete report
([`subagent-lifecycle-phase0-return-channel.md`](../../../../agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md)
§ F1). The tokens were spent either way. Writing the envelope first is what
turns a dropped message into a recoverable read instead of a paid-for discard.

**Honest status — a convention, not a checked invariant.** Nothing in the tree
writes, reads, or validates `response-envelope.json`: the filename is fixed here
so that a durable channel is *findable* rather than nominal, and the clause
travels in the dispatch prompt (spawn contract rule (f)), which is where a
worker actually reads its duties. A `subagent_stop` concern that finds the file
and injects its path when the message is empty is planned and **not shipped** —
said plainly, because "the durable channel" must not be read as a recovery
mechanism that already runs.

## Budget-hit partial result

When the worker's `max_tokens_per_worker` stop-loss fires
([spawn contract § Per-worker token stop-loss](subagent-spawn-contract.md#per-worker-token-stop-loss-l0b--hard-budget-structured-escalation)),
the return is a `BLOCKED` envelope whose body is this shape instead:

```json
{
  "budget_hit": true,
  "found": ["file:line | id | path"],
  "remaining": "<what stays unexplored, one sentence>",
  "suggested_next_rung": "primitive | higher-tier-subagent | in-session"
}
```

`budget_hit: true` is the escalation flag; `found` follows the same
refs-not-bodies floor as `evidence_refs`. Validator:
`worker_budget.validateWorkerPartialResult` — the orchestrator never adopts an
invalid partial return.

## Stated assumptions — `assumptions[]`

Both the result body above and the CHECKPOINT capsule below may carry:

```json
{ "statement": "<one line>", "basis": "<ref token>", "epistemic_state": "verified | assumed | gap" }
```

The vocabulary is the **Evidence-Report buckets** from
[`evidence-discipline`](evidence-discipline.md#evidence-report--the-discovery-output)
— pinned once, in `subagent_capsule.EPISTEMIC_STATES`, and deliberately not a
private scale: a capsule that graded its premises differently from the rest of
the suite would fork the vocabulary every other surface reasons in.

Absent `assumptions[]` means **not recorded** — never "no assumptions were
made". Unstated premises are the first thing compression drops, which is
exactly why the field exists on the handoff surface.

## CHECKPOINT capsule — the generation handoff

`CHECKPOINT` is the fifth envelope status. A worker that reaches its budget
**watermark** (below the stop-loss line, so it still has the headroom to
summarise itself) returns a capsule instead of running on to be killed:

```json
{
  "status": "CHECKPOINT",
  "summary": "<one or two sentences>",
  "generation": 1,
  "done": ["file:line | id | path"],
  "remaining": ["<one short line each>"],
  "decisions": ["<choices the successor must not silently re-open>"],
  "open_risks": ["<still open at handoff>"],
  "touched_files": ["path | file:line"],
  "assumptions": [{ "statement": "", "basis": "", "epistemic_state": "verified" }]
}
```

**Transcript-exclusion by construction.** Every field is a ref token, a single
short line, or a count; array entries are capped so a transcript cannot be
reached by accumulation either. There is no field a raw transcript fits in —
and that is load-bearing, not stylistic: the claim under test is whether a
successor can work from the *capsule*, which is unmeasurable the moment raw
context can ride along. Validator:
[`subagent_capsule.validateCapsule`](../../../../src/scripts/_lib/subagent_capsule.ts);
the orchestrator never briefs a successor from an invalid capsule.

**Status today: additive and off.** Nothing reads a capsule. Emission is
shadow-only (the worker still runs to stop-loss exactly as before) and the
synthesis duties below have no `CHECKPOINT` branch, so the measurement is not
confounded by the mechanism it is measuring. The recycling loop that consumes a
capsule is gated behind `blocker: host-worker-respawn` and
`blocker: capsule-quality-near-budget`.

## Orchestrator synthesis duties

```
NEVER ADOPT A SUBAGENT RETURN UNVERIFIED.
```

On collecting returns, the orchestrator MUST:

1. **Dedupe** findings across subagents.
2. **Mark contradictions** between returns (do not silently pick one).
3. **Re-check evidence gaps** — a finding with no `evidence_refs` is an unbacked
   claim; resolve it with a real tool before adopting (`synthesisGaps`).
4. **Downgrade or reject** risky findings; the final decision is the orchestrator's.

## Confidence → verify-budget link

A **mutating** finding returned at **`low`** confidence forces the full
cross-model judge path — no deterministic-only pass — per
[`verify-budget`](verify-budget.md) (`forcesJudge`). High-confidence trivial
findings may still take the deterministic path. The chosen `verify_mode` is
recorded in [`orchestration-telemetry`](orchestration-telemetry.md).

## Reference implementation

[`src/scripts/_lib/subagent_response.ts`](../../../../src/scripts/_lib/subagent_response.ts)
(`validateResponse`, `synthesisGaps`, `forcesJudge`), covered by
[`tests/scripts/_lib_subagent_response.test.ts`](../../../../tests/scripts/_lib_subagent_response.test.ts).

## Related

- [`subagent-steering`](subagent-steering.md) — the 4-status envelope + lifecycle this body rides in.
- [`verify-budget`](verify-budget.md) — the deterministic-vs-judge budget the confidence link feeds.
- [`verify-before-complete`](../../rules/verify-before-complete.md) — the Iron Law behind "never adopt unverified".
