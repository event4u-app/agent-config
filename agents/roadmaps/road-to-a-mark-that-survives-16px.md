---
complexity: lightweight
status: ready
tree_pin: 62e7d03a43
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-03 in the /analyze:inbox invocation itself (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"); closed and archived in the same PR, so the active estate returns to its prior count."
estate_offset_exempt: "Owner search at 62e7d03a43: grep -rlF -e svg-mark -e 'class mark' -e logo-generation -e logo_export_kit over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs found no owner of a static logo-mark lint; later/road-to-svg-witness-provenance owns witness provenance and complexity readings (disjoint)."
relates:
  - slug: later/road-to-svg-witness-provenance
    relation: disjoint
    note: "Owns witness provenance and path-complexity / text-to-path readings through its own pre-registration; no complexity threshold is gated here."
  - slug: road-to-ai-media-that-says-so-where-it-lands
    relation: disjoint
    note: "Single owner of the provenance sidecar shape; this roadmap only links the policy and has the export kit emit the sidecar."
  - slug: later/road-to-a-mark-render-readings
    relation: disjoint
    note: "One-colour / reversed / 64 px render readings, concept sheet, eval command_exit kind, owner E3/E4."
---
# Road to a mark that survives 16 px

> **Source:** `agents/tmp.old/inbox-2026-11-p/` (topic t2: owner transcript and
> two supplied plans comparing six external logo, brand and illustration skills,
> referenced as S1–S6).
> **Arrivals:** 1 — `inbox-2026-11-p` (2026-11-03).

## Goal

A logo mark that carries live text, a near-miss angle or sub-pixel detail is
caught by a command, not by prose: `lint_svg_asset --class mark` exits 2 on it
and stays silent on its one-edit clean twin. `brand-identity` has a behaviour
eval, and every exported logo kit carries an origin sidecar.

Most of the supplied plans landed on 2026-10-26 under an archived roadmap
(concept divergence, stop before export, 16/32 px witness, export kit). The
residue reproduced at the pin: `lint_svg_asset` reports "clean" (exit 0) on a
mark with live text, a 1.2° near-miss stroke, 2–3 px dots and six colours;
`svg_rules.ts` carries 21 rule ids, none for marks.

## Phase 0 — Pre-register, then red

- [x] **0.1 `internal/bench/corpora/svg-mark-PREREG.md`.** The static readings
      (live text in master, near-miss angle, tiny detail, colour count as
      report-only), each with its threshold, fixture list and kill criterion —
      the reopen condition the archived roadmap recorded for mark readings.
      verify: file exists and is committed before the rule code.
- [x] **0.2 Fixtures.** Red plus one-edit `.clean` twin per reading, plus
      near-miss controls (an intentional one-colour mark, a deliberate 0.5°
      optical overshoot, a declared `evenodd` hole) under
      `tests/design-artifacts/fixtures/svg-assets/`, rows in its `manifest.json`
      with `asset_class: "mark"`.
      verify: `tests/scripts/lint_svg_asset.test.ts` maps the rows.

## Phase 1 — Static mark family

- [x] **1.1 `lint_svg_asset --class mark`**, reusing the `ASSET_CLASSES`
      vocabulary; default output unchanged.
      verify: running without `--class` is byte-identical on the existing corpus.
- [x] **1.2 Rules** in `src/scripts/_lib/svg_rules.ts`: `svg-mark-live-text`
      (error), `svg-mark-near-miss-angle` (straight segment ≥ 4 % of the canvas,
      0.3–3° off 0/15/30/45/60/90; warning), `svg-mark-tiny-detail` (subpath
      extent < 1/48 of the viewBox; warning), using `_lib/svg_geometry.ts`.
      verify: each fires on its red fixture, silent on twin and controls; the
      lane probe goes to exit 2.
- [x] **1.3 `svg-mark-colour-count`** report-only (keeps "reported, never gated").
      verify: appears in `--json`, never changes the exit code.
- [x] **1.4 Wire `logo-generation`** step 5 to run `lint_svg_asset --class mark`
      beside the existing witness.
      verify: grep in `src/skills/logo-generation/SKILL.md`.

## Phase 2 — Evals and provenance

- [x] **2.1 `src/skills/brand-identity/evals/evals.json`:** confirmed strategy →
      constraint set and stop at the confirmation step; draft strategy refused;
      keep-logo brief leaves the asset unchanged; a CSS colour bug does not
      fire the skill.
      verify: the skill-eval scaffold accepts the file.
- [x] **2.2 Link the media transparency policy** from `logo-generation`,
      `brand-asset-generation` and `image-provider-routing`.
      verify: grep.
- [x] **2.3 `logo_export_kit.ts` writes `.provenance.json`** (backend `none` for
      hand-authored, licence, commercial `yes|no|verify`), byte-deterministic.
      verify: `tests/scripts/logo_export_kit.test.ts` stays deterministic and the
      sidecar parses.
- [x] **2.4 Idea before form.** `logo-generation` step 1b: subject inventory →
      "X becomes Y" → competitor-swap test; generic marks flagged, not forbidden.
      verify: a rubric case in the logo evals.

## Decisions

| # | Decision | Route | Outcome |
|---|---|---|---|
| D1 | `--class mark` instead of the drafted `--delivery mark` | agent | `--delivery` is the transport axis and rejects `mark` today; `--class` already names it. Reversible. |
| D2 | Benchmark harness, upstream watcher, logo metadata search, typed identity contracts | recurring | Kept declined: the archived roadmap's decisions D7/D8 and owner decision D10 cover exactly these; no revisit-if fired. Outcome: right, recorded, unreachable to this round's authors. |
| D3 | External logo corpora / libraries / unlicensed code | owner (prior) | Declined per the earlier owner decision. |
| D4 | Unattended stop semantics (E3), text-idea stage (E4), identity sets | owner / council | Parked on later/road-to-a-mark-render-readings. |
| D5 | The `svg-mark-*` rules live in `src/scripts/_lib/svg_mark_rules.ts`, not inside `svg_rules.ts` | agent | `svg_rules.ts` is on the hook's `.svg` write path and 36 lines under the 1,500-line source-size ratchet; the mark readings apply to a class only the CLI can name, so they are imported by `lint_svg_asset.ts` alone and add nothing to the hook chunk. Behaviour is what 1.2 specifies. Reversible. |
| D6 | The near-miss overshoot control is silenced by a declaration (`data-optical="overshoot"` on the element), not by geometry | agent | A 0.5° segment sits inside the 0.3–3° window by construction; only the author can say it is intended — the same reasoning as `ui:render`'s `data-hole`. Recorded in the PREREG; the test proves the undeclared twin fires. |
| D7 | The export-kit sidecar's `created` is day-granular (`--date`, else `SOURCE_DATE_EPOCH`, else today's UTC date) | agent | The policy requires a timestamp and the kit promises the same bytes per input; a pinned or day-granular date keeps both. `--date` makes runs byte-identical across days. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | False positives on intentional craft | quality | Optical overshoot or a one-colour mark gets flagged | Near-miss controls in 0.2; angle and detail are warnings | Phase 0 — Pre-register, then red |
| 2 | Hook bundle weight | implementation | `svg_rules.ts` is imported by a hook | Keep the new rules import-light, measured by the existing bundle test | Phase 1 — Static mark family |

## Acceptance Criteria

- [x] AC-1 — The lane's probe mark exits 2 under `--class mark`; every clean twin exits 0.
- [x] AC-2 — `brand-identity` has a behaviour eval file.
- [x] AC-3 — The export kit's output carries a parseable provenance sidecar and stays deterministic.
