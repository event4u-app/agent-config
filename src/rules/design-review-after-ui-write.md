---
type: "auto"
tier: "2b"
alwaysApply: false
description: "UI written or changed — review it against the design contract before calling it done; the write-side twin of ui-audit-gate"
triggers:
  - path_prefix: "resources/views/"
  - path_prefix: "resources/js/"
  - keyword: "component"
  - keyword: "design token"
routes_to:
  - "skill:design-review"
  - "skill:accessibility-auditor"
workspaces: [agent-config-maintainer, engineering]
packs: [frontend-design]
collision_ok:
  "component": "a written component is reviewed before it is called done — the write-side half"
  "design token": "same surface, opposite side: ui-audit-gate inventories tokens before the write, this reviews what the write emitted"
  "resources/views/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
  "resources/js/": "both halves of one UI loop fire on the same path — audit before, review after; neither substitutes for the other"
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
enforcement. So this rule ships `enforced_by: none`, the same honesty boundary
`ui-audit-gate`, `security-sensitive-stop`, and `untrusted-input-defense` state
for their own obligations, rather than pretending a satisfiable-by-assertion
condition is a gate.

What that leaves, and it is the useful part: the write side now has a named
obligation and a route to the skill that discharges it, where before it had
neither. Full enforcement needs the work-engine `review`/`polish` gates (which
already act on `a11y_violation` and `token_violation` findings) or pack-scoped
rule projection — a maintainer decision, never an automated one.

One asymmetry worth stating: `design-review` lives in `engineering-base` while
this rule is scoped to `frontend-design`. The route still resolves — a rule may
name a skill from another pack — but a consumer with `frontend-design` and
without `engineering-base` gets the obligation without the skill. That is why
`accessibility-auditor` is a second route: it is the part of the review that
must not depend on the pairing.

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
