# Design Modes — Brand vs Product

> Reference doc. Pull this when deciding which design skills to prioritize
> or when the brief is ambiguous about the design register.

## The two registers

Every design task operates in one of two registers. Getting the register
wrong is the root cause of most AI-generated design failures:

| | Brand mode | Product mode |
|---|---|---|
| **Core thesis** | The impression IS the product | Design serves the task |
| **Primary failure** | Flatness / genericness — looks like every other AI startup | Strangeness without purpose — "clever" choices that obscure the tool |
| **The user's question** | "How was this made?" (genuine curiosity) | "Where do I click?" (the tool disappears into the task) |
| **Key skill cluster** | `brand-identity`, `iconography`, `fe-design § Aesthetic direction`, `design-intelligence` | `accessibility-auditor`, `ui-component-architect`, `fe-design § Table/Form Design` |
| **Typography strategy** | Distinctive pairing — two contrasting families, deliberate tracking | One reliable family — Inter or equivalent; predictable hierarchy |
| **Color strategy** | Brand identity — often unexpected; the palette IS the differentiator | Semantic function — primary/danger/success/neutral; predictable meaning |
| **Motion strategy** | Expressive — motion reinforces the brand's personality | Utilitarian — motion confirms state changes; nothing decorative |
| **Spacing strategy** | Breathing room; generous whitespace as a brand signal | Dense/efficient; optimize for information density |
| **Success criterion** | Originality test: a skeptic can't guess "which AI made this?" | Earned familiarity: the tool disappears; users focus on their task |

## How to determine the register

Ask: **What is the output of this UI being used for?**

- A consumer-facing surface where the FIRST impression determines whether the
  user trusts/buys → **Brand mode**. The product has 3 seconds; every pixel
  contributes to the brand's identity.

- An internal tool, dashboard, admin panel, or workflow-critical surface where
  users return dozens of times per day → **Product mode**. Strangeness wastes
  their time; predictability builds trust.

- A marketing landing page → **Brand mode**. It has one job: create desire.

- A data entry form → **Product mode**. It has one job: accept correct data.

**Ambiguous cases:** many products have both (a brand-heavy landing page +
a product-mode dashboard). The register applies per-surface, not per-product.
When unclear: ask — *"Is the user here to be impressed, or to accomplish a
task?"*

## Brand-mode failure modes

- **Genericness:** Choosing the safe AI-slop palette (cream + brass, purple/violet gradient, three equal cards). The product is invisible in its category. Cross-check with `docs/guidelines/design-antipatterns.md` § Color and Visual.
- **Inconsistency:** Brand direction picked for the hero, abandoned for the body. The page reads as two different products.
- **Aesthetics-without-function:** Beautiful but confusing navigation, stunning hero with no CTA clarity.

## Product-mode failure modes

- **Strangeness-without-purpose:** A clever typographic choice that makes the CTA harder to scan. A gradient background on a data table. An animated page transition in an admin panel.
- **Premature originality:** Reinventing a standard UI pattern (data table, form validation, dropdown) when the standard is what users expect.
- **Over-engineering:** Five different card elevations in a dashboard that needs two.

## The AI-slop originality self-test (applies to brand mode primarily)

Run BOTH tiers before approving a brand-mode design direction:

**Tier 1 — Category test:**
Would a designer seeing 20 AI-generated [product category] UIs recognize this
aesthetic as part of that category's default? (e.g., "SaaS → dark mode + purple
gradient"; "health app → teal + rounded sans serif + white space").
- If YES: rework the concept. The design is invisible in its category.
- If NO: proceed to Tier 2.

**Tier 2 — Anti-reference test:**
Given the category AND three explicit aesthetics you've avoided — could a
skeptic still guess the direction? (e.g., "fintech that's not navy-and-gold,
not minimal white, not brutalist → everyone picks terminal dark").
- If YES: dig deeper. "Avoiding the worst cliché" is not differentiation.
- If NO: the direction is genuinely distinctive.

**The bar:** a visitor should ask "how was this made?" not "which AI made this?"

## Routing to skills by mode

**Brand mode brief:**
1. `design-intelligence` (grounded style/palette/typography selection — run the corpus first)
2. `brand-identity` (archetype → token system)
3. `iconography` (icon system selection for brand expression)
4. `fe-design § Aesthetic direction` (direction → composition → typography → color)

**Product mode brief:**
1. `existing-ui-audit` (mandatory — inventory first)
2. `accessibility-auditor` (WCAG compliance from the start)
3. `ui-component-architect` (reuse existing primitives)
4. `fe-design § Component Architecture, Form Design, Table Design` (standard patterns)

**Both modes:** `design-antipatterns` (always pull), `design-review` (with anti-slop check)

## See also

- `docs/guidelines/design-antipatterns.md` — the slop-tell catalog; brand mode especially needs this
- `brand-source-of-truth` — when a registered brand profile is present, it governs
- `brand-consistency` — validates emitted artifacts against the brand profile
- `design-system-capture` — DESIGN.md/PRODUCT.md capture the mode's decisions for cross-task consistency
