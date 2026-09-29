<!-- evidence-type: analysis -->

# The runnable and falsifiable share of `verify:` clauses

> Measured 2026-09-29 at `7efe4c2e8`, on the 22 active roadmaps in
> `agents/roadmaps/` (flat — `archive/`, `later/` and `skipped/` excluded).
>
> Producing command, which is the point of this page:
>
> ```bash
> ./scripts-run src/scripts/roadmap_verify_share
> ./scripts-run src/scripts/roadmap_verify_share --json   # same numbers, machine-readable
> ```
>
> Do not hand-edit the table. Re-run the command; a row that disagrees with a
> fresh run is the signal this page exists to produce.

## The unit — stated first, because the figure is meaningless without it

One unit is **one step block carrying a `verify:` clause** — a `- [ ]`, `- [x]`,
`- [~]` or `- [-]` line plus its continuation lines. Not one *line*: a clause
wraps across lines, so a line count double-counts a wrapped clause and also
counts prose that merely mentions the token.

Step blocks come from `closure_scan`'s `units()`, so the two instruments agree
on what a step is. That inherits its exclusions: fenced code, and the
`## Decisions` / `## Blockers` / `## Kill register` / `## Risk Register`
sections, where a mention of `verify:` is commentary rather than a step's
oracle.

**Closed steps are counted.** A `[x]` flipped on a clause that could not fail is
the defect in its completed form; excluding closed steps would report the
backlog as shrinking every time someone closed one.

## Headline

| Metric | Value | Share |
|---|---:|---:|
| Active roadmaps scanned | 22 | — |
| Step blocks carrying a `verify:` clause | 230 | — |
| … naming a command (the **runnable** share) | 93 | 40.4% |
| … naming an expectation (the **falsifiable** share) | 6 | 2.6% |

### Per roadmap

| `road-to-a-bytes-row-that-exists.md` | 9 | 4 | 0 |
| `road-to-a-component-taxonomy-we-follow-but-never-force.md` | 6 | 0 | 0 |
| `road-to-a-kernel-that-guards-its-plumbing.md` | 8 | 4 | 0 |
| `road-to-a-ledger-that-closes-the-loop.md` | 17 | 4 | 0 |
| `road-to-a-menu-whose-precision-is-measured.md` | 6 | 1 | 0 |
| `road-to-a-sanitize-list-that-is-generated.md` | 7 | 0 | 0 |
| `road-to-a-stop-that-holds.md` | 13 | 4 | 0 |
| `road-to-a-ui-coverage-ledger-that-can-fail.md` | 9 | 0 | 0 |
| `road-to-a-verify-clause-that-can-fail.md` | 6 | 4 | 3 |
| `road-to-adversarial-verification-and-long-runs.md` | 30 | 26 | 0 |
| `road-to-an-obligation-row-that-names-its-writer.md` | 5 | 1 | 0 |
| `road-to-behavior-vocabulary-and-runner-truth.md` | 7 | 5 | 0 |
| `road-to-bounded-approval-floor-waiver.md` | 12 | 5 | 0 |
| `road-to-corpus-refresh-cadence-shape.md` | 2 | 0 | 0 |
| `road-to-decision-closure.md` | 16 | 5 | 0 |
| `road-to-hooks-on-every-host.md` | 7 | 2 | 0 |
| `road-to-host-claims-the-tree-contradicts.md` | 8 | 5 | 0 |
| `road-to-host-traffic-knobs-that-ship.md` | 5 | 2 | 0 |
| `road-to-one-verification-classifier.md` | 7 | 4 | 3 |
| `road-to-release-holds-that-refuse.md` | 22 | 8 | 0 |
| `road-to-trigger-eval-freshness-has-no-writer.md` | 3 | 0 | 0 |
| `road-to-typed-grants-that-persist.md` | 25 | 9 | 0 |

## The denominator moves with archival — the ratio is the finding

An earlier reading the same day, at `dbf1c9179`, gave 27 roadmaps / 264 clauses
/ 100 commands / **6** expectations. Five roadmaps archived between that commit
and this one. Every total fell; the **count of expectations did not move at
all**, because both of its holders are still open.

That is the instrument working, and it is the first thing a future reader needs:
a total that dropped by 34 clauses means five files left the corpus, not that
anybody fixed a clause. Compare the *falsifiable share* across readings and
treat a moved total with no moved numerator as archival until proven otherwise.

## The roadmap's own figures did not reproduce

`road-to-a-verify-clause-that-can-fail` states, in its Goal and in Risk rows 1
and 4: *"155 `verify:` lines across the 8 active roadmaps, 51 opening with a
backticked command, and **zero** carrying a machine-decidable expectation."*

None of the three reproduces at this head. The first two are re-derivations over
a differently-sized tree — the roadmap says 8 active roadmaps where 27 exist, so
the denominators are not comparable and no ratio carries forward. The third is
not a scale difference and matters on its own:

| Claim | At this head | Status |
|---|---|---|
| 8 active roadmaps | 22 | did not reproduce |
| 155 `verify:` lines | 230 clauses (different unit, see above) | did not reproduce |
| 51 opening with a command | 93 | did not reproduce |
| **0** carrying an expectation | **6** | **false** |

Neither 8 nor 155 nor 51 reproduces under any reading tried: not the flat
directory (22 files), not `status: ready` alone (16 at this head), and not a raw
`grep -c 'verify:'` line count (270). The first three rows are recorded as
unreproducible rather than reconciled — the denominator that produced them is
not recoverable, so no ratio in that roadmap carries forward.

**Three of the six predate this work and were written by an author nobody
prompted.** `road-to-one-verification-classifier.md` already carries the arrow
form, three times, unaided by any rule permitting it:

```
verify: `npx vitest run tests/scripts/turn_end_verify_allowlist` -> 0
verify: `grep -c "'ls tests', false" tests/scripts/turn_end_verify_allowlist.test.ts` -> 1
verify: `npx vitest run tests/scripts/before_complete_hook` -> 0
```

The remaining three are this roadmap's own verify lines. So rule 23's arrow
clause documents a grammar already in use rather than introducing one — which
is the single strongest piece of evidence against the roadmap's Risk 1 (*"the
arrow grammar is ceremony nobody writes"*). It was written before it was legal.

**What the zero-claim cost.** Nothing was built on it, because it was checked
before it was used — but it very nearly was: the claim had already been copied
into two docstrings (`closure_scan.ts`, `roadmap_verify_share.ts`) as *"the tree
carried ZERO machine-decidable expectations"* before the measurement ran. Both
were corrected against this reading. A refuted claim left standing in a
docstring is this roadmap's own subject in its purest form. Had it been carried forward, the retirement condition in
Risk 1 — *"if the share has not moved over two quarters"* — would have been
measured against a baseline of 0 while the true baseline was 6, and a grammar
that was already being adopted would have read as one nobody wrote.

## A parser defect the measurement surfaced

The first reading reported 103 commands and 4 expectations. Both were wrong, and
the reason is worth recording because it had been latent in `extractVerify`
since that function was written.

The inherited label pattern was ``` `?verify:`? ```, with the two backticks
independent and both optional. On a step whose prose contains `` `verify:` ``
before its actual clause, the parser skipped the trailing `` `? `` and let the
**label's own closing backtick open the command**, capturing the whole
intervening sentence:

```
cmd="stays legal and reads as MANUAL, because forbidding it would silently
     invalidate 104 existing lines. verify:"
```

Nothing failed. A garbage command is still a string, and the run-continuation
hook printed it into a continuation message as the step's proof. The fix is an
alternation plus a lookahead (`` (?:`verify:`|verify:(?!`)) ``), and — separately
— taking the step's **last** clause rather than its first, so a step that
*illustrates* the grammar does not have its illustration parsed as its oracle.
Both are covered by tests that were shown red first.

## Reading this page next time

The delta is the product, not the level. Re-run the command, compare the two
headline rows, and note that only the falsifiable share answers the question the
roadmap asked: a runnable clause that states no expectation still cannot fail.
