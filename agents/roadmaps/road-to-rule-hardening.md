
# Road to Rule Hardening

**Status:** ready for execution.
**Started:** 2026-05-03
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

### Phase 1 — Self-Check Rule Audit (≤ 1 day)

Inventory every rule in `.agent-src.uncompressed/rules/` and classify
trigger type. Output: a single matrix in `agents/contexts/` with one
row per rule.

- [ ] Enumerate all rules. Baseline: 57 rules in `.augment/rules/`,
      18 contain self-check trigger phrases (`MUST`, `MANDATORY`,
      `pre-send`, `before drafting`, `self-check`, `before every reply`).
- [ ] For each rule, record: trigger event (turn-count / task-start /
      tool-call / output-shape / settings-state), observability
      (agent-only / hook-observable / settings-observable),
      enforcement surface (output / tool-call / state / none).
- [ ] Write `agents/contexts/rule-trigger-matrix.md` with the full
      table plus a short executive summary.
- [ ] Mark rules that are already mechanical (e.g.
      `chat-history-cadence` via heartbeat). They are the precedent.

### Phase 2 — Tier Classification (≤ 1 day)

For each rule the audit flags as soft, assign a Tier (1 / 2 / 3) plus
a one-line justification.

- [ ] Tier 1 candidate list — fully mechanizable today (turn counters,
      settings checks, file-system events). Expected members:
      `context-hygiene`, `onboarding-gate`, `roadmap-progress-sync`.
- [ ] Tier 2 candidate list — needs hook to detect, agent formulates
      the response. Expected members: `model-recommendation`,
      `verify-before-complete`.
- [ ] Tier 3 candidate list — no platform mechanism. Expected members:
      `language-and-tone` pre-send gate, `direct-answers` Iron Laws,
      pre-send rules in general.
- [ ] Per Tier 3 rule, decide disposition: accept-as-soft, convert to
      `/`-command, or deprecate. No new soft rules are introduced.

### Phase 3 — Pilot Hardening (1–2 days)

Pick the highest-value Tier 1 candidate. Build the hook end-to-end on
**one** platform. Prove the pattern carries.

- [ ] Choose pilot rule (open question — see closing prompt).
- [ ] Implement the hook script in `scripts/hooks/` (Python, no
      platform-specific wiring yet).
- [ ] Wire it for one platform (Augment PostToolUse or Claude Code
      Stop, depending on rule type).
- [ ] Verify: trigger fires deterministically, agent cannot suppress
      it, output is human-readable.
- [ ] Document the pattern in `agents/contexts/hardening-pattern.md`
      so Phase 4 has a template.

### Phase 4 — Tier 1 Rollout (2–3 days, gated by Phase 3)

Apply the pilot pattern to the remaining Tier 1 candidates. One PR
per rule, to keep blast radius small.

- [ ] Implement hook for second Tier 1 rule.
- [ ] Implement hook for third Tier 1 rule.
- [ ] Cross-platform extension: each new hook ships with a Claude
      Code variant alongside the Augment one (no Cursor / Cline /
      Windsurf parity yet — that is a downstream concern).
- [ ] Update each rule's body to reference the hook as the primary
      enforcement, with self-check kept only as a fallback note.

### Phase 5 — Tier 2 Nudge Strategy (1–2 days)

Tier 2 needs a hook to detect, but the response is the agent's. The
nudge mechanism is what makes the trigger observable to the agent
mid-flow, without requiring the agent to self-check.

- [ ] Decide nudge surface: PostToolUse marker, session-start preamble,
      or settings-state injection.
- [ ] Prototype on one Tier 2 rule (likely `verify-before-complete`).
- [ ] Measure: does the marker actually change agent behavior on the
      next turn? Outcome verification is the same standard Phase 2 of
      the context-layer-maturity roadmap requires.

### Phase 6 — Tier 3 Disposition (≤ 1 day)

Final pass on the soft-by-construction rules. No new mechanism — only
explicit disposition.

- [ ] For each Tier 3 rule, write the disposition into the rule body
      itself (one line under the Iron Law, if any): "this is a soft
      rule; mechanical enforcement is not feasible because <reason>".
- [ ] Convert any Tier 3 rule with a clear `/`-command equivalent
      into a command (the rule becomes a pointer).
- [ ] Roadmap closure note: hardening is now a class with a known
      ceiling. Future rule-creation reviews must classify the new
      rule into a Tier before merge.

## Acceptance

- `agents/contexts/rule-trigger-matrix.md` exists and covers every
  rule in `.augment/rules/`.
- Every soft rule has a Tier assignment.
- At least three Tier 1 rules have working hooks in production
  (Augment + Claude Code, both).
- The hardening pattern is documented well enough that a new
  Tier 1 rule can be hardened by following the template, no
  architectural decisions required.
- No rule in the safety floor is modified.

## Reference

- Companion roadmap: `road-to-context-layer-maturity.md` (context
  layer is decision-logic surface; this roadmap is the obligation
  surface's enforcement contract).
- Pattern precedent: `chat-history-cadence` heartbeat — the only
  rule that was mechanically hardened from day one.
