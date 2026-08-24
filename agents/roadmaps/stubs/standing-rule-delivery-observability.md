---
complexity: lightweight
---

# Stub: `check_standing_rule_delivery` cannot observe a rule-body diet

> **Stub — not active work.** Descoped from `agents/roadmaps/archive/road-to-standing-payload-diet.md` AC-5 on
> 2026-08-23, during that roadmap's own execution, because the criterion turned
> out not to be dischargeable by any action available to the run. Full
> measurement:
> `agents/evidence/analysis/standing-payload-diet-per-rule.md` § 3b.

## Why AC-5 was descoped rather than failed or quietly re-scoped

AC-5 read: *"`check_standing_rule_delivery` reads a lower total than the 120,857
recorded in Context, measured on the same machine both times."*

The diet did shorten three rule bodies by **−1,376 exact-BPE tokens**, and the
sibling gate `check_preamble_payload_budget` measured the change as
**137,708 → 136,348 (−1,360)**. But `check_standing_rule_delivery` sums a
different pair of inputs and **neither of them carries the dieted rules**:

- its **global** layer is `~/.claude/rules/` — a snapshot of a past
  `agent-config install`, not generated from any working tree. All three dieted
  rules live there, and the copies there still hold the pre-diet bodies
  (`context-hygiene` 2,470 · `roadmap-progress-sync` 2,479 · and
  `evaluator-independence` 1,580, an older revision again);
- its **project** layer is `<repo>/.claude/rules/`, which IS generated from the
  tree but under ADR-236 carries only the 15 *package-only* rules — none of the
  three.

So the gate becomes able to see the diet only after a `agent-config install`
rewrites the developer's home directory. That is a mutation of an environment
outside this repository and an autonomous run does not make it.

Re-scoping AC-5 onto the sibling gate is the obvious repair and it is a
**criterion weakening**, so it was put to the AI council. The council returned
**INCONCLUSIVE — 0 of 2 members present, quota exhausted (anthropic 53/50,
openai 50/50)**. With no verdict available and no honest way to satisfy the
criterion as written, the criterion was descoped here instead of being marked
satisfied on a number that does not exist.

## What would close this

Three candidates, in ascending order of how much they change:

1. **Measure after a refresh.** Run `agent-config install`, then re-read the gate
   before and after a diet. Cheapest, and the only one that needs no code — but
   it is a per-developer manual step, so it makes the gate's answer depend on how
   recently someone reinstalled.
2. **Give the gate an in-repo mode.** Let it read `dist/agent-src/rules/` as a
   third, deterministic input (opt-in flag, clearly labelled as the projection
   rather than the delivery), so a diet is observable without touching a home
   directory. This is the shape `check_preamble_payload_budget` already has, and
   it is why that gate could observe the change and this one could not.
3. **Commit an `InstructionsLoaded` record** from a real session, which the
   gate's own module docstring already names as the way to make its measurement
   CI-observable. Largest, and it answers a bigger question than this one.

## Resolution — reopen AC-5 or retire it

Whoever picks up this stub decides one of two things, and records which:

- **Reopen** — implement (2) or land (3), then restore AC-5 to
  `road-to-standing-payload-diet` (archived) or to its successor, with the
  before/after readings the criterion asked for.
- **Retire** — record that `check_standing_rule_delivery` is a *delivery* probe
  and `check_preamble_payload_budget` is the *projection* ratchet, that a body
  diet is a projection change, and that asking the delivery probe to observe one
  was a category error in the criterion rather than a gap in the tooling.

The second is the reading this stub's author leans toward, and it is written as a
lean rather than a verdict precisely because it would retire a criterion, which
is the decision the council could not be reached for.
