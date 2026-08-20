---
complexity: lightweight
status: ready
estate_offset_exempt: "Every item is a defect measured in one instrumented session: a security guard that blocks legitimate commands, four authoring conventions learnable only by failing a gate, four ergonomic defects in one CLI, a wait pattern that reported a false verdict to the user, and a memory store whose index is organised by topic rather than by the moment a note applies. All six were paid for in that session and none has an owner. Dropping them is not available under fix-what-you-see. Archiving buys nothing — no active roadmap sits at zero open steps — and parking in later/ is what the estate register calls burial. Charged as one reviewable line, per this gate's own instruction."
execution:
  mode: phase-checkpoints
---
# Road to agent velocity — the 21 % of a session that was self-inflicted

> **Source:** an instrumented read of one session's own transcript, 2026-08-20.
> The task was "create one roadmap and open a PR". It took **140 tool calls**,
> and roughly **30 of them (21 %) were corrections of the agent's own errors** —
> not analysis, not verification, not the work.
>
> **The finding is not "the agent was careless".** Nine of the eleven error
> classes were **already documented in the memory store**, each in its own file,
> all nine verified present. They were read *after* the failure, never before it.
> So the deficit is not knowledge. It is delivery, tooling and shape — the same
> diagnosis this repository keeps reaching one layer down, applied to the agent's
> own loop.

## 0. The measurement

| Class | Cost | Already in memory? |
|---|---|---|
| A security guard blocking legitimate commands | 1 call per occurrence, and it recurs | no — this is new |
| Four roadmap authoring conventions learnable only by failing a gate | ~3 calls, 2 gate rounds | yes, one file |
| Council CLI ergonomics | ~6 calls for one council run | yes, one file, partially |
| A hand-written CI waiter with a wrong exit condition | 4 calls **and a false statement to the user** | yes, two files |
| A text edit anchored on a heading that also appears as a quotation | 5 calls, and the risk register was lost in between | yes, adjacent file |
| Ordering of `sync` and `generate-tools` | ~4 calls, 3 preflight rounds | yes, one file |

Two further costs are named and deliberately **not** worked here, because they
were not defects: the 50-session read (calls 1–48) was the task, and the two
rewrites forced by material arriving mid-turn were the maintainer supplying more
input, which is not waste.

## Phase 1 — the guard that blocks legitimate commands

`block_no_verify` exists to stop `git commit --no-verify`. It is scoped to git
invocations. It does not stay scoped: reproduced on this tree, four probes
through the real dispatcher —

```
sed  -n 1,5p file.md                          → allowed
git status --porcelain; sed  -n 1,5p file.md  → BLOCKED (exit 2)
grep -n foo file.md                           → allowed
git status;              grep -n foo file.md  → BLOCKED (exit 2)
```

Once a git command appears anywhere in the same shell string, **every later
`-n` in that string is read as `--no-verify`**. `sed -n`, `grep -n`, `head -n`,
`sort -n`, `tail -n` — all of them, in any compound command that also touches
git. That is most inspection commands an agent writes.

**The same defect has a second face, found while fixing the first, and it is
the serious one.** The cause is that POSIX shlex leaves a separator attached to
the preceding word: `git status; sed` tokenises as `['git','status;','sed',…]`,
so the line never splits into groups. When git comes SECOND, the single group
starts with something else, `_git_base` returns null — and the git command is
**never scanned at all**. Measured through the real dispatcher on 2026-08-20:

```
echo hi; git commit --no-verify -m x    → ALLOWED   (bypass)
echo hi & git commit --no-verify -m x   → ALLOWED   (bypass: `&` was not in
                                                     the separator set either)
echo hi ; git commit --no-verify -m x   → blocked   (spaced form worked)
```

A guard that a stray missing space disables is not a guard. This phase is
therefore a security fix with an ergonomic side effect, not the reverse.

Three things make this worth fixing before anything else in this file. It is a
**false positive on a security guard**, which is the class that trains people to
look for bypasses. Its message names no alternative, so the reader learns only
that something is forbidden. And it is cheap: the segmentation logic already
exists for `&&`, `||`, `;` and `|` — it is simply not applied before the
git-token scan.

- [x] **1.1 Pin the defect with a failing test first.** The four probes above,
      as a test that fails on today's code. A guard fix without a red-first test
      is indistinguishable from a guard weakening.
      verify: the test fails against `HEAD` before the fix and passes after.

- [x] **1.2 Segment before scanning.** Only the tokens of a segment whose
      command word is `git` reach `_is_blocked`. The existing separator set is
      reused rather than a second one written.
      verify: `git status; grep -n foo` is allowed and `git commit --no-verify`
      is still blocked, both in the same test run.

- [x] **1.3 Prove the guard still guards.** The bypass forms it was built for —
      `--no-verify`, `-n`, bundled short flags, `core.hooksPath`, command
      substitution — each keep a test that fails when the segmentation change is
      reverted to allow-everything. The risk of this phase is a guard that
      passes its new test by no longer guarding.
      verify: reverting `_is_blocked` to a permissive stub reds at least one
      test per bypass form.

- [x] **1.4 Name the alternative in the refusal.** When the guard blocks, the
      message says what to do instead — for the genuine case, and for the
      compound-command case if any survives.
      verify: the refusal text names a concrete alternative, asserted by test.

## Phase 2 — a roadmap skeleton nobody can get wrong

Four conventions are enforced by four different gates and documented in prose
the author must already know to look for: the `complexity:` value is a
two-item enum (`lightweight` / `structural` — and a neighbouring roadmap on the
trunk currently declares a third value and reds the gate), the acceptance
heading must match a pattern that is **case-sensitive and end-anchored**, the
risk register needs a `<!-- risk-review: … -->` marker as its first non-blank
line, and the risk type is a two-value enum where the natural third word fails.

This session hit two of the four, and it had the memory file open. The file is
correct; being correct is not the same as arriving before the mistake.

**A third was hit while writing this very file**, which is the argument in
miniature: a risk row was anchored under `Phase 0 — the measurement` while the
heading reads `0. The measurement`, and `lint_plan_risk_register` refused it as
a dangling anchor. The convention is real, the gate is right, and knowing about
it did not help — the anchor was written from the shape the other roadmaps use,
not from this file's own headings.

- [x] **2.1 Emit a gate-clean skeleton.** One command produces a roadmap file
      that passes every roadmap gate with zero content edits: valid complexity,
      the acceptance heading in the form the extractor actually matches, the
      risk-review marker with today's date, a risk row with a legal type, and a
      phase with one checkbox.
      verify: the emitted file passes `lint_roadmap_complexity`,
      `lint_plan_risk_register`, `lint_roadmap_blockers`,
      `check_roadmap_trackable` and `lint_empty_roadmaps` unedited.

- [x] **2.2 Make the skeleton the documented starting point.** The authoring
      surface points at the command rather than describing the conventions in
      prose that has to be found first.
      verify: the authoring surface names the command, and the four conventions
      are stated where the command emits them rather than only in prose.

- [x] **2.3 Fix the trunk roadmap that declares an invalid complexity value.**
      It reds `lint_roadmap_complexity` for every branch, and the gate runs in no
      workflow, so it is invisible until someone runs the chain by hand. One
      word — but the roadmap that found it deliberately did not sweep it, and it
      is still there.
      verify: `lint_roadmap_complexity` exits 0 on the trunk.
      **Done, and the sibling search found seven more.** The active one declared
      `bounded`. Searching the exact construct across all 88 roadmaps surfaced
      `medium` ×3, `moderate`, `small` ×2 and `standard` — all in `later/`,
      which the gate's glob does not scan, so each is a red that arrives on the
      day its roadmap is reactivated. All seven repaired by measuring lines and
      phases against the gate's own caps rather than by guessing a value.

## Phase 3 — the council CLI, which cost six calls for one run

Four independent ergonomic defects, all measured in one attempt:

1. `council run --help` prints `usage: agent-config council run [-h] ...` and
   **no flag list at all**. The flags were found by grepping the source.
2. `council estimate` reports every seat as `unavailable · no exchange with this
   provider has ever been recorded` — and then `run --confirm` reaches both
   seats and returns answers. The free probe's headline contradicts the outcome.
3. `run` without `--confirm` performs an estimate and says so only at the end,
   which reads as a failed run rather than a deliberate dry pass.
4. The `--output` path constraint (`agents/runtime/council/responses/`) is
   validated after the seats are contacted. Here it cost only a retry because
   the seats were skipped; with live seats it is the "bills before validating"
   shape already recorded in memory.

- [x] **3.1 Make `--help` list the flags.** Every flag the parser accepts,
      printed, including `--confirm`, `--output`, `--depth` and `--input-mode`.
      verify: `council run --help` names at least the four flags a first run
      needs, asserted by test.

- [-] **3.2 Validate `--output` before contacting any seat.** <!-- cancelled: already true, and the source says so with its own measurement -->
      **Cancelled — the premise was wrong, and the code refutes it in writing.**
      `council_cli.ts` validates the path immediately after the `--confirm`
      gate, above every billable call, with a comment recording exactly why:
      the check used to sit before the WRITE, i.e. after every member had been
      paid, and that cost roughly \$1.30 across three sessions before it was
      moved. What this session saw was OUTPUT ORDER — the attendance lines are
      printed before the path error — not spend order. No fix; the finding was
      a misreading and is recorded as one rather than deleted.

- [-] **3.3 Stop reporting reachable seats as unavailable in the free probe.** <!-- cancelled: a documented design choice, not a defect -->
      **Cancelled — a deliberate, documented choice rather than a defect.** The
      underlying check returns `unknown` with the honest detail "no exchange
      with this provider has ever been recorded". `absenceReasonFor` then maps
      BOTH `unknown` and `unavailable` onto the `unavailable` enum member, and
      its docstring gives the reason: the `QuorumAbsentReason` enum is closed
      and other instruments parse it, so minting an `unqualified` member would
      be a contract change to express a distinction the `detail` field already
      carries losslessly on the same row. The human-readable line is the part
      that reads oddly — `unavailable` beside `unknown` — but changing that word
      would either lie about a genuinely unavailable seat or fork the enum.
      Recorded, not fixed. **3.4 covers the misreading this actually caused.**

- [x] **3.4 Say that an unconfirmed run is a dry pass, at the start.**
      verify: the first line of an unconfirmed `run` says so.

## Phase 4 — one waiter recipe, because the hand-written one lied

The session wrote `until ! gh pr checks | grep -q pending; do sleep; done`. The
API then failed, the error text contained no `pending`, the loop exited, and the
session **reported a settle that had not happened**. The next reply had to
retract it. Both halves — one waiter per condition, and an API error is not a
verdict — are already in memory, in two separate files.

A recipe removes the class: the exit condition is written once, correctly, by
someone who is not mid-task.

- [x] **4.1 Ship a CI-settle helper.** Reuses `check_pr_ci_current`, treats an
      API error as *not settled*, distinguishes settled-green from settled-red,
      and refuses to report a verdict it did not read.
      verify: injected API failure produces "not settled" and never a verdict;
      injected mixed results produce settled-red.

- [x] **4.2 Point the CI-waiting surfaces at it.** Anywhere the guidance today
      says "start a waiter", it names this helper instead of leaving the exit
      condition to be re-derived.
      verify: the CI-wait guidance names the helper.

## Phase 5 — memory that arrives before the mistake

369 memory files behind an 87-line index, grouped by topic. Nine of this
session's eleven error classes had a file. All nine were read after the failure.

The index is not wrong — it is organised for *browsing*, and the failure mode is
*not browsing*. What is missing is the other axis: given that I am about to do
X, what has already gone wrong here.

- [x] **5.1 Add a trigger-moment index.** A short section keyed by action —
      authoring a roadmap, running the council, waiting on CI, editing a budget
      JSON, working in a worktree — each naming the two or three files that
      apply. It is an addition to the existing index, not a replacement: the
      topic grouping stays.
      verify: each of this session's nine already-documented error classes is
      reachable from an action key in at most one hop.
      **Done — and it lands OUTSIDE this repository.** The store is the user's
      (`~/.claude/projects/<project>/memory/`), so the index itself is not part
      of the PR; ten action keys were added there and every link verified to
      resolve. What IS in the PR is 5.2, the rule that keeps the axis alive.

- [x] **5.2 Make the entry cost one line.** Adding a trigger-moment entry when a
      new memory lands is part of writing it, or the axis rots within a month
      the way any second index does.
      verify: the memory-writing guidance names the trigger key as a required
      field of a new entry.

## Phase 6 — text edits that cannot cut a document in half

The costliest single error was mechanical: a script located a section by
`index("## Acceptance criteria")`, and the first match was a **quotation of that
heading inside a step's prose**. The slice cut there, the risk register was
silently lost, and two further calls were needed to notice and two to rebuild.

Three properties made it expensive and all three are generic: the anchor was a
substring rather than a line, the edit was destructive rather than checked, and
nothing verified the document's shape afterwards.

- [x] **6.1 A structural section-edit helper.** Replace or extract a markdown
      section by heading, matching **at line start**, and refusing when the
      heading matches more than once or zero times rather than silently taking
      the first.
      verify: a document containing the heading text inside a paragraph is
      edited at the real heading, and an ambiguous heading refuses.

- [x] **6.2 A shape assertion after a structured edit.** Section count and
      heading list before and after; an unintended disappearance fails loudly.
      verify: an edit that drops a section fails the assertion.

- [x] **6.3 Record the pattern where the next agent will meet it.** The failure
      is not "use a helper" but "an anchor that is also content is not an
      anchor". That sentence belongs with the two verify-annotation traps
      already recorded, which are the same shape.
      verify: the note exists and is reachable from the trigger-moment index.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The guard fix weakens the guard | implementation | Phase 1 narrows what a security control inspects; a segmentation bug in the fix would let a real `--no-verify` through, and the new test would still pass because it tests the false positive | 1.1 lands a red-first test, 1.3 requires a test per bypass form that reds when the change is reverted to permissive, and both run before 1.2 is called done | Phase 1 — the guard that blocks legitimate commands |
| 2 | The skeleton becomes a second source of truth | implementation | A generator that embeds four gate conventions drifts from the gates the day one of them changes, and then teaches the wrong form authoritatively | 2.1's verification is that the emitted file passes the real gates unedited, so the generator is checked against them rather than against a copy of their rules | Phase 2 — a roadmap skeleton nobody can get wrong |
| 3 | Six small fixes read as a tidy-up and get deprioritised | product | Every item here is individually minor, which is exactly why none was ever fixed; the measured cost is only visible in aggregate | The 21 % figure is stated with its denominator and its method, and each phase names the calls it would have saved rather than claiming a general speed-up | 0. The measurement |
| 4 | The trigger-moment index rots | product | A second index over the same 369 files is maintenance, and an unmaintained index is worse than none because it looks authoritative | 5.2 makes the entry part of writing a memory rather than a separate upkeep task, and 5.1's verification is a reachability property that can be re-run | Phase 5 — memory that arrives before the mistake |
| 5 | The helpers are written and never used | product | A CI-settle helper and a section-edit helper only pay off if the next agent reaches for them instead of writing the loop again | 4.2 and 6.3 route the guidance to them, and both are reachable from the trigger-moment index rather than only from their own files | Phase 4 — one waiter recipe, because the hand-written one lied |

## Acceptance Criteria

- [ ] AC-1 — A compound command containing both a git invocation and a later
      `-n` flag on a different program is allowed, every bypass form the guard
      was built for is still blocked, and both facts are asserted in one test run.
- [ ] AC-2 — A freshly emitted roadmap skeleton passes every roadmap gate with
      no content edits, and `lint_roadmap_complexity` exits 0 on the trunk.
- [ ] AC-3 — `council run --help` lists its flags, an invalid `--output` refuses
      before any provider is contacted, and the free probe makes no availability
      claim it has not measured.
- [ ] AC-4 — A CI-settle helper reports "not settled" on an API error and never
      emits a verdict it did not read, proven by an injected failure.
- [ ] AC-5 — Each of the nine already-documented error classes from this session
      is reachable from an action key in at most one hop.
- [ ] AC-6 — A section edit anchored on a heading that also appears inside prose
      edits the real heading, an ambiguous anchor refuses, and a dropped section
      fails a shape assertion.
