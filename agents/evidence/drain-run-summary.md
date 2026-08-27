<!-- evidence-type: analysis -->
# Autonomous roadmap-drain run — 2026-08-27

The single report for the drain run. Every PR, every council decision, every
descope, and — because it is the load-bearing part — every place the run was
wrong and corrected itself.

## The seed list was stale, and that reshaped the run

The instructions seeded 36 roadmaps verified at `c536dbd`. Recomputed at
`5a8f6b592`: **26 of the 36 were already gone**, drained by earlier sessions. The
live estate was **10 active roadmaps, all `complexity: structural`, all below 10%
progress** — 404 open steps and 17 open blockers, every blocker Class 3 and
maintainer-owned.

So the queue rule "≥10% descending, then <10% by ascending complexity" collapsed
to a single bucket ordered by checkbox count. Nothing nearly-done existed to
finish; every candidate was a structural roadmap at its beginning.

## PRs

| PR | Roadmap | State | CI |
|---|---|---|---|
| [#1692](https://github.com/event4u-app/agent-config/pull/1692) | `road-to-executable-specification-layer` — **archived** | complete | **green**, 36 checks |
| [#1693](https://github.com/event4u-app/agent-config/pull/1693) | `road-to-composition-before-creation` — **archived** | complete | **green**, 46 checks |
| [#1694](https://github.com/event4u-app/agent-config/pull/1694) | `road-to-database-erd-landing` — **blocked, not archived** | finding + blocker | see PR |

Two roadmaps closed and archived. The third was executed end to end and stopped
by a measured obstacle; its evidence ships rather than its work.

## Council decisions

Nine questions across five rounds, 2 seats each (anthropic + openai), quota
14/50 → 26/50. Every Class-3 blocker and every design fork went to the council;
none went to the user.

| # | Question | Verdict |
|---|---|---|
| 1 | Which stack gets the first executable-spec adapter | **(c)** neither — ship the stack-neutral half, 2/2 |
| 2 | Grading a dimension the suite teaches nothing about | **Unscore + rename**, split in round 1, 2/2 in round 2 |
| 3 | Phase 3 against a measured mutation-rig refusal | **(b)** descope — mechanism-match returned *same mechanism*, 2/2 |
| 4 | Which reading governs the composition kill criterion | **Does not fire**, continue — 2/2 on the outcome, split on the reading |
| 5 | Extend `collision_ok` or add a field | **(b)** new field, 2/2 |
| 6 | Disposition-vocabulary authority | **(b)** own enum, (c) unification deferred, 2/2 |
| 7 | How a carried deferral is glyphed at archive | **(c)** a validated annotation, `[-]` stays cancellation-only, 2/2 |
| 8 | ERD as a skill or an artifact; the estate allowance; the landing shape | opt-in skill 2/2 · **(a) one** exemption 2/2 · cherry-pick, all five commits |
| 9 | Two ratchets disagreeing about estate growth | **(a)** both gates hold, block until headroom, 2/2 |

**Rejected and recorded, so nothing invented survives:** numeric thresholds
proposed by one seat in three separate rounds — ">20 survivors", ">2hrs",
75%/60% vocabulary overlap, 20% adoption, 5%/10% cumulative growth caps,
six-month windows — were each rejected by the other seat as unsupported by any
measurement, and **none is adopted**. In every case the second seat's objection
was the same: a threshold with no measurement behind it reads as evidence.

## Where the run was wrong

Recorded because a drain that only lists its successes is not a report. Five
process failures are below; **twelve defects in the code itself** were found by
the neutral review and have their own section further down.

1. **I wrote off a real CI red as environmental.** `check_preamble_payload_budget`
   failed shard 3/4 on PR #1693. I compared against the **design** ceiling
   (107,646), saw a +30,631 overshoot, and concluded a +74-token rule edit could
   not be the cause. The operative ceiling is the **grace** ceiling — 138,212, set
   to the exact measured total with zero slack, the same no-slack pattern I had
   applied to the stub ceiling *in that very branch*. Measured properly:
   `origin/main` 138,195, branch 138,277, i.e. 17 tokens of headroom against a
   74-token addition. Fixed by shrinking, not by raising; corrected in the PR body
   and in a comment on the PR.
2. **A sabotage probe passed that should have failed.** My block-boundary spec put
   the annotation *above* the unannotated step, where the assertion holds whether
   or not the boundary exists. It stayed green against a build with `BLOCK_END_RE`
   disabled. Rewritten with the annotation after, and the sabotage now reds. The
   uncorrected version is the exact shape of a test that proves nothing.
3. **`git stash` popped another session's stash.** `git stash -q` found nothing to
   stash and exited 0; the following `git stash pop` took `stash@{0}`, which
   belonged to a concurrent session, merging ai-video and ADR work into my tree
   across seven conflicted paths. Recovered by resetting exactly those paths; the
   other session's stash is preserved and untouched. The probe should have been
   run in a separate worktree.
4. **A `sed -i '' 's/\bartefact\b/...'` normalization was a silent no-op.** BSD
   `sed` has no `\b`; it matched nothing and exited 0, and the count did not move
   while the edit looked applied. Redone with a Python regex — 992, three *below*
   where the branch started.
5. **A JSON round-trip reformatted two schemas and a baseline.** `json.dump` with
   the wrong indent produced a 237-line diff for a 15-line addition. Reverted and
   redone as surgical text inserts.

## Corrections made to the roadmaps themselves

Six places where a roadmap's own text was wrong, each recorded at the step rather
than silently worked around:

- **A verify string asked for a ratchet-flagged spelling.** Step 1.1 of the
  executable-spec roadmap required `grep "observable behaviour"`;
  `canonical-terms.yml` makes `behaviour` a variant at 995/1007. Satisfying the
  literal would have added violations to a tightening gate to pass a verify.
- **A measurement table understated its own dimension.** It named only the
  mutation probe; the code also detected property-based testing, so the grade was
  mixing two signals under one label.
- **A step listed four disposition vocabularies; there are six.** It missed the
  harvest ledger's `adopt | adapt` — which is the *closest* incumbent and supplies
  the argument for the new enum — and `build_archive_index`'s `Disposition`.
- **A step named the wrong venue.** "Register the enum with the canonical-term
  lint": that file maps *spelling variants*, so an enum value has no row there,
  and registering it would have satisfied the verify while guarding nothing.
- **A step asked for `why_not_extend` against "the 34 skills in
  `family: backend-data`".** There is no `family:` frontmatter field in this tree.
  Nine adjacent skills were enumerated by hand instead.
- **A step's premise about contract divergence was wrong.** `schema_erd/ir.ts`
  shares no type with `_lib/persistence/` — that directory is a finding pipeline
  for `lint_persistence`, so "the current adapter shape" names a contract the two
  surfaces never had in common.

## Descopes

| What | Where it went | Condition to promote |
|---|---|---|
| Executable-spec Phase 2 (2.1–2.3) and Phase 3 (3.1–3.3), plus AC-3–AC-6 | `stubs/road-to-executable-specification-adapter.md` | a consumer names a stack **and** a concrete workflow; for the mutation half, a remeasured survivor population too large to hand-probe |
| Composition-before-creation step 4.2 (false-positive rate) | `road-to-composition-review-false-positive-rate.md`, created in the same change | one release of advisory operation, so the population is non-empty |
| The `explain_run` fixture hole found mid-run | `stubs/road-to-hermetic-explain-run-tests.md` | decide whether the default candidates are cwd-relative by contract or root-relative by accident |
| The ERD skill itself | stays on `feat/schema-erd-diff` + local `drain/database-erd-landing` | ≥36 tokens of payload headroom below the grace ceiling |

## Honest nulls

- **The mutation adapter is not built, and that is the verdict.** The
  mechanism-match test returned *same mechanism* as an archived refusal measured
  at 10 probes / 3 survivors, whose reopen condition has not fired. A `revisit_if`
  describes what would lift a `degraded` state; it does not authorise building
  past a later, evidence-backed refusal. The registry now says so.
- **No assurance-registry state was flipped.** `mutation-sensitivity` stays
  `degraded`, `e2e-test` stays `unknown` — the property AC-6 existed to protect,
  held even though AC-6 itself is descoped.
- **The false-positive rate does not exist and was not estimated.** Zero additions
  in the population on the day the roadmap closed.
- **No ceiling and no baseline was lowered to make anything green.** One ceiling
  was *raised* — the rule-stub ceiling, 680 → 690, to the exact measured count
  with a stated reason, after four shrink passes. `--write-baseline` was declined
  because it also re-anchored five unrelated ceilings downward: real gains, but
  ones this run neither made nor measured.

## The neutral review, and the twelve defects it found in this run's own work

A stop-gate observed that 118 non-doc lines had been mutated with no neutral
review, and it was right. A cross-model review was commissioned afterwards —
2 seats per round, neither having written the code or the prompt's expectations.
Scope was the **complete** non-doc delta, selected by `git diff` over
code/config/test/CI paths, split into four parts **by file group mechanically**
because it exceeded the 51,200-byte transport ceiling. No file was excluded.

**Twelve findings. All twelve were real. All twelve are fixed**, each with a
sensitivity probe proving the new assertion catches the defect it was written
for.

### The readiness grader (3)

1. `mutation-testing-ci-enforcement-detected` overclaimed — static matching over
   a workflow proves a tool is *referenced*, not that the step is enabled,
   blocking, reached or executed. Renamed to `-ci-reference-detected`.
2. The level spec was **deletion-insensitive**: `grade(full).level > 0` stays
   green if the dimension is deleted outright, so it proved nothing about the
   mechanism its own comment claimed. Rewritten; deleting the dimension now turns
   8 red, folding non-knockouts into the level 4.
3. `evidence` and `observations` were two representations of one fact — the
   ternary named only the mutation signal when both fired. Derived now.

### The new advisory gate (5)

4. **The contract over-claimed.** The docstring and both schema descriptions said
   a lint checks that `candidate` resolves, while `command:` and `guideline:`
   were silently exempt. `artefactIds` now walks all four trees.
5. `composition_review: []` — present, saying nothing — was accepted.
6. A **git failure read as "no additions"**: an unresolvable base ref exited 0
   with zero advisories, a blind run indistinguishable from a clean one.
7. The advisory path had **zero** coverage despite a comment calling its
   `ls-files --others` union load-bearing. Real-git fixture now.
8. Two parser holes: a YAML block scalar captured `|` and produced a
   one-character value; the candidate grammar admitted `guideline:/foo`, `foo/`
   and `foo//bar`.

### The archival relaxation (4)

9. The back-link slug was interpolated into a `RegExp` **raw** — `road.parent`
   matched `roadXparent`, and `[` made it THROW and abort the sweep, inside a
   function whose whole contract is failing closed.
10. A roadmap could name **itself** as destination: passes every check, then dies
    with its own archival.
11. **The sharpest finding of the review.** A destination could go dead in the
    **same sweep** — two roadmaps both complete, parent carries to child, both
    validated live, both archived, carried item left with no receiver. The
    mechanism meant to prevent the loss produced it.
12. `merged-into` was satisfied by a substring: a filename, an example or a
    comment counted as a link. Structured now.

Plus the coverage gap both seats named independently: every unit spec stayed
green if `deferralProblems()` were deleted from `archive_completed()`, so nothing
proved the validation was **wired**. Three integration specs now drive the real
CLI over a real git repo; unwiring the call turns 2 red.

### What the review changed about how this run should be read

Part 4's findings were claim-accuracy, and they matter more than they look: the
gate said a record pointing at a non-existent incumbent "reads as evidence of a
search that cannot have happened" — in the docstring, the operator message and
the manifest note. That is a claim about the search, and the gate has none to
make. What it certifies is **referential consistency**. Narrowed in all three
places.

**Two of my own specs had to be corrected rather than kept**, and both are the
same shape as the defects the review was finding: one asserted the very carve-out
that turned out to BE the defect, and one measured a coverage floor against the
wrong quantity so it reddened when candidate resolution widened — while the floor
it checked had not changed.

**And one more of my own, worth naming plainly:** the first version of fix 3
(deriving `evidence` from `observations`) had **no spec behind it**, and its
sabotage passed green — one commit after the review had named exactly that class
of defect. Two specs were added and the sabotage now reds.

## Cross-branch contamination, found while fixing the review

`git checkout -B` carries uncommitted changes across branches, and a later
`git add -A` committed three ERD artifacts into PR #1693, where none of them
belongs:

- the ERD roadmap with all phases `[x]` and both blockers resolved — which would
  have marked that roadmap complete on `main` with **none** of its work landed,
  and made the archival sweep archive it;
- its Phase-3 evidence file;
- a `schema-erd` **skill-admission row** — a row admitting a skill that is in
  neither PR, which is a claim nothing backs.

All three reverted from #1693. The evidence file moved to #1694 where its roadmap
lives; the admission row is in **neither**, because it goes with the landing.

Two fixture traps surfaced in the same cleanup, both mine and both recorded at
the specs: a destination built from the unit helper had its checkbox outside any
`## Phase` heading, so it read as zero-open and archived itself — which then
correctly tripped the new same-sweep guard and failed the happy-path spec for a
reason unrelated to the feature. And a bare `## Phase 1` heading is absorbing:
`PHASE_RE`'s optional trailing-name group can consume the blank line and the
checkbox after it. Real roadmaps always carry a name, which is why nothing else
hits it.

## Seven roadmaps never reached

`-database-evolution-tactics` (30 steps, 3 blockers) ·
`-database-relational-modeling` (34, 3) · `-experience-loop-broadening` (47, 0) ·
`-capability-native-execution` (54, 5) · `-governed-harness-evolution` (58, 0) ·
`-inbox-harvest-2026-08-e-council-topology-evidence` (77, 6) ·
`-supervised-telemetry-collector` (28, 3, landed on `main` mid-run by a parallel
session).

None was started. Each is structural, at 0–3% progress, and carries blockers of
its own — the run reached the point where the honest move was to report rather
than to open a fourth roadmap it could not finish.

## The one obstacle no execution, council decision, re-scope or descope could clear

`check_preamble_payload_budget`'s grace ceiling leaves 17 tokens of headroom and
its config says *"It may never move UP"*. Measured: a skill with its description
gutted to 12 tokens is still one token over, because the catalog bucket costs 6
tokens for the name and formatting alone. Both council seats refused to raise the
ceiling, refused to exclude the bucket, and refused to fund the addition by
shaving unrelated skills — leaving their own fallback, which is what this run
took: block until a separate reduction creates headroom.

That is a decision about a registered budget with a November milestone, 30,549
tokens over its design ceiling, with no reduction mechanism, no per-bucket targets
and no owner named. Both seats called the milestone *not known-unmeetable, but
known-unplanned and not credible*. It is the one thing in this run that a
maintainer, not a council, has to answer.
