# Road to 1.15 Followups

**Status:** PLANNED — Identity rewrite (P0 #1) is the visible plate; rest captured for sequencing.
**Started:** 2026-05-02
**Trigger:** External review of the 1.15.0 release. Release scored 9.1 / 10 overall (8.8 / 10 as a consistent release) — strong consolidation, real progress on `docs/contracts/`, Stability Policy, Migration Guide, count-drift fix, public-link check, rule-interaction linter. The remaining gap is **public identity + governance surface**.
**Mode:** Sequential — P0 items land before P1; P2 stays capture-only until P0 #1 + #2 are done.

## Source

External review notes captured verbatim in this roadmap; not duplicated. Key delta from earlier feedback:

- Engine-vs-runtime framing is now correct in `README.md` and `docs/architecture.md`.
- `docs/contracts/` exists, Stability frontmatter exists, public-link check enforces it.
- Migration Guide is in place.
- Count-drift fixed; `update_counts.py` wired into `task sync` + CI.
- Always-rule budget reduction has **not** shipped yet — biggest remaining technical risk.

## Purpose

Consolidate the 1.15.0 review into actionable, scoped phases — without resurfacing the things 1.15.0 already fixed. The maintainer's overriding instruction: **this package is universal, not Laravel-specific.** Every identity-shaped surface (README opener, taglines, "who this is for" sections) must read stack-neutral; Laravel is the deepest **reference stack**, never the **identity**.

## Design anchors (locked, not open for renegotiation)

| Anchor | Source | Decision |
|---|---|---|
| Identity is universal | Maintainer instruction (this turn) | The package is a universal governed AI delivery system. Laravel is the deepest reference stack, never the headline. No "for PHP / Laravel teams", no "Laravel-first", no Laravel-coloured opener. |
| No release pinning | `scope-control` § Git operations | Phases describe **work**, never target releases, tags, or deprecation dates. The 1.15.0 reference in the title is a **historical** anchor, not a ship target. |
| Fenced delivery | `scope-control` § Fenced step | Each phase ends at a deliverable. The maintainer reopens execution explicitly; no auto-handoff to "shall we start?". |
| Capture-only beyond P0 | This file | P1 and P2 items are recorded for sequencing only. They do not start until P0 #1 + #2 land. |

## Horizon (visible plate)

**Inside the plate (this iteration):**

- **P0 #1 — Identity rewrite.** README opener, taglines, "who this is for", quickstart framing, all stack-neutral. Laravel demoted to "deepest reference stack" wherever it currently reads as primary identity.

**Outside the plate (capture-only, sequenced):**

- P0 #2 — Always-rule budget reduction.
- P0 #3 — Command-collapse phase 1.
- P0 #4 — Token-overhead wording fix.
- P1 #5 — Work-Engine CLI modularisation.
- P1 #6 — Public artefact catalog.
- P1 #7 — Outcome demos.
- P2 #8 — Rule-interaction matrix substance.
- P2 #9 — Outcome-aware telemetry.

## P0 — Visible plate

### P0 #1 — Identity rewrite (Laravel ≠ identity)

> Granularity: F-step, each row is a single PR-able commit.

- [x] **F1.1** Audit every file under `README.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `docs/architecture.md`, `docs/contracts/*.md` for Laravel-coloured identity language (greppable list: "Laravel-first", "for PHP / Laravel teams", "primary audience: Laravel", "built for Laravel", "Laravel = primary"). Produce a deliverable list of locations + current wording + proposed neutral wording.

  **Audit results (2026-05-02).** None of the explicit banned phrases hit (`Laravel-first`, `for PHP / Laravel teams`, `primary audience: Laravel`, `built for Laravel`). Identity-frame-leaning lines that still need neutralization:

  | File | Line | Current wording (excerpt) | Action |
  |---|---|---|---|
  | `README.md` | 7 | "Reference implementation: Laravel; parallel skill sets for Symfony · Zend/Laminas · Next.js · React · Node grow alongside." | F1.2 — universal framing first; Laravel referenced only as one of several reference stacks. |
  | `README.md` | 283 | "**Reference implementation: Laravel.** Deepest skill density today …" (under § Who this is for) | F1.3 — reframe as "deepest skill density today" without Laravel as the bolded headline. |
  | `AGENTS.md` | 18, 46 | "no `app/` directory, no Laravel runtime"; "No PHP, no Laravel, no JavaScript runtime dependencies." | F1.4 — keep technical accuracy, drop the Laravel-first reading. |
  | `.github/copilot-instructions.md` | 5, 22, 23 | "not a Laravel/PHP application"; "No PHP source files, no Laravel code, no JavaScript runtime deps. If you see Laravel-specific suggestions in a PR …" | F1.4 — generalize "Laravel" → "framework" / "application stack". |
  | `docs/architecture.md` | 67 | "stack analysis (Laravel · Symfony · Zend / Laminas · Next.js · React · Node)" | No change — Laravel is one item in a list, no identity bias. |
  | `docs/contracts/STABILITY.md` | — | No Laravel mentions. | F1.6 — no edit needed; record as audited. |

  Banned-phrase grep is empty, so the F1.5 lint can ship with an authoritative starter list. P0 #4 (Token-overhead wording) cell verified: the literal "Zero" sits under header "Token overhead" in the Cost-profiles table at `README.md` line 255–257.
- [x] **F1.2** Rewrite `README.md` opener (lines 1–11) — universal framing first; Laravel referenced only as "deepest reference stack".
- [x] **F1.3** Rewrite `README.md` § "Who this is for" / quickstart prose so the opener doesn't get contradicted three sections later.
- [x] **F1.4** Apply the same neutral framing to `AGENTS.md` opener and the `.github/copilot-instructions.md` opener if they currently read Laravel-first.
- [x] **F1.5** Add a CI lint (`scripts/check_identity_framing.py` or extend an existing linter) that fails when README/AGENTS opener prose contains the banned phrases. Same source-of-truth as `check-public-links`.

  **Implemented as Layer 5 of `scripts/check_portability.py`** — `check_identity_framing()` scans `README.md`, `AGENTS.md`, `.github/copilot-instructions.md` for 7 banned phrases (`Laravel-first`, `for PHP/Laravel teams`, `for Laravel teams`, `primary audience: Laravel`, `built for Laravel`, `Laravel = primary`, bolded `**Reference implementation: Laravel.**`). All hit synthetic violations cleanly; current files pass. No separate `check_identity_framing.py` script — consolidating into `check_portability.py` keeps the portability contract in one place and re-uses the existing `Violation` machinery + CI wiring.
- [ ] **F1.6** Update `docs/contracts/STABILITY.md` if it inherits any Laravel-coloured language; the contract layer must be stack-neutral by definition.

**Exit criteria:** Stranger reads README top + AGENTS top + copilot-instructions top — comes away thinking "universal governance package, Laravel happens to have the deepest skill density today" — never "Laravel package".

### P0 #2 — Always-rule budget (capture-only, sequenced after #1)

Targets from review: `always total ≤ 49k tokens`, `single always rule ≤ 8k`, `top-5 always ≤ 28k`. Current state shows 56 rules — bigger than at 1.14.0. Scope: identify which rules can demote to `auto`, which can merge, and which are genuinely always-on. Hand-off to `agent-authority` index pattern if the discussion surfaces a higher-band consolidation.

### P0 #3 — Command-collapse phase 1 (capture-only)

Top-3 collapse already in plan: `/fix`, `/feature`, `/optimize`. Old commands stay as shims behind `lint-no-new-atomic-commands` (already shipped 1.15.0). Scope: produce a deliverable list of commands per cluster + shim plan + linter exemption story.

### P0 #4 — Token-overhead wording fix (capture-only)

Replace "Token overhead: Zero" in `README.md` § Cost profiles with "No background-process overhead" or "Zero runtime process overhead" — wherever the literal "Token overhead: Zero" string appears. Small and safe, but technically misleading today.

## P1 — Capture-only

### P1 #5 — Work-Engine CLI modularisation

Split `cli.py` into focused modules: `cli_args.py`, `state_io.py`, `input_builders.py`, `hook_bootstrap.py`, `runner.py`, `emitters.py`. Not cosmetic — the engine is the product core; future extension surfaces (memory, telemetry, council integration) will hit it directly.

### P1 #6 — Public artefact catalog

Today there is no navigable public index across the 300+ artefacts (skills, commands, rules, guidelines). Goal: a maintained catalog usable by humans **and** agents \u2014 likely generated from frontmatter, not hand-written.

### P1 #7 — Outcome demos

Backend `/implement-ticket` walkthrough, `/work` free-form walkthrough, UI track walkthrough, blocked / partial-completion path walkthrough. The package today demonstrates inputs and outputs separately; the demo gap is end-to-end traces.

## P2 — Capture-only

### P2 #8 — Rule-interaction matrix substance

`lint-rule-interactions` shipped 1.15.0; the matrix it lints against is still thin. Phase-2 work: populate the interaction matrix with the real cross-rule semantics (Hard Floor wins, Permission Gate above Commit Default, etc.).

### P2 #9 — Outcome-aware telemetry

Current artefact-engagement telemetry records "consulted / applied". Extend to: `blocked`, `partial`, `memory_influenced_decision`, `verification_failed`, `stop_rule_triggered`. Outcomes, not just artefact hits.

## Out of scope for this roadmap

- Anything 1.15.0 already shipped (contracts dir, Stability Policy, Migration Guide, count-drift fix, public-link check, rule-interaction linter, golden-replay smoke, CI duration, counts-check, work-engine beta label).
- Council Modes (Phase 2a/2b/2c) — separate roadmap: [`road-to-council-modes.md`](road-to-council-modes.md).
- AI Council Phase 1 — already shipped: [`road-to-ai-council.md`](road-to-ai-council.md).

## Open questions (do not block P0 #1)

- Q1 — Identity lint: should `check_identity_framing.py` be a new script, or a section inside `check_portability.py`? (Default: extend `check_portability.py` since the violation surface overlaps.)
- Q2 — Command-collapse: does `lint-no-new-atomic-commands` need a temporary allowlist while the shims are added, or do shims count as "not-new"? (Defer until P0 #3 starts.)
- Q3 \u2014 Always-budget measurement: which token counter is canonical for the budget? (Defer until P0 #2 starts \u2014 the team likely already standardised on one inside the existing optimisation tooling.)
