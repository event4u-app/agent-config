# R2 completion review — drain-14-22-0-disposition-residuals

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

- diff: `diff.patch` — the review scope (branch head 4d0f978abf152f69b461bc477df9e9be55df79de, review
  artefacts excluded), scope hash `6c4231b36ded753058c08d2cff7bac5bb32463c59f79cce2e7a7436ef08c6f2d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/release-findings/14.22.0.json
- agents/roadmaps/archive/road-to-the-14-22-0-disposition-residuals.md
- agents/roadmaps/road-to-the-14-22-0-disposition-residuals.md
- agents/roadmaps/stubs/road-to-a-census-that-refuses-a-partial-store.md
- docs/CLAIMS.md
- docs/decisions/ADR-263-skills-are-explicitly-invoked-reference-material.md
- docs/proof.md
- src/config/packed-binary-manifest.json
- src/scripts/_lib/packed_binary_predicate.ts
- src/scripts/_lib/vendored_grammar_upstream.ts
- src/vendor/grammars/README.md
- tests/scripts/vendored_grammar_upstream.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-14-22-0-disposition-residuals.findings.md`:

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
**Honest-null:** 0 findings, scope 6c4231b36ded753058c08d2cff7bac5bb32463c59f79cce2e7a7436ef08c6f2d, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
