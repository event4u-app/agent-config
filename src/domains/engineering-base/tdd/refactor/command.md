---
model_tier: medium
name: tdd-refactor
pack: engineering-base
tier: 2
visibility: internal
cluster: tdd
sub: refactor
skills: [test-driven-development]
description: TDD refactor phase — clean up (rename, deduplicate) while keeping the test green
argument-hint: "[target | context]"
suggestion:
  eligible: false
  trigger_description: "refactor while the test stays green"
  trigger_context: "test is green, ready to clean up"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /tdd refactor

Drives the **Refactor** step of
[`test-driven-development`](../../../skills/test-driven-development/SKILL.md).

## Instructions

1. Refactor (rename, deduplicate, extract) ONLY while the test stays green — re-run after each change.
2. If a change reddens the test, revert it; refactoring never changes behavior.
3. Output: the cleaned diff + a final green run. Loop back to `/tdd red` for the next behavior.
