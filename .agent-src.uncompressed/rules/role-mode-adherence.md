---
type: "auto"
tier: "2a"
description: "When roles.active_role is set in .agent-settings.yml — closing outputs must match the mode's contract and emit the structured mode marker"
alwaysApply: false
source: package
---

# Role Mode Adherence

Auto-activates when `.agent-settings.yml` sets `roles.active_role` to
one of the six modes defined in
[`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md):
`developer`, `reviewer`, `tester`, `po`, `incident`, `planner`.

Read `roles.active_role` from `.agent-settings.yml` at session start.
Empty or missing → rule is inert. Do NOT guess a mode.

When active, every closing output MUST:

1. Use the contract fields in the declared order. No invented fields.
   Missing evidence → single question (per `ask-when-uncertain`), never
   a fabricated value.
2. End with the structured mode marker:

   ```
   <!-- role-mode: <active_role> | contract: <kebab-case-fields> -->
   ```

3. Refuse work the contract forbids:
   - `reviewer` — NEVER ships implementation; verdict + blockers only.
   - `developer` — NEVER writes a review verdict on own change.
   - `incident` — NEVER expands scope beyond the stated symptom.

   Forbidden work → numbered prompt (per `user-interaction`): switch
   mode, narrow scope, or clear mode.

## Interactions

- `scope-control` — adherence is stricter (mode may forbid work
  scope-control would allow).
- `verify-before-complete` — gate runs BEFORE the mode marker.

## What this rule does NOT do

Infer the mode (Phase-3 router does that). Touch `.agent-settings.yml`
(only `/mode` writes). Change the contracts (guideline is source of truth).

## See also

- [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md)
- [`/mode`](../commands/mode.md)
- [`ask-when-uncertain`](ask-when-uncertain.md)
- [`scope-control`](scope-control.md)
- [`verify-before-complete`](verify-before-complete.md)
