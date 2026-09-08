---
complexity: lightweight
status: ready
execution:
  mode: interactive
owner: maintainer
relates:
  - slug: road-to-the-packed-payload-cap
    relation: disjoint
    note: >
      Sibling receiver from the same run, and deliberately NOT folded into it:
      that file's own opening line says it exists to hold one owner-reserved
      blocker and nothing else, so a second subject would contradict it.
estate_growth_exempt: "Orchestrator-instructed 2026-09-08, after the run found the gap with `git status` rather than with a gate and the orchestrator ruled that a real coverage gap in a ratcheted metric deserves a receiver rather than a sentence in a report. +1 active with no offset in the same change, and that is the honest shape: the alternative was a stub, which is where this repository files decision-shaped work — but `stubs/` is explicitly out of the active estate, and a gap that lets a RATCHETED metric under-report is the one class that must not be parked somewhere no ratchet reads. Measured rather than argued: 23 archived roadmaps carry `- **Status:** open` today and no gate reads any of them."
estate_offset_exempt: "Offsets nothing, and the reason is arithmetic rather than argument: this change adds TWO active roadmaps and archives ONE, so one addition is genuinely unoffset and it is this one. The archival of `road-to-a-graph-that-is-shipped` pairs with `road-to-the-packed-payload-cap`, which exists only because that roadmap archived — the blocker had to land somewhere for the sweep to release it. This file is the opposite shape: work DISCOVERED during that archival, with nothing to trade against it. Closing, parking or folding it each cost more than the charge — closing means choosing among three assertions the run measured but was not asked to decide, parking means `later/` or `stubs/`, both of which no ratchet reads, and the gap it records is precisely one that lets a ratcheted metric under-report."
design_validated: "gap measured 2026-09-08 — 193 archived roadmaps carry a blocker section, 23 of them `Status: open`, and both gates that would report them exclude the directory. The FIX is not validated; see § The fix is a decision, not wiring."
capability_gap: none
---
# Road to a blocker that cannot hide in the archive

> **Found by accident, which is the point.** During the archival of
> `road-to-a-graph-that-is-shipped` on 2026-09-08, `git mv` staged the rename
> against the index while the edit removing that roadmap's blocker was still
> unstaged. The archived file therefore shipped with a blocker section that had
> already been relocated to another roadmap — **the same blocker declared open in
> two files at once, one of them archived.** It was caught by reading
> `git status`, not by any gate, and this roadmap exists because that is a
> coverage gap rather than a lucky escape.

## Goal

An archived roadmap cannot silently carry a blocker that claims to be open.

## The gap, measured

Two gates read roadmap blockers, and both skip the archive:

| Gate | Where the exclusion is | What it means |
|---|---|---|
| `lint_roadmap_blockers` | `src/scripts/lint_roadmap_blockers.ts:28` — *"`later/` and `archive/` are outside this gate's contract"* | The five-field blocker contract is never checked on an archived file |
| `check_estate_count` (via `update_roadmap_progress`) | `src/agent-src/scripts/update_roadmap_progress.ts:97` — `EXCLUDE_DIRS = {archive, skipped, stubs, later}` | `open_blockers` counts active roadmaps only |

Consequence, measured on this tree at 2026-09-08:

```
grep -rl '^### blocker:'                  agents/roadmaps/archive/*.md | wc -l   → 193
grep -rlE '^- \*\*Status:\*\* *open'      agents/roadmaps/archive/*.md | wc -l   →  23
```

**193** archived roadmaps carry a blocker section and **23** of them carry
`Status: open`. Whether all 23 are genuine historical records or some are stale
duplicates like the one this run created is exactly what nobody can currently
answer, because nothing reads them.

**That first figure was 192 when this file was written hours earlier, and the
drift is evidence rather than an erratum.** One base merge — another lane
archiving `road-to-a-standing-budget-with-headroom` — moved it to 193, and the
only reason anyone noticed is that this run re-ran its own `grep` before
reporting. A corpus that grows by one per archival, with no gate reading it, is
the shape of the problem this roadmap holds. Whoever picks an assertion in
Phase 1 should re-measure rather than trust either number: both were true, on
different trees, hours apart.

And the ratchet consequence is the one that matters: `open_blockers` is a
**shrink-only ratchet**, and a blocker that moves from an active roadmap into an
archived one leaves the count while remaining declared open. That is a metric
that can be satisfied by archiving rather than by resolving. This run did not
exploit that — the blocker it moved went to another **active** roadmap and the
count stayed at its floor, verified `open_blockers 44 (floor 44, +0)` — but
nothing prevented the other outcome.

## The fix is a decision, not wiring

```
DO NOT SIMPLY SCAN `archive/`. THAT IS THE OBVIOUS FIX AND IT IS THE WRONG ONE.
```

Extending either gate's corpus to `archive/` would land **23 findings on day
one**, none of them caused by the change that landed the gate. This repository
has refused that shape before in writing, and the refusals are the precedent to
read before choosing: `lint_roadmap_later_disposition`'s baseline note records
*"a gate that fails its own tree on 68 files the landing change did not cause is
reverted rather than adopted"*, and `check_no_new_legacy_path` carries the same
reasoning at 46.

There is also a real reason the exclusion exists: an archived roadmap is a
historical record, and a blocker that was genuinely unresolved when its roadmap
closed is a true thing for it to say. A gate that forbids that would be
falsifying history to satisfy a count.

So the question this roadmap holds is **what a fix should assert**, and the
candidates differ in what they would have caught:

1. **Assert on the TRANSITION, not the corpus.** `archive_completed_roadmaps`
   already refuses to archive a roadmap with an open blocker — it is what
   refused `road-to-a-graph-that-is-shipped` for a day. Make it re-read the file
   it is about to move **from the working tree** rather than trusting the index,
   and refuse on a `Status: open` it finds there. Day-one findings: **zero**,
   because it only ever fires on a future archival. Would have caught this run's
   duplication exactly, since the working tree and the index disagreed.
2. **Assert non-duplication across the whole tree.** No blocker id may appear
   with `Status: open` in more than one file, active or archived. Day-one
   findings: unknown, needs measuring — and it catches a class the transition
   check misses (a blocker copied rather than moved).
3. **Ratchet the archived corpus separately.** A second shrink-only baseline at
   23, so the count cannot grow. Day-one findings: zero by construction, and it
   makes the 23 visible and shrinkable. Cheapest, and asserts the least.

(1) is the narrowest fix that would have caught the observed defect. (3) is the
cheapest way to stop the ratchet-by-archiving hole. They are not exclusive.

## The decision — taken 2026-09-08

```
CHOSEN: (1b) + (1a) AT THE TRANSITION, AND (4) OVER THE TREE.
REJECTED: (3) THE RATCHET AT 23. REJECTED: (2) AS ORIGINALLY SCOPED.
CORRECTED: (1) AS WRITTEN ABOVE IS INVERTED AND WOULD HAVE BEEN A NO-OP.
```

**The AI council decided this, not the run.** 2 seats present (2/2 quorum,
`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, api transport, USD 0.0780 spent
against a USD 0.4192 estimate), 2026-09-08. Both seats converged on
(1b) + (1a) as the primary fix and both rejected (3); the anthropic seat
supplied the (4) refinement and the (2) refutation, and the openai seat's
"periodic review session" proposal was set aside as a process rather than an
assertion.

### (1) as written above is factually inverted

Option (1) says *"make it re-read the file it is about to move from the working
tree rather than trusting the index"*. The archival sweep **already** reads the
working tree: `parse_roadmap` (`src/agent-src/scripts/update_roadmap_progress.ts:645`)
uses `fs.readFileSync`, and `archive_completed` refuses on
`stats.open_blockers.length > 0` computed from that reading. Implementing (1) as
described would have changed nothing.

The mechanism runs the other way. `git mv` renames the working-tree file **and
moves the index entry**, which still holds whatever was staged; the sweep never
`git add`s the destination. So the reading that was validated is the working
tree and the content that gets committed is the index. On 2026-09-08 the
unstaged removal meant those two disagreed, and the commit shipped the index.

That correction also settles a second thing: **(4) is unreachable as a
transition check.** The sweep already refuses to archive a roadmap carrying any
open blocker in the working tree, so at the moment of archival there is never an
open blocker to overlap with. (4) is therefore implemented as a tree-wide
assertion, which is where the class it catches actually lives.

### What shipped

| # | Assertion | Where | Day-one findings |
|---|---|---|---|
| 1b | Refuse archival when the **staged** and **working-tree** blocker id→status maps of the file being moved disagree | `archive_completed_roadmaps.ts` — `_blockerDivergence`, checked after the changed-only skip and before `git mv` | **0** — fires only on a future archival |
| 1a | `git add` the destination after a tracked `git mv`, so the commit carries the content the checks read | same file, immediately after the move | **0** — not an assertion |
| 4 | No blocker id may be declared `Status: open` in **both** an active and an archived roadmap | `lint_roadmap_blockers.ts` — `_archiveOverlap`, hard, no baseline | **0**, measured |

### How the day-one count was measured

Not asserted — computed, twice, by two independent readers that agree:

```
# ad-hoc measurement, before the gate existed (base 5ef117448, 2026-09-08)
active open blocker ids:   12
archived open blocker ids: 33
OVERLAP (open in both an active and an archived roadmap): 0
```

```
# the shipped gate, same tree
$ ./scripts-run src/scripts/lint_roadmap_blockers
✅  13 roadmap(s) blocker-contract-clean
✅  0 blocker id(s) open in both an active and an archived roadmap (699 archived file(s) read)
✅  lint_roadmap_blockers:decidability: 0 violation(s), no baseline needed.
```

Zero, so (4) ships **hard and without a baseline** — the bar 1.1's verify sets.
The 193 / 23 figures from § The gap, measured were re-derived on this tree and
both still hold; they count *files*, while 33 counts *ids*, and 23 files
carrying 33 open ids is consistent.

### Why (3) was rejected

A shrink-only baseline at 23 pins a number over a corpus nothing else reads, and
its two possible readings are both bad: if the 23 are genuine history the ratchet
forbids future genuine history, and if they are stale it preserves the staleness.
Both seats rejected it independently. The hole it was meant to close —
`open_blockers` being satisfiable by archiving rather than resolving — is closed
by (4) instead, which asserts the contradiction rather than pinning the count.

### Why (2) was rejected as originally scoped

*"No blocker id may appear with `Status: open` in more than one file"* forbids a
legitimate state: one cross-cutting blocker declared open in two **active**
roadmaps. (4) narrows it to active-vs-archived, which is the pair that
contradicts itself.

### What this leaves uncovered — named, not closed

- **Two blocker ids are declared open in more than one *archived* file**
  (`background-continuation-probe`, `benchmark-spend-authorization`). In scope
  for a hypothetical archive-vs-archive assertion, out of scope here for exactly
  the day-one reason § The fix is a decision gives: a hard gate there would red
  the build on 2 records this change did not create.
- **The 23 archived files carrying open blockers are still unread.** (4) proves
  none of them collides with the active tree, which is strictly weaker than
  "none of them is stale".
- **An untracked new roadmap during archival** — the council's option (1c). A
  roadmap written but never staged can hold the same blocker while an archival
  moves it; (1b) reads the index of the file being *moved* and sees nothing.
  Left as a follow-up because refuse-vs-warn scoping needs its own decision.
- **A blocker copied into an archived file with `Status: resolved`** while the
  active copy stays open. Not a contradiction by (4)'s definition, and
  deliberately so: a closed record of work planned elsewhere is legitimate.

## Phase 1 — Decide and implement

- [x] **1.1 Pick among (1), (2), (3)** above — or a fourth the reader sees — and
      say in the same change which day-one finding count the choice carries and
      how it was measured.
      verify: the chosen assertion is implemented, its gate exits 0 on this tree
      **without a baseline** if the choice claims zero day-one findings, or with
      a baseline whose note states the measured count if it does not.
- [x] **1.2 A sensitivity case, not just a green run.** Reconstruct this run's
      defect — an archived roadmap whose working-tree content and index content
      disagree about a blocker — and prove the new assertion goes red on it.
      verify: neutralising the assertion turns that case green again, so the
      case is known to have teeth rather than assumed to.

## The sensitivity probes — each mechanism seen red

Every mechanism this change adds was neutralised, watched fail, and restored by
a reverse edit (never `git checkout` — a checkout of a file under an unstaged
sabotage discards the surrounding work with it). Three mechanisms, three probes,
2026-09-08:

| Mechanism | Neutralisation | Result |
|---|---|---|
| (1b) `_blockerDivergence` | early-return `[]` unconditionally | the reconstruction test goes **red**; the other three stay green |
| (1a) `git add` of the destination | guard the call with `false &&` | the staging-hygiene test goes **red**; the other three stay green |
| (4) `_archiveOverlap` | guard the overlap push with `false &&` | the overlap test goes **red**; 34 of 35 stay green |

The "others stay green" column is the half that matters: it shows each test is
watching its own mechanism rather than all four failing together on any edit.

After all three restores: **69 tests green** across
`archive_index_divergence`, `lint_roadmap_blockers`, `archive_completed_roadmaps`
and `archive_deferral_resolution` — the last two unchanged by this work, run to
prove the transition check did not regress the sweep.

The premise itself was reproduced before any test was written, so the mechanism
is measured rather than reasoned about — see the header comment of
`tests/scripts/archive_index_divergence.test.ts` for the six commands.

### (1a) confirmed on this roadmap's own archival

The sweep that archived this file exercised (1a) against the real defect shape,
which is stronger evidence than the fixture. At the moment of the move the
roadmap's working tree carried every edit above and the index carried the
version committed on `main` — the two disagreed, exactly as they did on
2026-09-08. After the sweep:

```
$ git diff --name-only -- agents/roadmaps/archive/road-to-a-blocker-…-archive.md
(empty)
$ git show :agents/roadmaps/archive/road-to-a-blocker-…-archive.md | grep -c 'The decision — taken 2026-09-08'
1
```

No unstaged residue, and the staged content is the edited one. Without the
`git add`, the index would have held the pre-edit file and the commit would have
archived this roadmap with none of the decision it records — the same class of
loss, on the change that fixes it.

(1b) stayed silent here, correctly: this roadmap declares no blockers on either
side, so there was no blocker disagreement to refuse. That is the narrow
scoping doing its job rather than the check failing to fire.

## What this roadmap is NOT

- **Not a claim that the 23 are wrong.** They are unread, which is different.
  Reading them is part of (2) or (3), not a premise of this file.
- **Not a proposal to scan `archive/` wholesale.** § The fix is a decision says
  why, with the two precedents that refused that shape.
- **Not owner-reserved.** Unlike its sibling receiver, nothing here needs an
  owner ruling: no floor is lowered and no ratchet is moved. `owner: maintainer`
  marks who should choose the assertion, not a permission gate.

**AC-1 is ambiguous and both readings are met.** The council's sharpest finding
was that *"detected by a gate"* does not distinguish **reporting** the defect
from **preventing** it, and that the observed defect was in fact visible in
`git status` — what failed was prevention. The criterion is left as written
rather than rewritten mid-run, because the bar a run is measured against is not
the run's to move. It is satisfied on both readings: (1b) refuses the archival
with a diagnostic naming the id and both statuses, and (4) reports the
contradiction wherever else it arrives.

## Provenance

- **Source:** discovered 2026-09-08 by the autonomous run of
  `road-to-a-graph-that-is-shipped`, from the `git mv`/index defect described
  above. Not from an analysis round and not from an external reference.
- **Council:** none, and it was unavailable rather than skipped — both
  configured seats measured `50/50 · exhausted` (`council_cli quota`,
  2026-09-08), the other three are disabled seats, and `api_on_quota: off`
  forbids the metered rung. The decision this file holds is therefore **not**
  taken here: the run recorded the gap and its options and left the choice.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | The obvious fix lands 23 findings and gets reverted | implementation | Extending either gate's corpus to `archive/` is the first thing a reader will try, and it fails this tree immediately on files the landing change did not cause — the shape this repository has already reverted twice. | § The fix is a decision names the two precedents by gate, states the 23 up front, and puts the day-one count in 1.1's own verify so a choice cannot be made without measuring it | Phase 1 |
| 2 | The ratchet-by-archiving hole is left open while the assertion is debated | product | `open_blockers` is shrink-only, and until something reads the archive a blocker can leave the count by being archived rather than resolved. The debate over (1) vs (2) could outlast several archivals. | Option (3) is a standalone, zero-day-one-finding ratchet that closes this specific hole without settling the wider assertion, and § The fix says the three are not exclusive | Phase 1 |
| 3 | A transition-only check (option 1) misses a copied blocker | implementation | (1) fires on archival, so a blocker duplicated into an archived file by any other route — a hand edit, a bad merge — stays invisible. | Named in (1)'s own description and is precisely what (2) covers; 1.1 requires the chooser to say which class the choice leaves open | Phase 1 |

## Acceptance Criteria

- [x] AC-1 An archived roadmap carrying `Status: open` is detected by a gate
      rather than by a human reading `git status`.
- [x] AC-2 The chosen assertion's day-one finding count on this tree is measured
      and recorded, and is zero unless a baseline note states otherwise.
- [x] AC-3 The sensitivity case from 1.2 exists and has been seen red.
