---
model_tier: medium
name: tdd-red
pack: engineering-base
tier: 2
visibility: internal
cluster: tdd
sub: red
skills: [test-driven-development]
description: TDD red phase — enumerate cases, write ONE failing test, watch it fail at an assertion (not an import error)
argument-hint: "[behavior to test]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tdd red

Drives the **Design → Test-Red** phases of
[`test-driven-development`](../../../skills/test-driven-development/SKILL.md).

## Instructions

1. State the behavior in one sentence; enumerate the cases (happy / boundary / error).
2. Write ONE failing test for the first case.
3. Run it; confirm it fails at an **assertion**, not an import/collection error.
4. Honor the Test-Red Forbidden block: **no production edits** (diff = `tests/**` only).
5. Output: the failing test + its observed failure reason. Hand to `/tdd green`.
