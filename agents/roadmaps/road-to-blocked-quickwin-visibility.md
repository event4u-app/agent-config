---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-publication-integrity-hard-fail
    relation: extends
    note: >
      The instance this roadmap generalises from. That file fixes one defect
      that shipped in five consecutive releases; this one addresses why a
      validated fix for it stayed invisible for ten days and three releases,
      and why the reviewer had to raise it nine times.
estate_offset_exempt: "Adds one active roadmap with no offsetting disposal. Same position as its sibling: both pre-existing active roadmaps carry open steps, and the 2026-08-24 estate council refused to name an offset among them because no mechanical evidence identifies the least valuable one. The authorization is the maintainer's instruction in intake round inbox-2026-09-a, which asked for two things — that the defect be fixed and that the process miss stop recurring — and the invocation that produced this file, which asked for ready roadmaps in a pull request. The second half of that instruction is what this file is; folding it into the sibling would hide a process defect inside a defect fix."
estate_growth_exempt: "Covers the growth half: active_roadmaps 3 -> 4 against an exact floor of 2 measured at origin/main, plus one open blocker (31 -> 32). Together with its sibling the change reads 2 -> 4 active and 30 -> 32 blockers, which is what check_estate_count prints. Authorised by the same instruction. The falsifier the 2026-08-24 council named for its own rule — systematic deadlock, validated promotions blocked across more than two releases while user-facing defects ship — has fired and is measured in § The measurement, so the remedy the council itself named (a mechanically capped provisional-promotion path, explicitly NOT a loosening of the five-condition rule) now has a condition behind it rather than a preference."
---
# Road to blocked quick-win visibility

> **Source:** `agents/tmp.old/inbox-2026-09-a/` — the maintainer's closing
> instruction, which asks two separate questions: why the release-placeholder
> defect was never taken into a roadmap, and how that class of miss stops. Every
> number below is re-derived against the tree at `b50b27281`.

## Goal

A fix that is validated, needs no capability this repository lacks, and is held
only by estate authorization is visible **as that**, distinguishable from a
decision that is genuinely waiting on someone's preference — and the deadlock
condition the estate council named for its own rule has an instrument, so the
next occurrence is detected by a query rather than by a reviewer's ninth round.

## The measurement

Three findings, each reproducible in one command.

**1. The stub was visible, and visibility was not the problem — classification
was.** `./scripts-run src/scripts/stubs_due` at `b50b27281` reports
`OVERDUE: 0 · NO PROBE: 11 · OWNER: 25`, and
`road-to-release-placeholder-guard` is one of the 25, matched on the substring
`"owner-reserved"`. The command's own header states what that bucket means: *it
is waiting on a person, and no amount of re-reading moves it.* True of a
preference. False of this file, whose design was council-approved on 2026-08-23,
whose implementation needs nothing this repository lacks, and whose defect
shipped again six days later. One bucket holds both, so the report cannot
surface the difference.

**2. The estate ratchet blocked the plan, not the fix.**
`check_estate_count`'s metrics are active roadmaps, parked roadmaps, open
blockers, skill count, skill-description tokens and hook concerns. Source files
are not among them. The guard's implementation was never subject to the ratchet
at any point; only promoting its roadmap out of `stubs/` was, at +1
`active_roadmaps` against an exact floor. Ten days of blockage bought no estate
saving whatsoever — the file count it protected was never going to change.

**3. The council's own falsifier has fired.** The 2026-08-24 verdict recorded
the condition that would reopen the general question, in its own words:
*evidence that the ratchet creates systematic deadlock — validated promotions
blocked across more than two releases while user-facing defects ship — would
argue for a mechanically capped provisional-promotion path rather than for
loosening this rule. One instance is not that evidence.* Measured: the design
was validated 2026-08-23; the defect has shipped in 14.11.0 (2026-08-24),
14.12.0 (2026-08-25) and 14.13.0 (2026-08-31), four marker lines each. Three
releases is more than two, and the condition is met on the terms the council set
rather than on a reading of them.

## Phase 1 — separate a blocked quick-win from a waiting preference

- [x] **1.1 Give `stubs:due` a fourth bucket.** A stub belongs in it when all
      three hold: it carries a recorded validation of its design (a council
      verdict, a measurement, or a landed prerequisite), it declares no
      capability gap, and its open blocker is an estate or budget decision
      rather than a product one. Extending the existing command is deliberate —
      a new command would be the same failure one layer up.
      verify: **RE-SCOPED 2026-09-01 (drain run 14) under DELEGATED owner
      authority — see the disposition block below. The original clause named
      `./scripts-run src/scripts/stubs_due`, which is not the file the CLI
      runs.** `agent-config stubs:due --json` reports
      `counts.blocked_quickwin >= 1` with
      `agents/roadmaps/stubs/road-to-release-placeholder-guard.md` among the
      members while its estate hold stands, every pre-existing `counts` key
      survives unchanged in name, type and meaning, and no existing stub's
      classification moves.
- [x] **1.2 The three membership conditions are read from frontmatter, not from
      prose.** A substring match over body text is what put a validated fix and
      a preference in one bucket; repeating that mistake with three substrings
      instead of one would be worse, not better.
      verify: the fields are named in the stub contract, a stub missing them
      falls to the OWNER bucket unchanged, and a unit test pins both directions
      — a file with all three fields lands in the new bucket, a file missing one
      does not.
- [x] **1.3 `/analyze:inbox` may not resolve a stub-mapped survivor into a
      verdict line.** Its Phase 5 mapping table has no row for "the claim maps
      onto an existing stub", so a run that finds one has no prescribed output
      and writes a summary sentence instead. The round's own artefact did exactly
      that: *"Not a neglected guard: the cost of an unmade owner decision. On the
      owner's desk."* — accurate, and the reason nine rounds produced no
      executable item.
      verify: the command file carries the row, and the obligation names the
      four things the output must contain — the stub path, its blocker slug, its
      age in days, and the recurrence count from Phase 4c.

## Disposition 2026-09-01 (drain run 14) — the dispatcher defect, and what it cost this roadmap

**A duplicate dispatcher definition meant this roadmap was measuring code the
CLI does not execute.** `src/scripts/_dispatch.bash` defined `cmd_stubs_due`
**twice** — at `:767` pointing at `src/scripts/stubs_due.ts` (211 lines) and at
`:791` resolving `dist/agent-src/scripts/stubs_due.ts` (400 lines). In bash the
later definition wins, so `agent-config stubs:due` ran the agent-src
implementation and the 211-line file was reachable only through
`./scripts-run`. Confirmed by construction and by running the live verb.
The two are **different designs**, not copies. Exactly one duplicate `cmd_`
existed in the dispatcher; zero others.

**AI council 2026-09-01 (drain run 14)**, members `anthropic/claude-sonnet-4-5`
+ `openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum **2/2 present** (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Verdict **Option B**, convergent. **The first attempt
ran DEGRADED — 1/2 present**, with the tool printing *"this is not
convergence"*; quorum recovered on retry. Both rounds are recorded because a
degraded round is not a council round, and a reader must not find only the clean
one. Council artefacts are gitignored and auto-pruned, so the text is inlined
here rather than cited by path.

### The authority table, as ruled — and `delegated` is not `council-decidable`

| Action | Classification | Taken |
|---|---|---|
| Delete `_dispatch.bash:767` | council-decidable, zero blast radius | yes |
| Add the fourth bucket to `src/agent-src/scripts/stubs_due.ts` | council-decidable, the stated 1.1 deliverable | yes |
| Rewrite 1.1's verify to `agent-config stubs:due --json` | **owner-reserved → delegated** | yes, **as delegated** |
| Execute 1.2 before 1.1 | council-decidable dependency reorder | yes |
| Adopt the 2026-08-23 validation date for 2.1 | **owner-reserved → delegated** | see Phase 2 |
| Delete `src/scripts/stubs_due.ts` | owner-reserved, **NOT delegated** | **no** |
| Declare agent-src the canonical layer | owner-reserved, **NOT delegated** | **no** |
| Port or remove `headerFragment()` | owner-reserved, **NOT delegated** | **no** |
| Change CLI output beyond adding the bucket | owner-reserved, **NOT delegated** | **no** |

Both seats insisted on the distinction, in one seat's words: *"we're using
delegated authority, not discovering they were council-decidable all along."*
And the objection that bounds this change, carried verbatim: *"treating 'the
currently dispatched implementation' as 'the canonical implementation' by
implication. Runtime reachability establishes present behavior, not
architectural ownership."* The agent-src file was extended **because it is what
runs**, not because it won an architecture decision. That decision is open.

### 1.2 executed before 1.1, and the reason is mechanical

1.1's verify needs the canonical stub to appear in the bucket. Membership is
read from three frontmatter fields that did not exist until 1.2 added them, so
1.1 was unsatisfiable until 1.2 landed. The dependency is now written into the
phase rather than left to be rediscovered.

The three fields — `design_validated:`, `capability_gap:`, `blocker_class:` —
are contracted in `agents/roadmaps/stubs/README.md` § The blocked-quick-win
fields and read as frontmatter **scalars**. The values written onto
`road-to-release-placeholder-guard.md` are that stub's **own recorded claims**,
not this run's inference: its § Estate disposition records a 2/2 convergent
council verdict of 2026-08-24 that *"promotion readiness remains satisfied"*
while *"estate authorization does not"*, and its header states the work *"needs
no capability this repository lacks"*.

### The five conditions of the approval, discharged

1. **JSON contract stability** — `counts` keeps `overdue`, `owner_decisions`,
   `missing_review_by` and `total` unchanged in name, type and meaning;
   `blocked_quickwin` is additive. Asserted by test, and observed live:
   `{overdue: 0, owner_decisions: 12, missing_review_by: 0, blocked_quickwin: 1,
   total: 102}`.
2. **Dashboard unchanged** — `headerFragment()` was not modified.
   `agents/roadmaps-progress.md` regenerated before and after the change is
   **byte-identical** (286 lines, `diff` empty).
3. **Sabotage sensitivity** — below.
4. **Rollback triggers** — below.
5. **The new property is documented** in the stub contract; the repository ships
   no separate CLI output spec, and none was invented.

### Sabotage, including one that came back green

| # | Neutralised | Result |
|---|---|---|
| 1 | the `capability_gap !== 'none'` exclusion | **RED**, 3/13 |
| 2a | the `blocker_class` frontmatter read, against the first fixture | **GREEN — the test was insensitive** |
| 2b | the same, against the repaired fixture | **RED**, 1/13 |

**2a is the finding, and it is the second instance of this shape in this drain
run.** One fixture carrying all three fields in the body proves only that *one*
of the three reads is scoped: `is_blocked_quickwin` short-circuits on
`design_validated`, so neutralising the `blocker_class` read alone was
undetectable. The suite now pins each field **individually** — three fixtures,
each with one field in the body and the other two in frontmatter — and the
identical sabotage then reds. Both restores verified byte-identical by SHA-256.

### Rollback triggers, named observably

Revert the bucket commit if any of these is seen: a pre-existing `counts` key
disappears, changes type, or changes meaning · an existing stub's classification
moves · the canonical stub stops appearing in the bucket while its estate hold
stands · `agents/roadmaps-progress.md` renders differently beyond the bucket · a
consumer fails on the unknown `blocked_quickwin` property.

### M1 is half wrong, in the direction that strengthens this roadmap

*"The stub was visible, and visibility was not the problem — classification
was"* is true of `src/scripts/stubs_due.ts` and **false of the dispatched
command**, where the stub appeared in no list at all. Under the command a
maintainer actually runs, visibility **was** the problem. M2 and M3 are
confirmed as written, with the M3 correction that 14.11.0 lives in
`docs/archive/CHANGELOG-pre-14.12.0.md` after the era split, so grepping the
current era alone reports 0 rather than 4.

## Phase 2 — instrument the deadlock condition

- [ ] **2.1 Make the falsifier machine-readable.** It exists today only as prose
      inside the stub it constrains, which means the party it would reopen the
      question for is the only party who can find it.
      verify: a report prints, for each stub in the new bucket, the number of
      releases published since its estate blocker opened; a test pins the
      release-placeholder case at 3 or more against a fixed tree.
- [ ] **2.2 Record that it has fired, with the measurement rather than the
      claim.** The record names the validation date, the three released
      versions with their dates, and the per-section marker counts, so a later
      reader re-derives rather than trusts.
      verify: the record exists, and every number in it is reproducible by a
      command quoted beside it.

## Phase 3 — specify the capped provisional-promotion path

- [ ] **3.1 Write the specification against all five conditions of the
      2026-08-24 rule, one by one.** The rule permits an autonomous estate
      exemption only if an authorized rule allows it, that rule supplies
      objective eligibility criteria, repository evidence proves them satisfied,
      the exemption is mechanically capped or expiring, and applying it needs no
      choice among competing roadmap priorities. A provisional promotion can
      satisfy all five by construction: it *is* the authorizing rule; its
      criteria are the three Phase 1.1 conditions plus a defect measurable in at
      least two released artefacts; the evidence is in the tree; it is capped at
      N live and expires after M days; and it offsets nothing, so no priority
      pick arises.
      verify: the specification exists with each of the five conditions answered
      in its own sentence, and `check_estate_count` reads the key it defines.
- [ ] **3.2 Leave N, M and the activation unset.** They are the owner's to
      register, and a specification that ships with its own numbers filled in is
      the self-certification the 2026-08-24 verdict refused.
      verify: `src/config/estate-count-budget.json` carries the two keys as
      `null` with the owner named, and the gate treats `null` as "not
      registered, path inactive" rather than as "unbounded".

## Blockers

### blocker: b-provisional-promotion-authorization

- **Status:** open
- **Owner:** maintainer
- **Blocks:** activation of Phase 3 only. Phases 1 and 2 are visibility and
  instrumentation, change no authority, and land independently of this answer.
  Phase 3.1 may be written while this is open — a specification is not an
  activation — and Phase 3.2 exists precisely to keep the numbers unset.
- **What to do:** pick one of three.
  (a) Register the path: set `provisional_promotion.max_live` and
  `provisional_promotion.expires_after_days` in
  `src/config/estate-count-budget.json` to concrete integers, which switches it
  on. (b) Decline the path and state what happens instead the next time the
  falsifier fires — the honest alternative is that a blocked quick-win waits for
  an explicit owner instruction per occurrence, which is the current behaviour
  named as a decision rather than as a gap. (c) Register it with
  `max_live: 1` as a bounded trial and a review date, which is the smallest
  version that can be falsified. Reproduce the condition behind the choice with
  `./scripts-run src/scripts/stubs_due` and the release counts in
  § The measurement.
- **Recommendation:** (c) — register `max_live: 1` with a review date. It is
  the smallest version of the mechanism that can be falsified: one live
  provisional promotion cannot turn the ratchet into paperwork, and if the
  single slot sits unused the path was unnecessary and can be removed on
  evidence rather than on argument. (a) grants more than the fired condition
  demands; (b) is a complete and defensible answer, and it should be recorded
  rather than reached by default.
- **If you do nothing:** Phases 1 and 2 still land, so the next blocked
  quick-win is visible and the deadlock condition is counted instead of argued.
  What persists is that surfacing it changes nothing on its own — the release
  placeholder was already listed in a report for ten days. Each future
  occurrence then needs an explicit owner instruction, which is exactly the
  loop that produced nine feedback rounds for one guard.
- **Resolved when:** `src/config/estate-count-budget.json` carries either two
  integers under `provisional_promotion` or a recorded declination with its
  reason, and `check_estate_count` reads whichever landed. Creating the path
  extends agent write authority over a recorded estate floor, which
  `decision-revisit-gate` reserves to the owner — a council may specify the
  mechanism and may not switch it on, and the 2026-08-24 verdict refused exactly
  the self-certified version of this.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The provisional path becomes the default route and the ratchet stops binding | product | Every addition acquires a plausible urgency argument, and a valve with no cap turns the estate ratchet into paperwork. | N and M are registered by the owner and mechanically enforced; a provisional promotion that expires unmerged reverts to `stubs/` automatically rather than by anyone remembering; and Phase 3.2 ships the keys unset so the path is inactive until the owner acts. | Phase 3 — specify the capped provisional-promotion path |
| 2 | The visibility work adds a report nobody reads | implementation | Exactly the failure being fixed, one layer up: the stub was already listed in a report, and the listing changed nothing. | Phase 1.1 extends `stubs:due`, a surface with an existing consumer, rather than adding a command; and Phase 1.3 puts the obligation in the one place the miss actually happened — the inbox command's output, which a maintainer reads by construction. | Phase 1 — separate a blocked quick-win from a waiting preference |
| 3 | The three membership conditions are gamed to promote ordinary work | implementation | "Validated design, no capability gap, budget-only blocker" is checkable, and therefore also claimable. | The conditions are frontmatter fields, so a claim appears in a diff and is reviewable; the release-published-defect criterion in Phase 3.1 cannot be self-asserted at all, because it is measured against released artefacts outside the branch. | Phase 3 — specify the capped provisional-promotion path |

## Acceptance Criteria

- [ ] AC-1 — a stub whose only blocker is an estate or budget decision, whose
      design is recorded as validated, and which declares no capability gap, is
      reported in its own class and no longer inside the 25-file OWNER bucket.
- [ ] AC-2 — membership in that class is decided by frontmatter fields, pinned in
      both directions by tests, never by a substring match over body prose.
- [ ] AC-3 — `/analyze:inbox` cannot resolve a survivor that maps onto an
      existing stub without naming the stub, its blocker, its age and its
      recurrence count in the run's output.
- [ ] AC-4 — the estate council's deadlock falsifier is machine-readable, and
      its firing for the release-placeholder case is recorded with dates,
      versions and counts that a reader can re-derive.
- [ ] AC-5 — the capped provisional-promotion path is specified against each of
      the five conditions in its own sentence, with N, M and activation
      unregistered and owner-reserved.

## Explicitly NOT in this roadmap

- **Loosening the five-condition rule.** The council named the capped path as
  the alternative *to* loosening it. Nothing here weakens a condition.
- **Picking which active roadmap retires.** No mechanical evidence identifies
  the least valuable one, both council seats refused to invent one, and this
  roadmap does not reopen that.
- **A second backlog system.** Phase 1 extends `stubs:due` and the inbox
  command's existing output. A new surface would be the failure it is fixing.
- **The publication defect itself.** That is
  `road-to-publication-integrity-hard-fail`, and it lands independently of
  every phase here.
