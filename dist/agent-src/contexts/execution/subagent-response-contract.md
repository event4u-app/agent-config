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
