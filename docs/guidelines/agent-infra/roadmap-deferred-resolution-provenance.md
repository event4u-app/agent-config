---
title: Roadmap deferred-item resolution — provenance
description: Why the preservation test routes a preserving disposition to the council and a dropping one to the owner, what it deliberately does not fix, and the two council decisions behind it.
type: guideline
---

# Roadmap deferred-item resolution — provenance

Migrated from [`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md)
§ *Who resolves it — the preservation test* under the P4 pattern
(`road-to-standing-payload-diet` step 1.3). The rule keeps the Iron Law, the
route table, the fail-closed clause and the recorded-or-it-did-not-happen
clause — everything an agent must act on. What moved here is the provenance and
the argument: read once, not on every session.

It lives in its own file rather than in
[`roadmap-progress-mechanics`](roadmap-progress-mechanics.md), which is the
topical home, for a mechanical reason worth stating so the next migration does
not repeat the attempt: that file sits ~134 characters under the 16,000-char
`check_depth_budget` ceiling, so appending this block — or even a stub pointing
at it — turns a green ratchet red. The ceiling is a growth ratchet rather than a
measured quality threshold, and the fix it asks for is a smaller destination,
not a raised baseline.

## The residual hole, stated not papered over

Both authoring seats named it in their own strongest counter: a carried
follow-up can still become an indefinite deferral, so the preservation test
bounds *who decides*, not *whether the work happens*. Only fix-now discharges
it. A carried item untouched at the next task boundary is raised again per
[`active-remediation`](../../../src/rules/active-remediation.md).

## Why the routing changed

Adopted 2026-08-19, unanimous 2/2 council (blind peer review). The prior text —
*"Wait for the user"* — handed back a fully analysed choice carrying four costed
options, which is the low-value interruption
[`no-cheap-questions`](../../../src/rules/no-cheap-questions.md) forbids. The
gate exists to protect the item, not the maintainer's attention; routing a
preserving disposition to the council keeps the protection and drops the
interruption.

## `deferred_policy` provenance

The declared-contract branch that removes the options round without moving the
route is `decision 2026-08-20`, AI council 2/2. It is reversible by
construction: `wait` is the default, so removing the field restores always-wait.
A declared field never moves a row from owner to council — it changes only
*when* the round happens.

## See also

- [`roadmap-progress-sync`](../../../src/rules/roadmap-progress-sync.md) — the live obligation, Iron Law 3 and the route table.
- [`roadmap-progress-mechanics`](roadmap-progress-mechanics.md) — glyph semantics, regen cadence, the deferred-resolution menu.
