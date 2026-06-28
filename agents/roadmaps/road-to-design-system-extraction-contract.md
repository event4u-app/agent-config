---
complexity: structural
status: ready
---

# Road to a Design-System Extraction Contract

> Teach `design-system-capture` to CONSUME an extracted `design-system.json` (tokens, fonts, spacing, motion, components) produced by any external static-extraction tool — so a consumer can reverse-engineer an existing site/repo's look-and-feel and our skill grounds against it. We define the consumer-side contract only; we do NOT build the Playwright/screenshot extraction engine in-package.

## Goal

Add an **import contract**: a documented `design-system.json` schema that `design-system-capture` can read to seed/merge a consumer's `DESIGN.md`. This lets a team extract a design system from a live URL, a git repo, or a local dir using whatever standalone tool they like, then hand the artifact to our skill — closing the "we can author a design system but can't capture an existing one from a target" gap, without dragging a heavy runtime extraction engine into the package.

## Context

**What we have:**
- `design-system-capture` (rich) — writes/maintains `DESIGN.md`/`PRODUCT.md` (cross-session design memory: radius/shadow/motion/spacing/colour decisions); `design-intelligence` reads it and lets it override the corpus.
- `design-tokens` / `brand-to-tokens` — author a DTCG `.tokens.json` source of truth.
- `existing-ui-audit` — inventories an existing *codebase's* components/tokens into `state.ui_audit`.

**What the Source E reference adds (deep-dived 2026-06-28):** a static-analysis CLI that reverse-engineers a design system from a live URL / git repo / local dir (zero AI, zero API key) — extracts colours, fonts, spacing, animations, components — and emits a `SKILL.md` + a `DESIGN.md`, auto-copied into the agent's skills dir. The interesting capability is **extraction from an arbitrary target**; the heavy parts are a Playwright "ultra" mode (runtime introspection: detect GSAP/Lottie from `window`, walk `styleSheets` keyframes, scroll screenshots) and local font bundling.

**Council verdict (2026-06-28):** This is the **wrong package** to host the extraction engine — "build-time extraction tool, not agent guidance," runtime-heavy, fragile across 7 hosts (sonnet, explicit). ADOPT the **consumer-side contract only**: teach `design-system-capture` to *read* an extracted `design-system.json`; "let consumers generate that artifact however they want." gpt ranked the capability high but the council's shared resolution is: own the contract, not the crawler. Ranked #5 (after detector/dials/shadcn/canon) — real value, narrow scope.

## Token-optimization stance

The contract is a JSON schema + a thin import step in `design-system-capture` (already `rich`, no budget change). The extracted artifact is a consumer file (read transiently, merged into `DESIGN.md`), never loaded into always-on context. By refusing the extraction engine we also avoid shipping Playwright/screenshot machinery — keeping the package lean and host-portable. The frugal move here is *scoping out* the runtime, not adding budget.

## Prerequisites

- `design-system-capture` is the consumer of the contract.
- Reuse the DTCG `.tokens.json` shape from `design-tokens`/`brand-to-tokens` where the extracted tokens map cleanly (don't invent a parallel token format).

## Phase 0 — Define the import contract

- [ ] Specify `design-system.json`: `colors` (with light/dark), `typography` (families + scale; note when fonts are bundled locally), `spacing`, `radius`, `shadow`, `motion` (durations/easings, detected libs as metadata), `components` (name + observed class/prop patterns), `source` (url|repo|dir + a captured-at stamp). Map fields to DTCG where possible; mark extraction-only metadata clearly.
- [ ] Document trust posture: an extracted artifact is *observed*, not *authoritative* — it seeds `DESIGN.md` as a proposal the human confirms (mirrors `source-discovery` evidence-vs-authoritative discipline). Never let an import silently override a confirmed brand token (`brand-source-of-truth`).

## Phase 1 — Import into design-system-capture

- [ ] Add an "import extracted design system" path to `design-system-capture`: read `design-system.json`, diff against the current `DESIGN.md`, surface a confirm/merge proposal (per-field accept), then persist. Conflicts with a registered brand value are flagged, never auto-applied.
- [ ] Hand mapped tokens to `design-tokens`/`brand-to-tokens` to materialise `.tokens.json` where the consumer wants a token source of truth.

## Phase 2 — Bridge to existing-ui-audit

- [ ] Where the target is the *current* repo (not an external site), prefer `existing-ui-audit` (we already inventory the codebase) and let it emit the same `design-system.json` shape, so the import path is uniform whether the source is "our repo" or "an external artifact."
- [ ] Document the two sources clearly: external target → external tool emits the artifact; current repo → `existing-ui-audit` emits it.

## Phase 3 — Verify

- [ ] Smoke: feed a hand-authored `design-system.json` → `design-system-capture` proposes a `DESIGN.md` merge with per-field confirm; a field conflicting with a registered brand token is flagged not applied.
- [ ] Confirm no Playwright / browser-runtime dependency entered the package. Run gates green.

## Explicitly out of scope (council hard-rejects)

- No in-package Playwright "ultra" runtime introspection (GSAP/Lottie detection, styleSheet-keyframe walking, scroll screenshots) — that is a standalone build-time tool, not agent guidance.
- No `.skill`=zip auto-install-to-`~/.claude/skills/` mechanism — we have our own distribution.
- No local font-download/bundling pipeline in-package.
- We OWN the import contract; we do NOT own the crawler.

## Provenance

Source link retained encrypted per `source-confidentiality` (decrypt with the maintainer key via `src/scripts/_lib/link_crypto`):

- Source E — an external static design-system reverse-engineering CLI — `ENC1:TQo27fraMUOfQEYI/k/W5Dy5NkrSOkgVBcWF//sZo8K7KERevyAUBIN+Utb4BEAmCiiP7bFfXccyvH4jTBfhvg==`
