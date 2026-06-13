# Domain watch — generative brand-asset suite (Gemini logo/CIP/icon/banner/social)

> Watch-only note per `domain-adoption-policy` § "What to do when the gates
> fail". Phase 7 of `road-to-frontend-design-intelligence` is marked
> `[-] gated` against this note.

## What was evaluated (2026-06-07)

The upstream external reference suite's sub-skills `design`
(v2.x monolith), `slides`, and `banner-design` — Gemini-image-model + Chrome
screenshot generators (logo 55 styles, CIP 50 deliverables, SVG icons, banners,
social photos). Heavy external deps: `google-genai`, `pillow`, Node, Chrome,
`GEMINI_API_KEY`. Upstream pin: `b7e3af80f6e331f6fb456667b82b12cade7c9d35`
(also pins the deferred brand→token `.cjs` scripts: `sync-brand-to-tokens`,
`inject-brand-context` — ADR-061 §8 Fork D).

## Gate results

| Gate | Result | Missing |
|---|---|---|
| 1 — Demand signal | **FAIL** | No ≥2 consumer projects needing generative brand assets; no named user direction with target project/timeline; no incident pull. The corpus adoption itself was demanded — the generative suite was not. |
| 2 — Named maintenance owner | **FAIL** | No owner volunteered for a Gemini-API-pinned, Chrome-pinned toolchain (highest rot velocity in the upstream suite). |
| 3 — CI-tooling decision | **NOT DRAWN** | Would require `GEMINI_API_KEY` + Chrome on runners (real spend per run) or explicit reference-only status. Decision deferred until Gates 1–2 have evidence. |

## Re-open trigger

Any of: a consumer project asks for logo/brand-asset generation with a target
and timeline; a second AI-image domain lands making the adapter surface shared;
a maintainer volunteers ownership with a quarterly cadence.

## If reopened

Adapt into `pack-ai-video` (reuse `image-creator`, `canvas-design`, provider
adapters + provider-lifecycle + media-governance policies) — do **not** fork a
second image-gen stack. See ADR-061 §9 and
`road-to-frontend-design-intelligence` Phase 7.
