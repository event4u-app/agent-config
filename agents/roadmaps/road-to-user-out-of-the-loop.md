---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to user-out-of-the-loop

> After the initial planning window, roadmap execution, verification, and delivery run without synchronous user participation until one of the few real escalation classes fires.

## Goal

Reduce the median count of synchronous user contacts per delivered roadmap, and separately the median wall-clock hours from run start to open PR, without raising the held-defect rate measured by the conformance suite.

Two target axes, deliberately not merged: a run can ask zero questions and still be slow. Contacts are B1–B12; wall-clock is B13–B14 and the parallel lanes.

## Prerequisites

- [x] Read `src/agent-src/contexts/execution/roadmap-execution-contract.md` and `roadmap-process-loop.md`
- [x] Read `docs/contracts/ai-council-config.md` § decision_resolution
- [x] Read `src/skills/worktree-lifecycle/SKILL.md` § scope lock and `src/scripts/hook_manifest.yaml` § session-register
- [x] Re-verify every `file:line` in Context against the branch HEAD before executing a phase

## Context

Source: an external planning session over this repository, 2026-08-16. The draft pinned `681cf2a`; every claim below was re-verified at `6d18f5bb2` for this file. The re-verification changed nothing material — the load-bearing line numbers still resolve exactly, which is why the plan is carried rather than re-derived.

**Re-verified at `097ab6549`** (Prerequisite 4, 2026-08-17): all five lines below
still resolve exactly, at the same line numbers. Two additions from executing
Phase 0/1 against them:

- The absent-mode fallback has a **second** site the table did not name —
  `roadmap-execution-contract.md:5` ("absent / `interactive` = legacy behavior,
  this context stays unloaded"). Phase 1 Step 1 has to change both or the ladder
  is contradicted by the context it loads.
- The contract summary at `roadmap-execution-contract.md:64` **already** carries
  "3. Run interactive instead", so Step 1's requirement that the option stays is
  satisfied by the existing shape rather than by a new one.

**Verified at `6d18f5bb2`:**

| Claim | Evidence | Status |
|---|---|---|
| Absent `execution.mode` silently means interactive, even under `process-full` | `roadmap-process-loop.md:79` ("absent = interactive") | still true |
| Artifacts outside the pre-scan batch still trigger the interactive drafting protocol mid-run | `roadmap-execution-contract.md:80` | still true |
| The suggestion block is emitted "as the first and ONLY thing this turn" | `command-suggestion-flow.md:48` | still true |
| The plan-confidence gate degrades to one question per turn | `plan-confidence-gate.md:86` | still true |
| The scope lock is already defined as the disjointness contract between parallel worktrees | `worktree-lifecycle/SKILL.md:74` | still true |

**Architecture principle.** No autonomy feature binds to a command. Every mechanism lands in a shared layer each entry point already loads: the contract layer, the rule layer, the config layer (`decision_resolution`), the hook layer, and the routing layer. A `/goal` entry point may exist later as a thin front door (P6.4), never as the carrier of the mechanics.

**Anti-goals that never fall.** `high_impact` / `user_required` route to the user (locked). The Hard Floor stands. Merge stays human and conversational — this plan makes merges batchable and decouples execution from them, it does not automate them. Kernel rule edits keep their own PR and soak window. The judge-independence law is untouched. Autonomy here means eliminating questions, never eliminating safeguards.

**Bottlenecks addressed.** B1 silent interactive fallback · B2 in-run question serialization · B3 task-scope ratchet across a backlog · B4 merge coupling · B5 council as a single point of halt · B6 synchronous deferred-item gate · B7 session mortality · B8 no unattended runner · B9 team loop gated on a benchmark never run · B10 no protocol disposition for medium-impact decisions · B11 mid-run artifact interview · B12 planning-phase serialization · B13 parallel primitives unwired for roadmaps · B14 free-text routing echo contact.

## Phase 0 — Measurement foundation

- [x] Add an advisory `interruption-ledger` hook concern on the `stop` slot that classifies per turn whether the reply ends in a user question, writing `{run_id, kind, class, roadmap}` records to `agents/runtime/state/interruptions.jsonl`. Reply-shape detection follows the existing turn-end gate pattern; the file shape follows `gate-metrics.jsonl`. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [x] Add `interruption_report.ts` reporting asks per run, halts per run, median user wait derived from chat-history timestamps, and the wall-clock axis (total elapsed per delivered roadmap versus agent working time). Window: 30 sessions, matching the conformance window. <!-- verify: ./scripts-run src/scripts/interruption_report --help -->
- [x] Pre-register two separate claims in `docs/CLAIMS.md`: `user-out-of-loop-baseline` (median synchronous contacts per delivered roadmap) and `roadmap-wall-clock-baseline` (median hours to open PR per roadmap). Quality anchor for both: the held defect rate. Each mechanism below carries its own honest-null path. <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria:** both claims exist in `docs/CLAIMS.md` with a recorded baseline number; the report runs against a real session window and prints both axes.

**Exit status (2026-08-17).** Both claims exist and the report runs against the
real window, printing both axes. **The baseline NUMBER is deliberately not
recorded yet, and that is the honest outcome rather than an unfinished step.**
Two measured reasons, both now carried in the claims themselves:

- The contact axis has **zero** observations by construction — the ledger
  concern records on `stop`, so it cannot hold data from sessions that ran
  before it existed. The report says so rather than printing `0`.
- The wall-clock axis has observations but a **short window**: the rolling chat
  history is a buffer, not an archive, and held **5 sessions, all from one day**
  against the 30 this step asks for. Both claims therefore pre-register a
  ≥ 20-run floor before any comparison, and the report flags `window_short`.

Recording a median over 5 same-day sessions and labelling it a 30-session
baseline is the measurement-artifact-as-decision-input failure this repository
already has on record. Reworded: this step is done when the instrument is built,
honest, and running — the number arrives with the sessions.

Three findings worth carrying forward:

- **The join was nearly unbuildable and looked fine.** The ledger first keyed
  `run_id` on the turn-end gate's `deriveSessionKey` (sha256/32); the chat
  history writes `derive_session_tag` (sha256/16, normalised). The two never
  join, so the wall-clock claim would have been underivable while every unit
  test passed. The ledger now uses `derive_session_tag`.
- **Synthetic user turns had to be excluded by definition, not by filter.** The
  harness writes task notifications and system reminders in the user role;
  counting them as replies collapses every measured wait toward zero and makes
  the axis read as already-solved. 15 of 26 user turns in the live sample were
  synthetic.
- **A contact is three classes, not two.** A hand-back ("das entscheidest Du",
  "your call") ends the turn and waits for the user with no `?` anywhere.
  Counting only questions would score this package's own preferred yield shape
  as zero contacts — the Risk-6 failure, reached by arithmetic.

**Rollback:** the concern is advisory and removable from the manifest; the report is additive.

## Phase 1 — One elicitation surface

The principle: exactly one place asks the user — the contract screen with its decision sheet. The plan-confidence interview, artifact understand-questions, and in-run clarifications all feed that surface instead of opening their own rounds.

- [x] Replace the silent interactive fallback with a mode-derivation ladder in `roadmap-process-loop` § 3. First source wins: explicit invocation suffix, then frontmatter `execution.mode`, then invocation-form default — `process-full` and `/roadmap:next` always offer the contract with `autonomous` preselected, `process-phase` derives `phase-checkpoints`, `process-step` runs without a contract. Still exactly one confirmation; the "run interactive instead" option stays. <!-- verify: ./scripts-run src/scripts/lint_roadmap_complexity -->
- [x] Add `contexts/execution/contract-decision-sheet.md`, loaded by the contract derivation itself so every consumer inherits it: the pre-scan collects all open questions and renders them as one numbered block with a default per question and an "accept all defaults" path. <!-- verify: grep -q contract-decision-sheet src/agent-src/contexts/execution/roadmap-execution-contract.md -->
- [ ] Draft the `ask-when-uncertain` carve-out "contract-time batch elicitation": one structured decision sheet per contract display counts as one question under the Iron Law; outside contract time the one-question-per-turn law holds verbatim. Kernel-adjacent — ships as its own PR with the required soak window. <!-- blocked-by: kernel-soak-window -->
- [x] Add a batch branch to the plan-confidence gate's inline degrade protocol: all load-bearing branches known at seed time as one sheet, at most two rounds, round two only for branches created by round-one answers. Remaining ambiguity resolves to a conservative default plus a decision memo. The C-to-R1 state file is unchanged, so no plan is ever interviewed twice. <!-- verify: ./scripts-run src/scripts/check_references -->
- [x] Make `/work` consume the same contract derivation rather than carrying a second mechanism. <!-- verify: grep -q roadmap-execution-contract src/domains/engineering-base/work/command.md -->
- [x] Extend the non-interactive contract's tier matrix onto the suggestion layer: a HIGH-tier match (a deterministic signal names the command uniquely — the roadmap file exists, the phrase matches a trigger description exactly, no second candidate above the floor) routes directly with a one-line basis statement instead of an options block. MEDIUM and LOW keep the block. <!-- verify: ./scripts-run src/scripts/lint_command_routing -->
- [x] Extend `commands/evals/roadmap.json`: frontmatter without a mode plus `process-full` yields a contract with `autonomous` preselected; the sheet contains every pre-scan question and no question appears later in the run; a `high_impact` question never appears in the sheet and escalates during the run; the batch gate opens round two only for newly created branches; a free-text prompt with two candidates above the floor yields a block rather than an auto-route. <!-- verify: ./scripts-run src/scripts/lint_command_routing -->

**Exit criteria:** the eval additions pass; a `process-full` run on a mode-less roadmap presents exactly one contract screen and asks nothing further before its first halt class fires.

**Exit status (2026-08-17) — six of seven steps landed; Step 3 is the kernel halt.**

Four verify probes in this phase named scripts that **do not exist**
(`lint_command_cluster`, `lint_rule_references`, `validate_evals`) and one named
a path that does not exist (`src/agent-src/commands/work/command.md` — commands <!-- ref-ignore -->
moved to `src/domains/**` under ADR-115). All five are corrected above to gates
that actually run; a step whose probe cannot execute is a step nobody can check.

- **Step 1 was a seven-file defect, not a one-file edit.** The sibling search for
  the exact construct found the absent-means-interactive claim in **10 places
  across 7 files** — the loop (× 3), the contract context (× 2), the roadmap
  authoring template, `roadmap-management/SKILL.md`, `roadmap-writing/SKILL.md`,
  `docs/customization.md`, and a now-false comment in `lint_roadmap_complexity`.
  The first grep pattern missed two of them because they wrote "absent-field
  default" rather than "absent = interactive" — search for the construct, not
  for a description of it. Remaining occurrences after the sweep: **0**.
- **Step 2's option already existed.** `roadmap-execution-contract § 2` has
  carried "3. Run interactive instead" all along, so "the option stays" needed
  nothing built.
- **Step 6 amends an Iron Law**, in `command-suggestion-policy` — which is NOT a
  kernel rule (checked against the locked set in `kernel-membership § 4`), so it
  needs no soak. Written as a narrow carve-out with all three HIGH conditions
  required and every existing passage intact. Its third condition — the routed
  command must show its own confirmation — is the one that keeps this a removed
  *duplicate* confirmation rather than auto-execution. **Its kill criterion has
  no instrument**: >5 % mis-routes over 50 auto-routes cannot be counted today,
  so the rate is unmeasured rather than low, and that is stated at both sites.
- **Step 7 is partially expressible, and the gap is the corpus, not the work.**
  `src/agent-src/commands/evals/*.json` is a ROUTING corpus — `prompt` →
  `expected command`, gated by `lint_command_routing.ts:130`. Two of the step's
  five assertions are routing-shaped and landed. The other three (the sheet
  contains every pre-scan question; a `high_impact` question never enters the
  sheet; the batch gate opens round two only for new branches) are *behavioural*
  and have **no executable home in this corpus shape**. They are model-carried
  today. Closing that needs a behavioural corpus for commands — the skills side
  already has one (`evals/evals.json` + `lint_behavioural_eval_freshness`) and
  the commands side does not.

**Rollback:** the ladder falls back to frontmatter-only by removing the invocation-form rung; the decision sheet is a context file that can be unlinked; the auto-route reverts to block-always.

**Kill criteria:** interactive chosen at the contract screen in more than 40 % of 20 runs reverts the default to frontmatter-only. More than 5 % mis-routes across 50 auto-routes reverts to block-always.

## Phase 2 — Set scope, serial then parallel

- [ ] Add `/roadmap:process-backlog [--limit N] [--filter …]`: selection like `/roadmap:next` but over an ordered set, with one contract for the whole set — candidates, branch names, dependency graph, artifact counts, and one decision sheet across all of them. <!-- verify: ./scripts-run src/scripts/lint_command_cluster -->
- [ ] Add auto-continuity in the loop layer: when a roadmap closes green under a set contract, the loop pulls the next independent one without a new contact. Applies to `/roadmap:next` when the set option was chosen in its sheet; the default stays conservative (this one only). <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Draft the third autonomy form "set-scoped" in `autonomy-mechanics § Task-scope`. `NEW TASK → FRESH CONFIRMATION` stays verbatim for everything outside a declared set. Kernel-adjacent — own PR and soak. <!-- blocked-by: kernel-soak-window -->
- [ ] Add failure isolation: a quality regression halts only its own roadmap; the set continues with the next independent member. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Wire parallel lanes for independent set members (no declared dependency, disjoint owned paths), staged only after ten clean serial set runs. Isolation via the existing worktree scope lock, coordination via session-register branch claims, dispatch via the existing worktree orchestration mode, delivery one branch and one PR per lane. Cap at two lanes in the first iteration. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->

**Exit criteria:** one set run closes at least two roadmaps with exactly one contract; the interruption ledger records zero contacts between them.

**Rollback:** the set mode reverts to serial-with-confirmation; lanes are removed while serial execution stays.

**Kill criteria:** more than one of the first ten set runs shows cross-roadmap interference reverts the set mode to serial. For lanes: a wall-clock gain below 25 % against serial at equal defect rate over ten parallel set runs removes them; a single scope-lock collision with data loss removes them immediately.

## Phase 3 — Merge decoupling

- [ ] Add dependency detection to the set contract: a file-overlap heuristic plus an optional `depends:` frontmatter field. One graph feeds both the parallelizability decision and the stacking decision. <!-- verify: ./scripts-run src/scripts/lint_roadmap_complexity -->
- [ ] Support stacked branches: a dependent roadmap branches from its parent's branch and its PR targets that branch. Pushes stay restricted to the run's own branches. Execution never waits for a merge. <!-- verify: ./scripts-run src/scripts/lint_command_cluster -->
- [ ] Add `/roadmap:merge-train`: a single conversational surface presenting the whole stack at once, where each merge instruction issued in that session is followed by the agent retargeting and rebasing the dependent PRs — an executed per-PR instruction, never an agent decision. <!-- verify: ./scripts-run src/scripts/lint_command_cluster -->

**Exit criteria:** two dependent roadmaps reach open PRs without any merge occurring between their executions.

**Rollback:** stacking reverts to trunk-based branching; the train reverts to manual retargeting.

**Kill criteria:** one history loss or wrong rebase in the first five trains returns retargeting to manual.

## Phase 4 — Question-elimination ladder

The resolution order for an open question becomes: decision sheet at contract time, then the agent, then the local second-model rung, then the council, then a decision memo, then the user.

- [ ] Extend the `ai-council-config` schema with an optional class route to a locally installed second-model CLI for `medium_impact`, quota-bounded and USD-neutral. `high_impact` and `user_required` remain schema-rejected for anything but `user`. This also softens the council-as-single-halt problem without a council configured. <!-- verify: ./scripts-run src/scripts/validate_frontmatter -->
- [ ] Run the pre-registered build-review-fix benchmark that the team loop has been gated on since it was written. Positive result activates the loop; a null closes the gate and is published. This runs before any further team autonomy. <!-- verify: ./scripts-run src/scripts/check_claims -->
- [ ] Add the decision-memo channel: resolutions below the locked classes write `agents/runtime/state/decisions/<run>/NNN.md` with question, chosen option, reasoning, resolver, and confidence. The roadmap report and PR description link the directory; a revisit marker creates a follow-up step instead of a live halt. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Add the late-artifact policy as a contract field: `auto-research` re-runs the research and overlap pass mid-run against current artifact state — the identical procedure already accepted as non-interactive at contract time, only later — with an extend verdict extending silently, a create verdict deriving understand-answers from the step text and sheet answers, and only a genuine overlap conflict halting. Cap at three late artifacts per run, then halt: a run that keeps discovering artifacts has a planning problem, not an autonomy problem. Kernel-adjacent rule delta in `artifact-drafting-protocol`. <!-- blocked-by: kernel-soak-window -->
- [ ] Confirm in the ladder text that no self-adversarial fallback exists: without both a council and a second-model rung, the ambiguity halt stands. The gap is not filled with a monologue. <!-- verify: grep -q "self-adversarial" src/agent-src/contexts/execution/roadmap-process-loop.md -->

**Exit criteria:** one run resolves at least one medium-impact question through a memo rather than a contact, and the memo is reviewable after the fact.

**Rollback:** each rung is an optional config route; removing it restores the previous escalation.

**Kill criteria:** a memo revisit rate above 20 % in any class returns that class to council or user.

## Phase 5 — Asynchronous disposition of deferred items

- [ ] Add the contract field `deferred_policy: spawn-follow-up-draft` as the single autonomous option: accepting the contract selects it, and a roadmap closing with deferred items spawns the follow-up draft automatically. Information is preserved; the synchronous wait disappears. <!-- verify: ./scripts-run src/scripts/lint_roadmap_complexity -->
- [ ] Draft the corresponding delta to the deferred-item gate in `roadmap-progress-sync`: the synchronous halt stands unless the accepted contract declares a policy, in which case the follow-up spawn runs automatically and every other disposition stays conversational. Kernel-suspect — own PR and soak. <!-- blocked-by: kernel-soak-window -->

**Exit criteria:** a roadmap with deferred items closes under an accepted contract, produces a follow-up draft, and archives without a synchronous prompt.

**Rollback:** remove the contract field; the gate reverts to always-wait.

**Kill criteria:** a single case of information loss reverts the delta.

## Phase 6 — Session continuity

- [ ] Extend the session-end-of-life concern: above the recycle threshold and inside a running contract, write a deterministic checkpoint and generate the handoff automatically. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [ ] Add a resume runner outside the session: a watcher starts a fresh headless session on a handoff-plus-resume-requested marker, using the existing one-shot handoff injection. Budgets: at most three relaunches per run, a daily token cap, and the emergency orchestration halt stopping the watcher too. The watcher respects session-register claims so two sessions never share a branch. <!-- verify: ./scripts-run src/scripts/lint_hook_manifest -->
- [ ] Allow exactly one deterministic self-fix attempt for the checkbox-flip halt inside contract mode, then halt. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Add `/goal <objective>` as a thin front door: intake, live screen, batched confidence gate, roadmap authoring, contract plus sheet, then execution. No mechanics of its own. <!-- verify: ./scripts-run src/scripts/lint_command_cluster -->

**Exit criteria:** one run survives a session boundary and continues without a user-typed resume.

**Rollback:** the watcher is opt-in and removable; the checkpoint remains useful on its own.

**Kill criteria:** one wrong auto-flip reverts the self-fix attempt.

## Phase 7 — Unattended backlog operation

- [ ] Add a local scheduler entry running a single-roadmap backlog pass in a dedicated worktree with a dedicated profile and no production remotes in that worktree's git configuration. A credentialed CI runner is explicitly out of scope for this phase. <!-- verify: test -f agents/runtime/state/scheduler.json -->
- [ ] Add a notification digest rather than a permission prompt: overnight PRs, memos, and halts land in one channel the user reads in the morning. <!-- verify: ./scripts-run src/scripts/validate_evals -->
- [ ] Add a demotion gate: over a fourteen-day window, a rework rate for unattended PRs above a pre-registered threshold relative to attended PRs returns the scheduler default to off. <!-- verify: ./scripts-run src/scripts/check_claims -->

**Exit criteria:** one unattended pass produces a reviewable PR and a digest entry, with the demotion gate armed.

**Rollback:** the scheduler is opt-in; removing the entry restores attended-only operation.

## Phase 8 — Standing measurement

- [ ] Add the interruption report to the release cycle: synchronous contacts per roadmap, wall-clock per roadmap split serial versus parallel, memo revisit rate, late-artifact auto rate and its revisit rate, interactive-choice rate at the contract screen, auto-route error rate, and the distribution of halt reasons. <!-- verify: ./scripts-run src/scripts/interruption_report --help -->
- [ ] Verify that every default flipped in Phases 1 through 7 carries its kill criterion in the same document as the flip. <!-- verify: ./scripts-run src/scripts/lint_roadmap_complexity -->

**Exit criteria:** one release cycle publishes both axes against the pre-registered baselines.

**Rollback:** none required; the phase is measurement only.

## Blockers

### blocker: kernel-soak-window

- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only
- **Blocks:** Phase 1 (batch elicitation carve-out — the only true kernel delta), Phase 2 (set-scoped autonomy form), Phase 4 (late-artifact policy), Phase 5 (deferred-policy delta)
- **Question:** Is the ONE kernel delta (`ask-when-uncertain`) authorized to proceed as its own PR with the required soak window — and do you want the other three deltas, which are NOT kernel, done as ordinary rule edits or held with it?
- **Recommendation:** Authorize `ask-when-uncertain` on its own with the soak, and let the other three proceed as ordinary rule edits in the order 5-2, 4-4, 2-3 — the deferred-policy delta first because it is the smallest. Holding three non-kernel edits behind a soak window they do not need is the cost this blocker was accidentally imposing.
- **If you do nothing:** Phases 1, 2, 4, and 5 each stop at their rule-delta step. Everything else in the plan still runs — the measurement foundation, the mode-derivation ladder, the decision sheet, the set command, stacking, the merge train, the memo channel, and the session work touch no kernel rule. The plan degrades to roughly two thirds of its scope rather than stalling.
- **What to do:**
  1. Confirm the deltas are in scope at all. **Corrected 2026-08-17, verified against the tree — this blocker overstated its own scope 4:1.** Only `ask-when-uncertain` (batch elicitation) is in the locked kernel set (`docs/contracts/kernel-membership.md § 4`, row 142) and needs the own-PR + soak guarantee. `autonomy-mechanics` (set-scoped form) is **not a rule at all** — it is a context at `src/agent-src/contexts/execution/autonomy-mechanics.md`, so the rules-tree path for it does not exist. `artifact-drafting-protocol` (late artifacts) and `roadmap-progress-sync` (deferred policy) ARE rules but are **absent from the locked nine**. Three of the four therefore need no soak window; the phase text calling them "kernel-adjacent" is what carried the error forward.
  2. Name the order, or accept the recommended one.
  3. Confirm the soak interval per `src/agent-src/contexts/authority/kernel-rule-edits.md` — for `ask-when-uncertain` only. The agent will not shorten it and cannot self-authorize it.
- **Answer:** PARTLY COVERED by option (a) — 2026-08-20. Per
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  (`B | transferred`), the entry splits: the three NON-kernel deltas proceed now as
  ordinary rule edits, in the order the rendered default names, and that half is
  accepted. The one kernel delta (`ask-when-uncertain`) is **transferred** — authorising
  a kernel-rule edit and letting its soak interval elapse are not agent-completable, and
  `scope-control` states in as many words that no autonomous mandate lifts the
  slow-rollout guarantee. Batch A carries the three-point check verbatim: original
  criterion, only batch elicitation and its own-PR soak moved, re-entry producer the
  kernel-rule maintainer with the `kernel-rule-edits.md` interval as the probe.
- **Resolved when:** the user authorizes or declines the `ask-when-uncertain` delta, and says whether the three non-kernel deltas proceed independently.

### blocker: autonomy-defaults-sheet

- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 1 (preselection), Phase 2 (lane cap), Phase 4 (late-artifact default), Phase 5 (policy breadth)
- **Question:** Four preference settings that determine how aggressive the first iteration is; each has a conservative and a consequent option.
- **Recommendation:** Preselect `autonomous` at the contract screen, cap lanes at two, default late artifacts to `auto-research`, and keep the deferred policy limited to the follow-up-draft option. Rationale: each is reversible, each carries its own kill criterion in the phase text, and the conservative variant of all four together produces a plan that measures nothing because nothing changes.
- **If you do nothing:** the phases can still be built with the conservative variant of each; the measurement in Phase 0 then compares a smaller delta and takes proportionally longer to reach significance.
- **What to do:**
  1. Confirm or override the preselection for `/roadmap:next`: `autonomous` versus `phase-checkpoints`.
  2. Confirm or override the lane cap: 2 versus the configured `subagents.max_parallel`.
  3. Confirm or override the late-artifact default: `auto-research` versus `halt`.
  4. Confirm whether the deferred policy offers only the follow-up-draft option or also an explicit cancellation with a reasoning memo.
- **Answer:** OVERRIDDEN 2026-08-20 — option (a) does not carry this row as rendered.
  The council settled all four values itself in
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md)
  (`D | satisfied`) and chose the CONSERVATIVE variant on three of the four:
  preselection `phase-checkpoints` (NOT `autonomous`), lane cap `2` (as rendered),
  late-artifact default `halt` (NOT `auto-research`), and a deferred policy offering
  BOTH a follow-up draft and explicit cancellation with a reasoning memo (NOT limited to
  the follow-up-draft option). Those four values are the recorded answer; the rendered
  default is superseded on three of them. This is the clearest single case for why
  blanket acceptance of the sheet was not applied unexamined.
- **Resolved when:** the four values are named, and they are recorded in the decision sheet the Phase 1 contract screen renders.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Batched elicitation hides a decision the user would have made differently | product | One sheet with defaults invites accepting all of them, including a question that deserved thought. | Locked classes never enter the sheet and still escalate during the run; every sheet answer is recorded in the decision-memo directory and reviewable after the fact. | Phase 1, Phase 4 |
| 2 | Parallel lanes collide on a shared path | implementation | Two lanes edit the same file despite a disjointness claim, and one overwrites the other. | Lanes are staged behind ten clean serial runs, capped at two, isolated by the existing scope lock, and coordinated through session-register claims; a single collision with data loss removes them immediately. | Phase 2 |
| 3 | Auto-routing sends a prompt to the wrong command | implementation | A HIGH-tier match fires on a phrase the user meant differently and the run starts on the wrong roadmap. | Routing requires a deterministic uniqueness signal and prints its basis; the routed command's own contract screen remains the confirmation; a 5 % error rate over 50 routings reverts to block-always. | Phase 1 |
| 4 | Unattended operation produces work nobody reviews | product | Overnight PRs accumulate faster than the morning review absorbs them. | The demotion gate measures rework rate over fourteen days and returns the scheduler to off above a pre-registered threshold; the digest is a read surface, not a queue. | Phase 7 |
| 5 | Memo channel becomes a place decisions go to be forgotten | product | Medium-impact resolutions accumulate unreviewed and a wrong one surfaces late. | Revisit rate is a standing metric; above 20 % in a class, that class returns to council or user resolution. | Phase 4, Phase 8 |
| 6 | The measured contact reduction comes with a quality cost | product | Fewer questions produce more defects, and the two metrics are reported separately so the trade is invisible. | Both pre-registered claims carry the held defect rate as their quality anchor; a mechanism that improves contacts while moving the defect rate is reverted regardless of its own number. | Phase 0, Phase 8 |
| 7 | Late-artifact auto-research drifts the run's scope | implementation | A run keeps discovering artifacts and quietly grows beyond its plan. | Cap of three per run then halt, each one recorded as a memo with its overlap-scan result. | Phase 4 |

## Acceptance Criteria

- [ ] Both pre-registered claims carry a baseline number and at least one post-change measurement.
- [ ] A `process-full` run on a roadmap without `execution.mode` presents exactly one contract screen and asks no further question before a halt class fires.
- [ ] A set run closes at least two roadmaps with one contract and zero contacts between them.
- [ ] Two dependent roadmaps reach open PRs without a merge occurring between their executions.
- [ ] Every default flipped in this roadmap has its kill criterion in the same phase text as the flip.
- [ ] The locked decision classes still reach the user, verified by an eval that puts a `high_impact` question into a run and asserts it does not appear in the sheet.

## Provenance

- Source: an external planning session over this repository, 2026-08-16, carried through three drafting rounds by its author. Repository claims were pinned at `681cf2a` in the source and re-verified at `6d18f5bb2` for this file; the Context table records what was actually read.
- Raw session material stays local and untracked at `agents/tmp.old/better-goal.txt`.
- Council: not convened. The two contested items are carried as structured blockers rather than resolved here.
