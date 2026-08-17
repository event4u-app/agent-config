# Findings: fix-legal-safety-floor-retraction

<!-- evidence-type: v1 | type: declared-skip | declared: 2026-08-17 -->

**Skipped:** no code surface for this completion — retracts a false claim from three prose artefacts and adds a verified prospect note to a sibling roadmap; the gate itself measures 0 code paths of 3 changed files, scope ec4aaa6b461f00b95dca2f600dc6269a46d9fc30c25716cc8893272b7529e75f, declared 2026-08-17

## What was retracted, and on what evidence

Phase 0.3 of `road-to-rule-stub-projection` (merged in PR #1403) reported
`legal-safety-floor` as a contradiction: recorded `keep` in the closed
disposition register while carrying a migration pointer. That claim is **false**.
Three independent pieces of evidence, each sufficient on its own:

1. **The register defines `keep` against `digest`, not against having been
   migrated.** Its own vocabulary section reads *"`keep` therefore means: stays
   always-on and monolithic, deliberately, with a named reason. It is not a
   deferral and not a pending item."* The alternative it rules out is demotion to
   a shared always-on digest with the body set `type: manual` — which would strip
   an enforcement surface out of context. It says nothing about a migration that
   already happened.
2. **The row describes the post-migration rule.** It records `body_lines: 139`,
   which is the file's size today. The migration landed 2026-07-11 (`6ef4102d6`,
   *"thin-stub the five heaviest auto-rules"*); the residue was measured
   2026-08-09. There was never a moment when the two statements described the same
   body.
3. **The inventory that produced the classification says so outright.**
   `docs/guidelines/agent-infra/rule-body-migration-inventory.md` classes it
   `stay` *because* of the migration: *"already the best existing exemplar of the
   P4 pattern applied within a safety floor (5 Iron Laws kept inline, all
   operating mechanics migrated to `skill:legal-practice-profile`); a template for
   the other 6 safety floors below, none of which do this yet."*

## The replacement finding, verified

The same inventory names `legal-safety-floor` as the **template** for six sibling
safety floors that have not had the treatment: `finance-safety-floor`,
`strategy-safety-floor`, `engineering-safety-floor`, `domain-safety-disclaimer`,
`domain-safety-pii`, `domain-safety-retention`.

Checked against the tree rather than quoted: `grep -ciE 'migrated to|merged into'`
returns **0** for all six, and none has a file under
`agents/decisions/rule-migrations/`. So none is in the stub-ceiling gate's
population, and the Phase-0 residue table is a **floor** on the available residue
rather than a survey of it — which is now stated where that table was handed over,
in `road-to-standing-context-40k` step 2.1.

## Why the false positive happened

The reconciliation compared two **labels** — "has a pointer" against "`keep`" —
and inferred a contradiction from their plain-English connotations, without
opening the register's definition section, which sits ~280 lines above the row it
read. A label is not a definition.

Recorded rather than quietly corrected because the mechanism recurs: the same
shape produced the three roadmap-prose claims the Phase-0 artefact already
corrects, and it is the cheapest possible check to have skipped.

## Why this is not a twentieth row on the merged review

The R2 reviewer never made this observation. Adding it to
`feat-rule-stub-projection.findings.md` would backdate an observation nobody
made, which is precisely the forgery the findings-before-fixes ordering exists to
prevent. That artefact is restored to the exact state it merged in.
