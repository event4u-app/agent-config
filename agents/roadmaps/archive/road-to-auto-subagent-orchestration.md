---
complexity: structural
status: ready
---

# Road to automatic subagent orchestration — delegate by default, gated by evidence

> Make the package **automatically use and orchestrate subagents** — an
> orchestrating model delegating sub-tasks to cheaper / faster / quota-separate
> subagents, each carrying the optimal role / profile / persona / knowledge —
> globally toggleable in `.agent-settings.yml`. Built by **activating existing
> surfaces**, instrumented before it is trusted, and flipped to a more
> aggressive default only behind a measured falsification gate.

## Goal

Today subagent use is **purely opt-in**: the `subagent-orchestration` skill (7
modes), `/orchestrate` (YAML pipelines), and the RDP `reasoning-orchestrator`
("dispatch independent subtasks by default") all exist but never fire on their
own. This roadmap turns that latent capability into an **automatic, settings-
gated orchestration layer** that:

1. delegates delegable sub-tasks to subagents without an explicit command,
2. routes each sub-task to the lowest-capable model tier (cost + speed via
   model downshift; quota arbitrage where the host supports it),
3. spawns each subagent with the right role / profile / persona / knowledge,
4. preserves every safety floor (verify-before-complete, the cross-model judge
   Iron Law, non-destructive Hard Floor, the N=3 autonomous budget), and
5. degrades cleanly to single-agent on hosts with no subagent primitive.

The end-state the **user** asked for is *default ON*. This roadmap treats that as
the target, not the starting point: it ships the full toggle and plumbing, keeps
the **initially shipped** default conservative (safe on every host), and flips
the shipped default toward `on` on capable hosts **only** once Phase 6's
benchmark proves a net token/speed win. Reaching default-ON is a gated
milestone, not an unmeasured ship decision.

> **Council-decided (claude-sonnet-4-5 + gpt-4o, deep, 2026-06-23).** The
> verdicts below are resolved, baked in so execution does not re-litigate them.
> Full Convergence + Host verdict at the end of this file; trace
> `agents/runtime/council/responses/auto-subagent-orchestration.json`.
> Both members converged on: **(a)** "default ON" inverts risk → instrument and
> prove first; **(b)** quota arbitrage is a vendor-specific bonus, never
> load-bearing in portable `.md`; **(c)** build on the existing skill + RDP via a
> settings flip, do not fragment a parallel surface; **(d)** task classification
> is the control plane → deterministic/rule-based for v1, ambiguity defaults to
> ask/no-op, never speculative spawn; **(e)** a verification-budget model and a
> host-capability manifest are prerequisites, not follow-ups.

## Context

Grounded in the repo (2026-06-23):

- **`subagent-orchestration` skill** — `src/skills/subagent-orchestration/SKILL.md`.
  7 modes; cross-model judge Iron Law; model pairing from
  `.agent-settings.yml subagents.{implementer_model, judge_model, max_parallel=3}`
  via `src/agent-src/contexts/subagent-configuration.md`. Opt-in only.
- **`reasoning-orchestrator` + RDP gate** —
  `src/skills/reasoning-orchestrator/SKILL.md`,
  `src/agent-src/contexts/execution/rdp-gate.md`. The "gather" link already says
  "dispatch independent subtasks to parallel subagents by default" — but RDP
  engages only on complex tasks and the dispatch is not a standalone auto path.
- **`/orchestrate` + `orchestration-dsl-v1`** —
  `src/domains/meta/orchestrate/command.md`,
  `docs/contracts/orchestration-dsl-v1.md`. Deterministic YAML pipelines with a
  JSONL audit (`audit-log-v1`, counts + ids only).
- **Model-tier system** — vendor-neutral bands `lite | medium | high | inherit`
  in skill/command frontmatter (~414 artefacts); `model.auto_switch:
  suggest|auto|off`. Subagent dispatch is the natural vehicle for model
  downshift because most hosts cannot switch the session model per turn.
- **Config seams for a task-optimal subagent** — profiles (6), role-modes (6),
  business roles (`src/roles/`), personas (24), file-first knowledge ingest.
- **Settings** cascade project → local → user-global; `subagents:` block exists
  (`src/config/agent-settings.template.yml`), read via
  `src/scripts/_lib/agent_settings.ts`. All keys optional + default-safe.
- **Telemetry substrate** — `scripts/telemetry/`, the `artifact-engagement-recording`
  rule, and `audit-log-v1` already exist to extend, not invent.
- **Benchmark substrate** — the `bench:ab` value harness exists to measure
  token/speed deltas on real tasks.

## Constraints (non-negotiable)

- **Multi-tool portability** — Claude Code / Augment / Cursor / Cline / Windsurf /
  Gemini. Only some expose a subagent primitive, with differing spawn APIs.
  `.md` artefacts stay project-agnostic; the layer no-ops cleanly where no
  primitive exists.
- **Frugality canon** — parallel subagents multiply context cost. No lever ships
  on an unmeasured "it saves tokens" claim. Net-positive proven, not assumed.
- **Safety floors stay** — verify-before-complete, cross-model judge Iron Law,
  non-destructive Hard Floor, scope-control, N=3 budget, lethal-trifecta-guard.
- **Source of truth = `src/`** — edit `src/`, condense via `/condense`, never
  hand-edit generated trees.

---

## Phase 0 — Instrumentation & host-capability substrate

> Foundation. Both council members named this the highest-leverage move:
> you cannot trust (let alone default-on) what you cannot measure. No
> user-facing behaviour change.

- [x] Extend `audit-log-v1` (and `scripts/telemetry/`) with orchestration
      metrics per dispatch: task size estimate, spawn count, model tier per
      subagent, token delta vs. single-agent baseline, wall-clock, outcome
      (`DONE`/`DONE_WITH_CONCERNS`/`NEEDS_CONTEXT`/`BLOCKED`/`killed`),
      verification mode. Counts + ids only, no body (preserve the contract).
- [x] Define a **host-capability manifest** schema
      (`{subagent_spawn, parallel_spawn, status_polling, separate_quota_pool}`),
      resolved once per session and cached; sibling to
      `agents/settings/contexts/session-host-capability-audit.md`.
- [x] Add a runtime detector that populates the manifest (build on RDP gate
      signal 3 / `multi-agent-compatibility`), with an explicit
      "unknown → assume no primitive" safe default.
- [x] Document the telemetry keys + manifest fields in a context file so later
      phases read one source of truth.
- [x] Verify: a deterministic unit/script test that the detector returns a
      valid manifest on this host and the audit-log accepts the new keys.

## Phase 1 — Settings + safe activation (deterministic, opt-in)

> Activate the existing surface via settings; do NOT build a parallel
> auto-dispatch surface (council Q4: build-on-existing). Initial shipped
> default stays conservative.

- [x] Extend the `subagents:` block in `agent-settings.template.yml`:
      `enabled: true` (global master switch, default ON per the user's ask),
      `auto: off | ask | on` (initial shipped value `ask` on hosts whose
      manifest reports `subagent_spawn`, `off` otherwise),
      `downshift: true`, `quota_arbitrage: true`, `max_parallel` (existing),
      and a per-tier `model_map`. Every key optional + default-safe; comments
      explain fallback.
- [x] Add the settings read path + a one-line activation context that maps the
      keys to runtime behaviour (mirrors `subagent-configuration.md`).
- [x] Flip `reasoning-orchestrator`/`subagent-orchestration` "dispatch by
      default" from opt-in to **settings-gated** (reads `subagents.auto` +
      manifest), surfacing the chosen mode in one line; under `ask`, ask once
      (per `user-interaction`); under `off` or no primitive, no-op.
- [x] Specify **deterministic, rule-based task classification** for v1: a
      task is delegable only when it declares `parallelizable: steps|files|
      independent` (skill/command frontmatter) **or** matches an enumerated
      structural signal (ordered plan, independent slices) **and** clears a
      task-size floor. Ambiguity → `ask`/no-op, **never** speculative spawn.
      No per-turn LLM meta-call in v1.
- [x] Verify: trigger-style fixtures showing auto-dispatch fires on a declared-
      parallel task and no-ops on a trivial/ambiguous one, on a host with and
      without the primitive.

## Phase 2 — Routing: cost/speed downshift + optional quota arbitrage

> The core value prop must stand on model downshift alone; quota arbitrage is
> a runtime-detected bonus, never load-bearing (council Q2).

- [x] Routing policy: orchestrator stays on the session/high tier; each
      sub-task routes to the **lowest-capable tier** for its declared
      `model_tier`, resolved through the per-tier `model_map`.
- [x] Quota arbitrage as an **optional enhancement** gated on
      `manifest.separate_quota_pool && subagents.quota_arbitrage` — prefer a
      separate-pool model for delegable sub-tasks where the host reports one;
      documented as a Claude-subscription bonus, with identical behaviour
      (minus the quota win) where unsupported.
- [x] No vendor billing assumption in any `.md`; routing reads tiers +
      manifest, never a hard-coded "Sonnet is free" rule.
- [x] Verify: routing fixtures showing tier selection per sub-task and graceful
      identical routing when `separate_quota_pool` is false.

## Phase 3 — Task-optimal subagent configuration

> Compose the existing config seams into the subagent brief.

- [x] Define a **spawn contract** that composes `{role-mode + profile +
      persona + knowledge-slice}` into the subagent's brief from the task +
      active settings (e.g. a review sub-task → reviewer role-mode + the cited
      persona; a sales-draft sub-task → the `sales` role).
- [x] Wire persona/role selection to existing skill-frontmatter citations and
      profile defaults — no new persona/role taxonomy.
- [x] Pass only the **minimal relevant knowledge slice** (lethal-trifecta-guard:
      keep the private-data leg narrow); never bulk-dump context into subagents.
- [x] Verify: a fixture spawning a sub-task shows the resolved role/persona/
      knowledge in the brief and respects the minimal-slice rule.

## Phase 4 — Verification budget model

> Preserve verify-before-complete + the cross-model judge Iron Law without
> double-costing every trivial delegation (council Q5).

- [x] Define the budget: trivial sub-tasks (below a change-size floor,
      read-only / no file writes) → **deterministic verification** (diff +
      dry-run + structural checks, no LLM judge pass); non-trivial → **full
      cross-model judge** per the Iron Law.
- [x] Record the verification mode in the audit-log; a missing verification
      where one was required is a surfaced safety gap, not a silent pass.
- [x] Verify: fixtures for both branches (deterministic-verify trivial,
      full-judge non-trivial) and an audit entry proving the mode taken.

## Phase 5 — Steering, guardrails & kill-switch

> First-class lifecycle + the guardrails that keep "default ON" from becoming a
> token sink (council Q9).

- [x] Lifecycle: dispatch → monitor → status taxonomy → escalate / kill, reusing
      the existing 4-status taxonomy; orchestrator never merges autonomously.
- [x] Bind the N=3 autonomous budget per validation target and the
      `max_parallel` cap to auto-dispatch; no speculative fan-out.
- [x] Document rollback **guardrail thresholds** (token blowup vs. single-agent
      baseline, spawn-failure rate, verification-skip rate, user-override rate)
      as audit-log-surfaced signals the maintainer/user reviews — automatic
      cohort-disable is out of scope (a config package runs no daemon).
- [x] Kill-switch contract: `subagents.enabled: false` (or `auto: off`) is a
      single, no-deploy flip that fully disables the layer; document it as the
      canonical disable.
- [x] Verify: a fixture showing the N=3 budget halting a runaway target and the
      kill-switch fully no-opping the layer.

## Phase 6 — Benchmark & default-flip decision gate

> The falsification gate the whole roadmap is built around. Reaching the
> user's "default ON" is a measured milestone, not an assumption.

- [~] Use the `bench:ab` value harness to measure <!-- deferred: needs a live bench:ab run (API spend on a task corpus) — empirical, user-authorised --> orchestrated vs. single-agent
      on a representative task set: token delta, wall-clock, outcome quality.
      Pin the comparison method (paired, activation-aware) per the existing
      bench mechanics.
- [x] Define the pass gate up front: auto-orchestration ships a more aggressive
      default only if it shows a **net token-or-time win at held quality** on
      the delegable-task subset (e.g. tasks with ≥N independent sub-tasks).
      Honest-null exit allowed — if no win, keep the conservative default and
      document the layer as power-user opt-in.
- [~] On a passing gate: flip the **shipped** default <!-- deferred: gated on the Step-1 benchmark passing; mechanism (resolveShippedDefault) ready, flip is a one-line edit --> for `subagents.auto` to
      `on` on hosts whose manifest reports `subagent_spawn` (off elsewhere) —
      the end-state the user asked for, now evidence-backed.
- [x] Verify: the benchmark report is reproducible and the default-flip is a
      one-line, host-gated settings change.

## Phase 7 — Docs, portability & multi-tool projection

- [x] ADR recording the decisions (build-on-existing, conservative-until-proven
      default, quota-arbitrage-as-bonus, deterministic-classification-v1).
- [x] A contract doc for the spawn contract + host-capability manifest.
- [x] Portability pass: confirm clean no-op + explicit "single-agent on this
      host" surfacing on a host without the primitive; `.md` stays
      project-agnostic.
- [x] Run `/condense` and `task sync` / `task generate-tools` so every projection
      (dist, .augment, .claude, …) regenerates from `src/`.
- [x] Verify: portability + reference linters green; condensation hashes synced.

---

## Deferred (v2+, gated on Phase 6 evidence)

- LLM-based task classification (budgeted, opt-in) — only if deterministic
  classification proves too coarse and the benchmark justifies the meta-call cost.
- Cross-host quota-pool optimisation beyond the single-vendor bonus.
- Automatic cohort-level disable / active monitoring (needs a runtime service
  the package does not have).

## Acceptance criteria

- `.agent-settings.yml` carries a documented `subagents` block with a global
  on/off master and an `auto` mode; every key default-safe.
- The layer is fully driven by settings + host manifest; it no-ops on hosts with
  no subagent primitive and surfaces that explicitly.
- Every auto-delegated task is verified per the budget model; the cross-model
  judge Iron Law holds; no safety floor is bypassed.
- A reproducible benchmark exists; the shipped default reflects its verdict.
- All portability + reference + condensation gates pass.

---

## Council review (2026-06-23)

Deep council (claude-sonnet-4-5 + gpt-4o, design mode, actual cost $0.087).
Both members independently returned a "do not ship as written — invert to
prove-first" verdict and converged on the same six corrections.

### Convergence findings

1. **Default ON inverts risk** — ship `off`/`ask` until a measured net benefit;
   the design's own text concedes auto-spawn may *increase* token spend. ·
   trace: §anthropic Critical Flaw 1, §openai Agreement 1.
2. **Quota arbitrage is a vendor-specific bonus** — fragile billing quirk; must
   not be load-bearing in portable `.md`; core value must stand on model
   downshift alone. · trace: §anthropic Flaw 3.
3. **Build on existing, do not fragment** — activate `subagent-orchestration` +
   RDP "dispatch by default" via a settings flip rather than a new parallel
   auto-dispatch rule. · trace: §anthropic Q4.
4. **Task classification is the control plane** — deterministic/rule-based for
   v1; LLM classification only v2+ and budgeted; ambiguity → ask/no-op, never
   speculative spawn. · trace: §anthropic Flaw 2 / Q6.
5. **Verification-budget model + host-capability manifest are prerequisites** —
   trivial → deterministic verify, non-trivial → full cross-model judge;
   manifest-gated portability with explicit degradation. · trace: §anthropic
   Flaws 4–5.
6. **Instrumentation first + kill-switch with observable thresholds** —
   telemetry before trust; rollback thresholds defined up front. · trace:
   §anthropic Sequencing / Rollback, §openai New Points 2.

### Divergences (no consensus)

- **Pilot shape** — Sonnet wants a 60-day, ≥50-user pilot before any default
  change; GPT-4o agrees on phased + empirical but adds user-communication.
  **Host resolution:** the package has no user-cohort telemetry service, so the
  "pilot" is the Phase 6 `bench:ab` benchmark on a representative task set plus
  this-repo dogfooding — not a formal user cohort.

### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | Default ON inverts risk | `accept-with-modification` | User explicitly asked for default ON; reconciled by shipping the full toggle now, keeping the shipped default conservative, and flipping to `on` (host-gated) only behind Phase 6's evidence gate — the user's goal as a measured milestone. |
| 2 | Quota arbitrage = bonus | `accept` | Matches the portability constraint + source-confidentiality canon; Phase 2 makes it manifest-gated, never load-bearing. |
| 3 | Build on existing | `accept` | The skill + RDP + `subagents:` block already exist; Phase 1 activates them — also satisfies minimal-safe-diff. |
| 4 | Deterministic classification v1 | `accept` | Phase 1 enumerates rule-based signals; LLM classification deferred. |
| 5 | Verify-budget + host manifest as prereqs | `accept` | Phase 0 (manifest) and Phase 4 (verify budget) make them prerequisites, not follow-ups. |
| 6 | Instrument first + kill-switch | `accept-with-modification` | Phase 0 instruments first; rollback thresholds become audit-surfaced guardrails (no automatic cohort-disable — a config package runs no daemon). |

### Predecessor council trace

`agents/runtime/council/responses/auto-subagent-orchestration.json` (this run).

<!-- Deferred items migrated to agents/roadmaps/road-to-auto-subagent-orchestration-followup.md on 2026-06-23 -->
