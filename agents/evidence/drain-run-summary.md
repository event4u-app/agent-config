<!-- evidence-type: analysis -->

# Drain run 14 — summary

2026-09-01. Autonomous drain over `agents/roadmaps/`. Every decision that would
normally have gone to the owner went to the AI council instead; the maintainer
pre-authorised token spend and delegated would-ask-the-user decisions for this
run. **Zero user round-trips. Zero metered API calls.**

## The headline, because it is not what the seed expected

The run's seed listed **36 active roadmaps**. The live tree carried **three** —
the other 33 were archived by earlier drain runs, and the seed was stale before
the first command. Two more landed mid-run from a parallel session, so the run
worked **five** roadmaps in total.

**Not one of the five could be driven to 100 % honestly, and that is the
finding rather than a shortfall.** Four are held by owner-reserved decisions the
council explicitly refused to make on the owner's behalf; the fifth is held by
evidence that does not exist yet. Every hold is now *recorded, measured and
citable* where it used to be prose, an assumption, or nothing at all.

## Pull requests

| PR | Roadmap | State | Outcome |
|---|---|---|---|
| [#1794](https://github.com/event4u-app/agent-config/pull/1794) | `road-to-harness-promotion-bridge` + `road-to-council-topology-evidence-followups` | **merged** | 7/9. `merge-authority` recorded terminally owner-reserved; the unguarded-carrier gap measured and confirmed |
| [#1795](https://github.com/event4u-app/agent-config/pull/1795) | `road-to-governed-evidence-production` | **merged** | 4/9. Metered capture refused on validity; six factual defects repaired |
| [#1796](https://github.com/event4u-app/agent-config/pull/1796) | `road-to-publication-integrity-hard-fail` | open | 11/14. A discarded detection now refuses; Phase 2 escalated on an authority split |
| [#1799](https://github.com/event4u-app/agent-config/pull/1799) | `road-to-blocked-quickwin-visibility` | open | 5/12. Fourth `stubs:due` bucket, dispatcher defect fixed, deadlock falsifier made machine-readable |

## Council decisions

Six rounds. **Two ran DEGRADED at 1/2 and were re-run rather than acted on** —
the tool prints *"this is not convergence"*, and a single seat authorising a
verify-clause rewrite is thin evidence for a decision that binds. Both retries
reached 2/2. All rounds: `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
2 rounds each, depth deep, peer-review, blind chairman, subscription transport,
`billable=0`, **$0.0000 total**.

| # | Question | Verdict | Quorum |
|---|---|---|---|
| 1 | Is this session the park's "independent session"? | **1C** — yes for capture, metric must be frozen outside it | 2/2 |
| 2 | Disposition of `blocker: merge-authority` | **2C** — terminally owner-reserved | 2/2 |
| 3 | Disposition of the draft receiver | **3A** — leave draft, do not promote the guard | 2/2 |
| 4 | May the metered capture proceed? | **QB** — no; the subject is not reproducible and the comparison has no producer | 2/2 |
| 5 | Phase 2 fork (`Unreleased` premise false) | Option **A** on architecture, **split on authority → D** | 2/2 (after a 1/2 retry) |
| 6 | Duplicate dispatcher definition | Option **B**, with a nine-row authority table | 2/2 (after a 1/2 retry) |

**The two rulings that shaped the whole run:**

- *"An agent council cannot amend the boundary of its own authority."* The
  reflexivity is structural, so `merge-authority` was recorded as terminally
  owner-reserved rather than decided.
- *"If that approval is unavailable, choose D temporarily rather than treating
  council review as ownership authority."* A **split on authority is an
  escalation condition, not a tie to break** — that sentence is why Phase 2 of
  the publication roadmap stayed open with its design fully recorded instead of
  being implemented under a favourable reading.

And one distinction both seats insisted on, preserved in every write-up:
**delegated is not council-decidable.** *"We're using delegated authority, not
discovering they were council-decidable all along."*

## What was measured that had only been asserted

- **The unguarded carrier — CONFIRMED.** Deleting a file holding **38 deferred
  obligations** reds **zero of nine gates**. And one correction in the stricter
  direction: the roadmap predicted an estate *credit*; measured, there is **no
  delta at all** — `status: draft` is skipped by `collect()`, so it was never
  counted in either direction. Worse than claimed, not better.
- **The publication defect is live.** `npm pack` ships the **repo-root**
  `CHANGELOG.md` as `package/CHANGELOG.md`; `dist/CHANGELOG.md` does not exist,
  so a check written against it would pass while shipping the comment. The
  shipped member carries the prohibited instruction **twice right now**
  (`:418`, `:652`).
- **The deadlock falsifier has fired.** Three releases after the 2026-08-23
  validation date, four marker lines each, every figure reproducible by a quoted
  command.
- **A dispatcher defect nobody had seen.** `cmd_stubs_due` was defined **twice**;
  bash takes the later, so the roadmap was measuring code the CLI does not run,
  and its own canonical example appeared in **no list at all**.

## What was refused, and why it was not worked around

- **The metered capture.** A live key resolves and the run would have cost ~2
  cents against a $5 ceiling — so neither cost nor the safety classifier is the
  block. The corpus is not reproducible from a commit (`.claude/` is gitignored;
  15 rules in one tree, 13 in a fresh generation at the same HEAD), and no delta
  producer exists. Spending to produce a number nobody can reproduce, then
  closing AC-2 on it, is the fixture substitution the roadmap's own risk register
  ranks #2.
- **`underpowered` as a discharge.** Ruled explicitly: it records that
  adjudication was unavailable, not a directional result. AC-2 stays open.
- **Descoping into a stub.** Refused twice over — by the council, and
  independently by the mechanism: `deferralProblems` accepts only
  `agents/roadmaps/` and `agents/roadmaps/later/`, so a stub resolves as *"does
  not exist"* and reds the archival sweep. **No obligation was descoped in this
  run.** Nothing was dropped to make a roadmap close.

## Three tests that came back green under sabotage

Every guard added this run was neutralised and watched fail before being trusted.
**Three did not fail on the first attempt**, and each is recorded where it
happened:

1. A section-scoping test passed with the scoping removed — the fixture put the
   target section first, so it proved the target sorts first, not that the read
   is scoped.
2. A frontmatter test passed with the frontmatter read removed — the predicate
   short-circuits on an earlier field, so neutralising one read alone was
   undetectable. Fixed by pinning each field individually.
3. The bucket initially selected a population of **zero** and printed nothing —
   the precise failure this roadmap exists to prevent, caught before it shipped.

Two of the three are the *same shape* in different files. A test never seen red
has unknown sensitivity, and three of this run's would have shipped as coverage.

## Corrections to my own work, recorded rather than quietly fixed

- **`git checkout --` on an uncommitted file destroyed an implementation** while
  undoing a sabotage probe. Reapplied from the patch; later probes used `cp`
  backups with SHA-256-verified restores.
- **A citation repair falsified its own citations** — inserted prose moved the
  line numbers being cited. Switched to step ids, with both measurements recorded.
- **A marker count was measured as 1 where the roadmap said 4.** The roadmap was
  right; the measurement counted the wrong construct. Both constructs are real
  defects and they are different ones.
- **A refactor for the size ratchet broke 13 tests** by importing a symbol from
  the wrong module, and orphaned an import. Both fixed in the same change.
- **Four framings were graded speculative by the council** and downgraded in the
  text rather than dropped, including one of mine that overstated what a finding
  proved.

## Honest state at the end

Two PRs merged, two open and green-pending. **Four roadmaps remain active and
none is stalled by this run**: each carries a recorded, citable reason it cannot
advance, and three of the four need exactly one owner decision to move.

- `road-to-harness-promotion-bridge` — needs ADR-239 § Decision 3 settled.
- `road-to-governed-evidence-production` — needs an owner ruling on the corpus
  contract, then a delta producer built.
- `road-to-publication-integrity-hard-fail` — needs the Option A authority
  question answered; the design and its full acceptance suite are written out so
  approving it is a read, not a design exercise.
- `road-to-blocked-quickwin-visibility` — Phase 3's cap, activation and numbers
  are explicitly the owner's to set.

Nothing was promoted. No estate hold was lifted. No baseline was raised — the one
baseline that moved was **lowered** to the exact tree total after an extraction
paid its own way. No gate was skipped, weakened, or bypassed.
