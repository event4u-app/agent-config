# Roadmap: Rule & Guideline Quality Research

> Research-only roadmap. Decide whether (and how) to measure whether **rules**
> and **guidelines** actually fire and are followed — not just whether
> **skills** trigger, which is already covered by
> [`road-to-trigger-evals.md`](road-to-trigger-evals.md).
>
> **No implementation at the end.** Deliverable is a written go/no-go recommendation
> per artifact type and, if go, a scope proposal that then becomes its own
> roadmap.

- **Source discussion:** 2026-04-20 — user asked whether the trigger-evals
  system could be extended to rules and coding guidelines.
- **Status:** Draft, 2026-04-20.
- **Budget:** ≤2 person-days, ≤3 PoC scenarios per artifact type.

## Why this is not just "trigger-evals for rules"

Rules and guidelines activate differently from skills:

| Artifact | Activation | Measurable with trigger-evals? |
|---|---|---|
| Skill | Natural-language match against `description` | ✅ Identical to existing design |
| Rule (auto) | Natural-language match against `description` | ✅ Identical to existing design |
| Rule (always) | Always on, no triggering decision | ❌ Not triggering — **compliance** is the question |
| Command | Exact slash match | ❌ Deterministic, no eval needed |
| Guideline | Referenced from skills/rules, never triggered directly | ❌ Not triggering — **reference usage** is the question |

Three different measurement problems. Before committing to infrastructure, we
need to know which are tractable and which are not.

## What this research produces

A single document `agents/analysis/rule-quality-eval-feasibility.md`
(~200-300 lines) with:

1. **Problem 1 — auto-rule triggering.** Verdict on whether the existing
   `skill_trigger_eval.py` runner (from `road-to-trigger-evals.md`) can be
   reused 1:1 for auto-rules, or whether differences in how the host tool
   surfaces rule activation break the approach.
2. **Problem 2 — always-rule compliance.** Verdict on whether we can
   deterministically measure whether the agent followed a rule, using either
   (a) regex/structural checks on agent output, (b) judge-agent scoring, or
   (c) human-only review. Each approach priced in time, cost, reliability.
3. **Problem 3 — guideline reference usage.** Verdict on whether we can tell
   from agent output that a guideline was consulted (quoted phrasing,
   structural patterns), and whether that signal is strong enough to act on.

Each verdict is **go / no-go / conditional** with the specific condition.

## PoC scenarios

Three artifacts, chosen to be representative — nothing more.

### Problem 1 — one auto-rule: `commit-conventions`

- Trigger queries (5 should-trigger, 5 should-not) — same structure as
  `evals/triggers.json` in `road-to-trigger-evals.md`
- Run once against claude-sonnet via the trigger-evals runner
- Compare precision/recall against the same metrics for a skill baseline

### Problem 2 — one always-rule: `verify-before-complete`

Three scenario dialogues (~20 turns total), each ending at a point where the
agent must decide between:

- PASS: refuse to claim completion without running tests
- FAIL: claim completion anyway

Score by:
- (a) regex match on expected phrasing ("I haven't run", "tests not verified", etc.)
- (b) judge-agent pass/fail prompt, cheapest model
- (c) manual review as ground truth

Report agreement between (a), (b), and (c). If (a) and (b) disagree with (c)
by >30 %, compliance evals are not cheaply automatable — that's the decision.

### Problem 3 — one guideline: `agent-infra/output-patterns.md`

Two scenarios where the guideline prescribes a specific output shape.
Measure whether the agent's output **structurally matches** the guideline
(e.g., produces the documented table format, not prose). Regex-check only,
no judge-agent in PoC.

## Hard bounds

| Dimension | Limit |
|---|---|
| Duration | ≤2 person-days total |
| API spend | ≤$3 across all PoC runs |
| Scenarios per problem | ≤3 |
| Artifacts studied | exactly 1 per problem, 3 total |
| New code | 0 — reuse the trigger-evals runner if it exists, else shell scripts + manual scoring |

If PoC exceeds these bounds, **stop and write up partial findings**.

## Decision gate at end of research

For each of the three problems, output exactly one of:

- **Go** — proceed to a full roadmap (e.g., `road-to-compliance-evals.md`).
  Include a 3-bullet scope preview.
- **No-go** — close with rationale. Do not reopen without new evidence.
- **Conditional** — specify what would flip it to go (e.g., "if claude-haiku
  judge agreement with human scoring ≥90 %, revisit").

Each verdict is one paragraph. No multi-phase planning during research.

## Explicitly out of scope

- Building any runner or new tooling. PoC uses what already exists.
- Measuring more than 3 artifacts total.
- Running against multiple models. One model (Sonnet), one run per scenario.
- Cross-turn conversation tracking beyond the scripted dialogues.
- Deciding which artifacts to measure first in a real rollout — that is the
  next roadmap's job, if any.

## Prerequisites

- [ ] [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 1 PoC
      landed (so we have a runner and one evals/triggers.json to reuse).
- [ ] Branch off main.

## Related

- [`road-to-trigger-evals.md`](road-to-trigger-evals.md) — parent concept,
  covers problem 1 for skills already
- [`road-to-anthropic-alignment.md`](road-to-anthropic-alignment.md) — Phase 2
  (pushy descriptions) feeds the same measurement question for rules
- [`road-to-drafting-protocol.md`](road-to-drafting-protocol.md) — Phase 3
  description-assist would benefit from any rule eval data this produces
- `.agent-src/rules/rule-type-governance.md` — auto vs always classification
  that this research depends on
