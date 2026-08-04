---
adr: 214
status: accepted
date: 2026-08-04
decision: package-wide-consistency-sweep
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen the prevention question (rejected consistency-canon registry) when a
  THIRD recurrence of the same drift class lands after this sweep — the council
  held the registry as premature (YAGNI), not wrong; recurrence is the
  evidence that reopens it. Reopen individual cadence/budget decisions only
  with trace evidence of the new semantics misfiring.
---

# ADR-214 — Package-wide consistency sweep: eight cross-artifact contradictions resolved

## Status

**Accepted** · 2026-08-04. Companion to ADR-213 (the extraction-threshold
canon that triggered the sweep).

## Context

Three verified sweeps over `src/rules`, `src/skills`, `src/agent-src`,
`docs/guidelines`, `docs/contracts` found ~20 clusters where two or more
shipped artifacts gave an agent incompatible instructions or diverging
numbers for the same subject. A two-model council (2026-08-04, unanimous on
all eight questions) fixed the designs below. Constraint honored throughout:
the 9 kernel rules were not edited — every fix lands on the non-kernel
counterpart.

## Decisions

1. **Question cadence** — serial is canonical; the boundary is **one
   decision point = one question**: a single numbered-options block
   (even multi-dimensional) is ONE question; multiple separate asks or a
   block needing a structured reply (`1a, 2b`) violate it.
   `user-interaction` § Question pacing now defers to `ask-when-uncertain`
   instead of permitting grouped independent questions;
   `deep-reading-analyst` opens with one composite block;
   `agent-interaction-and-decision-quality` "Max 2 questions" corrected.
2. **Retry budgets are one escalation ladder, not competing caps** —
   2 retries per approach (+ the initial attempt) ARE the three attempts
   of `autonomous-execution` N=3; the 3rd consecutive failure escalates
   rethink → stop-and-ask → fresh session (`context-hygiene`). Canon:
   `autonomy-mechanics § Retry-budget escalation ladder`; cross-referenced
   from `think-before-action-mechanics` and `token-efficiency-mechanics`
   (whose one-strike "Fails → ask" is removed). No artifact may mint a
   fourth budget for the same subject.
3. **Autonomy missing-key fallback is fail-closed** — missing
   `personal.autonomy` → `auto` (matches the shipped default), never `on`;
   the cloud carve-out (whole settings file absent by construction) keeps
   its explicit degrade-to-`on`.
4. **`/commit` cadence is confirm-once-per-plan** — preview path: one
   confirmation for the whole chunk plan; terse path: the invocation IS
   the confirmation (`commit-policy` exception 3). Non-autonomous
   roadmap runs use the same one-shot pre-scan ask, never per-step —
   "NEVER ask about committing" holds regardless of autonomy, as the
   kernel rule states.
5. **`check_reply_consistency` rewritten to its spec** — strict by
   default (missing recommendation = non-zero), per-block recommendation
   with adjacency, multi-block replies with one rec line per block are
   valid (previously a false error).
6. **Duration estimates: mixed policy** — agent-own-work wall-clock
   estimates stripped (deep-reading depth tiers are scope descriptors);
   world-knowledge industry-typical ranges stay WITH a mandatory
   "industry-typical, not a prediction" qualifier (carve-out recorded in
   `asking-and-brevity-examples` § No duration estimates).
7. **Stale hand-written counts** — load-bearing counts rewritten to
   truth; incidental/historical counts converted to "N as-of YYYY-MM"
   phrasing so they age gracefully; measured historical data untouched.
8. **Prevention: bespoke lints, no registry (YAGNI)** — the proposed
   `consistency-canon.yml` registry + generic lint was REJECTED by the
   council as premature after one solved cluster; prevention ships as
   targeted, gate-coverage-registered lints instead:
   `lint_abstraction_thresholds` (ADR-213), `lint_profile_personas`
   (profiles must reference existing persona ids),
   `lint_token_budget_discipline` (the enforcer the rule had claimed but
   which never existed — now built: 15% rich cap + required
   `## Why this skill is rich` section), plus the rewritten
   `check_reply_consistency`. The registry reopens on the review trigger
   above.

## Consequences

- An agent loading any combination of the touched artifacts now receives
  one coherent instruction per subject (cadence, retries, autonomy
  fallback, commit confirmation, durations).
- Four deterministic gates guard the fixed classes; each emits
  `scanned: <N>` and is registered in `gate-coverage.yml`.
- Alignment-only corrections shipped without council arbitration:
  kernel count 10→9 in two contracts, hook state-path and unit claims in
  `context-hygiene`, settings-doc default rows (`rule_loading_tier`,
  `telegraph.speak_scope`, `hooks.*`), size-cap prose aligned to linter
  constants (rule description 190/200, skill lines 400, README 750,
  persona 100/120/140), persona-count claims, six profiles' dangling
  persona ids, `/mode` and `/condense` internal contradictions,
  `/memory:promote` git-op permission gate, k-anonymity floors scoped
  (release ≥ 5 vs anonymity-classification ≥ 50),
  `verbosity.intent_announcements` added to the template so the
  `direct-answers` narration carve-out is reachable.

## Alternatives considered

- **One number everywhere / softening the kernel Iron Laws** — rejected;
  kernel stays untouched, non-kernel sides align to it.
- **Consistency-canon registry now** — rejected (council, unanimous):
  one solved cluster + eight in-flight is not enough pattern evidence to
  design the general mechanism; bespoke lints are cheaper and honest.
- **Rewriting every stale count to truth** — rejected; counts re-rot,
  "as-of" phrasing ages gracefully.

## References

- ADR-213 — the extraction-threshold canon (the sweep's trigger).
- Council session 2026-08-04 (claude-sonnet-4-5 + gpt-4o, round 2, unanimous on Q1–Q8).
- `src/config/gate-coverage.yml` — the four registered prevention gates.
