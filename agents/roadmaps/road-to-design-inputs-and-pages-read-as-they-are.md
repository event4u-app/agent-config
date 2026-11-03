---
complexity: lightweight
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "New from inbox-2026-11-n lane E; owner search at b234d08480 (grep -rlF for consistency-sibling-gap, COMPARED_PROPERTIES, pointerdown, generateCss, tokens.ts, parseLocks, CRITERIA_BY_VERSION, 2.5.2, getAnimations, confinePage, $root, $extends over agents/roadmaps/*.md, later, stubs) returned nothing; review-before-rebuild and ui-triviality-golden hit only later/road-to-a-control-that-matches-its-neighbours, whose open work (3.8, AC-2) is a shadow-window flip this roadmap does not touch."
relates:
  - slug: road-to-a-control-that-matches-its-neighbours
    relation: extends
    note: "Parked in later/. Owns added controls, the review-before-rebuild halt and the 3.8 default flip. Phase 3 here feeds its halt; Phase 4 adds a shadow rule to the same lint and the same shadow file without joining 3.8."
---
# Road to design inputs and pages read as they are

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T5; topic T0, P09).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

Design inputs and checked pages are read as written. No token file ends with exit 0 and empty or broken CSS, a
front-matter scale is reported instead of silently ignored, the accessibility
auditor carries every A/AA criterion its claim covers, a symptom or a bare
quality adjective about a UI routes to the UI track and a review, and every
probe that presses something on a URL cannot send a write. Measured at the pin:
a layerless DTCG file yields 0 variables at exit 0 (`tokens.ts:341-344`), a
shadow array yields `[object Object]`, "the buttons only react on release"
routes `backend-coding` (`classify.ts:67-80`), and `ui:render --interact`
clicks on a live URL unguarded (`uiRenderInteract.ts:163-187`).

## Phase 1 — Token files read as written

- [x] **1.1 A layerless file is read; emptiness is an error.** In
      `src/skills/design-tokens/scripts/tokens.ts` `generateCss`: when none of
      `primitive`/`semantic`/`component`/`dark` is present, flatten every
      top-level group the way `semantic` is flattened today; when layers exist
      beside other top-level groups, name those groups on stderr; a file with
      ≥ 1 token that produces 0 variables exits 1 with the reason. Fixtures in
      `tests/fixtures/dtcg-2025-10/`, test in `tests/scripts/dtcg_conformance.test.ts`.
      The starter golden stays byte-identical; the empty-`{}` case stays 0/0.
      verify: `npx vitest run tests/scripts/dtcg_conformance.test.ts tests/scripts/skills_design_tokens_tokens.test.ts` -> 0
- [x] **1.2 An unresolvable reference is an error.** `resolveReference`
      (`tokens.ts:178-197`) throws `TokenValueError` naming the token path and
      the missing target; `generate` exits 1. Rewrite the pinning case at
      `tests/scripts/skills_design_tokens_tokens.test.ts:118` to the new
      expectation (it was the defect, not the guard).
      verify: `npx vitest run tests/scripts/skills_design_tokens_tokens.test.ts -t "unresolvable"` -> 0
- [x] **1.3 `$root` named, `$extends` and spec-form `$ref` never silent.**
      In `flattenTokens` (`tokens.ts:310-327`): a `$root` key takes the group's
      own name (no `$` in any custom-property name); a group carrying `$extends`
      or a token carrying `$ref` without `$value` raises a named
      `TokenValueError` ("not supported: $extends at <path>") instead of being
      dropped or emitted verbatim. Resolution of both is a later step.
      verify: `npx vitest run tests/scripts/dtcg_conformance.test.ts -t "root|extends|ref"` -> 0
- [x] **1.4 Arrays never reach string concatenation.** `tokenValueToCss`
      (`tokens.ts:284-305`): `shadow` (object or array) → one `box-shadow`
      value; `cubicBezier` → `cubic-bezier(a, b, c, d)`; a `fontFamily` array →
      a comma list, names with spaces quoted; any other array or a
      `border`/`transition`/`gradient`/`strokeStyle` composite → named error.
      Update `src/skills/design-tokens/SKILL.md:62-63` and regenerate the bundled
      `src/skills/design-tokens/scripts/tokens.mjs` from the source. This closes
      the residue of the archived brand roadmap's AC-5.
      verify: `npx vitest run tests/scripts/dtcg_conformance.test.ts -t "array|shadow|cubic"` -> 0 and `grep -c "object Object" tests/scripts/dtcg_conformance.test.ts` shows the assertion is an absence check
- [x] **1.5 A front-matter scale is reported, never silent.**
      `src/scripts/_lib/design_lock.ts` and the `src/scripts/design_lock.ts`
      CLI: a DESIGN.md whose YAML front matter declares `colors`, `rounded` or
      `spacing` but has no Lock line prints one line — scale read (n colours,
      m radii, k spacings), no lock declared, nothing checked; exit code
      unchanged. A scale never becomes a lock silently.
      verify: `npx vitest run tests/scripts/design_lock_carrier.test.ts` -> 0 with a new front-matter case asserting the line

## Phase 2 — Accessibility claims that carry what they say

- [x] **2.1 The 2.1 register is cumulative, and pointer cancellation is said
      correctly.** `tests/contracts/accessibility_wcag_version_claim.test.ts`:
      add `CRITERIA_BY_VERSION['2.1']` (A: 2.1.4, 2.5.1, 2.5.2, 2.5.3, 2.5.4;
      AA: 1.3.4, 1.3.5, 1.4.10, 1.4.11, 1.4.12, 1.4.13, 4.1.3; AAA disposition:
      1.3.6, 2.2.6, 2.3.3, 2.5.5, 2.5.6) and check a 2.2 claim against 2.1 ∪ 2.2.
      Then add a 2.1 table to `src/skills/accessibility-auditor/SKILL.md` in the
      shape of the 2.2 table (`:107-116`), with 2.5.2 stated as: no function
      completes on the down-event, or it can be aborted/undone, or the up-event
      reverses it, or down is essential. In
      `src/skills/fe-design/references/gesture-mechanics.md` § Respond at
      contact, add: feedback on pointer-down, commit on pointer-up, cancel when
      the pointer leaves before release; never move an action to `pointerdown`.
      verify: `npx vitest run tests/contracts/accessibility_wcag_version_claim.test.ts` -> 0 and `grep -c "commit on pointer-up" src/skills/fe-design/references/gesture-mechanics.md` -> 1

## Phase 3 — A symptom or an adjective routes to a review

- [x] **3.1 Corpus first.** `internal/bench/corpora/ui-triviality-golden.yaml`
      gains a `symptom` category (≥ 8: "the buttons only react on release",
      "Die Animationen kann man nicht unterbrechen", "Die Abstände zwischen den
      Karten sind ungleich", plural English nouns) and a `quality-adjective`
      category (≥ 6: "Mach die Website hochwertiger", "make the site feel more
      premium", "Mach den Shop schöner"), plus ≥ 4 backend counter-probes that
      share the words ("cleaner code in the order service", "the pages table
      needs an index", "SQL views for the report"). `src/scripts/eval_ui_triviality.ts`
      gains bars `symptom_ui` (never `backend`) and `adjective_review`
      (always `review_only`). The new bars MISS at this step.
      verify: `npx vitest run tests/scripts/eval_ui_triviality.test.ts` -> 0 and `./scripts-run src/scripts/eval_ui_triviality` prints both new bars
- [x] **3.2 Plurals and German symptom nouns.** In
      `src/agent-src/templates/scripts/work_engine/intent/classify.ts`: UI-noun
      matching accepts `s|es` plurals except `views`/`pages` (backend sense);
      `animation` joins `_UI_NOUNS`; `karte`, `kachel`, `animation`, `abstand`
      and `abständ` join `UI_I18N.de.nouns`.
      verify: `./scripts-run src/scripts/eval_ui_triviality` -> `symptom_ui` PASS, `backend` PASS, `add_control` and `de_ui_recall` PASS; `npx vitest run tests/scripts/work_engine/intent_classify.test.ts` -> 0
- [x] **3.3 A bare quality adjective is review-first.** A prompt whose only
      goal is an evaluative adjective (de: hochwertig, edel, schöner, moderner,
      professioneller, aufgeräumter; en: premium, polished, nicer, sleeker,
      more professional) with a UI signal — `site` counts as a UI signal only in
      this branch — sets `review_only` in `populate_routing` (`classify.ts:432-452`)
      and halts at the existing `review-before-rebuild`. An adjective beside a
      concrete object or build verb does not (default of owner decision E2).
      verify: `./scripts-run src/scripts/eval_ui_triviality` -> `adjective_review` PASS and `backend` PASS; `npx vitest run tests/scripts/work_engine/review_before_rebuild.test.ts` -> 0 with a "Mach die Website hochwertiger" case writing nothing

## Phase 4 — Instruments that read what they claim

- [ ] **4.1 Press feedback is visible to the probe.** Add `transform`,
      `box-shadow`, `opacity` and `filter` to `COMPARED_PROPERTIES`
      (`src/scripts/ui_conformance_probe.ts:139-153`); the state comparison
      (`:363`, `:559`, `:631`) treats a key missing from an older observation as
      `not_available`, never as unchanged.
      verify: `npx vitest run tests/scripts/ui_conformance_probe.test.ts` -> 0 with a pure case where the reference's `active` changes `transform` and the target's does not, reported as lost
- [ ] **4.2 The render states its denominator and the gap inputs.**
      `src/cli/commands/uiRender.ts`: the style capture (`:593`) records
      `sampled` and `total` element counts in each `*.styles.json` envelope or
      manifest row, and `CAPTURED_PROPERTIES` (`:60-80`) gains
      `margin-top|right|bottom|left`, `gap`, `row-gap`, `column-gap`,
      `display`, `flex-direction`. A reading over a truncated capture carries
      `partial: <sampled>/<total>`.
      verify: `npx vitest run tests/cli/uiRender_geometry.test.ts` -> 0 with assertions on the new keys and on `total > sampled` for a > 1,500-element fixture
- [ ] **4.3 No probe action on a URL can write.** Add a URL-target predicate
      to `src/cli/commands/uiRenderAssetIsolation.ts` (same origin, GET/HEAD
      only, everything else aborted and recorded) and apply it via
      `confinePage` before every `goto` of a URL target in
      `src/cli/commands/uiRender.ts` (`:381`, `:545`, `:673`, `:685`) and in
      `uiRenderInteract.ts`; the manifest records `network: { aborted, blocked }`.
      verify: `npx vitest run tests/cli/ui_render_asset_isolation.test.ts` -> 0 (pure predicate: cross-origin GET, same-origin POST and same-origin GET) and `grep -c "confinePage" src/cli/commands/uiRender.ts src/cli/commands/uiRenderInteract.ts` -> each ≥ 1
- [ ] **4.4 `consistency-sibling-gap`, shadow only.** In
      `src/scripts/lint_design_consistency.ts`, an exported pure
      `siblingGapFindings(rows)` over render rows and a `--render <styles.json>`
      mode: ≥ 3 visible, in-flow siblings of one parent with the same tag +
      class signature on one main axis; fires when the gap spread exceeds the
      tolerance; names the intended gap (the mode; a tie → none), each
      deviating pair and, from 4.2, whether child margins or container `gap`
      cause it. `ShadowRecord` (`:54-60`) gains `rule`; old rows read as the two
      existing rules. Never in the exit code.
      verify: `npx vitest run tests/scripts/lint_design_consistency.test.ts` -> 0 with a 24/31/18 px case firing at intended 24 and near-misses (bento grid with equal gaps, heading→paragraph→section, short last wrapped row, `space-between` nav) staying clean

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/lane-e -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A probe click has a real effect | product | A press or interact run on a live shop submits or deletes | 4.3 lands before any new press/interrupt instrument; those stay in Notes until it does | Phase 4 — Instruments that read what they claim |
| 2 | Plurals steal backend prompts | implementation | "views", "pages" are database words | Singular-only list and frozen backend counter-probes from 3.1 | Phase 3 — A symptom or an adjective routes to a review |
| 3 | A stricter generator breaks a consumer build | product | Files that produced junk at exit 0 now exit 1 | Errors name the token path; the starter golden stays byte-identical (1.1) | Phase 1 — Token files read as written |
| 4 | The gap rule flags intentional rhythm | product | Proximity groups and bento grids read as uneven | Same-signature groups only, near-miss cases in 4.4, shadow only | Phase 4 — Instruments that read what they claim |
| 5 | Added probe properties change old readings | implementation | Older observations lack `transform` | Missing key = `not_available` (4.1) | Phase 4 — Instruments that read what they claim |

## Acceptance Criteria

- [ ] AC-1 — No fixture in `tests/fixtures/dtcg-2025-10/` ends with exit 0 and empty CSS, and no emitted name or value contains `{`, `}`, `$` or `[object`.
- [ ] AC-2 — The WCAG claim test checks 2.1 ∪ 2.2 and is green; no AC text recommends completing a function on `pointerdown`.
- [ ] AC-3 — `eval_ui_triviality` shows `symptom_ui`, `adjective_review` and `backend` PASS together.
- [ ] AC-4 — No URL-target render or interact run can send a non-GET request or leave the origin.
- [ ] AC-5 — `consistency-sibling-gap` writes shadow rows and never affects an exit code.

## Non-goals

- No default 4/8 px spacing scale; scale membership waits for a declared project scale.
- No pixel diff or screenshot judge for spacing (rects already captured; a pixel verdict is per-machine).
- No action handler moved to `pointerdown` as a fix (WCAG 2.5.2).
- No change to the DESIGN.md template format; front matter is read, never written.
- No imported third-party design skill and no vendor name in the rule set.

## Notes

Deferred, with their wake condition: settle-before-read in the probe and its
falsification fixture (Chromium resolvable in CI); `ui:render --press` and
`--interrupt` on virtual time (after 4.3); a no-PR URL entry for
`design-review`; declared-scale reading in `ui:audit` and the off-scale rule;
the cross-page level; leaving shadow (the activation policy's four conditions
on 4.4's curve); `$extends`/`$ref` resolution; import-lane object colours;
a `design-md` import lane; Storybook `test-run` (name derived from an install).
