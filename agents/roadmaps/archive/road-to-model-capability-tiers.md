---
status: ready
complexity: structural
---

# Road to Vendor-Neutral Model Capability Tiers

> Convert the just-shipped concrete-model `recommended_model` field
> (`opus | sonnet | gpt | inherit`, ADR-034) into a **vendor-neutral capability
> tier** `model_tier` (`lite | medium | high | inherit`). A Claude user must
> never be recommended `gpt`; each agent resolves the tier to its own best model
> in that band. Supersedes ADR-034.

> **Design council** (anthropic/claude-sonnet-4-5 + openai/gpt-4o, deep, design
> lens, 3 rounds, 2026-05-30) converged on: 3 tiers (`lite|medium|high`, reject a
> 4th), rename to `model_tier` ("keeping `recommended_model` is lying in code"),
> **generator owns the Claude mapping exclusively / non-Claude agents are
> suggestion-only** (no per-vendor runtime table — avoids the "two-clocks" drift),
> long-context as an orthogonal sparse `context: large` modifier (not a tier
> name), `gpt → high`, and a periodic tier→model staleness audit. The phase plan
> below is the council outline adapted to this package: no time-boxing
> (`horizon_weeks: 0`), no live vendor outreach (suggestion-only + docs is the
> autonomous-implementable form of "vendor engagement"), and the conservative
> `model.auto_switch: suggest` default is the staged-rollout safety.

## Goal

Skills/commands declare a **capability band**, not a model. On Claude Code the
band projects to a native `model:` via a single generator-owned mapping
(`high → opus`, `medium → sonnet`, `lite → haiku`); on every other agent the
`model-recommendation` rule surfaces the band as a one-question suggestion that
the agent/user maps to their own line-up. No vendor name ever leaves the band
abstraction in source.

## Context

- **The bug.** ADR-034 shipped `recommended_model` with vendor values. A Claude
  user gets `gpt` recommended for analysis skills — a cross-vendor nonsense, and
  the names are version-brittle. Current tags: opus 45 / sonnet 87 / gpt 31 /
  inherit 191 across 354 skills+commands.
- **Mapping ownership is the load-bearing decision** (council). Exactly one
  place resolves a tier to a concrete model: the Claude generator, because it is
  the only surface that emits a native `model:`. Non-Claude agents NEVER get a
  package-maintained per-vendor table — they get the tier name as a suggestion
  and resolve it themselves. This kills the dual-table drift failure mode.
- **Long-context is orthogonal** to reasoning horsepower (council). A 500-page
  log summary is low-reasoning + high-context. Model it as an optional sparse
  `context: large` modifier, never as a tier. Most skills omit it.
- **Gates.** `minimal-safe-diff` (convert only the model-recommendation surface),
  `scope-control`, `verify-before-complete`, `roadmap-progress-sync`. ADR-035
  supersedes ADR-034.

## Phase 1: Lock the design + ADR-035

The design council already ran (members + date inline above per
`no-roadmap-references`); this phase records it, not re-runs it.

- [x] **Step 1:** Write ADR-035 (via `adr-create`) — tier scheme
  (`lite | medium | high | inherit`), field rename `recommended_model → model_tier`,
  generator-owned Claude mapping (`high→opus`, `medium→sonnet`, `lite→haiku`),
  non-Claude suggestion-only (no per-vendor table), orthogonal `context: large`
  modifier, migration map (opus→high, sonnet→medium, gpt→high, inherit→inherit),
  and the periodic-audit staleness guard. Mark it `supersedes: ADR-034`.
- [x] **Step 2:** Flip ADR-034 frontmatter `superseded_by: 035` and add a one-line
  Status note pointing to ADR-035. Regenerate the ADR index.

**Exit criteria:** ADR-035 accepted, supersession wired both ways, index regenerated.

**Rollback:** delete ADR-035, restore ADR-034 status. No code touched.

## Phase 2: Schema — rename field + tier enum + context modifier

- [x] **Step 1:** In `scripts/schemas/skill.schema.json` and
  `command.schema.json`, rename `recommended_model` → `model_tier` with enum
  `["lite", "medium", "high", "inherit"]` (optional, `additionalProperties`-safe).
- [x] **Step 2:** Add an optional `context` property with enum `["large"]` to both
  schemas (sparse orthogonal modifier; absence = normal context).
- [x] **Step 3:** Update `tests/test_recommended_model_schema.py` →
  `test_model_tier_schema.py`: `lite/medium/high/inherit` pass; `opus`/`sonnet`/
  `gpt`/`haiku`/unknown fail; `context: large` passes, `context: huge` fails;
  both fields optional.
- [x] **Step 4:** Verify `python3 scripts/validate_frontmatter.py` is clean
  before any artefact carries the new field (schema accepts it, old field now
  rejected as unknown until Phase 5 migrates — so run after a sample re-tag).

**Exit criteria:** schemas accept `model_tier` + optional `context`; enum rejects
vendor names and `haiku`; tests green.

**Rollback:** revert the schema rename + the context property + the test rename.

## Phase 3: Generator — tier → native Claude model

- [x] **Step 1:** In `scripts/condense.py`, replace the `recommended_model`
  literal-rewrite logic with a single generator-owned tier→Claude-model map
  (`high→opus`, `medium→sonnet`, `lite→haiku`). When `model.auto_switch: auto`
  and a skill/command declares `model_tier` in `{lite, medium, high}`, render the
  `.claude` SKILL.md with the mapped native `model:` (sub-files stay symlinked —
  ADR-034 Option (b) carries over). `inherit`/absent emit nothing.
- [x] **Step 2:** Drop the old `gpt`-has-no-native-tier branch; `gpt` no longer
  exists. The `context: large` modifier is metadata — it does not change the
  native `model:` (tier owns the model choice). Keep Augment + others on the
  neutral source field.
- [x] **Step 3:** Update `docs/contracts/multi-tool-projection-fidelity.md` — the
  `recommended_model` section becomes `model_tier`, documenting the
  generator-owned Claude mapping and the suggestion-only contract for non-Claude.
- [x] **Step 4:** Verify: temporarily set `model.auto_switch: auto`, tag a sample
  skill `model_tier: high`, run `task generate-tools`, confirm
  `.claude/skills/<name>/SKILL.md` carries `model: opus`; `medium → sonnet`,
  `lite → haiku`; revert the sample. <!-- carve-out: new-gate-verification -->

**Exit criteria:** a `high`-tagged skill projects `model: opus` (medium→sonnet,
lite→haiku) on Claude under `auto`; nothing leaks to Augment; contract updated.

**Rollback:** revert the generator hunk; Claude entries return to pure symlinks.

## Phase 4: Rule + settings — tier-aware, suggestion-only off-Claude

- [x] **Step 1:** Rewrite `rules/model-recommendation.md` to reason over
  `model_tier` (cite `contexts/model-recommendations.md`). Surface-aware: Claude
  (`auto`) already switched via native `model:` — no double-ask; **non-Claude
  agents get the tier name as a one-question suggestion** ("this skill recommends
  the **high** capability tier — switch to your strongest model"), with NO
  package-maintained per-vendor model table.
- [x] **Step 2:** Keep the `model.auto_switch` toggle semantics; update the rule,
  `templates/agent-settings.md`, and `config/agent-settings.template.yml` wording
  from model names to tiers. The wizard step keeps `model.auto_switch` (no change
  needed — it is the same toggle).
- [x] **Step 3:** Update `contexts/model-recommendations.md`: re-express the
  task→model table as task→**tier** (architecture/review/debugging/design → high;
  tests/CRUD/quality/config/docs → medium; trivial mechanical → lite; large
  analysis → high + `context: large`). Preserve the downgrade-reminder + Gemini
  flows, re-pointed at tiers.

**Exit criteria:** rule describes a working tier mechanism; no per-vendor table;
no double-ask on Claude; context file expresses tiers; toggle docs say tiers.

**Rollback:** restore the prior rule + context wording.

## Phase 5: Migrate the 354 tags + linter + tests

- [x] **Step 1:** Rewrite `scripts/backfill_recommended_model.py` →
  `scripts/backfill_model_tier.py`: classify to `lite | medium | high` (deep
  reasoning → high; mechanical/impl/docs/tests/quality → medium; clearly-trivial
  mechanical → lite; ambiguous/meta → inherit), and set `context: large` on the
  genuinely-long-context skills (project-analysis*, repomix, deep-reading,
  universal-project). Re-runnable + documents the heuristic.
- [x] **Step 2:** Migrate the existing tags via the value map (opus→high,
  sonnet→medium, gpt→high, inherit→inherit) where a skill already carries
  `recommended_model`, then drop the old key. Write `model_tier` to BOTH source
  and `.agent-src` (byte-identical frontmatter); refresh condensation hashes.
- [x] **Step 3:** Rename `scripts/lint_recommended_model_coverage.py` →
  `lint_model_tier_coverage.py` (error-level: every skill/command carries a
  `model_tier`). Rewire the `task ci` aggregates + the `ci-fast` task name.
- [x] **Step 4:** Re-anchor the line-based framework-leakage allowlist if the
  field rename changes any frontmatter line count.
- [x] **Step 5:** Verify: `validate_frontmatter`, `skill_linter --all`,
  `lint_model_tier_coverage`, condensation/sync/hashes all green; spot-check a
  `high` skill → `model: opus` and a `lite` skill → `model: haiku` under `auto`.

**Exit criteria:** zero `recommended_model` left; every artefact carries a
`model_tier`; coverage linter green; projection spot-checks correct.

**Rollback:** `git checkout` the artefacts + revert the script renames.

## Phase 6: Measure + staleness audit

- [x] **Step 1:** Refresh `agents/evidence/analysis/per-skill-model-distribution.md`
  with the tier distribution (lite/medium/high/inherit counts) and the modeled
  cost proxy per tier; note the realized saving still needs telemetry.
- [x] **Step 2:** Document the periodic tier→model audit (council staleness
  guard): when a vendor renames/retires a model in a tier, update the single
  generator-owned mapping; cite the audit cadence in ADR-035 + the projection
  contract.

**Exit criteria:** distribution recorded by tier; audit guard documented.

**Rollback:** measurement-only; nothing to revert.

## Acceptance criteria

- No vendor model name appears in any source `model_tier` value; a Claude user is
  never recommended `gpt`.
- `model_tier` enum is `lite | medium | high | inherit`; `recommended_model` is
  fully removed; schema rejects vendor names and `haiku`.
- Exactly one place maps a tier to a Claude model (the generator); non-Claude
  agents are suggestion-only with no per-vendor table.
- `context: large` is an optional orthogonal modifier carried only by
  genuinely-long-context skills.
- Every skill and command carries a `model_tier`; the coverage linter is green.
- ADR-035 supersedes ADR-034; the staleness-audit guard is documented.

## Notes

- **Supersedes ADR-034.** This is a corrective redesign of the just-merged
  concrete-model field, prompted by the cross-vendor recommendation bug.
- **Roadmap plans work, not a release.** No version/tag/commit step implied.
- **Council outline adaptation.** The council's "vendor engagement" and
  "staged-rollout telemetry" phases are folded into suggestion-only + docs and
  the conservative `suggest` default respectively — the autonomous-implementable
  forms. Real per-skill eval data + live telemetry stay deferred (ADR-034/035).
