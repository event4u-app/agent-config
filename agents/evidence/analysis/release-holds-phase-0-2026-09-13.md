<!-- evidence-type: analysis -->

# Release holds — Phase 0 measurement, and the honest null recorded up front

Measured 2026-09-13 against `origin/main` `7182f5d07`, and against the release tag
`15.0.0` (`c86131ad7`) where a historical row is named. Produced by Phase 0 of
`agents/roadmaps/road-to-release-holds-that-refuse.md`, whose own instruction is that the
zero is the finding rather than a failure of the sweep.

Three of the four figures this roadmap was drafted on have moved since 2026-09-11. Each
correction is recorded in place with the command that produced it, because a roadmap step
that instructs a wrong number is the suspect, not the measurement.

---

## 0.1 — Release-coupling prose across all four roadmap folders

**Search terms, narrow set** (the set the `zero-live-subjects` blocker names, reproduced
verbatim so the blocker and this file cannot drift apart):

    same release | release condition | ship together | must land in the same

**Command** (per folder; `agents/roadmaps/*.md` is the active folder, the glob excluding
subdirectories by construction):

    grep -rniE 'same release|release condition|ship together|must land in the same' agents/roadmaps/*.md
    grep -rniE '...same terms...' agents/roadmaps/later/ agents/roadmaps/skipped/ agents/roadmaps/stubs/
    grep -rniE '...same terms...' agents/roadmaps/archive/

**Result, narrow set, at `7182f5d07`:**

| Folder | Files | Hits | Substantive release-coupling declarations |
|---|---:|---:|---:|
| `agents/roadmaps/` (active) | 14 | 2 | **0** |
| `agents/roadmaps/later/` | 86 | 0 | 0 |
| `agents/roadmaps/skipped/` | 6 | 0 | 0 |
| `agents/roadmaps/stubs/` | 121 | 0 | 0 |
| `agents/roadmaps/archive/` | 718 | 16 (14 files) | 2, both closed |

**The active corpus holds zero release-coupling sentences at HEAD.** The two active hits
are both self-references inside this mechanism's own roadmap and neither declares a
coupling:

- `road-to-release-holds-that-refuse.md:85` — the rule 27 non-goal sentence, which says
  roadmap *incompleteness* is never a release condition. It is a prohibition, not a
  coupling.
- `road-to-release-holds-that-refuse.md:208` — the blocker's own quoted grep command.

**Correction to the blocker's wording.** The `zero-live-subjects` blocker says of this
grep: *"it returns nothing today"*. That was true when the blocker was written and is no
longer true at HEAD — it now returns two lines, both self-matches from the roadmap that
carries the blocker. The finding is unchanged (zero substantive declarations); the wording
that predicts an empty result is not. Corrected in the blocker entry in the same change as
this file.

**The last known live instance, verified at HEAD.** The roadmap's 0.1 verify names
`agents/roadmaps/archive/road-to-a-graph-that-is-shipped.md:960-961` with its two coupling
risks reading MITIGATED at `:973` and DISCHARGED at `:978`. All four line numbers reproduce
exactly at `7182f5d07`:

- `:960` — *"Phases 3.4 and 4.1 land in the same release as Phase 1, so a reader ships with
  the payload"*, mitigation column of risk rank 1.
- `:961` — *"AC-6 makes that a release condition"*, mitigation column of risk rank 2.
- `:973` — *"Rank 1 — MITIGATED as designed"*.
- `:978` — *"Rank 2 — DISCHARGED by measurement."*

Both are closed. There is no open release-coupling declaration anywhere in the tree.

**Per-file archive hits, narrow set** (14 files, 16 hits) — kept because the wider sweep
below is noisier and this is the set the blocker is scoped to:

`road-to-a-graph-that-is-shipped.md` 2 · `road-to-chat-history-hook-only.md` 2 ·
`road-to-harness-promotion-bridge.md` 2 · `road-to-autonomous-agent.md` 1 ·
`road-to-chat-history-session-isolation.md` 1 · `road-to-defect-population-sweeps.md` 1 ·
`road-to-inbox-harvest-2026-08-b-ci-economy.md` 1 · `road-to-install-contract-stability.md` 1 ·
`road-to-mcp-bridge-integrity-and-reach-truth.md` 1 · `road-to-portable-runtime-and-update-check.md` 1 ·
`road-to-release-shape-honesty.md` 1 · `road-to-surface-discipline.md` 1 ·
`road-to-turnaround-followups.md` 1 · `typescript-cli-and-local-gui-foundation.md` 1.

**Wider term set**, run as a sensitivity check on the narrow one rather than as a second
finding. Adding `target release | release target | next release | must not ship |
cannot ship | unreleasable | ships in vN.` raises the active count to 7 (all seven in this
roadmap's own file), `later/` to 1, `stubs/` to 5 and `archive/` to 91. Every one of the
six non-archive hits was read: a risk-table row about the global layer being a release
snapshot, three stub commentaries, one PR-scoping sentence, and one changelog-guard
requirement. None declares that a roadmap's own work must or must not ship with a release.
**The wider set does not change the zero.**

---

## 0.2 — The HEAD exposure row, and the historical row stated separately

Method: a file is **mid-flight** when it carries at least one `- [x]` and at least one
`- [ ]`. Counts are over all checkbox lines in the file, which is the same population the
dashboard aggregates.

### HEAD row (`7182f5d07`) — the only row a reader can act on

`agents/roadmaps/` holds **14** files: **7 `status: ready`** (the seven the dashboard counts
as open roadmaps) and **7 `status: draft`**.

| Roadmap | status | done | open | mid-flight |
|---|---|---:|---:|---|
| road-to-a-breaking-line-the-tree-does-not-contain.md | draft | 0 | 9 | no |
| road-to-a-conformance-check-that-can-fail.md | ready | 0 | 17 | no |
| road-to-a-declared-component-contract.md | ready | 0 | 23 | no |
| road-to-a-ledger-that-closes-the-loop.md | ready | 0 | 26 | no |
| road-to-a-release-head-field-nothing-derives.md | draft | 0 | 8 | no |
| road-to-adversarial-verification-and-long-runs.md | draft | 0 | 30 | no |
| road-to-behaviour-evidence-over-pixels.md | ready | 0 | 26 | no |
| road-to-bounded-approval-floor-waiver.md | draft | 0 | 18 | no |
| road-to-decision-closure.md | draft | 0 | 22 | no |
| road-to-reachable-loop-instruments.md | ready | 0 | 19 | no |
| road-to-recall-and-regeneration-followups.md | draft | 0 | 8 | no |
| road-to-release-holds-that-refuse.md | ready | 0 | 31 | no |
| road-to-the-substrate-stub-meeting-its-open-gate.md | ready | 0 | 18 | no |
| road-to-typed-grants-that-persist.md | draft | 2 | 29 | **yes** |

**1 of 14 mid-flight; 0 of the 7 `ready`.** Cross-checked against the generator rather than
asserted: `update_roadmap_progress` reports `7 roadmap(s) · 0/160 steps done`, so every
`ready` roadmap is at 0% and none of them can be mid-flight by construction.

### Tag row (`15.0.0`, `c86131ad7`) — the population the mechanism would have protected

| Roadmap at 15.0.0 | done | open | mid-flight |
|---|---:|---:|---|
| road-to-adversarial-verification-and-long-runs.md | 0 | 30 | no |
| road-to-bounded-approval-floor-waiver.md | 0 | 18 | no |
| road-to-decision-closure.md | 0 | 22 | no |
| road-to-delivery-for-every-host.md | 28 | 2 | **yes** |
| road-to-delivery-on-hook-hosts.md | 11 | 5 | **yes** |
| road-to-settings-writer-residual-debt.md | 0 | 7 | no |
| road-to-typed-grants-that-persist.md | 2 | 29 | **yes** |

**3 of 7, not 4.** The roadmap's 0.2 verify and the `zero-live-subjects` blocker both say
*"four of the seven active roadmaps were mid-flight when 15.0.0 shipped"*. The measured
figure is **three**. Seven active roadmaps at the tag is correct; the mid-flight count is
not. Both texts are corrected in the same change as this file.

Cost note, answering 0.2's own instruction to price the 30-tag sweep before scheduling it:
the row above needed one `git ls-tree` plus seven `git show` reads at one ref — under a
second. A 30-tag sweep is therefore roughly 30 x (1 + N) object reads with no `base_tree`
materialisation required at all, since `git show <ref>:<path>` reads the object directly and
`.gitattributes`' `/agents export-ignore` only affects `git archive`. The sweep is cheap;
it was simply never the row a reader can act on, which is why the HEAD row stands alone
above. Reproduction script: `agents/evidence/analysis/release-holds-exposure-row.sh`.

---

## 0.3 — The four release entry points against their consumer

Each row names the file and line a refusal would be wired into.

| # | Boundary | Consumer / trigger | Wiring point at `7182f5d07` |
|---|---|---|---|
| 1 | `release.ts` pre-flight | `task release`, and `--ci` from `release.yml`; runs before step 1 (`src/scripts/release.ts:1005`) | `src/scripts/release.ts:881` — the closing brace of `preflight()` (opens `:808`). A refusal added as the last check inside `preflight` runs before every step and before `execute()`. |
| 2 | Local gate registry | `task release:verify` / `release_verify`, reading `src/config/release-gate-locality.yml` | `src/config/release-gate-locality.yml:142` — append one job key under `jobs:` (`:56`), `verify: true`, `network: false`. |
| 3 | `release-validation.yml` + `ci-strict` | the release PR; `ci-strict` is the release-tag gate | `.github/workflows/release-validation.yml:497` — a tenth job, mirroring the nine at `:80`-`:468`. `ci-strict` inherits it through `Taskfile.yml:462` (`- task: ci`), which is the by-construction superset `check_ci_strict_superset` asserts; no separate `ci-strict` edit is needed or permitted. |
| 4 | `release-guard.yml` on the tag | `push: tags` and `workflow_dispatch` from `release.ts --ci` | `.github/workflows/release-guard.yml:49` — a new step in `assert-version-matches-tag` (`:31`), after the tagged checkout at `:44`-`:48` and before "Compare versions" at `:50`. The workflow already checks out the tagged commit, so the evaluator would read the tagged tree, not `main`. |

**Correction to 4.2's figure.** The roadmap says the registry was reproduced on 2026-09-11
with *"8 jobs, 4 carrying local commands"*. At HEAD it carries **9 jobs**; the "4 local gate
command(s)" half reproduces exactly — `release_verify --list` prints that number itself.
The nine are `release-shape`, `changelog-entry`, `surface-equality`,
`highlight-plausibility`, `version-consistency`, `finding-dispositions`, `audit-gate`,
`release-install-e2e`, `activation-census`; the four commands are the ones the tool prints,
`changelog-entry` and `highlight-plausibility` sharing one. Recorded here rather than edited
into step 4.2, which is inside the blocked phase range.

**Correction to the Goal section's figure.** The Goal says `release.ts` is *"1,826 lines
with exactly one occurrence of the word `roadmap`, at `:320`, inside a comment"*. At HEAD it
is **1,814 lines** and the single occurrence is at **`:322`**. The substance holds exactly —
one occurrence, in a comment, and the release path is roadmap-blind.

---

## 0.4 — The pre-registered claim

`release-hold-refuses-declared-state` is registered `unbacked` in `docs/CLAIMS.md` in the
same change as this file, with its falsifier, its denominator (30 tags past Phase 4) and its
honest-null branch stated before any mechanism exists.

---

## The `zero-live-subjects` decision, recorded rather than deferred

The blocker's `Resolved when` offers two branches: name a live subject with a `file:line`,
or record the honest-null branch as the accepted plan.

**No live subject can be named.** The active corpus holds zero release-coupling
declarations (0.1), zero of the seven `ready` roadmaps is mid-flight at HEAD (0.2), and the
one migration candidate the source named is archived with both of its coupling risks closed.
The strongest historical statement the evidence supports is the tag row: **3 of 7** active
roadmaps were mid-flight at `15.0.0`, which is the population a hold mechanism would have had
something to say about — and none of those three declared a coupling either, so even that
population is a population of *exposure*, never of *violations*.

**The honest-null branch is therefore the recorded plan**, and it is recorded here at
Phase 0 rather than discovered at Phase 6. What that commits the mechanism to, stated in the
direction that can fail:

- The claim ships pre-registered as unbacked with the null as a named outcome, so a Phase 6
  null is the predicted result and not a surprise.
- On the null, Phase 6.2's disposition holds: the primitive stays, the free parts go. A
  mechanism whose value stayed latent is not one that failed — but a claim that pretends
  there was a violation to catch would be.
- The owner's constraint is what carries the work, not a measured need: *a broken
  intermediate state must not ship by accident*. That is a statement about what must not
  happen, and the absence of an instance is consistent with it rather than evidence against
  it.

**What this does not settle.** Whether to spend the Phase 2-5 build against a latent need is
a judgement about cost, not about evidence, and it stays with the owner. This file removes
the evidentiary question from that decision; it does not answer the decision.

---

## Addendum, 2026-09-14 — the exposure row moved; the finding did not

Added, never substituted. Every figure above stays pinned to `7182f5d07` and to tag `15.0.0`,
because a measurement that names the commit it was taken at is the only kind a later reader can
reproduce. This section records a second reading at a later head, taken after eight sibling PRs
merged and `main` advanced to `b4019fa12`.

**The 0.1 finding is unchanged.** The narrow grep still returns exactly two hits in the active
corpus, both self-references inside this mechanism's own roadmap. Zero substantive
release-coupling declarations, same as at `7182f5d07`.

**The 0.2 exposure row moved sharply**
(`bash agents/evidence/analysis/release-holds-exposure-row.sh HEAD`):

| Reading | Active files | Mid-flight | Of the `ready` subset |
|---|---:|---:|---|
| `7182f5d07`, 2026-09-13 | 14 | 1 | **0 of 7** |
| merged head, 2026-09-14 | 14 | **6** | **4 of 7** |

The six are `road-to-a-declared-component-contract.md` (3 done / 20 open),
`road-to-behaviour-evidence-over-pixels.md` (23 / 3), `road-to-bounded-approval-floor-waiver.md`
(17 / 2), `road-to-release-holds-that-refuse.md` (4 / 27 — this file),
`road-to-the-substrate-stub-meeting-its-open-gate.md` (14 / 4) and
`road-to-typed-grants-that-persist.md` (4 / 27).

**What this changes, and what it does not.** The *exposure* population is no longer the
near-empty set the 2026-09-13 reading found: within one day it went from one file to six, and
from none of the ready roadmaps to four of seven. A tree where most active work is mid-flight at
any moment is the condition this mechanism was written for, and the 2026-09-13 reading understated
how normal that condition is — it was a quiet day, not a quiet tree.

It does **not** produce a live subject, and the `zero-live-subjects` decision does not turn on
the exposure count. It turns on whether any roadmap *declares* that its intermediate state must
not ship, and that count is still zero on both readings. Exposure is the population a mechanism
could protect; a declaration is an instance of it being needed. Reading the jump from 1 to 6 as
evidence that the mechanism is now justified would be exactly the substitution the honest-null
branch exists to prevent.

What it does do is strengthen the *prior* the owner is deciding against: the latent need is
larger and more routine than one day's snapshot suggested, which is an argument about cost and
frequency rather than about evidence.

### Third reading, 2026-09-14 (later the same day) — saturation, and the first near-miss

Appended, nothing above substituted. Taken at `aed1e94f6`, a branch off `main` at `7b5f75edc`,
with `bash agents/evidence/analysis/release-holds-exposure-row.sh HEAD`.

| Reading | Active files | Mid-flight | Of the `ready` subset |
|---|---:|---:|---|
| `7182f5d07`, 2026-09-13 | 14 | 1 | **0 of 7** |
| merged head, 2026-09-14 | 14 | **6** | **4 of 7** |
| `aed1e94f6`, 2026-09-14 | **10** | **10** | **6 of 6** |

The active corpus shrank from 14 to 10 as four roadmaps archived, and **every** surviving active
roadmap is now mid-flight, `ready` and `draft` alike. The exposure row has gone from 1-of-14 to
saturation inside two days.

**The declaration count is still zero, and that is still the number this decision turns on.** The
narrow grep re-run at this ref returns nothing in `agents/roadmaps/*.md` outside this file's own
self-references. Saturation makes the *population* total; it produces no instance. The warning in
the addendum above applies with more force, not less: the more dramatic the exposure figure gets,
the more tempting it is to read it as the live subject it is not.

**The first near-miss in the corpus, and it resolves one rung below a hold.** Extending the grep
to `later/` and `stubs/` — folders the 2026-09-13 sweep also covered and found empty — returns
exactly one hit at this ref:

    agents/roadmaps/stubs/road-to-main-protection-ruleset-changes.md:146

It reads *it must land in the same small PR as the enablement*, about adding `merge_group:`
triggers ahead of enabling a merge queue. **This is not a release hold and must not be counted as
one.** It is PR atomicity, and the stub's own sentence says why: the trigger *"is inert until the
queue exists"*. Inert-until-wired is the **guard** rung of rule 28's authoring order; landing the
two together in one diff is the **re-sequence** rung. A hold is rung three, and this case never
reaches it.

That makes it the most useful finding of the three readings, and it points the same way as the
other two. The closest thing to a release-coupled state anywhere in the tree was resolved by its
author, without any vocabulary for holds existing, using precisely the two cheaper answers rule 28
would have told them to try first. That is evidence **for** the honest-null branch — the ladder's
top two rungs absorb the real cases — and it is the first positive evidence about the ladder
rather than about the population. It does not close `zero-live-subjects`, which remains a cost
judgement and remains the owner's.

---

## 2.3 — The wider glob, measured before it was wired (added 2026-09-19)

Step 2.3's verify asks that the p95 sit "under the budget derived there", meaning in this
file. **No budget was derived here on 2026-09-13** — Phase 0 derived the four wiring points
and the exposure row, never a runtime budget. The step's premise was wrong, so the budget is
derived now, from a measurement rather than from a number someone liked.

**What the glob actually costs.** `check_release_holds`' `globRoadmaps` walks five folders —
the active root plus `later/`, `archive/`, `skipped/` and `stubs/` — because rule 28's
per-folder lifecycle says a window does not disappear by moving the file. That is **950
markdown files**, against the 12 the active-only gates read.

    n=25 in-process runs of collect() over the real corpus
    files = 950
    min 54.3 ms · median 55.0 ms · p95 56.2 ms · max 61.8 ms

**The budget, and why this one.** The nearest accepted comparable is
`lint_roadmap_blockers`, which already runs on the pre-push path and already reads the
archive — 725 files, three consecutive wall-clock runs of **0.25 s, 0.25 s, 0.26 s**
including process start. A corpus read of the same class that the repository has already
accepted at ~250 ms is the honest ceiling, so the budget is **250 ms p95**. The measured
56.2 ms is **22 %** of it.

Two things this does NOT claim. The 56.2 ms is the evaluator's own work measured in-process,
not a wall-clock CLI figure — process start dominates a one-shot invocation and is not
attributable to the glob. And 25 runs on one warm machine is a reading, not a distribution:
it establishes the order of magnitude, which is all the "can we afford the wider glob"
question needs, and it would not survive being quoted as a performance guarantee.

**No index is built in v1**, as the step requires: `collect()` reads and parses on every
call. At 22 % of an accepted gate there is nothing an index would buy that would justify the
staleness surface it adds.

---

## The measurement window opened at `16.1.0` (added 2026-09-30)

Taken at `origin/main` `1f442155a`. This section exists because the
`measurement-window-not-open` blocker's own evidence had gone stale in the direction that
matters: it read *"the denominator is **0** … the window opens at the first tag after this PR
merges"*, and the window had in fact opened two days earlier. The blocker is still open — 1 of
30 is not 30 — but its record now names a ref instead of predicting one.

### The anchor, and why it is a ref rather than a date

The first commit carrying the evaluator is `3f342103168e56d0168655c12141829f5e1d6ca0`. Running
the blocker's own counting snippet against it:

```bash
first=$(git log --reverse --format=%H -- src/scripts/check_release_holds.ts | head -1)
git tag --contains "$first" --sort=creatordate     # -> 16.1.0
```

Exactly one tag. **`16.1.0`, cut 2026-09-28**, is the first tag whose tree carries the evaluator;
`16.0.0` does not (`git ls-tree --name-only 16.0.0 src/scripts/check_release_holds.ts` is empty),
which confirms the boundary rather than assuming it.

**Denominator: 1 of 30.** Pinning the anchor as a tag is the useful half — a future Phase 6 run
counts `git tag --contains 3f34210` and is done, instead of re-deriving which cut started the
clock from a date that no longer maps cleanly onto the tag list.

### The gate was wired at that cut, verified rather than assumed

A tag whose tree carries the *evaluator* proves nothing on its own; the question is whether the
*boundaries* were wired, because an unwired evaluator would make `16.1.0` a tag the window
should not count. All three boundaries reproduce at the tag itself:

| Boundary | At `16.1.0` |
|---|---|
| `release-validation.yml` | job `release-holds` at `:499`, running `--lint` (`:527`) and `--require-safe --channel all` (`:530`) |
| `release-guard.yml` | both commands inside `assert-version-matches-tag`, `:59-60` |
| `src/config/release-gate-locality.yml` | row `release-holds` at `:144` |

So `16.1.0` counts: a declared hold would have had something to refuse it at.

### What the first observation was: a permitted cut, and that is the expected shape

`16.1.0` is a bare `X.Y.Z`, so it is a stable cut and the channel is `all` — the strictest
reading, under which every open hold refuses. It was permitted, because the corpus declares
nothing. Both numerator arms therefore stand at zero after one tag:

- **arm (a), refusals logged: 0.** One cut passed the wired refusal and was permitted.
  `grep -rn '^### hold:' agents/roadmaps/` returns **0** across the whole corpus — there was no
  declaration for the cut to trip over.
- **arm (b), logged re-sequences: 0.** The only `resequenced:` string anywhere under
  `agents/roadmaps/` is this roadmap's own step 1.4 describing the eval fixture, not a live log
  entry from an author who chose rung 1 over rung 3.

This is the predicted shape, not a surprise — the claim row named the null as the expected
outcome before the mechanism was buildable. It is recorded here so the reading is a measurement
at a known n rather than an impression, and **n=1 settles nothing in either direction**: the
claim row's own words forbid citing an underpowered window, and one permitted cut over an empty
corpus is the least informative observation the window can produce.

### Fourth reading of `zero-live-subjects` — exposure moved again, the finding did not

Re-run of the blocker's own narrow grep at `1f442155a`, extended to `later/` and `stubs/` as the
third reading did:

| Reading | Active files | Mid-flight | Of the `ready` subset |
|---|---:|---:|---|
| `7182f5d07`, 2026-09-13 | 14 | 1 | 0 of 7 |
| merged head, 2026-09-14 | 14 | 6 | 4 of 7 |
| `aed1e94f6`, 2026-09-14 | 10 | 10 | 6 of 6 |
| `16.1.0`, 2026-09-28 | 10 | 9 | — |
| `1f442155a`, 2026-09-30 | **18** | **14** | **9 of 12** |

The corpus nearly doubled as new roadmaps landed, and saturation broke — 14 of 18 rather than
10 of 10. **The declaration count is unchanged at zero.** The grep returns three
self-references inside `road-to-release-holds-that-refuse.md` (two non-goal sentences and the
blocker's own quoted command) and one hit outside it:
`agents/roadmaps/stubs/road-to-main-protection-ruleset-changes.md:146`, the same near-miss the
third reading found, with the same wording and still resolving at the **guard** and
**re-sequence** rungs rather than at a hold.

The third reading's warning survives its own strongest test. Exposure went to saturation, then
came back off it, and through both moves the number this decision turns on did not move at all.
A population figure that swings from 1-of-14 to 10-of-10 to 14-of-18 in seventeen days while the
instance count stays at zero is a fairly direct demonstration that the two are measuring
different things.

`zero-live-subjects` is unchanged and stays the owner's: its `Resolved when` asks for an
*accepted* plan, and the evidentiary half has been closed since 2026-09-14. Nothing in this
reading is new information for that decision — which is itself the point of taking it.


## Parking reading, 2026-10-01 — the roadmap moved to `later/`, and why that is the honest close

`agents/roadmaps/road-to-release-holds-that-refuse.md` is now
`agents/roadmaps/later/road-to-release-holds-that-refuse.md`. Phases 0 through 5 are complete
and merged; Phase 6 and AC-9 are the only open work and they are defined over elapsed release
tags, which is not work any session can perform. This section records the three measurements
that run took, so the next one re-derives none of them.

### The denominator, executed rather than read

```
git tag --contains 3f342103168e56d0168655c12141829f5e1d6ca0 --sort=creatordate
```

returns exactly `16.1.0`. **1 of 30.** `git tag --sort=-creatordate | head -1` also reads
`16.1.0` (2026-09-28), so nothing was cut in the three days since the 2026-09-30 reading and the
figure is unchanged rather than merely unrechecked. The anchor ref
`3f342103168e56d0168655c12141829f5e1d6ca0` is now pinned in the parked roadmap's frontmatter
`entry_condition.what`, which is the shape `lint_roadmap_later_disposition` reads — so the wake
test is one command and not a reconstruction. Both earlier readings had to recover that ref from
`git log --reverse -- src/scripts/check_release_holds.ts` first, and a condition that must be
rebuilt before it can be checked is a condition nobody checks.

### Fifth reading of `zero-live-subjects` — a new active hit, and it is not a hold

The declaration grep returned, for the first time, a hit in the active corpus that is not a
self-reference: `agents/roadmaps/road-to-a-ui-coverage-ledger-that-can-fail.md:188`, on a step
whose verify reads *"the flip lands in its own change, after 3.1 has shipped one release"*. It is
a genuine release-coupled intermediate state and it was authored independently of this work.

It is **not** the live subject the blocker waits for, by the distinction step 1.3 wrote into
template rule 20: a blocker stops execution, a hold stops publication. That state must not
*advance* until a release ships; publishing it is safe, and publishing it is how the condition
clears. Its author modelled it on 2026-09-30 as a structured `shadow-release-window` blocker with
an inline `blocked-by:` marker, reaching for no hold vocabulary at all. `grep -rn '^### hold:'`
over `agents/roadmaps/` still returns **0**.

What it is, is the second positive datum about the *ladder* rather than about the population, and
it points the same way as the first. The third reading found a near-miss resolving at the guard
and re-sequence rungs; this one finds a near-miss resolving at the blocker rung. Two independent
authors, neither reaching for a hold, both landing on a cheaper mechanism that already existed.
That is evidence for the honest-null branch — recorded, not argued into a resolution, because the
`Resolved when` asks for an *accepted* plan and acceptance is the owner's act.

One thing the parking does change about that decision, and it is worth saying plainly: nothing
executable waits on it any more. Phase 4 shipped on 2026-09-19, so `zero-live-subjects` is no
longer a go/no-go on building a mechanism — it is a retrospective cost judgement about one that
is already in the tree and already wired at four boundaries.

### The move was cleared by the mechanism this roadmap built

```
./scripts-run src/scripts/check_release_holds --can-move \
  agents/roadmaps/road-to-release-holds-that-refuse.md later
```

exits 0 with *"no live window — the move to `later/` is permitted"*. The file declares no hold,
so there is nothing for step 3.1's lifecycle guard to refuse — but asking it rather than assuming
is the behaviour rule 28's per-folder clause asks for, and it is cheap.
