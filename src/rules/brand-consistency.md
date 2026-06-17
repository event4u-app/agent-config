---
type: "auto"
tier: "2a"
description: "Generated UI, copy, and assets are checked against the active brand tokens and voice profile — a value not traceable to a brand token or voice rule is flagged off-brand."
triggers:
  - keyword: "brand"
  - keyword: "on-brand"
  - keyword: "off-brand"
  - keyword: "brand voice"
  - keyword: "brand tokens"
  - phrase: "brand consistency"
  - phrase: "on brand"
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
workspaces:
  - engineering
packs:
  - brand
---

# Brand Consistency

Brand is the layer that *constrains* UI, copy, and assets — not a coat of paint
applied after. This is a concrete Validation gate: emitted artifacts are checked
against the **active brand tokens and voice profile**, and anything that cannot
be traced back to one is flagged off-brand. It mirrors the design-intelligence
principle that **audit findings outrank corpus suggestions** — the consumer's
brand outranks any generated default.

## The Iron Law

```
EVERY EMITTED COLOUR, TYPE, SPACING, AND VOICE CHOICE TRACES TO A BRAND TOKEN
OR A VOICE RULE. A VALUE THAT TRACES TO NEITHER IS OFF-BRAND.
NEVER SHIP AN ASSET THE ACTIVE BRAND CANNOT ACCOUNT FOR.
```

## What this gates

- **Colour / type / spacing** in generated UI or assets that is not one of the
  active brand tokens (from `state.ui_design` or the consumer's `.tokens.json`).
  A raw hex / font / px value with no token behind it is off-brand.
- **Copy and microcopy** whose register contradicts the active voice profile
  (e.g. playful copy under an authoritative `Ruler` voice).
- **Generated brand assets** (logo, banner, social) emitted without injecting the
  registered brand tokens — raw generation is allowed only when no brand layer
  exists (graceful fallback), never as a silent override of one that does.

## When it fires

A brand layer is active for the run (a `.tokens.json` / `state.ui_design` brand
profile or a confirmed `brand-strategy` / `brand-identity` constraint set) AND a
UI / copy / asset is being emitted or reviewed.

## When NOT to fire

- No brand layer exists yet (greenfield) — there is nothing to validate against;
  generation proceeds on the brief, and `brand-strategy` / `brand-identity`
  define the tokens first.
- The user explicitly scopes an exploration ("just show options") with no
  commitment to an on-brand deliverable.
- Non-brand surfaces: scripts, CLI output, internal tooling.

## How to surface a violation

Name the off-brand value, the token/voice rule it should have matched, and the
fix — do not silently rewrite. Untraceable value → "off-brand: `<value>` has no
brand token; nearest is `<token>`" so the human decides token-or-exception.

## See also

- [`brand-source-of-truth`](brand-source-of-truth.md) — establishes which brand profile is authoritative for the run.
- [`brand-identity`](../skills/brand-identity/SKILL.md) — defines the tokens this gate validates against.
- [`brand-to-tokens`](../skills/brand-to-tokens/SKILL.md) — emits the DTCG `.tokens.json` source of truth.
- [`design-intelligence`](../skills/design-intelligence/SKILL.md) — the "audit findings outrank corpus" precedent this gate mirrors.
