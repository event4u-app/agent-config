---
type: "auto"
tier: "2b"
alwaysApply: false
description: "UI written or changed — review it against the design contract before calling it done; the write-side twin of ui-audit-gate"
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
  # instead of in every session. The obligation is unchanged — it binds when a UI
  # file is touched, which is the only place a UI edit can happen.
routes_to:
  - "skill:design-review"
  - "skill:accessibility-auditor"
workspaces: [agent-config-maintainer, engineering]
packs: [frontend-design]
enforced_by:
  - "instruction-only: no artefact proves a design review happened outside the work-engine dispatcher; the review verdict is self-report"
collision_ok:
  # The "component" and "design token" entries were removed with their triggers
  # (2026-08-17): a collision note for a trigger that no longer exists is an
  # own-orphan, and `minimal-safe-diff` § Own-orphan cleanup requires the diff that
  # stopped referencing them to remove them too. The path-keyed notes below are
  # unchanged, and they still carry the real point: both halves of the UI loop fire
  # on the same paths.
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

# Design Review After UI Write

The UI loop was closed on one side only. [`ui-audit-gate`](ui-audit-gate.md)
covers the **read** side — inventory what exists before adding a component — and
routes to `existing-ui-audit`. Nothing covered the **write** side: **zero rules
routed to `skill:design-review`**, so a component could be written, declared
done, and never looked at against the contract it was supposed to satisfy.

This is that rule's twin, deliberately built to the same shape: same tier, same
pack, same diff-decidable allow-list, and the same honest scope.

## The Iron Law

```
UI WRITTEN OR CHANGED IS NOT DONE UNTIL IT IS REVIEWED.
NEVER CLAIM A UI CHANGE IS COMPLETE ON "IT LOOKS RIGHT" — THAT IS A VERDICT
WITHOUT EVIDENCE. NO RENDER CAPABILITY → SCOPE THE VERDICT TO WHAT WAS
STATICALLY CHECKED AND SAY SO. NEVER "LOOKS GOOD" WITH NOTHING BEHIND IT.
```

## What "reviewed" means

The verdict is gated on evidence, not on having run a skill:

- **Render capability present** (Playwright MCP, Chrome DevTools, or a live
  preview URL) → the [design-artifact verification checklist](../../docs/contracts/design-artifact-verification.md#verification-checklist)
  steps 1–5. A UI task does not pass without render evidence.
- **Render capability absent** → the verdict is **scoped to the static checks
  that actually ran** and says which those were. This is not a downgrade to be
  hidden; `design-review` itself states it ("scope the verdict to what was
  statically checked and say so"). An unscoped "looks good" is the failure.
- **A provided artifact is the spec** → findings the artifact *covers* are
  informational, not defects, per [`design-fidelity`](design-fidelity.md). The
  review does not "improve" the user's own design.

## Allow-list — `ui-trivial`, decidable from the diff alone

Skip only when **all** hold:

- ≤ 1 file, ≤ 5 changed lines, no new component, no new state, no new dependency.
- Inside the work engine, `directive_set == "ui-trivial"` — the dispatcher states
  it directly. Outside it, the same conditions are read **off the diff**, which
  is observable without any dispatcher state.

The list is deliberately the engine's five conditions, not the four its
sibling rule's prose carries: `ui_trivial/apply.ts` enforces `new_dependency`
too, and a twin that copied the shorter prose would inherit a gap the engine
does not have.

## Honest scope — what this rule does NOT enforce

```
THE REVIEW OBLIGATION IS MODEL-CARRIED. NEVER CLAIM THE REVIEW RAN
AS IF IT WERE VERIFIED.
```

There is no artefact a chat session can point at to prove a design review
happened — "I ran `design-review`" is self-report, and self-report is not
enforcement. So this rule ships `instruction-only`, the same honesty boundary
`ui-audit-gate`, `security-sensitive-stop`, and `untrusted-input-defense` state
for their own obligations, rather than pretending a satisfiable-by-assertion
condition is a gate.

**A runtime carrier now exists, and it does not change that.** The
`ui-route-nudge` PreToolUse concern emits one warning on a UI write with no
design consultation latched this session.

It runs **parallel** to this rule rather than consuming it. Nothing in the tree
reads this frontmatter at session time; the concern decides what counts as a UI
surface from `src/scripts/_lib/ui_surface.ts`. A test — not a code path — keeps
the two from drifting: `ui_rule_triggers.test.ts` asserts every `file_pattern`
declared here is accepted by that predicate.

**This rule carries no `keyword:` trigger any more (2026-08-17).** It used to,
and the observation those keywords had no runtime consumer is what made removing
them cheap: no host activation surface reads a keyword — Cursor and Windsurf
activate on `globs` plus the description, Claude on `paths:`. What the keywords
did do was expensive, and only on Claude: one non-path trigger makes the emitter
write **no** `paths:` at all, which is why this rule's pre-inventory-and-review
obligation stood in every session from 12.1.0 until the removal. It is
path-scoped again — see `road-to-mixed-trigger-activation-cost` Phase 2.

Warn-only, capped at two nudges per session, default-OFF, and bound only in the
three `platforms:` rows that carry a `pre_tool_use` key — augment, claude,
cowork (**clarified 2026-08-17**: "hosts carrying a slot" read as a host
property and is a manifest one; three further hosts alias a native pre-tool
event with no binding, and only claude honours a deny — see
[`hook-architecture-v1 § Which hosts carry pre_tool_use`](../../docs/contracts/hook-architecture-v1.md)).
The verdict is unchanged either way: a nudge that can be ignored is not
enforcement, so `enforced_by:` stays `none` — it moves the day a mechanism can
refuse, not the day a reminder appears. `agent-config hooks:status` answers
whether the concern is bound on the host you are actually on.

What that leaves, and it is the useful part: the write side now has a named
obligation and a route to the skill that discharges it, where before it had
neither. Full enforcement needs the work-engine `review`/`polish` gates (which
already act on `a11y_violation` and `token_violation` findings) or pack-scoped
rule projection — a maintainer decision, never an automated one.

One asymmetry worth stating, in the direction it actually runs: `design-review`
lives in `engineering-base` while this rule is scoped to `frontend-design`. The
route still resolves — a rule may name a skill from another pack.

The case this paragraph used to describe — `frontend-design` installed without
`engineering-base`, so the obligation arrives without the skill — **cannot
occur**: `frontend-design` declares `requires: [engineering-base]`, and the
resolver expands that graph transitively. The real gap is the reverse and was
undocumented: an **`engineering-base`-only** install (a plain `laravel` or
`react` consumer, since both only *suggest* `frontend-design`) carries
`existing-ui-audit`, `design-review` and `fe-design` while carrying **no rule
that routes to them**. It bites only where pack-scoped rule projection is
active — `rules.packs` ships inactive, so a default install still receives both
rules — which makes it a latent defect rather than a live one, and exactly the
kind that surfaces the day the projection axis is switched on.

`lint_rule_skill_pack_reach` is the invariant that keeps this honest: no rule
may route to a skill a pack-legal install of that rule's packs cannot receive.
`accessibility-auditor` remains a second route for the independent reason that
the a11y half of the review should not depend on the pairing at all.

## Failure modes

- Writing the component and calling it done because the tests pass — tests do not
  look at it.
- "Looks good" as a verdict with no render, no static check named, and no scope.
- Running the review and acting on findings the provided artifact covers, i.e.
  redesigning the user's spec under the banner of quality.
- Treating the a11y half as optional because the visual half looked fine.
- Skipping the review for "just one tile" — the same bypass `ui-audit-gate`
  names on its own side.

## See also

- [`ui-audit-gate`](ui-audit-gate.md) — the read-side twin; audit before writing.
- [`design-review`](../skills/design-review/SKILL.md) — the 7-phase review this routes to.
- [`accessibility-auditor`](../skills/accessibility-auditor/SKILL.md) — the WCAG half.
- [`design-fidelity`](design-fidelity.md) — a provided artifact is the spec; covered findings are informational.
- [`verify-before-complete`](verify-before-complete.md) — the general no-claim-without-evidence gate this applies to UI.
