---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/editing UI — components, screens, layouts, design tokens — require existing-ui-audit findings first"
triggers:
  - path_prefix: "resources/views/"
  - path_prefix: "resources/js/"
  - path_prefix: "components/"
  - path_prefix: "src/components/"
  - path_prefix: "pages/"
  - file_pattern: "*.vue"
  - file_pattern: "*.svelte"
  - file_pattern: "*.tsx"
  - file_pattern: "*.jsx"
  - file_pattern: "*.blade.php"
  # `keyword: "component"` and `keyword: "design token"` removed 2026-08-17 as an
  # AUTHORING decision — road-to-mixed-trigger-activation-cost Phase 2, amendment
  # option (b), narrowed to the two path-dominant per-edit rules. This is the
  # escape the mixed-triggers guard's own comment names: with no non-path trigger
  # left the emitter restores `paths:`, so the rule loads on UI file contact
  # instead of in every session. The obligation is unchanged — an audit is owed
  # before a component is written, and a component is written in a file.
routes_to:
  - "skill:existing-ui-audit"
  - "skill:iconography"
  - "skill:typography-system"
workspaces: [agent-config-maintainer, engineering]
packs: [frontend-design]
enforced_by:
  - "hook:design-pass"
collision_ok:
  # The "component" and "design token" entries were removed with their triggers
  # (2026-08-17): a collision note for a trigger that no longer exists is an
  # own-orphan, and `minimal-safe-diff` § Own-orphan cleanup requires the diff that
  # stopped referencing them to remove them too. The path-keyed notes below are
  # unchanged — both halves of the UI loop still fire on the same paths.
  "resources/views/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "resources/js/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "components/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "src/components/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "pages/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "*.vue": "one component file, two obligations: inventory before the write, review after it"
  "*.svelte": "one component file, two obligations: inventory before the write, review after it"
  "*.tsx": "one component file, two obligations: inventory before the write, review after it"
  "*.jsx": "one component file, two obligations: inventory before the write, review after it"
  "*.blade.php": "one template file, two obligations: inventory before the write, review after it"
# obligation: line 39
obligation_frequency: "per-edit"
---

# UI Audit Gate

Defense-in-depth twin of the dispatcher gate in
[`directives/ui/audit.ts`](../templates/scripts/work_engine/directives/ui/audit.ts).
The dispatcher refuses to advance past `refine` without `state.ui_audit`;
this rule refuses the write even when the agent acts outside the dispatcher.

Body migrated to [`skill:existing-ui-audit`](../skills/existing-ui-audit/SKILL.md)
(per P4 of `road-to-kernel-and-router.md`). Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## The Iron Law

```
NO NEW COMPONENT, SCREEN, PARTIAL, OR PAGE WITHOUT AUDIT FINDINGS.
EXISTING-UI-AUDIT RUNS FIRST. ALWAYS.
```

## What "audit findings" means

`state.ui_audit` is a non-empty dict carrying at least one of:

- `components_found` — inventory entries from `existing-ui-audit`.
- `greenfield: true` plus `greenfield_decision` ∈
  `{scaffold, bare, external_reference}`.
- Legacy `components` alias — back-compat.

`null` or `{}` is **not** findings; empty dict is rejected on purpose.

## Allow-list — `ui-trivial`, decidable from the diff alone

Skip only when **all** hold:

- ≤ 1 file, ≤ 5 changed lines, no new component, no new state.
- Inside the work engine, `directive_set == "ui-trivial"` — the dispatcher
  states it directly. Outside it, the same four conditions are read **off the
  diff**, which is observable without any dispatcher state.

The `directive_set` check used to be an additional *requirement* rather than
the dispatcher's way of stating the same fact. That made the escape hatch
dispatcher-only, and with `state.ui_audit` also dispatcher-only the gate could
be neither satisfied nor skipped in a plain chat session — the only
rule-conform action left was "write no UI". A gate whose sole compliant path is
inaction is not a gate.

## Honest scope — what this rule does NOT enforce in a chat session

```
OUTSIDE THE WORK ENGINE, THE AUDIT OBLIGATION IS MODEL-CARRIED.
NEVER CLAIM THE AUDIT RAN AS IF IT WERE VERIFIED.
```

**This section used to say the obligation was satisfiable only by assertion.
That is no longer true, and the change is narrow enough to state precisely.**

`state.ui_audit` used to exist only inside the work-engine dispatcher, which is
why a chat session had nothing to point at: "I ran `existing-ui-audit` first"
is self-report, and self-report is not enforcement. `agent-config ui:audit`
now writes `agents/runtime/state/ui-audit.json`, so there IS an artefact — and
`design_pass_hook.ts` reads it and compares its mtime against the file being
written. `enforced_by:` names that concern (`hook:design-pass`).

Three limits, because naming a script is not the same as closing the gap:

1. **Freshness, not existence.** The check is "an artefact newer than the
   target". A stale artefact is worse than a missing one, because it looks like
   evidence — so an artefact older than the write does not satisfy the gate.
2. **Default-OFF, and warn before it blocks.** `hooks.design_pass.enabled` ships
   `false`. When on, a missing artefact warns on `post_tool_use` and blocks at
   `stop`. Turning it on is a maintainer decision, never an automated one.
3. **The greenfield asymmetry is real and is not closed by this.**
   `_lib/ui_surface.ts` is a PATH predicate — measured recall 20/23, with all
   three misses being a UI *request* that has not yet produced a UI *file*
   (`internal/bench/frontend-power/BASELINE-2026-08-23.md` § Routing). So an
   audit-before-write gate keyed on the path cannot fire on the first write of a
   brand-new surface. After the write it can, which is why the carrier is on
   `post_tool_use` and not `pre_tool_use`.

Run [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md) before adding a
component because reuse beats duplication. The difference from before is that a
check can now catch you — on a host that binds the slot, with the setting on,
and not on the very first file of a new surface.

**A runtime carrier now exists, and it does not change the verdict.** The
`ui-route-nudge` PreToolUse concern warns once on a UI write with no design
consultation latched this session.

It is a **parallel** mechanism, not a consumer of the triggers above — the
distinction matters and the earlier wording here got it wrong. The concern
decides "is this a UI surface" from `src/scripts/_lib/ui_surface.ts`; nothing
in the tree parses this frontmatter at session time, and the two sets can drift.
What holds them together is a test, not a dependency:
`ui_rule_triggers.test.ts` asserts every `file_pattern` declared here is
accepted by that predicate.

**This rule carries no `keyword:` trigger any more (2026-08-17).** It used to,
and the observation those keywords had no runtime consumer is what made removing
them cheap: no host activation surface reads a keyword — Cursor and Windsurf
activate on `globs` plus the description, Claude on `paths:`. What the keywords
did do was expensive, and only on Claude: one non-path trigger makes the emitter
write **no** `paths:` at all, which is why this rule loaded in every session from
12.1.0 until the removal. It is path-scoped again, so the obligation now arrives
on UI file contact — see `road-to-mixed-trigger-activation-cost` Phase 2. The predicate
is deliberately wider (it also covers `.css`, `.scss`, `.astro`), because a
measurement denominator and a routing trigger are not the same population.

Warn-only, capped at two per session, default-OFF, and bound only in the three
`platforms:` rows that carry a `pre_tool_use` key — augment, claude, cowork
(**clarified 2026-08-17**: "where a slot exists" read as a host property, and it
is a manifest one; three further hosts alias a native pre-tool event without a
binding, and only claude honours a deny at all — the four states are tabulated
in [`hook-architecture-v1 § Which hosts carry pre_tool_use`](../docs/contracts/hook-architecture-v1.md)).
None of that changes the verdict here: a reminder that can be ignored is not a
gate, so `enforced_by:` stays `none`. Run `agent-config hooks:status` for the
host you are on rather than trusting this sentence.

## Failure modes

- Writing the component first and "thinking about reuse later".
- Citing a similar-looking component from memory without verifying via the audit.
- Treating `state.ui_audit = {}` as "audit ran, found nothing".
- Bypassing the gate for "just one tile".
