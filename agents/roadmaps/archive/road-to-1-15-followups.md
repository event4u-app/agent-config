# Road to 1.15 Followups

**Status:** COMPLETE — P0, P1, and P2 all verified shipped. Pending maintainer sign-off only.
**Started:** 2026-05-02
**Trigger:** External review of the 1.15.0 release. Release scored 9.1 / 10 overall (8.8 / 10 as a consistent release) — strong consolidation, real progress on `docs/contracts/`, Stability Policy, Migration Guide, count-drift fix, public-link check, rule-interaction linter. The remaining gap is **public identity + governance surface**.
**Mode:** Sequential — P0 items land before P1; P2 stays gated until P0 #1 + #2 are done. **P0 verified complete 2026-05-02 → P1 + P2 now eligible to execute.**

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

## Horizon

**Shipped (verified 2026-05-02):**

- P0 #1 — Identity rewrite. README + AGENTS + copilot-instructions stack-neutral, F1.5 lint live.
- P0 #2 — Always-rule budget. Measurement under all three caps; no demotions needed.
- P0 #3 — Command-collapse phase 1. `/fix` · `/feature` · `/optimize` clusters + shims + locked contract.
- P0 #4 — Token-overhead wording fix. Cost-profiles table corrected.
- P1 #5 — Work-Engine modularisation. `templates/scripts/work_engine/` split into focused modules.
- P1 #6 — Public artefact catalog. `docs/catalog.md` + `docs/skills-catalog.md` generated from frontmatter.
- P2 #8 — Rule-interaction matrix substance. 9 rules, 13 pairs in `docs/contracts/rule-interactions.yml`.
- P2 #9 — Outcome-aware telemetry. Five outcome categories (`blocked`, `partial`, `memory_influenced_decision`, `verification_failed`, `stop_rule_triggered`) live on engagement event schema, recorder CLI, aggregator, and Markdown / JSON reports.
- P1 #7 — Outcome demos. Four end-to-end walkthroughs (backend, free-form, UI, blocked) in [`docs/end-to-end-walkthroughs.md`](../../docs/end-to-end-walkthroughs.md), each anchored to a golden transcript under `tests/golden/baseline/`.

**Open:** _(none — roadmap complete pending maintainer review)_

## P0

### Phase 1 — Identity rewrite (P0 #1, Laravel ≠ identity)

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
- [x] **F1.6** Update `docs/contracts/STABILITY.md` if it inherits any Laravel-coloured language; the contract layer must be stack-neutral by definition.

  **Verified clean (2026-05-02).** `grep -niE "laravel|php|symfony|next\.js|react|node"` against `docs/contracts/STABILITY.md` returns zero hits across all 95 lines. The contract describes stability levels (`stable | beta | experimental`), promotion rules, and the contract surface — entirely stack-agnostic. No edit needed.

**Exit criteria:** Stranger reads README top + AGENTS top + copilot-instructions top — comes away thinking "universal governance package, Laravel happens to have the deepest skill density today" — never "Laravel package".

### Phase 2 — Always-rule budget (P0 #2)

Targets from review: `always total ≤ 49k tokens`, `single always rule ≤ 8k`, `top-5 always ≤ 28k`. The "56 rules" figure in the original review was the **total** rules count (always + auto); the always-injected subset was already much smaller and has been kept disciplined.

Measurement (2026-05-02, `.agent-src/rules/*.md` with `type: always`):

| Metric | Target | Current | Status |
|---|---|---|---|
| always rules count | — | 8 | OK |
| total tokens (1t ≈ 4 chars) | ≤ 49 000 | 9 470 | ✅ 19% of cap |
| top-5 tokens | ≤ 28 000 | 6 884 | ✅ 25% of cap |
| max single rule | ≤ 8 000 | 1 582 (`non-destructive-by-default`) | ✅ 20% of cap |

Top-5 always rules: `non-destructive-by-default` (1 582t) · `scope-control` (1 439t) · `language-and-tone` (1 421t) · `ask-when-uncertain` (1 291t) · `direct-answers` (1 151t). All eight always rules are doctrinal Iron-Law surfaces — no demotion candidate without weakening the floor. Auto rules (44) are not budget-bound by the targets above; they only fire when the trigger description matches.

- [x] **Verified under budget** — measurement above, no demotions required (2026-05-02).

### Phase 3 — Command-collapse phase 1 (P0 #3)

Top-3 collapse shipped in 1.15.0:

- `/fix` orchestrator dispatches to `ci · pr · pr-bots · pr-developers · portability · refs · seeder` (replaces 7 atomic commands).
- `/feature` orchestrator dispatches to `explore · plan · refactor · roadmap · dev` (replaces 5 atomic commands).
- `/optimize` orchestrator dispatches to `agents · augmentignore · rtk · skills` (replaces 4 atomic commands).

Net: 16 atomic commands collapsed into 3 cluster commands. Old atomic command files stay as deprecation shims (one release) and declare `cluster:` in frontmatter so `scripts/lint_no_new_atomic_commands.py` accepts them. Locked contract: [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

Linter status: `task lint-no-new-atomic-commands` is green. The shim mechanism (existing files declare `cluster:`) avoids needing a temporary allowlist.

- [x] **Shipped** — orchestrators + shims + locked contract in place (2026-05-02 verification).

### Phase 4 — Token-overhead wording fix (P0 #4)

Replaced. `README.md` § "You don't need everything" Cost-profiles table at L255–259:

- Column header: `Token overhead` → `Runtime process overhead` (the column intent is background-process spawning, not document token consumption — rules/skills always consume tokens when loaded into context).
- Minimal row value: `Zero` → `None` (parallels the header rephrase).
- Balanced/Full rows untouched (`Low` / `Moderate` already accurate against the new header).

Single-table edit, zero downstream callers, `task ci` green.

- [x] **Replace** `Token overhead` → `Runtime process overhead` and `Zero` → `None` in README cost-profiles table (commit 1bcdb26, 2026-05-02).

## P1

### Phase 5 — Work-Engine CLI modularisation (P1 #5)

Split shipped. `templates/scripts/work_engine/` is already broken into focused modules (verified 2026-05-02):

| Module | Lines | Role |
|---|---|---|
| `cli.py` | 195 | Top-level entry, orchestrates a single `work` invocation |
| `cli_args.py` | 116 | Argument parsing surface |
| `state_io.py` | 202 | Read / write `.agent-state.json`, atomic swaps |
| `input_builders.py` | 163 | Refine / score / plan input construction |
| `hook_bootstrap.py` | 76 | Per-host hook wiring |
| `emitters.py` | 43 | Stdout / log emitters |
| `dispatcher.py` | 331 | Phase-step routing (replaces planned `runner.py` — same role, name diverged) |
| `delivery_state.py` | 137 | Delivery-state machine |
| `state.py` | 641 | Persistent run state, status fields, transitions |
| `persona_policy.py` | 85 | Persona resolution |
| `errors.py` | 19 | Engine-specific exceptions |
| `__init__.py` / `__main__.py` | 58 / 9 | Package surface, `python -m work_engine` entry |

Plus sub-packages: `directives/`, `hooks/`, `intent/`, `migration/`, `resolvers/`, `scoring/`, `stack/`. The naming divergence (`dispatcher.py` for `runner.py`) is intentional — the file dispatches to phase-step handlers, "dispatcher" reads more accurately than "runner".

- [x] **Shipped** — modular split in place; future extension surfaces (memory, telemetry, council integration) hook into the dispatcher cleanly (2026-05-02 verification).

### Phase 6 — Public artefact catalog (P1 #6)

Catalog shipped. Two generated indices live under `docs/`:

- [`docs/catalog.md`](../../docs/catalog.md) — full public catalog of **295 artefacts** (skills, commands, rules, guidelines, personas) with kind, name, description, link to source. Generated by `scripts/generate_index.py` from frontmatter.
- [`docs/skills-catalog.md`](../../docs/skills-catalog.md) — skills-only alphabetical view (128 entries). Generated by `scripts/generate_catalog.py`.

Both files declare `Auto-generated — do not edit manually` and ship with the package; agents can navigate them directly.

- [x] **Shipped** — generated catalog + skills-only view from frontmatter (2026-05-02 verification).

### Phase 7 — Outcome demos (P1 #7)

Backend `/implement-ticket` walkthrough, `/work` free-form walkthrough, UI track walkthrough, blocked / partial-completion path walkthrough. The package today demonstrates inputs and outputs separately; the demo gap is end-to-end traces.

- [x] **Shipped** — four cycle-by-cycle walkthroughs in [`docs/end-to-end-walkthroughs.md`](../../docs/end-to-end-walkthroughs.md), each anchored to a checked-in golden transcript (GT-1 backend, GT-P1 free-form, GT-U2 UI track, GT-2 blocked); cross-linked from `docs/showcase.md` (2026-05-02).

## P2 — Capture-only

### Phase 8 — Rule-interaction matrix substance (P2 #8)

`lint-rule-interactions` shipped 1.15.0; matrix populated with substantive cross-rule semantics in [`docs/contracts/rule-interactions.yml`](../../docs/contracts/rule-interactions.yml).

State (2026-05-02): **9 rules declared, 13 pairs**. Anchor coverage complete (`non-destructive-by-default` × all five required partners). Additional pairs document the Priority Index relationships (`agent-authority` × Hard Floor / Permission Gate / Commit Default), `scope-control` × `commit-policy` narrowing, and the user-interaction triad (`ask-when-uncertain` × `direct-answers`, `language-and-tone` × `direct-answers`).

Each pair carries `id`, `rules`, `relation` (one of: overrides, narrows, defers_to, restates, gates, complements), `conflict`, `resolution`, and `evidence` with file-anchor citations. `task lint-rule-interactions` green.

- [x] **Shipped** — matrix populated with 13 pairs covering Hard-Floor anchors, autonomy-vs-gate semantics, Priority Index routing, and user-interaction composition (2026-05-02).

### Phase 9 — Outcome-aware telemetry (P2 #9)

Current artefact-engagement telemetry records "consulted / applied". Extend to: `blocked`, `partial`, `memory_influenced_decision`, `verification_failed`, `stop_rule_triggered`. Outcomes, not just artefact hits.

- [x] **Shipped** — five outcome categories on `EngagementEvent` schema (`ALLOWED_OUTCOMES`), aggregator counts (`AggregateResult.outcomes`), Markdown + JSON report sections, `telemetry:record --outcome` CLI flag, full test coverage in `tests/telemetry/` (2026-05-02).

## Out of scope for this roadmap

- Anything 1.15.0 already shipped (contracts dir, Stability Policy, Migration Guide, count-drift fix, public-link check, rule-interaction linter, golden-replay smoke, CI duration, counts-check, work-engine beta label).
- Council Modes (Phase 2a/2b/2c) — separate roadmap: [`road-to-council-modes.md`](road-to-council-modes.md).
- AI Council Phase 1 — already shipped: [`road-to-ai-council.md`](road-to-ai-council.md).

## Open questions (do not block P0 #1)

- Q1 — Identity lint: should `check_identity_framing.py` be a new script, or a section inside `check_portability.py`? (Default: extend `check_portability.py` since the violation surface overlaps.)
- Q2 — Command-collapse: does `lint-no-new-atomic-commands` need a temporary allowlist while the shims are added, or do shims count as "not-new"? (Defer until P0 #3 starts.)
- Q3 \u2014 Always-budget measurement: which token counter is canonical for the budget? (Defer until P0 #2 starts \u2014 the team likely already standardised on one inside the existing optimisation tooling.)
