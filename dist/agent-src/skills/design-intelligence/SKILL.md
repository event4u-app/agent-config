---
model_tier: inherit
name: design-intelligence
description: "Grounded design brief from the adopted corpus — style, WCAG-checked color tokens, typography, layout pattern, anti-patterns. Use on ui-design-brief or any which-style/palette/font/chart decision."
source: package
domain: engineering
personas:
  - frontend-engineer
workspaces:
  - engineering
packs:
  - frontend-design
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
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
> `directives/ui/design.py` is unaffected.
>
> **Boundary (council-locked):** `design.py` stays a pure orchestration
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

## Procedure: Produce a grounded design brief (`ui-design-brief` rebound)

1. **Ground** (one call — engine runs the manifest's plan
   product → style → color → landing → typography with decision rules):

   ```bash
   python3 <skills-root>/corpus-grounding/scripts/ground.py ground \
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

### Font fallback (no google-fonts index — by design)

The 745 KB Google-Fonts index was rejected (ADR-061 §8): it duplicates a
public API. When a requested font is outside `typography.csv`'s 73
pairings: query `https://fonts.google.com/specimen/<Family>` (or the
`webfonts` API) for metadata, OR propose the nearest curated pairing and
say why. Never invent pairing metadata.

## `MASTER.md` + page overrides ↔ `state.ui_design` (mapping)

The upstream cross-session memory pattern maps onto our delivery state:

| Upstream artifact | Our state | Notes |
|---|---|---|
| `design-system/<project>/MASTER.md` | `state.ui_design` (project-level brief: style, tokens, typography, anti-patterns) | The state is the source of truth during a run. |
| `design-system/<project>/pages/<page>.md` | per-page override entries inside `state.ui_design` (e.g. `pages.<page>` dict) | Page rules override project rules for that page only. |

File persistence stays **opt-in** (`ground … --persist <dir>`) and writes
under the consumer's project as a durable artifact for multi-session
consistency; on a fresh session, re-hydrate `state.ui_design` from
`MASTER.md` + the page file before re-running `design`.

## Grounding the review/polish a11y gate (charts + contrast)

The `review`/`polish` steps gate on `state.ui_review.a11y`. Ground two
finding classes instead of ad-hoc judgment:

- **Chart-type findings** — `…/ground.py search --manifest … --domain
  chart "<data shape>"` → `Accessibility Grade`, `A11y Fallback`,
  `Color Guidance` columns justify "wrong chart type / missing colorblind
  fallback" findings with a citable row.
- **Contrast findings** — `--domain color "<product>"` returns the
  WCAG-adjusted token set; a finding that a hex pair deviates from the
  adopted set cites the row instead of eyeballing ratios. Auditing
  *method* stays with [`accessibility-auditor`](../accessibility-auditor/SKILL.md).

## Stack guidance (`--stack` axis)

Per-framework Do/Don't corpora (16 stacks) ride the same manifest:

```bash
python3 <skills-root>/corpus-grounding/scripts/ground.py search \
  --manifest <skills-root>/design-intelligence/data/manifest.json \
  --stack react "list rerender memo" [--filter "Severity=HIGH"]
```

Stack executors ([`blade-ui`](../blade-ui/SKILL.md),
[`livewire`](../livewire/SKILL.md), [`flux`](../flux/SKILL.md),
[`react-shadcn-ui`](../react-shadcn-ui/SKILL.md),
[`tailwind-engineer`](../tailwind-engineer/SKILL.md)) pull idiomatic
guidance + docs URLs from here instead of memory.

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
- Do NOT import the engine into `directives/ui/design.py` — council
  boundary; the corpus call lives in this skill layer.
- Do NOT propose a new component the `existing-ui-audit` inventory
  already covers — audit findings outrank corpus suggestions.
- Do NOT hide low confidence — the user signs off on the gaps too.

## Interplay (who owns what)

| Concern | Owner |
|---|---|
| What already exists (components, tokens) | [`existing-ui-audit`](../existing-ui-audit/SKILL.md) — mandatory pre-step; audit findings outrank corpus suggestions |
| What to build (grounded selection) | **this skill** |
| Stack-agnostic heuristics + flow | [`fe-design`](../fe-design/SKILL.md) — invokes this skill for grounding |
| Orchestration gates + locks | `directives/ui/{design,review,polish}.py` — never import the engine |
| WCAG audit method | [`accessibility-auditor`](../accessibility-auditor/SKILL.md) |
| Token authoring | [`design-tokens`](../design-tokens/SKILL.md) |

## Gotchas

- Corpus grounds **pre-action selection** — do not use it as mid-task
  reference (open `references/` instead) or as a validator (rules own that).
- Empty result ≠ error: surface the evidence gap and proceed on priors.
- Keep queries product-shaped ("fintech dashboard", "luxury e-commerce
  mobile") — the detect map routes generic words to `style`.

## Policies

- Upstream MIT + Apache-2.0 obligations: [`ATTRIBUTION.md`](ATTRIBUTION.md).
- Refresh: quarterly per the manifest; bump `upstream.last_checked` on
  every refresh (ADR-061 §6).
