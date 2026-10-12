# R2 completion review — svg-review-round-six

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

- diff: `diff.patch` — the review scope (branch head df10fdc3bc4875e9cd154ccd57d11e0cdd05d11e, review
  artefacts excluded), scope hash `c94845dfdd8b1c51ac648006a23dba1f1a0f2717cb08b8e8efc8c3e8c4f3b7f9`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- src/cli/commands/uiRender.ts
- src/cli/commands/uiRenderAsset.ts
- src/scripts/_lib/svg_rules.ts
- src/scripts/hooks/svg_obligation.ts
- tests/cli/ui_render_digest_and_thresholds.test.ts
- tests/design-artifacts/fixtures/svg-assets/README.md
- tests/design-artifacts/report_svg_fixture_layers.ts
- tests/scripts/lint_svg_asset.test.ts

## Output format (contract §2.2)

Fill the findings table in `svg-review-round-six.findings.md`:

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
**Honest-null:** 0 findings, scope c94845dfdd8b1c51ac648006a23dba1f1a0f2717cb08b8e8efc8c3e8c4f3b7f9, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
