<!-- evidence-type: analysis -->

# Gate-class sweep — how much of the blocker estate is a couriered command?

Produced by `road-to-gate-autonomy` step 1.2. Measured against `origin/main`
@ `86cdbf652`, 2026-08-17.

## 1. Pre-registration — written before a single blocker was classified

`road-to-gate-autonomy` § 0 asserts that the estate's blockers "are not
decisions. They are commands and agent runs waiting for a human to type them."
Step 1.2 exists to falsify that, and its risk register (item 6) names the
failure mode directly: *a sweep that sets its own expectation after looking at
the blockers proves nothing about the premise it claims to test.*

So the bar is fixed here, before the classification table below exists:

> **Pre-registered expectation: at least 40 % of open blockers classify as
> class 0 or class 1** — deterministic-and-free, or billable-but-reversible.
> Both are gates whose human ingredient is a keystroke or a spend consent, not
> a judgement.

**Falsification consequence, also pre-registered.** Below 40 %, the
"gates are mostly couriered commands" framing is published as weaker than it
felt, Phase 2 ships as a thin convenience over the class-0 path only, and the
drawdown campaign leans on the consolidated decision sheet instead. This is
the roadmap's own honest-null clause; it is restated here so the outcome
cannot be renegotiated after the numbers land.

**Disclosure, because it bears on how much the pre-registration is worth.**
The author had prior partial exposure to this estate: selecting this roadmap
required a feasibility screen that read blocker text across ten candidate
roadmaps, roughly a quarter of the population classified below. The 40 % bar
is therefore *not* blind. It is stated in advance and against a named
consequence, which is the part that can be checked; calling it blind would be
the forgery this section exists to prevent.

**Why 40 % and not a rounder number.** "A substantial share" has to become a
number to be falsifiable at all, and the number has to be one the premise
would actually fail. The roadmap's own three worked examples (§ 0) are one
class-1, one class-2 and one class-0 — a third each. A bar at 33 % would be
met by the examples alone and would test nothing; a bar at 50 % would demand
the estate be *majority* couriered, which the roadmap never claims. 40 % sits
above the illustrative third and below the majority claim.

## 2. Population

Every **open** blocker in `agents/roadmaps/*.md`, as enumerated by
`agent-config gates --json --all`. Resolved entries are history and are out of
scope; `later/`, `archive/` and `skipped/` are not active estate.

The tooling reported **50** when the sweep ran and reports **49** now. The
difference is a parser defect the sweep itself surfaced and this branch fixed
(§ 4b): one entry resolved two days earlier was being counted open. The table
below keeps all 50 rows because that is what was classified; the shares in § 4
are computed over the corrected 49, and the excluded row is marked.

## 3. Classification table

50 open blockers, every one classified. `run-or-decision` is the command an
agent would run (classes 0 and 1) or the one-line decision (classes 2 and 3).

| # | id | roadmap | class | run-or-decision | why that class |
|---:|---|---|:-:|---|---|
| 1 | skill-activation-window | cost-parity-1-rule-payload-diet | 1 | `skill_trigger_eval --skill <pilot>` (derived) | billable eval is the only missing input — spend consent, not judgement |
| 2 | utilization-sweep-window | cost-parity-1-rule-payload-diet | 0 | a date check against the sibling sweep window | pure time-window probe; the output is the unblock |
| 3 | autonomy-defaults-sheet | user-out-of-the-loop | 2 | confirm or override four preference defaults | reversible settings already carrying a rendered recommendation |
| 4 | kernel-soak-window | user-out-of-the-loop | 3 | authorize the `ask-when-uncertain` kernel delta plus its soak | Hard Floor: a kernel edit and a soak the agent cannot self-authorize |
| 5 | dpo-signoff | org-telemetry | 3 | data-protection review of the Class-A field list | an external authority's written signoff |
| 6 | sink-choice | org-telemetry | 2 | pick the private repo or a named ingest endpoint | reversible infrastructure preference with a recommendation |
| 7 | compaction-census-session | context-fidelity | 3 | run an instrumented session with a manual compaction | a human keystroke inside a live session |
| 8 | memory-sweep-instrument | context-fidelity | 2 | scope the contradiction sweep in or out of Phase 2 | reversible scope preference |
| 9 | prominence-gate-skills-corpus | context-fidelity | 2 | extend with a baseline, or leave the skills tree unscanned | risk call over 13 findings, recommendation-ready |
| 10 | b-per-turn-composite-bar | per-turn-hook-economy | 2 | register observe-only, name a p50 ceiling, or decline | a pre-registration judgement; no number exists to compute it from |
| 11 | phase-0-spikes-need-a-live-host-session | skill-ecosystem-executable-payloads | 3 | run S0.1/S0.2 in a live host session | the eval hard-aborts under automation; the session is what is missing |
| 12 | legacy (blocked-until) | gated-reach-followup | 3 | install `yt-dlp` and a JS runtime by hand | a human install on a specific machine; auto-install is a contract violation |
| 13 | measurement-a-no-per-arm-builder-tier | ui-track-integrity-followup | 2 | hold Measurement A rather than build a forbidden runner | scope call; the missing thing is a runner nobody committed to build |
| 14 | measurement-b-no-renderable-lane-pair | ui-track-integrity-followup | 2 | hold Measurement B; prefer the generic-lane override if exited | bounded scope preference with a rejected alternative |
| 15 | enforcement-evidence | frontend-skill-application | 2 | flip to enforcement, or record an explicit no-change | reversible enforcement risk call on published rates |
| 16 | ui-corpus-has-no-ui | frontend-skill-application | 0 | re-run the consultation-rate report against a store with UI writes | deterministic local re-run; the report is the unblock |
| 17 | ui-session-capture-window | frontend-skill-application | 0 | capture one more observation, then count the log | a per-session capture plus a count, both agent-runnable |
| 18 | raw-capture-needs-host-env | subagent-lifecycle-integrity | 3 | a user-global self-config edit plus a fresh session | `security-sensitive-stop` forbids the agent making that edit |
| 19 | b-rules-efficiency-signal | standing-context-40k | 0 | read the dispatch-economy report | a telemetry sample-size read; either it resolves the fork or it re-dates the window |
| 20 | b-live-trigger-eval | catalogue-host-fit | 1 | `skill_trigger_eval --skill <skill>` (derived) | the entry itself names a terminal confirmation and token spend as the only human parts |
| 21 | bench-spend-and-methodology | rule-coherence-followup | 3 | authorize the A/B with human judges at adequate N, or cancel | the council ruled an LLM judge has no power here — people, not spend |
| 22 | default-flip-release-gate | rule-coherence-followup | 2 | ship the measured config as default, or keep opt-in | named consent-once; the merge itself stays a separate Hard Floor act |
| 23 | real-orchestration-usage | orchestration-scope-decision | 3 | use the agent on real parallel work until the quality columns fill | only the user's own live work fills them; no command synthesizes usage |
| 24 | phase3-harness-deltas-9-10 | solution-minimalism | 1 | the paid A/B sweep under the recorded $250 ceiling | spend consent already recorded; the remainder is harness build work |
| 25 | b-detector-demotion-bars | stop-gate-honesty | 2 | per-detector bars, one shared bar, or no demotion | reversible pre-registration call with a stated recommendation |
| 26 | telemetry-sample-size | subagent-value-realization-followup | 0 | count the orchestration audit log | a free deterministic count; the condition is already met at 368 lines |
| 27 | b-consolidated-decision-sheet | estate-drawdown | 2 | answer the two largest-unblock items, defer the rest | reversible preference already rendered with a default |
| 28 | b-delegate-gate-maintainer-profile | **gate-autonomy** | 2 | enable the team surface and `allow_delegate` in one profile | reversible one-profile setting, not a shipped default |
| 29 | b-gate-budget-preauth | **gate-autonomy** | 2 | per-run and per-week caps with a receipt ledger | the missing thing is the shape of the spend bound, not a spend |
| 30 | human-gated-live-trigger-eval | skill-description-measurement | 1 | `task test-triggers-live -- <skill>` (derived) | billable tokens plus a terminal confirmation — the class-1 exemplar |
| 31 | kernel-cross-link-soak | skill-ecosystem-gate-integrity | 3 | two `verify-before-complete` edits in their own PR | a kernel edit behind a blocking PreToolUse guard |
| 32 | b-convergence-machine | carrier-layer-convergence | 3 | a before/after reading on the maintainer install | the two-layer topology is a property of one machine |
| 33 | maintainer-blind-ratings | council-blind-review | 3 | the maintainer rates the blind packet | an AI rater is the bias being measured |
| 34 | first-contract-true-analysis-run | distillation-followups | 2 | authorize one run and confirm the evidence stays local-only | spend consent alone would not settle the confidentiality half |
| 35 | router-head-retrofit-instrument | distillation-followups | 2 | accept the published cap as justification, or build an instrument | no load-observing instrument exists to run |
| 36 | deferred-finding-decision-reopen | inbox-harvest-residuals | 2 | cancel against the recorded decline, reopening on the trigger | a `decision-revisit-gate` call with a written recommendation |
| 37 | spent-inbox-artifacts-await-deletion | inbox-harvest-residuals | 2 | record a keep-reason and close | the deletion branch needs two filenames unrecoverable from the text |
| 38 | b-behavioural-bench-spend | mixed-trigger-activation-cost | 1 | the paired A/B under a named per-run budget | the entry itself defers the consent to the class-1 ledger |
| 39 | b-matrix-semantics-amendment | mixed-trigger-activation-cost | 2 | adopt the amendment narrowed to two rules | **already decided** — see § 4b; it is in this table only because the tooling still counts it open |
| 40 | manual-rubric-rater | scale-history-bench-run | 3 | a human scores each artifact blind to arm | an agent rating agent output is what `evaluator-independence` forbids |
| 41 | cross-vendor-worker-slices | always-on-orchestration | 2 | settle the cross-vendor direction policy | an egress/risk preference that must precede any code |
| 42 | f4-full-stop-block | always-on-orchestration | 2 | block versus advisory for the end-review stop hook | changes every session's stop behaviour — a risk call |
| 43 | gate-council-auto-dispatch | always-on-orchestration | 2 | auto-fire the council at the release gate, or stay recommend-only | reversible risk-and-cost call on an unaccumulated window |
| 44 | point-of-action-carrier | always-on-orchestration | 2 | build or do not build the mid-session delegation carrier | the spike is runnable; the resolution is a build decision |
| 45 | team-telemetry-behind-flag | always-on-orchestration | 0 | probe the experimental host flag | a liveness probe whose output is the unblock |
| 46 | merge-queue-enablement | inbox-harvest-2026-08-b-ci-economy | 3 | enable Require merge queue on the ruleset | a repo-settings click, and it changes every future merge |
| 47 | required-check-set-change | inbox-harvest-2026-08-b-ci-economy | 3 | write the required-check list on the ruleset | repo-admin write changing merge requirements estate-wide |
| 48 | evidence-compaction-approval | inbox-harvest-2026-08-c-evidence-lifecycle | 3 | no compaction, or compact at a named tier boundary | a bulk deletion of committed evidence — class 3 by construction |
| 49 | benchmark-spend | surface-consolidation | 1 | the lazy-catalog A/B under a named budget | a per-run cap and resume-not-re-spend already ship; a budget is the only gap |
| 50 | repo-admin-and-usage | surface-consolidation | 3 | apply branch protection; hold every utilization removal | a settings UI action plus irreversible removal with no usage data |

## 4. Result — the pre-registration is FALSIFIED

Over the corrected population of 49 (row 39 excluded — already decided):

| class | count | share |
|---|---:|---:|
| 0 — auto-run | 6 | 12.2 % |
| 1 — budget-preauthorized | 6 | 12.2 % |
| **0 + 1 (the premise)** | **12** | **24.5 %** |
| 2 — consent-once | 21 | 42.9 % |
| 3 — human-only | 16 | 32.7 % |
| total | 49 | 100 % |

**24.5 % against a pre-registered bar of 40 %.** The roadmap's § 0 framing —
"they are commands and agent runs waiting for a human to type them" — does not
survive its own test. The estate is **decision-heavy, not courier-heavy**: 37
of 49 blockers (75.5 %) need a judgement or a person, and the single largest
class is `2 — consent-once` at 42.9 %.

The verdict does not turn on the correction: over the uncorrected 50 the share
is 24.0 %, and both are far enough below 40 % that no rounding, and no single
reclassification, moves the outcome. Clearing the bar would take **eight** of
the twenty-one class-2 entries turning out to be class 0 or 1 — a third of the
largest class misread in the same direction.

Two things follow, both pre-registered rather than reasoned out afterwards:

1. **Phase 2 ships as a thin convenience.** `gates --execute` is worth having
   for the six class-0 entries and for the render-instead-of-run path, and it
   is not the lever that drains the estate. It is built to that size.
2. **The consolidated decision sheet carries the weight instead.** 21 of the
   49 blockers are one line and one yes away from resolved, and they are
   already recommendation-ready. That is `road-to-estate-drawdown`'s Phase 0
   and `road-to-user-out-of-the-loop`'s Phase 1 — neither is this roadmap.

**What the number does NOT say.** It does not say the couriering framing was
worthless: 12 gates really are commands waiting for a keystroke, and one of
them (`telemetry-sample-size`) is a count whose condition is *already met*.
It says the framing described a minority and was written as if it described
the estate.

### 4b. Two defects found while sweeping — one fixed, one recorded

- **A resolved blocker was counted as open. FIXED on this branch.**
  `b-matrix-semantics-amendment` carries
  `**Status:** RESOLVED 2026-08-17 — **option (b)**, …`. `RoadmapStats` split
  open from resolved with `b.status !== 'resolved'`, an **equality** test on a
  field authors write prose into, so a status carrying its own date and
  rationale matched neither branch and fell through to open. It inflated every
  blocker count in the dashboard by one and rendered a two-day-old decision in
  `agent-config gates` as one the reader still owed an answer to.
  `lint_roadmap_blockers` had always read the same field as a **prefix**
  (`/^…resolved/i`), so the two surfaces disagreed about what resolved means —
  the lint exempted the entry from its ratchet while the dashboard counted it.
  `blocker_is_resolved` is now the one prefix test both semantics come from.
  **Sibling search:** the exact construct is an equality comparison against
  `'resolved'` on a parsed prose field — 2 sites, both in
  `update_roadmap_progress.ts`, both fixed. One lexical near-match remains
  (`rule_backlinks.ts:194`) and is NOT the defect: its `status` is a
  discriminated-union tag the code itself constructs, not parsed text.
  What is **not** fixed: the entry's own `What to do:` / `Recommendation:`
  fields still read in the future tense as though undecided. That is prose in
  another roadmap's file, which this worktree's scope lock does not own.
- **The decidability ratchet is red on a pristine tree. NOT fixed.** 28
  violations against a baseline of 26. Measured before this branch touched any
  roadmap, so it is not this work; every one of the 28 is in another roadmap's
  blocker section. `lint_roadmap_blockers` is registered only under `task ci`
  and in no workflow, so nothing on a PR reports it either way.

### 4c. Materialisation — added 2026-08-17 by step 1.3, and it falsifies § 4 again

Writing § 3's verdicts back into the entries themselves is what step 1.3 does,
and doing it surfaced a **second falsification, of this document's own
conclusion 1**. It is recorded here rather than in the roadmap because it is a
result about this measurement, not about that plan.

**What landed.** Step 1.3 wrote **34** entries; the tree now carries **36**
authored `Class:` fields, because `road-to-gate-autonomy`'s own two already
had one. So of the 49 open blockers, 36 declare a class and **13** resolve
through the absent-field default — the 12 below plus the synthesised `legacy`
note. (The first version of this paragraph said 34 and 15, conflating what the
step wrote with what the tree holds; corrected by R2 finding 3, and the 12/13
split is load-bearing for the conclusion two paragraphs down.)

Every value comes from the § 3 row for that id — the id sets matched exactly
(49 live against 50 rows, the difference being row 39, resolved since, and row
12's `legacy (blocked-until)` normalising to the parser's `legacy`), so no
class was inferred and none was invented. The population was joined
mechanically: ids from `agent-config gates --json --all`, classes from the
table above.

**What did not, and why it matters more than what did.** The **12 class-0 and
class-1 entries were left unwritten**, because `Class: 0` or `Class: 1` without
a `Run:` field is a HARD `lint_roadmap_blockers` failure by design — a gate
that claims to be runnable must name the command. Every one of the twelve was
read in full to find that command. **None of them can carry an honest one:**

| what was found | count | entries |
|---|---:|---|
| names no command at all | 8 | `utilization-sweep-window`, `b-rules-efficiency-signal`, `skill-activation-window`, `b-live-trigger-eval`, `phase3-harness-deltas-9-10`, `human-gated-live-trigger-eval`, `b-behavioural-bench-spend`, plus `ui-corpus-has-no-ui`'s primary command, which carries an unfilled `<placeholder>` |
| names a progress *read* that cannot clear the gate | 2 | `ui-session-capture-window`, `telemetry-sample-size` — both `wc -l`; a green result would read as progress the gate does not make |
| names a probe that exits non-zero in its expected state | 1 | `team-telemetry-behind-flag` — `env \| grep -i EXPERIMENTAL`, which `--execute` would record as a command failure |
| names a real runner whose documented cap does not apply | 1 | `benchmark-spend` — see the defect below |

**So the honest auto-runnable share of the estate is 0 of 49, not 12.** § 3
assigned the class from *what would clear the gate in principle*; the field
requires *what the entry can actually run*. Those are different questions, and
the first one flatters the second. Conclusion 1 above — "`gates --execute` is
worth having for the six class-0 entries" — does not survive: **none of the six
is executable as authored.** The class-0 path shipped in Phase 2 has zero live
targets today, and this table is why.

This is not a reason to rewrite § 3. The classification is a legitimate reading
of clearability and it is what step 1.2 asked for; what it is not is a
materialisable field, and that only became visible when someone tried to write
it. The twelve therefore resolve to the absent-field default — class 3 — which
is the safe direction and is what every consumer already applies.

**Reclassifying them in the tree is NOT done here.** Twelve verdicts across
eight roadmaps this branch does not own is a judgement on other people's plans,
not a field write-back; it is surfaced as a decision instead.

**And conclusion 2 needs the same qualification, measured the same way.** With
the classes live, `gates --execute` was run against each of the 19 class-2
entries this step made reachable. All 19 render a consent block — the path
works. But **11 of the 19 trip the renderer's own overflow notice**: their
`Recommendation:` exceeds `PARAGRAPH_CHARS = 156`
(`src/agent-src/scripts/gate_execute.ts:157,174`), and that notice says what to
do about it — *"a class-2 gate that cannot state a one-line question and a
default is reclassified to 3, not verbosified."*

**The first version of this passage then drew the wrong conclusion from that
count, and the correction is the more useful result.** It said the entries that
*pass* the bar are "exactly what § 4 claimed" — one line and one yes from
resolved. They are not. Passing `rec.length > PARAGRAPH_CHARS` is trivially true
at length **zero**, and measured over the live tree that is what every passer is:
of the 26 class-2 entries at HEAD, **16 exceed the bar and the other 10 carry no
`Recommendation:` at all — not one has a usable 1–156-char recommendation.**
Those ten render `Recommendation: (none recorded — ask for one before deciding)`
(`gate_execute.ts:143`), and `lint_roadmap_blockers` independently flags all ten
for the missing field.

So the honest reading is stronger than the one it replaces: **no class-2 gate in
the estate is one line and one yes away from resolved.** § 4's "21 of the 49
blockers are one line and one yes away" is not off by a few — it describes zero
entries. Sixteen are paragraphs a reader still has to weigh and ten have nothing
to weigh at all, which is the same reading-load defect § 0 set out to remove,
surviving inside the class that was supposed to absorb it. Caught by R2 finding 3.

Two honest bounds. The notice is **advisory** — it renders alongside a working
consent block, so nothing is broken today, and the 156 is the renderer's
threshold rather than an independently derived one. And neither the sixteen nor
the ten are a defect this branch introduced: the prose, and its absence, predate
it. What the write-back changed is that both are now *observable*, because before
it no class-2 entry was reachable at all.

- **A documented spend cap is silently dropped. FOUND, NOT fixed.**
  `benchmark-spend` authorises `task bench:ab:live -- --budget <N>` and states
  the command "caps per-task spend". It does not: `taskfiles/bench-ab.yml:98-101`
  invokes `bench_ab_task_runner --variant both --mode live` with **no
  `{{.CLI_ARGS}}`**, unlike its sibling at `:28`, so the trailing `--budget <N>`
  never reaches the runner and the run falls back to the parser default of
  `2.0` (`src/scripts/bench_ab_task_runner.ts:911`). An operator who names a cap
  gets a different one, silently, on a cost-bearing path. The fix is one
  interpolation; it is outside this branch's module and changes what a paid
  runner does, so it is surfaced as a decision rather than taken.
  **Decided 2026-08-17 and fixed — see § 4d.**

### 4d. The three findings, decided — added 2026-08-17

§ 4c surfaced three things as decisions rather than taking them. All three were
put to the maintainer and answered on the same day; recorded here because a
decision that lives only in a chat turn is the shape § 4c itself complained
about.

**(a) The dropped spend cap — FIXED, in its own change, and in this tree since
`ad23aab7e`.** This paragraph has been wrong in both directions on the same day,
and both corrections are kept because the pair is the lesson.

*First* it read "FIXED, in its own change" while the fix sat on a sibling branch
outside this ancestry — asserting tree state that was false, with the blocker
closed partly on that basis. R2 finding 1 (critical) caught it, and the severity
was right.

*Then* the correction outlived its own accuracy: PR #1406 merged to `main`, `main`
merged into this branch, and the sentence "the money-safety defect is live in the
reviewed tree" became false the other way round. Verified at HEAD:
`taskfiles/bench-ab.yml` and `taskfiles/value.yml` both forward `{{.CLI_ARGS}}`,
and `tests/scripts/bench_ab_taskfile.test.ts` is present.

**The transferable point is not "check before claiming" but that a claim about
tree state has a shelf life.** Written once, it was wrong immediately; corrected
once, it was wrong again within the hour, because the tree moved underneath it.
Prefer naming the commit that makes a statement true — as the heading now does —
over a relative phrase like "until that PR merges", which silently expires.

The sibling search on the exact construct — a cost-bearing
`bench_ab_task_runner` invocation with no `{{.CLI_ARGS}}` — found **3** sites, of
which only `bench:ab:live` carried the false claim; `bench:ab:value` and
`value:behaviour` claimed nothing but could not be bounded by an operator either.
All three forward, which is inert when no trailing args are given, with both
directions proven per target by `task --dry -v`, and a guard that reads the real
taskfiles and was verified red before the fix. The widening past the one target
that lied was deliberate: the passthrough changes nothing without trailing args,
and repairing one of three sites of a construct is the fixed-one-instance failure.

**(b) The twelve class-0/1 entries — RECLASSIFIED to what their text supports.**
Not a blanket downgrade: five of the twelve are genuine consent calls and only
seven are human-only. The split matters, because a blanket 3 would have buried
five gates the maintainer can answer in one line.

| id | roadmap | was | now | why the new class |
|---|---|:-:|:-:|---|
| `ui-corpus-has-no-ui` | frontend-skill-application | 0 | **2** | a human names the consumer store, then the report re-runs |
| `b-rules-efficiency-signal` | standing-context-40k | 0 | **2** | wait for the observer, or record the window unfilled and re-date |
| `phase3-harness-deltas-9-10` | solution-minimalism | 1 | **2** | spend consent, once deltas 9 and 10 land as code |
| `b-behavioural-bench-spend` | mixed-trigger-activation-cost | 1 | **2** | name a budget at the entry, or re-date the step |
| `benchmark-spend` | surface-consolidation | 1 | **2** | authorise the A/B with an estimate |
| `utilization-sweep-window` | cost-parity-1-rule-payload-diet | 0 | **3** | time- and dependency-gated; no command and no decision |
| `skill-activation-window` | cost-parity-1-rule-payload-diet | 1 | **3** | a pointer to a class-3 entry under another name |
| `ui-session-capture-window` | frontend-skill-application | 0 | **3** | needs human-authored observation files that do not exist |
| `telemetry-sample-size` | subagent-value-realization-followup | 0 | **3** | only real parallel work fills the columns |
| `team-telemetry-behind-flag` | always-on-orchestration | 0 | **3** | a host flag that does not clear by waiting on this host |
| `b-live-trigger-eval` | catalogue-host-fit | 1 | **3** | a controlling-terminal confirmation; cannot run non-interactively |
| `human-gated-live-trigger-eval` | skill-description-measurement | 1 | **3** | hard-aborts under automation by design |

Measured effect, at three points so no reading is mistaken for another:
`gates --json --all` was `{2: 22, 3: 28}` before, `{2: 27, 3: 23}` immediately
after the reclassification over 50 records, and `{2: 26, 3: 23}` at HEAD over 49
— the difference being `b-estate-prose-pass-from-1-3` resolving itself out of the
population once all three decisions landed. **Five gates that rendered "nothing to
execute" now render an answerable consent block** — verified per entry, not
inferred. Of the 49 open records, **48 carry an authored field and exactly 1
resolves through the absent-field default**: the parser's synthesised `legacy`
note, which by construction can never carry one.

**The class-0 count stays 0, and that is the honest headline.** Nothing here
makes a gate auto-runnable, because nothing here invents a command. What changed
is that the tree no longer declares a class its own entries cannot support.

**One taxonomy gap, recorded rather than forced.** `utilization-sweep-window`
clears when a date passes and a sibling blocker clears — it is neither a command,
nor a spend, nor a preference, nor human content. None of the four classes fits;
it takes 3 because that is the safe default, and the label overstates the human's
role. A fifth class for time- and dependency-gated waits would describe it
properly. Not proposed here — one entry is not a population.

**(c) The class-2 recommendation prose — ACCEPTED as advisory.**
The notice renders alongside a working consent block, the prose predates this
work, and rewriting other roadmaps' recommendations is the most expensive of the
three for the least behavioural gain. It stays visible every time one of those
gates is executed, which is the right place for it.

**Re-measured after (b), not carried over**, because promoting five entries adds
their recommendations to the population the bar applies to. Over the **26** live
class-2 entries at HEAD: **16 exceed the 156-char bar, 10 carry no
`Recommendation:` at all, and 0 carry a usable 1–156-char one.** Measured by
reading the field out of each entry, not by reading the renderer's pass/fail —
which is the distinction the first version of this section missed, since the
renderer's check passes trivially at length zero.

Three earlier figures in this document are superseded and named so nobody reads a
change of denominator as a change over time: *8 of 19* covered only the entries
step 1.3 had made reachable and excluded `road-to-gate-autonomy`'s own three;
*10 of 27* counted `b-estate-prose-pass-from-1-3` before it resolved itself out
of the population; and a *13* in § 4c was arithmetic (`21 − 8`) over § 4's
differently-scoped claim rather than a measurement, so two of those thirteen had
never been measured against the bar at all. The live reading is the 26/16/10/0
above. R2 findings 3, 4 and 5.

**Including this branch's own new entry, which is over the bar.** Worth recording
rather than quietly excluding: `b-estate-prose-pass-from-1-3` was authored *by*
the work that measures this, *after* reading the notice, and still exceeded it.
The bar is easy to trip while knowing about it, which is a better argument for
the notice staying visible than any of the eleven older cases. It becomes moot on
resolution — a resolved blocker no longer renders — so the count above is the
live reading at the moment of measurement, not a durable 17.
