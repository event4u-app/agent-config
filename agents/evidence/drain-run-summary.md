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

---

# Drain run 15 — summary

2026-09-01/02. A second autonomous pass over `agents/roadmaps/`, on the five
roadmaps drain 14 left standing. Same delegation: every decision that would
otherwise have gone to the owner went to the AI council, whose *"recorded
decision substitutes for user sign-off"*. Delivery boundary: one PR per
roadmap, no merges. **Zero user round-trips. Zero metered API calls. $0.0000.**

**Drain 14's finding does not repeat.** It reported that none of five roadmaps
could be driven to 100 % honestly, because four were held by owner-reserved
decisions the council refused to make on the owner's behalf. Drain 15 put those
same decisions to the council against a **new fact** — the owner's written
delegation for this run — and three of the four moved. The fourth did not, and
the reason it did not is the most useful thing here.

## Inventory at start

Recomputed live at `23391aec2`; the run's seed table was stale by 31 files.

| Roadmap | Progress | Outcome |
|---|---|---|
| publication-integrity-hard-fail | 11/14 | **completed + archived** |
| harness-promotion-bridge | 7/9 | **closed at the PR boundary + archived** |
| governed-evidence-production | 4/9 | left open, correctly open |
| blocked-quickwin-visibility | 5/12 | **completed + archived** |
| council-topology-evidence-followups | 0/38 | left standing, no closure claim |

## Pull requests

| PR | Roadmap | Final state |
|---|---|---|
| [#1801](https://github.com/event4u-app/agent-config/pull/1801) | publication-integrity-hard-fail | 14/14, 6/6 ACs, blocker resolved, archived |
| [#1802](https://github.com/event4u-app/agent-config/pull/1802) | harness-promotion-bridge | 7 `[x]` + 2 `[~]`, blocker resolved as refused, archived |
| [#1803](https://github.com/event4u-app/agent-config/pull/1803) | blocked-quickwin-visibility | 12/12, blocker declined and recorded, archived |
| [#1804](https://github.com/event4u-app/agent-config/pull/1804) | governed-evidence-production | 4/9, disposition + resume chain recorded |
| [#1805](https://github.com/event4u-app/agent-config/pull/1805) | council-topology-evidence-followups | 0/38, disposition recorded |

All five settled green (53, 45, 35, 6 and 6 checks). #1803, #1804 and #1805 were
merged by the maintainer during the run.

## Council decisions

Two sessions, both `anthropic/claude-sonnet-4-5` + `openai/codex-default`,
2 rounds, depth deep, peer-review, blind chairman, quorum **2/2 present**
(needed 1), concluded, subscription transport, `billable=0`. Every verdict is
inlined in the roadmap or ADR it governs; no path under
`agents/runtime/council/` is cited anywhere in the tree.

### Session 1 — four owner-reserved blockers

| Q | Subject | Verdict | Convergence |
|---|---|---|---|
| 1 | Phase 2 authority split, publication-integrity | **1A** — the delegation reaches it; implement Option A | 2/2 |
| 2 | `b-retro-curation-scope` | **2c** — curate the current era, bounded editorial execution | 2/2 |
| 3 | `b-provisional-promotion-authorization` | **3b** — decline the path | 2/2 |
| 4 | `merge-authority` | **4C** — settle ADR-239 § Decision 3 negatively, re-scope to the PR boundary | convergent after one seat moved from 4B |

Q1 turned on a conditional the *earlier* council had written itself: *"If that
approval is unavailable, choose D temporarily rather than treating council
review as ownership authority."* The delegation supplied the approval, so the
branch D hung on was no longer live. That is the shape of three of this run's
four movements — not a reversal of a decision, but the arrival of the condition
the decision named.

Q3 went the other way, and it is the run's clearest limit: *"Options (a) and (c)
constitute governance self-amendment — the council extending the agent's own
write authority over a recorded estate floor. `decision-revisit-gate`
explicitly reserves this and explicitly states no delegation overrides it."*
And on the tempting reading of the owner's instruction: *"That general language
nevertheless loses to the narrower rule expressly covering delegation and
self-amendment."* A broad delegation does not beat a narrow rule that names
delegation.

### Session 2 — two terminal-state questions

| Q | Subject | Verdict | Convergence |
|---|---|---|---|
| 1 | Phase 2, governed-evidence-production | **1B** — open and correctly open | 2/2 |
| 1b | AC-3 | stays open as a Phase-2 successor obligation; **not** transferred | 2/2 |
| 2a | the unguarded-carrier gap | **DIVERGENT** — no mandate, nothing built | split |
| 2b | the 38-item carrier | **2b-i** — leave it standing, claim nothing | 2/2 |

Session 2's Q1 records the distinction the whole run turns on, in the council's
words: the delegation separates *"authority to decide, authority to implement
preparatory work, and satisfaction of an acceptance criterion"* — and supplies
the first two while the third stays unavailable *"because their required
evidence does not exist."* Delegated authority settled the corpus contract; it
could not satisfy an independence condition using the same run.

## Descopes and carries

Exactly one, and it is a carry rather than a descope:

- **Phase 7 and AC-9 of harness-promotion-bridge** →
  `agents/roadmaps/later/road-to-post-pr-promotion-workflow.md` <!-- ref-ignore -->
  (the receiver lands with #1802, so this path does not resolve from this
  branch), with all seven
  `verify:` clauses and all five prior AC-9 audits carried **verbatim**, plus
  the Hard-Floor sentence requiring same-turn human confirmation. Enforced by
  `deferralProblems`, which refuses archival unless the receiver exists, is live
  and carries the back-link. The seven provisional Phase 7 marks travelled with
  their provisional status intact, because a drain-14 council had **diverged**
  on reverting them and a divergent council carries no mandate.

**No stub was used as a carry destination, because none may be.** The run's own
terminal-fallback instruction names a stub descope; checked against the tree, it
is mechanically illegal — the archival sweep resolves `carried-to=` only against
`agents/roadmaps/` and `agents/roadmaps/later/`, and `agents/roadmaps/stubs/`
resolves as *"does not exist"* and reds the sweep. The council named the
governing clause: *"its 'legitimate gate closure only' clause controls when the
repository provides no legal stub route."*

## What was deliberately not done

- **`b-provisional-promotion-authorization` was declined, not registered.** No
  integer, no expiry, no bounded trial — `max_live: 1` *"limits magnitude, not
  the legal character of the authority change."*
- **The eight `_auto-derived` head lines in `CHANGELOG.md` were not rewritten.**
  The council authorised editorial execution and bounded it in the same breath;
  rewriting a derived claim about a past release is the *"truthfully documented
  uselessness"* two prior councils reserved. Preserved with a dated note in the
  published surface itself.
- **`metered-backend-park` was not closed with its option (b).** That exit was
  available and would have let the roadmap archive. It contradicts a narrowing
  settled the day before, and taking it to make a file archive is cosmetic
  closure.
- **No carrier-integrity validator was written.** The seats split on whether a
  repository-wide CI gate falls inside a per-run delegation. The permissive
  seat's specification is recorded anyway, because the naive form is already
  measured 2-of-2 false-positive and a future authorised run should not
  re-derive that.
- **No merge, and no merge capability.** ADR-239 § Decision 3 was settled in the
  **refusing** direction, workflow-scoped: the refusal binds *preauthorized*
  authority only and does not touch a human merging under same-turn
  confirmation. The Hard Floor was never approached.
- **Zero metered proposer calls.** The `governed-evidence` capture would have
  cost about two cents against a live key. Cost was never the blocker.

## Honest nulls

- Two roadmaps did not close, and neither carries a completion claim.
- `council-topology-evidence-followups` is gated on facts about the world rather
  than about the repository: **2** configured council seats against an `n >= 5`
  floor, and a verified 20-consecutive-UTC-day capacity reservation that is not
  an action available in this environment. No repository work moves it.
- The unguarded-carrier gap remains open and measured: deleting that carrier is
  invisible to all nine roadmap gates, and scores as nothing at all rather than
  as an estate credit, because the counter skips draft files.
- **#1802 carries its own falsifier.** A drain-14 council had ruled the same
  boundary *terminally* owner-reserved. That contradiction was recorded rather
  than smoothed: if the owner upholds it, the ADR settlement is void, the
  blocker reopens, and the roadmap returns to the active tree with both items
  restored.
- The promotion capability still reads a *roadmap* while the authority now lives
  in an *ADR*. Rewiring it is the right change and was not made — it is scope
  creep on a change whose point is that the capability does not move. Named in
  the docblock.

## Verification

Every PR ran the roadmap gate battery locally before push, plus `task
preflight` and the touched suites. **No gate was skipped, weakened, or
baselined upward.** The one ratchet this run tripped —
`check_source_size_budget`, 8 over — was paid down to 15 under by moving a
doc block out of a file that is past its cap into one that is not, and the
baseline was **lowered** accordingly.

Guards added by this run were observed **red** before green: neutralising the
two publication guards turned 3 specs red, restoring the writer's emission
turned 2 more red, and the `npm pack` acceptance test was written before the
changelog was curated and observed red against the real published artifact —
the extracted npm member carried the prohibited instruction twice at that
moment.
