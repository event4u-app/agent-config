---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---

# Road to composite dispatch topology — mixed-shape plans over the existing form gate

> **Source:** `agents/tmp.old/graph-vs-prompt` — an external reference plus a
> drafted roadmap and a drafted command, drained 2026-08-22. Every `file:line`
> below was re-verified against the worktree on the drain date; one of the
> draft's claims was overstated and is corrected in § The correction. The
> external reference's own figures were read via secondary coverage and are
> **not** relied on anywhere in this plan.
>
> **Parked in `later/` on arrival.** It was never active. See § Why this is
> parked before its first phase — the gate is an instrument, not appetite.

## Resume when

**Resume when ALL of:** (a) the orchestration claim queue is free and the
≥ 20-audit-line bar is met, **and** (b) a post-hook telemetry capture rate has
been recorded somewhere citable. The first two conjuncts are mirrored from the
sibling parked on the identical gate,
[`road-to-cost-parity-2-state-aware-dispatch.md`](road-to-cost-parity-2-state-aware-dispatch.md)
§ parking block, which reads: "the orchestration claim queue is free and the
≥ 20-audit-line bar is met". The third conjunct is added here and is argued in
§ Why this is parked — this roadmap's Phase 1 IS a measurement, so it inherits
the instrument's condition as well as the queue's.

## Goal

A delegable task whose slices form a partial order — ordered stages containing
parallel groups — can be planned as one artefact, executed with the existing
dispatch modes as the per-stage machinery, verified with slice-scoped repair,
and resumed from a durable ledger. All of it behind an explicit trigger, and
all of it gated on a pre-registered measurement that is allowed to close the
roadmap with an honest null.

## Context — the confirmed gap

**The form gate maps one task to one form.** `src/skills/subagent-orchestration/SKILL.md:89`
heads `## Form gate — deterministic, BEFORE mode selection`, and the table at
`:96-103` carries six forms — `parallel`, `worktrees`, `steps`, `judge`,
`verify-council`, `none` — each on its own row keyed to one task shape. A task
shaped "ordered step → parallel group → fan-in → ordered step" matches at most
one row, so it degrades to all-serial or all-parallel.

**The classifier sees a count, not an order.** `src/scripts/_lib/auto_dispatch.ts:34`
declares `parallelizable?: 'steps' | 'files' | 'independent' | null`, `:38`
declares `independent_slices?: number`, `:80` reads
`const slices = signals.independent_slices ?? 0`, and the branch at `:84-89`
resolves ordering first and slice-count second — so a task carrying **both**
signals is silently resolved to `do-in-steps`. `DispatchMode` at `:28` is two
values wide: `'do-in-steps' | 'do-in-parallel'`. The skill's table defines six
forms; the classifier can emit two.

**Nothing records the collapse.** A repo-wide grep for `shape_downgrade`
returns 0 hits. `stages:` returns 7, all prose or unrelated strings.
`composite` returns 512 and not one of them is orchestration telemetry — they
are database indexes, UI components, design tokens and a latency metric.

**The extension vehicle already exists.**
`src/agent-src/contexts/execution/orchestration-telemetry.md:49` defines
`dispatch_mode` as an enum of eight modes — `do-and-judge`,
`do-and-judge-two-stage`, `do-in-steps`, `do-in-parallel`, `do-competitively`,
`judge-with-debate`, `do-in-worktrees`, `do-with-live-app-judge` — plus `none`.
`composite` is absent, and that enum is where it would land. The field is
already wired: `src/scripts/_lib/orchestration_record.ts:60` and `:346`, CLI
flag at `src/scripts/orchestration_record.ts:129`.

## The correction — the draft overstated one claim

The source draft asserted that no partial expression of per-step topology
exists. That is wrong, and the correction is recorded here rather than
inherited silently. `src/agent-src/contexts/execution/subagent-topologies.md:19`
already documents `do-in-worktrees` with topology `adaptive` and the note
"per-step topology of the underlying mode", and `:34` defines `adaptive` as
"topology shifts per step; outer chain remains hub".

What the draft got right is the *enforcement*, not the existence: that file's
first line (`:3`) reads "Descriptive, not enforced", and `:21-25` calls the
table "the **starting point**, not a constraint" and topology "metadata for
capacity planning, not runtime-enforced". So one form already *describes* a
per-step shape and nothing acts on it. The gap this roadmap addresses is that a
plan cannot **express** a partial order and no telemetry can **see** the
collapse — narrower than the draft claimed, and still real.

## Why this is parked before its first phase

Two preconditions, and neither is about appetite.

**One orchestration claim at a time.** The standing rule lives in the
acceptance criteria of the archived
`agents/roadmaps/archive/road-to-orchestration-scope-decision.md:301-302` —
"Exactly one orchestration claim is pre-registered, deterministically scored,
and resolved to `backed` or honest-null — never left ambiguous" — with the
≥ 20-audit-line bar stated separately in the same file at `:129` ("≥20 real
orchestration audit lines") and argued at `:115-117`. Note the rule and the bar
are two statements in two places; the single-sentence form exists only in the
roadmaps that cite it. A sibling is already parked on this identical gate:
`later/road-to-cost-parity-2-state-aware-dispatch.md:275-287` carries
`### blocker: orchestration-claim-queue`, and `:283-284` records that "Only 1
`ask`-route line exists, and model-carried capture measured 0.27 % before the
hook existed".

**The instrument, not the appetite.** `docs/CLAIMS.md:266-272` holds
`claim: orchestration-observed-dispatch-cost` at `status: resolved-null`
(`:271`), and `:269` records "0.27% telemetry capture (370 dispatches, 1
recorded line)" — that one line being a single hand-emitted July 2026 record.
An `orchestration_record` hook now exists
(`src/scripts/hooks/orchestration_record_hook.ts:6`, registered at
`src/scripts/hooks/concern_registry.ts:115`, bound in the `post_tool_use` chain
per `src/scripts/hook_manifest.json`), and
`agents/roadmaps/archive/road-to-orchestrator-discipline-carriers.md:169`
declares the 0.27 % figure "obsolete for future sessions". **No replacement
rate has ever been measured.** A grep of `docs/CLAIMS.md` and `agents/` returns
no post-hook capture rate at all.

Phase 1 of this roadmap is a measurement. A measurement roadmap whose
instrument last reported 0.27 % capture, and whose successor instrument has no
recorded rate, is gated on the instrument. That is the third resume conjunct,
and it is why this file is parked rather than queued.

## Non-goals

- No execution engine, DSL, or third-party graph runtime enters the package.
- No auto-detection that silently upgrades a task to composite dispatch. The
  trigger is the command in Phase 3 or an unambiguous explicit instruction.
- No mid-run re-planner. Phase 1 records a proxy for it as a separate evidence
  stream, consumed by a different roadmap.
- No renaming of the existing six forms or eight modes into graph vocabulary.

## Phase 1 — Measure the collapse before building anything

- [ ] **1.1 Add `shape_downgrade` to the existing dispatch line.** Set it when
      the form gate resolves to `steps` or `parallel` while the structural
      signals carried BOTH ordering and ≥ 2-independent-slice evidence. The
      classifier already computes both inputs (`auto_dispatch.ts:80-89`); this
      records their co-occurrence and changes no routing.
      verify: `git show HEAD:src/scripts/_lib/auto_dispatch.ts | grep -c shape_downgrade`
      returns 0 before the change; a fixture carrying both signals emits the
      field and resolves to the same mode it resolved to before.
- [ ] **1.2 Pre-register the build gate BEFORE the window opens.** Record the
      firing threshold, the accumulation window and the kill criterion for the
      whole roadmap in a pinned file, committed before any line is collected.
      A threshold chosen after seeing the data is not a threshold.
      verify: the pinned file's commit precedes the first collected line, shown
      by `git log --format=%cI -1 -- <pinned-path>` against the earliest
      `shape_downgrade` timestamp in the log.
- [ ] **1.3 Record the re-plan proxy as a separate stream.** A step return that
      invalidated a later planned step, visible as an abandoned-plan marker.
      This is evidence for a future roadmap and is explicitly not consumed here.
      verify: the proxy is emitted on its own field and no phase in this file
      reads it.

**Exit gate:** the field ships, the pre-registration is committed, and the
window runs. Phases 2-6 stay closed until the threshold is met. A window that
closes below threshold closes this roadmap with an honest null in the Claims
Ledger — and that outcome is a success, not a failure.

## Phase 2 — A plan artefact that can express a partial order

- [ ] **2.1 Extend the plan, never the classifier, with an optional `stages:`
      shape.** An ordered list of stages, each a set of slices, with per-slice
      tier inference applied unchanged. Stage-parallel is the simplest form
      that covers the measured cases; a general dependency graph is adopted
      only if Phase 1's evidence contains a shape stage-parallel cannot
      express, and that upgrade re-triggers this phase's review.
      verify: a plan with no `stages:` key produces a byte-identical dispatch
      against a recorded fixture.
- [ ] **2.2 Validate the plan before any spawn.** Every slice in exactly one
      stage, no empty stage, stage count × `subagents.max_parallel` × tier
      estimate inside the spend ceiling. An invalid plan is an in-session
      no-op with the reason surfaced — never a partial spawn.
      verify: three fixtures — duplicated slice, empty stage, over-ceiling —
      each produce a no-op and a reason string, and none spawns.
- [ ] **2.3 Scope the context packets.** Each slice's worker prompt carries the
      existing worker-prompt contract plus ONLY the prior-stage returns its
      declared inputs name — never the whole run history.
      verify: a two-stage fixture asserts the stage-2 prompt contains the
      declared input and does not contain a stage-1 return it did not declare.

**Exit gate:** the schema is documented in the subagent-boundary contract, a
lint rejects invalid staged plans, and non-staged plans are byte-identical.

## Phase 3 — Execution and the explicit trigger

The command drafted in the source lands here as this phase's artefact, not as
a separate deliverable. Its shape is fixed by the draft and by the boundaries
below: internal visibility, `suggestion.eligible: false` so it is reached by
explicit name and never auto-suggested, frontmatter mirroring the existing
full-run exemplar, and skills `subagent-orchestration` plus
`complexity-first-planning`.

- [ ] **3.1 Ship the command as plan → present → execute.** Decompose, derive
      stage order from declared dependencies only — ambiguity yields fewer
      stages and more serialization, never a guessed edge — present one compact
      block (stages, slices, tiers, ceiling share, ledger path), and execute on
      acceptance. Stages run in order; slices within a stage use the existing
      parallel machinery; hand-off between stages is verbatim and declared-only.
      verify: a fixture task produces the presentation block before any spawn,
      and an unaccepted plan spawns nothing.
- [ ] **3.2 Carry the boundaries through unchanged.** The invocation is the
      grant for repository-scoped machine-executable actions inside the run
      ceiling; a worktree-form stage still requires the worktree to have been
      asked for; the judge Iron Law, the delegability floor,
      `subagents.max_parallel`, the two-cycle ceiling and every safety floor
      hold. Composite topology changes what a plan can express, never who may
      authorize its consequential parts.
      verify: a fixture whose plan contains a worktree-form stage without a
      worktree instruction refuses that stage and says why.
- [ ] **3.3 Record `dispatch_mode: composite`.** Add the value to the enum at
      `orchestration-telemetry.md:49` and emit it with the stage count.
      verify: the emitted line validates against the extended enum, and a
      replay of pre-extension lines still parses.

**Exit gate:** an end-to-end run on a real mixed-shape task drawn from Phase 1's
captured cases, with a telemetry line carrying `composite` and a stage count.

## Phase 4 — Slice-scoped repair

- [ ] **4.1 Repair at slice scope, not run scope.** A slice failing its
      verification re-enters the repair loop under the same worker contract
      with the same two-cycle ceiling per slice, and the total run repair
      budget stays capped at the existing run ceiling. The aggregate judge
      still runs once at fan-in — this narrows granularity, it does not add a
      second judgment layer.
      verify: a forced-failure eval shows only the failed slice re-running.
- [ ] **4.2 A hole holds the gate.** A slice that exhausts its cycles marks its
      stage `partial`; every later stage that declared it as an input HOLDS
      rather than running on a hole, and the run hands back with ledger state.
      verify: the same eval asserts downstream stages did not spawn.

**Exit gate:** the forced-failure eval lives in the orchestration skill's evals
and demonstrates both halves in one run.

## Phase 5 — A durable ledger for ad-hoc runs

- [ ] **5.1 Persist staged-run state as a checkbox-shaped ledger.** Stage and
      slice status, accepted returns by reference, in the session workspace —
      the pattern roadmap execution already proves. Resume re-reads the ledger,
      skips closed slices and respawns open ones under the same accepted plan.
      verify: a kill-and-resume eval interrupts after stage 1 and resumes
      without re-executing closed slices.
- [ ] **5.2 Keep it explicitly minimal.** No daemon, no watcher; the ledger is
      read on command re-invocation only, and a changed task description voids
      it and restarts planning.
      verify: no background process is registered, and a fixture with an
      altered task description restarts at planning rather than resuming.

**Exit gate:** the kill-and-resume eval passes and no persistent process ships.

## Phase 6 — Prove or drop

- [ ] **6.1 Close the pre-registered window.** Compare composite runs against
      their serial counterfactual — the plan's stage-sum estimate — on
      wall-time and outcome quality, and publish under the honest-null
      discipline whichever way it lands.
      verify: the Claims Ledger carries an entry with a status, in either
      direction, citing the pre-registered threshold from Step 1.2.
- [ ] **6.2 Drop cleanly if it does not clear.** Below the pre-registered
      value, remove the command and keep the plan-artefact documentation as an
      archived design note.
      verify: `./scripts-run src/scripts/check_references` is clean after
      removal, and the design note is reachable from the Claims Ledger entry.

**Exit gate:** a Claims Ledger entry either way, and the roadmap closes.

## Blockers

### blocker: orchestration-claim-queue

- **Status:** open
- **Owner:** maintainer
- **Blocks:** every phase, including Phase 1 — Phase 1 IS the pre-registered
  claim, so opening it is exactly the act the queue rule bounds.
- **What to do:** pick exactly one —
  (a) confirm the queue is free and the bar is met, then unpark: check that no
  other orchestration claim is pre-registered and that the audit log holds
  ≥ 20 real orchestration lines, and record both readings with the command
  that produced them; or
  (b) leave it parked and record the current audit-line count as a dated
  reading in this file, so the next reader can tell movement from noise.
  A count read from recollection is not a reading — it comes from the log.
- **Why it is not an agent step:** the queue rule is a standing constraint on
  how many claims this project has open at once, and both the priority between
  competing claims and the decision to spend the slot on this one are the
  owner's.
- **Recommendation:** (b), and it is what this file already does. The sibling
  parked on the identical gate records only 1 `ask`-route line against a bar
  of 20, so unparking today would open a claim that cannot be scored.
- **If you do nothing:** the file stays parked with no dated reading, and the
  next reader cannot tell whether the audit log moved since 2026-08-22 or
  whether nobody looked. That is the difference between a parked roadmap and
  a forgotten one.
- **Resolved when:** either the queue is recorded free with the audit-line
  count at or above the bar, or a dated count is written into this file and it
  stays parked.

### blocker: post-hook-capture-rate

- **Status:** open
- **Owner:** maintainer
- **Blocks:** the third resume conjunct, and through it Phase 1 Step 1.2 —
  a threshold pre-registered against an unknown capture rate cannot be sized.
- **What to do:** pick exactly one —
  (a) measure the capture rate since the `orchestration_record` hook landed —
  recorded lines over observed `Agent`/`Task` completions in the same window —
  and write it into `docs/CLAIMS.md` beside the superseded 0.27 % figure; or
  (b) declare the rate unmeasurable from here, name why, and set Phase 1's
  window on elapsed time rather than on a line count, recording that the
  threshold is therefore uncalibrated.
  Option (b) weakens what Phase 6 may claim and must be noted at Step 1.2 in
  the same change.
- **Why it is not an agent step:** the numerator needs a real session corpus
  the tree does not hold, and option (b) changes the strength of a claim this
  roadmap would make.
- **Recommendation:** (a). The hook is shipped and bound, so the numerator is
  collectable from ordinary sessions; the 0.27 % figure has already been
  declared obsolete in the tree, and leaving no replacement means every later
  orchestration measurement inherits an unknown denominator.
- **If you do nothing:** Step 1.2 must pre-register a threshold against an
  unmeasured capture rate, so a below-threshold window stays indistinguishable
  from a window nothing reached — Risk 1 exactly — and Phase 6's honest null
  would be unreadable in either direction.
- **Resolved when:** `docs/CLAIMS.md` carries a post-hook capture rate with its
  window and denominator, or this file carries the written unmeasurable
  declaration and Step 1.2 names its uncalibrated threshold.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The measurement is built on an instrument nobody has re-measured | implementation | Phase 1 counts events through a path whose predecessor captured 1 line in 370, and whose successor has no recorded rate at all — a below-threshold window would be indistinguishable from a window nothing reached | The third resume conjunct blocks the whole roadmap on a recorded post-hook rate, and `post-hook-capture-rate` forces either a measurement or a written statement that the threshold is uncalibrated | Why this is parked before its first phase |
| 2 | The threshold is chosen after the data | implementation | A build gate set once the window's shape is visible is not a gate, and the honest-null exit stops being available the moment the number is fitted to the result | Step 1.2 requires the pinned file's commit to precede the first collected line, verified by comparing commit time against the earliest emitted timestamp | Phase 1 — Measure the collapse before building anything |
| 3 | `stages:` grows into a general dependency graph by increments | implementation | Stage-parallel covers the measured cases; each unmet case invites one more edge type, and a general graph arrives without anyone deciding to build one | Step 2.1 permits the upgrade only on Phase 1 evidence containing a shape stage-parallel cannot express, and makes that upgrade re-trigger the phase's review | Phase 2 — A plan artefact that can express a partial order |
| 4 | Composite dispatch becomes reachable without being asked for | product | An expressive plan shape is most useful when it fires automatically, and the cheapest next step after Phase 3 is to let the classifier pick it — which would convert an explicit grant into an inferred one | The command ships `suggestion.eligible: false` and the Non-goals forbid auto-detection; Step 3.2 keeps the worktree carve-out and every safety floor intact | Phase 3 — Execution and the explicit trigger |
| 5 | Adding `composite` to the enum breaks replay of existing lines | implementation | The `dispatch_mode` enum at `orchestration-telemetry.md:49` is consumed by existing readers, and a value they do not know can drop or misclassify historical lines | Step 3.3 requires a replay of pre-extension lines to still parse, asserted alongside the new value's own emission | Phase 3 — Execution and the explicit trigger |

## Acceptance Criteria

- [ ] AC-1 — `shape_downgrade` is emitted on the existing dispatch line, and a
      fixture carrying both ordering and slice-count signals resolves to the
      same mode it resolved to before the field existed.
- [ ] AC-2 — The build threshold, its window and the roadmap's kill criterion
      are committed before the first collected line, demonstrated by commit
      time against the earliest emitted timestamp.
- [ ] AC-3 — A plan with no `stages:` key produces a byte-identical dispatch
      against a recorded fixture, so the plan extension is provably inert when
      unused.
- [ ] AC-4 — An invalid staged plan spawns nothing and surfaces its reason, for
      each of the duplicated-slice, empty-stage and over-ceiling cases.
- [ ] AC-5 — A slice that exhausts its repair cycles leaves every stage that
      declared it as an input unspawned, shown by a forced-failure eval.
- [ ] AC-6 — An interrupted staged run resumes without re-executing closed
      slices, and a changed task description restarts at planning instead.
- [ ] AC-7 — The Claims Ledger carries an entry for the pre-registered
      comparison in either direction, citing the threshold from AC-2; a
      below-threshold result removes the command and leaves the plan-artefact
      note reachable from that entry.
