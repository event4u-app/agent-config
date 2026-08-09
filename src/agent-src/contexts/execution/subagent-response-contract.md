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
  "handoff": ""
}
```

- **Refs, not bodies.** `evidence_refs` are ref tokens (`file:line`, ids, paths),
  never inline content — same minimal-slice / privacy floor as the spawn contract.
- `mutating` marks a finding whose action changes files/state (feeds the verify link).

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
