---
complexity: lightweight
status: later
execution:
  mode: autonomous
parent_roadmap: road-to-long-horizon-execution
estate_offset_exempt: >-
  Offset in the same change by archiving road-to-long-horizon-execution, whose sole deferred item
  this roadmap carries. Net estate change is zero; the field is present because the ratchet reads
  the addition before it reads the archival.
---

# Road to a run-continuation engagement anybody can point at

> **Parked 2026-08-19. Resume when** any roadmap carrying
> `execution.mode: autonomous` with open steps in three or more `## Phase`
> sections is run to completion from a worktree and reaches a PR — then read the
> run back with `./scripts-run src/scripts/interruption_report --root <main-checkout>`
> and close step 0.1 off that run id. Parked rather than left active because
> every open item here is gated on that external trigger and the estate has no
> qualifying candidate: measured 2026-08-19, of the active roadmaps exactly three
> carried `mode: autonomous` and none of the other two had open steps in three
> phases. A blocked roadmap left in the active tree lies to the dashboard and to
> `/roadmap:process-*`, which keeps trying to execute it — and `process-full`
> terminated on this one as `blocked-preflight` for exactly that reason.
>
> **ADR-237 note, added 2026-08-20 — one leg of this justification is gone.** The
> `blocked-preflight` termination cited above no longer exists: ADR-237 supersedes
> ADR-235, makes `/roadmap:process-full` an end-to-end delegation, and reclassifies
> repository-local prerequisites (a branch, a push, a PR, a settings flip, a CI
> re-run, a failing test, a paid call under USD 25) as remediation work rather than
> blockers. So the command no longer refuses to start here and no longer "agrees
> independently" with the park.
>
> **The park is NOT reversed by this note, and the reason is scope, not conviction.**
> The other leg — every open item genuinely gated outside this roadmap — is the one
> that has to be re-tested under the new capability screen
> (`roadmap-process-loop` § 3c: *can the agent execute this at all?*), and that is a
> per-item judgement this note does not make. What is recorded here is that the
> justification is now **partly stale** and the roadmap is a candidate for
> re-activation, not that it stays parked on the old grounds.

> **Source:** the sole deferred acceptance criterion of
> `road-to-long-horizon-execution`, carried here under the preservation
> test in `roadmap-progress-sync § Who resolves it` rather than dropped
> at that roadmap's archival. AI council 2026-08-19, unanimous 2/2
> (anthropic/claude-sonnet-4-5 + openai/codex-default, blind peer
> review): fix the blocker now, carry the criterion, close it only on a
> recorded run.

## Context

`run-continuation` is the stop-slot concern that re-engages a run while
its claimed roadmap still has open steps. It shipped, it was tested, and
it had **never fired once** outside a test.

**The test counts are deliberately not quoted here any more.** Four
separate review rounds caught this sentence carrying a stale figure —
round 3 finding 8, round 5 finding 4, round 6 finding 7, and round 8
finding 8, the last of which found the unit half still claiming 21
against an actual 40 in the same revision that had just corrected the
integration half. A number nobody can keep current is worse than no
number, because its whole purpose was to be checkable. The counts are
one command away and that command cannot go stale:

```
npx vitest run tests/scripts/hooks/run_continuation.test.ts \
              tests/hooks/run_continuation_dispatch.test.ts
```

What the prose does claim, and what stays checkable by reading rather
than counting: the unit suite exercises `ladder()`, `scanOpenSteps()` and
`refusedThisTurn()` directly, the dispatch suite drives the real
`dispatch_hook` binary over the real manifest, and a subset of the latter
only parses the manifest without dispatching at all.

The cause was a defect, not a missing step, and it is fixed: the run
contract had two halves resolving different roots. `sessions:claim`
wrote the claim under `process.cwd()` (the operator's worktree) while
the concern read it under `--project-dir` (the parent checkout). In a
worktree those are different trees, so the concern found no contract,
took its `contract absent → no-op` rung, and wrote **no event** — an
empty ledger that looks exactly like a healthy idle run. The claim now
lives in the git common dir beside the session register.

What remains is not work. It is an **observation**, and it is the one
thing the fix cannot supply: a real run, started from a worktree, that
engages and leaves the event behind.

## Phases

### Phase 0 — Observe one engagement

- [x] **0.0** A `process-full` run started from a worktree, under a
      `sessions:claim`, writes at least one `engage` line to
      `agents/runtime/state/run-continuation.jsonl`. Record the run id,
      the roadmap, and the iteration count the ladder reached.
      The event is the evidence; a green test is not, and the reason is
      the whole point of this roadmap — the integration test passes the
      SAME root to writer and reader, which is the one arrangement in
      which the defect was invisible. Only a real two-tree run proves
      it.
      `verify:` `cat agents/runtime/state/run-continuation.jsonl`

  **OBSERVED 2026-08-19T14:24:20Z.** The mechanism fired for the first
  time outside a test.

  | Field | Value |
  |---|---|
  | run id | `12653f90d7cb4243821392afd5d8c4db` |
  | roadmap | `road-to-run-continuation-observation` |
  | iteration reached | 1 of 25 (`engage`, not a halt rung) |
  | turn / open / blocked | 2 / 2 / 0 |
  | claim written from | the worktree `<repo>/.claude/worktrees/long-horizon`, by `agent-config sessions:claim` at 14:23:21Z |
  | claim file | `<repo>/.git/agent-claims/roadmap-claim-fc48c551-….json` — the SHARED common dir |
  | concern read under | `--project-dir <repo>` — the parent checkout |
  | `git_dir` vs `git_common_dir` | `<repo>/.git/worktrees/long-horizon` vs `<repo>/.git` — different, i.e. a genuine linked worktree |

  `<repo>` stands for the absolute checkout path, redacted on purpose: the real
  prefix carries the maintainer's name, which `domain-safety-pii` keeps out of a
  tracked file. The *relations* above are what the audit needs and they survive
  the substitution intact — every path shares the one prefix, so the
  inequalities and the containment still read off the table.

  **Why this is the two-tree case and not a same-root one.** The writer
  ran in the worktree and the reader ran in the parent checkout — the
  exact asymmetry that produced no event before the fix. It is also
  sharper than the roadmap anticipated: `CLAUDE_PROJECT_DIR` resolves to
  the **parent checkout** even in a worktree session, so the ledger and
  the step's own `verify:` path both live in the parent tree, not in the
  worktree the run was started from. The roadmap's `verify:` line is
  therefore correct only when run with the parent checkout as cwd.

  **Two limits, recorded rather than smoothed over** (AI council
  2026-08-19, 2/2 convergent, blind peer review — anthropic +
  openai seats):

  1. *Self-referential.* The claimed roadmap IS this roadmap, so the
     open checkbox that caused the engagement is the one the engagement
     discharges. Both seats accepted it for 0.0 — the property under
     test is two-tree claim discovery, which does not care which roadmap
     is claimed — and both bounded it: this proves claim discovery
     across distinct roots, and **nothing** about sustained
     re-engagement, timing, or diverse-work detection. Ecological
     validity is that of a production smoke probe, not of ordinary
     autonomous work.
  2. *The provenance fields are test-verified, not self-verified.* The
     same change adds `workspace_root` / `session_root` / `session_cwd` /
     `git_dir` / `git_common_dir` / `claim_path` / `roadmap_path` — **seven
     fields** — to every event, so a future line carries the two-tree fact
     itself instead of needing this table.

     This enumeration has now been caught wrong twice: round 3 finding 4
     found it listing five where the code emitted six, and round 5 finding 3
     found it listing six where the code emits seven, `roadmap_path` having
     arrived in between. Both times the consequence is the same — a reader
     auditing a real ledger line finds a field the contract does not mention
     and cannot tell whether it is part of the contract or noise.
     `roadmap_path` names the file the open-step count on that same line was
     read from, which is the one number on the line whose meaning depends on
     which tree was chosen.
     `session_root` is the field R2 finding 1 added after the fact: the
     first version derived both git fields from the READER's root, where
     they are equal in exactly the arrangement documented above, so the
     enrichment could not express the property it was built for. This event does not
     carry them: the live hook is the parent checkout's `dist/` build,
     and the enrichment was built in the worktree. Verified by
     `tests/hooks/run_continuation_dispatch.test.ts` over a real
     `git worktree add` fixture — which reds against the un-enriched
     event while the other cases stay green.

     **The counts in this bullet went stale twice, in the same branch that
     corrected them, and the second time is the more useful lesson.** Round
     3 finding 8 caught "nine cases, one asserting the provenance" when the
     file held twelve with three; the correction to twelve/three was then
     overtaken by rounds 4 and 5, which added six more cases, and round 5
     finding 4 caught that — along with the `## Context` line above still
     saying 7.

     Then round 6 finding 7 caught it a THIRD time, in the revision that
     corrected the second: "22 cases against the real dispatcher" counted
     every `it(` in the file, and two of them only parse the hook manifest
     and never call `dispatchStop`.

     **At three misses the number is the defect, so it is now stated with
     the distinction that kept breaking it: 26 cases in the file, 24 of
     which drive the dispatcher, 2 of which read only the manifest.** A
     bullet whose whole purpose is to let a reader check the artefact
     against a falsifiable number is worse than useless when the number is
     wrong — and a per-round correction is a number that will be wrong again
     by the next round. Anyone extending that file updates this line or
     deletes it; leaving a stale figure standing is the one option that has
     already failed three times.

     **Superseded 2026-08-19 by a live event, and the live event refuted
     the fields.** The enrichment merged, `dist/` was rebuilt, and the
     concern fired again from a worktree session at
     `2026-08-19T17:18:12.843Z` (run `e9bcaa908c103495bd817f4217a03316`).
     That line carries the four fields — and reads:

     | Field | Value |
     |---|---|
     | `workspace_root` | `<parent checkout>` |
     | `git_dir` | `<parent checkout>/.git` |
     | `git_common_dir` | `<parent checkout>/.git` |
     | `claim_path` | `<parent checkout>/.git/agent-claims/roadmap-claim-<session>.json` |

     The two git paths are **identical**, on a run that genuinely started
     from `.claude/worktrees/long-horizon`. So the discriminator this note
     promised — `git_dir !== git_common_dir` → linked worktree — reads
     FALSE for exactly the case it was built to detect, and
     `claim_path ⊂ git_common_dir` holds in a plain checkout too and
     cannot disambiguate. The two-tree fact is not recoverable from the
     line at all.

     R2 finding 1 predicted this from the code before the line existed;
     the line is the production confirmation, not a second opinion. The
     fix derives both git fields from `session_root` — the session's own
     checkout, resolved through the register's `session_checkout` guard —
     and ships `session_root` plus `session_cwd`, taking the line to six
     fields, so writer-vs-reader divergence is itself readable per event.
     On the line above, `session_root` would have been the worktree and
     `workspace_root` the parent: different, which is the fact.

     `session_cwd` came out of round 2 finding 1 as a way to make a
     degraded resolution *distinguishable* rather than silent, on the
     reasoning that the resolver's conditions belonged to the register and
     loosening them was a different change.

     **Round 3 finding 2 refuted that reasoning by measuring where the
     field is blind, and the fix moved upstream after all.** Worktrees in
     this repository live at `<parent>/.claude/worktrees/<name>` — NESTED
     under the parent. For a session standing one directory deeper, the
     collapsed `session_root` equals the reader's root, both git fields
     taken from it are equal, **and** the raw `cwd` is under the parent
     too. All three signals report a healthy same-tree run for a genuine
     two-tree one. A confidently wrong answer is not a loss of precision,
     and the resolver's own docblock had defended the rejection as "never
     something worse".

     Two things followed, both ratified by the AI council (2026-08-19,
     2/2 convergent, A/A):

     1. `session_checkout` now walks UP to the nearest enclosing checkout
        root, bounded by the same-repository identity check it already had.
        The first hit wins, so a nested worktree resolves to itself rather
        than to the checkout containing it. The session register gets the
        same correction for free — it records which worktree a session is
        in, and had the identical blind spot.
     2. The roadmap the run executes is resolved against the **session's**
        checkout, falling back to the reader's. Round 3 finding 1: the
        open-step count feeds a stall detector, and reading the reader's
        tree meant watching a file nobody was editing — the count never
        moved and the detector declared a working run finished after three
        engagements. The mechanism whose job is to detect a stall was
        manufacturing one.

     `session_cwd` stayed, with a narrower job: a cwd in a DIFFERENT
     repository, a cwd that does not exist, a cwd under no checkout root.
     Those still fall back, and on those lines it is still the only field
     that says so.

     **Rounds 4-7 then rewrote the run-state contract twice, and both
     rewrites came from the same place: the state's identity was wrong.**
     Worth recording because the intermediate steps each looked correct.

     Round 4 introduced a `halt-roadmap-absent` rung so a completing run
     stopped leaking its budget, and round 5 found it cleared a halt stamp;
     round 6 guarded the stamp and keyed the roadmap INSIDE the state file;
     round 7 then found two highs in that guard. The absent branch never
     applied it, so it reported one roadmap's iteration count under
     another's slug and deleted a live state — and on the main path,
     nulling the previous state on a slug mismatch let the next write
     OVERWRITE the other roadmap's halt stamp, so "a halt must NOT clear
     it" was not durable. A halted roadmap became re-engageable with a full
     budget by the detour of claiming something else once.

     One session-keyed file cannot hold two roadmaps' budgets. The state
     path is keyed on **(session, roadmap)** now, and round 6's objection —
     that keying the path "would orphan every state file in existence" —
     is answered by migrating rather than by avoiding: the legacy
     per-session file is adopted once when its recorded roadmap is absent
     or equal, and ignored when it belongs to another roadmap.

     The second rewrite is the absence semantics. Round 6 stopped the rung
     erasing a *halted* run's stamp and left the larger half open: a run
     with a **live** budget still lost its state on one unreadable fire —
     an ordinary event (a branch switch to a ref without the roadmap, a
     non-atomic rewrite landing on the stop fire) with an unbounded
     consequence, since iteration 20 becomes iteration 1 with a fresh 4 h
     clock, repeatable. One fire cannot tell an archival from a rewrite
     window; two can, because a rewrite is sub-second and an archival lasts
     across turns. So the absence is counted, the ledger line is written
     once, and the budget is reclaimed only at `ABSENT_CONFIRM_FIRES`.

     Round 7 also closed the last silent rung: a transcript over the shared
     read cap made this concern go inert for the rest of a long run while
     its budget stayed live, writing nothing — an inert mechanism
     indistinguishable in the ledger from a healthy idle run, which is the
     failure this whole roadmap exists over. It emits
     `inert-transcript-over-cap` once per run now.

     The test both council seats named independently is the one that closes
     both findings at once, and it is in the tree: a real nested worktree,
     the session in a subdirectory of it, and the two roadmap copies made
     to DISAGREE on purpose (parent 2 open, worktree 1) — because no
     assertion about paths alone can show which file was read. Its sibling
     fires three times with the worktree count advancing and asserts the
     emitted counts are `[3, 2, 1]` with no `halt-stall`; against the
     reader's tree the count is frozen at 2 for all three and the third
     fire halts.

- [ ] **0.1** The parent criterion closes on that evidence: *"a
      `process-full` contract run finishes a 3-phase roadmap with zero
      synchronous contacts, re-engaging across turns, and opens the
      PR."* Half of it was observed on 2026-08-19 — the zero-contact
      property — but it came from the operator's standing mandate, not
      from the mechanism, and attributing it to the mechanism is the
      attribution error the parent roadmap's own falsification criteria
      are written against. Step 0.0 supplies the missing half.
      `verify:` `./scripts-run src/scripts/interruption_report --root <main-checkout>`
      <!-- blocked-by: three-phase-contract-run -->
      **Stays open on the council's explicit scope boundary, not on
      effort.** Step 0.0's engagement discharges 0.0 and no more: this
      roadmap has ONE phase, so "finishes a 3-phase roadmap" cannot be
      read off this run however the rest of it went. Closing 0.1 here
      would be exactly the attribution error its own text warns about,
      one layer up. See `### blocker: three-phase-contract-run`.

      **2026-08-19, second reading — one more half arrived, and it is
      still not the whole.** Run `e9bcaa908c103495` re-engaged TWICE
      across turns and `interruption_report` reports it
      `asks=0 handbacks=0 halts=0 · elapsed=93.7 working=93.7 · re=2`.
      That matters for a specific reason this step's own text names: the
      zero-contact half was previously attributable to the operator's
      standing mandate rather than to the mechanism, and here the two
      re-engagements ARE the mechanism's own events. Zero-contact and
      mechanism-driven re-engagement now co-occur on one run id.

      What is still missing is the element the criterion actually turns
      on: **three phases.** This roadmap has one, and the run above is
      the session working THIS roadmap, so it cannot supply it. Recorded
      as a second partial rather than folded into a closure, because two
      halves of different criteria do not make one criterion — that is
      the same attribution error at a smaller scale.

      **The blocker's own recommendation was tested and holds.** It says
      "do not schedule this — the estate has several three-phase
      autonomous candidates already; the next one to be worked discharges
      this for free." On 2026-08-19 the estate had **none**: of 33 active
      roadmaps exactly three carry `execution.mode: autonomous`
      (`-carrier-layer-convergence`, `-surface-consolidation`, and this
      one), and neither of the other two has open steps in three or more
      `## Phase` sections. A `phase-checkpoints` roadmap makes the
      concern a no-op and produces no event at all, so the 30 remaining
      roadmaps cannot supply the run either. The recommendation stays
      right; the "already several candidates" premise it rests on was
      measured false, which is worth knowing before anyone waits on it.

## Acceptance criteria

- [x] `run-continuation.jsonl` holds at least one `engage` event from a
      worktree-started run, with the run id recorded here.
      Run id `12653f90d7cb4243821392afd5d8c4db`, recorded in step 0.0.
- [~] The AUTONOMY AXIS in `interruption_report` reports a non-zero
      median re-engagement count for at least one run.
      **Satisfied on the per-run reading, unsatisfiable on the aggregate
      one, and therefore DEFERRED rather than closed.** A median is taken
      *across* runs, so "median … for at least one run" cannot be
      satisfied as literally written by any number of runs. The per-run
      breakdown is what the qualifier points at, and it reports
      `12653f90d7cb4243  … re=1` — non-zero for exactly one run, as
      asked. The aggregate `median re-engagements:` stays **0**, and will
      until a majority of the window's runs engage (13 of 24 today); that
      is a property of the statistic, not a gap in the evidence.

      **Reopened 2026-08-19 on R2 finding 5, and the glyph is the whole
      point.** The previous revision ended "anyone reading the criterion
      the aggregate way should reopen this box" — and then marked the box
      `[x]`, which is the one glyph that makes that instruction
      unreachable. `[x]` counts as done, so once step 0.1 closes the
      archival sweep would have seen `count_open == 0` **and**
      `count_deferred == 0` and archived this roadmap over a criterion the
      roadmap itself flags as unresolved: the silent-archive-of-open-work
      case Iron Law 3 of `roadmap-progress-sync` exists to catch, routed
      around by glyph choice rather than by argument. `[~]` routes it
      through the deferred-resolution gate instead, where the two readings
      are decided by someone rather than left "settled" by a checkbox.

      **What closes it:** either a window in which a majority of runs
      engage, so the aggregate median is non-zero on the criterion's
      literal wording — or a deliberate re-wording of the criterion to the
      per-run reading, which is a decision about what was being measured
      and not a re-measurement.

## Blockers

### blocker: three-phase-contract-run
- **Status:** open
- **Owner:** any autonomous `process-full` run, no dedicated effort
- **Class:** 3 — human-only, and deliberately not 0. An agent executes the
  *work* that discharges this, but it cannot authorize the trigger: picking
  which roadmap gets worked next is the operator's call
  (`scope-control § Authoring vs. implementation`), so there is no `Run:`
  command that produces a qualifying run. Declaring 0 and pointing `Run:` at
  the *check* command would label a verification as a discharge, which is the
  gate-that-cannot-fire shape this repo already rejects once.
- **Blocks:** step 0.1 only. Step 0.0 is closed on its own evidence and does
  not wait for this.
- **What to do:** claim a roadmap that (a) carries `execution.mode: autonomous`
  in its frontmatter, (b) has **three or more `## Phase` sections with open
  steps**, and (c) is not this roadmap — then run it to completion from a
  worktree and open its PR. Check candidates with
  `./agent-config roadmap:progress` for the phase count and
  `grep -A2 '^execution:' agents/roadmaps/<slug>.md` for the mode; a roadmap in
  `phase-checkpoints` mode makes the concern a no-op and produces no event at
  all. Then read the run back with
  `./scripts-run src/scripts/interruption_report --root <main-checkout>` and
  confirm `asks=0 handbacks=0` alongside a non-zero `re=` on that run id.
- **Recommendation:** **do not schedule this.** Wait for the first qualifying
  run and close 0.1 off it, because the criterion is about what the mechanism
  does during ordinary work — manufacturing a three-phase run to satisfy it
  reproduces the ecological-validity problem the council already flagged
  against the self-referential observation, one size larger. The estate has
  several three-phase autonomous candidates already; the next one to be worked
  discharges this for free.
- **CONTINGENT AS OF 2026-08-19, and the criterion is NOT weakened.** The
  sentence above about "several candidates already" was measured false the same
  day it was written, and the estate has since gone further: both remaining
  `execution.mode: autonomous` roadmaps — `road-to-carrier-layer-convergence` and
  `road-to-surface-consolidation` — are parked in `later/`, each with zero
  runnable open steps behind a Class 3 blocker. So the active autonomous estate is
  **intentionally zero**, and no roadmap now in the estate can produce the
  qualifying run.
  **Currently unreachable is not impossible**, and the distinction is the whole
  point of recording it this way: a genuine qualifying roadmap can enter the
  estate at any time, at which point this discharges as a side effect exactly as
  the recommendation intends. What must NOT happen is adjusting the three-phase
  requirement because today's estate cannot exercise it — availability of test
  material and validity of the test are separate questions, and only a maintainer
  concluding that three-phase coverage is disproportionate should change it.
  Equally, not every technically three-phase roadmap qualifies: the run has to
  carry genuinely runnable autonomous work in three or more phases, or it produces
  weak evidence for the behaviour 0.1 exists to validate.
  AI council 2026-08-19, 2/2 convergent (anthropic/claude-sonnet-4-5 +
  openai/codex-default, two rounds, blind peer review) — both seats reached this
  independently, and both rejected weakening the criterion to match the estate.
- **If you do nothing:** step 0.1 stays open at 3 of 4 items. Nothing regresses
  and no evidence decays — the ledger line from 0.0 is durable. The cost is one
  parked roadmap carrying one criterion, which is the shape its own risk 3 accepts
  by design.
  *Corrected 2026-08-19:* this read "stays in the active estate", which the same
  change that parked this file made false, and the note above it says so two
  bullets earlier. A blocker entry contradicting its own neighbour is worse than
  either version alone, because a reader cannot tell which half is stale.
- **Resolved when:** `interruption_report` shows one run id with `re=` non-zero,
  `asks=0`, `handbacks=0`, whose claimed roadmap had ≥ 3 phases and reached a
  PR — and that run id is recorded at step 0.1.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-19 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The observation is claimed from a green test rather than a real run | product | The defect survived a release precisely because a passing integration test looked like proof; accepting a test as the evidence here would repeat that exactly. | Step 0.0 names the `.jsonl` line as the artifact and says in its own text why a test cannot substitute. | Phase 0 |
| 2 | The engagement fires but the ladder halts on the wrong rung | implementation | An `engage` event proves the contract was found, not that the termination ladder behaves; a stall-halt on the first iteration would satisfy the letter of 0.0. | 0.0 records the iteration count reached, so a degenerate single-iteration engagement is visible in the evidence rather than hidden by it. | Phase 0 |
| 3 | This roadmap becomes the indefinite deferral it was created to avoid | product | Carrying an item into a follow-up is exactly the shape both council seats named in their strongest counter — a named destination is not a schedule. | The criterion closes on the FIRST qualifying run rather than on a dedicated effort, so any future `process-full` in a worktree discharges it as a side effect. If none has by the next task boundary it is raised again per `active-remediation`, not aged out. | Phase 0 |
