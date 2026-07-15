---
model_tier: medium
name: tdd
disable-model-invocation: true
argument-hint: "[red|green|refactor] [behavior | args]"
pack: engineering-base
tier: 2
visibility: internal
description: TDD orchestrator — routes to red (failing test), green (minimum code), refactor (clean while green)
cluster: tdd
type: orchestrator
auto_detect: true
suggestion:
  eligible: true
  trigger_description: "write the failing test first, make the test pass, refactor while green"
  trigger_context: "user is driving a change test-first and names a TDD phase"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tdd

Thin ergonomic split over the [`test-driven-development`](../../skills/test-driven-development/SKILL.md)
skill — one sub-command per phase of that skill's mode contract. **No logic
lives here**; each sub loads the skill and drives its named phase.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/tdd red` | `commands/tdd/red.md` | Design → Test-Red: enumerate cases, write ONE failing test, watch it fail at an assertion |
| `/tdd green` | `commands/tdd/green.md` | Implement: write the minimum code to pass; no test edits |
| `/tdd refactor` | `commands/tdd/refactor.md` | Refactor: clean up while the test stays green |

## Dispatch

1. Parse `/tdd <sub> [args]`. Explicit sub → route. Otherwise infer the phase
   from observable state via the skill's mode-inference table (no test yet →
   red; test failing at an assertion → green; green + defect → red again).
2. Load [`test-driven-development`](../../skills/test-driven-development/SKILL.md)
   and drive ONLY the named phase, honoring that phase's Forbidden block.
3. LOW confidence / bare `/tdd` → show the three-row menu and ask.

## Rules

- **One phase per turn.** Do NOT chain red→green→refactor silently — each sub is one turn.
- **No logic duplication.** The behavior is the skill's; these commands only select the phase.
- **Do NOT commit or push.**
