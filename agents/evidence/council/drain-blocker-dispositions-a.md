# Council decisions — autonomous drain run, blocker dispositions (batch A)

<!-- evidence-type: analysis -->

Session: 2026-08-20. Members: anthropic (claude-sonnet-4-5), openai (codex-default).
Quorum 2/2. Rounds: one framework round (3-round debate) + one disposition round.

## Why this file exists

The maintainer delegated every user-reserved decision on the 44 open roadmap
blockers to the council for this run, with no user round-trip. This file is the
record those dispositions cite. It is the resolving mechanism named in each
`## Blockers` entry that closes on a council decision.

## Framework adopted in round 1 (both seats convergent)

1. A fifth disposition `E — ABANDON` exists, for work that is a declared
   Non-goal or depends on a capability nobody is building. Round 1's hardest
   finding: without it, permanently-infeasible work is forced into stubs that
   become parking lots while completion percentages report success.
2. Every closure records one of four outcome states — `satisfied`, `narrowed`,
   `transferred`, `abandoned`. "Archived at 100 %" without one of these is the
   dishonest-100 % case.
3. Rule 3 is categorical: repository creation, a legal signature, a
   shipped-default flip, a repo-admin setting, a host-env modification, or any
   externally visible / irreversible action takes `B`, never `D`. The council
   may record its preferred choice inside the stub; the parent may not record
   the action as done.
4. Measured null is not the same as cannot-measure. No instrument → `B`/`E`;
   instrument ran and answered zero → `C`; instrument broken → `B`.
5. Duplicate-evidence blockers merge into one disposition and one stub.
6. Every `B` carries the three-point stub-integrity check: original criterion
   verbatim, complete list of dependent steps moved, and a named concrete
   re-entry producer with a detection probe — never "when some subsystem exists
   for its own reason", which names nobody.

## Dispositions — batch A

```
skill-activation-window | B | transferred | Create one live-trigger-eval stub shared with human-gated-live-trigger-eval.
utilization-sweep-window | B | transferred | Move the utilization-dependent census behind the scheduled surface-consolidation sweep.
autonomy-defaults-sheet | D | satisfied | Record phase-checkpoints, lane cap 2, halt, and both deferral exits.
kernel-soak-window | B | transferred | Transfer only ask-when-uncertain to soak; proceed with all three non-kernel deltas.
dpo-signoff | B | transferred | Transfer org enablement pending written internal data-protection approval.
sink-choice | B | transferred | Prefer a private repository, but transfer its creation and configuration.
compaction-census-session | B | transferred | Transfer the host-stamped manual compaction experiment and its dependent build decision.
prominence-gate-skills-corpus | D | narrowed | Leave skills unscanned and narrow Phase 3 to the gate’s existing surfaces.
legacy | B | transferred | Transfer execution until a human installs yt-dlp and the required JavaScript runtime.
measurement-a-no-per-arm-builder-tier | E | abandoned | Cancel Measurement A because its required generation subsystem is an explicit Non-goal.
measurement-b-no-renderable-lane-pair | E | abandoned | Cancel Measurement B because no qualifying lane pair or planned producer exists.
enforcement-evidence | C | satisfied | Record explicit no-change from the matching enforcement-projection null.
ui-corpus-has-no-ui | C | satisfied | Merge into enforcement-evidence; the measured absent UI population supports no-change.
ui-session-capture-window | C | satisfied | Merge into enforcement-evidence; retain the seven observations as mechanism evidence.
raw-capture-needs-host-env | B | transferred | Transfer the temporary host-environment capture procedure.
bench-spend-and-methodology | D | satisfied | Authorize a blinded paired human-judged A/B with 100 tasks and fixed thresholds.
default-flip-release-gate | B | transferred | Transfer the shipped-default decision and merge action to the maintainer release gate.
real-orchestration-usage | B | transferred | Create one task-completion observability stub shared with telemetry-sample-size.
phase3-harness-deltas-9-10 | A | narrowed | Reclassify deltas 9–10 as ordinary Phase 3 implementation, not a blocker.
telemetry-sample-size | B | transferred | Merge into the task-completion observability stub; stop accumulating unusable line counts.
b-rules-efficiency-signal | C | narrowed | Record the unfilled window and re-date the fork to 2026-09-17.
human-gated-live-trigger-eval | B | transferred | Merge into skill-activation-window’s single live-trigger-eval stub.
```

**skill-activation-window / human-gated-live-trigger-eval**  
**Rationale** — These are one evidence gap; the host-controlled, human-gated evaluation cannot be supplied from repository automation.  
**For B** — Original criteria: “the pilot tranche PR cites its activation baseline and the window it was measured over” and “a predictions JSON exists for the pre-rewrite and the post-rewrite tree state, produced by the same protocol.” Move Phase 1.1–1.2, Phase 1.3’s skill-usage column, and Phase 2’s trigger-accuracy bars.  
**For B** — Re-entry producer: maintainer running `rule_trigger_eval`; probe: both predictions JSON files exist, share protocol metadata, and cover ≥100 requests, ≥3 shapes, and the ≤20% degradation bar.

**utilization-sweep-window**  
**Rationale** — The census depends on a time-gated sweep carrying its own repo-admin dependency; duplicating the collector would create competing vocabularies.  
**For B** — Original criterion: “that sweep has run and its vocabulary is available to reuse.” Move all 49 Phase 1 census steps requiring real utilization. Re-entry producer: `road-to-surface-consolidation.md` Phase 3 owner; probe: dated sweep evidence exists and exports the reusable vocabulary.

**autonomy-defaults-sheet**  
**Rationale** — The council has authority to settle all four reversible policy choices.  
**For D** — Preselection `phase-checkpoints`; lane cap `2`; late-artifact default `halt`; deferred policy offers both a follow-up draft and explicit cancellation with a reasoning memo.

**kernel-soak-window**  
**Rationale** — Only `ask-when-uncertain` crosses the locked-kernel boundary; coupling the other deltas to its soak is unsupported.  
**For B** — Original criterion for the transferred arm: “the user authorizes or declines the `ask-when-uncertain` delta.” Move only batch elicitation and its own-PR soak. Re-entry producer: kernel-rule maintainer; probe: authorization is recorded and the full interval required by `kernel-rule-edits.md` completes without rollback criteria firing.  
The set-scoped autonomy form proceeds first, followed by late-artifact policy and deferred-policy delta; all three proceed independently now.

**dpo-signoff**  
**Rationale** — A legal/internal data-protection signature is categorically external and cannot be recorded as agent-completed.  
**For B** — Original criterion: “a written internal sign-off exists and is referenced from the ADR.” Move Phase 3 org-wide enablement and every downstream rollout step. Re-entry producer: named internal DPO reviewer; probe: the signed outcome covering the Class-A fields and disclosure line is linked from the ADR.

**sink-choice**  
**Rationale** — The preferred choice is a private repository, but creating it is an external action.  
**For B** — Original criterion: “the sink and its location are named, and the identifier exists in the org pack rather than in this repository.” Move Phase 2 sink stand-up and all 17 sink-dependent steps. Re-entry producer: org repository administrator; probe: a private, package-CI-inaccessible repository identifier resolves and appears in org-pack settings.

**compaction-census-session**  
**Rationale** — The experiment requires live host behavior, manual compaction, and an external session-state directory; repository work cannot manufacture those observations.  
**For B** — Original criterion: “a `context-fidelity-cf01.md` finding exists under `agents/evidence/eval-findings/` carrying a per-probe-class number and a host stamp, or the user records that the compaction-survival question is closed unmeasured and Phase 1 is cancelled.” Move Phase 0 cf01 and all Phase 1 steps dependent on its number.  
**For B** — Re-entry producer: context-fidelity maintainer using an instrumented host session; probe: the finding contains detectability, five-session results when measurable, per-probe values, host versions, and capture-directory status.

**prominence-gate-skills-corpus**  
**Rationale** — Extending the gate would introduce a new warning mode and reopen the reverted semantic conflict without evidence that the extra surface is needed.  
**For D** — Value: `leave-unscanned`. Preserve existing `deep_iron_law` and `preservation-guard` behavior; update Phase 3 to state explicitly that `src/skills` is outside this gate’s coverage.

**legacy**  
**Rationale** — Installing host tools modifies the host environment and is categorically external, but the outcome remains feasible after human installation.  
**For B** — Original criterion: “condition described above clears.” Move the entire roadmap. Re-entry producer: host owner; probe: `command -v yt-dlp` and the roadmap’s JavaScript-runtime version probe both succeed in the execution environment.

**measurement-a-no-per-arm-builder-tier**  
**Rationale** — A faithful run requires a consumer-shaped generation subsystem with validated per-skill tier dispatch, while building that subsystem is this roadmap’s declared Non-goal and nobody else is committed to it.  
**For E** — Abandon Measurement A and both A acceptance criteria; retain the pre-registration as historical documentation and remove them from completion accounting.

**measurement-b-no-renderable-lane-pair**  
**Rationale** — No lane pair meets the pre-registered conditions, and neither a host-renderable framework lane nor a supported override has a committed producer. Waiting “for its own reason” names nobody and would create a permanent parking lot.  
**For E** — Abandon Measurement B and both B acceptance criteria; preserve the dated pre-registration and council rejection of the Docker substitution as the cancellation rationale.

**enforcement-evidence / ui-corpus-has-no-ui / ui-session-capture-window**  
**Rationale** — Treat the enforcement-projection null as terminal because it matches this repository’s population and epoch: only 3 UI-write turns occurred across 107 sessions, while the catalogue corpus independently records host truncation and insufficient observation.  
**For C** — Record the enforcement-projection null, `3/107` UI-write population, and seven observations across two hosts; close Phase 5 with an explicit `no-change` decision, without aggregating `no-selector` and `insufficient-observation`.

**raw-capture-needs-host-env**  
**Rationale** — Injecting `AGENT_HOOK_CAPTURE_DIR` into host settings is a host-environment modification and the resulting verbatim capture is an egress risk.  
**For B** — Original criterion: “a raw `SubagentStop` payload and a raw in-subagent `PreToolUse` payload exist as captured files, and their field lists are recorded in `agents/evidence/investigations/subagent-lifecycle-phase0-return-channel.md`.” Move only Phase 0 Steps 2 and 4’s raw-payload halves.  
**For B** — Re-entry producer: host owner performing a fresh-session capture; probe: both payload classes exist, their field lists are recorded, and the settings entry is subsequently absent.

**bench-spend-and-methodology**  
**Rationale** — Spend is authorized, but the claim requires human judging comparable to the production measurement.  
**For D** — Run 100 paired tasks per arm, randomized and double-blind; use the same frozen task corpus and rubric, two independent human judges, adjudication on disagreement, ≥95% valid completions, no primary-quality regression greater than 5 percentage points, and a positive efficiency result whose 95% bootstrap confidence interval excludes zero.

**default-flip-release-gate**  
**Rationale** — Changing the shipped default and merging it are externally visible release actions, regardless of the preferred decision.  
**For B** — Original criterion: “the maintainer merges the flip with the census attached, or records a decision to keep the current default and ship the preset as opt-in.” Move only the default flip and its release-dependent steps; preferred choice: keep the current default and ship opt-in until the human benchmark passes.  
**For B** — Re-entry producer: release maintainer; probe: merged settings diff plus attached census, or a dated opt-in decision in the release record.

**real-orchestration-usage / telemetry-sample-size**  
**Rationale** — Line count is already satisfied and no longer diagnostic; the shared gap is whether a hook can observe task completion and populate quality fields.  
**For B** — Original criterion for both: “a probe result records whether any hook slot sees the task-completion payload, and — if one does — the current-month audit log carries ≥20 orchestration lines whose quality columns are populated rather than `null`.” Move Phase 1 telemetry seeding, Phase 2 evaluation, and Phase 3’s dependent decision.  
**For B** — Re-entry producer: subagent-observability maintainer running a named live-host task-completion probe; probe: the finding identifies the observable hook slot and ≥20 same-epoch rows contain non-null `first_pass_success`, `escalated`, and `task_class`.

**phase3-harness-deltas-9-10**  
**Rationale** — Deltas 9–10 are ordinary repository implementation, not an external or decision blocker.  
**For A** — Substitute criterion: “Implement `repo` and `sha` corpus keys, add approximately 30 hand-written capability/discipline oracles, pin at least one task to a repository SHA, run the full tier, and publish its report.” Remove the blocker entry and schedule this work directly in Phase 3.

**b-rules-efficiency-signal**  
**Rationale** — The registered instrument has returned an unfilled window; that measured absence is an allowed terminal result for this checkpoint.  
**For C** — Record the current `rules_efficiency` window as unfilled, preserve Step 3.0’s observer, and re-date the fork to `2026-09-17`; do not start the retriever before the registered lexical-index comparison.

Summary — 4 satisfied decisions/evidence closures, 4 narrowed outcomes, 10 transferred blockers across 8 stubs, and 2 permanently infeasible measurements abandoned.

## Dissent and unresolved objections (anthropic seat, round 2)

Recorded rather than dropped. The seat converged with openai on the two `E`
dispositions (measurement-a / measurement-b) and raised five conditions that
this run does not fully discharge:

Matze — as an independent reviewer seeing this for the first time, here's what doesn't hold up:

## 1. Trust boundaries the framework glosses over

**Cross-roadmap dependencies are hidden.** `utilization-sweep-window` blocks on another roadmap's Phase 3 that isn't in this blocker list — you can't disposition it without knowing that roadmap's state. `measurement-a-no-per-arm-builder-tier` needs "a UI-generation runner… landed for its own reason" — that's an **external team dependency** you have no authority over, dressed up as a blocker. Either surface the cross-roadmap graph or mark these as E (ABANDON) until the dependency materializes.

**Merged blockers span multiple roadmaps.** The framework says merge duplicate-evidence blockers, but `skill-activation-window` (blocks 49 steps in one roadmap) and `human-gated-live-trigger-eval` (blocks 4 steps in another) — when merged, which roadmap owns the stub? The instruction "give each group ONE disposition and ONE stub" doesn't say where that stub lives or which roadmap it unblocks first.

## 2. Rollback criteria the design omits

**Disposition D has no undo.** The framework says D-values are "applied with no chance to ask" — but what's the rollback if the value is wrong? `autonomy-defaults-sheet` sets four runtime behaviors; if "preselection: autonomous" causes a runaway loop, how do you kill it? The output format has no field for "revert condition" or "monitoring signal".

**Rule 3 (B for irreversible actions) has no timeout.** Creating a repository, flipping a shipped default — these are moved to stubs, but stubs can rot. What's the kill-switch for a B-stub that never gets executed? Six months? A year? Silence → permanent deferral.

## 3. Sequencing risk — Phase dependencies aren't modeled

**enforcement-evidence blocks Phase 5 but needs Phase 1 and Phase 4 outputs.** That means Phase 1 and 4 must complete first — but they're not declared as dependencies. You can't disposition enforcement-evidence until you know whether earlier phases produced the data it cites.

**kernel-soak-window correction says 3 of 4 deltas "proceed independently" — independently of WHAT?** In parallel? Sequentially? The correction refutes the blocker's own scope but doesn't specify the new execution order.

## 4. Open questions disguised as decisions

**autonomy-defaults-sheet asks "confirm or override" four values with no decision criteria.** "Autonomous vs phase-checkpoints" is a product direction call, not a technical parameter — but it's framed as if the council just picks numbers. What's the tiebreaker if the council splits? What's the fallback if both options are equally reasonable?

**sink-choice asks "repository or endpoint?" but that's really "do we accept the operational burden of running an endpoint?"** That's a resourcing decision disguised as a technical choice. The blocker doesn't surface the hidden cost (who operates it? SLA? monitoring?) so the council can't weigh it.

**default-flip-release-gate says "the maintainer must decide" but presents it as a blocker the council should disposition.** That's authority confusion — either the maintainer decides (→ not a council blocker) or the council decides (→ rewrite the text to remove "maintainer must").

## 5. The single hardest pushback — speculative dependencies as blockers

**measurement-a-no-per-arm-builder-tier and measurement-b-no-renderable-lane-pair block on "landed for its own reason"** — i.e., external teams building features you don't control. That's not a blocker, it's a **dependency inversion without commitment**. You're assuming:

1. Someone will build these features
2. They'll build them to satisfy YOUR measurement requirements
3. They'll coordinate with YOUR roadmaps

None of that is guaranteed. The framework has disposition E (ABANDON) for permanently infeasible work — these qualify until you show me:

- Feature requests or commitments from the teams who'd build this
- Evidence these are on THEIR roadmaps
- Or, E-disposition them now and transfer to new work only IF those features materialize

**Framing "if someone builds X" as "when someone builds X" is the architectural call I'd reject hardest.**

---

**What evidence would change my mind:**

1. A cross-roadmap dependency graph showing which blockers gate which other roadmaps
2. Rollback procedures for each disposition type (especially D)
3. Phase completion order for blockers that cite multi-phase data
4. Explicit "this is a product call, not a technical parameter" labels on autonomy-defaults-sheet / sink-choice
5. Commitments from external teams for measurement-a/b capabilities, or E-disposition with transfer conditions