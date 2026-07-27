---
type: "auto"
tier: "2a"
description: "Change history done right — audit coverage, cheapest-sufficient tier (default: row-level audit log; event sourcing only by waiver), audit hygiene + privacy interlocks."
triggers:
  - keyword: "audit"
  - keyword: "audit log"
  - keyword: "activity log"
  - keyword: "history"
  - keyword: "event sourcing"
  - keyword: "changelog"
  - phrase: "who changed"
  - phrase: "wer hat was"
  - phrase: "track changes"
  - phrase: "change history"
routes_to:
  - "skill:history-design"
workspaces: [engineering]
packs: [history-discipline]
trust:
  level: professional
---

# History Discipline

Pack floor for the `history-discipline` pack (default-off; auto-activates
when the pack is installed). Agents get history wrong in both directions:
missing entirely on data that needs it, or over-built as event sourcing
where a row-level log suffices — and audit tables that themselves grow
without bound.

## The Iron Law

```
MUTATIONS ON AUDIT-SCOPED DATA EMIT WHO / WHAT / WHEN. ALWAYS.
THE MECHANISM IS THE CHEAPEST SUFFICIENT TIER — DEFAULT: ROW-LEVEL
AUDIT LOG. EVENT SOURCING ONLY WITH AN EXPLICIT ARCHITECTURE WAIVER.
THE AUDIT TABLE OBEYS THE SAME GROWTH BUDGET AS EVERY OTHER TABLE.
AUDIT RECORDS INHERIT THE PRIVACY OBLIGATIONS OF THE DATA THEY DESCRIBE.
A LOSSY AUDIT TRAIL IS WORSE THAN NONE.
```

## Rule surface

- **R-B1 audit-coverage** — mutations on declared audit-scoped models
  emit who/what/when (actor id, diff or event, timestamp, correlation
  id) (F8; checked by `lint_persistence` against the declared scope).
- **R-B2 history-tier-selection** — the tier matrix is normative
  (Tier 0 `updated_by` columns → Tier 1 row-level audit log → Tier 2
  temporal tables → Tier 3 event sourcing). **Default: Tier 1.** Tier 3
  requires an explicit architecture waiver — never upgrade unprompted.
  The matrix and interlock walkthrough live in
  [`history-design`](../skills/history-design/SKILL.md).
- **R-B3 audit-table-hygiene** — audit storage indexed on
  `(auditable_type, auditable_id, created_at)`; JSON diffs, not full-row
  copies, where a diff suffices.
- **R-B4 privacy-interlock** — a GDPR Art. 17 deletion/anonymization path
  must exist for audit records before the mechanism ships.
- **R-B5 reliable-history-interlock** — audit capture is same-transaction
  (Tier-1 default: observer + cheap single insert) OR outbox/afterCommit
  with a durable queue when offloaded — per
  [`scale-discipline`](scale-discipline.md) R-A10/R-A11.

## When NOT to fire

- Git/VCS history questions (that is `git-workflow` territory).
- Retention-duration policy questions ("how long may we keep X") — route
  to `domain-safety-retention`; this rule owns the capture mechanism,
  not the legal floor.

## See also

- [`history-design`](../skills/history-design/SKILL.md) — the tier
  matrix walkthrough + decision artifact.
- [`scale-discipline`](scale-discipline.md) — R-A7 growth budget and
  R-A10/R-A11 reliability primitives this pack builds on.
- [`domain-safety-retention`](domain-safety-retention.md) — jurisdiction
  retention floors the R-A7 policy must respect.
- [`domain-safety-pii`](domain-safety-pii.md) — PII discipline for what
  audit diffs may contain.
