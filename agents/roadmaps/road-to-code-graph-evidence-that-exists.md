---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-28
research_pin: "agent-config @ 905087463 (origin/main, 2026-08-28). Every anchor below was re-read at this pin by the /analyze:inbox verification pass. The source analysis proposed flipping the code-graph setting on; that step is not carried, because a live ADR decides the question it assumes is open."
relates: []
# relates: grepped every active, later, stub and archived roadmap for
# `code-graph`, `code intelligence`, `benchmark` and `recall`.
# stubs/road-to-code-graph-benchmark-rerun.md holds the transferred criterion
# and the open blocker this roadmap resolves; archive/road-to-inbox-harvest-
# 2026-08-f-code-graph-evidence-refresh is its completed parent (0 open steps)
# and produced ADR-246 plus the CLAIMS `measured_on:` field;
# archive/road-to-code-graph-extractor-defect landed the 2026-08-22 repair;
# skipped/road-to-code-graph-orchestration was declined. No active roadmap owns
# the re-measurement.
estate_growth_exempt: "Charges +1 active. Warranted on a measurement: this suite ships a complete native code-graph engine (11 modules under src/scripts/code_graph/, seven dispatched CLI verbs, a skill and a routing rule) that is default-off on the strength of a recall figure measured 2026-07-28 against a build predating the extractor repair of 2026-08-22 — docs/CLAIMS.md records that the figures describe a build that no longer exists. The blocker gating the re-measurement is transferred to a stub and open. A shipped engine judged by a measurement of code that no longer exists is the defect this roadmap owns, and no active roadmap owns it. Measured, not predicted: on the committed change `check_estate_count` reads `+5 active / -0 disposed, 5 exempt` and `open_blockers 31 to 42`, of which this file contributes +1 active and +2 open blockers."
estate_offset_exempt: "No archive move is available in this change: the /analyze:inbox run that authored this file consumed only gitignored inbox artefacts and archived no roadmap. Its Phase 4 retires a stub, but stubs live under agents/roadmaps/stubs/ and are not counted by the estate ratchet, so retiring one offsets nothing countable."
---
# Road to a code-graph verdict measured on the code that exists

## Goal

The published recall verdict on this suite's native code graph is re-measured
against a build that includes the 2026-08-22 extractor repair, on a corpus this
repository actually contains, and published whichever way it lands. The default
does not move on the strength of this roadmap: what moves is that the number
describes the engine that ships, so the standing decision rests on evidence
rather than on a figure whose own claims file records as measuring a build that
no longer exists.

## Context

> **Source:** `agents/tmp.old/runtime-code-intelligence/` — a four-proposal
> analysis round (2026-08-28). The owner directive governing the workstream is
> recorded durably at
> `agents/evidence/analysis/runtime-execution-directive-2026-08-28.md`; this
> roadmap cites that record, not the gitignored transcript.

### What already ships — and it is nearly everything

Verified at the pin. The source round treated code intelligence as unbuilt; it
is built:

| Surface | State |
|---|---|
| Native engine | `src/scripts/code_graph/` — eleven modules: build, query, explain, detect, extract, intent, loader, sanitize, sqlite_store, types, validate. Content-addressed graph with a SQLite twin, an edge-confidence taxonomy, three-state freshness, intent routing with a pre-registered ship gate. |
| CLI | `agent-config code-graph build \| validate \| detect \| query \| explain \| affected \| path` — seven verbs, dispatched. |
| Consumption obligation | `src/skills/code-intelligence/SKILL.md` and the `external-code-graph-interop` rule already say: query the index first, grep is the fallback, name which source answered. |
| Extractor repair | Landed 2026-08-22 (`agents/roadmaps/archive/road-to-code-graph-extractor-defect.md`). |

**Nothing in this roadmap builds an engine.** Building one would be duplication
of a shipped surface, which is the most expensive mistake available here.

### The actual defect

`docs/CLAIMS.md` publishes the retrieval verdict — native graph recall 0.365
against disciplined grep 0.797 on graph-shaped questions — and records, in the
same entry, that it was measured on 2026-07-28 **against a build predating the
extractor repair of 2026-08-22**. The settings template carries the reopen
condition in the same terms: external evidence, or a re-measurement on a build
that postdates the repair.

So the standing default rests on a number that, by the tree's own record, does
not describe the code that ships. That is not an argument that the default is
wrong — it may well be right. It is an argument that nobody currently knows,
and that the suite is publishing a `backed` claim about a build it deleted.

### Why the flip is not a step here

The source round's step was "flip `hooks.code_graph.enabled` on, measured". It
is not carried, for two independent reasons, and the first was invisible to
every file in the round:

1. **ADR-246 (accepted 2026-08-26, unsuperseded) already decided it.** The
   parser pair stays in `devDependencies` and the native engine is a
   maintainer-only surface; its explicitly rejected alternative is promoting
   the pair back to `dependencies`. **No inbox file names ADR-246.** Under
   `decision-revisit-gate`, a lock is evaluated before it is cited and reopened
   through the recorded route — never stepped over by a roadmap that did not
   open it.
2. **A flip alone would not work.** Without the ABI-locked pair a consumer flip
   enables a load path that cannot resolve. So the flip is not one decision but
   two, and the second — re-imposing the dependency weight on every consumer —
   is the one ADR-246 rejected.

What this roadmap produces is the **evidence input** to that reopen, not the
reopen. If the re-measurement shows the repaired extractor still loses to grep,
ADR-246 is confirmed on fresh evidence and the question closes properly. If it
shows the opposite, the reopen has a basis it does not have today. Either
outcome is worth more than the current state, in which the question is decided
by a measurement of absent code.

## Phase 0 — Resolve the blocker that made the re-run impossible

- [x] **0.1 Record the disposition of `b-bench-inputs-absent` as option (b).**
      The blocker in `agents/roadmaps/stubs/road-to-code-graph-benchmark-rerun.md`
      offers three options; (a) needs three external repository clones and four
      pinned files this environment does not hold, and (c) — scoping the stale
      figure — already landed on the parent. (b) re-pre-registers a smaller
      benchmark against corpora this repository already contains, **accepting
      that its numbers are not comparable to the 2026-07-28 run and saying so
      in `docs/CLAIMS.md`**.
      verify: the blocker carries `Status: resolved` with (b) named, and this roadmap is cited as where the work happens.
- [x] **0.2 Pre-register before measuring.** The question set, the corpus, the
      scoring rule and the pass bar are written and committed **before** the
      first run. A bar chosen after seeing a number is not a bar.
      verify: the pre-registration file is committed in a commit that precedes the first result commit, checkable from `git log --follow` on the two paths.

## Phase 1 — A corpus this repository contains

- [x] **1.1 Shapes, never consumer identity.** The corpus is built from code
      shapes present in this tree — the ambiguous-class cases the existing
      classification analysis already enumerated are its first items. No
      external clone, no consumer repository, no borrowed identity.
      verify: every corpus item resolves to a path inside this repository or to a synthetic fixture committed with it; a test asserts no item references an out-of-tree path.
- [x] **1.2 The question set covers what the graph claims to answer.**
      Callers, references, implementations of an interface, transitive impact,
      and path-between — the relations the shipped query surface exposes.
      Questions where grep is obviously sufficient are included deliberately,
      as the negative control.
      verify: every one of the shipped query verbs has at least one question, and at least a quarter of the set is negative control, both asserted by a test over the corpus file.
- [x] **1.3 The corpus states its own limits.** In the same file: what it does
      not cover, and why its numbers are not comparable to the 2026-07-28 run.
      verify: the limits section exists and names the incomparability explicitly, so no later reader can quote a delta between the two runs.

## Phase 2 — Measure, and publish whichever way it lands

- [x] **2.1 Run both arms on the repaired build.** Native graph and
      disciplined grep, same questions, same scoring, current `HEAD`.
      verify: the report records the commit under measurement, and that commit postdates the 2026-08-22 repair — asserted mechanically, not read by eye.
- [x] **2.2 Publish the result unchanged.** Into `internal/bench/reports/` with
      its own date, and a `docs/CLAIMS.md` entry carrying `measured_on:` and
      the incomparability note. **A result worse than the pre-registered bar is
      published identically** — an honest null is the outcome this roadmap is
      most likely to produce and is a complete success of it.
      verify: **re-scoped by the `whether-a-non-comparable-number-is-worth-publishing` resolution to (b)** — no second claims entry is created; instead `claim:code-graph-retrieval-null` carries a pointer to the report plus an explicit superseded-build note, `check_claims` passes, and the report states the pre-registered bar beside every result.
- [x] **2.3 The stale figure is re-scoped, never deleted.** The 2026-07-28
      entry keeps its number and gains a pointer to the new one, so the record
      shows a question answered twice rather than a number quietly replaced.
      verify: both entries are present in `docs/CLAIMS.md` and each names the build it measured.

## Phase 3 — What the result is allowed to change

- [ ] **3.1 Route, never permit.** If the repaired engine wins on a question
      class, the routing rule and the code-intelligence skill state that class
      as a graph-first case. **The benchmark changes routing; it never changes
      permission** — the default and the dependency question stay ADR-246's.
      verify: the skill and rule name the winning classes, and neither file changes any setting default; checkable from the diff.
- [ ] **3.2 The consumers that already exist get the better answer.** Where
      the graph wins, the composition-before-creation `new` verdict cites a
      structural closest candidate rather than a textual one.
      verify: a fixture `new` verdict cites a candidate obtained from the graph query surface, and falls back to the textual path with a stated reason when the graph is stale or absent.
- [ ] **3.3 A stale or absent graph never produces a confident answer.** The
      existing three-state freshness verdict is surfaced at every consumer
      added here.
      verify: a fixture query against a stale graph returns a degraded verdict naming the staleness; against an absent graph, `unavailable`.
- [~] **3.4 The ADR-246 reopen, if the evidence supports it.** Deferred by
      construction: this step is a decision for the owner on fresh evidence,
      taken in its own change under `decision-revisit-gate`, never a checkbox
      flipped by the run that produced the evidence. The roadmap that measures
      a lock does not get to lift it.
      verify: the measurement from Phase 2 is cited in an ADR-246 reopen record, or the ADR is confirmed on the fresh number — either outcome recorded, neither performed here.

## Phase 4 — Close the transferred stub on its own null path

**Re-scoped 2026-08-28 by AI council (anthropic + openai, 1 round, $0.00, 2/2
convergent that the phase as originally written must not be executed).** The
original 4.1 retired the stub *as a consequence of* the substitute benchmark
landing. Two prior councils had already ruled that a non-comparable benchmark
"neither replaces this obligation nor closes this stub", and both seats today
agreed that retiring on that basis would launder a substitution into a
completion however honest the outcome line was — one seat put it as: honest
wording "does not cure the invalid causal basis for closure".

What both seats endorsed instead is the stub's **own** documented null path: a
determination that the original inputs are irrecoverable. That determination is
the sole closure authority. The benchmark carries **zero closure credit** and
its completion has **no dependency relationship** with this phase.

- [ ] **4.1 Record the irrecoverability determination.** The four SHA-256-pinned
      question files and the three registered corpus clones are not reasonably
      obtainable: they are private third-party repositories that cannot be
      published, vendored or synthesized, so the obstacle is a permission and
      ownership fact rather than a lost file. The probe is re-run and its
      readings recorded before the determination is written, not after.
      verify: an evidence file records every probe reading at a named date, and states the determination in terms a probe alone cannot supply — that the project has no present or reasonably obtainable authorized access and will not pursue reacquisition.
- [ ] **4.2 Retire the stub as CLOSED UNMET, on that determination alone.** The
      outcome line names irrecoverability as the closure authority, states that
      the transferred criterion was **not** met and no re-run was performed, and
      states that the in-repo benchmark neither satisfied, replaced, nor
      contributed to the closure. "Archived" must not read as "achieved" — the
      stub's own words.
      verify: the retired stub's outcome line names irrecoverability as the authority and carries the words "closed unmet"; it states the criterion was not met; and it disclaims the benchmark's contribution to closure. The benchmark report is linked as independent evidence only, with no claims entry.
- [ ] **4.3 The two phases are independent, checkably.** Nothing in Phase 4
      reads a Phase 2 result, and nothing in Phase 2 depends on Phase 4.
      verify: the retirement text cites no benchmark figure as a reason for closure — checkable from the diff.

## Blockers

### blocker: what-the-pre-registered-bar-is

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — per-question-class bars.** AI council 2026-08-28,
  members anthropic + openai, 1 round, $0.00 (both seats subscription-authed),
  **2/2 convergent**. The decision this evidence feeds is a routing decision per
  question class, so a single aggregate answers a question nobody is asking; one
  seat added that an aggregate "produces a verdict that doesn't match how the
  feature would actually be used". Both seats named the same cost — per-class
  bars add degrees of freedom for cherry-picking — and both named the same
  mitigation: every class and its bar is pre-registered before any result exists,
  which is what step 0.2 and AC-2 already require. A secondary macro-average is
  reported but is explicitly **not** the pass criterion.
- **Blocks:** step 0.2, and through it Phase 2. Phase 1's corpus is built under
  any answer.
- **What to do:** pick exactly one — (a) the graph must beat grep on recall
  across the whole question set: a single clean number, and it lets one
  question class the graph is genuinely good at be drowned by classes where
  grep is trivially sufficient; (b) per-question-class bars, with the verdict
  reported per class: matches how the result would actually be used, at the
  cost of more pre-registration work and more ways to read a mixed outcome;
  (c) no bar at all — report both arms per class and let the reader judge:
  impossible to game, and it gives up the pre-registration discipline that
  makes the number trustworthy.
- **Resolved when:** the choice is recorded here and the 0.2 pre-registration
  states it.
- **Recommendation:** (b). The decision this evidence feeds is a routing
  decision per question class, so a single aggregate answers a question nobody
  is asking; and the negative controls in 1.2 exist precisely so a per-class
  report cannot be read as a blanket win.
- **If you do nothing:** the measurement runs without a bar and its result is
  argued about afterwards, which is the shape a pre-registration exists to
  prevent.

### blocker: whether-a-non-comparable-number-is-worth-publishing

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **(b) — publish the report, make no new claims entry, and
  re-scope the 2026-07-28 entry so its superseded build is unmistakable.**
  AI council 2026-08-28, members anthropic + openai, 1 round, $0.00, **split on
  the letter and convergent on the resolver**: both seats made their answer
  conditional on the same checkable fact — whether `docs/CLAIMS.md`'s `kind`
  field admits a value that makes two recall figures incomparable *by
  construction*. One seat said (c) if it does and (b) if it does not; the other
  said (b) because (c) was underspecified until such a value is named. **The
  fact was then measured, not argued:** the enum in use is
  `{quant, qual, comparative}`, and none of the three makes two recall figures
  structurally incomparable — `comparative` is if anything an invitation to
  compare, and `qual` cannot license a number at all
  (`src/scripts/check_claims.ts:541`: "a `kind: qual` claim cannot license a
  number"). (c) is therefore unrealisable within the existing schema, and both
  seats' own stated fallback is (b). Adding a fourth enum value was not pursued:
  the question was framed to both seats under the existing-schema constraint, and
  widening it afterwards to reach the answer the roadmap preferred would be
  verdict shopping.
- **Consequence for the steps:** 2.2's claims-entry half and AC-6 are re-scoped
  accordingly — the new figure lives in the report, and the 2026-07-28 entry
  gains a pointer to it plus an explicit superseded-build note, so the record
  still shows a question answered twice without putting two subtractable numbers
  on the published claim surface.
- **Blocks:** step 2.2's claims entry only. The report itself lands either way.
- **What to do:** pick exactly one — (a) publish it as a `backed` claim with
  the incomparability stated in the claim text: the record shows the question
  was answered twice, and a reader who skips the condition reads a delta that
  does not exist; (b) publish the report but make **no** claims entry, leaving
  the 2026-07-28 claim as the only published number with its `measured_on:`
  scope: no false delta is possible, and the tree keeps publishing a figure
  about a deleted build as its only verdict; (c) publish as a claim of a
  distinct kind that cannot be compared to the first by construction.
- **Resolved when:** the choice is recorded and 2.2's verify asserts it.
- **Recommendation:** (c). The failure mode both other options trade against is
  a reader computing a delta between two incomparable runs; making them
  different kinds removes the arithmetic rather than warning against it.
- **If you do nothing:** the fresh number lands in `internal/` where the
  published surface never sees it, and the stale claim stays the only answer.

### blocker: is-the-original-rerun-irrecoverable

- **Status:** resolved
- **Owner:** maintainer
- **Resolution:** **yes — determined irrecoverable, and that determination is
  the ONLY authority under which the transferred stub closes.** AI council
  2026-08-28, members anthropic + openai, 1 round, $0.00. The two seats split on
  whether probe evidence alone suffices — one held that the stub's own wording
  ("access lapsed") already covers private third-party corpora, the other that
  irrecoverability is "a governance judgment about future access, not a
  filesystem fact a probe can prove" and must therefore be asserted explicitly.
  That split is resolved by *making the assertion* rather than by inferring it:
  the determination is recorded in step 4.1 in the terms the second seat asked
  for, on top of the probe readings and not in place of them. Both seats
  converged without qualification on the two things that actually bind: the
  substitute benchmark carries **zero closure credit**, and the outcome line
  must read **closed unmet**.
- **Blocks:** Phase 4 only. Phases 0-3 are independent of it in both directions.
- **What to do:** re-run the stub's probe, record every reading with its date,
  then write the determination as an explicit statement that the project has no
  present or reasonably obtainable authorized access to the pinned inputs and
  will not pursue reacquisition — and retire the stub citing that determination
  alone.
- **Resolved when:** the determination is recorded with its probe readings, and
  the stub's outcome line names irrecoverability as the closure authority rather
  than the benchmark.
- **If you do nothing:** either the stub stays open forever against inputs that
  will never arrive, or it is closed on the substitute benchmark — which is the
  laundering two prior councils and this one all refused.


### blocker: what-to-do-with-a-class-that-measured-nothing

- **Status:** resolved
- **Owner:** maintainer
- **Discovered during the run, not before it.** The pinned corpus encodes the
  three `path-between` questions with a TWO-ENDPOINT probe (`"cmdBuild ->
  getParser"`), and the registered runner gives both arms a single probe token.
  Neither arm can match a token containing ` -> `, so all three questions
  returned the empty set from **both** arms. The inconsistency existed at
  registration time; finding it required running the benchmark. It was found
  independently by the corpus's own author, who restored the file to its
  registered bytes rather than editing a corpus that had already been pinned and
  run.
- **Resolution:** **(a) publish v1 as-is with the class relabelled VOID —
  INSTRUMENT FAILURE, and record the fix as a v2 registration.** AI council
  2026-08-28 (anthropic + openai, 1 round, $0.00), 2/2 convergent. Option (c) —
  repair just that class and re-run it under the existing registration — was
  refused by both seats as changing the method after seeing the outcome, which
  is the single thing a pre-registration exists to prevent. One seat added the
  refinement that is implemented: publish **both** the mechanically computed
  registered verdict (`TIE`) **and** the validity assessment (`VOID`), never
  silently replacing one with the other, because relabelling after seeing a
  result is itself a post-hoc judgement and showing both is what makes it
  auditable.
- **Second decision, split and resolved by naming the claim.** On whether the
  failed negative-control floor is a finding or a category error, one seat said
  category error (a symbol index cannot find string literals; a floor a correct
  implementation cannot clear is a design flaw) and the other said a genuine
  finding, narrowly stated. The resolver both accept: it depends which claim is
  made. *"Graph retrieval replaces grep for repository investigation"* makes the
  controls valid; *"graph retrieval improves structural code questions"* — the
  only claim this benchmark makes — puts them outside the construct. Either way
  **the registered floor stays reported as FAILED**, because it was registered
  and cannot be discarded after the fact; what changes is the caveat printed
  beside it, and the v2 requirement to separate in-domain negative controls from
  capability-boundary tests.
- **Third decision, 2/2:** no overall engine verdict is derived from v1. The
  defensible statement is "zero classes met the pre-registered win criterion",
  never "grep proved superior". A v2 registration is a new confirmatory
  experiment, never a repaired continuation.
- **Blocks:** step 2.2's framing only. The run itself completed.
- **What to do:** relabel the class VOID in the runner's own output, print the
  registered verdict beside the validity assessment, print the construct caveat
  beside the control floor, withhold the overall verdict, and open a v2
  registration stub carrying the corrected corpus as an unregistered seed.
- **Resolved when:** the published report carries both columns, names the void
  class and its cause, and withholds an overall engine verdict; and the v2 stub
  exists.
- **If you do nothing:** the report publishes `TIE` for a class where both arms
  measured nothing, which is a fabricated result — the exact defect this
  roadmap's own Risk 1 exists to prevent, in the opposite direction.


## Acceptance Criteria

- [ ] AC-1 — `b-bench-inputs-absent` carries a recorded disposition and is no
      longer open.
- [ ] AC-2 — The pre-registration commit precedes the first result commit,
      checkable from history rather than asserted.
- [ ] AC-3 — Every corpus item resolves inside this repository or to a
      committed fixture; none references an external clone or a consumer
      identity.
- [ ] AC-4 — The published report names the commit it measured and that commit
      postdates 2026-08-22, asserted mechanically.
- [ ] AC-5 — The result is published whichever way it lands, and the report
      states the pre-registered bar beside it.
- [ ] AC-6 — Both figures are present in the tree and each names the build it
      measured; neither replaces the other. **Re-scoped by the
      `whether-a-non-comparable-number-is-worth-publishing` resolution:** the new
      figure lives in the report rather than in a second claims entry, and the
      2026-07-28 entry carries the pointer to it, so the published claim surface
      never holds two subtractable recall numbers.
- [ ] AC-7 — No setting default changed in this roadmap's diff, and no
      dependency moved between `devDependencies` and `dependencies`.
- [ ] AC-8 — The retired stub's outcome line names the **irrecoverability
      determination** as the closure authority, says the transferred criterion
      was **not** met and no re-run was performed, and disclaims any contribution
      of the in-repo benchmark to the closure.
- [ ] AC-9 — Phase 4's retirement text cites no benchmark figure as a reason for
      closure, and Phase 2 does not read Phase 4 — the two are independent in
      both directions, checkable from the diff.
- [ ] AC-10 — No class where both arms returned the empty set is published as a
      TIE. The registered verdict and the validity assessment are both printed,
      and no overall engine verdict is derived from a run with a void class.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new number is read as comparable to the old one | product | Two recall figures on the same subject invite a delta, and the delta would be meaningless across different corpora and question sets — a fabricated improvement or a fabricated regression, depending on which way it fell. | 1.3 puts the incomparability in the corpus file, 2.2 puts it in the claim, and the `whether-a-non-comparable-number-is-worth-publishing` blocker's recommendation removes the arithmetic by making the two different kinds. | Phase 1 — A corpus this repository contains |
| 2 | The corpus is built to make the graph win | implementation | The same run authors the questions and reports the result, which is the evaluator-independence failure in its cheapest form. | 0.2 commits the pre-registration before any result exists and AC-2 checks the ordering from history; 1.2 requires a quarter of the set to be negative control where grep is expected to win. | Phase 0 — Resolve the blocker that made the re-run impossible |
| 3 | The measurement is treated as authorising the flip | product | An improved number reads like permission, and the setting is one line away; ADR-246 and the dependency weight would both be stepped over silently. | AC-7 makes "no default changed" a property of the diff, 3.1 states routing-never-permission, and 3.4 is deferred by construction so the reopen is a separate change under the revisit gate. | Phase 3 — What the result is allowed to change |
| 4 | An honest null is read as wasted work | product | The most likely outcome is that the repaired engine still loses, and a run that confirms a default can look like a run that achieved nothing — which is how a re-measurement gets skipped the next time. | 2.2 states in the step itself that publishing a worse result is a complete success of this roadmap, and the Goal is written as "the number describes the engine that ships", not as "the graph wins". | Phase 2 — Measure, and publish whichever way it lands |
| 5 | Retiring the stub launders a substitution into a completion | implementation | The stub's criterion needed external clones; this roadmap answers a different, smaller question, and a routine archive line would erase that distinction. | 4.1 requires the outcome line to name the substitution, and AC-8 asserts it; the stub's own "archived must never read as achieved" wording is quoted rather than paraphrased. | Phase 4 — Close the transferred stub honestly |

## What this roadmap will NOT build

- **A code-graph engine.** One ships, complete, with a CLI and two consumers.
  Anything built here would be a second one.
- **A setting flip.** ADR-246 decides the default and the dependency weight.
  This roadmap produces evidence for a reopen; it does not perform one.
- **A dependency promotion.** Moving the parser pair into `dependencies` is
  the alternative ADR-246 explicitly rejected, and re-imposes weight on every
  consumer of the package.
- **A benchmark against external repositories.** The inputs are unreachable
  here, and a corpus carrying consumer-repository identity is refused
  independently of whether it could be obtained.
- **An LSP or external-provider adapter.** Both are resident-process classes,
  behind ADR-124 § 5 and the flip's Phase-1 ADR, and neither is needed to
  answer the question this roadmap asks.
