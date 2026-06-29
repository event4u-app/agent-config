# Design Canon — named-systems grounding index

> Lazy-loaded reference. Pull this when a brief names (or a project's
> `components.json`/deps signal) a published design system, type, or colour
> reference — so the design is **grounded in named canon**, not improvised.
> Used by `design-intelligence`; cross-linked from `typography-system`,
> `iconography`, `design-tokens`, `brand-to-tokens`, `icon-consistency`.

This is a thin **index** — names, one-line summaries, and a "pull this when"
trigger. It deliberately does **not** bundle the multi-megabyte specs; fetch
the live spec only when the trigger fires (the canonical URLs below are the
fetch targets). Precedence (per `brand-source-of-truth`): **consumer brand
tokens > confirmed session decisions > named canon (this index) > generated
corpus.** Canon is a gap-filler, never an override of a registered brand value.

## Design systems

| System | Signature traits (one-line) | Pull this when |
|---|---|---|
| **Material 3** (Google) | Dynamic colour from a seed (HCT), tonal palettes, elevation by tint not shadow, expressive motion (emphasized easing). | brief says "Material" / "Android"; deps `@mui/material`, `@angular/material`, `react-native-paper`. Spec: m3.material.io |
| **Apple HIG** | Platform-native clarity/deference/depth, SF type + Dynamic Type, system materials/vibrancy, restrained motion, large touch targets. | brief targets iOS/iPadOS/macOS/visionOS, "native Apple feel". Spec: developer.apple.com/design |
| **Fluent 2** (Microsoft) | Neutral-forward, acrylic/reveal materials, Segoe/Fluent type ramp, depth via subtle shadow, enterprise density. | brief says "Fluent"/"Windows"/"Office"; deps `@fluentui/*`. Spec: fluent2.microsoft.design |
| **Carbon** (IBM) | 2px grid, IBM Plex type, strong data-viz system, productive vs expressive themes, accessibility-first. | brief says "Carbon"/"IBM"/data-heavy enterprise; deps `@carbon/*`. Spec: carbondesignsystem.com |
| **Ant Design** | Dense enterprise/admin, comprehensive component set, token-based theming (v5), wireframe-driven. | brief says "Ant"/admin console/CRUD-heavy; deps `antd`. Spec: ant.design |
| **Atlassian** | Product-suite consistency, ADS tokens, calm neutral + bold primary, strong empty/loading patterns. | brief says "Atlassian"/Jira-like; deps `@atlaskit/*`. Spec: atlassian.design |

Grounding rule: surface the matching one-liner, then **offer to pull the live
spec** before committing to the system's conventions. Never reproduce a brand
book's marks; ground against the *system's* documented principles.

## Typography craft (foundry + theory)

A one-line index — point `typography-system` here; do not inline the content.

- **Theory:** Butterick's *Practical Typography* (practicaltypography.com — line-length, measure, hierarchy rules), *Thinking with Type*.
- **Calibration / "in use":** Typewolf, Fonts In Use (real pairings, not defaults).
- **Quality foundries** (beyond the AI-default fonts the anti-slop catalog T7 flags): Klim, Lineto, Colophon, Commercial Type, Grilli Type; libre: League of Movable Type, Google Fonts (chosen deliberately, not reflexively).
- Pull when: a brief calls for a distinctive type voice, or to escape the Inter/Roboto/Geist default.

## Colour references

Names + when-to-use — not the palettes themselves.

- **Accessibility / contrast:** WCAG contrast checkers (e.g. APCA, WebAIM) — verify text/non-text contrast (ties to `lint_design_quality` Q1 + anti-slop C4). Pull on any colour decision that must clear AA.
- **Culturally-specific palettes:** Nippon Colors (traditional Japanese), Chinese Colors — pull when the brand/audience is culturally situated and a Western default palette would read as generic.
- **Systematic palette tools:** the design systems above ship their own token palettes — prefer the system's palette over an ad-hoc picker when a system is in play.

## Icon systems

Each design system ships a matching icon set — prefer it when that system is in
play (consistency over novelty, per `icon-consistency`): **Material Symbols**
(Material 3, variable weight/fill/grade), **SF Symbols** (Apple HIG, weight-
matched to SF text), **Fluent UI System Icons** (Fluent), **Carbon icons**
(Carbon). Outside a named system, the `iconography` skill resolves a single
Iconify set (Lucide / Phosphor / Heroicons / Tabler) — pick one and stay in it.
Pull when: choosing or auditing an icon library.

## See also

- `docs/guidelines/design-antipatterns.md` — the anti-slop catalog (T7 default-font tell, C1/C5 palette tells) this canon helps you escape.
- `brand-source-of-truth` / `brand-consistency` — the precedence this index obeys.
- `design-intelligence` — the consumer that surfaces these on a brief signal.
