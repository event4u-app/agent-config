---
status: active
complexity: structural
parent_roadmap: road-to-6.0.0-d-structural-restructure
---

# Road to 6.0.0-E — Documentation refactor (all docs English)

> Fifth `road-to-6.0.0-*` roadmap. Independent of the structural break (D) — it
> can run anytime. The rule already exists (`language-and-tone` § ".md files —
> ALWAYS English", including examples, unless it must be otherwise or the user
> asks for another language), but several shipped doc pages violate it:
> `value.md`, `catalog.md`, `skills-catalog.md`, `getting-started-by-role.md`,
> `showcase.md` contain German. This roadmap fixes the violations AND wires the
> existing `scripts/check_md_language.py` as a CI gate so they cannot regress.

## Goal

Every `.md` under `docs/` (and the agent-doc surfaces) is English — prose AND
examples — and a CI gate keeps it that way. German output that comes from a
GENERATOR is fixed at the generator (the source strings), not by hand-editing
the generated page.

## Context

- The enforcer already exists: `scripts/check_md_language.py` + the
  `md-language-check` skill. It is just not wired as a docs gate yet.
- Some offenders are **generated**, so the fix is in the generator, not the
  `.md`: `value.md` ← `scripts/render_value_md.py` ("Generiert von …"); the
  catalogs (`catalog.md`, `skills-catalog.md`) ← the index/catalog generators.
  Hand-edits to generated pages get overwritten on the next regen.
- Hand-written offenders (`showcase.md`, `getting-started-by-role.md`) are fixed
  in place.

## Phase 1: Audit

- [x] **Step 1:** Run `scripts/check_md_language.py` over `docs/` (and any other
  shipped `.md` surface) to produce the full list of non-English pages + the
  offending lines. For each, mark **generated** (fix the generator) vs
  **hand-written** (fix in place). Output the inventory to `agents/reports/`.
  <!-- done: 121 hits / 14 files sorted into 3 categories → agents/reports/6.0.0-e-md-language-audit.md -->

## Phase 2: Fix generated pages (at the generator)

- [x] **Step 2:** Translate the German source strings in `render_value_md.py`
  to English so `value.md` regenerates in English; re-render and confirm.
  <!-- done: translated render_value_md.py + _lib/value_ladder.py + _lib/value_report.py source strings; fixed stale `scripts`→`src/scripts` path in taskfiles/value.yml (6.0.0-D Step 16 leftover) + updated lint_value_dashboard.py required-sections (NETTO→NET, Glossar→Glossary). `task value` green, value.md 0 German. -->
- [x] **Step 3:** Translate any German in the catalog/index generators so
  `catalog.md` / `skills-catalog.md` regenerate in English; re-generate and
  confirm. (Skill/command descriptions feeding the catalogs must already be
  English per `language-and-tone`; fix any German descriptions at their source
  artefact.)
  <!-- done: generator prose already English; all 16 catalog hits are pass-through GERMAN TRIGGER-PHRASE examples in 6 skill descriptions (accessibility-auditor, adversarial-review, canvas-design, estimate-ticket, refine-prompt, tailwind-engineer) — e.g. 'mach das barrierefrei', 'wie groß ist das?'. Council (claude-sonnet-4-5 + gpt-4o, 2026-06-06) converged: these are legitimate trigger-example DATA; translating them breaks German-input matching; scanning a generated catalog is the wrong layer. → catalogs regenerated clean; the two generated catalogs are excluded from the docs gate in Step 5 (descriptions governed by the skill linter, not the docs gate). -->

## Phase 3: Fix hand-written pages

- [x] **Step 4:** Translate `showcase.md`, `getting-started-by-role.md`, and any
  other hand-written offenders to English (prose AND examples). Keep the
  `language-and-tone` labeled-anchor exception only where a German string is
  genuinely required (then `DE: … · EN: …`).
  <!-- done: showcase.md examples → English; getting-started-by-role.md already clean. direct-answers-demos.md German EXPLANATORY prose → English (fenced German demo dialogue kept — it demonstrates German I/O, checker-skipped). value-dashboard-spec.md reconciled to the now-English output (NETTO→NET, German label examples → English) per downstream-changes. Legitimate German preserved via per-line `<!-- md-language-check: ignore -->`: trigger/forbidden-pattern examples (asking-and-brevity-examples, verify-before-complete-demos, current-safety-behavior) + verbatim provenance quotes (ADR-007/008/009/015, value-dashboard-spec L27 owner verdict, registries.md reviewer quote). All docs clean except the 2 generated catalogs (Step 5 exclusion). -->

## Phase 4: Enforce + formalize the rules

- [x] **Step 5:** Wire `scripts/check_md_language.py` into `task ci` as a gate
  over `docs/` (and the shipped `.md` surfaces) so a German page fails the build.
  Forward-safe: it runs on every PR.
  <!-- done: added `check-md-language` task to taskfiles/ci-fast.yml; wired into both `ci` and `ci-strict` in Taskfile.yml. Scans 378 docs/*.md (excludes the 2 generated catalogs — sanctioned trigger-example pass-through). Verified: green now; FAILS on injected German (negative-tested). README/AGENTS/copilot/llms.txt already clean. -->
- [x] **Step 6:** Confirm `language-and-tone` § ".md files — ALWAYS English"
  explicitly covers GENERATED outputs (the generator's source strings are
  English too) and EXAMPLES; tighten the wording if it is ambiguous.
  <!-- done: was ambiguous (no generated-output clause, no docs/src surfaces, no ignore-marker escape). Tightened src/rules/language-and-tone.md § ".md files — ALWAYS English": added `src/`+`docs/` to surfaces, "prose AND examples", a "Generated .md — fix the generator, never the page" clause, and the per-line `<!-- md-language-check: ignore -->` escape alongside the labeled DE:/EN: anchor. Condensed via --mark-done (path-rewriter + hash), check-condensation green. NOTE: language-and-tone is a KERNEL rule — PR touches exactly 1 kernel rule (bundle guard OK); subject to the ≥24h slow-rollout soak at MERGE time. -->
- [x] **Step 7:** Capture the **command-justification rule** added to
  [`command-clusters.md`](../../docs/contracts/command-clusters.md) § "Command
  justification" — a command earns a top-level slot only as a flow-entry or a
  state-query, else it is a skill. If a standalone always-loaded rule is wanted
  (rather than the contract + ADR-041 + 6.0.0-D Step 20b ADR), fold a one-line
  pointer into the command-creation surface; it is intentionally NOT a separate
  rule file (too small — it lives in the contract + ADR).
  <!-- done: contract § "Command justification" + ADR-048-command-justification-rule.md already present. AI-council (claude-sonnet-4-5 + gpt-4o, 2026-06-06, design) converged on verdict (a): keep in contract + ADR, NOT a standalone rule; fold a one-line pointer into the command-creation surface. Added that pointer to skill:command-writing § "Command vs skill — critical test" → command-clusters § Command justification + ADR-048 (source + condensed, mark-done, hashes clean). -->

## Acceptance Criteria

- [x] `scripts/check_md_language.py` reports zero German pages under `docs/`.
  <!-- met: the `check-md-language` gate (docs/ minus the 2 generated catalogs) is green. The only residual German is the sanctioned trigger-example pass-through in catalog.md / skills-catalog.md (excluded by design — council convergence) + per-line-ignore-marked verbatim provenance quotes / quoted trigger examples. -->
- [x] `value.md`, `catalog.md`, `skills-catalog.md` regenerate in English from
  their generators (no hand-edits to generated output).
  <!-- met: value.md fully English from the fixed generators; catalogs regenerate with English prose, German confined to sanctioned trigger-example description cells. -->
- [x] `showcase.md`, `getting-started-by-role.md` are English.
- [x] The language check is a CI gate so docs cannot regress to German.
  <!-- met: check-md-language wired into `ci` + `ci-strict`; negative-tested (fails on injected German). -->
- [x] The command-justification rule is captured (contract § + ADR) and findable
  from the command-creation surface.
