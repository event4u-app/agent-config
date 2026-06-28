---
complexity: structural
status: ready
---

# Road to Taste Dials & Consistency Locks

> Give `design-intelligence` three quantified, brief-inferred taste dials (variance / motion / density), within-project consistency Locks (theme / colour / shape), and hard layout-repetition caps — so "taste" becomes a tunable, checkable configuration instead of an implicit vibe. Reject the gimmicks (seeded randomization, cross-run anti-repetition).

## Goal

Add a small, legible taste-parameterization layer to the design cluster:
1. **Three dials** — `DESIGN_VARIANCE`, `MOTION_INTENSITY`, `VISUAL_DENSITY` (1–10), inferred from the brief and persisted to `DESIGN.md`.
2. **Consistency Locks** — one theme, one accent, one corner-radius scale per project, enforced within-project.
3. **Layout-repetition caps** — zigzag-alternation cap, section-layout-repetition floor, eyebrow-count cap — as deterministic flags.

## Context

**What we have:**
- `design-intelligence` (rich, corpus-grounded) already does brief→style inference *implicitly* and emits a "Design Read" + brand/product register decision.
- `design-system-capture` persists `DESIGN.md`/`PRODUCT.md` (the natural home for dial values + locks).
- Two-register model (brand vs product) already exists.
- `lint_design_quality.ts` deterministic floor (objective metrics).

**What the Source B reference adds (deep-dived 2026-06-28):** quantified taste dials with a "Dial Inference Table" (brief signal → dial values, e.g. *minimalist→low variance/motion/density*; *Awwwards/playful→high*), named consistency Locks (theme/colour/shape), layout-repetition caps as hard fail conditions (max 2 consecutive zigzag sections, ≥4 distinct layout families across 8 sections, eyebrow count ≤ ceil(sections/3)), plus hex-level palette bans and a "why models default" grounding essay.

**Council verdict (2026-06-28):** ADOPT dials + locks + layout-repetition caps (high leverage, consumer-legible, prevents within-project drift). **HARD-REJECT** cross-run anti-repetition ("differ from last project" = novelty-for-novelty, "its own form of slop") and deterministic seeded randomization ("astrology" — randomness serving novelty, not taste). The hex-level palette bans are valuable but belong in the detector registry (see `road-to-anti-slop-detector`), not as new loaded prose.

## Token-optimization stance

Dials + locks are a handful of values written to `DESIGN.md` (consumer file, not context) and a thin guidance block in `design-intelligence` (already `token_budget_class: rich`, no budget change). The layout-repetition caps are deterministic checks → fold into the anti-slop detector registry (zero runtime tokens). The Dial Inference Table is a compact lookup, not a corpus — it fits in the existing rich budget. No new always-loaded prose blobs.

## Prerequisites

- `road-to-anti-slop-detector` Phase 0 (rule registry) — the layout-repetition caps register there.
- `design-system-capture` is the persistence layer for dial values + lock declarations.

## Phase 0 — Dials in DESIGN.md

- [ ] Extend the `DESIGN.md` schema (owned by `design-system-capture`) with a `## Taste Dials` block: `variance`, `motion`, `density` (1–10) + a one-line rationale each. Absent = unset (design-intelligence infers).
- [ ] Add the Dial Inference Table to `design-intelligence` as a compact lookup: brief-signal keywords → dial ranges (minimal/editorial/calm → low; playful/expressive/awards → high; trust/regulated/public-sector → low variance + low motion + mid density). Emit the inferred dials in the "Design Read" line so the user can correct them.
- [ ] On confirmation, persist the dials to `DESIGN.md` via `design-system-capture`.

## Phase 1 — Dials drive generation

- [ ] Map each dial to concrete downstream levers (documented in `design-intelligence`): variance → layout-family spread + asymmetry tolerance; motion → animation budget + reduced-motion posture; density → spacing scale + information-per-viewport. Keep the mapping a table, not prose.
- [ ] Ensure dial values are surfaced to the stack executors (`tailwind-engineer`, `react-shadcn-ui`, `blade-ui`, `flux`) so generation honours them.

## Phase 2 — Consistency Locks (within-project)

- [ ] Define three Locks persisted in `DESIGN.md`: Theme Lock (no mid-page light/dark inversion), Colour Lock (one accent family across the surface), Shape Lock (one corner-radius scale). These are *invariants*, derived from the confirmed design system.
- [ ] Add Lock-violation detection to the anti-slop detector registry (Phase 0 of the detector roadmap): a second accent family, a mid-surface theme inversion, mixed radius scales → flag with the Lock id.

## Phase 3 — Layout-repetition caps (deterministic flags)

- [ ] Add to the detector registry: zigzag-alternation cap (>2 consecutive "image-left + text-right" = flag), section-layout-repetition floor (<4 distinct layout families across ≥8 sections = flag), eyebrow-count cap (count > ceil(sections/3) = flag). All arithmetic, all deterministic, zero runtime tokens.
- [ ] Gate each by the consumer's declared style (a deliberately repetitive brutalist grid can rebut via `DESIGN.md`, per the detector's context-gate model).

## Phase 4 — Verify

- [ ] Smoke: a brief with "minimal, calm, editorial" infers low dials; a brief with "bold, playful" infers high; both persist to `DESIGN.md` and survive a second session (no re-inference drift).
- [ ] Detector fixtures cover each new Lock + layout cap (positive + negative). Run gates green.

## Explicitly out of scope (council hard-rejects)

- No cross-run anti-repetition / palette-rotation memory ("differ from last project").
- No deterministic seeded randomization (prompt-char-count seed → architecture pick).
- No "why models default" theory essay as loaded prose — at most a one-line pointer; the discipline lives in the dials + detector, not in an essay.

## Provenance

Source link retained encrypted per `source-confidentiality` (decrypt with the maintainer key via `src/scripts/_lib/link_crypto`):

- Source B — an external anti-slop frontend "taste" framework — `ENC1:+mDpIGrhUsbMavsmrg1aIN0w3YddiRd4u7gYuMWuEOafB3SVHC2YVQq+ireV6JoDJt65yoakxJ1gl+pxiUCw1g==`
