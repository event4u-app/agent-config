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

- [ ] **Step 1:** Run `scripts/check_md_language.py` over `docs/` (and any other
  shipped `.md` surface) to produce the full list of non-English pages + the
  offending lines. For each, mark **generated** (fix the generator) vs
  **hand-written** (fix in place). Output the inventory to `agents/reports/`.

## Phase 2: Fix generated pages (at the generator)

- [ ] **Step 2:** Translate the German source strings in `render_value_md.py`
  to English so `value.md` regenerates in English; re-render and confirm.
- [ ] **Step 3:** Translate any German in the catalog/index generators so
  `catalog.md` / `skills-catalog.md` regenerate in English; re-generate and
  confirm. (Skill/command descriptions feeding the catalogs must already be
  English per `language-and-tone`; fix any German descriptions at their source
  artefact.)

## Phase 3: Fix hand-written pages

- [ ] **Step 4:** Translate `showcase.md`, `getting-started-by-role.md`, and any
  other hand-written offenders to English (prose AND examples). Keep the
  `language-and-tone` labeled-anchor exception only where a German string is
  genuinely required (then `DE: … · EN: …`).

## Phase 4: Enforce + formalize the rules

- [ ] **Step 5:** Wire `scripts/check_md_language.py` into `task ci` as a gate
  over `docs/` (and the shipped `.md` surfaces) so a German page fails the build.
  Forward-safe: it runs on every PR.
- [ ] **Step 6:** Confirm `language-and-tone` § ".md files — ALWAYS English"
  explicitly covers GENERATED outputs (the generator's source strings are
  English too) and EXAMPLES; tighten the wording if it is ambiguous.
- [ ] **Step 7:** Capture the **command-justification rule** added to
  [`command-clusters.md`](../../docs/contracts/command-clusters.md) § "Command
  justification" — a command earns a top-level slot only as a flow-entry or a
  state-query, else it is a skill. If a standalone always-loaded rule is wanted
  (rather than the contract + ADR-041 + 6.0.0-D Step 20b ADR), fold a one-line
  pointer into the command-creation surface; it is intentionally NOT a separate
  rule file (too small — it lives in the contract + ADR).

## Acceptance Criteria

- [ ] `scripts/check_md_language.py` reports zero German pages under `docs/`.
- [ ] `value.md`, `catalog.md`, `skills-catalog.md` regenerate in English from
  their generators (no hand-edits to generated output).
- [ ] `showcase.md`, `getting-started-by-role.md` are English.
- [ ] The language check is a CI gate so docs cannot regress to German.
- [ ] The command-justification rule is captured (contract § + ADR) and findable
  from the command-creation surface.
