# Feedback Consumption — Design

Addresses **Gap 2** from `agents/roadmaps/product-maturity.md`: feedback is collected
but never consumed — invisible to users and agent alike.

## Principle

Feedback is **stored by default**, **consumed on request**. Never auto-injected into
agent context. Any change triggered by feedback requires **human approval**.

> Feedback → suggestion → human approval → change.
> Never: feedback → automatic change.

## Consumer matrix

Canonical mapping per cost profile:

| Consumer | `minimal` | `balanced` | `full` |
|---|---|---|---|
| CI pipeline (PR comment) | On PRs only | On PRs only | On PRs only |
| Skill linter (warnings) | Always (dev only) | Always (dev only) | Always (dev only) |
| `task report-stdout` | On request | On request | On request |
| Agent reads feedback | ❌ | On explicit request | On explicit request |
| Suggestions in chat | ❌ | ❌ | ✅ |
| Pattern auto-injection | ❌ | ❌ | ❌ (opt-in via override only) |

## Governing matrix key

`feedback_suggestions_in_chat` — documented in `.augment/templates/agent-settings.md`.
- `minimal`, `balanced` → `false` (silent)
- `full` → `true` (visible)
- Always overridable explicitly in `.agent-settings`.

## What files exist

| File | Purpose | Created when |
|---|---|---|
| `feedback.json` | Execution outcomes, failure patterns | `balanced`+ |
| `metrics.json` | Skill usage, timing, health | `full`+ |
| `tool-audit.json` | Tool execution log | `full`+ |

In `minimal`, none of these are created. User sees **zero** new files after install.

## Agent access rules

1. Agent MUST NOT auto-load feedback files into context, regardless of profile.
2. On **explicit request** (`show me recent failures`, `what went wrong last time`),
   agent reads the file and summarizes. Summary only — never full file into context.
3. On `cost_profile=full`, agent MAY proactively reference feedback in suggestions
   (e.g. "this skill failed 3 times last week — consider reviewing").
4. All suggestions surface to the user. The user decides whether to act.

## What feedback is **not** for

- **Not** for modifying skills or rules automatically.
- **Not** for ranking skills in selection (skills are chosen by description/scope).
- **Not** for blocking actions (e.g. "this failed before, refusing").
- **Not** for training data.

## Implementation tasks mapped

| Roadmap task | Implementation |
|---|---|
| Define feedback consumption rules per profile | Matrix above + `feedback_suggestions_in_chat` |
| `minimal` + `balanced`: feedback stored, never auto-injected | Agent rule + profile matrix |
| `full`: feedback on request + suggestions in chat | Matrix above + documented in skill `feedback-review` (future) |
| Pattern auto-injection: explicit opt-in via override | Handled by explicit `.agent-settings` override — no separate tier |
| Document: "feedback.json exists for CI and reports, not for the agent by default" | This document + README "What you get" section |

## Open questions

- Should feedback influence skill **discovery** (listing available skills)? **No** —
  discovery is deterministic, based on skill descriptions.
- Should feedback influence skill **selection**? **No** — agent picks by fit, not by
  historical success rate. Historical success is reported, not enforced.
- Should we add a dedicated skill for reviewing past feedback? **Maybe** — if users
  repeatedly ask "what failed last week", a skill formalizes the pattern. Defer until
  demand is observed.

## Related

- `agents/docs/vanilla-vs-governed.md` — what profile differences users actually notice.
- `agents/docs/observability-scoping.md` — which consumers are user vs developer.
- `agents/docs/runtime-visibility.md` — how runtime surfaces its activity.
