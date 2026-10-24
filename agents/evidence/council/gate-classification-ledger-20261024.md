<!-- evidence-type: analysis -->

# The ledger is close; five rows were wrong or bundled

AI council, 2026-10-24, the seventh round that day. anthropic/claude-sonnet-4-5 +
openai/codex-default, 2/2 present, 2 rounds with peer review, design mode, CLI
transport, `$0.00`, no chairman synthesis. The prompt is committed verbatim
beside this file as `gate-classification-ledger-20261024.question.md`. It asked
for a verdict per row of revision 1 of
`agents/evidence/analysis/gate-classification-ledger-20261024.md`.

## Verdict: convergent — closure rejected, the corrections named

- anthropic: *"Reject closure. Require row 1 reclassification + row 10 split +
  row 16 split before Step 7.2 touches gate behavior."* High confidence.
- openai: *"reject closure of Step 7.1 for now; revise the five identified
  areas, add rollback criteria, then permit narrowly scoped Step 7.2
  demotions."* High confidence.

Both reject the literal reading of the exit criterion. Under it, any one
classified aspect would count for its check and could hide that check's other,
unresolved aspects. The binding one-row-per-aspect ruling forbids bundling
whenever bundling is convenient.

## Q1 — agreed per row

Both seats agree with revision 1 on rows 1 (marker, scope), 2, 3, 4, 5, 6, 7,
8 (structure), 13, 14 and 15. Three of these carry a qualification, all
carried:

- row 3 has weak independence;
- row 5 leaves its clock, time zone and future dates unspecified;
- row 7 proves the declaration only.

Corrections both seats require:

1. **Row 1's adoption ratchet is an invariant, not a snapshot.** "May only go
   down" is binding. A file being technically editable is not an authorised
   upward refresh. anthropic: *"Classifying row 1 as snapshot chooses the
   second without stating that choice."* The second meaning here is a
   council-managed policy rather than a floor.
2. **Row 10 is split per check.** C1–C5 mixes local, git-dependent and
   network-dependent checks.
3. **Row 16 separates missing, malformed and insufficient evidence.** Absence
   may be `not-evaluated`. A corrupt store is a broken input contract and stays
   blocking.
4. **Rows 9 and 12 are a measurement-scope defect, not an applicability note.**
   Scanning the disk makes the same commit pass or fail depending on untracked
   local files. The canonical scope is tracked files, and a local-hygiene
   reading would be separate.
5. **Row 11's warnings must be named** (openai), and row 8's coverage
   classification holds only in its default invocation mode (openai).

## Q2 — the unresolved questions

- Rows 9 and 12: scope to tracked files, plus staged additions. Both seats.
- The composite store: valid but insufficient → exit 0, observation; absent
  before a bootstrap deadline → `not-evaluated`; absent after it, or malformed
  → failure. The deadline is an open policy value. openai: *"currently disguised
  as an implementation discrepancy."*
- Refresh authority: **no provisional upward-refresh rule**. The list stays
  shrink-only until the owner-reserved second principal approves who may raise
  it, why, with what evidence, by how much, until when, and how the act is
  recorded. Both seats.

## Q3 — not closed until the corrections land

Both seats require revision 2 before closure.

## Q4 — what 7.2 may do

**May proceed now:**
- keep the required, uncontested invariants;
- record the classification;
- split the composite outcomes;
- define the deterministic scope;
- inventory every invocation mode and downstream consumer.

**May proceed after the corrected record:** demoting an observation aspect
whose whole invocation contract is non-blocking. Each demotion records:
- old and new behaviour;
- the reason;
- the consumers;
- a rollback condition.

openai adds the requirements for any demotion:
- a reversible per-check switch;
- a shadow period;
- rollback triggers;
- the old exit behaviour preserved until the consumers are inventoried.

**Owner-reserved:**
- any authority to raise the gate-completeness baseline;
- any exception weakening a shrink-only list;
- promotion into a governed registry.

## Hardest pushbacks

- anthropic: row 1, for the reasons above.
- openai: source-owned prose is not independent evidence. Producer and policy
  share one edit authority, so *"producer proves"* becomes *"producer
  computes"*. Applied in revision 2.
