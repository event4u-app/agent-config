---
complexity: lightweight
---

# Road to design-mechanism harvest

> Fold the portable design-quality *decision procedures* harvested from a frontier-host design-tool prompt into existing design skills — diagram-type routing, geometric pre-checks, same-ramp contrast + dark-mode self-test, the embedded-widget register, the async-verifier pattern, the componentization threshold, and a design→dev handoff template — while explicitly rejecting all corpus vendoring (palettes, CSVs, easing tables, device frames) and taste-blacklists.

## Goal

Adopt 7 design *mechanisms* (portable decision procedures) into `design-intelligence` / `accessibility-auditor` / `fe-design` / `design-review`, and record the rejected corpus-vendoring items with the reference-over-fork rationale — so the suite gains the reasoning without owning volatile data tables.

## Prerequisites

- [ ] Read `AGENTS.md` and `docs/guidelines/design-canon.md`, `docs/guidelines/design-modes.md`, `docs/guidelines/design-antipatterns.md`.
- [ ] Read `src/skills/design-intelligence`, `fe-design`, `design-review`, `accessibility-auditor`, `dashboard-design`, `motion-choreographer`, `typography-system`, `design-tokens`, `iconography` frontmatter + bodies before editing.
- [ ] Read `src/rules/domain-adoption-policy.md` and `src/rules/design-fidelity.md` — the vendor/volatility and 1:1-fidelity floors this roadmap must respect.

## Context

- The design-tool prompt is a rich source of *procedures* and a rich source of *data*. The council split them: adopt procedures, reference data. This roadmap adopts only procedures.
- The hard guardrail (both council members): **reference, don't vendor.** A vendored hex table / easing library / device-frame recipe rots, fork-drifts from upstream, bloats the package, and couples the suite to one aesthetic opinion. Where a skill needs a palette or frames, it links to a maintained upstream (e.g. an established token/color library or the upstream design system), never forks the values.

## Phase 1 — Diagram-type routing ("route on the verb")

The single best transplant from the data-viz module: choose the visualization by the *intent verb*, not the noun. Reference diagrams (flowchart / structural) vs intuition diagrams (illustrative) split on "how does X work" (illustrative default) vs "what is X's architecture" (structural). Plus two geometric escapes: cycles → stepper widget (not a drawn ring); DB schemas/ERDs → mermaid, never hand-placed SVG.

- [ ] Add a diagram-type routing section to `design-intelligence` (or `dashboard-design` if the diagram surface fits better — decide in the overlap scan): verb-based routing table, cycle→stepper, ERD→mermaid, and "count the nouns before you draw" input-complexity triage.
- [ ] Verify: `./scripts-run src/scripts/skill_linter` on the touched skill.

**Exit criteria:** verb-based diagram routing + the two geometric escapes are documented as a decision procedure (no drawn-asset corpus).
**Rollback:** revert the section.

## Phase 2 — Geometric pre-checks (SVG/diagram self-checks)

Concrete pre-finalize checks that catch the highest-failure-rate diagram bugs, as procedures (not constants): compute the lowest/rightmost element + buffer before setting viewBox; trace every arrow for box-intersection before drawing; size each box from its longest label before placing.

- [ ] Add a "geometric pre-check" checklist to the same diagram section: viewBox-safety, arrow-through-box trace, box-width-from-longest-label. Frame as ranked-by-failure-rate self-checks the author runs before finalizing.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** the pre-check checklist is live as a procedure.
**Rollback:** revert the checklist.

## Phase 3 — Same-ramp contrast + mandatory dark-mode self-test

A deterministic contrast procedure (not a palette): text on a colored fill uses a darker stop of the *same* color family, never plain black/gray; title and subtitle are two different stops. Plus a mandatory dark-mode self-test: "if the background were near-black, would every text element still be readable?"

- [ ] Add the same-ramp contrast rule + dark-mode self-test to `accessibility-auditor` as a procedure (the ramp itself stays referenced from the consumer's tokens / an upstream color library, never vendored).
- [ ] Cross-link `design-tokens` (token derivation) and `brand-consistency` so the procedure sits beside token authority without duplicating it.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** same-ramp contrast + dark-mode self-test live as procedures in `accessibility-auditor`; no hex table added.
**Rollback:** revert the section.

## Phase 4 — Embedded-widget register + componentization threshold

Two calibration mechanisms. (a) The **embedded-widget register**: UI embedded inside a host surface (a widget in a slide/chat) follows a flatter charter (restrained weights, hairline borders, no atmospherics) distinct from greenfield standalone pages — a per-surface register selector, not a fixed token set. (b) The **≥4-repeats-plus-state componentization threshold**: extract a component only when an element repeats ~4× AND carries real props/state; a long single-file body is normal.

- [ ] Add the embedded-vs-standalone register selector to `design-intelligence` / `design-modes` guidance (concept + the discriminator; no token values).
- [ ] Add the componentization threshold to `fe-design` (or `ui-component-architect`): the ≥4-repeats+state rule as an anti-premature-componentization heuristic.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** register selector + componentization threshold live as procedures.
**Rollback:** revert each independently.

## Phase 5 — Async-verifier pattern + design→dev handoff template

- [ ] Add the async-verifier pattern to `design-review`: after building, fork a background verifier (its own view, screenshots, probing) that stays silent on pass and only surfaces real, actionable problems (not nitpicks); the main agent does not self-screenshot, keeping its context clean. Frame as an orchestration pattern; cross-link `subagent-orchestration` and `verify-repair-loop` so it's positioned against the existing verify skills, not duplicating them.
- [ ] Add a design→dev handoff README template to `design-review` (or `design-system-capture`): fidelity declaration (hi-fi = pixel-recreate / lo-fi = apply codebase system), per-screen components with states, interactions with duration+easing, tokens section, "implementable from the README alone." Template only — no vendored values.
- [ ] Verify: `./scripts-run src/scripts/skill_linter`.

**Exit criteria:** async-verifier pattern + handoff template live; both positioned against existing skills without duplication.
**Rollback:** revert each section.

## Phase 6 — Record the rejected corpus + taste items

Make the reject decision durable so a future harvest does not relitigate it.

- [ ] Add a short "Rejected by council" note to this roadmap's Notes (below) AND a one-line pointer in the relevant design guideline's See-also: the palette hex table, font-width CSV, easing library, print-CSS recipe, device-frame recipes, anti-slop font/phrase blacklists, and the 10+-question design-intake interrogation are **not adopted** — corpus assets are referenced from upstream (reference-over-vendor per `domain-adoption-policy`); taste-blacklists are subjective enforcement; the interrogation conflicts with the one-question-per-turn law (`ask-when-uncertain`). A design brief that needs many inputs uses a fill-in markdown template, not agent twenty-questions.
- [ ] Verify: `./scripts-run src/scripts/check_refs` on touched files.

**Exit criteria:** the reject rationale is recorded where the next harvester will see it.
**Rollback:** revert the note.

## Acceptance Criteria

- 7 mechanisms adopted as procedures across `design-intelligence`, `accessibility-auditor`, `fe-design`/`ui-component-architect`, `design-review`; each positioned against existing skills without duplication.
- ZERO corpus assets vendored — palettes/CSVs/easing/print-CSS/device-frames all remain upstream references; the reject list is recorded.
- No new always-on rule; no kernel change.
- All touched skills pass `./scripts-run src/scripts/skill_linter`; remote CI is the authoritative gate.
- No tracked artifact names the external source; provenance link remains ENC1-only.

## Notes

**Rejected by council (do not relitigate without new evidence):** palette hex tables, font-width calibration CSV, easing library + motion constants, print/PDF CSS recipe, device-frame recipes (iOS/Material/macOS/browser) — all corpus data, referenced from maintained upstreams not forked; anti-slop banned-font and copy-phrase blacklists — subjective taste enforcement; 10+-question design-intake interrogation and svg-options multiple-choice — conflicts with `ask-when-uncertain` one-question-per-turn (use a fill-in brief template instead).

## Provenance

- **Source B** — a frontier-host design-tool system prompt (~465 KB) + its data-viz module: diagram routing, geometric pre-checks, contrast/dark-mode procedures, embedded-widget register, async-verifier pattern, componentization threshold, handoff template. (Also the rejected corpus assets.)

Deep-dive per `external-reference-deep-dive`: the ~465 KB prompt and the data-viz module read in full (structure map + line-referenced mechanism extraction); raw named evidence stays local-only.

Retained link (maintainer-recoverable):
`ENC1:AtE+jtEKxbFoG71WG7uALX049s2/EnHhPgO8ZFbUXELDvCvYINu8DYvyNBvrhMtB6631vB27BRkW51BZZcZQSVN8YTrVMWXwuHmdMuVb78xbQ/v1ro7HGnDoweCWMSJwTdcjlsjA8FJPxbgnKNINik0WQ8qp2sILqjFHTc1Wq+NXi6tDCXaemBG/cHQsTatPy00Iqq4=`

Council (claude-sonnet-4-5 + gpt-4o, 2 rounds, 2026-07-08) converged: ADOPT the mechanisms (portable decision procedures); REJECT all corpus vendoring (reference-over-fork is the single biggest guardrail against corpus rot — both members named it) and the design-intake interrogation (one-question-law conflict).
