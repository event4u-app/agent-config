# Completion review — skipped-parent lineage record and kernel-decisions brief

**Skipped:** no code surface for this completion — the diff is two analysis artefacts under `agents/evidence/analysis/`, two marker/pointer corrections in draft roadmaps, and this artefact, and the gate measures zero code paths of four changed files, scope 3f38883a3dca3fc5a70c0d78693893cae9b192468e04b2ce9b88188a3cd6c289, declared 2026-08-26

## Why a skip rather than a review

Nothing in this change executes. No function, no gate, no schema, no generated
tree. The two new files are analysis artefacts; the two roadmap edits are a
corrected provenance marker and four pointer clauses. Both roadmaps remain
`status: draft`, so nothing here enters the dashboard, `/roadmap:process-*`, or
the archival sweep.

## What was verified instead

The load-bearing risk is a wrong citation, since both artefacts exist to make
claims checkable. Every assertion was re-run against the tree:

- **Pins computed twice independently and matched** —
  `5a2a0a19…ffb004` / 1925 lines and `24e12ce6…b74d4a` / 2728 lines.
- **The residual was verified against BOTH merged roadmaps, not one each.** A
  first pass checked each parent only against its own descendant, which would
  have let an item carried by the sibling read as residual. Re-run both
  directions: zero matches, with one apparent hit that is a same-named mechanism
  and is discussed as such.
- **E7's greenfield finding** — `grep -rniE '\bhold[ -]?out\b' src/ docs/contracts/`
  returns three advisory-prose hits in product-strategy skills; a fourth apparent
  hit was `Thres·holdOut·come` at `eval_publication.ts:302`. No holdout
  machinery exists.
- **E6's carrier claim** — `artifact-engagement-flow.md:32-33` verbatim.
- **E8's collapse** — `no-runtime-boundary.md:40` state-store test against
  ADR-124 Class A (`:110`) and Class C (`:170-177`).
- **E4/E9 coupling** — Phase 1's exit criterion read verbatim at `:169-170`.
- **Step 7.4's marker** — the clause located at
  `road-to-evidence-driven-harness-evolution.md:1200-1201`, and the skipped
  parent confirmed to contain no no-op gate by a negative grep over
  `no-op|material improvement|semantic duplicate|paraphrase`.

## A correction inside this change worth recording

A subagent resolved step 7.4's unattributed marker to the skipped parent's
`:1342` ("Avoid five paraphrases"). That is the only lexical neighbour in the
file and it governs candidate diversity at generation time, not promotion. Taking
the nearest match for the source is the exact error the lineage record exists to
prevent, so the resolution was rejected and the real source found in a declared
parent. It is recorded because the subagent's own report was otherwise accurate,
and a report that is right about forty things and wrong about one is the hard case.

## Gates run

`check_references` (1693 scanned, none broken) · `check_md_language` on all four
touched files · `lint_roadmap_blockers` (12 clean, decidability 0) ·
`lint_plan_risk_register` · `lint_roadmap_complexity` (12 clean) ·
`lint_evidence_artifacts` (2 added, typed) · `check_estate_count`
(`+0 active / -0 disposed` — evidence artefacts do not move the roadmap estate).

## What this skip does not cover

Neither artefact decides anything. The kernel decisions E4/E6/E7/E8/E9 remain
open and every recommendation in the brief is advisory; the residual items in the
lineage record are candidates for disposal, not adoptions.
