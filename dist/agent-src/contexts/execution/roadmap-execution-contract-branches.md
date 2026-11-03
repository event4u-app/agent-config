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
      - src/scripts/dispatch_r2_reviewer.ts
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
[`guideline:agent-infra/traceability-field-mechanics`](../../guidelines/agent-infra/traceability-field-mechanics.md).
They are not optional reading: a slug grammar does not imply a namespace, and
`evidence_refs` are syntactically safe tokens rather than verified evidence.

### 2a/2b by invocation — declared by `process-full` flags

`process-full` has no
screen (ADR-237), so neither field above could ever be declared there, and the
cautious value became inherited rather than chosen. The invocation flags
`--late-artifacts auto-research` and `--deferred spawn-follow-up-draft` declare
them instead. The cap of three and the preservation test are unchanged. The run
writes each declared value into the target roadmap's Decisions table as its
first act, so the value survives a resumed run rather than living only in the
session that read the flag. Without a flag, the defaults above still apply.
Whether `process-full` should change its default is an owner question, recorded
as O-1 in `road-to-a-run-the-invocation-already-answered`; the 2026-11-03
council split on it.

### 2d. Owner answers carried by the invocation

An owner may answer a roadmap's open decisions in the invocation itself, one
per line: `O<n> <decision-id>: <answer>`. Each line becomes a row in the target
roadmap's Decisions table, resolved by `owner (invocation, <date>)`, with the
line quoted as its evidence. It is never a council row, because it came from
the owner, and it settles only the decision it names, never a neighbour by
analogy. A line naming no existing decision is reported in the PR body and
otherwise ignored. An answer settles a decision; it never stands in for the
explicit confirmation a Hard-Floor action needs.
