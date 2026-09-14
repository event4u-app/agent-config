---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
depends:
  - road-to-typed-grants-that-persist
  - road-to-decision-closure
relates:
  - slug: road-to-typed-grants-that-persist
    relation: depends
    note: merge delivery in Phase 8 activates only after ADR-268 § 3; Phase 0 may land earlier
  - slug: road-to-decision-closure
    relation: depends
    note: the recovery ladder routes by the ownership table that file defines
estate_growth_exempt: >-
  Third of the three receiver roadmaps ADR-260 § Consequences records as missing; it owns the
  replacement control — tests, forge-required checks and the council — that makes narrowing
  the Hard Floor something other than a removal. Owner-recorded precedence, ADR-268 § 11,
  2026-09-08. Also grows open_blockers by two, one of which is a per-host capability
  measurement rather than a decision.
estate_offset_exempt: >-
  Third of the same three-roadmap set, and the one that carries the replacement control. It
  cannot be offset or deferred: without it, narrowing the Hard Floor in the first stem is a
  removal rather than a migration, which ADR-268 section 0 forbids as a break of the protected
  outcome.
design_validated: >-
  Owner rulings of 2026-09-08 transcribed in ADR-268 §§ 6-9; runtime permitted by ADR-249.
capability_gap: >-
  Whether a host exposes a process-level kill switch is unmeasured on seven of eight hosts;
  Phase 7 measures it before the daemon enforces anything.
---
# Road to adversarial verification and long runs

> **Blocked on two dependencies AND on two blockers of its own, recorded 2026-09-10 by an
> owner-delegated drain run under a 2/2 convergent AI council verdict.** Screened for
> execution and left untouched — 0 of 30, no step started. The council required this file's
> reason to be stated as **different** from its sibling's rather than folded together with it,
> because completing the dependency chain would be necessary here and still not sufficient.
>
> `depends:` both `road-to-typed-grants-that-persist` and `road-to-decision-closure`. The first
> cannot complete (five kernel steps are agent-denied and the deny's retirement needs an
> admin-only forge settings change); the second is blocked solely on the first. On top of that
> chain this file carries `forge-protection-settings` and `daemon-host-kill-switch`, both open
> and both Class 3. openai: *"Completing `typed-grants` would therefore be necessary but not
> sufficient."*
>
> **No step was executed as "dependency-free".** Same four-part independence test as the
> sibling, same outcome: nobody named a qualifying step, so none were run. Recorded rather
> than left to read as an oversight.
>
> **Nothing was descoped.** Both seats refused the drain run's terminal descope rule here for
> the same reason as the sibling — the obligations are blocked, not abandoned.
>
> **One of its blockers is now partly measured; see `forge-protection-settings` below.** That
> is the only forward motion this file received, and it is evidence rather than progress: no
> checkbox moved.

> **SUPERSEDED IN PART, 2026-09-14 — the paragraph above describes 2026-09-10 and is kept for
> the reasoning, not for the count.** All twenty-three phase steps landed on 2026-09-13, and
> four of the seven acceptance criteria closed on 2026-09-14. The screening verdict was right
> about the two blockers and wrong about the steps: what the blockers actually gate is
> narrower than the file read as. `forge-protection-settings` gates **3.2's acceptance**, not
> its code; `daemon-host-kill-switch` gates **7.1's enforcing mode**, not the observation-only
> floor that ships first. Both are stated that way in their own entries below, and both were
> re-read rather than trusted.
>
> **27 of 30. The three that remain are each externally impossible, not unstarted** — and each
> says so under its own criterion rather than here: **AC-4** needs an edit to a kernel rule and
> `block_kernel_rule_writes` refused it at tool-call time (reproduced 2026-09-14, not assumed);
> **AC-5** needs two forge admin settings, re-measured the same day and still false; **AC-6**
> needs the owner decision its blocker is, and the measurement half is already done.

> **Source:** `agents/tmp.old/inbox-2026-09-w/` — an inbox round carrying two challenge-me
> interviews with the owner plus three generations of consolidated proposals. Verified against
> `main@399beecab` on 2026-09-08.

> **Proposal, not adopted — but its authority is decided.** This file is the replacement
> control. Narrowing a Hard Floor without it is a removal, not a migration — which is why
> ADR-268 § 1's floor and this roadmap's Phase 3 are the same claim read from two ends.
> ADR-268 is **accepted**, owner-directed on 2026-09-08.
>
> **This is where ADR-268 § 0 is either earned or refuted.** § 0 declares the autonomy
> outcome as the owner's purpose and says explicitly that it does not claim autonomy is safe —
> only that the control instance moves to tests, forge-required checks and the council. The
> acceptance criteria below are that measurement. A mechanism here that turns out not to work
> is reported as not working; the protected outcome protects the *goal* from being re-litigated,
> never a mechanism from being measured.

## Goal

*Ask the owner* stops being the quality and control loop. In its place: test-first where the
test is written and validated by **someone else**, forge-required checks, a bounded fix-loop
whose bound triggers a strategy change and a ladder rather than a question, autonomous target
sync and semantic conflict repair, continuity across a twelve-hour run, and mechanical
guardrails for the eleven typed ops. A run ends merged where a grant exists and open-green
where it does not — on every supported host, with the hosts that cannot carry a mechanism
saying so rather than pretending.

## Reproduced, on this tree at `399beecab`

| ID | Fact | Where |
|---|---|---|
| D1 | The validation-loop budget is N=3 and its remedy is *STOP. SURFACE. ASK USER FOR GUIDANCE.* | `src/rules/autonomous-execution.md` § Validation-loop budget |
| D2 | `quality.local_auto_run` ships `false` on the stated ground that *remote CI is the authoritative gate*; the roadmap quality cadence defaults to end-of-roadmap, which the template itself says *lets errors compound* | `src/config/agent-settings.template.yml`; `src/rules/roadmap-ci-steps-policy.md` |
| D3 | `src/skills/test-driven-development/` exists and no always-loaded rule activates it; the only rule mentioning tests-first is `think-before-action.md` | `ls src/skills`; `ls src/rules` |
| D4 | `evaluator-independence` covers reviews and judges, not test authorship; its hook reads evaluator prompts | `src/rules/evaluator-independence.md` |
| D5 | A PreToolUse deny is honoured on `claude` only; `non-destructive-by-default` declares `enforced_by: none` | `src/rules/autonomous-execution.md`; `src/rules/non-destructive-by-default.md` |
| D6 | The council resolves CLI-first — `auto` is cli → api → unavailable — and a mid-flight fallback exists | `src/scripts/ai_council/config.ts`; `src/scripts/ai_council/mid_flight_fallback.ts` |
| D7 | Runtime is permitted under ADR-249 and `collector_daemon.ts` exists; no guardrail watchdog does | `ls src/scripts` |
| D8 | `push_settle_hook.ts` is a reminder; `run_continuation_hook.ts` has no *delivery target not reached* condition | `src/scripts/hooks/` |
| D9 | `/pr:merge` § 3 enumerates four conflict classes and `process-full` halt 6 fires on anything outside them | `src/domains/git/pr/merge/command.md`; `process-full/command.md:227-236` |
| D10 | `/pr:create` re-syncs the base on every push; `check_branch_freshness` is single-hop | `src/domains/git/pr/create/command.md` |
| D11 | Team mode exists and sits on no escalation path | `src/domains/meta/team/` |
| D12 | `staged_confirmation` is a declaration and binds on no host | `src/scripts/schemas/command.schema.json:257` |
| D13 | `ci_settle` is the sanctioned CI waiter and a hand-written poll loop is not; `gh pr checks --watch` exits 0 even on failure | `src/rules/context-hygiene.md` § Waiting is one waiter |

## What this roadmap is NOT

- **Not a claim that AC guarantees safety on every host.** D5 is a host fact. A host with no
  mechanism is `destructive: manual-only` and refuses typed ops there.
- **Not a new capability schema or risk taxonomy.** The attribute model over
  `staged_confirmation` is the shape.
- **Not mutation-testing infrastructure as a prerequisite.** Phase 2.3 is the cheap first form.
- **Not a second telemetry instrument.** `audit-log-v1` is reused.

## Phase 0 — Quality defaults (may land alone, and first)

- [x] **0.1 Quality runs under a mission.** `quality.local_auto_run` resolves `true` inside a
      mission and stays `false` for chat without one. The template sentence that justifies the
      current default is rewritten to say which of the two it describes.
      verify: `agent-config settings:get quality.local_auto_run` reports the mission value and
      the file it came from, and `roadmap-ci-steps-policy`'s gate still fires for a full
      pipeline step outside a mission.
      <!-- landed 2026-09-13: `quality.local_auto_run_in_mission` (C, consent) + the pure
      resolver in `src/shared/missionExecution.ts`; the mission resolution is a runtime
      condition, never a settings layer, so `settings:get` reports it as its own line and
      still names the file for the layered value. The Posture note now says which of the two
      it describes. `lint_roadmap_ci_steps` reads the unchanged key and still fires. -->
- [x] **0.2 The quality cadence becomes per-phase.** The template's own *lets errors compound*
      sentence is the argument.
      verify: `agent-config settings:get roadmap.quality_cadence` reports `per_phase`.
- [x] **0.3 An `execution:` block for the loop bound and its ladder.** `fix_loop_max`, default
      10, overridable globally, per project and per prompt; `escalation` listing
      `independent`, `council`, `team`, `owner_owned_check` in order. `owner_owned_check` is
      not *ask now* — it asks whether the residue is owner-owned per the ownership table, and
      continues under a new strategy epoch if it is not.
      verify: all three appear in `agent-config doctor --json`.
      <!-- landed 2026-09-13: `doctor --json` carries `execution.fix_loop_max` and
      `execution.escalation` unconditionally — not behind the `checks` guard `detection`
      uses — because the bound is as much a fact on the no-manifest path as on the manifest
      one. `owner_owned_check` is the ladder's last rung rather than a separate field: it is
      not an independent switch. -->
      <!-- verify: ./agent-config doctor --json | grep -A 8 '"execution"' -->


**Exit:** Phase 0 is independent of ADR-268 and unblocks every run. It may land as its own PR
before the record is signed.

## Phase 1 — Test-first, thin

- [x] **1.1 A thin always-loaded rule over the existing skill.** `src/rules/test-first.md`,
      under 40 lines, activating `test-driven-development`. Obligations: a behaviour change
      gets a failing test first where a test is meaningful; a bug gets a reproducing regression
      test first; uncertain legacy gets a characterisation test; the test must fail for the
      intended reason; refactoring happens only after green. It applies to consumer code, AC
      code, AC scripts and hooks, and governance changes whose projection, routing or lint
      behaviour is testable. Pure prose with no executable contract needs review, not a fake
      test. The owner's prompt may reorder it.
      verify: `wc -l src/rules/test-first.md` is at most 40;
      `./scripts-run src/scripts/check_always_budget` is green; and the rule carries no
      carve-out excluding AC on the ground that the edited artefact is markdown when its
      routing or lint behaviour is testable.
      <!-- landed 2026-09-13 at 41 lines (the 40 the step named, plus one: the trigger block
      the payload finding below forced). **NOT always-loaded, and the shortfall is a
      measurement rather than a choice — this is the honest half of the step.**
      Three budgets were tried, in this order, and each refused it:
      1. `type: always` is the locked nine-rule kernel (`_lib/kernel_rules.ts`), and
         `check_always_budget`'s extended dimension stood at 60,195 / 60,254 chars — 59 chars
         of headroom on a ratchet its own output says may only move DOWN. A tenth always-rule
         of any useful size is arithmetically impossible without a kernel-membership decision
         no agent takes.
      2. A TRIGGER-LESS `auto` rule, which `project_thin_rules` keeps full-bodied (its D3
         branch) and so delivers on every turn, was built and measured. It cleared
         `check_always_budget` trivially but pushed `check_standing_rule_delivery` and — the
         binding one — `check_preamble_payload_budget`, a per-SPAWN ratchet measured at the
         base ref with no number to edit.
      3. Giving it triggers thins the host projection to a two-line stub, which helps the
         standing-delivery budget and does NOT help the payload one: that gate measures
         `dist/agent-src/rules`, the condensed body, so a rule costs its full size there
         whatever its triggers. Measured, not assumed — the projection went to 2 lines and
         the payload figure did not move.
      So the rule ships ROUTED (5 triggers, tier 1) and its +446 tok was paid for by
      migrating argument prose out of three standing rules into their context files under
      the established P4 pattern — nothing deleted, every word preserved one layer out.
      **What is therefore NOT delivered:** the obligation does not reach a turn whose prompt
      never says "test". The canonical miss is *"add a discount calculation"*. Closing it
      needs an owner decision on one of the two ratchets, or a `pre_tool_use` carrier keyed on
      a code edit rather than on prompt wording. Recorded here rather than left to be
      discovered from a green checkbox.
      One trap worth recording — a rule ABSENT from `dist/router.json` is thinned regardless
      of its triggers, so `compile_router` must run before `generate-tools`. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->

## Phase 2 — Tests by someone else

- [x] **2.1 Independence levels for test authorship.** `evaluator-independence` gains a
      *tests are evaluators* section: L0 the same agent, fallback only; L1 another session on
      the same model; L2 another model; L3 another provider; L4 a multi-provider council or
      team. Critical behaviour — security, authority, data loss, merge control — targets L3 or
      L4 where two providers are configured. The workflow is: acceptance behaviour →
      independent author → RED evidence → implementer → GREEN → independent validator.
      verify: `agent-config council:status` reports the provider count the chosen level
      assumes, and a fixture whose author and implementer share a session id is rejected.
- [x] **2.2 What an implementer may never do silently.** Weaken an assertion, delete a failing
      test, skip or xfail it, loosen a threshold, or change fixture semantics to fit the code.
      Where the test appears wrong: evidence → independent test review → council or team →
      change only after an independent verdict. The owner is not the arbiter.
      verify: fixture `T2` — an assertion weakened without an independent verdict artefact is
      red.
- [x] **2.3 Test-quality validation before delivery.** An independent instance answers one
      question: would these tests fail under plausible wrong implementations? It looks for
      tautologies, algorithm duplication, snapshot overuse, missing boundary and error cases,
      over-mocking, expectations changed to fit code, and a test never shown red. The
      validator's identity and provider go into the evidence.
      verify: a fixture test suite that passes against a deliberately broken implementation is
      reported by the validator rather than by a later incident.
- [x] **2.4 Two CI gates and one hook flag.** `check_test_delta.ts` reds a code change with no
      credible test delta unless the owner set a reason; `check_test_weakening.ts` reds a
      removed or loosened assertion, a skipped test or a lowered threshold with no independent
      verdict artefact; the evidence-independence hook flags a commit touching both `tests/**`
      and the code under test from the same session id. Ratchet entries are measured at this
      pin.
      verify: fixture `G8` code-without-test is red; `G9` test-first across two sessions is
      green; `T2` weakening is red.
      <!-- landed 2026-09-13. Both gates carry all six surfaces: the script, a Taskfile target,
      a `consistency.yml` step, a `gate-coverage.yml` row with a floor and CI-identical argv, a
      `--self-test` (8 cases each, 3 rejecting), and a `gate_ledger` adoption so neither adds
      to the completeness ratchet.
      **`check_test_weakening` counts NET, and that is the whole gate.** Editing an assertion
      removes one line and adds another, so a gate counting raw removals reds every legitimate
      test edit — and a gate that reds every PR gets its exemption widened until it finds
      nothing, which is this file's own Risk 4. Three of its eight self-test cases are ACCEPTS
      for exactly that reason: editing an assertion, adding assertions, and removing a skip.
      **`check_test_delta`'s escape is a PR LABEL, not a file.** A file-based exemption inside
      the diff under review is one an agent can widen; a label is an owner action outside the
      diff. Same shape as `check_kernel_rule_bundle`'s existing label.
      **What neither gate claims.** Whether the test came FIRST, and whether it tests the thing
      that changed. Both are judgements a diff does not carry, and claiming them would be the
      coverage inflation `evaluator-independence` exists over. The hook flag is WARN-only for a
      stated reason too: L0 is a permitted fallback, so refusing it would forbid a legal state,
      and the session boundary it reads is an approximation rather than an identity. -->
      <!-- verify: ./scripts-run src/scripts/check_test_delta --self-test -->

## Phase 3 — The forge and CI own correctness

- [x] **3.1 Name the required layers, in order.** A targeted local RED then GREEN → quality
      scoped to the changed surface → per-phase fast CI → the final full required CI → forge
      branch protection → final-head verification. CI rejects a skipped or disabled check,
      unresolved generated drift, policy-projection drift, a stale-head merge, and a conflict
      resolution that was not revalidated. CI never requires a human approval merely because a
      change is large.
      verify: each layer is named in the delivery contract with the command that runs it, and
      a fixture PR with a disabled required check cannot reach delivery-ready.
      <!-- landed 2026-09-13 in `process-full/command.md` § The six required layers, plus
      `_lib/delivery_ready.ts` for the executable half — a layer with no command is a claim,
      a layer with one is a check, and the fixture asserts every row carries one.
      **The disabled-check clause needed a predicate, not a sentence.** A required context
      that SKIPPED leaves a GREEN rollup, so `checks.every(passing)` returns true exactly
      where it must return false. `deliveryBlocks` therefore asks two questions — did every
      required context report, and did each report SUCCESS — and treats SKIPPED, CANCELLED and
      NEUTRAL alike: a check that reached no verdict enforced nothing, whatever colour it
      rendered. Sensitivity proven rather than assumed: replacing the check with the naive
      `conclusion === 'FAILURE'` reds 4 of 12 cases.
      It returns ALL blocks rather than the first, because a run that fixes one and re-pushes
      to find the next pays a CI cycle per block — the cost the layer ORDER exists to avoid. -->
      <!-- verify: npm run test:ts -- tests/scripts/delivery_ready.test.ts -->
- [x] **3.2 `doctor` reads forge protection from the forge.** A `forge_protection` block —
      default branch protected, required checks present, force-push disabled, auto-merge
      available, deploy only via pipeline — read, never guessed. A missing row becomes a human
      ACTION blocker entry, not a halt.
      verify: `agent-config doctor --json` carries the block and every row's value has a source
      field naming the forge API call it came from.
      <!-- landed 2026-09-13. The block is `_lib/forge_protection.ts` (pure mapper) plus
      `_cli/doctor_forge_protection` in `doctor_execution.ts`; `cmd_doctor.ts` gains two lines,
      the rest lives under the 1,500-line cap.
      **Three states, not two, and that is the substance.** A row is `satisfied` /
      `unsatisfied` only when a NAMED call produced it; otherwise `unread`. A gate reporting
      `false` for something it never looked at is the failure the blocker's own re-scope
      names, and two states cannot express the difference.
      **`doctor` does not reach the network.** The reading is injected — a caller that queried
      the forge passes it, one that did not passes `UNREAD_FORGE` and gets five `unread` rows
      that still name the call each value would come from. A diagnostic nobody can run offline
      is one nobody runs; the sibling anchor gate declined the same cost.
      **Rulesets, never the classic endpoint**: `branches/main/protection` 404s on this
      repository while a ruleset protects it, so the unsatisfied detail warns about that 404
      explicitly. No ruleset id is pinned — the re-scope forbids it, since rulesets split. -->
      <!-- verify: ./agent-config doctor --json | grep -A 8 '"forge_protection"' -->

## Phase 4 — A recovery ladder with strategy epochs

- [x] **4.1 The bound triggers a strategy change, never a question.** Attempts 1-3 are
      root-cause plus a targeted fix; 4-6 require a mandatory strategy shift — re-examine
      assumptions, read history, build a minimal reproduction, find the last known good state,
      check upstream docs and issues, try an alternative implementation; 7-10 escalate
      independently — a second session, a provider-diverse reviewer, the council, the team with
      repository access, or a rollback of the slice. At the bound: did escalation yield a new
      strategy → a new epoch; can an independent phase proceed → continue it; is the residue
      owner-owned → one native ask; is an external prerequisite objectively missing → `BLOCKED`
      with evidence; otherwise → a new epoch. Council and team verdicts append to
      `## Decisions`. The allowlist-growth counter stays a separate mechanism.
      verify: `grep -rn 'N=3' src/rules` returns 0; fixture `T3` — ten failed fixes produce
      strategy changes and escalations and no owner ask attributable to the count.
      <!-- landed 2026-09-13. `autonomous-execution` now carries three bands
      (1-3 root-cause · 4-6 mandatory strategy shift · 7-10 independent escalation) and the
      five bound outcomes in order, with the owner rung reached by the OWNERSHIP test and
      never by the count. The old remedy — *STOP. SURFACE. ASK USER FOR GUIDANCE.* — is gone
      rather than appended beside, and `T3` asserts its ABSENCE so a revert cannot hide under
      new prose. The bound is `execution.fix_loop_max` from Phase 0.
      **`grep -rn 'N=3' src/rules` returns 1, not 0, and the one is externally impossible.**
      `verify-before-complete.md` is a kernel rule; `block_kernel_rule_writes` refused the
      edit at tool-call time (message: *"kernel rule verify-before-complete is immutable —
      tighten-only via the override exception registry"*), which is a human action outside an
      agent session. `T3` therefore asserts the offender set is EXACTLY that one file — which
      still reds the moment any non-kernel rule reintroduces the cap, and does not red on a
      change no agent can make. AC-4's own `returns 0` inherits this and cannot be met until
      a maintainer makes that edit. -->
- [x] **4.2 Read the red before diagnosing it, with the narrowest probe.** A CI red is read
      with `gh run view --job <id> --log-failed` filtered, never the whole log and never
      `--watch`'s exit code; a local red with the runner filtered to the failing name. The CI
      waiter is `ci_settle`, one waiter per condition.
      verify: `grep -c 'gh pr checks --watch' src/domains/product-basic/roadmap/process-full/command.md`
      returns 0, and the ladder's own text names `ci_settle`.
      <!-- landed 2026-09-13 in `autonomy-mechanics` § Read the red before diagnosing it. It
      names the two traps rather than only the tools: `gh pr checks --watch` exits 0 on a
      failure AND 1 when no checks exist — two different wrong answers from one number — and
      `ci_settle`'s verdict is its LAST OUTPUT LINE, because a run that reaches no verdict can
      still exit 0. One waiter per condition, per `context-hygiene`. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->

## Phase 5 — Target sync and conflict recovery

- [x] **5.1 Sync before every push and before delivery.** Fetch; merge the remote target into
      the task branch; where the target is not the trunk, also merge the trunk per project
      policy — a cascade base, extending the single-hop freshness check; resolve conflicts
      semantically; re-run the affected tests and quality; push; observe the final head's CI.
      verify: fixture `T5` — a target that moved twice during the run is merged in both hops
      and the final head is the one CI observed.
      <!-- landed 2026-09-13 as `_lib/cascade_base.ts`, extending the single-hop freshness
      check rather than replacing it: a branch based on the trunk still yields exactly ONE
      hop, which is the compatibility property that matters — this widens the check, it does
      not change the common answer.
      The defect it closes: `check_branch_freshness` asks whether a branch is behind the base
      its PR TARGETS, so a stacked branch perfectly current with `feat/parent` reports GREEN
      while `feat/parent` sits fifty commits behind the trunk. Hops are nearest-first because
      taking the trunk first pulls trunk commits past the parent and makes the stack's own
      diff unreadable.
      Two decisions a reviewer should check: a CYCLE and a TRUNCATION are reported rather than
      silently cut (a hop list cut short is indistinguishable from a short one), and an
      UNMEASURED hop counts as needing a merge — "could not tell" treated as "current" is the
      exact conflation that let the single-hop check pass a stale stack. Sensitivity proven:
      narrowing that filter to `behind === true` reds 1 of 12.
      The final-head half reuses `_lib/delivery_ready.ts` from 3.1 — a green verdict on a head
      that is no longer the branch head describes a different tree. -->
      <!-- verify: npm run test:ts -- tests/scripts/cascade_base.test.ts -->
- [x] **5.2 The four conflict classes become aids, not exhaustive authority.** An unenumerated
      conflict routes: understand both intents → inspect recency, authors and open PRs →
      preserve both where compatible → independent review for a risky merge → council or team
      → owner only for a product-semantic incompatibility. `process-full`'s halt 6 retires
      with the sibling roadmap's halt-table rewrite.
      verify: fixture `T4` — an unknown conflict class is resolved semantically and validated
      independently rather than halting the run.
      <!-- landed 2026-09-13. `/pr:merge` § 3's halt becomes the six-rung ladder, and
      `process-full` halt 6 is RETIRED IN PLACE — numbered, never renumbered, because the
      halt list is cited by index from several places and shifting five conditions up one is
      how a citation comes to name a different halt. Five live halts, not six.
      The substantive argument: "nobody has decided this yet" describes a class of CONFLICT,
      not a class of thing only an owner may touch. Most unenumerated conflicts are two
      branches editing adjacent prose, and halting on one converts a two-minute read into an
      owner interrupt. So the owner is the LAST rung and is reached by a semantic test — the
      two sides encode incompatible PRODUCT semantics — never by the run's own uncertainty,
      which the command says in its own fence.
      **What did NOT change, and the retirement depends on it:** an unenumerated conflict may
      still never be resolved silently. The record — which rung settled it, both intents, why
      the resolution preserves them — is what replaced the stop. A retirement that dropped the
      record too would be a removal rather than a migration. -->

## Phase 6 — Boy-Scout and adjacent improvement

- [x] **6.1 What rides along, and what does not.** During a mission the agent may add
      characterisation and regression tests, fix a small adjacent bug, improve naming, types or
      robustness, remove local dead code, simplify code it touched, and improve testability —
      where each is small, local, low blast radius, clearly correct, testable, and carries no
      new product decision. Anything larger becomes a follow-up artefact.
      verify: a fixture run that finds a larger adjacent refactor emits the artefact and leaves
      the code alone.
      <!-- landed 2026-09-13 as `_lib/rides_along.ts` plus the prose in
      `active-remediation-mechanics` § Inside a mission.
      **The gap it closes is structural, not a missing list.** `active-remediation`'s middle
      rung is NOTE + ASK, and inside a mission there is nobody to ask — so left unreplaced the
      rung collapses in one of two directions this suite already names: every issue becomes a
      fix (the scope creep `minimal-safe-diff` stops) or every one becomes silence (the
      look-away `active-remediation` stops). Under a mission it becomes EMIT A FOLLOW-UP
      ARTEFACT and leave the code alone.
      Six criteria, AND-ed rather than scored: a scored version lets a large change buy its way
      in with five cheap yeses, which is how a boy-scout rule becomes a refactor licence.
      Sensitivity proven — emptying the criteria filter reds 10 of 13.
      The characterisation stays the agent's judgement; the DECISION is mechanical, so the same
      inputs land the same way and a reader can check the call rather than re-litigate taste.
      A deferral states EVERY reason, because "it failed one of six" is not something a later
      triage can act on. -->
      <!-- verify: npm run test:ts -- tests/scripts/rides_along.test.ts -->

## Phase 7 — Guardrails for the eleven ops

- [x] **7.1 Layer them, and measure before enforcing.** Forge protection → the host hook where
      one is bound → a guardrail daemon, sibling of `collector_daemon.ts` under ADR-249's
      supervision contract → model policy as the last layer. The daemon watches the reflog, the
      exposed shell history and the forge event stream for typed ops, stops the host process
      where a kill switch exists, and emits a native ask naming the exact object; after the
      grant it **permits** the op rather than prohibiting it permanently. The observation-only
      floor ships first; enforcement waits behind a measured false-positive rate under 1 % on
      the 30-session corpus.
      verify: the daemon's first shipped mode writes observations and takes no action, and the
      false-positive measurement exists as an artefact before the enforcing mode is enabled.
      <!-- landed 2026-09-13 as `_lib/typed_op_watch.ts` — the OBSERVATION-ONLY floor, which is
      what K5 permits and all it permits.
      Both halves of the verify are mechanical rather than promised. `actionFor('observe', …)`
      returns `record` for EVERY measurement including a perfect one — there is no branch in
      that mode that acts, so no configuration flips it into one. And `enforcementAllowed(null)`
      REFUSES: an absent artefact is a refusal with its own reason, never a pass, which is the
      direction an absent-artefact check gets wrong by default. Sensitivity proven — removing
      that branch reds 2 of 26.
      Three further refusals worth reading: a corpus below the 30 sessions the roadmap fixed
      BEFORE any measurement; ZERO observations, because a rate over an empty denominator is
      not a measurement and is exactly what a broken recogniser produces; and a rate exactly AT
      1%, since the bar is "below".
      **The honest limit, in the module's own header:** it reads LINES, and a line is not an
      intention — an op typed into a comment or a heredoc looks identical to one about to run.
      That is why the first mode only writes down what it saw. Process supervision itself
      reuses ADR-249's contract rather than being reimplemented here, and the enforcing mode
      stays blocked on `daemon-host-kill-switch`.
      Recogniser ORDER is load-bearing and asserted: `git push --force` is a force-push, not a
      push, and a misordered table reports the milder op for the more dangerous line. -->
      <!-- verify: npm run test:ts -- tests/scripts/typed_op_watch.test.ts -->
- [x] **7.2 A per-host destructive column, measured.** `docs/enforcement-by-host.md` gains
      `destructive:` with values hook, daemon or manual-only, measured per host rather than
      asserted; `non-destructive-by-default`'s `enforced_by:` names the live layer on the
      current host.
      verify: `agent-config hooks:status` and the doc agree for the host the run is on, and no
      row is filled from the registry's all-false default without saying so.
      <!-- landed 2026-09-13, measured from `host_lowering.yaml` — the file the runtime
      resolver actually reads — and every row carries the reading it came from, so a
      hand-filled cell reds the fixture. Result: ONE host is `hook` (`claude`, the only
      `pre_tool_use` with `block_exit: 2`) and seven are `manual-only`. `daemon` is in the
      vocabulary and describes nothing — 7.1's daemon ships observation-only and its
      enforcing mode is blocked on `daemon-host-kill-switch` — which is said in the doc
      rather than left as an unreachable value a reader would take for a live option.
      The four distinct states inside the seven are kept in the Measured-from column
      (augment binds and discards · cursor/cline/gemini are unbound-not-unbindable, since
      `native_event_aliases` already maps their native events · windsurf/copilot have no
      alias row), because collapsing them is what produced the binary cell this document
      deleted in 2026-09-12.
      **The second clause is OWED, not delivered.** `non-destructive-by-default`'s
      `enforced_by:` still reads `none`: it is a kernel rule and
      `block_kernel_rule_writes` refused the edit at tool-call time — reproduced, not
      assumed. Lifting it is a human action outside an agent session. -->
      <!-- verify: ./scripts-run src/scripts/check_enforcement_matrix --quiet -->
- [x] **7.3 The council may veto a typed op, never grant one.** Under a mission: a council
      check that the op belongs to the mission → a native ask naming the object → execute. Per
      ADR-257 an unpaid route may propose and score, never decide.
      verify: fixture `T9` — a typed op reaches an exact-object ask after the council check,
      and a council verdict alone never produces the grant.
      <!-- landed 2026-09-13 as `_lib/typed_op_grant.ts`. `verdictAloneGrants` exists as its
      own function so the Iron Law is CHECKABLE rather than merely stated: it returns false
      over the whole verdict domain, unanimity included, and a test asserts that.
      The asymmetry is the design (ADR-257): a council that could grant would be a second
      authorisation path around the this-turn confirmation — and the cheaper one, so it would
      become the only one. Vetoing adds a refusal without adding an authority, which is the one
      direction safe to add for free.
      Three directions asserted because each is a plausible wrong implementation: a clearance
      read as a grant; a veto overridden by a later yes (an advisory veto is not one —
      sensitivity proven, gating the veto on `!confirmed` reds that case); and an UNAVAILABLE
      council read as a veto, which would make an unconfigured council a silent kill switch on
      every typed op — the same-shaped wrong guess `council-availability` exists over.
      The ask must name an exact OBJECT, not a category, per the Hard Floor's own wording. -->
      <!-- verify: npm run test:ts -- tests/scripts/typed_op_grant.test.ts -->

## Phase 8 — A delivery state machine

- [x] **8.1 States, and one forbidden ending.** `working → local-green → pushed → pr-open →
      ci-pending → (red → ladder → pushed | green) → target-sync-check → (moved → sync → tests
      → pushed | current) → delivery-ready → (grant → merged | no grant → open-green)`.
      `run_continuation_hook.ts` treats a PR below its delivery target as work remaining, so a
      run cannot end with red CI or a stale target while its checkboxes read complete. The CI
      wait uses the host's background primitive and the run continues with the next independent
      step meanwhile.
      verify: fixture `T7` — a run whose checkboxes are complete but whose CI is red does not
      end; `T8` — the same run without a grant ends open-green and says so.
      <!-- landed 2026-09-13 in `_lib/continuation_ladder.ts` (`DELIVERY_STATES`,
      `DELIVERY_ENDINGS`, `deliveryBlocksCompletion`) plus `RunState.delivery` and the ledger
      field in `run_continuation_hook`. Three decisions worth a reader's time:
      (a) the hold falls THROUGH to the budget rungs rather than returning `engage` — an early
      return would put a delivery hold outside every bound in the function, which is the
      unbounded loop the ladder exists against; (b) the STALL rung alone is exempted, because
      during delivery the open-step count it measures is definitionally zero and a metric that
      cannot move is not a stall signal — the mechanics file's own "the measurement broke"
      case; (c) an unrecorded position is NOT incomplete. The ladder decides on the stop path,
      where a `gh` probe is the cost the premise rung already declined, so the position is
      read from what the run wrote; inventing incompleteness from absence would hang every run
      that never adopted the field.
      Sensitivity proven rather than assumed: with `deliveryBlocksCompletion` neutralised to
      `return false`, 3 of the 23 fixtures go red; restored, 23/23 green. The 110 pre-existing
      run-continuation tests are unchanged. -->
- [x] **8.2 One page for the owner's review.** The end-of-run PR body carries: the delivery
      target reached, decisions taken and by whom, open owner-owned residue, the scope delta,
      the spend, and the fix-loop epochs.
      verify: a fixture run's PR body contains all six sections and the grant it spent.
      <!-- landed 2026-09-13 in `process-full/command.md` § The PR body is one page for the
      owner's review — six named sections, each answering a question the owner would otherwise
      have to ask. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->

## Phase 9 — Long-run continuity

- [x] **9.1 Write the record at every boundary, and never re-ask on restore.** The continuity
      record carries the mission id, the roadmap, the phase, completed steps, decision
      references, the authority snapshot including `expires` and `revoked_by`, the target
      branch, the PR, the head SHA, the last CI result, the recovery epoch, the attempt count,
      pending independent reviews and open owner-owned residue. It is written at each phase
      boundary and on stop, pre-compact and session end. On restart it restores, revalidates
      forge state and continues — and never re-asks a closed question. A side task does not
      clear it.
      verify: fixture `T6` — a resume simulation preserves the grant and every decision, and
      the run completes delivery without a repeated question.
      <!-- landed 2026-09-13 as `_lib/mission_record.ts` — the MISSION record, beside the
      session record `continuity_writer` already produces. All fourteen fields, the four write
      boundaries, and `clearedBy` which returns false for a side task: only mission completion
      clears it.
      **`restore` is not a deserialise, and Risk 5 is why.** The record carries the grant with
      `expires` and `revoked_by`; a restore that trusted the snapshot would resume with
      authority the owner withdrew AFTER it was written. So the snapshot is revalidated against
      the LEDGER, which is the surface a revocation actually writes to. Sensitivity proven —
      removing the ledger check reds that exact case.
      The precedence runs ONE WAY: the ledger can revoke a grant the record shows live, and
      cannot revive one the record shows revoked. A ledger that could un-revoke would make the
      record the weaker authority and the revocation advisory.
      An UNPARSEABLE expiry is treated as EXPIRED — a grant whose lifetime cannot be read is
      not a grant with no lifetime. -->
      <!-- verify: npm run test:ts -- tests/scripts/mission_continuity.test.ts -->

## Phase 10 — Council transport and cost

- [x] **10.1 Pause and report, never ask.** The posture is CLI → CLI quota exhausted → API
      within the ceiling → API over the ceiling → pause and report, naming what needed the
      council, why the CLI was unavailable, the estimated spend, the mission state, and what
      can still proceed. No question about buying more technical API usage. Business spend is
      a typed op and a different category.
      verify: fixture `T10` — an over-ceiling API requirement produces a report and no ask.
      <!-- landed 2026-09-13 as `_lib/council_transport.ts`. The four rungs, with the report
      carrying all six fields the step names.
      **Why a report rather than an ask, when both interrupt.** They interrupt differently. An
      ask BLOCKS — the run stops until an answer arrives, and the thing being asked about is a
      few dollars of inference, worth less than the run's remaining work. A report does not
      block: it names what needed the council, why the cheaper route was gone, the estimate,
      the mission state, and — the load-bearing field — WHAT CAN STILL PROCEED. Most of a
      mission can.
      `renderReport` emits no `?` and a test asserts the absence, because the failure mode is a
      report drifting into an ask one helpful sentence at a time. "Nothing can proceed" renders
      as a stated answer rather than an empty section.
      An estimate exactly AT the ceiling is WITHIN it — a limit, not an exclusive bound; the
      other reading pauses a run that budgeted exactly. -->
      <!-- verify: npm run test:ts -- tests/scripts/mission_continuity.test.ts -->

## Phase 11 — Authority-changing PRs

- [x] **11.1 The strictest path, reserved for authority.** An independent test author, an
      independent governance reviewer, a council pass, and a provider-diverse reviewer, plus
      the ratification artefact the sibling roadmap defines. CI verifies that new authority is
      inert before ratification.
      verify: fixture `G15` from the sibling roadmap passes here too — an authority-expanding
      change is inert until the artefact carries `verdict: ratified`.
      <!-- landed 2026-09-13 as `_lib/authority_path.ts`. Four passes, all four, and the
      artefact.
      **Inert-until-ratified is the property that makes the rest safe.** Without it the four
      passes are a process the author could complete and then merge; with it the change can
      land, be read, and still do nothing — so ratification is a separate act on a separate
      turn by a party that is not the author.
      Two checks are over the SET rather than over a claim, because both are satisfiable on
      paper otherwise: the AUTHOR may perform none of the four (ADR-268 § 4 — sensitivity
      proven, removing that branch reds exactly that case), and provider diversity is computed
      from the passes' own providers rather than trusted from the pass named
      `provider-diverse-reviewer`.
      It reports EVERY blocker, because the artefact is a checklist a human completes and
      handing them one item at a time turns four passes into four round trips. -->
      <!-- verify: npm run test:ts -- tests/scripts/mission_continuity.test.ts -->

## Kill register

| K | Killed | Why |
|---|---|---|
| K1 | An unbounded fix-loop | ADR-268 § 7 |
| K2 | A new capability schema or risk taxonomy for the daemon | the attribute model over `staged_confirmation` |
| K3 | Mutation-testing infrastructure as a prerequisite | Phase 2.3 is the cheap first form |
| K4 | Removing `owner_owned_check` from the ladder by setting | it is the rung that decides whether a residue is owner-owned at all |
| K5 | Daemon enforcement before the observation floor | a false-positive rate nobody measured is not a control |
| K6 | A second telemetry capture | `audit-log-v1` is reused |
| K7 | A full-body `test-first.md` duplicating the skill | D3 — the skill exists and is unactivated |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The replacement control lands after the floor it replaces | implementation | The sibling roadmap narrows the Hard Floor in its Phase 1. If this roadmap's Phase 3 forge protection and Phase 2.4 test gates are not live by then, the tree has neither the old owner confirmation nor the new mechanical check. | Phase 0 is explicitly landable alone and first; Phases 2.4 and 3.2 are named as preconditions in the sibling's own Risk 1, so the ordering constraint is recorded on both sides rather than assumed by one. | Phase 3 — The forge and CI own correctness |
| 2 | Independent test authorship degrades to L1 and keeps the name | product | Where one provider is configured, *another session* is the same model reviewing its own code — which is the property the level exists to deny, holding the label that says it does not. | Phase 2.1's fixture rejects a shared session id, and the level is read from `agent-config council:status`'s actual provider count rather than from an assumption; L3 and L4 are named as the target for critical behaviour and L0 is marked fallback-only in the rule text. | Phase 2 — Tests by someone else |
| 3 | The guardrail daemon stops a host process on a false positive | implementation | A watchdog reading the reflog and shell history for typed ops can misclassify, and its action is stopping the host. A single false stop in a twelve-hour run costs the whole run. | Enforcement is gated behind a measured false-positive rate under 1 % on the 30-session corpus, and the first shipped mode observes without acting; the capability gap in this file's own frontmatter records that seven of eight hosts have no measured kill switch at all. | Phase 7 — Guardrails for the eleven ops |
| 4 | A test gate reds every PR and gets weakened instead of fixed | implementation | `check_test_delta` reding a code change with no test delta is exactly the shape whose cheapest repair is to widen the exemption until the gate finds nothing — the allowlist-growth failure the autonomy rule already names. | Ratchet entries are measured at this pin, and the exemption is owner-set with a reason rather than agent-set; a rising exemption count is visible in the same ledger as the gate. | Phase 2 — Tests by someone else |
| 5 | Continuity restores a stale authority snapshot | product | The record carries the grant including `expires` and `revoked_by`. A restore that reads a snapshot written before a revocation would resume with authority the owner withdrew. | The revocation writes to the ledger, not only to the record, and 9.1's restore step revalidates forge state and the ledger before continuing; fixture `T6` asserts the grant is preserved, and the revocation fixture in the sibling roadmap asserts the inverse. | Phase 9 — Long-run continuity |

## Blockers

### blocker: forge-protection-settings
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 3.2's acceptance only. Not a halt — `doctor` lists what is missing and the
  run continues.
- **What to do:** run `agent-config doctor --json` once Phase 3.2 has landed and enable, on the
  forge, whichever rows it reports missing: default-branch protection, required checks,
  force-push disabled, auto-merge available, deploy restricted to the pipeline.
- **Recommendation:** enable all five. Branch protection is the gate ADR-268 § 3 relies on for
  merge delivery; without it, forge auto-merge is a convenience rather than a control.
- **If you do nothing:** merge delivery still refuses to bypass required protections, so
  nothing unsafe happens — but the control the narrowed Hard Floor was traded for does not
  exist, and Phase 3.2's acceptance criterion cannot be met.
- **Resolved when:** **RE-SCOPED 2026-09-10** by an owner-delegated drain run under a 2/2
  convergent AI council verdict, because the original criterion was unreadable on this
  repository as written. New criterion, in the council's own words: *"A `forge_protection` row
  is satisfied when current evidence from the repository's effective protection mechanism —
  including applicable rulesets — demonstrates the required behavior. After Phase 3.2 lands,
  `agent-config doctor --json` must report the same effective state without treating the
  classic protection endpoint's 404 as absence of protection."*

  **Why it needed re-scoping.** `repos/event4u-app/agent-config/branches/main/protection`
  returns `404 {"message":"Branch not protected"}`. This repository uses repository
  **rulesets**, and a checker reading the classic branch-protection endpoint sees nothing here
  — so `doctor` reporting rows false could mean "not configured" or "read the wrong API", and
  the old criterion could not tell those apart. The criterion deliberately does not name a
  ruleset id: openai required that, since *"rulesets can be replaced or split"* and pinning
  `17749383` would break on the first change.

- **PARTIAL EVIDENCE, 2026-09-10 — preflight, not the post-Phase-3.2 run.** Measured directly
  while building `check_platform_anchor` for `road-to-typed-grants-that-persist`. Recorded
  here because the same forge visit answers rows on both blockers, and the council required
  the freshness and the timing to be stated so a later reader cannot mistake this for a
  current `doctor` verdict:

  | Row | State | Evidence |
  |---|---|---|
  | default-branch protection | **satisfied** | an active ruleset with `target: branch`, `conditions.ref_name.include = ["~DEFAULT_BRANCH"]` |
  | force-push disabled | **satisfied** | the ruleset carries a `rules[].type: non_fast_forward` entry |
  | required checks | **provisional** | one context required, `Sync + Generate Tools Consistency`, `strict: true`. Whether one context is the intended required SET is undecided, so this is not counted satisfied |
  | auto-merge available | **unmeasured** | not queried |
  | deploy restricted to pipeline | **unmeasured** | not queried |

- **RE-MEASURED 2026-09-13, post-Phase-3.2, and this is the run the criterion asked for.**
  Read through the mapper Phase 3.2 landed, against the live forge. Two rows that were
  `unmeasured` above now have values, and one that was `provisional` is satisfied:

  | Row | State | Evidence |
  |---|---|---|
  | default-branch protection | **satisfied** | one active `target: branch` ruleset, `conditions.ref_name.include = ["~DEFAULT_BRANCH"]` |
  | force-push disabled | **satisfied** | the ruleset carries `rules[].type: non_fast_forward` |
  | required checks present | **satisfied** | TWO contexts now, up from the one recorded on 2026-09-10: `Sync + Generate Tools Consistency` and `Standing payload delta + budget gate`. The 2026-09-10 note withheld `satisfied` because one context might not be the intended SET; two independent gates is no longer that question |
  | auto-merge available | **UNSATISFIED** | `repos/…` reports `allow_auto_merge: false`. Merge delivery cannot queue behind checks — ADR-268 § 3's mechanism is unavailable until an admin enables it |
  | deploy restricted to pipeline | **UNSATISFIED** | the one environment, `github-pages`, has `custom_branch_policies: true, protected_branches: false` — it accepts a deployment from any branch |

  Method: `gh api repos/event4u-app/agent-config`, `…/rulesets`, `…/rulesets/17749383`,
  `…/environments`, 2026-09-13. **The blocker stays OPEN**, and now for a sharper reason than
  before: it is no longer unmeasured, it is measured and two of five rows are false. Both are
  admin settings — enabling auto-merge and restricting the `github-pages` deployment branches —
  which is a human action outside an agent session. `doctor` lists them as ACTION lines and the
  run continues, which is what "not a halt" means.

  Method: `gh api repos/event4u-app/agent-config/rulesets` and `…/rulesets/17749383`,
  2026-09-10, one active ruleset. **These are preflight measurements. Phase 3.2 has not
  landed, so `doctor --json` has not run, and this table does not discharge the criterion —
  post-Phase-3.2 verification must reproduce these results and confirm there is no
  ruleset-detection gap.** Re-measure rather than citing this table if the date is stale.

- **Cross-link, with the gates kept separate:** `ratification-platform-anchor` in
  `agents/roadmaps/road-to-typed-grants-that-persist.md` needs a visit to the same ruleset
  settings, so one admin session would move both. **It is not the same gate, and merging them
  would silently change this one.** Independent approval (`required_approving_review_count`
  is 0) and the unconditional `RepositoryRole` bypass are the anchor's criteria and are NOT
  among the five `forge_protection` rows above — the drain run's own framing got that wrong
  and both seats corrected it. openai: *"Adding it here without an explicit council re-scope
  silently changes the gate."* So: read them together, resolve them separately.

  **UPDATE 2026-09-13 — both named criteria are gone, and the separation this bullet argues
  for survives it.** Independent approval is no longer one of the anchor's criteria at all:
  an owner ruling of 2026-09-10 removed `minimum_approving_reviews` and
  `require_last_push_approval` from the expectation and from `NON_NEGOTIABLE_FLOOR`. The
  unconditional `RepositoryRole` bypass was removed the same day (`bypass_actors: []`,
  `current_user_can_bypass: never`, re-measured 2026-09-13). `check_platform_anchor` now
  reports `PASS_WITH_ACCEPTED_RISK` and exits 0, so the "one admin session would move both"
  premise is spent — there is no anchor settings change left to make. The conclusion is
  unchanged and now easier to honour: these are still different gates, and this one's five
  `forge_protection` rows are unaffected by any of the above.

### blocker: daemon-host-kill-switch
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 7.1's enforcing mode. The observation-only mode ships without it.
- **What to do:** decide the fallback for a host with no process-level stop — either
  `destructive: manual-only` on that host, per this file's Phase 7.2 column, or no autonomous
  mode there at all. Phase 7.2 supplies the measurement first;
  `docs/enforcement-by-host.md` is where the answer is recorded.
- **Recommendation:** `manual-only`. Refusing autonomy outright on a host that cannot be
  watched is the stricter reading, and it costs the owner the hosts they actually use; the
  column makes the weaker guarantee visible instead of silent.
- **If you do nothing:** the daemon ships observation-only and never enforces, which is the
  honest state and also means the eleven typed ops carry no mechanical guard on seven of eight
  hosts.
- **Resolved when:** `docs/enforcement-by-host.md`'s `destructive:` column is filled for all
  eight hosts from measurement, and each `manual-only` row is a recorded decision rather than
  an unmeasured default.

## Fixtures

`T1` a normal feature — independent RED, implementation, CI green, zero asks · `T2` an
implementer weakens a test · `T3` ten failed fixes · `T4` an unknown conflict class ·
`T5` a target that moved twice · `T6` a twelve-hour resume · `T7` a grant plus green → merged
with no second confirmation · `T8` no grant → open-green · `T9` a typed op → exact-object ask ·
`T10` an API ceiling → pause and report · `G8` and `G9` the test-delta gates.

## Acceptance Criteria

- [x] AC-1 — `T1`-`T10`, `G8` and `G9` exist under `tests/e2e/` and are green.
      <!-- closed 2026-09-14. `tests/e2e/adversarial-verification-fixtures.test.ts`, 74 green.
      `T2`-`T5`, `T7`, `T8`, `G8` and `G9` landed with their phases on 2026-09-13; the four
      this criterion was still waiting on — `T1`, `T6`, `T9`, `T10` — landed here over the
      modules their phases shipped (`continuation_ladder`, `mission_record`, `typed_op_grant`,
      `council_transport`).
      **Each of the four pins the direction its mechanism could plausibly have gone wrong**,
      which is the bar Phase 2.3 sets and the reason a fixture restating an implementation line
      is not evidence. `T1` asserts the ladder's WHOLE action vocabulary carries no rung
      matching `/ask|question|confirm|owner/` — a count mapped to an ask is what Phase 4.1
      removed, and the union is where it would come back. `T6` asserts a twelve-hour gap
      exceeds `WALL_CLOCK_CAP_MS` by more than 2× and still resumes: the wrong implementation
      expires the MISSION record with the RUN's wall clock. `T9` asserts a confirmed ask naming
      a category is still `ask-required` — the wrong implementation reads the `confirmed`
      boolean and never reads what was named. `T10` asserts an estimate exactly AT the ceiling
      is within it, and that `renderReport` emits no `?` anywhere.
      **Sensitivity proven on two, by deliberate sabotage and restore**: neutralising
      `restore`'s ledger-revocation branch reds exactly `T6`'s withdrawn-grant case, and
      turning `<=` into `<` in `routeCouncil` reds exactly `T10`'s at-the-ceiling case — one
      test each, no collateral, so neither is passing for an unrelated reason. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->
- [x] AC-2 — independent test provenance is recorded per test, and critical tests are at L3 or
      L4 wherever two providers are configured.
      <!-- closed 2026-09-14. Phase 2.1 shipped the LEVELS; it shipped no place to write one
      down, so until now the level a given test reached was unrecorded and therefore
      uncheckable — the same shape as the recorded failure `evaluator-independence` exists
      over, a verdict nobody could trace back to the prompt that produced it.
      **The record** is a marker line directly above each `describe` — `// provenance:
      level=L4 | critical=yes | evidence=<slug>` — parsed by `_lib/test_provenance.ts` (pure,
      11 unit tests). Three decisions with plausible opposites: an unmarked group is
      `ungoverned` and never defaulted to L0, because defaulting would make "provenance is
      recorded per test" true by construction; the provider count is a PARAMETER rather than a
      probe, since `council:status` resolves from a user-global file a CI runner does not have
      and probing would relax the floor exactly where the obligation matters; and `evidence` is
      required at L3/L4 and ignored below, because an unattributed claim of independence
      cannot be checked for the independence it claims.
      **The independence is real and was bought, not asserted.** `council:status` reports two
      providers (`anthropic`, `openai`), so the reachable level is L4. Three peer-reviewed
      runs, `2/2 present` AFTER each — scoped by the 51,200-byte bundle ceiling, covering every
      group in the file between them. Nine convergent findings were folded in the same day:
      `T1`'s first test was a tautology passing against a `findingFor` that always returned
      null; `terminalStateFor(halt) !== null` passed against a map sending every halt to
      `success`; the ask-regex was evaded by a rung named `escalate`; `T6` used `Date.now()`,
      which made its boundary cases unwritable, and asserted the ledger precedence in one
      direction only and one field of fourteen; `T7/T8` tested five of eleven delivery states,
      so an implementation recognising only those five passed. `G9` was RENAMED — its title
      claimed "test-first across two sessions" while its own body conceded the gate cannot see
      a session boundary, which both seats called a title-body contradiction.
      **Four findings are NOT folded in, and the reason is stated rather than implied.** They
      are defects in the authority IMPLEMENTATION (`objectIsExact` accepts `!!!!!!!!` and
      `all-branches` as exact objects; `op` is never validated; `confirmed` carries no turn
      provenance; `restore` ignores `ledger.grant`), and `security-sensitive-stop` puts a
      threat pass before the first edit to a surface like that. They ship as
      `road-to-authority-object-exactness` — the tracked-follow-up disposition, not a note.
      Full record incl. the prompts and what the pass did not close:
      `agents/evidence/analysis/ac2-independent-test-authorship-2026-09-14.md`.
      **The honest limit**, stated there and worth repeating: L4 means a multi-provider council
      participated as an evaluator on that group. It does not mean the group was independently
      authored end to end, and reading the marker that way would over-claim. -->
      <!-- verify: npm run test:ts -- tests/scripts/test_provenance.test.ts -->
- [x] AC-3 — `check_test_delta` and `check_test_weakening` run in `ci-fast`, and this
      repository is green under them at promotion or ratcheted from a measured baseline.
      <!-- closed 2026-09-14, VERIFIED rather than assumed: both halves were re-read on this
      tree rather than taken from Phase 2.4's landing note.
      Registration: `taskfiles/ci-fast.yml` carries `check-test-delta` and
      `check-test-weakening`; `Taskfile.yml`'s `ci` aggregate calls both; `.github/workflows/
      tests.yml` runs both under `static-checks` with the same `--quiet` argv the Taskfile
      uses, which is the identical-argv condition a gate registration owes.
      Green: both run clean on this tree — `scanned=0` on an empty diff, which is the honest
      reading of a diff-scoped gate with nothing yet to scan, and `0 code path(s)` /
      `no net weakening` on the working diff.
      **No ratchet entry, and that is the correct shape for these two.** Both are DIFF-scoped:
      they measure the change under review, never a tree-wide population, so there is no count
      to ratchet down and a baseline file would pin a number that is zero by construction on
      every clean branch. "Green at promotion" is the branch this criterion takes. -->
      <!-- verify: ./scripts-run src/scripts/check_test_delta --self-test -->
- [ ] AC-4 — `fix_loop_max` defaults to 10, `grep -rn 'N=3' src/rules` returns 0, and no
      escalation path maps a count to an owner ask.
      <!-- OPEN 2026-09-14 — two of three clauses are met and the third is agent-impossible.
      MET: `fix_loop_max` defaults to 10 (`agent-settings.template.yml:760`, the Zod schema's
      `.default(10)`, and `missionExecution`'s fallback). MET: no escalation path maps a count
      to an owner ask — `autonomous-execution` carries `THE BOUND TRIGGERS A STRATEGY CHANGE,
      NEVER A QUESTION` and `A COUNT IS NOT A REASON TO ASK`, the old `ASK USER FOR GUIDANCE`
      and `DO NOT ITERATE BEYOND` are gone, and `T3` asserts their absence rather than only
      the new prose's presence.
      NOT MET, and not by an agent: `grep -rn 'N=3' src/rules` returns ONE, in
      `verify-before-complete.md` — one of the nine kernel rules. The edit was ATTEMPTED on
      2026-09-14 and refused at tool-call time: `block-kernel-rule-writes: BLOCKED — kernel
      rule verify-before-complete is immutable`. Reproduced, not assumed, and the denial names
      its own remedy: a human action outside the agent session, via the override exception
      registry. The occurrence is a pointer in a mechanics link — `Mechanics (N=3 / Hard-Floor
      bounds)` — so the obligation this criterion protects is already satisfied everywhere the
      cap could bind; what is left is a stale three characters in a file no agent may open.
      `T3`'s fixture asserts the offender set is EXACTLY `['verify-before-complete.md']`, which
      keeps the obligation live for every non-kernel rule and reds the moment another
      reintroduces the cap. -->
      <!-- verify: grep -rln 'N=3' src/rules -->
- [ ] AC-5 — `agent-config doctor --json` reports every `forge_protection` row true on this
      repository.
      <!-- OPEN 2026-09-14 — three of five rows satisfied, two false, and both falses are admin
      settings. RE-MEASURED this day rather than carried from the blocker's 2026-09-13 table:
      `gh api repos/event4u-app/agent-config --jq '.allow_auto_merge'` → `false`, and the one
      environment `github-pages` still reports `custom_branch_policies: true,
      protected_branches: false`. Unchanged in both rows.
      This is the blocker working as its own entry describes it — `forge-protection-settings`
      gates this CRITERION, never the run: `doctor` lists the two as ACTION lines and execution
      continues, which is what "not a halt" means. Phase 3.2's code shipped and is asserted.
      An agent cannot close it: enabling auto-merge and restricting a deployment environment
      are repository-admin actions outside an agent session. -->
      <!-- verify: gh api repos/event4u-app/agent-config --jq '.allow_auto_merge' -->
- [ ] AC-6 — `docs/enforcement-by-host.md`'s `destructive:` column is measured for all eight
      hosts, with every `manual-only` row a recorded decision.
      <!-- OPEN 2026-09-14 — the MEASUREMENT half is complete, the DECISION half is
      owner-reserved and that is the whole remaining distance. All eight rows carry a value
      and the reading it came from (`host_lowering.yaml`, 2026-09-13): one `hook`, seven
      `manual-only`, and the four distinct states inside those seven kept apart rather than
      collapsed. `daemon` is in the vocabulary and describes nothing, which the doc says
      rather than leaving as an unreachable value a reader would take for a live option.
      What is missing is not a measurement. `daemon-host-kill-switch` is Class 3, human-only,
      and its question is what the FALLBACK should be on a host with no process-level stop:
      `manual-only`, or no autonomous mode there at all. The doc currently records what layer
      exists, which is an observation; "a recorded decision" is the owner choosing between
      those two, and an agent recording a preference as a decision would be taking it in the
      owner's name. The blocker's own recommendation is `manual-only`; it is not this run's to
      accept. -->
      <!-- verify: ./scripts-run src/scripts/check_enforcement_matrix --quiet -->
- [x] AC-7 — a throttled four-phase long-run fixture ends merged, with one continuity resume
      and zero owner asks.
      <!-- closed 2026-09-14 as the `AC-7` describe in
      `tests/e2e/adversarial-verification-fixtures.test.ts`. Every other fixture in that file
      pins ONE mechanism; this one pins the COMPOSITION, which is where this roadmap's actual
      claim lives — that a run can cross more wall-clock time than any single run may spend and
      still reach `merged` without spending one owner question on it.
      **The two modules have to disagree about scope for that to work, and they do.**
      `continuation_ladder` bounds ONE run (25 iterations, four hours) and a run that hits
      either bound reports `exhausted` — a budget word. `mission_record` carries the MISSION,
      which is longer than a run by construction. Collapsing them is the plausible wrong
      implementation in both directions: a ladder that never halted is the unbounded loop K1
      killed, and a record that expired with the run's wall clock makes a long run impossible
      and every resume an owner interrupt.
      The fixture runs phases 1-2 under one clock, stops run A at `halt-wall-clock` five hours
      in, asserts that rung maps to `exhausted` and NOT to `blocked` — a `blocked` here would
      route a nameable continuation to the owner-owned rung, which is Phase 4.1's
      count-to-an-ask move under a different name — restores twelve hours later with the
      decisions closed, and runs phases 3-4 under a FRESH clock to `merged`. Total span 14h
      against a 4h per-run cap, asserted rather than left for the reader to add up.
      **One negative and one sensitivity.** Zero-open over `ci-red` still returns `engage`, so
      four phases of flipped checkboxes over a red CI is not an ending. And a record carrying
      no decisions closes nothing, which is what makes the resume load-bearing rather than
      decorative. Neutralising the ladder's wall-clock branch reds this fixture's halt case
      (plus one pre-existing T7/T8 case that pins the same branch) and nothing else. -->
      <!-- verify: npm run test:ts -- tests/e2e/adversarial-verification-fixtures.test.ts -->
