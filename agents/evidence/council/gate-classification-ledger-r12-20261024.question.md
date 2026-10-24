<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (seventeenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger,
     the mapping and the reconciler. -->

# Step 7.1: is this the complete, reproducible reconciliation the last round named, and is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so.

The asking agent wrote the ledger, the branch-to-row mapping and the
reconciler. Separate sessions of the same model wrote two inputs: the branch
inventory, without sight of the ledger, and the mapping review. Treat the
asking agent's work with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

A classification attaches to one currently implemented **assertion (a ledger
aspect)** under one named invocation mode. A check is classified when every
one of its binding aspects carries a class.

The last round was 2/2 and convergent. It said no and named the single missing
item, not owner-reserved:

> a complete, independently reproducible inventory-to-ledger reconciliation
> showing the immutable Phase 7 population, each assertion's named mode,
> exactly one classification, no omissions, duplicates or unexplained `op:*`
> substitutions, and inventory and ledger revision identifiers plus
> machine-produced totals.

The pin-renewal owner question for step 7.2 is out of scope here. It goes to an
owner-reserved blocker.

## How the population is fixed

The Phase 7 population is the 16-check table of a council record, measured on
a clean `origin/main` worktree at `bbe5b73be4f06faa528d494a271d2c8b21e28bb2`
and committed in `7a7a55b2d8947d2c2e26ff59862bc8e9fac3f573`. On every run the
reconciler checks three things:

- the record equals the version that landed;
- each of its 16 checks existed at the measured commit;
- each still exists under the same path, so none was renamed or removed.

## The categories for branches that assert nothing, verbatim from the mapping file

- `op:usage`: help or a bad argument; no assertion
- `op:could-not-run`: the check could not measure (dead scope, unreadable input, helper or runtime throw); not a pass
- `op:aggregate`: the exit decision over findings already mapped
- `op:informational`: a printed line that asserts nothing
- `op:write`: a write mode that asserts nothing
- `op:presentation`: output only
- `op:silent-pass`: exits 0 without measuring anything; recorded as a finding, not a class
- `op:unreachable`: unreachable as written
- `op:scope-exclusion`: a target outside the check's declared scope, skipped by construction; not a run-level silent pass

Classes attach to aspects only. `op:*` categories attach to branches only, and
they say why a code path asserts nothing. An `op:*` value never stands in for an
aspect's class.

## The reconciliation, verbatim output of `node agents/evidence/analysis/gate-ledger-reconcile.mjs --matrix`

```text
revision: HEAD df534b9b1a821d8a52cff733b7fff94e84037c5b
input: agents/evidence/council/live-tree-check-classification-20261010.md blob 3363cd91745a7bdd5370693a4e0a0129802bd620
input: agents/evidence/analysis/gate-classification-ledger-20261024.md blob 167a4f6af2761791df8e0980524122ad3843f082
input: agents/evidence/analysis/gate-invocation-inventory-20261024.md blob 1f3ff61036ccbd9ba42f9acd4eec5b5c2697b4f9
input: agents/evidence/analysis/gate-branch-inventory-20261024.json blob 119214ea142393c7254cae40e080153728e10fb0
input: agents/evidence/analysis/gate-branch-mapping-20261024.json blob c296fd9f02c1f0e83688da3f596cbb19e079665e
input: agents/evidence/analysis/gate-branch-mapping-review-20261024.json blob 46227ecdae464df420e5aec60910a1b7a497e686

| # | Phase 7 check | Binding aspects and class | Not binding | Branches | → rows | → non-assertion categories | Review: agree / disagree adopted / unsure resolved |
|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | R1.a invariant, R1.b invariant | R1.c | 13 | 5 | could-not-run 5, informational 3 | 12 / 1 adopted / 0 resolved |
| 2 | `lint_ticked_unmet_criteria` | R2.a invariant, R2.b invariant | — | 9 | 4 | usage 3, informational 1, unreachable 1 | 7 / 1 adopted / 1 resolved |
| 3 | `check_rule_invariants` | R3.a invariant, R3.b invariant | — | 15 | 3 | usage 3, could-not-run 9 | 10 / 5 adopted / 0 resolved |
| 4 | `check_augment_description_cap` | R4.a invariant | — | 3 | 1 | could-not-run 1, silent-pass 1 | 3 / 0 adopted / 0 resolved |
| 5 | `check_trigger_evals` | R5.a invariant, R5.b invariant | — | 19 | 10 | usage 4, could-not-run 3, informational 1, aggregate 1 | 18 / 0 adopted / 1 resolved |
| 6 | `lint_subagent_determinism` | R6.a invariant | — | 10 | 6 | could-not-run 3, aggregate 1 | 10 / 0 adopted / 0 resolved |
| 7 | `lint_rule_enforcement_declaration` | R7.a invariant, R7.b invariant | — | 13 | 5 | could-not-run 6, write 1, informational 1 | 13 / 0 adopted / 0 resolved |
| 8 | `check_token_quality_golden` | R8.a invariant, R8.b observation, R8.c invariant | — | 28 | 17 | usage 3, could-not-run 7, aggregate 1 | 27 / 1 adopted / 0 resolved |
| 9 | `check_council_layout` | R9.a invariant | R9.b | 5 | 2 | could-not-run 2, aggregate 1 | 5 / 0 adopted / 0 resolved |
| 10 | `check_knowledge_cards` | R10.a invariant, R10.b invariant, R10.c invariant, R10.d observation, R10.e invariant, R10.f invariant, R10.g invariant, R10.h observation, R10.i invariant, R10.k invariant, R10.l invariant, R10.m invariant, R10.n invariant, R10.o invariant, R10.j invariant | — | 35 | 22 | usage 4, silent-pass 3, could-not-run 4, informational 1, aggregate 1 | 35 / 0 adopted / 0 resolved |
| 11 | `check_public_links` | R11.a invariant, R11.b invariant, R11.c invariant, R11.d invariant, R11.e observation, R11.f invariant, R11.g invariant | — | 14 | 6 | usage 2, could-not-run 3, presentation 1, scope-exclusion 1, aggregate 1 | 13 / 0 adopted / 1 resolved |
| 12 | `lint_agents_layout` | R12.a invariant, R12.c observation, R12.d invariant | R12.b | 5 | 3 | could-not-run 2 | 5 / 0 adopted / 0 resolved |
| 13 | `lint_eval_freshness` | R13.a invariant | — | 8 | 3 | usage 2, could-not-run 2, aggregate 1 | 7 / 0 adopted / 1 resolved |
| 14 | `lint_readme_jargon` | R14.a invariant | — | 3 | 1 | could-not-run 2 | 3 / 0 adopted / 0 resolved |
| 15 | `lint_readme_serial_comma` | R15.a invariant | — | 3 | 1 | could-not-run 2 | 3 / 0 adopted / 0 resolved |
| 16 | `check_composite_arming` | R16.a observation, R16.b invariant, R16.c observation, R16.d observation, R16.e invariant | — | 15 | 8 | usage 1, could-not-run 5, write 1 | 11 / 4 adopted / 0 resolved |

reconciliation: OK
```

## The full run and the reconciler's mutation self-test, verbatim

```text
Phase 7 manifest: 16 checks, record and paths verified against git
independent mapping review: {"disagree":12,"agree":182,"unsure":4}
branches 198 · mapped to rows 97 · {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · binding rows reached 49/49
rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}
pins: 27 files, 51-file helper closure, ledger table

OK: the Phase 7 manifest matches its landed record and git history; the ledger, the invocation inventory and the manifest name the same 16 checks; every binding aspect carries one of the four classes; every assertion-changing flag is named; every branch of the independent inventory maps to a binding row or a declared category and every binding row is reached; every independent review verdict is honoured; every pin is current.

ok   baseline is clean
ok   a Phase 7 check is dropped from the ledger
ok   the Phase 7 record is altered
ok   an unsure review verdict loses its resolution
ok   a reviewed row branch is laundered into a category
ok   a review disagreement is reverted
ok   a pinned source changes
ok   a helper on the closure changes
ok   a row's applicability is edited after review
ok   a branch is mapped to the withdrawn row
ok   an unknown flag appears in a check

self-test: 11/11 case(s) behaved
```

## Questions

**Q1.** Is this the reconciliation the last round named? Name anything it
still lacks: an omission, a duplicate, an unexplained `op:*` assignment, a
missing revision id, or a total not machine-produced.

**Q2.** With this recorded as 7.1's verdict, is the exit criterion met? Answer
yes or no. If no, name the single thing still missing and whether only the
owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
