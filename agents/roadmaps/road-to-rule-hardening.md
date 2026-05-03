
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

- [ ] **0a.1 PR body honesty.** Update PR #36 description. Replace the
      original "33 commits / Phase 0+1+2 narrative" with the actual diff
      scope (structural optimization foundation + regression gates +
      command surface reduction). Quote the real GitHub stats (file count,
      line delta) instead of the planning narrative.
- [ ] **0a.2 One-off script lifecycle.** Move the 14 existing
      `scripts/ai_council/_one_off_*.py` scripts to
      `scripts/ai_council/one_off_archive/2026-05/`. Add a CI guard
      (`scripts/check_one_off_location.py` or extend `check_portability.py`)
      that fails when a new `_one_off_*.py` lands outside
      `one_off_archive/`. Wire it into `task ci`.
- [ ] **0a.3 Promote 2A revert finding to a Locked Decision.** Create
      `agents/contexts/adr-always-rule-context-split-not-viable.md`
      summarising: under Model (b) accounting, splitting an Always-rule
      into rule + `load_context:` produces a net character increase due
      to context-frontmatter + citation overhead (empirical: `language-and-tone`
      split = +186 chars net). Cross-link from
      `.agent-src.uncompressed/contexts/budget/load-context-budget-model.md`.
      Closes the institutional-knowledge gap: prevents the next attempt.
- [ ] **0a.4 Budget wording — drop "improved".** Replace any "budget
      improved" / "budget headroom improved" wording on the active surface
      with the explicit number: Always-rule extended budget at
      47,448 / 49,000 chars (1,552 chars headroom, 96.8 % utilisation —
      **tight**, not "improved"). One pass over PR-body, README hero
      section, and the two anchor lines in `road-to-context-layer-maturity.md`.

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
      enforcement surface (output / tool-call / state / none),
      **hook-cost estimate** (low / medium / high — engineering effort
      to mechanise across Augment + Claude Code).
- [ ] Write `agents/contexts/rule-trigger-matrix.md` with the full
      table plus a short executive summary.
- [ ] Mark rules that are already mechanical (e.g.
      `chat-history-cadence` via heartbeat). They are the precedent.
- [ ] Audit must explicitly include rules that have **never** observably
      fired (suspected dormant: `command-suggestion-policy`, `slash-command-routing-policy`,
      `analysis-skill-routing`). Absence of failures ≠ healthy trigger.

### Phase 2 — Tier Classification (≤ 1 day)

For each rule the audit flags as soft, assign a Tier plus a one-line
justification. Tier 2 is split into two sub-tiers because nudge
strategies have different verifiability profiles.

- [ ] **Tier 1 — Mechanical.** Hook + deterministic check, agent-
      independent. Fully mechanizable today (turn counters, settings
      checks, file-system events). Expected members: `context-hygiene`,
      `onboarding-gate`, `roadmap-progress-sync`.
- [ ] **Tier 2a — Marker nudge.** Hook detects, marker injected into
      the agent's context, agent formulates the response. Verification
      is best-effort (the agent may still ignore the marker). Expected
      members: `model-recommendation`, `capture-learnings`.
- [ ] **Tier 2b — Structured injection.** Hook detects, structured
      payload injected (settings flag, tool-call gate). Verifiable
      because the structured field is observable post-hoc. Expected
      members: `verify-before-complete` (gate before commit/PR claim).
- [ ] **Tier 3 — Inherent soft.** No platform mechanism exists.
      Expected members: `language-and-tone` pre-send gate,
      `direct-answers` Iron Laws, pre-send rules in general.
- [ ] Per Tier 3 rule, decide disposition: accept-as-soft (with
      mandatory failure-tracking annotation in the rule body), convert
      to `/`-command, or deprecate. No new soft rules are introduced.

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

- [ ] Pilot 1: `roadmap-progress-sync` (PostToolUse + path filter).
- [ ] Implement the hook script in `scripts/hooks/` (Python, no
      platform-specific wiring yet).
- [ ] Wire it for one platform (Augment PostToolUse).
- [ ] Verify: trigger fires deterministically, agent cannot suppress
      it, output is human-readable, < 100 ms overhead per file write.
- [ ] Document the pattern in `agents/contexts/hardening-pattern.md`
      so Phase 4 has a template.

### Phase 4 — Tier 1 Rollout (2–3 days, gated by Phase 3)

Apply the pilot pattern to the remaining Tier 1 candidates. One PR
per rule, to keep blast radius small.

**Production = Augment + Claude Code.** A rule is "hardened" only when
both platforms have a working hook. Cursor / Cline / Windsurf parity
is **explicitly deferred** — but each deferral lands as a tracked
GitHub issue under the `hardening-platform-parity` label, with a
documented capability-gap reason. Silent deferral is forbidden.

- [ ] Implement hook for second Tier 1 rule (`onboarding-gate`,
      session-start slot).
- [ ] Implement hook for third Tier 1 rule (`context-hygiene`,
      per-turn counter).
- [ ] Cross-platform extension: each new hook ships with a Claude
      Code variant alongside the Augment one.
- [ ] File `hardening-platform-parity` issue per deferred platform
      with the specific capability gap (e.g. "Cursor lacks
      PostToolUse").
- [ ] Update each rule's body to reference the hook as the primary
      enforcement, with self-check kept only as a fallback note.

### Phase 5 — Tier 2 Nudge Strategy (1–2 days)

Tier 2 needs a hook to detect, but the response is the agent's. The
nudge mechanism is what makes the trigger observable to the agent
mid-flow, without requiring the agent to self-check.

**Compliance threshold:** ≥ 70% of nudges must produce the expected
agent behavior on the next turn. Below that, the nudge is failing —
escalate to Tier 2b structured injection or accept as Tier 3.

- [ ] Decide nudge surface per sub-tier: Tier 2a uses PostToolUse
      marker; Tier 2b uses settings-state injection or tool-call gate.
- [ ] **Prototype on `model-recommendation`** first (Tier 2a, low-stakes
      — wrong recommendation costs nothing). Use as the validation
      vehicle for the nudge mechanism itself before applying to
      higher-stakes rules.
- [ ] Measure compliance over ≥ 20 sessions. If ≥ 70%, promote nudge
      to standard. If < 70%, document the failure and either escalate
      or accept-as-Tier-3.
- [ ] Apply validated pattern to `verify-before-complete` (Tier 2b
      structured injection — gate the "done" claim before commit/PR).

### Phase 6 — Tier 3 Disposition (≤ 1 day)

Final pass on the soft-by-construction rules. No new mechanism — only
explicit disposition plus a re-audit clock.

- [ ] For each Tier 3 rule, write the disposition into the rule body
      itself (one line under the Iron Law, if any): "this is a soft
      rule; mechanical enforcement is not feasible because <reason>;
      re-audit due <date+6 months>".
- [ ] Convert any Tier 3 rule with a clear `/`-command equivalent
      into a command (the rule becomes a pointer).
- [ ] **Update `.agent-src.uncompressed/templates/rule.md`** to require
      a `tier:` frontmatter field. New rules cannot merge without
      Tier classification.
- [ ] **Update `.agent-src.uncompressed/rules/rule-type-governance.md`**
      to enforce Tier classification on every new or edited rule.
- [ ] Roadmap closure note: hardening is now a class with a known
      ceiling. Re-audit cadence: every 6 months, Tier 3 rules are
      re-evaluated against new platform capabilities — a rule that
      was Tier 3 today may become Tier 2 next year.

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
