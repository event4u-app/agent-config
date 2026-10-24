<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (tenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger. -->

# Step 7.1: does revision 4's governing definition meet the condition the closure round set?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The agent asking you wrote the
ledger, so treat its framing with suspicion.

## Background

Step 7.1's exit criterion: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four permitted classes are
invariant, snapshot, tolerance and observation.

The previous round reviewed revision 3 of a 37-row ledger over 16 checks.

- One seat answered: yes, close 7.1 narrowly, and record revision 3 as the
  verdict. Before 7.2 changes enforcement, define the classified unit and
  separate binding current classifications from non-binding target-state
  notes.
- The other seat answered: conditional closure. Revision 3 is recorded only
  after one clarification: whether the ledger is descriptive (current
  behaviour) or prescriptive (desired contract), with consistency forced. If
  prescriptive, every divergence between class and current behaviour must be
  marked, and 7.2 blocked from acting on it.

Both seats blocked 7.2 enforcement changes until four things exist:

- the consumer inventory;
- a current-versus-intended reconciliation;
- a canonical scope decision for two checks;
- rollback mechanics.

## What revision 4 added, verbatim

## The governing definition — revision 4

Both seats of the closure round on revision 3 (D33) asked for this before the
verdict is relied on. anthropic made it the condition of acceptance. It binds
every row below:

> **A classification attaches to one currently implemented assertion under one
> explicitly named invocation mode. It is semantic: it states what the
> assertion means, independent of the exit status the script happens to return
> today. Current enforcement is recorded separately, in the next section.
> Proposed behaviour is non-binding migration metadata and is excluded from the
> closure totals.**

The definition has three consequences:

- the two *target* rows of checks 9 and 12 are migration notes, not
  classifications;
- row 16's *store absent* is an observation by its own contract, while its
  current exit 1 is a recorded divergence, not part of the class;
- the mode-qualified rows of checks 8, 10 and 11 classify the assertion in that
  mode only.

**Which checks.** The population is the 16 checks the 2026-10-10 round measured
red or classified on a clean `origin/main` worktree. Its record is
`agents/evidence/council/live-tree-check-classification-20261010.md`, and the
same 16 are re-listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. That record is
the Phase 7 start inventory openai asked to have cited.

## Current enforcement, recorded separately

From `agents/evidence/analysis/gate-invocation-inventory-20261024.md`:

- eight checks block the required `Standing payload delta + budget gate` context
  in their default mode (rows 4, 6, 8, 9, 10, 11, 14, 15);
- seven block only the local `task ci` chain or the non-required
  `Rule backstops` (rows 1, 2, 3, 5, 7, 12, 13);
- `check_composite_arming` blocks nothing, because its store run is
  `continue-on-error: true`.

No observation aspect blocks at any caller found. Semantic class and current
exit behaviour diverge in **one** place: row 16, *store absent*, exits 1. The
divergence is recorded here and is not a reclassification.

## Assurance level of each invariant

The four classes do not change, but *invariant* covers three different
guarantees (openai), so each invariant row carries one of these qualifiers:

- **repository-consistency**: the check compares the tree against an
  expectation the same authority can edit in the same change. These are row 1's
  ratchet, row 2, row 3 and row 7. They are consistency checks, not
  independently anchored invariants (anthropic).
- **environment-dependent**:
  - row 5 freshness (runner clock and time zone);
  - the current-scope rows of checks 9 and 12 (the disk);
  - row 10 C5 (git history depth).
- **fixed-policy**: every other invariant row.

## Totals — revision 4

37 aspect rows over 16 checks. Under the governing definition, the two target-scope rows are migration notes, so **35 classified aspects**, every one in one of the four classes:

- **invariant 29**, after excluding the two target-scope migration notes from the 31 invariant rows:
  - three hold only in a named invocation mode: `--require-complete`, and `--strict` on two checks;
  - one is time-qualified;
  - the two target-scope rows of checks 9 and 12 are **not** counted. The current-scope rows beside them carry the classification.
- **observation 6**:
  - token-golden default coverage;
  - C3 live URL;
  - card freshness;
  - the beta marker in default mode;
  - composite arming;
  - composite store absent.
- **snapshot 0**.
- **tolerance 0**.

No aspect carries a value outside the four classes. Runtime metadata such as `not-evaluated: evidence-missing` is stated next to a class, never in place of one. Every one of the 16 checks carries at least one classified aspect.

The three D14 abstentions are resolved as follows:

- `check_council_layout`: an invariant over the disk scope it measures today;
- `check_knowledge_cards`: eight aspects, of which six are invariants and two are observations;
- `check_composite_arming`: two observations and one invariant.


The 37 rows themselves are unchanged from revision 3. Two of them, the
"target" index-scope rows of checks 9 and 12, are now excluded from the totals
as migration notes.

## Questions

**Q1.** Does the governing definition, together with the separate
current-enforcement record, meet the condition the previous round set? If not,
say exactly what is missing.

**Q2.** With revision 4 recorded as the verdict, is 7.1's exit criterion met?
Answer yes or no.

Answer each with a recommendation, the strongest objection, and your
confidence.
