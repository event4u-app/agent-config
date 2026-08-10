---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to token-economy — dispatch: the always-on stack stops paying the full harness price per spawn

> **Source:** consumed inbox `agents/tmp.old/fix-token-problem.txt`
> (maintainer analysis session 2026-08-10, token-burn diagnosis of
> 9.28.0/9.29.0 + #1235; claims re-verified against the tree 2026-08-10
> during inbox analysis). Diagnosis: the 9.28/9.29 carriers
> (delegation-nudge on `user_prompt_submit`, end-review-nudge on `stop`,
> self-repair, council-availability) plus the #1235 always-on doctrine
> multiply the number of sessions per task — and every spawned session pays
> the full always-loaded layer (`dist/agent-src/rules/` = 115 files /
> ≈409 KB at HEAD per `git ls-tree`, eager, no runtime router consumer).
> The burn is doctrine-intended (more dispatches, more reviews); the
> per-spawn fixed cost is not. This roadmap attacks the fixed cost and
> makes it a registered number, not a vibe.
>
> **Prior art #1, do not relitigate:** `road-to-cache-economy` (archived,
> all criteria closed 2026-07-30) already MEASURED the per-spawn floor on
> this repo's own 14-day traffic: median cold start **235.5k tokens
> written-or-uncached per subagent leg**, cold starts = 69.7% of subagent
> write volume (C-1 confirmed), the always-loaded rule set ≈88k tokens per
> spawn, and C-3 preamble reducibility **confirmed at 38%**
> (fixture-conditional). Its refusal list is promoted to
> `agents/settings/contexts/cache-economy-refusals.md` and BINDS this
> roadmap: no cache-hit-driven auto-tuning, no blanket 1h TTL, no
> interception proxy, no worktree practice changes for cache reasons.
> Phase 1 below re-anchors on those numbers as the baseline instead of
> re-estimating; what cache-economy did NOT build is the ongoing per-role
> `init_tokens`/`work_tokens` telemetry and every reduction lever — that is
> this roadmap's job.
>
> **Prior art #2, do not relitigate:** `road-to-lean-agent-init` (archived,
> shipped 2026-07-28) measured the 12.5× lookup-agent waste and concluded
> the cost mass was *in-run agentic exploration, not init payload* — and
> shipped L0 tool-not-agent routing plus the `rules_carried`/`rules_used`
> per-worker audit fields. That conclusion was correct **for a serial
> world**. #1235 changes the multiplier: when the ladder dispatches
> rung-1/2 workers plus an end-review reviewer as the *default* path, init
> payload scales with spawn count and becomes a first-order term again
> (cache-economy's C-1 verdict is the measured confirmation). All three
> diagnoses are true; this roadmap is the payload-side complement.
>
> **Prior art #3 — projection:** `later/road-to-request-scoped-rule-load`
> (34/36 done, parked; resume gated on `road-to-rule-delivery-integrity`
> P2.1) owns REQUEST-scoped rule projection and the rules-as-skills
> falsification probe. Phase 3 here is ROLE-scoped (worker vs orchestrator)
> and reuses the same thin-projection machinery
> (`src/scripts/project_thin_rules.ts`); it does not touch that roadmap's
> parked probe or pre-empt its resume trigger.
>
> **External survey (anonymised per source-confidentiality; mapping stays
> in the local session note):** Source J (swarm-orchestration suite for the
> same host) documents the identical failure in its own agent memory: a
> full harness spawn has a measured floor of ~43k input tokens / ~$0.26
> before any work, vs. a single gateway completion at ~$0.0001 — its
> doctrine is a strict ask/delegate split ("when in doubt, ask"). Source J
> additionally keeps heavy payloads out of prompts via an on-disk
> blackboard and routes trivial edits below the model entirely. Host docs
> (verified via public guidance 2026-08-10, consistent with the
> cache-economy doc sweep 2026-07-30): a subagent definition honours
> `tools` + `model`; a fork-style spawn reuses the parent's prompt cache on
> its first request while a fresh spawn holds a separate cache — the
> fork-vs-subagent ORDERING rule already shipped in cache-economy Phase 4
> ("ordering, not default"); `CLAUDE_CODE_SUBAGENT_MODEL` exists as a
> session-wide model ceiling for subagents.

## Goal

A rung-1/2 worker or an end-review reviewer starts with an
execution-scoped context instead of the orchestrator's full layer, cheap
questions resolve below the spawn boundary entirely, and "fixed cost per
dispatch" is a registered metric with kill/tighten criteria — so the
always-on doctrine keeps its dispatches while the per-dispatch floor drops
from "full harness" (measured median: 235.5k tokens cold start) to "what
this role provably uses". Falsifiability moves with it: if the thin worker
context measurably degrades worker correctness, that is a publishable
result and the projection widens by evidence, not by fear.

## Prerequisites

- [x] #1235 merged to main (2026-08-09, judgment ladder, transport
      reconciliation, registered always-on metrics) — the ladder is the
      routing surface this roadmap extends downward. 13 open boxes remain
      in `road-to-always-on-orchestration.md` (non-goals + acceptance
      verification); implementer confirms none blocks the ladder surface.
- [x] `orchestration_record` (F6) live on `post_tool_use` — the telemetry
      carrier Phase 1 consumes (`src/scripts/_lib/orchestration_record.ts`
      exists; implementer verifies the hook binding fires on this host via
      `agent-config hooks:status`). <!-- verified 2026-08-10: manifest binds
      orchestration-record on post_tool_use for augment/claude/cowork/cursor;
      this repo's project-level .claude/settings.json is absent but the
      user-global install carries the chains (hooks demonstrably fire) -->
- [x] `rules_carried`/`rules_used` audit fields (lean-agent-init) still
      emitted on worker envelopes — implementer verifies the fields survive
      the #1235 reader migration before Phase 1 cites them. <!-- verified
      2026-08-10: _lib/orchestration_record.ts:97-100 validates + emits both;
      CLI flags --rules-carried/--rules-used; doc rows in
      orchestration-telemetry.md -->

## Context (verified against tree 2026-08-10 during inbox analysis, do not relitigate)

- **The hook manifest is platform-keyed only.** `src/scripts/hook_manifest.yaml`
  keys are `schema_version`/`concerns`/`platforms`/`native_event_aliases`;
  no role axis exists. A worker session on `claude` therefore runs the
  orchestrator's full `user_prompt_submit` chain including
  delegation-nudge — a concern whose verdicts the recursive-dispatch guard
  (#1235 step 2.3) resolves to ∅ for lineage anyway. The guard proves
  lineage detection exists; the chain just doesn't consume it.
- **The always-loaded layer grew and multiplies.** `dist/agent-src/rules/`
  at HEAD: 115 files, ≈409 KB (`git ls-tree -r -l`). Two new always-loaded
  rules landed in 9.28/9.29 (`self-repair-loop.md`,
  `council-availability.md`) and ship to every session *including every
  worker*. Cache-economy's byte census attributes ≈88k tokens per spawn to
  this layer.
- **Thin-projection machinery exists** (−82 % rule-layer benchmark on
  record; `src/scripts/project_thin_rules.ts`) but is applied globally, not
  per session role. The execution context split (`contexts/execution/`) is
  the natural worker projection candidate — implementer verifies its
  coverage against what rung-1/2 workers actually invoked (Phase 1 data)
  before committing the cut line.
- **A sub-spawn cheap path half-exists.**
  `src/scripts/ai_council/transport_resolver.ts` resolves cli → api → ∅
  for council members; nothing exposes a single-completion primitive to
  the judgment ladder. Rung 0 routes to deterministic scripts; rung 1
  jumps straight to a full spawn. The gap between them is where Source J's
  ~2500× cost ratio lives.
- **The cheapest-sufficient-model table is committed** (#1235 step 2.4,
  in the delegation-policy context) but is advisory prose to the
  orchestrator; no worker/reviewer definition pins `model:` and no
  `CLAUDE_CODE_SUBAGENT_MODEL` ceiling is set by any wrapper.
- **CHECKPOINT envelopes exist for worker recycling**
  (`road-to-worker-generation-recycling`, later/, Phases 0-1 shipped
  PR #1228); nothing constrains a worker's *result* channel — full
  transcript-shaped output can flow back into the orchestrator context,
  refunding the isolation win.
- **`road-to-deferred-rule-retriever` stays gated in `later/`.** Its gate
  (2c) demands telemetry of rules carried-but-unused; Phase 1 of this
  roadmap produces exactly that datum as a side effect. This roadmap does
  NOT build retrieval — it feeds the gate honestly and lets that roadmap's
  own conditions decide.

## What the survey contributes (verdicts, anonymised)

| Idea | Source | Verdict |
|---|---|---|
| Strict ask/delegate split with a measured per-spawn floor cited in doctrine | J | KEEP → Phase 4 (rung 0.5) + Phase 1 (re-anchor our own measured floor first) |
| Blackboard/artifact-on-disk: heavy payloads never ride the prompt | J | KEEP → Phase 6 (envelope-only return channel) |
| Below-model routing for trivial edits (WASM tier) | J | CUT — rung 0 already routes mechanical slices to deterministic scripts; a sandbox runtime solves a problem we do not have |
| Worker/researcher on small model, implementer inherits main model, env ceiling as backstop | host guidance | KEEP → Phase 5 |
| Fork-spawn prompt-cache reuse for same-context work | host guidance | PARTIALLY SHIPPED — cache-economy Phase 4 shipped the fork-vs-subagent ordering rule from doc verification; the LIVE two-arm probe stays a blocker before any stronger doctrine |
| Shared persistent swarm memory substrate | J | CUT — anchored codebase memory exists; a second memory substrate is a YAGNI violation |

## Phase 1 — measure the floor before touching it

- [x] 1.1 Extend the `orchestration_record` line (additive, schema-versioned)
      with `init_tokens` (context size at first worker turn) and
      `work_tokens` (delta to envelope close) — provenance-tagged like the
      existing token delta; hook-carried, never model-carried. Source the
      counts from the transcript-usage lib
      (`src/scripts/_lib/cc_transcript.ts`, `billable_input` semantics,
      message.id+requestId dedupe) — never from `input_tokens` alone.
      <!-- verify: npx vitest run orchestration_record -->
      <!-- done 2026-08-10: init_tokens PRE-EXISTED (lean-init); added
      work_tokens + floor_provenance to _lib/orchestration_record.ts, CLI
      flags, doc rows; 47 tests green -->
- [x] 1.2 REGISTER metric `dispatch_floor`: median `init_tokens` per role
      (worker, reviewer) and ratio `init_tokens / work_tokens`. Baseline is
      cache-economy's 2026-07-30 census (median cold start 235.5k; C-1
      69.7%), re-run on the post-9.29 tree. Committed threshold before new
      data exists: a sustained median ratio > 1 for rung-1 workers means
      the projection (Phase 3) is mandatory, not optional; a ratio < 0.15
      after Phase 3 ships is the success criterion.
      <!-- done 2026-08-10: src/config/dispatch-economy-metrics.json +
      src/scripts/dispatch_economy_report.ts. Ratio is COST-shaped
      (weightedInputUnits: read 0.1x, write 1.25x/2x) — raw billable ratio is
      unmeetable by construction (measured 0.02 on legs whose weighted ratio
      is 0.21). First live reading (14d window, includes pre-9.29 sessions):
      median init 251.0k (baseline 235.5k — the floor GREW), weighted ratio
      0.21, single-run projection-mandatory signal false -->
- [x] 1.3 REGISTER metric `rules_efficiency`: `rules_used / rules_carried`
      per worker envelope (fields from lean-agent-init). Sustained low quota
      is simultaneously (a) the cut-line evidence for Phase 3 and (b) the
      demand-signal datum `road-to-deferred-rule-retriever` gate (2c) asks
      for — one measurement, two consumers, recorded in both roadmaps.
      <!-- done 2026-08-10: registered in dispatch-economy-metrics.json
      (low-quota bar 0.2); producer note added to
      later/road-to-deferred-rule-retriever.md gate (2c). Live reading:
      0 envelopes carry the pair yet — data accumulates from real
      dispatches -->
- [x] 1.4 Honest-null path written down: if the re-measured floor on the
      post-9.29 tree is materially smaller than the cache-economy census,
      phases 3–5 downgrade to blockers citing the null, and the null is
      publishable in `docs/benchmark.md`.

**Exit:** the per-spawn fixed cost is a number with a role breakdown and registered thresholds; the build/no-build decision for every later phase cites it.
**Rollback:** additive telemetry fields; revert is a schema-version step back.

## Phase 2 — a role axis in the hook manifest

- [x] 2.1 `hook_manifest.yaml` gains a second key axis: `role:
      orchestrator | worker` (default `orchestrator` — every existing chain
      is byte-identical under the default; a missing role key changes
      nothing). The generator and registry-parity tests extend to the new
      axis. <!-- verify: npx vitest run hook_manifest -->
      <!-- done 2026-08-10: top-level roles: block (worker.drop);
      _role_drop_set + role param in _resolve_concerns (dispatch_hook.ts);
      byte-identity under default pinned in hook_role_axis.test.ts across
      every platform x event; host config unchanged (role is a RUNTIME
      branch in the dispatcher, not an install-time split) -->
- [x] 2.2 The dispatch wrapper marks worker spawns (env var
      `AGENT_CONFIG_SESSION_ROLE=worker`; the recursive-dispatch guard's
      lineage detection is the shared implementation — one detector, two
      consumers, test-pinned equal). <!-- done 2026-08-10: shared detector
      _lib/session_role.ts consumed by dispatch_hook (chain resolution) AND
      delegation_nudge_hook (feeds the ladder's caller-supplied
      insideSubagentSession) — import-pinned in hook_role_axis.test.ts.
      Marked spawn point: council CLI transport (clients.ts
      _runSubprocess). SCOPE per live probe (see blocker): Agent-tool
      subagents cannot be marked on this host -->
- [x] 2.3 Worker chains drop orchestrator-only concerns: delegation-nudge,
      end-review-nudge, council-availability, team-review-gate, self-repair
      intake (complaints route via the orchestrator; a worker never talks to
      the user). Safety-floor hooks (block-no-verify, block-unauthorized-git,
      evidence-independence, kernel-write blocks, injection-scan) stay on
      EVERY role — the manifest diff must show zero pre_tool_use guard
      removals, CI-checked. <!-- done 2026-08-10: pre_tool_use is
      structurally undroppable (_role_drop_set returns empty for that slot)
      AND lint_hook_manifest._check_roles fails the build on a drop entry
      bound to any platform's pre_tool_use (red-on-fixture test in
      hook_role_axis.test.ts); live dry-run shows worker user_prompt_submit
      9->7 concerns, stop drops end-review-nudge + team-review-gate,
      pre_tool_use byte-identical -->
- [x] 2.4 Fail-open discipline unchanged: an unset or unknown role resolves
      to the full orchestrator chain — the thin path is the opt-in of the
      marked spawn, never the accident of a missing variable. <!-- done
      2026-08-10: unset/empty/unknown -> orchestrator (resolveSessionRole);
      known role without manifest entry -> full chain; both test-pinned -->

**Exit:** a marked worker session runs a visibly shorter chain; an unmarked session is byte-identical to today; no guard hook lost anywhere.
**Rollback:** delete the role key; default-axis behaviour is the old behaviour.

## Phase 3 — worker thin projection, cut where the data says

- [~] 3.1 Role-marked worker spawns load the execution projection
      (`contexts/execution/` + the rule subset Phase 1.3 shows workers
      actually use) instead of the full layer, via the existing
      thin-projection machinery (`project_thin_rules.ts`). Cut line
      committed as a manifest (reviewable, diffable), derived from ≥2 weeks
      of `rules_used` data — never hand-feel. <!-- deferred 2026-08-10:
      data-window-gated by the roadmap's own contract (Risk 7) — the
      rules_efficiency metric went live today with 0 envelopes; the cut
      line needs >= 2 weeks of accumulation. Additionally host-scoped by
      the worker-chain-host-delivery probe: the projection binds on
      CLI-spawned sessions -->
- [~] 3.2 The reviewer role gets its own projection (review contexts +
      safety floors); reviewer spawns from end-review-nudge are marked
      `role: reviewer` by the same wrapper mechanism. <!-- deferred
      2026-08-10: end-review reviewer spawns are Agent-tool spawns, which
      the live probe showed cannot be env-marked on this host; the
      `reviewer` enum value is reserved (session_role.ts) and fail-open
      (full chain until a roles.reviewer manifest entry exists). Builds
      with 3.1's window or a host per-spawn identity surface -->
- [~] 3.3 Escape hatch, envelope-carried: a worker that hits a wall
      (`needs_context: <rule-id>`) records the miss in its CHECKPOINT
      envelope; the orchestrator may re-dispatch with the widened
      projection. Misses are telemetry (`projection_miss` lines) and feed
      the cut-line review — the projection widens by recorded evidence.
      <!-- deferred 2026-08-10: builds WITH 3.1 — an escape hatch before
      any projection exists has nothing to escape from -->
- [x] 3.4 REGISTER kill criterion: if worker verify-fail rate on projected
      sessions exceeds the pre-projection baseline by a committed margin
      over the review window, the projection reverts for that rung and the
      regression is published. <!-- done 2026-08-10: projection_quality in
      dispatch-economy-metrics.json (kill margin +5pp over 2-week window),
      registered BEFORE any projection exists -->

**Exit:** `dispatch_floor` for rung-1 workers drops measurably (target from 1.2); worker correctness is monitored against a baseline, not assumed.
**Rollback:** role resolves to full layer (2.4 path); the manifest is one revert.

## Phase 4 — rung 0.5: ask, don't spawn

- [x] 4.1 A single-completion primitive (`ask_transport.ts`) wraps the
      reconciled transport chain (#1235 Phase 3): one prompt, one answer, no
      harness, no session, honest-∅ when no transport resolves. CLI-first
      billing classification applies unchanged.
      <!-- verify: npx vitest run ask_transport -->
      <!-- done 2026-08-10: src/scripts/ask_transport.ts — reuses
      council_cli.load_settings + build_members (transport chain + billing
      unchanged); hard caps: one completion, no tools, no retry; exit 3 =
      honest-null; every ask appends a route_taken=ask telemetry line
      (spawn_count 0, origin dispatch-economy-2026) -->
- [x] 4.2 The judgment ladder gains rung 0.5 between deterministic scripts
      and the first spawn: single bounded *question* (classification, small
      verification, one-file semantic lookup that the code-graph null left
      uncovered) resolves to ask, not spawn. Signals with the same
      regex-only discipline as the F3-lite extractor; ambiguity still
      resolves ∅/in-session — never a speculative ask that grows into a
      hidden agent loop (hard cap: one completion, no tool use, no retry
      beyond the transport chain's own). <!-- done 2026-08-10:
      LadderRung gains 0.5; detectBoundedQuestion (regex-only, ambiguity
      falls through) resolves in the below-floor branch. DESIGN NOTE from
      test evidence: questions naming files/paths/repo objects are
      EXCLUDED (a completion without tools cannot read them), and the
      halt + recursive guard win over 0.5 -->
- [x] 4.3 The delegation-nudge line can cite rung 0.5 ("rung-0.5: ask, est.
      <1k tokens") so the carrier stops nudging full spawns for
      question-shaped slices. <!-- done 2026-08-10: buildNudgeLine carries
      the rung-0.5 ask citation (spawn floor ~251k cited); the CARRIER
      itself stays silent on user question prompts — the agent answers
      in-session at zero marginal cost, and injecting there would be the
      measured cosmetic-injection failure (24/29). Guarantee delivered:
      a question-shaped prompt can never produce a spawn nudge
      (test-pinned) -->
- [x] 4.4 REGISTER metric: ask-vs-spawn substitution rate + ask answer
      adoption rate; kill criterion: if asks are measurably re-asked or
      escalated to spawns > committed threshold, the rung's signals tighten
      or the rung dies — by evidence, in a PR. <!-- done 2026-08-10:
      ask_economy in dispatch-economy-metrics.json (escalation kill 0.3);
      dispatch_economy_report gained the ask section (lines/adopted/
      escalated + kill signal) -->

**Exit:** question-shaped slices have a sub-spawn path whose cost is two orders of magnitude below the floor; its precision is a registered number.
**Rollback:** the rung resolves to rung 1 (today's behaviour); the resolver sits behind the existing ladder interface.

## Phase 5 — model tiering stops being advisory

- [ ] 5.1 Worker and reviewer definitions pin `model:` per the committed
      cheapest-sufficient-model table (research/lookup roles → small model;
      implementing roles inherit the main model; the table's escalation
      criteria are the override path). The table stays the single source;
      definitions cite it.
- [ ] 5.2 The dispatch wrapper may set the host's subagent model ceiling
      (`CLAUDE_CODE_SUBAGENT_MODEL`) only as an explicit per-install
      setting (class-C, default absent) — a ceiling is a spend cap, which is
      exactly the settings class the always-on doctrine keeps.
- [ ] 5.3 The end-review reviewer runs on the table's review tier by
      default; a reviewer that escalates records the criterion it invoked in
      the review artifact.

**Exit:** the reviewer that fires after nearly every mutating session no longer bills at main-model rates by default; every escalation names its reason.
**Rollback:** remove `model:` pins; host default resumes.

## Phase 6 — the envelope is the only return channel

- [ ] 6.1 Worker results land on disk (runtime artifact dir, gitignored);
      the CHECKPOINT envelope carries path + verdict + the bounded summary —
      committed max envelope size, lint-checked in the envelope validator.
      <!-- verify: npx vitest run envelope -->
- [ ] 6.2 The orchestrator's dispatch skill instructs result consumption
      from the artifact path on demand, never wholesale transcript
      ingestion; the subagent-orchestration skill's examples update to the
      envelope-only shape.
- [ ] 6.3 REGISTER metric: orchestrator context growth per dispatch
      (pre/post-turn delta at the dispatch tool-use, hook-carried). The
      isolation win refunded through the return channel is the failure this
      number exists to catch.

**Exit:** dispatching N workers grows the orchestrator context by N envelopes, not N transcripts.
**Rollback:** envelope size lint relaxes; skill prose reverts.

## Phase 7 — what this roadmap will not do

- [ ] 7.1 No rule-retrieval engine — `road-to-deferred-rule-retriever` keeps
      its own gates; this roadmap only feeds gate (2c) with honest data.
- [ ] 7.2 No second memory substrate, no blackboard beyond the existing
      anchored codebase memory + on-disk artifacts (Source J's swarm memory
      solves a multi-machine problem this suite measurably does not have).
- [ ] 7.3 No nudge removal and no threshold change by hand-feel — the
      end-review 50-line threshold (`MUTATION_LINE_THRESHOLD`,
      `end_review_nudge_hook.ts:224`) and delegation-nudge trigger set
      calibrate ONLY against their own registered telemetry
      (`review_skipped` distribution, dispatch-per-verdict rate), in the
      always-on roadmap's Phase 6 frame, not here.
- [ ] 7.4 No fork-spawn doctrine beyond the shipped ordering rule before
      live verification — see blocker.
- [ ] 7.5 No compression/summarisation pipeline for rule prose — the cut
      (Phase 3) is selection, not paraphrase; paraphrased rules are
      unverifiable against their source and violate source-level
      verification culture.
- [ ] 7.6 Nothing from the cache-economy refusal list re-enters
      (`agents/settings/contexts/cache-economy-refusals.md`): no cache-hit
      auto-tuning, no blanket 1h TTL, no interception proxy, no worktree
      cache guidance.

## Blockers

### blocker: fork-spawn-cache-verification

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any strengthening of the shipped fork-vs-subagent ordering
  rule into a "prefer fork" DEFAULT
- **What to do:** host_semantics discipline — public guidance (doc-verified
  in cache-economy Phase 4, which shipped the rule as "ordering, not
  default") says a fork reuses the parent's prompt cache on its first
  request while a fresh spawn holds a separate cache; this repo has never
  observed it live. Run a two-arm live probe (fork vs fresh, identical
  task, token accounting from the transcript ledger via `cc_transcript.ts`),
  record both numbers.
- **Resolved when:** the probe note exists; doctrine cites it or the null
  (no measurable difference) is published and the ordering rule stays as-is.

### blocker: worker-chain-host-delivery

- **Status:** resolved (2026-08-10, live probe on claude/CC — this session)
- **Owner:** maintainer
- **Blocks:** (was) Phase 2 shipping as more than manifest prose
- **Probe result:** (a) An Agent-tool subagent's tool env is NOT
  distinguishable from the parent's: `CLAUDE_CODE_CHILD_SESSION=1` appears
  in BOTH (it marks the tool child process, not the session), and
  `CLAUDE_CODE_SESSION_ID` carries the PARENT id inside the subagent — no
  per-spawn env marking is possible on this host, and no observed
  discriminator exists (the judgment ladder's caller-supplied stance
  stands). (b) A subagent leg creates NO own dispatcher feedback-dir
  session (462 dirs before == after; newest = parent session) — subagent
  sessions have no own session_start/user_prompt_submit/stop slots.
  (c) Consequence, exactly the pre-registered cut: the role axis binds
  where the suite launches a separate CLI session itself — today the
  council CLI transport (`clients.ts`), which pays the full chain in every
  member session and is now marked `worker`. Agent-tool spawns keep the
  full chain until the host offers per-spawn identity (upstream
  NOT_PLANNED).
- **Resolved when:** ~~a probe transcript shows which slots fire in a worker
  session, and Phase 2's step list cites it.~~ Met — steps 2.2/2.3 cite the
  probe; contract section: hook-architecture-v1.md § roles axis.

### blocker: reviewer-tier-quality-floor

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 5.3 default-shipping (reviewer on small tier)
- **What to do:** before the reviewer downshifts by default, run a bounded
  comparison on real review tasks from the `review_skipped`-driven reviewer
  dispatches: small-tier vs main-model verdict agreement + missed-defect
  count. Pre-registered null: "small tier misses materially more" is
  publishable and pins the reviewer to the main model with the evidence
  attached.
- **Resolved when:** the comparison note exists and 5.3's default cites it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Thin projection blinds workers to a rule they needed | product | A worker without the relevant discipline rule produces confident wrong work — the cost moves from tokens to correctness | Cut line derived from measured `rules_used`, never hand-picked (3.1); envelope-carried `needs_context` escape hatch with `projection_miss` telemetry (3.3); registered verify-fail kill criterion with baseline (3.4) | Phase 3 |
| 2 | Rung 0.5 becomes a hidden agent loop | implementation | An "ask" that retries, chains, or grows tool use recreates the spawn cost without the spawn's accounting | Hard cap one completion / no tools / no retry (4.2); substitution + adoption metrics with a kill criterion (4.4) | Phase 4 |
| 3 | Role marking fails open into permanent full-cost | implementation | If the env var never reaches worker sessions, every phase-2/3 win silently evaporates while the roadmap claims it | `worker-chain-host-delivery` blocker gates the phase on live probe evidence; `dispatch_floor` (1.2) is the ongoing detector — a floor that doesn't move is a red number, not silence | Phase 2 |
| 4 | Safety-floor hooks dropped from worker chains by accident | product | A chain diff that removes a guard turns economy work into a security regression | 2.3's CI check: zero pre_tool_use guard removals on any role axis; registry-parity tests extend to the role axis (2.1) | Phase 2 |
| 5 | Small-tier reviewer waves defects through | product | The end-review carrier's value is neutral review; a cheap reviewer that misses defects is worse than no nudge (false assurance) | `reviewer-tier-quality-floor` blocker: agreement comparison with pre-registered null before the default flips (5.3) | Phase 5 |
| 6 | Envelope cap truncates load-bearing findings | product | A bounded summary that silently drops the one critical detail converts token savings into rework | Cap is lint-visible, never silent truncation (never-silent discipline); the artifact path carries the full result; 6.3's context-growth metric catches the opposite failure | Phase 6 |
| 7 | Measurement phase stalls and the fixes ship unfounded | process | Pressure to fix the burn now invites skipping Phase 1 and committing cut lines by feel | Phase ordering is the roadmap's contract: 3.1 hard-requires the data window; the honest-null path (1.4) makes "the floor is fine" a legitimate, publishable exit | Phase 1 |

## Acceptance criteria

- [ ] `dispatch_floor` and `rules_efficiency` are registered metrics with
      committed thresholds, emitting from live dispatches, with at least one
      review-window verdict recorded (including the honest-null path).
- [ ] A role-marked worker session on a live host demonstrably runs the
      worker chain (probe transcript on record), and an unmarked session is
      byte-identical to the pre-roadmap chain.
- [ ] A rung-1 worker dispatched post-Phase-3 shows median `init_tokens`
      reduced against the Phase-1 baseline by the registered target, with
      verify-fail rate inside the registered margin.
- [ ] A question-shaped slice resolves to rung 0.5 end-to-end (ladder
      verdict → ask transport → adopted answer) at the measured sub-spawn
      cost, with substitution telemetry accumulating.
- [ ] The end-review reviewer's default tier decision cites the
      `reviewer-tier-quality-floor` comparison note — whichever way it went.
- [ ] Dispatching a two-worker rung-2 task grows the orchestrator context
      by two envelopes within the committed cap (6.3 metric on record).
- [ ] No pre_tool_use guard is absent from any role chain (CI check green,
      red on a fixture removing one).
- [ ] Nothing on the cache-economy refusal list was rebuilt (anti-dump
      check: grep the diff for proxy/TTL/auto-tuning mechanisms → zero).
