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
session that read the flag.

**Defaults under `process-full` (O-1, decided 2026-11-03).** The owner delegated
this to the council, which converged in two rounds
(`agents/evidence/council/inbox-2026-11-v-o1-o2-20261103.md`). For a
`process-full` run, an omitted `late_artifacts` resolves to `auto-research`. The cap
of three is unchanged, and research never widens execution authority: a
discovered artifact is classified against the roadmap scope and the halt
conditions before anything is written. `deferred_policy` stays `wait`, because
the seats split on spawning follow-up roadmaps by default; the
`--deferred spawn-follow-up-draft` flag still opts in. `--late-artifacts halt`
restores the cautious value. The other commands keep `halt` / `wait`.

### Owner-class decisions under `process-full`

O-2, decided by the council on 2026-11-03 on the owner's delegation. A
`high_impact` or `user_required` decision that arises during a `process-full`
run does not interrupt the run. It is delivered at the final PR boundary. That
is delivery, never consent: the run never acts on an inferred answer.

1. **Block the affected step and every semantic dependent.** A step continues
   only when its implementation and acceptance hold under every option of the
   open decision. Uncertainty means blocked. A shared file is not the test;
   whether the answer could change the step is.
2. **Quarantine assumptions already made.** An edit written before the decision
   surfaced that assumes one of its answers is reverted or isolated on the run's
   branch before independent work is published.
3. **Publish the decision first in the PR body.** It gets a stable id, the
   options, one recommendation and the steps it blocks.
4. **The run is reported `partial`, never `complete`.** The closing reply in the
   invoking session names the PR link and every unresolved decision. If the PR
   cannot be published, the reply says that directly; it never claims the
   decision reached the user.
5. **Resume needs an explicit answer** bound to that decision id, after which the
   affected work is revalidated.

Hard-Floor actions and the other halt conditions are untouched: they keep their
this-turn confirmation. A follow-up roadmap that carries a blocked item carries
its open decision with it and never treats the transfer as permission to choose.

### 2d. Owner answers carried by the invocation

An owner may answer a roadmap's open decisions in the invocation itself, one
per line: `O<n> <decision-id>: <answer>`. Each line becomes a row in the target
roadmap's Decisions table, resolved by `owner (invocation, <date>)`, with the
line quoted as its evidence. It is never a council row, because it came from
the owner, and it settles only the decision it names, never a neighbour by
analogy. A line naming no existing decision is reported in the PR body and
otherwise ignored. An answer settles a decision; it never stands in for the
explicit confirmation a Hard-Floor action needs.
