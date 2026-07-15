---
model_tier: medium
name: tdd-green
pack: engineering-base
tier: 2
visibility: internal
cluster: tdd
sub: green
skills: [test-driven-development]
description: TDD green phase — write the minimum production code to make the failing test pass; no test edits
argument-hint: "[failing test | context]"
suggestion:
  eligible: true
  trigger_description: "make the failing test pass"
  trigger_context: "a failing test exists, ready to implement"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tdd green

Drives the **Implement** phase of
[`test-driven-development`](../../../skills/test-driven-development/SKILL.md).

## Instructions

1. Write the **minimum** production code to make the failing test pass — no scope beyond the one case.
2. Honor the Implement Forbidden block: **no `tests/**` edits** — changing the assertion to fit the code is the canonical violation; a genuinely-wrong test → STOP and ask, never silently edit.
3. Run the test; confirm green.
4. Output: the green run. Hand to `/tdd refactor` (or `/tdd red` for the next case).
