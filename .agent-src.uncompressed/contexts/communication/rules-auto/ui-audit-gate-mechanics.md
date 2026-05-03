# UI-audit gate — mechanics

Findings-shape spec, failure-mode catalog, and cloud-surface
adaptation for the
[`ui-audit-gate`](../../../rules/ui-audit-gate.md) rule. The Iron
Law, the activation triggers, the allow-list, and the action sequence
when the gate fires live in the rule; this file is the lookup
material when an agent has to verify what counts as findings or
recognise a failure mode.

## What "audit findings" means

`state.ui_audit` is a non-empty dict carrying at least one of:

- `components_found` — `{path, name, kind, similarity?}` inventory
  entries from [`existing-ui-audit`](../../../skills/existing-ui-audit/SKILL.md).
- `greenfield: true` plus `greenfield_decision` ∈
  `{scaffold, bare, external_reference}`.
- Legacy `components` alias — back-compat for the same shape.

`null`, `{}`, or a dict without those keys is **not** findings;
emit `@agent-directive: existing-ui-audit` instead of writing code.

## Failure modes

- Writing the component first and "thinking about reuse later".
- Citing a similar-looking component from memory without verifying
  it via the audit.
- Treating `state.ui_audit = {}` as "audit ran, found nothing" —
  empty dict is rejected on purpose; an audit that finds nothing
  must record either ≥1 `components_found` or the greenfield branch.
- Bypassing the gate for "just one tile".

## Interactions

- [`improve-before-implement`](../../../rules/improve-before-implement.md) — runs
  first when the request is ambiguous; this rule is the next gate.
- [`ask-when-uncertain`](../../../rules/ask-when-uncertain.md) — "just build it"
  does **not** drop the audit; acknowledge, run audit, continue.
- [`directives/ui/audit.py`](../../../templates/scripts/work_engine/directives/ui/audit.py)
  — code-layer twin; this rule covers the cases where the engine
  is not in the loop.
- [`existing-ui-audit`](../../../skills/existing-ui-audit/SKILL.md) — the
  skill that produces the findings.

## Cloud Behavior

On cloud surfaces the engine is not shipped, so `state.ui_audit`
does not exist. The Iron Law still applies: take the visible
inventory of files in conversation context as the audit, and
surface a one-line audit summary in the reply before writing the
component. The gate is satisfied by an explicit summary, not by
silently skipping.
