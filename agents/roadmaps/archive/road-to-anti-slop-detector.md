---
complexity: structural
status: ready
---

# Road to an Anti-Slop Detector (deterministic aesthetic-tell layer)

> Turn our PROSE anti-slop catalog into a zero-runtime-token deterministic detector that flags AI-generated "tells" (cream-palette, side-stripe border, icon-tile-stack, em-dash-overuse, gradient-text) — feeding structured findings into `design-review` instead of reloading a 12 KB catalog every invocation.

## Goal

Ship a deterministic anti-slop **detector** (a linter, not loaded prose) that catches the *aesthetic-provenance* tells our `lint_design_quality.ts` does not — the patterns that make a UI "look like an AI made it." The detector emits structured `{rule-id, severity P0–P3, file:line, context-gate}` findings; `design-review` cites those findings instead of re-deriving them from the prose catalog. **Flags, never hard blocks.**

This is the highest-leverage harvest axis (council 2026-06-28 ranked it #1). It also *resolves* the token tension: the knowledge lives in code (zero context tokens) rather than always-loaded text.

## Context

**What we have:**
- `docs/guidelines/design-antipatterns.md` — the AI-slop catalog as PROSE (Visual V1–V7, Layout L1–L8, Typography/Color tells, originality self-test), lazy-loaded.
- `src/scripts/lint_design_quality.ts` — deterministic CI floor, but **objective only** (Q1–Q6: WCAG contrast, font-size, line-length, reduced-motion, heading hierarchy, focus).
- `design-review` skill — cites the catalog by ID, pass/flag/fail originality self-test, severity triage. No mechanical detector backing it.
- `design-system-capture` — writes consumer `DESIGN.md`/`PRODUCT.md` (the context-gate source).

**What the Source A reference adds (deep-dived 2026-06-28):** a 62-rule deterministic anti-slop detector that names aesthetic-provenance tells a human reviewer recognises (side-stripe border = "the most recognizable tell of AI-generated UIs"; cream/beige "tasteful AI" surface; icon-tile-stack feature-card template; purple/cyan gradient; copy-cadence tells: em-dash-overuse, marketing-buzzword), API-key-free, with per-model gated rules and a severity model. Plus a session-bootstrap gate that reads the consumer's design spec as ground truth.

**Council verdict (claude-sonnet-4-5 + gpt-4o, 2026-06-28):** ADOPT as the top axis, in **hybrid** shape — detector produces structured rule-ID output, `design-review` interprets/cites it. Detector is a **rebuttable presumption** (flag + DESIGN.md context-gate to suppress), not a replacement for judgment, and **never a hard block**. Use real parsers (postcss / `@babel/parser` / Tailwind resolver) as ~200–300 LOC of glue, not from-scratch parsers. ~8% false-positive rate is acceptable *because they are flags*. The pre-edit BLOCK belongs as a linter/CI gate (universal across hosts); a pre-edit hook is OPTIONAL only (host-limited, ~2/7 hosts) and must carry anti-loop deny→allow degradation.

## Token-optimization stance

The detector costs **zero context tokens at runtime** — it runs in Node (CI / pre-commit / optional hook), not in the model's context. `design-review` loads only a thin pointer + the structured findings, never the full catalog. This is the canonical "knowledge → deterministic script" move the council validated; it is *better* than loading prose on low-context hosts (where a 12 KB catalog × N review iterations dominates the window). No `token_budget_class: rich` change is needed here — the win is moving prose OUT of context.

## Prerequisites

- `lint_design_quality.ts` stays the objective floor; the new detector is a sibling, not a rewrite.
- Rule definitions live in a data registry (one entry per tell) so adding a tell is data, not code.

## Phase 0 — Rule registry + parser substrate

- [x] Define the rule-registry schema: `{ id, category (slop|quality), severity (P0–P3), engines[], context_gates[], message }`. One JSON/TS module, additive. <!-- done: src/scripts/design_slop_rules.ts — SlopRule interface + SLOP_RULES (14 rules) -->
- [x] Port the highest-confidence tells from `design-antipatterns.md` into registry entries (start with the unambiguous ones: side-stripe border, gradient-clip text, icon-tile-stack, repeating-gradient stripes, identical 3-card grid, per-section uppercase eyebrow, em-dash-overuse, marketing-buzzword). Each entry cites its catalog ID (V*/L*/T*/C*) so prose ↔ rule stay traceable. <!-- done: 14 rules, each carries catalogId (V1/V3/V6/C2/C5/T4/T6/T7/L4/L8/M2/M4/CP1/CP2). icon-tile-stack(T3) + 3-card-grid(L2) deferred — need DOM-structure analysis, too FP-prone for deterministic v0; left to design-review judgment -->
- [x] Stand up the parser substrate. <!-- ADAPTED: postcss/@babel/tailwind are ABSENT and the existing lint_design_quality is dependency-free BY DESIGN (ships via npx, frugality). Built dependency-free pattern matchers (cssBlocks/visibleText helpers) matching lint_design_quality's proven approach. Council assumed those libs present; for THIS package pattern-based is the correct frugal adaptation. Recorded in design_slop_rules.ts header. -->
- [x] Write the cross-stack adapter contract so the same rule fires regardless of stack. <!-- done: enginesForExt() maps css/scss/less + html/vue/svelte/astro + jsx/tsx + md/mdx to engine-classes {css,html,jsx,copy}. Blade (.blade.php) deferred to a follow-up; CSS + Tailwind classes + inline style + HTML/JSX/MD covered. -->

## Phase 1 — Context gates (rebuttable presumptions, not blocks)

- [x] Read consumer `DESIGN.md`/`PRODUCT.md` (via `design-system-capture` output) as the gate source: a declared palette/font/radius/style keyword (e.g. `brutalist`) suppresses the correlated flag. A tell is a *presumption the project can rebut by documenting intent*. <!-- done: loadDesignContext() reads DESIGN.md (scan dir → cwd → parent); each rule's gated(ctx) suppresses on keyword match. Smoke-verified: declaring Inter suppresses T7. -->
- [x] Add semantic-element exceptions (e.g. `border-left` on `<blockquote>` is not a side-stripe). <!-- done: V1 detect excludes blockquote/quote selectors. -->
- [x] Add density/co-occurrence thresholds (cream alone ≠ flag; cream + beige + brass together = flag; em-dash density > N per 100 words, not absolute presence) — the council's explicit precision lever. <!-- done: C5 requires cream+brass co-occurrence; CP1 uses em-dash density (>2 per 500 words, ≥80-word floor); T4 eyebrow count vs ceil(sections/3). -->

## Phase 2 — Wire into the linter + design-review (the hybrid)

- [x] Add the detector as a new mode of `lint_design_quality.ts` (or a sibling `lint_design_slop.ts`) — exit non-zero only on P0; P1–P3 are reported flags. Slop tells default to flag severity, never CI-fail, to honour "flags not blocks." <!-- done: sibling src/scripts/lint_design_slop.ts. Default exit 0 (flags only); CI opts in via --fail-on <P0|P1|P2|P3>. --json emits structured findings. Smoke-verified. -->
- [x] Update `design-review` to **consume the structured findings** (cite rule-id + file:line + the catalog ID) instead of re-deriving from prose. Keep the human originality self-test for the judgment the detector cannot make. This is the AND architecture, not XOR. <!-- done: src/skills/design-review/SKILL.md "Anti-slop scan" — detector-first (lint_design_slop --json), cite verbatim, then judge T3/L2/V2 + originality self-test. -->
- [x] Update `design-antipatterns.md` to note which catalog entries now have a deterministic detector backing (traceability both directions). <!-- done: added Detection row + "Deterministic detector backing" para listing V1/V3/V6/C2/C5/T4/T6/T7/L4/L8/M2/M4/CP1/CP2; T3/L2/V2 explicitly judgment-only. -->

## Phase 3 — Optional pre-edit hook (host-limited)

- [x] Wire an OPTIONAL pre-edit hook (only on hosts with the surface) that runs the detector on proposed UI content and surfaces P0/P1 flags before the write. Default OFF; opt-in via `.agent-settings.yml`. <!-- done: src/scripts/hooks/design_slop_hook.ts (PreToolUse, warn exit-2, never block); concern `design-slop` registered in hook_manifest.yaml + bound to pre_tool_use on augment/claude/cowork (the ~2-3 hosts with the surface); hooks.design_slop.enabled default false in template + schema. Smoke-verified: OFF→exit0, ON→exit2 warn. -->
- [x] Implement anti-loop degradation: after N repeated flags on the same file+finding signature, downgrade surface→silent (mirrors the reference's deny→allow defuse) so the hook never traps the agent. This is the safety valve the council required. <!-- done: DEGRADE_AFTER=3, state at agents/runtime/state/design-slop-hook.json keyed file::rule. Smoke-verified: runs 1-3 warn (exit2), run 4 silent (exit0). -->
- [x] Document that the hook is a convenience layer; the linter/CI gate is the universal source of truth. <!-- done: stated in the hook header docstring, the hook_manifest concern comment, and the template + schema describe strings. -->

## Phase 4 — Calibration + guard

- [x] Build a small fixture corpus (slop exemplars + intentional-design counter-examples) and measure false-positive rate per rule; demote/ tighten any rule above the agreed FP ceiling. Record the corpus so re-calibration is mechanical. <!-- done: FIXTURES in design_slop_rules.test.ts — 1 positive (must fire) + 1 negative (must be clean = zero-FP on the counter-example) per rule. Negative cases ARE the per-rule FP guard. -->
- [x] Add a CI guard that every registry rule has at least one positive + one negative fixture (no untested tell). <!-- done: test asserts every SLOP_RULES id has a fixture + no orphan fixtures; 20 tests green. -->
- [x] Run `task lint-skills` / relevant gates green; confirm `design-review` cites detector output in a smoke run. <!-- done: skill_linter design-review = PASS (0 issues); design_slop_rules.test.ts 20/20; condensation hashes in sync (check ✅); manifest lint exit 0; lint_design_slop --json smoke produced the structured findings design-review now cites. Note: .claude/.cursor tool-projection of design-review left stale (documented tools:[] generate-tools friction); src/ + dist/ correct + .augment symlinked. -->

## Explicitly out of scope (council hard-rejects)

- No in-browser "live carbonization" direct-manipulation loop (runtime-heavy, fragile across 7 hosts).
- No numeric aesthetic SCORE or trend-over-time engine (Phase B; see `road-to-design-canon-grounding` note) — flags + severity only.
- No model-fingerprint guessing as a hard dependency; per-model gated rules are an optional refinement, not Phase 0.

## Provenance

Source link retained encrypted per `source-confidentiality` (decrypt with the maintainer key via `src/scripts/_lib/link_crypto`):

- Source A — an external anti-slop design skill pack — `ENC1:JWOLqw8iyvW1nEYHT3ysChDMUWA4zPyR2i97KKe65v+V6zAesWogJ0F+JgPRDSK/YfzlRv4PdDIKw5IqkI6Frw==`
