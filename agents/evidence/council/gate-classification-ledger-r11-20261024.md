<!-- evidence-type: analysis -->

# A sample cannot prove a universal; the complete reconciliation can

AI council, 2026-10-24, the sixteenth round that day. anthropic/claude-sonnet-4-5
+ openai/codex-default, design mode, 2 rounds with peer review, CLI transport,
`$0.00`, **2/2 present**. The prompt is committed verbatim beside this file as
`gate-classification-ledger-r11-20261024.question.md`.

## Verdict: convergent — not closed, one missing item, not owner-reserved

- anthropic: Q3 *no* (high confidence).
- openai: Q3 *no* (very high confidence).

Both seats name the same single missing item: **a complete, independently
reproducible inventory-to-ledger reconciliation**. It must give, per check,
the population, the named modes, exactly one class per aspect, no unexplained
`op:*` substitution, revision identifiers and machine-produced totals. Both say
it is **not owner-reserved**. openai adds: *"Second-principal approval may
authorize later reliance, but approval cannot replace missing evidence."*

The asking agent's prompt for this round left out the reconciler's output and
sent only the six-row sample. The seats could judge only what they were shown.

## Spot-check, Q1

openai, row by row: **R4.a matches**. R1.a, R5.a, R10.l, R12.c and R16.c
**cannot be told**: the excerpts lack the helpers that decide applicability.
anthropic agrees that only R4.a is demonstrated. It is recorded as 1 supported
and 5 inconclusive, not as a 6/6 match.

## Q2

- **Disagreements:** adequate as a disposition index. Publish the full
  rationales, which the table truncated, and the enforcement output.
- **Owner:** inadequate for both seats. *"The agent lane holding this roadmap's
  claim"* is transient workflow state. They want a durable role with a
  deputy, a transfer protocol, an unavailability fallback, a deadline and an
  escalation path. This belongs to 7.2 reliance, not 7.1 closure. Naming a
  durable accountable party for a governance gate is the authority question the
  owner-reserved blocker `external-bootstrap-boundary-for-phases-2-3` holds.
  It is carried there.
- **Independence:** procedural, not technical. Preserve the independent
  reviewer's own artefact. It already is preserved:
  `agents/evidence/analysis/gate-branch-mapping-review-20261024.json`.

## Applied in revision 12

- `gate-ledger-reconcile.mjs --matrix` prints the complete reconciliation. Its
  header gives the HEAD revision and the git blob of every input. It prints
  one row per Phase 7 check and exits 0 only on a full pass. Each row shows:
  - the binding aspect ids and classes;
  - the excluded ids;
  - the branch total;
  - the branches that map to rows and those in each `op:*` category;
  - the independent review counts.
- The ledger states that classes attach to aspects only, and `op:*` to
  branches only, so an `op:*` value never stands in for a class.
- The full reviewer rationales are referenced in the reviewer's unedited file.
- The spot-check result is recorded as it came out.
