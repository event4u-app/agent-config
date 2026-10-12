# R2 completion review — feat-svg-roadmaps-all-20261011-r2

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

- diff: `diff.patch` — the review scope (branch head 099d1445504111ccd6e243686c42723ca7061606, review
  artefacts excluded), scope hash `3a907f6e59cc4d90063b28a982c2ef84f1ddd65ba7b8a417908a3b4455a8e88c`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/svg-rules-loading-strategy-2026-10-11.md
- agents/roadmaps/archive/road-to-svg-from-a-live-session.md
- agents/roadmaps/archive/road-to-svg-in-the-authorities.md
- agents/roadmaps/archive/road-to-svg-review-followups.md
- agents/roadmaps/archive/road-to-svg-rules-in-the-dispatch-path.md
- agents/roadmaps/archive/road-to-svg-with-a-witness.md
- agents/roadmaps/road-to-svg-from-a-live-session.md
- agents/roadmaps/road-to-svg-review-followups.md
- agents/roadmaps/road-to-svg-rules-in-the-dispatch-path.md
- dist/agent-src/skills/svg-authoring/SKILL.md
- package.json
- src/cli/commands/uiRender.ts
- src/cli/commands/uiRenderAsset.ts
- src/cli/commands/uiRenderAssetCompare.ts
- src/cli/commands/uiRenderAssetGrid.ts
- src/cli/commands/uiRenderAssetGrounds.ts
- src/cli/commands/uiRenderAssetTypes.ts
- src/cli/main.ts
- src/scripts/_lib/svg_dom.ts
- src/scripts/_lib/svg_geometry.ts
- src/scripts/_lib/svg_rules.ts
- src/scripts/_lib/verification_command.ts
- src/scripts/_lib/verify_clause.ts
- src/scripts/hooks/design_pass_hook.ts
- src/scripts/hooks/svg_obligation.ts
- src/scripts/hooks/svg_rules_loader.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- src/skills/svg-authoring/SKILL.md
- tests/cli/ui_render_asset_profile.test.ts
- tests/design-artifacts/fixtures/svg-assets/README.md
- tests/design-artifacts/fixtures/svg-assets/assets/dark-mark-on-dark.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/dark-mark-on-dark.svg
- tests/design-artifacts/fixtures/svg-assets/assets/degenerate-gradient.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/degenerate-gradient.svg
- tests/design-artifacts/fixtures/svg-assets/assets/id-only-in-a-comment.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/id-only-in-a-comment.svg
- tests/design-artifacts/fixtures/svg-assets/assets/mis-nested-tags.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/mis-nested-tags.svg
- tests/design-artifacts/fixtures/svg-assets/assets/near-white-hole.source.svg
- tests/design-artifacts/fixtures/svg-assets/assets/near-white-paint.source.svg
- tests/design-artifacts/fixtures/svg-assets/assets/near-white-paint.svg
- tests/design-artifacts/fixtures/svg-assets/assets/seam-between-shapes.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/seam-between-shapes.svg
- tests/design-artifacts/fixtures/svg-assets/assets/title-not-a-direct-child.clean.svg
- tests/design-artifacts/fixtures/svg-assets/assets/title-not-a-direct-child.svg
- tests/design-artifacts/fixtures/svg-assets/conversion/source-busy-frame.png
- tests/design-artifacts/fixtures/svg-assets/conversion/source-busy-frame.svg
- tests/design-artifacts/fixtures/svg-assets/conversion/source-cut-by-frame.png
- tests/design-artifacts/fixtures/svg-assets/conversion/source-cut-by-frame.svg
- tests/design-artifacts/fixtures/svg-assets/conversion/subject-reference.svg
- tests/design-artifacts/fixtures/svg-assets/hosts/img-delivery-static.html
- tests/design-artifacts/fixtures/svg-assets/manifest.json
- tests/design-artifacts/fixtures/svg-real/authored-mark.svg
- tests/design-artifacts/fixtures/svg-real/conversion-reference-mark.svg
- tests/design-artifacts/fixtures/svg-real/dispatch-diagram.svg
- tests/design-artifacts/fixtures/svg-real/favicon-32.svg
- tests/design-artifacts/fixtures/svg-real/recraft-asset-0001.svg
- tests/design-artifacts/fixtures/svg-real/runway-illustration.svg
- tests/design-artifacts/fixtures/svg-real/settle-spinner.svg
- tests/design-artifacts/scenarios/manifest.json
- tests/design-artifacts/scenarios/s6-static-only/report.md
- tests/design-artifacts/scenarios/s6-static-only/task.md
- tests/design-artifacts/svg_scenarios.test.ts
- tests/hooks/injection_budget_dispatch.test.ts
- tests/scripts/_lib/verify_clause_escaped_slash.test.ts
- tests/scripts/design_pass_svg.test.ts
- tests/scripts/lint_svg_asset.test.ts
- tests/scripts/turn_end_gate_svg_render.test.ts
- tests/scripts/verification_command_asset_render.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-svg-roadmaps-all-20261011-r2.findings.md`:

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
**Honest-null:** 0 findings, scope 3a907f6e59cc4d90063b28a982c2ef84f1ddd65ba7b8a417908a3b4455a8e88c, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
