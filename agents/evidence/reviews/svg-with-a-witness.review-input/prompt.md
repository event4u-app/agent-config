# R2 completion review — svg-with-a-witness

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head b9a660c504d797a997b53e84673c870e42d76de7, review
  artefacts excluded), scope hash `2a3e2409a613634342e6a2e86ce53c1b7169a236ed0c789e9df84913d67dc30e`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- CAPABILITIES.yaml
- README.md
- agents/evidence/analysis/delivery-set-measurement-2026-08-31.json
- agents/evidence/analysis/routing-body-signal-verdict.json
- agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md
- agents/index.md
- agents/reports/originality.json
- agents/reports/originality.md
- agents/roadmaps/archive/road-to-svg-in-the-authorities.md
- agents/roadmaps/archive/road-to-svg-with-a-witness.md
- agents/roadmaps/road-to-svg-in-the-authorities.md
- agents/roadmaps/road-to-svg-rules-in-the-dispatch-path.md
- agents/roadmaps/road-to-svg-with-a-witness.md
- dist/agent-src/commands/design.md
- dist/agent-src/guidelines/design-antipatterns.md
- dist/agent-src/rules/token-budget-discipline.md
- dist/agent-src/skills/accessibility-auditor/data/aria-patterns.csv
- dist/agent-src/skills/accessibility-auditor/data/manifest.json
- dist/agent-src/skills/canvas-design/SKILL.md
- dist/agent-src/skills/design-intelligence/references/integration-mapping.md
- dist/agent-src/skills/fe-design/references/design-patterns.md
- dist/agent-src/skills/frontend-render-security/SKILL.md
- dist/agent-src/skills/iconography/SKILL.md
- dist/agent-src/skills/image-provider-routing/SKILL.md
- dist/agent-src/skills/image-provider-routing/evals/triggers.json
- dist/agent-src/skills/logo-generation/SKILL.md
- dist/agent-src/skills/svg-authoring/SKILL.md
- dist/agent-src/skills/svg-authoring/evals/triggers.json
- dist/agent-src/skills/wireframe/SKILL.md
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/contracts/design-artifact-verification.md
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/governance-advantage.md
- docs/guidelines/design-antipatterns.md
- docs/proof.md
- src/cli/commands/uiRender.ts
- src/cli/commands/uiRenderAsset.ts
- src/cli/commands/uiRenderAssetCompare.ts
- src/cli/commands/uiRenderAssetTypes.ts
- src/cli/main.ts
- src/cli/registry.ts
- src/config/routing-coverage-seed.json
- src/domains/ai-video/README.md
- src/domains/ai-video/pack.yaml
- src/domains/engineering-base/README.md
- src/domains/engineering-base/design/command.md
- src/domains/engineering-base/pack.yaml
- src/domains/meta/pack.yaml
- src/packs/ai-image/README.md
- src/packs/ai-image/pack.yaml
- src/rules/token-budget-discipline.md
- src/scripts/_lib/svg_motion.ts
- src/scripts/_lib/svg_rules.ts
- src/scripts/_lib/verification_command.ts
- src/scripts/_lib/verify_clause.ts
- src/scripts/lint_design_quality.ts
- src/scripts/lint_motion_authority_drift.ts
- src/scripts/lint_svg_asset.ts
- src/scripts/report_svg_fixture_layers.ts
- src/skills/accessibility-auditor/data/aria-patterns.csv
- src/skills/accessibility-auditor/data/manifest.json
- src/skills/canvas-design/SKILL.md
- src/skills/design-intelligence/references/integration-mapping.md
- src/skills/fe-design/references/design-patterns.md
- src/skills/frontend-render-security/SKILL.md
- src/skills/iconography/SKILL.md
- src/skills/image-provider-routing/SKILL.md
- src/skills/image-provider-routing/evals/triggers.json
- src/skills/logo-generation/SKILL.md
- src/skills/svg-authoring/SKILL.md
- src/skills/svg-authoring/evals/triggers.json
- src/skills/wireframe/SKILL.md
- tests/cli/ui_render_asset_profile.test.ts
- tests/design-artifacts/fixtures/svg-assets/README.md
- tests/design-artifacts/fixtures/svg-assets/assets/active-content-script.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/active-content-script.svg
- tests/design-artifacts/fixtures/svg-assets/assets/animation-no-reduced-motion.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/animation-no-reduced-motion.svg
- tests/design-artifacts/fixtures/svg-assets/assets/d-morph-mismatch.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/d-morph-mismatch.svg
- tests/design-artifacts/fixtures/svg-assets/assets/dangling-reference.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/dangling-reference.svg
- tests/design-artifacts/fixtures/svg-assets/assets/default-serif-fallback.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/default-serif-fallback.svg
- tests/design-artifacts/fixtures/svg-assets/assets/double-name.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/double-name.svg
- tests/design-artifacts/fixtures/svg-assets/assets/element-outside-viewbox.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/element-outside-viewbox.svg
- tests/design-artifacts/fixtures/svg-assets/assets/external-reference.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/external-reference.svg
- tests/design-artifacts/fixtures/svg-assets/assets/guessed-dash.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/guessed-dash.svg
- tests/design-artifacts/fixtures/svg-assets/assets/hamburger-24-grid.svg
- tests/design-artifacts/fixtures/svg-assets/assets/icon-off-grid.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/icon-off-grid.svg
- tests/design-artifacts/fixtures/svg-assets/assets/internal-dtd-entity.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/internal-dtd-entity.svg
- tests/design-artifacts/fixtures/svg-assets/assets/keysplines-out-of-range.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/keysplines-out-of-range.svg
- tests/design-artifacts/fixtures/svg-assets/assets/loose-viewbox.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/loose-viewbox.svg
- tests/design-artifacts/fixtures/svg-assets/assets/meaningful-without-name.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/meaningful-without-name.svg
- tests/design-artifacts/fixtures/svg-assets/assets/missing-xmlns.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/missing-xmlns.svg
- tests/design-artifacts/fixtures/svg-assets/assets/near-white-hole.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/near-white-hole.svg
- tests/design-artifacts/fixtures/svg-assets/assets/primitive-only-mark.svg
- tests/design-artifacts/fixtures/svg-assets/assets/raster-in-vector.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/raster-in-vector.svg
- tests/design-artifacts/fixtures/svg-assets/assets/smil-css-only-branch.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/smil-css-only-branch.svg
- tests/design-artifacts/fixtures/svg-assets/assets/spinner-intentional-dash.svg
- tests/design-artifacts/fixtures/svg-assets/assets/text-overflows-box.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/text-overflows-box.svg
- tests/design-artifacts/fixtures/svg-assets/assets/transform-origin-no-box.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/transform-origin-no-box.svg
- tests/design-artifacts/fixtures/svg-assets/assets/unparseable-path.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/unparseable-path.svg
- tests/design-artifacts/fixtures/svg-assets/assets/unused-defs.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/unused-defs.svg
- tests/design-artifacts/fixtures/svg-assets/conversion/reference.svg
- tests/design-artifacts/fixtures/svg-assets/hosts/css-bg-delivery.html
- tests/design-artifacts/fixtures/svg-assets/hosts/img-delivery.clean.html
- tests/design-artifacts/fixtures/svg-assets/hosts/img-delivery.html
- tests/design-artifacts/fixtures/svg-assets/hosts/inline-generic-ids.clean.html
- tests/design-artifacts/fixtures/svg-assets/hosts/inline-generic-ids.html
- tests/design-artifacts/fixtures/svg-assets/hosts/pulse-animated.svg
- tests/design-artifacts/fixtures/svg-assets/hosts/pulse-static.svg
- tests/design-artifacts/fixtures/svg-assets/hosts/smil-css-only.clean.html
- tests/design-artifacts/fixtures/svg-assets/hosts/smil-css-only.html
- tests/design-artifacts/fixtures/svg-assets/hosts/smil-only.clean.html
- tests/design-artifacts/fixtures/svg-assets/hosts/smil-only.html
- tests/design-artifacts/fixtures/svg-assets/hosts/sprite-host.html
- tests/design-artifacts/fixtures/svg-assets/manifest.json
- tests/design-artifacts/fixtures/svg-assets/surgical/flat-paths/bad.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/flat-paths/before.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/flat-paths/good.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/grouped-transforms/bad.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/grouped-transforms/before.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/grouped-transforms/good.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/use-symbol/bad.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/use-symbol/before.svg
- tests/design-artifacts/fixtures/svg-assets/surgical/use-symbol/good.svg
- tests/design-artifacts/scenarios/README.md
- tests/design-artifacts/scenarios/manifest.json
- tests/design-artifacts/scenarios/s1-new-logo/delivered/mark.svg
- tests/design-artifacts/scenarios/s1-new-logo/task.md
- tests/design-artifacts/scenarios/s1b-conversion/delivered/mark.svg
- tests/design-artifacts/scenarios/s1b-conversion/report.md
- tests/design-artifacts/scenarios/s1b-conversion/task.md
- tests/design-artifacts/scenarios/s2-surgical-face/delivered/figure.svg
- tests/design-artifacts/scenarios/s2-surgical-face/input/figure.svg
- tests/design-artifacts/scenarios/s3-scale/task.md
- tests/design-artifacts/scenarios/s4-animated/delivered/host.html
- tests/design-artifacts/scenarios/s4-animated/delivered/mark-animated.svg
- tests/design-artifacts/scenarios/s4-animated/delivered/mark-static.svg
- tests/design-artifacts/scenarios/s4-animated/task.md
- tests/design-artifacts/scenarios/s5-reopen/task.md
- tests/design-artifacts/svg_assets_fixture.test.ts
- tests/design-artifacts/svg_scenarios.test.ts
- tests/fixtures/svg-active-content/README.md
- tests/fixtures/svg-active-content/clean-twin.svg
- tests/fixtures/svg-active-content/foreign-object.svg
- tests/fixtures/svg-active-content/javascript-href.svg
- tests/fixtures/svg-active-content/onload-attribute.svg
- tests/scripts/_lib/verify_clause.test.ts
- tests/scripts/check_routing_coverage.test.ts
- tests/scripts/check_skill_admissions.test.ts
- tests/scripts/design_pass_svg.test.ts
- tests/scripts/host_listing_model.test.ts
- tests/scripts/lint_design_quality_dq4_smil.test.ts
- tests/scripts/lint_svg_asset.test.ts
- tests/scripts/routing_signal_measurement.test.ts
- tests/scripts/scoped_dangle_window_guard.test.ts
- tests/scripts/skill_estate.test.ts
- tests/scripts/skill_ranker_tie_metrics.test.ts
- tests/scripts/verification_command_asset_render.test.ts
- tests/skills/frontend_render_security_svg_grep.test.ts

## Output format (contract §2.2)

Fill the findings table in `svg-with-a-witness.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope 2a3e2409a613634342e6a2e86ce53c1b7169a236ed0c789e9df84913d67dc30e, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
