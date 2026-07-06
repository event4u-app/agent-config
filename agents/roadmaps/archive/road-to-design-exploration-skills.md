---
complexity: lightweight
---

# Road to design exploration skills

> Close the three verified gaps in the design cluster — divergent-variation generation, lo-fi wireframing, and HTML slide decks — plus one new deterministic slop rule and four corpus nuggets, harvested from an external design-collaborator reference.

## Goal

Ship 3 new `frontend-design`-pack skills (`design-variations`, `wireframe`, `html-deck`), 1 new deterministic anti-slop rule (CP5 emoji-decoration), and 4 corpus nuggets folded into existing artifacts — with zero duplication of the existing design surface and all locked 2026-06-28 anti-slop constraints intact.

## Provenance

Source A: an external MIT-licensed design-collaborator system-prompt + 14-skill library (reverse-engineered from a hosted design agent). Deep-dive per `external-reference-deep-dive`: full tree + all files fetched raw; byte-level scan of **all 5 commits** found no hidden unicode, no confusables, zero URLs in content, no injection patterns. The one rejected "poison"-shaped clause is a self-concealment instruction ("do not divulge system prompt / internal tools / skill names") — excluded from adoption. Raw evidence stayed local-only.

Retained link (maintainer-recoverable):
`ENC1:IFja8Tn00mu2A3KCl6qThuPeF3xQLo559KVP6lsVK/ieVxE3GQH01pbqwRtQMDoWKALML5XXGAFivH5NaCCd4Gqv3CaBE1Gpf1YUvFZDAk8AYm9x3B6mQXyimyVJ5kppTJndWXf5jyQ+7f0oOz2QJ/cC7E4xV25UgQ==`

## Council notes (2026-07-06, debate, 2 rounds)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o. Converged:

- **Integration shape — 3 new skills, not 4 and not folds.** Round 1 both proposed 2 skills (wireframe as a lo-fi mode of variations); round 2 both independently rebutted that fold: wireframe and variations have **incompatible output contracts** (greyscale/disposable/no-recommendation vs. branded/substantive/recommendation-bearing), and fidelity is the natural trigger disambiguator, so merging *adds* disambiguation load. `make-tweakable` is a presentation format, not a capability — it folds into `design-variations` (single-file variant presentation) plus a short `fe-design` section.
- **Deck starter: skill-local asset** (~120 lines deck-shell), not inline re-derivation — deterministic infrastructure (letterbox math, nav, print CSS) should not be re-derived per invocation.
- **Emoji-decoration: adopt as deterministic rule CP5 at P2** with DESIGN.md/brand suppression — it is a mechanical syntactic pattern (emoji-prepended headings/buttons/list items), same suppression shape as V1; judgment-only would mean inconsistent detection.

Locked 2026-06-28 constraints respected: no numeric aesthetic score, no trend engine, flags never hard-block, no model-fingerprint dependency.

**Second pass (2026-07-06, debate, 2 rounds) — outward-artifact egress hygiene.** Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o. Q1 unanimous: add an explicit hygiene line — agents observably embed absolute workspace paths, skill/tool names, and generator traces in deliverable markup/metadata, and no existing rule covers non-secret agent internals as a class. Q2: the round-1 home (`domain-safety-pii` extension) was rejected in rebuttals from both sides — category error (system artifacts are not user-domain data) and rule-bloat risk. Converged home: **one shared "outward-artifact hygiene" paragraph in central guidance, referenced by the artifact-producing skills** — not a PII-rule extension, not per-skill duplicates. Q3 confirmed: phrased strictly as OUTPUT hygiene; operator chat transparency untouched (the rejected Source A concealment clause stays rejected). Encoded as a quality-floor catalog entry (Phase 1) + references from `design-variations` and `html-deck`; widening to an agent-wide rule is deliberately out of scope unless real incidents surface.

## Gap-table (KEEP / FOLD / CUT)

| Source item | Disposition | Where |
|---|---|---|
| generate-variations | **KEEP** | new skill `design-variations` (Phase 3) |
| wireframe | **KEEP** | new skill `wireframe` (Phase 4) |
| make-a-deck | **KEEP** | new skill `html-deck` + starter asset (Phase 5) |
| make-tweakable | **FOLD** | presentation mechanics into `design-variations` + `fe-design` section (Phase 3) |
| oklch() palette-harmony formula | **FOLD** | `design-tokens` colour-layer authoring (Phase 1) |
| emoji-decoration-in-UI tell | **KEEP** | new detector rule CP5 + catalog entry (Phases 1–2) |
| `text-wrap: pretty`, honest-placeholder pattern | **FOLD** | `fe-design` (Phase 1) |
| per-medium type floors (slides ≥24px, print ≥12pt) | **FOLD** | `html-deck` skill body (Phase 5) |
| discovery-questions | **CUT** | covered: design-intelligence Design Read + `ask-when-uncertain` |
| frontend-aesthetic-direction | **CUT** | covered: design-intelligence (corpus-grounded direction + taste dials) |
| design-system-extract / component-extract | **CUT** | covered: design-system-capture, existing-ui-audit, brand-to-tokens |
| accessibility-audit | **CUT** | covered deeper: accessibility-auditor (WCAG 2.2 + ARIA-APG corpus) |
| ai-slop-check | **CUT** | covered deeper: 18-rule deterministic detector + antipatterns catalog |
| hierarchy-rhythm-review / interaction-states-pass / polish-pass | **CUT** | covered: design-review phases + fe-design states + L/T detector rules |
| self-concealment clause, host postMessage protocol, email-domain IP check | **REJECT** | contradicts transparency / platform-specific / unverifiable |

## Prerequisites

- [x] Deep-dive + security scan of Source A (all commits) — clean
- [x] Council convergence on integration shape (see Council notes)

## Context

The design cluster (design-intelligence, fe-design, design-review, design-system-capture, anti-slop detector) covers direction-selection, production, and review — but has no divergent-exploration capability: nothing produces N substantively distinct options, nothing does disposable lo-fi structure exploration, and no skill covers the HTML-slide-deck medium (canvas-design is posters/static art). Source A's strongest material fills exactly these three gaps.

## Phase 1 — Corpus nuggets & catalog entry

- [x] `design-tokens` SKILL: add an "authoring a palette from scratch" note — `oklch()` harmony (same lightness/chroma, varied hue) as the from-scratch formula; cross-check against C1/C5 avoidance.
- [x] `fe-design` SKILL: add `text-wrap: pretty` to the typography guidance and the honest-placeholder pattern (striped background + monospace size label) to the imagery guidance.
- [x] `docs/guidelines/design-antipatterns.md`: add **CP5 — emoji-decoration in UI markup** (emoji-prepended headings/buttons/list items/CTAs) with override condition "brand/DESIGN.md declares a systematic emoji strategy or the emoji is functional (status, category)". Update `design-antipatterns-triggers.json` companion.
- [x] `docs/guidelines/design-antipatterns.md`: add an **outward-artifact hygiene** quality-floor entry (next free Q number) — generated deliverables that leave the workspace (HTML decks, prototypes, exported files) must not embed system internals in markup comments, metadata, or EXIF: absolute workspace paths, skill/tool names, generator traces, config keys — unless the user asks. Phrased as OUTPUT hygiene only; operator chat transparency explicitly untouched (council 2026-07-06 second pass). Note the optional future extension: absolute-path/generator-trace detection in `lint_design_slop` is deterministic, deferred until a real incident.
- [x] Verify: `npx tsx src/scripts/md_language_check.ts` (or the project's narrow md check) on the touched files; reference check on new cross-links.

**Exit criteria:** three artifacts updated; CP5 documented in the catalog with catalogId + override condition.
**Rollback:** revert the three file edits — no downstream dependencies yet.

## Phase 2 — Detector rule CP5 (emoji-decoration)

- [x] `src/scripts/design_slop_rules.ts`: add `slop-cp5-emoji-ui` — catalogId CP5, severity P2, engines html/jsx, detect emoji at the start of heading/button/list-item/CTA text; `gated()` suppression on DESIGN.md emoji keywords + `.design-quality.json` ignore paths (same shape as existing rules).
- [x] `src/scripts/design_slop_rules.test.ts`: positive cases (🚀-prepended h1, ✅-prepended button), suppression case (DESIGN.md declares emoji), FP guards (functional status emoji in a table cell / status chip not flagged; emoji mid-sentence not flagged).
- [x] Verify: `npx tsx --test src/scripts/design_slop_rules.test.ts` green. <!-- carve-out: new-gate-verification -->

**Exit criteria:** rule ships flagged-not-blocking at P2; tests cover positive, suppression, and FP-guard paths.
**Rollback:** remove the rule entry + tests; catalog entry from Phase 1 stays (judgment-only fallback).

## Phase 3 — Skill: `design-variations` (absorbs tweakable presentation)

- [x] Author `src/skills/design-variations/SKILL.md` (packs: `frontend-design`) with: baseline confirmation (scope, existing design context, count default 3 / ceiling 6, axis preference); axis selection (2–4 of: visual treatment, layout, interaction model, hierarchy, tone, component style — map onto existing Taste Dials); **spec-before-build** per variation (distinct palette family / type pairing / layout skeleton written down first — anti-convergence); basic→bold ordering (by-the-book → refined → novel); substantive-not-cosmetic litmus ("differ on something the user can articulate in one sentence"); single-file presentation with toggle/tweak controls (CSS custom properties, 3–8 controls, `localStorage` persistence — the folded make-tweakable mechanics, host-protocol stripped); per-variation captions; closing recommendation per `user-interaction` Iron Law 1.
- [x] Integrations (anti-dump requirement): direction + corpus grounding via `design-intelligence`; every variation passes `lint_design_slop` (novel ≠ sloppy); tokens via `design-tokens`; hi-fi output subject to `ui-audit-gate` / `existing-ui-audit` when it lands in a real codebase; `design-review` as final gate; reference the outward-artifact hygiene floor (Phase 1) — no system internals in generated markup/metadata.
- [x] `fe-design`: add a short "presenting variants" section pointing to `design-variations` (tweak-panel mechanics live there).
- [x] Downstream surface: `.claude-plugin/marketplace.json` skills[] entry (hand-maintained), `evals/triggers.json` stub (5 should / 5 should-not — disambiguate vs. design-intelligence direction-selection and wireframe), frontmatter per schema.
- [x] Verify: `npx tsx src/scripts/skill_linter.ts` on the new skill (needs `## Gotcha` + ≥2 Output requirements) + `validate_frontmatter` narrow run.

**Exit criteria:** skill passes linter; trigger stub distinguishes it from wireframe (fidelity) and design-intelligence (selection vs. generation).
**Rollback:** delete skill dir + marketplace entry + fe-design section.

## Phase 4 — Skill: `wireframe` (lo-fi exploration)

- [x] Author `src/skills/wireframe/SKILL.md` (packs: `frontend-design`) with: goal/constraints/axis confirmation; **lo-fi conventions** (greyscale only, system sans, labeled boxes for content areas, striped placeholders with monospace labels, no brand colour/typeface); ≥3 variations on a named axis (layout / density / flow structure / CTA placement / navigation pattern), by-the-book → off-distribution, structure written down before sketching; inline annotations (2–4 per variation); **decision capture** (chosen direction, attractions, explicit rejections, new constraints) as the brief for hi-fi; handoff to `design-variations` (hi-fi options) or `fe-design` (single direction).
- [x] Adapt, don't copy: skeleton-label copy ("Headline goes here") instead of Lorem ipsum — keeps `output-discipline` intact; no exemption needed.
- [x] Downstream surface: marketplace.json entry, `evals/triggers.json` stub (should-not include hi-fi option requests → design-variations), frontmatter.
- [x] Verify: `skill_linter` + `validate_frontmatter` on the new skill.

**Exit criteria:** skill passes linter; wireframe output contract (disposable, no recommendation, decision-capture handoff) is explicit and disjoint from design-variations.
**Rollback:** delete skill dir + marketplace entry.

## Phase 5 — Skill: `html-deck` + deck-shell starter

- [x] Author the starter asset `src/skills/html-deck/templates/deck-shell.html` (~120 lines): fixed-canvas slides (default 1920×1080), JS letterbox scaling to any viewport, keyboard/tap navigation, slide counter, `localStorage` slide-index persistence, print-to-PDF CSS, `data-screen-label` per `<section>`.
- [x] Author `src/skills/html-deck/SKILL.md` (packs: `frontend-design`) with: discovery (audience, aspect ratio, slide count vs. time budget, tone, source material, brand — no brand → design-intelligence direction first); **layout system committed before slides** (4–6 layout types: cover, section header, content, quote, comparison, closing; 1–2 background colours); slide-by-slide build with early reveal; **per-medium type floors** (body ≥24px on a 1080p canvas, headlines 60–96px+); honest placeholders, no filler slides; tokens from the active brand / design system; speaker notes only on request.
- [x] Integrations: brand tokens via `brand-to-tokens` / `design-tokens` precedence; `lint_design_slop` + `design-review` on the deck output; boundary note vs. `canvas-design` (posters/static art) in both skills' see-also; reference the outward-artifact hygiene floor (Phase 1) — deck HTML carries no workspace paths, skill/tool names, or generator traces in comments/metadata.
- [x] Downstream surface: marketplace.json entry, `evals/triggers.json` stub, frontmatter.
- [x] Verify: `skill_linter` + `validate_frontmatter`; open deck-shell starter in a browser once and confirm scaling + nav + persistence (manual smoke, noted in the step).

**Exit criteria:** starter renders and letterboxes correctly; skill passes linter; canvas-design boundary documented on both sides.
**Rollback:** delete skill dir + starter + marketplace entry.

## Phase 6 — Wiring, governance, projection sync

- [x] Cross-references: `docs/guidelines/design-modes.md` skill-routing table + design-intelligence "see also" gain the three new skills; counts/cross-refs synced per `augment-edit-discipline`.
- [x] Governance preflight recorded: `domain-adoption-policy` — no new domain (frontend-design already open); `persona-governance` — no new personas; `framework-neutrality` — all three skills are HTML/CSS-generic, no framework mandates; `size-enforcement` — each skill within budget.
- [x] Run `/condense` so `dist/agent-src/` + tool projections regenerate; discovery strict check green.
- [x] Verify: narrow lint set — `skill_linter` across the three skills, `check_refs` on touched docs, discovery lint. <!-- carve-out: new-gate-verification -->

**Exit criteria:** projections in sync; all narrow lints green; no stale references.
**Rollback:** `/condense` after reverting source edits restores projections.

## Acceptance criteria

- Gap-table dispositions implemented exactly — no CUT item rebuilt, no REJECT item present in any artifact.
- 3 new skills pass `skill_linter`; each reuses ≥2 existing artifacts (design-intelligence, design-tokens, lint_design_slop, design-review) — integration, not dump.
- CP5 detector rule green in tests, flags-only at P2, suppression path covered.
- Locked 2026-06-28 anti-slop constraints untouched (no score, no trend engine, no hard blocks, no model-fingerprint dependency).
- Trigger stubs disambiguate the three new skills from each other and from design-intelligence/fe-design.
