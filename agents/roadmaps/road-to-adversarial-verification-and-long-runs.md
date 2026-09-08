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

- [ ] **0.1 Quality runs under a mission.** `quality.local_auto_run` resolves `true` inside a
      mission and stays `false` for chat without one. The template sentence that justifies the
      current default is rewritten to say which of the two it describes.
      verify: `agent-config settings:get quality.local_auto_run` reports the mission value and
      the file it came from, and `roadmap-ci-steps-policy`'s gate still fires for a full
      pipeline step outside a mission.
- [ ] **0.2 The quality cadence becomes per-phase.** The template's own *lets errors compound*
      sentence is the argument.
      verify: `agent-config settings:get roadmap.quality_cadence` reports `per_phase`.
- [ ] **0.3 An `execution:` block for the loop bound and its ladder.** `fix_loop_max`, default
      10, overridable globally, per project and per prompt; `escalation` listing
      `independent`, `council`, `team`, `owner_owned_check` in order. `owner_owned_check` is
      not *ask now* — it asks whether the residue is owner-owned per the ownership table, and
      continues under a new strategy epoch if it is not.
      verify: all three appear in `agent-config doctor --json`.

**Exit:** Phase 0 is independent of ADR-268 and unblocks every run. It may land as its own PR
before the record is signed.

## Phase 1 — Test-first, thin

- [ ] **1.1 A thin always-loaded rule over the existing skill.** `src/rules/test-first.md`,
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

## Phase 2 — Tests by someone else

- [ ] **2.1 Independence levels for test authorship.** `evaluator-independence` gains a
      *tests are evaluators* section: L0 the same agent, fallback only; L1 another session on
      the same model; L2 another model; L3 another provider; L4 a multi-provider council or
      team. Critical behaviour — security, authority, data loss, merge control — targets L3 or
      L4 where two providers are configured. The workflow is: acceptance behaviour →
      independent author → RED evidence → implementer → GREEN → independent validator.
      verify: `agent-config council:status` reports the provider count the chosen level
      assumes, and a fixture whose author and implementer share a session id is rejected.
- [ ] **2.2 What an implementer may never do silently.** Weaken an assertion, delete a failing
      test, skip or xfail it, loosen a threshold, or change fixture semantics to fit the code.
      Where the test appears wrong: evidence → independent test review → council or team →
      change only after an independent verdict. The owner is not the arbiter.
      verify: fixture `T2` — an assertion weakened without an independent verdict artefact is
      red.
- [ ] **2.3 Test-quality validation before delivery.** An independent instance answers one
      question: would these tests fail under plausible wrong implementations? It looks for
      tautologies, algorithm duplication, snapshot overuse, missing boundary and error cases,
      over-mocking, expectations changed to fit code, and a test never shown red. The
      validator's identity and provider go into the evidence.
      verify: a fixture test suite that passes against a deliberately broken implementation is
      reported by the validator rather than by a later incident.
- [ ] **2.4 Two CI gates and one hook flag.** `check_test_delta.ts` reds a code change with no
      credible test delta unless the owner set a reason; `check_test_weakening.ts` reds a
      removed or loosened assertion, a skipped test or a lowered threshold with no independent
      verdict artefact; the evidence-independence hook flags a commit touching both `tests/**`
      and the code under test from the same session id. Ratchet entries are measured at this
      pin.
      verify: fixture `G8` code-without-test is red; `G9` test-first across two sessions is
      green; `T2` weakening is red.

## Phase 3 — The forge and CI own correctness

- [ ] **3.1 Name the required layers, in order.** A targeted local RED then GREEN → quality
      scoped to the changed surface → per-phase fast CI → the final full required CI → forge
      branch protection → final-head verification. CI rejects a skipped or disabled check,
      unresolved generated drift, policy-projection drift, a stale-head merge, and a conflict
      resolution that was not revalidated. CI never requires a human approval merely because a
      change is large.
      verify: each layer is named in the delivery contract with the command that runs it, and
      a fixture PR with a disabled required check cannot reach delivery-ready.
- [ ] **3.2 `doctor` reads forge protection from the forge.** A `forge_protection` block —
      default branch protected, required checks present, force-push disabled, auto-merge
      available, deploy only via pipeline — read, never guessed. A missing row becomes a human
      ACTION blocker entry, not a halt.
      verify: `agent-config doctor --json` carries the block and every row's value has a source
      field naming the forge API call it came from.

## Phase 4 — A recovery ladder with strategy epochs

- [ ] **4.1 The bound triggers a strategy change, never a question.** Attempts 1-3 are
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
- [ ] **4.2 Read the red before diagnosing it, with the narrowest probe.** A CI red is read
      with `gh run view --job <id> --log-failed` filtered, never the whole log and never
      `--watch`'s exit code; a local red with the runner filtered to the failing name. The CI
      waiter is `ci_settle`, one waiter per condition.
      verify: `grep -c 'gh pr checks --watch' src/domains/product-basic/roadmap/process-full/command.md`
      returns 0, and the ladder's own text names `ci_settle`.

## Phase 5 — Target sync and conflict recovery

- [ ] **5.1 Sync before every push and before delivery.** Fetch; merge the remote target into
      the task branch; where the target is not the trunk, also merge the trunk per project
      policy — a cascade base, extending the single-hop freshness check; resolve conflicts
      semantically; re-run the affected tests and quality; push; observe the final head's CI.
      verify: fixture `T5` — a target that moved twice during the run is merged in both hops
      and the final head is the one CI observed.
- [ ] **5.2 The four conflict classes become aids, not exhaustive authority.** An unenumerated
      conflict routes: understand both intents → inspect recency, authors and open PRs →
      preserve both where compatible → independent review for a risky merge → council or team
      → owner only for a product-semantic incompatibility. `process-full`'s halt 6 retires
      with the sibling roadmap's halt-table rewrite.
      verify: fixture `T4` — an unknown conflict class is resolved semantically and validated
      independently rather than halting the run.

## Phase 6 — Boy-Scout and adjacent improvement

- [ ] **6.1 What rides along, and what does not.** During a mission the agent may add
      characterisation and regression tests, fix a small adjacent bug, improve naming, types or
      robustness, remove local dead code, simplify code it touched, and improve testability —
      where each is small, local, low blast radius, clearly correct, testable, and carries no
      new product decision. Anything larger becomes a follow-up artefact.
      verify: a fixture run that finds a larger adjacent refactor emits the artefact and leaves
      the code alone.

## Phase 7 — Guardrails for the eleven ops

- [ ] **7.1 Layer them, and measure before enforcing.** Forge protection → the host hook where
      one is bound → a guardrail daemon, sibling of `collector_daemon.ts` under ADR-249's
      supervision contract → model policy as the last layer. The daemon watches the reflog, the
      exposed shell history and the forge event stream for typed ops, stops the host process
      where a kill switch exists, and emits a native ask naming the exact object; after the
      grant it **permits** the op rather than prohibiting it permanently. The observation-only
      floor ships first; enforcement waits behind a measured false-positive rate under 1 % on
      the 30-session corpus.
      verify: the daemon's first shipped mode writes observations and takes no action, and the
      false-positive measurement exists as an artefact before the enforcing mode is enabled.
- [ ] **7.2 A per-host destructive column, measured.** `docs/enforcement-by-host.md` gains
      `destructive:` with values hook, daemon or manual-only, measured per host rather than
      asserted; `non-destructive-by-default`'s `enforced_by:` names the live layer on the
      current host.
      verify: `agent-config hooks:status` and the doc agree for the host the run is on, and no
      row is filled from the registry's all-false default without saying so.
- [ ] **7.3 The council may veto a typed op, never grant one.** Under a mission: a council
      check that the op belongs to the mission → a native ask naming the object → execute. Per
      ADR-257 an unpaid route may propose and score, never decide.
      verify: fixture `T9` — a typed op reaches an exact-object ask after the council check,
      and a council verdict alone never produces the grant.

## Phase 8 — A delivery state machine

- [ ] **8.1 States, and one forbidden ending.** `working → local-green → pushed → pr-open →
      ci-pending → (red → ladder → pushed | green) → target-sync-check → (moved → sync → tests
      → pushed | current) → delivery-ready → (grant → merged | no grant → open-green)`.
      `run_continuation_hook.ts` treats a PR below its delivery target as work remaining, so a
      run cannot end with red CI or a stale target while its checkboxes read complete. The CI
      wait uses the host's background primitive and the run continues with the next independent
      step meanwhile.
      verify: fixture `T7` — a run whose checkboxes are complete but whose CI is red does not
      end; `T8` — the same run without a grant ends open-green and says so.
- [ ] **8.2 One page for the owner's review.** The end-of-run PR body carries: the delivery
      target reached, decisions taken and by whom, open owner-owned residue, the scope delta,
      the spend, and the fix-loop epochs.
      verify: a fixture run's PR body contains all six sections and the grant it spent.

## Phase 9 — Long-run continuity

- [ ] **9.1 Write the record at every boundary, and never re-ask on restore.** The continuity
      record carries the mission id, the roadmap, the phase, completed steps, decision
      references, the authority snapshot including `expires` and `revoked_by`, the target
      branch, the PR, the head SHA, the last CI result, the recovery epoch, the attempt count,
      pending independent reviews and open owner-owned residue. It is written at each phase
      boundary and on stop, pre-compact and session end. On restart it restores, revalidates
      forge state and continues — and never re-asks a closed question. A side task does not
      clear it.
      verify: fixture `T6` — a resume simulation preserves the grant and every decision, and
      the run completes delivery without a repeated question.

## Phase 10 — Council transport and cost

- [ ] **10.1 Pause and report, never ask.** The posture is CLI → CLI quota exhausted → API
      within the ceiling → API over the ceiling → pause and report, naming what needed the
      council, why the CLI was unavailable, the estimated spend, the mission state, and what
      can still proceed. No question about buying more technical API usage. Business spend is
      a typed op and a different category.
      verify: fixture `T10` — an over-ceiling API requirement produces a report and no ask.

## Phase 11 — Authority-changing PRs

- [ ] **11.1 The strictest path, reserved for authority.** An independent test author, an
      independent governance reviewer, a council pass, and a provider-diverse reviewer, plus
      the ratification artefact the sibling roadmap defines. CI verifies that new authority is
      inert before ratification.
      verify: fixture `G15` from the sibling roadmap passes here too — an authority-expanding
      change is inert until the artefact carries `verdict: ratified`.

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
- **Resolved when:** `agent-config doctor --json` reports every `forge_protection` row true on
  this repository.

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

- [ ] AC-1 — `T1`-`T10`, `G8` and `G9` exist under `tests/e2e/` and are green.
- [ ] AC-2 — independent test provenance is recorded per test, and critical tests are at L3 or
      L4 wherever two providers are configured.
- [ ] AC-3 — `check_test_delta` and `check_test_weakening` run in `ci-fast`, and this
      repository is green under them at promotion or ratcheted from a measured baseline.
- [ ] AC-4 — `fix_loop_max` defaults to 10, `grep -rn 'N=3' src/rules` returns 0, and no
      escalation path maps a count to an owner ask.
- [ ] AC-5 — `agent-config doctor --json` reports every `forge_protection` row true on this
      repository.
- [ ] AC-6 — `docs/enforcement-by-host.md`'s `destructive:` column is measured for all eight
      hosts, with every `manual-only` row a recorded decision.
- [ ] AC-7 — a throttled four-phase long-run fixture ends merged, with one continuity resume
      and zero owner asks.
