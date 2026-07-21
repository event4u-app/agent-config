---
complexity: structural
status: ready
---

# Road to doc-follows-code — a deterministic, framework-agnostic doc-impact discipline

> **Council decision** (claude-sonnet-4-5 + gpt-4o, 2026-07-21, 3-round debate —
> strong convergence by round 3). The problem: when CODE changes, the related
> documentation (README, hand-written `.md`, contract specs, ADRs, examples,
> CHANGELOG) is frequently NOT updated and silently goes stale — in this package
> AND in consumer projects that install the suite. Two independent surveys
> confirmed the gap: all ~20 existing sync gates check reference-existence,
> hashes, or counts — **none checks that a doc's prose still describes what the
> code does**, and the consumer surface has only one advisory skill table (no
> Iron-Law rule, no CI backstop). Live drift already present: `src/agent-src/
> README.md:4` and `src/skills/agents-md-thin-root/SKILL.md` still name the
> retired `.agent-src.uncondensed/` path as source-of-truth, contradicting the
> current `src/` model.
>
> **Converged design (do not relitigate):** EXTEND over create. The core is a
> **deterministic change-surface discipline** — a change to a PUBLIC surface
> (exported signature, HTTP route, CLI command/flag, config/settings key, env
> var, DB schema, event payload) that touches no doc is a broken change, with an
> explicit escape hatch (`refactor:` / documented "no doc needed"). Drift is
> defined as a **falsifiable-claim contradiction** (a reader following the doc
> would be misled), NOT documentation completeness. Package and consumer share
> the same design; consumer detection is framework-agnostic.
>
> **Explicitly NOT building** (both members, evidence-gated): an LLM-based
> doc-freshness judge as a core/enforced gate (non-deterministic, token cost,
> false-positive fatigue, framework-brittle — the repo's smarter deterministic
> checklist already failed to stop drift); a heavy `doc_surface_map.yaml`
> registry that itself goes stale; any gate that fires on every commit and gets
> routinely overridden.

## Goal

Make "docs follow code" reliable at authoring time, in this package and in
consumer projects, using deterministic mechanisms only. Deliver: (1) a
first-class Doc-Impact obligation in the always-loaded `downstream-changes`
rule, (2) an actionable framework-agnostic Doc-Impact procedure in the
`agent-docs-writing` skill, (3) one new deterministic CI backstop that catches
source-of-truth pointer drift, (4) a consumer-facing opt-in check + documented
story, (5) validation by fixing the named live contradictions and
dogfood-documenting the mechanism.

## Context (measured — do not relitigate)

- Existing three-layer sync pattern: Iron-Law rule → CI backstop script → hook.
  ~20 gates exist; all check reference-existence / structural-preservation /
  hash-count-keyword. Behavior-vs-prose drift is entirely uncaught.
- `src/rules/downstream-changes.md:48` — the single advisory "Documentation"
  table row (auto-loaded rule; NOT kernel → no slow-rollout soak; IS
  always-loaded → keep edits tight for the always-budget cap).
- `src/skills/agent-docs-writing/SKILL.md` — advisory "Doc sync check" table;
  explicitly forbids auto-updating docs (`:213`).
- `src/scripts/check_references.ts:50` — `SCAN_DIRS = ['dist/agent-src','agents']`
  (prose trees `docs/guidelines/`, `docs/contracts/` NOT scanned).
- Live contradictions to fix as validation: `src/agent-src/README.md:3-6`;
  `src/skills/agents-md-thin-root/SKILL.md:24,32,50` (retired-path pointers).
- Settings: no project `.agent-settings.yml` → template defaults;
  `quality.local_auto_run: false` → NO full-pipeline CI steps in this roadmap;
  only targeted verification of the NEW gate is allowed (and required) per
  `roadmap-ci-steps-policy` + `verify-before-complete`.
- `src/` is source of truth; rule/skill edits must be re-condensed via
  `/condense` (deterministic regeneration) before the projections match.

## Prerequisites

- [x] Two current-state surveys complete (existing mechanisms + doc surfaces).
- [x] Council debate complete (3 rounds, strong convergence).
- [x] Live fix-points verified against source (README, thin-root, downstream,
      check_references).

## Phase 1 — Strengthen the behavioral obligation (rule, both surfaces)

- [x] In `src/rules/downstream-changes.md`, upgrade the single "Documentation"
      table row into a first-class **Doc-Impact** obligation: name the PUBLIC
      surfaces (HTTP route/endpoint, exported function/class signature, CLI
      command/flag, config/settings key, env var, DB schema/migration, event
      payload) whose change REQUIRES updating the doc that describes it in the
      SAME change (README, API/OpenAPI, AGENTS.md, examples, CHANGELOG). Frame
      drift as a falsifiable-claim contradiction ("a doc claim the code now
      contradicts is a broken change, not a style nit").
- [x] Add the explicit escape hatch: refactor-only / no-public-surface change →
      no doc obligation; if a surface changed but no doc needs it, state the
      one-line reason. Prevents false-positive fatigue.
- [x] Keep the edit telegraph-tight (always-budget); route any long detail to
      the `agent-docs-writing` skill (Phase 2) via a pointer, per the repo's
      body-migration pattern. Do NOT weaken the existing Iron Law
      (preservation-guard).
- [x] Cross-link the rule ↔ skill (See-also) both directions.

## Phase 2 — Actionable doc-impact procedure (skill, consumer-facing)

- [x] In `src/skills/agent-docs-writing/SKILL.md`, convert the advisory "Doc
      sync check" table into an actionable, framework-agnostic **Doc-Impact
      procedure**: a concrete public-surface → doc-target map that works across
      stacks (Laravel/Symfony/Next.js/Python/Go), with a "run this after every
      code change" trigger. Keep human-in-the-loop for the actual edit, but make
      the DETECTION concrete and non-optional.
- [x] Add the falsifiable-claim test (endpoint gone / wrong return type /
      renamed key / broken example = drift; "could be more detailed" = not
      drift) so the procedure has a clear fire/no-fire line.
- [x] Verify skill still passes the skill linter (`skill_linter` on the one
      changed skill + rule only — targeted, not full pipeline; both PASS).

## Phase 3 — Deterministic package backstop (new check + CI wire)

- [x] Add `src/scripts/check_source_pointer_freshness.ts`: a deterministic gate
      that fails when an AUTHORING artifact (allowlist scoped to the two files
      that assert source-of-truth location: `src/agent-src/README.md`,
      `src/skills/agents-md-thin-root/SKILL.md`) asserts a RETIRED
      source-of-truth pointer (`.agent-src.uncondensed/`,
      `packages/core/.agent-src.uncondensed/`) as the current source. Inline
      `<!-- pointer-freshness: historical -->` marker exempts a genuinely
      historical line; ADRs / archived roadmaps are out of scope by
      construction. Includes `--selftest`. (Templates + 184 other src/ files
      still carry the token → documented Phase 4/5 follow-up, not a blind
      sweep — the council's do-not-build "every-commit override" warning.)
- [x] Wire the check into `Taskfile.yml` `ci:` (both lists) + `ci-fast` task
      def, alongside the sibling `check-no-external-sources` gate.
- [x] Add a test under `tests/scripts/check_source_pointer_freshness.test.ts`
      (matcher + `_scanFile` positive/clean/historical fixtures + CLI
      `--selftest`), satisfying `check_test_coverage_diff`. 10/10 green.
- [x] Seed the check GREEN — Phase 5 contradiction fixes landed
      (`src/agent-src/README.md` + `src/skills/agents-md-thin-root/SKILL.md`);
      `check_source_pointer_freshness` exits 0.

## Phase 4 — Consumer surface (opt-in check template + documented story)

- [x] Ship a framework-agnostic, opt-in consumer CI-check template
      (`src/agent-src/templates/github-workflows/doc-impact.yml`) that WARNS
      when a changed public surface (routes/ · migrations/schema · openapi ·
      cli/commands · `.env.example` · config) has no accompanying doc change —
      with the `[docs:not-needed]` / `refactor:` escape hatch and a `STRICT`
      toggle (default off). Warn-first, opt-in — avoids the every-commit-
      override failure mode. YAML validated; detection logic unit-simulated.
- [x] Document the consumer story in the workflow's self-documenting header
      (the established convention of the sibling opt-in workflows — no new doc,
      anti-sprawl): explains the Doc-Impact rule + skill ship via projection and
      how to enable/strict-ify the optional CI check.

## Phase 5 — Validation + dogfood-document the mechanism

- [x] Fix the named live contradictions so Phase 3's gate is green:
      `src/agent-src/README.md` (now states `src/` as source of truth) and
      `src/skills/agents-md-thin-root/SKILL.md` (verified rename
      `packages/core/.agent-src.uncondensed/` → `src/agent-src/`, matching the
      live emergency-triage-block + AGENTS template paths). Both files pass the
      new gate; thin-root still passes the skill linter.
- [x] Run the new check's `--selftest` (4/4) + a scoped run over the authoring
      set → exit 0 (green); vitest suite 10/10. Targeted verification of the new
      gate (allowed under `roadmap-ci-steps-policy`).
- [x] Re-condense the edited rule + skill: wrote condensed dist twins
      (`downstream-changes`, `agent-docs-writing` = copies; `agents-md-thin-root`
      = copy + cloud_safe/H1 normalization) + `condense.sh --mark-done`;
      `check_condensation` + `check_references` green for the touched files.
- [x] Counts already in sync (`task sync` — scripts/tests/workflow-templates are
      not counted; no skill/rule/command/guideline added). Portability +
      generator-output-coverage green; the new workflow self-documents (no
      catalog to update). Dogfooded the new Doc-Impact rule on this diff.
- [x] Added a `[Unreleased]` CHANGELOG entry (Added: Doc-Impact discipline;
      Fixed: source-of-truth pointer drift). `lint_changelog_rollback` +
      `lint_breaking_changes_index` green; active era 28/250 lines.

## Acceptance criteria

- [x] `downstream-changes` carries a first-class, escape-hatched Doc-Impact
      obligation naming the public surfaces (Phase 1); Iron Law intact.
- [x] `agent-docs-writing` has an actionable framework-agnostic Doc-Impact
      procedure with a clear fire/no-fire line (Phase 2).
- [x] `check_source_pointer_freshness.ts` exists, is wired into CI (3 spots),
      has a test (10/10), and is GREEN over the authoring set (Phase 3 + 5).
- [x] A consumer opt-in check template exists (`doc-impact.yml`) and the
      consumer story is documented in its self-doc header (Phase 4).
- [x] The named live contradictions are fixed; edited rule/skill re-condensed;
      counts/refs consistent; `[Unreleased]` CHANGELOG entry added (Phase 5).
- [x] No LLM judge, no `doc_surface_map.yaml` registry, no every-commit hard
      gate (respected the council's do-not-build list).
