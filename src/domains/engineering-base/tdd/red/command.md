---
model_tier: medium
name: tdd-red
pack: engineering-base
visibility: internal
cluster: tdd
sub: red
skills: [test-driven-development]
description: TDD red phase — enumerate cases, write ONE failing test, watch it fail for a reason that is about the behaviour under test
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
3. Run it; confirm the failure is **about the behavior under test**. Valid:
   a failing **assertion** · a **missing target** (class-not-found, or a
   compile/type error naming the unimplemented symbol) · a **contract
   failure**. Invalid: a broken **fixture** · a **syntax error** in the test ·
   a missing **unrelated dependency** · a **runner or environment** fault —
   those would fail identically with the behavior fully implemented, so they
   measure nothing. A symbol that does not exist yet can only fail at load;
   demanding an assertion there would force a production stub first, which is
   what this phase exists to prevent. Taxonomy owner:
   [`test-driven-development`](../../../skills/test-driven-development/SKILL.md)
   § What makes a RED valid.
4. Honor the Test-Red Forbidden block: **no production edits** (diff = `tests/**` only).
5. Output: the failing test + its observed failure reason. Hand to `/tdd green`.
