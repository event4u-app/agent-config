---
complexity: lightweight
review_by: 2026-12-08
---

# Stub: road to ingesting the 14.22.0 self-review findings

> **Stub — not active work.** Found 2026-09-08 while settling CI on
> `drain/graph-shipped-close`, an unrelated code-graph delivery branch.
> `Sync + Generate Tools Consistency` reds with
> `14.22.0 has shipped and carries no findings ledger at
> agents/evidence/release-findings/14.22.0.json` <!-- ref-ignore -->
> (`check_finding_dispositions.ts`). The same job is already `failure` on `main`
> at `2cc536be2`, so this is inherited rather than introduced — recorded here
> rather than repaired drive-by, for the reason in § Why not fixed in place.

## The sibling, and what it establishes

`road-to-the-14-21-0-findings-ledger.md` is this stub's immediate predecessor,
created 2026-09-07 on the same discovery from the same job. Its item 1 has since
happened: `agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore -->
exists in the tree and carries a real finding set. So the ingest path WORKS when
someone runs it, and this is the second consecutive release whose findings were
produced and not ingested. Two in a row is a pattern in the RELEASE FLOW rather
than an accident: the gate now succeeds, and nothing in the flow ingests what it
produced.

That sibling is left untouched here. Its own closure conditions are partly met
and re-reading them is its owner's, not this stub's.

## The artifact exists — this is ingestible, not absent

Measured 2026-09-08:

- `Self-review gate` on `release: 14.22.0` — run `34214806821` — concluded
  **success**. Both jobs (`live-advisory`, `gate-dry-run`) succeeded.
- It uploaded artifact `10051643231`, `self-review-findings` (16,863 B
  compressed / 48,352 B).
- The artifact holds **56 findings**: **3 critical**, **12 high**, 27 medium,
  14 low. Coverage is complete on its own terms — 6 chunks, 253 of 253 files
  reviewed, `unreviewed: []`.
- Independence: `single-member`, `context_relation: unknown`,
  `acceptance_status: provisional`, `assurance: single-pass`, reviewer
  `anthropic`.

**Five of the critical/high findings name security surfaces**, and one of them
lands on the branch that found this stub's trigger:

- critical — *Self-review gate has reviewed nothing for four consecutive
  releases* (the same finding the 14.21.0 ledger already carries; it recurs
  because nothing closed it).
- critical — *ADR-262 deletes `status: carrier` without migrating enforcement*.
- critical — *Vendored grammars added without supply-chain verification
  surface* — this is `road-to-a-graph-that-is-shipped` Phase 0.1's own payload,
  and it is named here rather than left for the reader to notice, because the
  branch that discovered this stub is the same roadmap's continuation.
- high — *Binary eligibility check bypassed via unchecked destination in
  projection*.
- high — *Packed binary predicate accepts mutation testing without integrity
  verification in production path*.

## Why not fixed in place

Writing the ledger means **dispositioning 56 findings**, three of them critical
and five of them security items, against a release this session did not produce
and has not reviewed. Every blocking/high finding needs a complete disposition
(`status: fixed|false_positive|accepted_risk`, `commit` when fixed, `rationale`,
`verified_by`) or the gate stays red — so `--ingest` alone converts
red-for-absence into red-for-pending-dispositions and closes nothing.

A fast disposition would be a fabricated one, which is the failure
`evaluator-independence` exists to stop. And an empty ledger with a
`no_findings_reason` would assert the opposite of what run `34214806821`
measured.

The one finding this branch is positioned to speak to — the vendored-grammar
supply-chain surface — is still a judgement about a change already on `main`
under an owner-directed ADR (ADR-259), not a wiring fix, so it is named here
rather than dispositioned by a run that did not make that decision.

## What closes this

1. Ingest the artifact into
   `agents/evidence/release-findings/14.22.0.json` <!-- ref-ignore -->:
   `./scripts-run src/scripts/check_finding_dispositions --ingest <findings.json> --release 14.22.0`
   (schema: the 14.21.0 file). The artifact is `10051643231` on run
   `34214806821`; download with
   `gh api repos/event4u-app/agent-config/actions/artifacts/10051643231/zip`.
2. Disposition each finding — fixed / false_positive / accepted_risk — with the
   three `critical` items and the two `high` security items reaching a human
   before any of them is accepted as risk.
3. Re-run `check_finding_dispositions`; `Consistency` goes green on `main` and on
   every branch inheriting it.
4. **Fix the flow, not only this release.** Two consecutive releases produced
   findings that were never ingested, so a third will too. Either the release
   workflow ingests its own artifact before the release merges, or the gate names
   the un-ingested artifact by id so the next reader does not have to find it —
   which is what this stub had to do by hand.

## Evidence

- Run `34214806821` (`Self-review gate`, `release: 14.22.0`, success), artifact
  `10051643231`.
- `gh run list --branch main` at `2cc536be2`: `Consistency` = `failure`.
- Job `102033617498` on PR #1945: the failing step is
  `Shipped version carries a findings ledger`.
- `agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore --> — the
  schema, and the sibling that shows the ingest works.

## Promotion criterion

None to promote — there are no steps here that an agent may take. It is closed
by a human dispositioning the finding set, and deleted when
`agents/evidence/release-findings/14.22.0.json` <!-- ref-ignore --> exists and
`check_finding_dispositions --release 14.22.0` exits 0.
