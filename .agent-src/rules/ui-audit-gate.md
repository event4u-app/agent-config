---
type: "auto"
description: "Writing or editing UI — components, screens, partials, layouts, design tokens — require existing-ui-audit findings in state.ui_audit before non-trivial UI change; gate, not suggestion"
alwaysApply: false
source: package
---

# UI-Audit Before Build

Defense-in-depth twin of the dispatcher gate in
[`directives/ui/audit.py`](../templates/scripts/work_engine/directives/ui/audit.py).
The dispatcher refuses to advance past `refine` without
`state.ui_audit`; this rule refuses the write even when the agent
acts outside the dispatcher (free-form edit, "add a tile" request,
side conversation that bypasses [`/work`](../commands/work.md) or
[`/implement-ticket`](../commands/implement-ticket.md)).

## The Iron Law

```
NO NEW COMPONENT, SCREEN, PARTIAL, OR PAGE WITHOUT AUDIT FINDINGS.
EXISTING-UI-AUDIT RUNS FIRST. ALWAYS.
```

Skipping the audit is the single biggest source of duplicated
components and drift from project tokens. The audit is cheap (60 s
on a primed cache); the cost of skipping is a refactor.

## When this rule activates

Before writing or editing any non-trivial UI surface:

- New page / screen / route component
- New Livewire / Flux / Blade / React / Vue / Svelte component or partial
- Major edit to an existing screen (new section, new state, new layout band)

Recognise the trigger from wording even when nobody says "audit":
"add a dashboard tile", "build a settings panel", "neue Komponente
für …", "render the orders table", "create the empty state for …".

## Allow-list — when to skip

Skip only when **all** hold:

- `directive_set == "ui-trivial"` (set by Phase 1's intent classifier).
- The change is provably bounded: ≤ 1 file, ≤ 5 changed lines, no
  new component, no new state, no new dependency.

Any precondition fails at edit time → stop, reclassify as
`ui-improve`, re-enter the gate. Backend-only edits and
documentation work were never in scope for this rule.

## What "audit findings" means

`state.ui_audit` is a non-empty dict carrying at least one of:

- `components_found` — `{path, name, kind, similarity?}` inventory
  entries from [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md).
- `greenfield: true` plus `greenfield_decision` ∈
  `{scaffold, bare, external_reference}`.
- Legacy `components` alias — back-compat for the same shape.

`null`, `{}`, or a dict without those keys is **not** findings;
emit `@agent-directive: existing-ui-audit` instead of writing code.

## What to do when the gate fires

1. Stop. Do not open an editor on a component file.
2. Run [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md);
   it writes the result to `state.ui_audit`.
3. On rebound, the dispatcher enters `design` with the audit as
   defaults in the design-brief halt.
4. Greenfield → present the numbered scaffold / bare /
   external-reference halt **before** code; record the pick in
   `state.ui_audit.greenfield_decision`.

## Failure modes

- Writing the component first and "thinking about reuse later".
- Citing a similar-looking component from memory without verifying
  it via the audit.
- Treating `state.ui_audit = {}` as "audit ran, found nothing" —
  empty dict is rejected on purpose; an audit that finds nothing
  must record either ≥1 `components_found` or the greenfield branch.
- Bypassing the gate for "just one tile".

## Interactions

- [`improve-before-implement`](improve-before-implement.md) — runs
  first when the request is ambiguous; this rule is the next gate.
- [`ask-when-uncertain`](ask-when-uncertain.md) — "just build it"
  does **not** drop the audit; acknowledge, run audit, continue.
- [`directives/ui/audit.py`](../templates/scripts/work_engine/directives/ui/audit.py)
  — code-layer twin; this rule covers the cases where the engine
  is not in the loop.
- [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md) — the
  skill that produces the findings.

## Cloud Behavior

On cloud surfaces the engine is not shipped, so `state.ui_audit`
does not exist. The Iron Law still applies: take the visible
inventory of files in conversation context as the audit, and
surface a one-line audit summary in the reply before writing the
component. The gate is satisfied by an explicit summary, not by
silently skipping.
