---
complexity: structural
status: ready
---

# Road to Design-Canon Grounding

> Add a thin, lazy-loaded `design-canon.md` reference — named design systems (Material, Apple HIG, Fluent, Carbon, Ant) + typography foundries/theory + colour tools (incl. culturally-specific palettes + a11y contrast) with one-line summaries — so `design-intelligence` can ground a brief against published canon and lazy-load a full spec only when the brief signals it.

## Goal

Give the design cluster a **canon index**: the named, published design systems and craft references a serious designer grounds against, as a compact lookup (names + one-line summaries + when-to-pull). The big specs are NOT loaded — `design-intelligence` lazy-loads one only when the brief or `components.json` signals it (e.g. "Material-inspired", or `@mui/material` present).

## Context

**What we have:**
- `design-intelligence` (rich) grounds from an internal corpus (84 styles, 73 font pairings, WCAG colour sets) — strong on *generated* style knowledge, lighter on *named published canon*.
- `corpus-grounding` skill + the "audit findings outrank corpus" principle.
- `brand-source-of-truth` / `brand-consistency` rules (ground against the consumer's brand, not improvise).
- `typography-system`, `iconography` skills.

**What the Source C reference adds (deep-dived 2026-06-28):** a curated 16-category design-knowledge taxonomy whose highest-signal section is **Styleguide & Branding** — an index of the actual published canon (Apple HIG, Material, Fluent, Carbon, Ant, plus brand books) — alongside typography foundries/theory (Butterick, Typewolf, real foundries) and colour tools including *culturally-specific* palettes (Nippon/Chinese Colors) and a11y contrast checkers. The signal is structural: design competence is grounded in named systems + treats typography/colour as crafts with canon, not as CSS properties.

**Council verdict (2026-06-28):** ADOPT as enrichment, but **lazy-load** — a `design-canon.md` with NAMES + one-line summaries + a pull-trigger; the multi-megabyte specs are fetched only on signal. "This is ALREADY your model" (mirrors how `design-antipatterns.md` is a lazy-loaded prose catalog). Ranked mid (#4) — lower leverage than detector/dials, but cheap and reinforces the existing brand-source-of-truth posture.

## Token-optimization stance

The whole point is frugality: `design-canon.md` is a thin index (names + one-liners + a `load_context`-style pull trigger), not a corpus. It loads only when `design-intelligence` is already active AND the brief names a system. The actual spec content is never baked into the package — at most an encrypted/neutral pointer or a "fetch when signalled" instruction. No `token_budget_class: rich` change; the index is small enough for standard budget.

## Prerequisites

- `design-intelligence` is the consumer of the canon index.
- Aligns with `brand-source-of-truth` (consumer brand > canon > generated corpus).

## Phase 0 — The canon index

- [ ] Author `docs/guidelines/design-canon.md`: a compact table of named design systems (Material 3, Apple HIG, Fluent, Carbon, Ant, Atlassian) — each a one-line summary (token model, motion stance, signature traits) + a "pull this when" trigger (brief keyword or `components.json` dependency).
- [ ] Add a typography-craft sub-section: foundry/theory references as a one-line index (point `typography-system` at it; do not inline the content).
- [ ] Add a colour sub-section: tool classes incl. accessibility-contrast and culturally-specific palettes — names + when-to-use, not the palettes themselves.

## Phase 1 — Wire into design-intelligence (lazy)

- [ ] Add a "canon grounding" step to `design-intelligence`: if the brief names a system OR `components.json`/deps signal one (`@mui/material`, `antd`, `@fluentui/*`, `@carbon/*`), surface the matching canon one-liner and offer to pull the full spec (lazy fetch / pointer), rather than improvising.
- [ ] Make the precedence explicit and consistent with `brand-source-of-truth`: consumer brand tokens > confirmed session decisions > named canon > generated corpus. Canon is a gap-filler, never an override of a registered brand value.

## Phase 2 — Cross-link the craft skills

- [ ] `typography-system` references the typography-craft sub-section for foundry/theory grounding.
- [ ] `iconography` / `icon-consistency` reference the icon-system canon entries.
- [ ] Note the colour-canon entries from `design-tokens` / `brand-to-tokens` where culturally-aware or a11y-contrast grounding helps.

## Phase 3 — Verify

- [ ] Smoke: a "Material-inspired dashboard" brief surfaces the Material canon one-liner + offers the lazy pull; a generic brief does NOT load any canon spec (frugality check).
- [ ] Confirm `design-canon.md` is lazy-loaded (not always-on) and stays a thin index. Run gates green.

## Explicitly out of scope

- No bundling of multi-megabyte design-system specs into the tracked tree.
- No always-loaded canon prose — index + pull-trigger only.
- No re-implementation of the source's link collection; we take the *taxonomy/structure* (named-canon-as-grounding), not the link list.

## Provenance

Source link retained encrypted per `source-confidentiality` (decrypt with the maintainer key via `src/scripts/_lib/link_crypto`):

- Source C — an external curated design-knowledge taxonomy — `ENC1:wOAdrwJg3Zzz1Mau9lCSQ1Dkm6F3g7JxmNgdMNnJFWUE/+QBAdu0/l2rsCsIqKO+305oTNDnCB4xaI40E08upA==`
