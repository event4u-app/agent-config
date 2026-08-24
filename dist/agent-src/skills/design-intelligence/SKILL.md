---
model_tier: inherit
name: design-intelligence
description: "Grounded design brief from the adopted corpus — style, WCAG-checked color tokens, typography, layout pattern, anti-patterns. Use on ui-design-brief or any which-style/palette/font/chart decision."
domain: engineering
personas:
  - frontend-engineer
workspaces:
  - engineering
packs:
  - frontend-design
token_budget_class: rich
trust:
  level: professional
install:
  removable: true
scope:
  write: []
  verification_reason: "execution declares no handler, so this skill runs nothing of its own — every write is the calling agent's, under the rules that govern it. No command can prove a scope the skill never executes."
execution:
  type: manual
---

# design-intelligence

> The grounded source for frontend design decisions (ADR-061; first
> consumer of [`corpus-grounding`](../corpus-grounding/SKILL.md)). When the
> UI directive set's `design` step emits `@agent-directive: ui-design-brief`,
> consult this corpus FIRST and pre-fill the brief candidates — then the
> human confirms (`design_confirmed`). Corpus output is a **constraint
> set**, never final microcopy; the placeholder lock in
> `directives/ui/design.ts` is unaffected.
>
> **Boundary (council-locked):** `design.ts` stays a pure orchestration
> gate and never imports the engine — the corpus call lives HERE, in the
> skill layer, keeping the engine an optional dependency.

Corpus: 11 tabular CSVs under [`data/`](data/) (161-row `ui-reasoning`
decision map, WCAG-adjusted color token sets, 84 styles, 73 font
pairings, 25 chart rules, UX/react/mobile guidelines) + 16 prose
design-language specs ([`references/design-languages.md`](references/design-languages.md))
+ the 10-category pre-delivery checklist
([`references/design-rules-checklist.md`](references/design-rules-checklist.md)).
Provenance + licenses: [`ATTRIBUTION.md`](ATTRIBUTION.md); manifest:
[`data/manifest.json`](data/manifest.json).

## When to use

- The UI directive set emits `@agent-directive: ui-design-brief` (the
  design step found `state.ui_design` empty).
- Any pre-build selection question: which style / palette / font pairing /
  layout pattern / chart type / icon system fits this product.
- Stack-idiom lookup before writing UI code (`--stack` axis).

## Section index — load on demand

Load the reference file whose sections the task needs — never all of them by default:

- [`references/context-and-registers.md`](references/context-and-registers.md) — Cross-task design memory — read DESIGN.md / PRODUCT.md first · Register — brand vs product · Design Read — articulate intent before generating
- [`references/integration-mapping.md`](references/integration-mapping.md) — `MASTER.md` + page overrides ↔ `state.ui_design` (mapping) · Grounding the review/polish a11y gate (charts + contrast) · Stack guidance (`--stack` axis) · Diagram-type routing — route on the verb · Interplay (who owns what)

## Honesty / real-system grounding

When the brief maps to an official design system (Material Design, Fluent,
Carbon, Polaris, GOV.UK, shadcn, Tailwind UI, Radix, etc.):

0. **Canon grounding first.** If the brief names a system OR
   `components.json`/deps signal one (`@mui/material`, `antd`, `@fluentui/*`,
   `@carbon/*`, `@atlaskit/*`), pull
   [`docs/guidelines/design-canon.md`](../../../docs/guidelines/design-canon.md),
   surface the matching one-line summary, and **offer to fetch the live spec**
   before committing to the system's conventions — rather than improvising.
   The canon index is thin + lazy: do not load it for a generic, unnamed brief.
1. **Install the real package** — do not hand-recreate its CSS or components.
   Surface the install command for the project's package manager (the
   system's official package, e.g. the shadcn CLI or the `@mui/material`
   distribution) and link the canonical documentation URL.
2. **Never label an approximation as the official system.** If generating
   approximate CSS for a system the project does not yet depend on, label it
   explicitly: *"Approximation of Material Design elevation — not the official
   `@mui/material` package; install the package for production use."*
3. **If no official system is relevant:** pick a deliberate creative direction
   (see Design Read above); never fall back to an unnamed generic aesthetic
   (per `source-discovery-gate`: real source before guessing).

**Grounding precedence** (consistent with `brand-source-of-truth`): consumer
brand tokens > confirmed session decisions > named canon
([`design-canon.md`](../../../docs/guidelines/design-canon.md)) > generated
corpus. Canon is a gap-filler, never an override of a registered brand value.

## Procedure: Produce a grounded design brief (`ui-design-brief` rebound)

1. **Ground** (one call — engine runs the manifest's plan
   product → style → color → landing → typography with decision rules):

   ```bash
   ./scripts-run <skills-root>/corpus-grounding/scripts/ground ground \
     --manifest <skills-root>/design-intelligence/data/manifest.json \
     "<product type + mood + platform>" --json
   ```

2. **Translate selections into the brief** for `state.ui_design`:
   - `layout` ← landing/pattern selection (`Section Order`, CTA placement)
     + the reasoning rule's `Recommended_Pattern`;
   - `components` ← audit reuse first (`existing-ui-audit` inventory wins
     over corpus suggestions — never propose a new component the audit
     already has);
   - `states` ← required five (`empty/loading/error/success/disabled`),
     styled per the selected design language;
   - `microcopy` ← **agent-written, final strings** — the corpus never
     supplies microcopy;
   - `a11y` ← color selection's contrast-adjusted token set + the
     checklist's CRITICAL rows + `accessibility-auditor` method;
   - style/typography/effects/anti-patterns ← the grounded selections
     verbatim, with alternatives listed.
3. **Always surface** the grounded output's `confidence` + `evidence_gap`
   lines in the brief summary — the user signs off on what the corpus
   could NOT support, not only on what it could.
4. On `design_confirmed: true` the directive engine advances; revisions
   loop back here.

### Font delivery columns — which one is the answer

`font-pairings-reference.csv` carries three delivery-adjacent columns and they
are **not** interchangeable. This is the arbitration between them, so the file
and its sibling `data/stacks/nextjs.csv` (row 22: a font-CDN `<link>` sits in
that row's **Don't** column) no longer read as opposite instructions:

| Column | What it answers | Status |
|---|---|---|
| `Google Fonts URL` | *where do I find / verify this font?* | discovery + availability check |
| `Self-Hosted Route` | *how does it get onto the page?* | **the default answer** — `@fontsource/*` package ids derived from the row's own Google-Fonts families; two rows name a foundry file instead (Fontshare pairs with a Google alternative) |
| `CSS Import` | the third-party CDN `@import` | **opt-in only** — emitting it transmits the visitor's IP to the third party; policy owner is [`design-fidelity-mechanics`](../../../docs/guidelines/design-fidelity-mechanics.md) § Asset & imagery discipline ([`ADR-205`](../../../docs/decisions/ADR-205-webfont-delivery-ownership.md)) |

Per-stack route resolution (Next / bundler / asset-pipeline / plain) lives in
[`typography-system`](../typography-system/SKILL.md) § Delivery — one table, not
two.

### Font fallback (no google-fonts index — by design)

The 745 KB Google-Fonts index was rejected (ADR-061 §8): it duplicates a
public API. When a requested font is outside `font-pairings-reference.csv`'s 73
pairings: query `https://fonts.google.com/specimen/<Family>` (or the
`webfonts` API) for metadata, OR propose the nearest curated pairing and
say why. Never invent pairing metadata.

## Output format

1. Grounded brief candidates per `state.ui_design` slot (layout,
   components, states, microcopy placeholder-free, a11y) — selections
   cited per corpus row.
2. The grounded output's `confidence` label + every `evidence_gap` line,
   verbatim, in the brief summary.
3. Alternatives list per domain so the human can swap before
   `design_confirmed`.

## Do NOT

- Do NOT let the corpus write microcopy — it supplies constraint sets;
  final strings are agent-written (placeholder lock stays in force).
- Do NOT import the engine into `directives/ui/design.ts` — council
  boundary; the corpus call lives in this skill layer.
- Do NOT propose a new component the `existing-ui-audit` inventory
  already covers — audit findings outrank corpus suggestions.
- Do NOT hide low confidence — the user signs off on the gaps too.

## Gotchas

- Corpus grounds **pre-action selection** — do not use it as mid-task
  reference (open `references/` instead) or as a validator (rules own that).
- Empty result ≠ error: surface the evidence gap and proceed on priors.
- Keep queries product-shaped ("fintech dashboard", "luxury e-commerce
  mobile") — the detect map routes generic words to `style`.

## Anti-slop discipline

Before finalizing any design brief, cross-check against
[`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md)
— especially the Color (C1–C5), Typography (T7–T8), and Layout (L1–L2) sections.
If the grounded corpus selection lands on a pattern in the catalog, either invoke
the override condition or adjust the selection.
For typography this is **a field, not a memory test**: a
`font-pairings-reference.csv` row whose heading or body font is a T7 overused-AI
default carries it in its `AI-Default Flag` column (`T7:<font>`; 15 of 73 rows) —
read the field. An empty flag means the row carries no T7 font, so a pairing is
never "flagged by association" (Poppins + Open Sans, the example most often
cited as flagged, carries none). T8 (single typeface for everything) needs no
column: it is `Heading Font == Body Font` on the row. A flag is a visible
conflict to resolve, never a ban — the catalog's override condition still
applies. Run the AI-slop originality
self-test (catalog § "The AI-slop originality self-test") on the chosen aesthetic
direction before emitting `design_confirmed`.

## Why this skill is rich

This skill carries 11 tabular CSVs (161-row UI-reasoning decision map,
WCAG-adjusted color token sets, 84 styles, 73 font pairings, 25 chart rules, UX/
react/mobile guidelines) plus 16 prose design-language specs and a 10-category
pre-delivery checklist. Agents need to see the full corpus to make grounded
selections — condensing to a summary destroys the evidence trail ("corpus
row 47 justifies the palette choice") that the skill's output contract requires.
Compressing the 16 design-language specs into fragments makes the style
selection unreproducible and audit-unfriendly.

## Policies

- Upstream MIT + Apache-2.0 obligations: [`ATTRIBUTION.md`](ATTRIBUTION.md).
- Refresh: quarterly per the manifest; bump `upstream.last_checked` on
  every refresh (ADR-061 §6).
