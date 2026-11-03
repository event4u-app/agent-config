---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: the owner-reserved transition table as data

> **Stub — not active work.** Created 2026-10-31 by
> `road-to-a-loss-that-can-be-appealed` step 4.2.

`resolveTier` in `src/scripts/bracket/tiers.ts` raises a bracket to S4 on an
`ownerReservedRow` signal, which the caller supplies. The table that decides it
lives as prose in `src/rules/decision-revisit-gate.md` § Who decides; no code
reads it, and `decision_trace.ts` reserves `high` for a matrix that does not exist.

**Trigger.** A second consumer needs the owner-reserved test as data, or the owner
asks for it.

**Then.** Render that table from one data file. It edits a kernel rule — own PR,
24 h soak (`scope-control` § Kernel-rule edits).
