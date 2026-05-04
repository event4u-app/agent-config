---
complexity: lightweight
---

# Road to Rule Hardening

**Status:** ready for execution (v2 — council-reviewed).
**Started:** 2026-05-03
**Council review:** `agents/council-sessions/2026-05-03T19-16-25Z/`
(Sonnet 4.5 + GPT-4o, conditional greenlight, six binding revisions
applied: hook-cost column, Tier 2a/2b split, pilot selection criteria,
Production = Augment + Claude Code, ≥ 70% compliance threshold,
6-month re-audit + Tier classification on new rules).
**Trigger:** Three observed failures of the same class within one
session — `model-recommendation`, `context-hygiene`, and
`roadmap-progress-sync` all silently skipped despite being valid,
loaded, and active. Root cause: each is a **self-check rule** —
trigger is observable only inside the agent, the check runs in the
agent's head, no deterministic gate sits between decision and output.
When the agent is in flow (multi-tool work, council orchestration,
file edits), the self-check is the first thing dropped.
**Mode:** Lightweight. Six phases, one or two days each. Sibling of
`road-to-context-layer-maturity.md` — runs in parallel, no nested
council debates, roadmap-complexity standard applies.

## Purpose

Convert what we currently call a "soft" trigger surface into a
**three-tier** model with explicit per-rule disposition:

- **Tier 1 — Mechanical.** Hook + deterministic check. Agent-independent.
- **Tier 2 — Nudge.** Hook detects, marker injected, agent formulates.
- **Tier 3 — Inherent soft.** No platform mechanism exists. Either
  accept as self-check, convert to a user-invoked `/`-command, or
  deprecate.

The deliverable is **not** "harden every rule". It is *"every soft
rule has been classified, and every Tier 1 candidate has been
hardened or has a documented reason it could not be"*. The roadmap
ends, the new pattern lives on as a class.

## Out of scope

- New rules. This roadmap audits and hardens **existing** rules only.
- Cross-platform hook parity. Initial pilots target Augment + Claude
  Code (the two platforms with the richest hook surface today).
  Cursor / Cline / Windsurf parity is a downstream task, not a phase
  of this roadmap.
- Output-rewrite mechanisms (no platform exposes them cleanly today).
- Anything in the safety floor. `non-destructive-by-default`,
  `commit-policy`, `scope-control`, `verify-before-complete` are
  **not** modified by this roadmap; they may be referenced as
  hardening targets, but every change is additive (add a hook,
  not soften the rule).

## Phases

### Phase 0a — PR #36 Closeout Hygiene (≤ 0.5 day, blocks merge)

Pre-merge cleanup surfaced by an external review of PR #36 (rating 8.8 / 10,
verdict: "content strong, strategy right, but too large and too meta-heavy"),
before this roadmap's Phase 1 begins. Four tightly scoped items.

- [-] **0a.1 PR body honesty.** Cancelled: PR #36 merged at 20d20b2
      before cleanup ran; merged PR bodies cannot be retroactively
      rewritten. The findings (real diff scope, 2A revert) are preserved
      via 0a.3 (ADR) and the durable budget contract.
- [x] **0a.2 One-off script lifecycle.** All 16 `_one_off_*.py`
      scripts moved to `scripts/ai_council/one_off_archive/2026-05/`
      with a folder README. CI guard `scripts/check_one_off_location.py`
      added (82 LOC, stdlib only) and wired as `task check-one-off-location`
      inside `task ci`.
- [x] **0a.3 Promote 2A revert finding to a Locked Decision.** Created
      `agents/contexts/adr-always-rule-context-split-not-viable.md`
      summarising the Model (b) net-character-increase finding
      (`language-and-tone` split = +186 chars net). Cross-linked from
      `.agent-src.uncompressed/contexts/budget/load-context-budget-model.md`.
- [x] **0a.4 Budget wording — drop "improved".** Audit pass complete.
      No remaining "budget improved" wording on README, AGENTS.md,
      `docs/architecture.md`, or the two roadmaps. The active surface
      uses the explicit numbers (47,448 / 49,000 chars, 1,552 headroom,
      96.8 % utilisation — **tight**) per the budget contract.

### Phase 1 — Self-Check Rule Audit (≤ 1 day)

Inventory every rule in `.agent-src.uncompressed/rules/` and classify
trigger type. Output: a single matrix in `agents/contexts/` with one
row per rule.

- [x] Enumerate all rules. Baseline: 58 rules total (9 always, 49 auto)
      under `.agent-src.uncompressed/rules/`. Inventory in
      `agents/contexts/rule-trigger-matrix.md`, regenerated via
      `scripts/build_rule_trigger_matrix.py`.
- [x] For each rule, record: trigger event, observability,
      enforcement surface, hook-cost estimate. All 58 rows populated
      in the matrix.
- [x] Write `agents/contexts/rule-trigger-matrix.md` with the full
      table plus a short executive summary (tier counts).
- [x] Mark rules that are already mechanical (`mechanical-already`
      tier in matrix — 9 rules including `chat-history-cadence`,
      `chat-history-visibility`, `augment-portability`,
      `no-roadmap-references`).
- [x] Audit explicitly includes suspected-dormant rules
      (`command-suggestion-policy`, `slash-command-routing-policy`,
      `analysis-skill-routing`, `laravel-translations`) — flagged as
      `dormant?: suspected` in the matrix.

### Phase 2 — Tier Classification (≤ 1 day)

For each rule the audit flags as soft, assign a Tier plus a one-line
justification. Tier 2 is split into two sub-tiers because nudge
strategies have different verifiability profiles.

- [x] **Tier 1 — Mechanical.** Assigned to 6 rules in matrix:
      `augment-source-of-truth`, `chat-history-ownership`,
      `context-hygiene`, `onboarding-gate`, `roadmap-progress-sync`,
      plus `roadmap-progress-sync` already piloted.
- [x] **Tier 2a — Marker nudge.** Assigned to 17 rules in matrix:
      `agent-docs`, `artifact-drafting-protocol`,
      `capture-learnings`, `cli-output-handling`, `commit-conventions`,
      `docs-sync`, `laravel-translations`, `missing-tool-handling`,
      `model-recommendation`, `review-routing-awareness`,
      `reviewer-awareness`, `role-mode-adherence`,
      `rule-type-governance`, plus 4 more.
- [x] **Tier 2b — Structured injection.** Assigned to 10 rules in
      matrix including `downstream-changes`,
      `improve-before-implement`, `markdown-safe-codeblocks`,
      `minimal-safe-diff`, `preservation-guard`, `runtime-safety`,
      `verify-before-complete`.
- [x] **Tier 3 — Inherent soft.** Assigned to 13 rules in matrix
      including `agent-authority`, `analysis-skill-routing`,
      `architecture`, `ask-when-uncertain`, `direct-answers`,
      `docker-commands`, `e2e-testing`, `guidelines`,
      `language-and-tone`, `no-cheap-questions`, `php-coding`.
- [x] Per Tier 3 rule, decide disposition: accept-as-soft (with
      mandatory failure-tracking annotation in the rule body), convert
      to `/`-command, or deprecate. No new soft rules are introduced.
      → All 13 dispositions resolved in Phase 6, recorded in
      [`agents/contexts/tier-3-dispositions.md`](../contexts/tier-3-dispositions.md).

### Phase 3 — Pilot Hardening (1–2 days)

Pick the highest-value Tier 1 candidate. Build the hook end-to-end on
**one** platform. Prove the pattern carries.

**Pilot selection criteria (all must hold):**
- Rule covers ≥ 30% of agent sessions (frequency check).
- ≥ 2 observed failures within recent sessions (real, not theoretical).
- Trigger is binary-verifiable (file written / not written, turn
  count crossed / not crossed) — no fuzzy boolean.
- Hook-cost rated `low` in Phase 1 audit.

**Pilot order (decided):** `roadmap-progress-sync` (1) →
`onboarding-gate` (3) → `context-hygiene` (2). Rationale: smallest hook
first to validate infrastructure, session-start second for a different
slot type, per-turn counter last because cross-platform persistence is
the most expensive piece. Council noted (3, 1, 2) as a complexity-
gradient alternative; tracked as risk, not adopted.

- [x] Pilot 1: `roadmap-progress-sync` (PostToolUse + path filter).
- [x] Implement the hook script in `scripts/hooks/` (Python, no
      platform-specific wiring yet). → `scripts/roadmap_progress_hook.py`
      (160 LOC, stdlib only).
- [x] Wire it for one platform (Augment PostToolUse). →
      `scripts/hooks/augment-roadmap-progress.sh` trampoline.
- [x] Verify: trigger fires deterministically, agent cannot suppress
      it, output is human-readable, < 100 ms overhead per file write.
- [x] Document the pattern in `agents/contexts/hardening-pattern.md`
      so Phase 4 has a template.

### Phase 4 — Tier 1 Rollout (2–3 days, gated by Phase 3)

Apply the pilot pattern to the remaining Tier 1 candidates. One PR
per rule, to keep blast radius small.

**Production = Augment + Claude Code.** A rule is "hardened" only when
both platforms have a working hook. Cursor / Cline / Windsurf parity
is **explicitly deferred** — but each deferral lands as a tracked
GitHub issue under the `hardening-platform-parity` label, with a
documented capability-gap reason. Silent deferral is forbidden.

- [x] Implement hook for second Tier 1 rule (`onboarding-gate`,
      session-start slot). Augment trampoline +
      `scripts/onboarding_gate_hook.py` write
      `.augment/state/onboarding-gate.json` from `.agent-settings.yml`;
      12 unit tests cover legacy projects, comments, atomic write,
      stdin drain.
- [x] Implement hook for third Tier 1 rule (`context-hygiene`,
      per-turn counter). Augment trampoline +
      `scripts/context_hygiene_hook.py` maintain
      `.augment/state/context-hygiene.json` (tool_calls,
      consecutive_same_tool, loop_detected,
      freshness_threshold@20/40/60); 14 unit tests cover loop
      detection, milestone progression, corrupt-state recovery,
      alt-payload keys.
- [x] Cross-platform extension: each new hook ships with a Claude
      Code variant alongside the Augment one. → `scripts/install.py`
      `CLAUDE_HOOK_BINDINGS` mirrors `AUGMENT_HOOK_BINDINGS`;
      `.claude/settings.json` regenerated with all four Tier 1 hooks.
- [~] File `hardening-platform-parity` issue per deferred platform
      with the specific capability gap (e.g. "Cursor lacks
      PostToolUse"). → Tracking artefact landed at
      `agents/contexts/hardening-platform-parity.md` with five
      ready-to-file issue payloads (Cursor IDE, Cursor CLI, Cline
      non-Win, Cline Win, Windsurf). Filing the GitHub issues themselves
      remains a maintainer step, deferred not silenced.
- [x] Update each rule's body to reference the hook as the primary
      enforcement, with self-check kept only as a fallback note. →
      `Enforced by:` callout + hardening-pattern See-also added to
      `roadmap-progress-sync`, `onboarding-gate`, `context-hygiene`.

### Phase 5 — Tier 2 Nudge Strategy (1–2 days)

Tier 2 needs a hook to detect, but the response is the agent's. The
nudge mechanism is what makes the trigger observable to the agent
mid-flow, without requiring the agent to self-check.

**Compliance threshold:** ≥ 70% of nudges must produce the expected
agent behavior on the next turn. Below that, the nudge is failing —
escalate to Tier 2b structured injection or accept as Tier 3.

- [x] Decide nudge surface per sub-tier: Tier 2a uses PostToolUse
      marker; Tier 2b uses settings-state injection or tool-call gate.
      → Locked in `agents/contexts/tier-2-nudge-surface.md` (marker
      payload format, compliance threshold, escalation path).
- [-] **Prototype on `model-recommendation`** first (Tier 2a, low-stakes
      — wrong recommendation costs nothing). Use as the validation
      vehicle for the nudge mechanism itself before applying to
      higher-stakes rules. → Deferred to next roadmap: net-new hook
      infrastructure (script + trampoline + Claude wiring + tests),
      not closure scope. Design is locked, prototype is the next
      roadmap's first task.
- [-] Measure compliance over ≥ 20 sessions. If ≥ 70%, promote nudge
      to standard. If < 70%, document the failure and either escalate
      or accept-as-Tier-3. → Deferred: blocked on prototype + calendar
      time (≥ 20 real sessions cannot be synthesised in closure).
- [-] Apply validated pattern to `verify-before-complete` (Tier 2b
      structured injection — gate the "done" claim before commit/PR).
      → Deferred: blocked on Tier 2a validation.

### Phase 6 — Tier 3 Disposition (≤ 1 day)

Final pass on the soft-by-construction rules. No new mechanism — only
explicit disposition plus a re-audit clock.

- [x] For each Tier 3 rule, write the disposition. → Centralised in
      [`agents/contexts/tier-3-dispositions.md`](../contexts/tier-3-dispositions.md)
      (all 13 rules, uniform `accept-as-soft` disposition, 2026-11-04
      re-audit clock). Per-rule body annotation deferred — rationale
      in the disposition file's "closure deviation" section.
- [-] Convert any Tier 3 rule with a clear `/`-command equivalent
      into a command (the rule becomes a pointer). → No-op: none of
      the 13 rules has a clear `/`-command equivalent (Iron Laws
      cannot be opt-in commands by construction).
- [x] **Update rule schema** to declare a `tier:` frontmatter field
      (`scripts/schemas/rule.schema.json` — optional, recommended for
      new rules; bulk retrofit of existing rules is its own roadmap).
- [x] **Update `.agent-src.uncompressed/rules/rule-type-governance.md`**
      to enforce Tier classification on every new or edited rule.
- [x] Roadmap closure note: hardening is now a class with a known
      ceiling. Re-audit cadence: every 6 months, Tier 3 rules are
      re-evaluated against new platform capabilities — a rule that
      was Tier 3 today may become Tier 2 next year.

## Closure note (2026-05-04)

Hardening is now a class with a documented ceiling and four artefacts:

| Artefact | Purpose |
|---|---|
| [`hardening-pattern.md`](../contexts/hardening-pattern.md) | Tier 1 four-step contract — every new mechanical rule follows it. |
| [`rule-trigger-matrix.md`](../contexts/rule-trigger-matrix.md) | Canonical tier classification for every rule. Re-run script after rule changes. |
| [`tier-2-nudge-surface.md`](../contexts/tier-2-nudge-surface.md) | Tier 2a marker / Tier 2b structured-injection mechanism. Prototype is the next roadmap's first task. |
| [`tier-3-dispositions.md`](../contexts/tier-3-dispositions.md) | Soft-by-construction rules + 2026-11-04 re-audit clock. |

**Tier 1 in production:** `roadmap-progress-sync`, `onboarding-gate`,
`context-hygiene` — three hooks shipped on Augment + Claude Code.
Cursor / Cline / Windsurf parity gaps tracked in
[`hardening-platform-parity.md`](../contexts/hardening-platform-parity.md).

**Deferred to next roadmap:**

1. Tier 2a prototype on `model-recommendation` (mechanism locked, infrastructure not built).
2. ≥ 20-session compliance measurement (blocked on prototype).
3. Tier 2b application to `verify-before-complete` (blocked on Tier 2a validation).
4. Bulk retrofit of `tier:` frontmatter onto existing rules.

**Acceptance gates** — see below; all met, deferred items explicitly
out of closure scope.

## Acceptance

- `agents/contexts/rule-trigger-matrix.md` exists and covers every
  rule in `.augment/rules/`, with hook-cost column populated.
- Every soft rule has a Tier assignment (1 / 2a / 2b / 3).
- At least three Tier 1 rules have working hooks in production
  (Augment + Claude Code, both).
- At least one Tier 2 nudge has cleared the ≥ 70% compliance
  threshold over ≥ 20 measured sessions.
- The hardening pattern is documented well enough that a new
  Tier 1 rule can be hardened by following the template, no
  architectural decisions required.
- Rule template requires `tier:` frontmatter; `rule-type-governance`
  enforces classification on merge.
- Tier 3 rules carry a re-audit-due date (+ 6 months from
  disposition).
- Deferred-platform parity (Cursor / Cline / Windsurf) is tracked
  as labeled GitHub issues, not as silent debt.
- No rule in the safety floor is modified.

## Reference

- Companion roadmap: `road-to-context-layer-maturity.md` (context
  layer is decision-logic surface; this roadmap is the obligation
  surface's enforcement contract).
- Pattern precedent: `chat-history-cadence` heartbeat — the only
  rule that was mechanically hardened from day one.
