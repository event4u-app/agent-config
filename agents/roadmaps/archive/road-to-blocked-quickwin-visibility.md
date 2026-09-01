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
one. Council artifacts are gitignored and auto-pruned, so the text is inlined
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

- [x] **2.1 Make the falsifier machine-readable.** It exists today only as prose
      inside the stub it constrains, which means the party it would reopen the
      question for is the only party who can find it.
      verify: a report prints, for each stub in the new bucket, the number of
      releases published since its estate blocker opened; a test pins the
      release-placeholder case at 3 or more against a fixed tree.
- [x] **2.2 Record that it has fired, with the measurement rather than the
      claim.** The record names the validation date, the three released
      versions with their dates, and the per-section marker counts, so a later
      reader re-derives rather than trusts.
      verify: the record exists, and every number in it is reproducible by a
      command quoted beside it.

## Phase 3 — specify the capped provisional-promotion path

- [x] **3.1 Write the specification against all five conditions of the
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
      **Satisfied 2026-09-01 (drain run 15).** The five sentences are the five
      keys under `provisional_promotion.five_conditions` in
      `src/config/estate-count-budget.json` — a structured field rather than a
      prose section, because the verify's second half requires the gate to read
      the key the specification defines, and a specification living in one file
      while the key lived in another would let the two drift silently. The gate
      reads it at `src/scripts/check_estate_count.ts:661-667`, classifies it at
      `:280`, and types it at `:244`.
- [x] **3.2 Leave N, M and the activation unset.** They are the owner's to
      register, and a specification that ships with its own numbers filled in is
      the self-certification the 2026-08-24 verdict refused.
      verify: `src/config/estate-count-budget.json` carries the two keys as
      `null` with the owner named, and the gate treats `null` as "not
      registered, path inactive" rather than as "unbounded".
      **Satisfied 2026-09-01, and strengthened by the 3b verdict below:** the
      keys are `null` **and** the object carries a dated declination, so the
      checker distinguishes three states rather than two — `declined`,
      `unregistered`, and absent, which throws. Reading is not activation in any
      of them.

### Disposition 2026-09-01 (drain run 15) — the path is specified and DECLINED

**Verdict 3b, convergent 2/2, endorsed by the blind chairman as the anchor
reasoning of the session.** AI council 2026-09-01, members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum **2/2 present** (needed 1) — concluded.
Subscription transport, `billable=0`, `$0.0000`. Council artefacts are gitignored
and auto-pruned, so the substance is inlined here rather than cited by path.

**The question.** Does the owner's standing instruction for this run — which
states that *"the council's recorded decision substitutes for user sign-off"* —
reach the `b-provisional-promotion-authorization` blocker, whose options are
(a) register the path with two integers, (b) decline it and state what happens
instead, (c) register it with `max_live: 1` as a bounded trial?

**The reasoning, in the seats' own load-bearing sentences.** *"Options (a) and
(c) constitute governance self-amendment — the council extending the agent's own
write authority over a recorded estate floor. `decision-revisit-gate` explicitly
reserves this and explicitly states no delegation overrides it."* · *"`max_live:
1` limits magnitude, not the legal character of the authority change."* · And
the counter-argument, recorded rather than won by omission: *"The strongest
counter-argument is that the owner's instruction is unusually broad and could be
read as the owner personally choosing the council as decision-maker. That general
language nevertheless loses to the narrower rule expressly covering delegation
and self-amendment."*

**A decline is not a nothing.** Three things changed that would not have changed
by leaving the blocker open. The declination is dated and reasoned in the file
the gate reads. The fallback is stated precisely — *each future falsifier
occurrence remains blocked until explicit owner authorization for that
occurrence* — which is the behaviour that already obtained, now recorded as a
decision rather than left as a gap. And the checker can tell an intentional
declination from missing configuration, which two states could not.

**What was NOT added, deliberately:** neither integer, no expiry, and no nominal
"trial" path. `check_estate_count` grants no allowance in any of its three
states, and wiring what a `registered` state would buy is a separate change
needing the owner's authorization — a gate that started granting headroom the
moment someone typed a number would be the self-certification the 2026-08-24
verdict refused, arriving one commit later. Pinned by the test named
`READING IS NOT ACTIVATION — a registered path buys no headroom`.

**Sabotage, both directions of the distinction the decline rests on.**
Neutralising the `status === 'declined'` read reds 1 of 43; neutralising the
absent-key refusal reds 1 of 43. Both restores verified byte-identical by
SHA-256 (`28a45deb021fe29c7797b510f81094c508d65e8558e01d9619335173c628ea7c`).

### One inconsistency inside this roadmap's own blocker, corrected

The blocker's "reproduce" line named `./scripts-run src/scripts/stubs_due` —
the 211-line twin the CLI does not execute and which has **no**
`blocked_quickwin` bucket, so a reader following it would have reproduced the
absence of the very condition the blocker is about. It now names
`agent-config stubs:due`, the dispatched implementation.

**An install-currency qualifier that belongs beside every `agent-config
stubs:due` claim in this file.** `resolve_script` resolves against the
dispatcher's own `PACKAGE_ROOT`, so a **globally installed** `agent-config`
runs the globally installed package. Measured 2026-09-01: the global install is
`@event4u/agent-config@14.13.0`, cut 2026-08-31, before the bucket landed — it
reports no `blocked_quickwin` key at all. The repo-local entry
(`./agent-config`, a symlink to `src/scripts/agent-config`) resolves
`PACKAGE_ROOT` to the checkout and runs this tree's `dist/agent-src/`. That is
install currency, not a defect in the change, and it is why every verification
in this file is run through `./agent-config`.

## Blockers

### blocker: b-provisional-promotion-authorization

- **Status:** resolved 2026-09-01 (drain run 15) — DECLINED by AI council
  verdict 3b, convergent 2/2. Option (b) of the three below: the path is
  specified in full and the numbers are not registered, because registering
  either integer — `max_live: 1` included — is governance self-amendment, which
  `decision-revisit-gate` reserves to the owner and over which no delegation
  carries. The mechanism that closes it: `provisional_promotion` in
  `src/config/estate-count-budget.json` carries the five conditions answered one
  sentence each, `status: declined` with its date and reasoning, and both
  numbers `null`; `check_estate_count` reads the key, distinguishes `declined`
  from `unregistered` from absent-and-therefore-a-refusal, and grants no
  allowance in any state. Reasoning and sabotage evidence: § Disposition
  2026-09-01 (drain run 15).
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
  `agent-config stubs:due` — **not** `./scripts-run src/scripts/stubs_due`,
  which is the twin implementation the CLI does not execute and which carries no
  `blocked_quickwin` bucket at all, so following it reproduces the absence of
  the condition rather than the condition — and the release counts in
  § The measurement. **Answered (b) on 2026-09-01.**
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

- [x] AC-1 — a stub whose only blocker is an estate or budget decision, whose
      design is recorded as validated, and which declares no capability gap, is
      reported in its own class and no longer inside the 25-file OWNER bucket.
      **Re-derived 2026-09-01** on this branch: `./agent-config stubs:due --json`
      reports `{"overdue":0,"owner_decisions":12,"missing_review_by":0,
      "blocked_quickwin":1,"total":102}` with
      `agents/roadmaps/stubs/road-to-release-placeholder-guard.md` the sole
      member. The four pre-existing `counts` keys all survive. Run through the
      repo-local `./agent-config`, per the install-currency qualifier above.
- [x] AC-2 — membership in that class is decided by frontmatter fields, pinned in
      both directions by tests, never by a substring match over body prose.
      **Re-derived 2026-09-01:** `npx vitest run
      tests/scripts/stubs_due_quickwin.test.ts` → 19 passed. Each of the three
      scalars is pinned individually — `tests/scripts/stubs_due_quickwin.test.ts:74`
      loops the missing-field direction and `:112` loops the field-in-body-prose
      direction, one case per field, which is what makes a single-field sabotage
      detectable at all.
- [x] AC-3 — `/analyze:inbox` cannot resolve a survivor that maps onto an
      existing stub without naming the stub, its blocker, its age and its
      recurrence count in the run's output.
      **Re-derived 2026-09-01** by reading
      `src/domains/analysis-workbench/analyze/inbox/command.md`: the mapping row
      is at `:490`, the four-item obligation at `:525-543` (stub path `:529`,
      blocker slug `:531`, age in days `:535`, Phase-4c recurrence count `:540`),
      and `:545` states that missing any of the four leaves the survivor
      undischarged.
- [x] AC-4 — the estate council's deadlock falsifier is machine-readable, and
      its firing for the release-placeholder case is recorded with dates,
      versions and counts that a reader can re-derive.
      **Re-derived 2026-09-01:** `release_dates()` at
      `src/agent-src/scripts/stubs_due.ts:250` and `releases_since()` at `:273`;
      the live record reports `releases_since_blocked: 3` against
      `blocker_opened: 2026-08-23`. The evidence file's own two-era changelog
      command re-runs and returns exactly its recorded three lines — 14.13.0
      (2026-08-31), 14.12.0 (2026-08-25), 14.11.0 (2026-08-24).
- [x] AC-5 — the capped provisional-promotion path is specified against each of
      the five conditions in its own sentence, with N, M and activation
      unregistered and owner-reserved.
      **Verdict 3b does not break this criterion — it is the reading under which
      it is satisfiable at all.** AC-5 requires N, M and the activation to remain
      *unregistered*, so the two options that would have registered them —
      (a) two integers, (c) `max_live: 1` as a bounded trial — are the two that
      would have contradicted it. Declining keeps both `null` while the five
      sentences and the mechanism land in full, which is exactly what this
      criterion asks for. Re-derive: `jq '.provisional_promotion
      | {status, max_live, expires_after_days, n: (.five_conditions | length)}'
      src/config/estate-count-budget.json` → `declined`, `null`, `null`, `5`.

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
