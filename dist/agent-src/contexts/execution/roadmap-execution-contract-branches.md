# Roadmap Execution Contract — Branches

Branch-only body of [`roadmap-execution-contract`](roadmap-execution-contract.md),
moved verbatim for progressive disclosure. Loaded only when a run declares the
field below; the contract summary, every Iron Law and the § 2a / § 2b policies
stay in the core.

### 2c. `traceability` — requirement to acceptance to evidence, OPTIONAL

**Optional for every complexity, including `structural`.** Absent means *not
declared*, which is a different claim from "there is no requirement". Nothing
fails for omitting it, and no gate enforces it — the only consumer is a listing
inventory (`check_requirements_trace`) that exits 0 always. Requiredness is
deliberately **not** decided here (AI council 2/2, 2026-08-22): deciding it
before the listing phase has produced a count is deciding it on intuition.

A repeated **row**, not three flat fields:

```yaml
traceability:
  - requirement_id: pointer-reaches-the-worker
    acceptance_id: pointer-under-line-cap
    evidence_refs:
      - node_modules/@event4u/agent-config/src/scripts/dispatch_r2_reviewer.ts
```

Three flat top-level fields would be **countable but not traceable**: with more
than one requirement and a shared pool of refs the relation is an ambiguous
many-to-many, so a gate could report a populated count while providing no
dependable trace. The row carries the relation.

Both grammars are reused, never invented — the claim-ledger kebab slug
(`docs/CLAIMS.md` § Entry schema) for the two ids, and the envelope ref-token
rule (`_lib/subagent_response.ts`) for `evidence_refs`: ref tokens, never
bodies.

Identity semantics, revision semantics, the three senses of "gate" and the
`[AC:<id>]` convention — including the verified fact that nothing parses
`verify:` lines structurally today — are in
`guideline:agent-infra/traceability-field-mechanics` (agent-config repository: `docs/guidelines/agent-infra/traceability-field-mechanics.md`).
They are not optional reading: a slug grammar does not imply a namespace, and
`evidence_refs` are syntactically safe tokens rather than verified evidence.
