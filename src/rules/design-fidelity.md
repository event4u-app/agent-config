---
type: "auto"
tier: "2a"
description: "A provided prototype/mockup/design system is the spec — build 1:1; never swap fonts, controls, or layout unconfirmed"
triggers:
  - keyword: "prototype"
  - keyword: "mockup"
  - keyword: "wireframe"
  - keyword: "design system"
  - keyword: "design spec"
  - keyword: "Figma"
  - phrase: "match the design"
  - phrase: "build this design"
  - phrase: "design fidelity"
  - phrase: "stick to the design"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
routes_to:
  - "guideline:design-fidelity-mechanics"
workspaces: [engineering]
packs: [engineering-base, frontend-design]
---

# Design Fidelity

When the user provides a finished prototype, mockup, screenshot, or design
system, that artifact is the **spec** — not a starting point for the agent's
own taste. This rule mirrors [`brand-source-of-truth`](brand-source-of-truth.md):
the provided design is authoritative for the run.

The failure it prevents: an agent substituting its own judgment over the
supplied design — swapping fonts, replacing a slider with another control,
dropping elements, restructuring the layout — so the result looks
fundamentally different from what the user already approved. A "honesty gate",
a "cleaner" idea, or a "better flow" is **not** a licence to redesign.

## The Iron Law

```
A PROVIDED PROTOTYPE / DESIGN SYSTEM IS THE SPEC, NOT A SUGGESTION.
BUILD IT 1:1. NEVER SWAP FONTS, CONTROLS, COMPONENTS, LAYOUT, SPACING,
OR COLOUR — AND NEVER OMIT OR ADD AN ELEMENT — WITHOUT EXPLICIT CONFIRMATION.
A "BETTER IDEA" IS A PROPOSAL TO SURFACE, NEVER A CHANGE TO MAKE.
```

## What counts as the spec

A user-provided, finished design artifact the user points at and says "match
this": a prototype (HTML / JSX / Figma export), a mockup or screenshot, a
design-system file (tokens, component library), or a URL / path. It encodes
decisions already made — treat it like brand tokens, not like inspiration.

## Strictness — set by `design.fidelity_mode`

Read `design.fidelity_mode` from `.agent-settings.yml`. Missing → `strict`.

| Mode | Behaviour |
|---|---|
| `strict` (default) | Build 1:1. EVERY visible deviation — font, control type (slider → input, etc.), component, layout, spacing, colour, an omitted or added element — requires explicit confirmation. A "better" alternative is surfaced as a numbered option, never executed. |
| `structural` | Structure is locked — fonts, control types, component set, layout, no omissions still require confirmation. Where the spec is genuinely **silent** (a state it does not show: hover / empty / error), the agent may fill the gap in the spec's style and MUST state the assumption. |
| `hard-floor` | Any deviation from the provided design is a Hard-Floor action (per [`non-destructive-by-default`](non-destructive-by-default.md)): never autonomous; no autonomy setting, roadmap, or standing instruction lifts it. |

## When it fires

A finished design artifact is provided or referenced AND the agent is building,
porting, or modifying UI to match it.

## When NOT to fire

- No provided design (greenfield from a text brief) — [`design-intelligence`](../skills/design-intelligence/SKILL.md) / [`fe-design`](../skills/fe-design/SKILL.md) define it; fidelity has nothing to bind to.
- The user explicitly invites exploration ("show me options", "redesign this", "improve the layout") — that authorises deviation for that turn.
- Non-UI surfaces (scripts, CLI, backend).

Body migrated to [`guideline:design-fidelity-mechanics`](../docs/guidelines/design-fidelity-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — surgical visual edits (targeted-edit vs redesign-trigger discipline, stable anchors), asset & imagery discipline (owned-asset path, real-imagery-as-proof, iconography floor, no unrequested filler), deviation-surfacing shape, failure-mode catalog, `daf-*` fixtures.
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

- [`brand-source-of-truth`](brand-source-of-truth.md) / [`brand-consistency`](brand-consistency.md) — same precedence shape, for registered brand tokens.
- [`minimal-safe-diff`](minimal-safe-diff.md) — the code-diff analog (smallest change; no drive-by restructure).
- [`existing-ui-audit`](../skills/existing-ui-audit/SKILL.md) / [`ui-audit-gate`](ui-audit-gate.md) — inventory existing components before adding new ones.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the one-question, numbered-option surfacing shape.
