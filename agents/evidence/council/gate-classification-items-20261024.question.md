<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-first round that day),
     committed verbatim. The closure standard is fixed by the owner; this round
     verifies its items. The asking agent wrote the tooling it describes. -->

# Step 7.1: are acceptance items 1 and 4–8 met?

You are verifying step 7.1 of an internal governance roadmap against an
acceptance standard that is already fixed. Answer on the evidence below. Where
a fact is missing, say so. The asking agent wrote the ledger and every script
below. Treat its work with suspicion.

## The fixed standard

The previous round, yours, proposed eight acceptance items. The seats then
split on whether the choice between two closure standards was owner-reserved.

- **Option A:** classification plus a fail-closed consumption gate and
  reopening triggers.
- **Option B:** an upfront completeness proof.

The repository owner answered "1" on 2026-10-24, which is **Option A**. Under
it, items 2 and 3 (a 330-row manifest and a 330→16 re-derivation) are **not
required**. Items 1 and 4–8 are:

1. the execution universe and red predicate, recorded and executable;
4. class predicates, mutually exclusive or with precedence, each aspect
   satisfying its predicate;
5. a bounded emission inventory over a declared surface, zero unexplained
   sites, a mutation per supported type, dynamic and external surfaces
   dispositioned;
6. provenance: what was independently derived and what was rerun;
7. validity, quarantine and reopening rules that are machine-detectable;
8. a consumption contract that 7.2 can evaluate mechanically.

This round does not reopen the choice of standard.

## The evidence, verbatim from the ledger

**Item 1 — the execution universe and the red predicate, recorded and
executable.** `agents/evidence/analysis/gate-phase7-harness.mjs`:

- **Discovery.** Every `src/scripts/check_*.ts` and `lint_*.ts` at a
  revision. `--universe bbe5b73be` lists **330**, the Phase 7 count.
- **Invocation.** `./scripts-run src/scripts/<id>`, no arguments, from the
  repository root, with a 240 s timeout.
- **Predicate.** Decision order, first match wins:
  1. no exit code (spawn failure or timeout) → `not-run`, never green;
  2. exit 0 → `green`;
  3. exit 2 with a usage line → `needs-argument`;
  4. a missing generated projection (`dist/`, `.claude/`, `.augment/`) →
     `needs-build`;
  5. otherwise → `red`.
- **Prerequisite.** Projections built, as in the Phase 7 measurement.

Exercised on three checks today: `lint_readme_serial_comma` green,
`check_composite_arming` red, `lint_subagent_determinism` green. The two
exclusion branches of the predicate were not exercised in this run.

**Item 4 — class predicates, mutually exclusive by decision order.** For one
aspect under one mode, the first rule that holds gives the class:

1. **observation.** The aspect's own contract leaves the run non-blocking:
   exit 0, *"not a failure"*, *"never a build failure"*.
2. **tolerance.** A stated bound, a named risk owner and an expiry.
3. **snapshot.** Compared against a recorded baseline that a governed act
   may move in the permissive direction.
4. **invariant.** None of the above: the property must hold whenever the
   aspect applies.

The reconciler checks each row's own evidence cell against its class: an
observation must state its non-blocking contract, a tolerance its bound, owner
and expiry, a snapshot its baseline. Ambiguity fails the run and never
defaults to a class (self-test case: an observation row with the exit-0
contract removed is refused).

Formalising the predicates found one misclassification. **`R10.d`, C3 live
URL, was an observation; it is now an invariant in `--check-urls` mode.** With
the flag, an unreachable URL is an error and the run exits 1. Network
dependence is an environment property (assurance: environment-dependent), not
a non-blocking contract.

**Item 5 — a bounded emission inventory over a declared surface.**
`gate-branch-sites.mjs` declares:

- **Surface.** The 16 checks' own source text.
- **Vocabulary.** A non-zero `return`, `process.exit(n)`,
  `process.exitCode = n`, `throw`, and `push` into a reported list.
- **Excluded surfaces.** Imported helpers: each helper failure a check can
  surface is an inventoried branch naming the helper, and the closure is
  pinned. Spawned subprocesses (`git`, `node`): their failures reach a check
  only through the branches that handle them.

Result: 159 sites, 132 inside inventoried branches, 27 disposed, 0
undisposed. `--self-test` plants one site of each of the five types and
requires each to be refused (6/6). `process.exitCode = main()` in
`check_gate_completeness` is not a literal, and its values are the `return`
sites of `main`, which are covered.

**Item 6 — provenance: what was derived independently, and what was rerun.**

| Artefact | Produced by | Independent of the ledger author? |
|---|---|---|
| Phase 7 population (16 of 330) | the 2026-10-10 measurement and council record, landed in `7a7a55b2` | yes, an earlier round; checked against git |
| branch inventory (198 branches) | a separate session, without sight of the ledger | yes (same model, not another provider) |
| mapping review (182/12/4) | a separate session | yes (same model) |
| site scan (159 sites) | `gate-branch-sites.mjs`, no model | mechanical; vocabulary chosen by the ledger author |
| ledger, mapping, dispositions, reconciler, harness | the ledger author | no |
| two clean-checkout reruns | a separate session | *reruns*: they prove determinism, not independent derivation |

**Item 7 — validity, quarantine and reopening.** `gate-ledger-reconcile.mjs`
returns one of three states:

- **valid** (exit 0): every check passes.
- **quarantined** (exit 3): the only failures are stale pins. A source,
  helper, wiring file, artefact or ledger-table change was not yet
  re-attested. The record is not consumable, and 7.1 is not reopened.
- **invalid** (exit 1): any other failure, such as an omitted or unmapped
  branch, a review verdict not honoured, a class predicate violated, or an
  undisposed site. **7.1 reopens.**

A demonstrated misclassification, omission or coverage defect in the
declared surface reopens 7.1. Proposing another analysis technique does
neither. Self-test: a stale pin yields `quarantined`; a laundered mapping
yields `invalid`.

**Item 8 — the 7.1 consumption contract.**
`node agents/evidence/analysis/gate-ledger-reconcile.mjs --status` prints
JSON. The fields are the record path, the ledger blob, the artefact, the scope
(Phase 7 commit, checks, binding aspects, branches, classes), `state`,
`reasons` and `consumable`. Its exit code is 0, 3 or 1. 7.2 consumes the
ledger **only** when the run on the candidate merge result reports
`consumable: true`. Gate membership stays outside 7.1.

## Verbatim tool output at commit `a7a07662ff`

```text
$ node agents/evidence/analysis/gate-phase7-harness.mjs --universe bbe5b73be | tail -1
# 330 scripts at bbe5b73be
$ node agents/evidence/analysis/gate-branch-sites.mjs --self-test
ok   baseline is clean
ok   a planted return-nonzero site is refused
ok   a planted exit-nonzero site is refused
ok   a planted exit-code site is refused
ok   a planted throw site is refused
ok   a planted push-finding site is refused

self-test: 6/6 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test
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
ok   a line of the committed branch reconciliation is edited
ok   the mechanical site scanner finds an undisposed site
ok   a stale pin quarantines rather than invalidates
ok   a laundered mapping invalidates
ok   an observation row without a non-blocking contract
ok   an unknown flag appears in a check

self-test: 16/16 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --status
{
  "record": "agents/evidence/analysis/gate-classification-ledger-20261024.md",
  "ledgerBlob": "393218aa178e36d2fae97fb833b0d32144c273bd",
  "artefact": "agents/evidence/analysis/gate-branch-reconciliation-20261024.md",
  "scope": {
    "phase7Commit": "bbe5b73be4f06faa528d494a271d2c8b21e28bb2",
    "checks": 16,
    "bindingAspects": 49,
    "branches": 198,
    "classes": {
      "invariant": 42,
      "snapshot": 0,
      "tolerance": 0,
      "observation": 7
    }
  },
  "state": "valid",
  "reasons": [],
  "consumable": true
}
```

## Questions

**Q1.** For each of items 1, 4, 5, 6, 7 and 8, answer *met* or *not met*. For
any *not met*, name the concrete shortfall against that item's own pass
condition, not a new requirement.

**Q2.** If all six are met, is 7.1 closed under the owner's standard? Answer
yes or no.

Give your confidence.
