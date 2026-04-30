# Roadmap: Product UI Track

> Lovable-grade product-UI engine on top of `work_engine` (R1) and prompt-driven execution (R2). **Existing-UI-audit is a hard mandatory gate, not nice-to-have.** Universal across stacks (Blade/Livewire/Flux, React/shadcn, Vue, plain HTML/Tailwind), routed by stack-detection. Halt-budget is capped at 2 on the happy path — Lovable feel comes from "user decides once, agent runs", not from three confirmations in a row.

## Prerequisites

- [x] **Roadmap 1 (`road-to-universal-execution-engine.md`) merged** — archived in `agents/roadmaps/archive/`
- [x] **Roadmap 2 (`road-to-prompt-driven-execution.md`) merged** — confidence scoring, prompt resolver, R2 goldens; archived in `agents/roadmaps/archive/`
- [x] Read `.agent-src.uncompressed/skills/fe-design/SKILL.md` — current frontend-design skill (will migrate)
- [x] Read `.agent-src.uncompressed/skills/blade-ui/SKILL.md`, `livewire/SKILL.md`, `flux/SKILL.md` — current Laravel-stack UI skills
- [x] Read `agents/contexts/implement-ticket-flow.md` — updated with R1 + R2 changes
- [x] Re-read `.agent-src.uncompressed/templates/roadmaps.md`

## Context (current state)

After R1 + R2 the engine accepts tickets and prompts and runs the killer loop for backend work. UI work is the gap: `directives/ui/` is a stub raising `NotImplementedError`. The package has UI skills (fe-design, blade-ui, livewire, flux) but they are flat tools — they do not enforce the Lovable mechanic of *audit existing UI first, design before code, polish before ship*.

The differentiator is not "more UI skills". It is **a UI directive set with a mandatory existing-UI-audit pre-step, design-review polish loop, stack-aware implementation dispatch, and a halt-budget that respects the user's time**. That is what turns the engine from "can write UI code" into "produces UI that feels designed".

- **Feature:** product-UI track + mixed orchestration
- **Jira:** none
- **Depends on:** R1, R2

## Target architecture

```
scripts/work_engine/directives/
  ui/
    audit.py                           ← MANDATORY pre-step: enumerate existing components/patterns/tokens
    design.py                          ← layout, components, states, microcopy (final, not placeholders), a11y
    apply.py                           ← stack-dispatched implementation
    review.py                          ← design-review polish loop
    polish.py                          ← edge-case sweep + token-violation refactor
  ui-trivial/
    apply.py                           ← single-file, ≤5-line micro-edits (color, copy, single class, one prop)
  mixed/
    contract.py                        ← backend contract first
    ui.py                              ← then UI track
    stitch.py                          ← integration verification

  resolvers/
    diff.py                            ← input.kind=diff (improve-this-screen)
    file.py                            ← input.kind=file (existing screen path)

scripts/work_engine/stack/
  detect.py                            ← detect Blade+Livewire+Flux / React+shadcn / Vue / plain

.agent-src.uncompressed/
  skills/
    existing-ui-audit/                 ← new, mandatory before any UI work; greenfield-aware
    react-shadcn-ui/                   ← new, stack-specific implementation; version-anchored
  rules/
    ui-audit-before-build.md           ← always-on, enforces audit gate
```

State additions:

```json
{
  "input": { "kind": "prompt|ticket|diff|file", "data": {...} },
  "intent": "ui-build" | "ui-improve" | "ui-trivial" | "mixed",
  "directive_set": "ui" | "ui-trivial" | "mixed",
  "stack": { "frontend": "react-shadcn" | "blade-livewire-flux" | "vue" | "plain", "detected_at": "..." },
  "ui_audit": {
    "components_found": [...],
    "patterns_found": [...],
    "design_system": "...",
    "reusable": [...],
    "design_tokens": { "colors": {...}, "spacing": {...}, "typography": {...}, "source": "tailwind.config.ts | app.css | none" },
    "shadcn_inventory": { "version": "...", "primitives": [...] },
    "greenfield": false,
    "greenfield_decision": null
  }
}
```

## Non-goals

- **No** new UI design system. Reuse what the project has; audit catches it.
- **No** screenshot-to-code, Figma-import, or visual-regression testing.
- **No** UI-quality scoring or dashboard.
- **No** changes to `/implement-ticket` ticket flow or to R2's prompt flow when intent is backend.
- **No** stack-specific skills for stacks not yet present in the package (Svelte, SolidJS, etc.) — extension recipe documented instead.
- **No** version numbers (per `roadmaps.md` rule 13).

## Phase 1: Stack detection and UI intent routing

- [x] **Step 1:** Implement `scripts/work_engine/stack/detect.py`. Heuristics: `composer.json` + `livewire/livewire` + `livewire/flux` → `blade-livewire-flux`; `package.json` + `react` + `@radix-ui` or shadcn marker → `react-shadcn`; `vue` in package.json → `vue`; otherwise `plain`. Cached per state-file (survives session boundaries) with re-detect trigger if `package.json` or `composer.json` mtime changes.
- [x] **Step 2:** Extend `refine-prompt` (R2) and ticket refine (R1) to classify intent: `ui-build` (new screen/component), `ui-improve` (existing screen/component), `ui-trivial` (single-file, single-concern micro-edit — color, copy-string, single class, one prop), `mixed` (backend + UI), `backend-coding` (default).
- [x] **Step 3:** Dispatcher:
  - `intent == "ui-trivial"` → `directive_set="ui-trivial"` (skips audit + design + review; runs apply + smoke-test only; emits short delivery report). See Phase 2 Step 6 for the trivial-path schema and reclassification logic.
  - `intent in {ui-build, ui-improve}` → `directive_set="ui"` (full audit → design → apply → review → polish).
  - `intent == "mixed"` → `directive_set="mixed"`.
  - Backend intents unchanged.
- [x] **Step 4:** Add `input.kind="diff"` resolver (improve-this-screen via diff/PR) and `input.kind="file"` resolver (path to existing component/page).
- [x] **Step 5:** Tests: stack detection on 4 fixture projects, intent classification on 16 prompts (3 per non-trivial intent class + 4 trivial-vs-improve edge cases), resolver tests for diff and file.

## Phase 2: Existing-UI-Audit (the hard gate)

> Lovable's competitive edge is that it does NOT immediately build. It audits first. This phase encodes that as a mandatory directive — there is no escape hatch except the explicit `ui-trivial` path (Step 6) which is itself bounded by hard preconditions and reclassification. Skipping the audit on a `ui-build` or `ui-improve` run is a hard error, not a soft warning.

- [x] **Step 1:** Author `.agent-src.uncompressed/skills/existing-ui-audit/SKILL.md`. Procedure: enumerate components/partials/templates in the project, identify the design system in use (Flux components, shadcn primitives, custom tokens), list reusable patterns (forms, tables, modals, empty states), **detect design tokens** (Tailwind config, CSS custom properties `:root { --... }`, theme files) into `state.ui_audit.design_tokens`, **detect installed shadcn version + primitives** from `components.json` and `package.json` into `state.ui_audit.shadcn_inventory` (when `react-shadcn` stack), find candidate matches for the current task with similarity score. **Greenfield branch:** if no components, no design-system markers, and no tokens are detected, audit emits `state.ui_audit.greenfield = true` and a numbered-options halt: "(1) scaffold a minimal token set + a base component primitive folder before building (recommended for projects with >1 planned screen), (2) proceed bare with Tailwind defaults (recommended for one-off prototypes), (3) point me at an external design-system reference (URL or file)". Output: structured inventory written to `state.ui_audit` — non-empty even in greenfield (`greenfield=true` plus user-chosen direction).
- [x] **Step 2:** Implement `directives/ui/audit.py` — runs the audit skill, writes findings to state, MUST run before `design.py` or `apply.py`. Dispatcher refuses to advance to design or apply if `state.ui_audit` is empty **OR** if `state.ui_audit.greenfield == true` and no `greenfield_decision` is set. Hard error, not a halt. Greenfield projects pass the gate by *recording the user's chosen scaffolding direction*, not by being empty.
- [x] **Step 3:** Author `.agent-src.uncompressed/rules/ui-audit-before-build.md` — always-on rule. Triggers on UI-intent work. Enforces the gate at the rule layer too (defense in depth) — refuses to write components without audit findings in state. Allow-lists `directive_set="ui-trivial"` runs explicitly.
- [x] **Step 4:** Audit-output handling — **two paths**:
  - **High-confidence path:** if Phase 1's intent classifier and (for prompt inputs) R2's confidence-scorer landed `high` AND audit found ≥1 strong reusable match (similarity score ≥ 0.7 against the requested task), audit's recommendations are **folded into the design-brief** as default assumptions. No separate halt. Design-brief's confirmation halt presents both audit-findings AND design choices in one screen. User confirms or edits.
  - **Ambiguous path:** if confidence is medium, OR audit finds multiple plausible matches with similar scores, OR greenfield (Step 1), audit emits a numbered-options halt before design. The halt is then *the* halt for this run — design-brief is presented as a final summary, not a separate halt.

  This caps the happy-path halt-budget at **2** (input + design-confirm) on high-confidence runs and **2** (decision-halt + design-summary) on ambiguous runs.
- [~] **Step 5:** Tests: audit fixture for each detected stack (including a tokens fixture and a shadcn-version-mismatch fixture), dispatcher rejection when audit skipped, rule enforcement when audit findings missing, greenfield branch fixture. _Unit tests for high-conf vs ambiguous branching landed (15 tests in `test_step_audit.py`); per-stack fixtures + dispatcher-rejection golden + greenfield-branch fixture pending._
- [x] **Step 6:** Implement `directives/ui-trivial/apply.py` — single-file edit path. Hard preconditions enforced before apply: edit surface ≤ 1 file AND ≤ 5 changed lines AND no new component AND no new state AND no new dependency. **If any precondition fails at apply time, the dispatcher reclassifies to `ui-improve` and re-enters the full audit gate.** Trivial path emits a one-line delivery summary, not the full report. The audit gate is **not** weakened — it's just bypassed only for cases that provably cannot need it. Reclassification rate is logged in delivery report; if a state-file shows >3 trivial-paths in sequence, dispatcher inserts a one-question halt asking "are these connected? consider audit". _Landed: `apply.py` enforces the 1-file/5-line/no-component/no-state/no-dependency floor and writes `state.ticket['__reclassify_to__']="ui-improve"` on violation; sibling slots (`refine`, `test`, `report`, four `_skipped` no-ops) wired; `ui-trivial` removed from the dispatcher's raise-stub list; 16 unit tests in `test_ui_trivial.py` + 4 directive-loader contract tests updated. Reclassification-rate logging and >3-trivial-in-a-row halt are deferred to Phase 5 (delivery-report polish) — out of scope for the apply gate itself._

## Phase 3: UI directive set (design → apply → review → polish)

- [x] **Step 1:** Implement `directives/ui/design.py` — produces a structured design brief: layout, component breakdown, states (empty/loading/error/success/disabled), **microcopy (final strings, not placeholders — every button label, empty-state message, validation message, primary CTA)**, a11y notes (keyboard nav, ARIA, contrast). The brief is **the lock** — apply writes the strings exactly as the brief specifies.

  The design-brief includes a **"reused from audit"** section that shows which existing components are being extended vs. which are new. On the high-confidence path (Phase 2 Step 4), this section *is* the audit-decision surface — no separate halt. On the ambiguous path, the audit-halt has already been answered, and this section reflects that decision read-only. Halts for user confirmation before apply.
- [x] **Step 2:** Implement `directives/ui/apply.py` — stack-dispatched. Routes by `state.stack.frontend` to the appropriate implementation skill: `blade-livewire-flux` → `flux` + `livewire` + `blade-ui`; `react-shadcn` → new `react-shadcn-ui` skill; `vue` → existing vue skills if present; `plain` → `blade-ui` + Tailwind base. Apply rejects components with placeholder-pattern strings (`<placeholder>`, `Lorem`, `TODO:`) — that means the design-brief lock failed.
- [x] **Step 3:** Author `.agent-src.uncompressed/skills/react-shadcn-ui/SKILL.md` — shadcn primitives, composition patterns, Tailwind tokens, dark-mode handling, a11y wrappers. **Frontmatter declares `tested_against: shadcn@<version>` and `tailwind: <major>`**. Skill body documents which primitives are covered (Button, Dialog, Sheet, Form, Table, …) and which are explicitly **not** covered (so the agent knows when to fall back to manual composition vs. skill guidance). When audit detects installed shadcn version diverges from `tested_against` by a major, audit emits a soft halt: "shadcn skill tested against vX, project uses vY; proceed with cautious composition?". _Landed: skill body documents covered/uncovered primitives; version metadata recorded in a `## Compatibility` body section instead of frontmatter (skill schema rejects extra frontmatter keys). Audit-side version-mismatch halt is wired through audit, not the skill itself._
- [x] **Step 4:** Implement `directives/ui/review.py` — design-review pass: re-read the rendered component(s), check against design brief, flag gaps in states/microcopy/a11y. Produces a numbered findings list. _Landed: stack-dispatched review directive emits `@agent-directive: ui-design-review-<stack>` when `state.ui_review` is missing/empty/non-dict; validates `findings` (list) + `review_clean` (bool) envelope; permits manual override (clean=true with findings) for ship-as-is._
- [x] **Step 5:** Implement `directives/ui/polish.py` — applies the review findings. **Polish is for edge-cases only** — long-string truncation, missing validation messages for fields the design-brief did not anticipate, missing a11y labels, responsive breakpoint fixes, **and token-violation refactors** (hardcoded color/spacing values where `state.ui_audit.design_tokens` has a matching token are auto-flagged and converted; if no matching token exists but a hardcoded value repeats >2 times, polish emits a one-question halt asking "extract this as `--{suggested-name}` token?"). Polish does **not** rewrite primary microcopy (that comes pre-locked from design-brief; rewriting it is a design-brief change, which means re-confirmation). Loop ceiling: 2 polish rounds max, then halt to user even if findings remain. _Landed: stack-dispatched polish directive, bounded loop with `POLISH_CEILING = 2`, ceiling halt with Ship-as-is / Abort / Hand-off options, defensive parsing of `rounds`. Token-violation refactor branch landed: `_classify_token_violations` splits `kind=token_violation` findings into matched (auto-convert against `state.ui_audit.design_tokens`) and unmatched-repeats (`>TOKEN_REPEAT_THRESHOLD=2`); matched count surfaces in the polish-skill delegate body, unmatched repeats trigger an Extract / Inline / Abort halt with a suggested `--{name}` token; ceiling overrides the extraction halt; defensive against missing/non-dict `ui_audit`._
- [x] **Step 6:** Tests: each directive has a fixture covering one happy path and one halt path; polish-loop ceiling enforced; placeholder-rejection in apply enforced; token-refactor-on-hardcoded enforced. _Landed: `test_step_design.py` (14 tests) + `test_step_apply.py` (15 tests, incl. placeholder rejection) + `test_step_review.py` (15 tests) + `test_step_polish.py` (21 tests — ceiling, stack dispatch, token auto-convert, unmatched-repeat halt, threshold-strict-`>`, audit-missing defensive, non-token-finding fall-through, ceiling-overrides-extraction) — 65/65 pass._

## Phase 4: Mixed orchestration (backend + UI)

- [ ] **Step 1:** Implement `directives/mixed/contract.py` — runs first. Resolves the data model and API surface the UI will consume. Reuses `directives/backend/plan.py` and `apply.py` under the hood with a "contract-only" flag (no UI work yet).
- [ ] **Step 2:** Implement `directives/mixed/ui.py` — runs second. Hands the locked contract to `directives/ui/*`. Audit + design + apply + review + polish, with the contract treated as immutable input.
- [ ] **Step 3:** Implement `directives/mixed/stitch.py` — runs third. Integration verification: end-to-end smoke (fill form → server validation → response → UI update). Tests must cover the integration boundary, not just unit behavior.
- [ ] **Step 4:** Halt structure: contract-confirmed halt between contract and ui; integration-confirmed halt at end of stitch.
- [ ] **Step 5:** Tests: 2 mixed fixtures (form + endpoint, table + list endpoint with filtering).

## Phase 5: `fe-design` migration and skill repositioning

- [ ] **Step 1:** Audit `fe-design/SKILL.md` against the new directive set. Move planning content into `directives/ui/design.py` (or a referenced sub-skill); keep `fe-design` as a universal frontend-design *reference* skill (architecture patterns, component-structure heuristics) — not an executor.
- [ ] **Step 2:** Reposition `blade-ui`, `livewire`, `flux` as stack-implementation skills invoked by `directives/ui/apply.py`. Their descriptions clarify they are dispatched, not standalone.
- [ ] **Step 3:** Cross-reference cleanup — every UI skill points to the directive set as the orchestrator; no UI skill claims to own the full flow.
- [ ] **Step 4:** Run `python3 scripts/check_references.py` and fix every dangling reference.
- [ ] **Step 5 (optional):** Author template `agents/contexts/copywriting.md` — voice, tone, microcopy patterns, banned phrases. When present, design-brief loads it and threads tone through every microcopy field. When absent, audit's tone-detection (reading existing button labels and empty-states) fills the gap.

## Phase 6: Golden Compatibility Tests + UI goldens

- [ ] **Step 1:** R1 (GT-1..GT-5) and R2 (GT-P1..GT-P4) goldens MUST stay green. Re-run before any merge in this roadmap.
- [ ] **Step 2:** Add UI-flow goldens:
  - **GT-U1 — ui-build happy path:** prompt for new screen → audit → design halt (folded audit-findings) → apply → review → polish → delivery report
  - **GT-U2 — ui-improve via diff:** existing-screen diff input → audit → design halt → apply → review → polish
  - **GT-U3 — audit-skipped rejection:** dispatcher rejects design/apply when `state.ui_audit` empty
  - **GT-U4 — polish-loop ceiling:** review finds gaps in 3 consecutive rounds; engine halts after round 2
  - **GT-U5 — mixed flow:** prompt implying backend + UI → contract halt → ui track → stitch halt → delivery report
  - **GT-U6 — stack dispatch:** same prompt against blade-livewire-flux fixture and react-shadcn fixture; dispatcher routes to different apply skills
  - **GT-U7 — trivial path happy:** prompt "make the Save button red" → `ui-trivial` → apply only → one-line delivery
  - **GT-U8 — trivial path reclassification:** prompt that *looks* trivial but apply detects 2-file edit → reclassify to `ui-improve` → audit gate engages
  - **GT-U9 — greenfield audit halt:** empty repo + ui-build prompt → audit detects greenfield → numbered-options halt → user picks "scaffold tokens" → audit records decision → design proceeds → apply scaffolds tokens before component
  - **GT-U10 — greenfield bare-proceed:** same as GT-U9 but user picks "proceed bare" → no scaffolding → apply uses Tailwind defaults → delivery report flags greenfield-bare for follow-up
  - **GT-U11 — high-confidence happy-path halt-count:** clear ui-build prompt + audit finds strong match → exactly 1 halt (design-brief with folded audit-findings) → apply → review → polish → delivery
  - **GT-U12 — ambiguous halt-count:** vague-but-classified ui-improve prompt → audit finds 3 candidates → 1 halt (audit decision) + 1 halt (design summary) = 2 halts max → continues
- [ ] **Step 3:** Wire GT-U1..GT-U12 into `task ci`. R1 + R2 + R3 goldens are now all required.
- [ ] **Step 4:** Document the UI-track contract in `agents/contexts/ui-track-flow.md` (new) — audit gate, design-review loop, polish ceiling, stack-dispatch table, halt-budget rules, trivial-path preconditions.

## Phase 7: Verification and docs

- [ ] **Step 1:** `task sync && task generate-tools && task ci` — green end-to-end with R1 + R2 + R3 goldens.
- [ ] **Step 2:** Update `README.md` and `AGENTS.md` — UI track, mixed orchestration, stack dispatch, audit gate, halt-budget contract, trivial path.
- [ ] **Step 3:** ADR `agents/contexts/adr-product-ui-track.md` — rationale, audit-as-hard-gate, design-review loop ceiling, halt-budget rationale, trivial-path-and-reclassification, stack-detection strategy, fe-design migration path.
- [ ] **Step 4:** Extension recipe `agents/contexts/ui-stack-extension.md` — how to add a new stack (Svelte, SolidJS, etc.): detector heuristic, apply-skill, polish-skill, golden fixture, version-anchor convention.
- [ ] **Step 5:** Mark `agents/roadmaps/intent-based-orchestration.md` as **superseded** by R1 + R2 + R3 (move to `agents/roadmaps/archive/` per `roadmap-progress-sync` rule).
- [ ] **Step 6:** Changelog entry under "Unreleased" — UI track, mixed orchestration, audit gate, trivial path, halt-budget, new commands and skills.

## Acceptance criteria

- [ ] Stack detection identifies blade-livewire-flux, react-shadcn, vue, plain on representative fixtures
- [ ] `directives/ui/` is fully implemented (audit, design, apply, review, polish) and wired through dispatcher
- [ ] **Existing-UI-audit is enforced as hard gate** — both at directive level AND at always-on rule level; skipping on `ui-build` or `ui-improve` runs is impossible
- [ ] `directives/ui-trivial/apply.py` implements the bypass with hard preconditions; reclassification at apply-time is mandatory and logged
- [ ] Greenfield audit branch: `greenfield=true` plus user-chosen `greenfield_decision` passes the gate; absence of either is hard-error
- [ ] `directives/mixed/` runs contract → ui → stitch with halts at the right boundaries
- [ ] Polish loop has 2-round ceiling; engine halts to user if findings remain after round 2
- [ ] **UI happy-path halt-budget is enforced: max 2 user halts before delivery report on `directive_set="ui"` runs.** Test asserts halt-count for high-confidence and ambiguous paths separately
- [ ] Microcopy in shipped components matches the design-brief verbatim (no Lorem-Ipsum or placeholder strings reach apply output)
- [ ] Audit extracts design tokens from `tailwind.config.{js,ts}`, CSS custom properties, or detected theme files into `state.ui_audit.design_tokens`
- [ ] When `design_tokens` is non-empty, polish flags hardcoded color/spacing values that have token equivalents and refactors them; tests verify auto-conversion
- [ ] `react-shadcn-ui` skill exists; declares its tested shadcn + tailwind versions in frontmatter; audit detects installed version mismatch and warns; blade-livewire-flux skills repositioned as dispatched
- [ ] `fe-design` migrated to reference-skill positioning
- [ ] All R1, R2, R3 goldens pass in CI
- [ ] `intent-based-orchestration.md` archived as superseded
- [ ] ADR + extension recipe + changelog in place

## Open decisions

- **Audit gate strictness** — hard error (default) vs. soft halt with user override. Lean: hard error; soft halt defeats the Lovable-grade purpose.
- **Polish-loop ceiling** — 2 rounds (default) vs. 3 vs. configurable per `cost_profile`. Lean: 2 fixed; configurable later if data supports it.
- **`fe-design` final shape** — reference-skill (default) vs. delete entirely (content folded into directives). Lean: reference-skill; some content (architecture heuristics) outlives directive churn.
- **Mixed-flow halts** — 2 (contract + stitch, default) vs. 1 (stitch only). Lean: 2; contract halt is where most divergence happens.
- **UI-flow halt-budget** — max 2 (default, fold audit into design on high-confidence) vs. always 3 (audit + design + polish-final). Lean: max 2; folding audit into design preserves the audit's decision power without adding ceremony. The Lovable feel comes from "user decides once, agent runs". Three halts is one halt too many.
- **Stack-detection caching** — per state-file (default, with re-detect on `package.json`/`composer.json` mtime change) vs. per conversation vs. re-detect on every directive. Lean: per state-file with mtime-trigger.
- **`ui-trivial` thresholds** — ≤ 1 file AND ≤ 5 lines (default) vs. ≤ 1 file AND ≤ 10 lines vs. configurable. Lean: 1/5 fixed for now; if false-trivial rate is high (reclassification fires often), tune via fixture suite. Critically: the audit gate's purpose is preserved as long as reclassification is loud and frequent — silent skips are the failure mode to watch for.
- **`/build` or `/build-screen` as UI-specific entrypoint** — yes vs. no (default). Lean: no; the R2 entrypoint plus intent classification is enough. New command only if data shows users mis-route.

## Risks and mitigations

- **Audit-gate becomes a checkbox the agent rubber-stamps with empty findings** → schema validation rejects empty `ui_audit.components_found` UNLESS `greenfield=true` with a `greenfield_decision`; rule enforces non-trivial output OR explicit greenfield branch
- **`ui-trivial` becomes the escape hatch users abuse to skip audit** → reclassification at apply time is mandatory; reclassification rate is logged in delivery report; if a state-file shows >3 trivial-paths in sequence, dispatcher inserts a one-question halt asking "are these connected? consider audit"
- **Microcopy regresses to placeholders during apply** → design-brief schema requires `microcopy` field with non-empty strings per component; apply rejects components with `<placeholder>`-pattern strings
- **Folded audit-findings get rubber-stamped because they're co-presented with design** → design-brief schema separates "audit reuse decisions" from "design choices" visually; both must be acknowledged; confirmation token in state captures both fields explicitly
- **shadcn skill silently goes stale as the upstream library evolves** → frontmatter version anchor + audit-time mismatch warning; CI check that the anchor is set; documented refresh procedure in the extension recipe (Phase 7 Step 4)
- **Stack detection misclassifies and routes to wrong apply skill** → 4 fixture projects in CI; user override available via explicit `intent` in prompt
- **Polish loop runs forever** → hard 2-round ceiling enforced in dispatcher
- **Mixed flow's contract halt is bypassed** → contract directive writes a sentinel to state; ui directive refuses to start without it
- **`fe-design` migration breaks downstream skills** → cross-reference scan in CI; deprecation warning if migration window needed
- **R1/R2 goldens regress because of UI-track changes** → all 9+ goldens required in CI; manual replay before merge
- **Stack extensions (Svelte, etc.) tempted to be added prematurely** → extension recipe documented but no stacks added in this roadmap

## Future-track recipe (deferred)

- Visual review with headless browser + screenshot capture + a11y tooling — **Roadmap 4** ([`road-to-visual-review-loop.md`](road-to-visual-review-loop.md), stub)
- Conversational iteration / multi-turn UI edits / last-touched-component recall — **not scheduled**; Trivial-Band lives in R2-hardening and last-touched-state in R3 Phase 2 Step 6 reclassification logic. A standalone R5 only emerges if R3 build surfaces real multi-turn-interrupt-recovery needs (most likely during Phase 4 Mixed Orchestration).
- Project-local design-memory — **not scheduled**; the audit gate IS the memory mechanism. The bottleneck is audit *performance*, addressed via differential-audit (Phase 2 Step 7 add — content-hash-based caching of structural inventory, NOT similarity matches which are task-specific).
- Screenshot-to-code, Figma-import, visual-regression testing — **deferred indefinitely**
- UI-quality scoring / dashboard — **deferred indefinitely**
- Svelte / SolidJS / Astro stack support — **extension recipe only**, opt-in by consumer projects
- Infrastructure track (Terraform/Terragrunt directive set) — **separate future roadmap**
- Security-review track (threat-model directive set) — **separate future roadmap**
