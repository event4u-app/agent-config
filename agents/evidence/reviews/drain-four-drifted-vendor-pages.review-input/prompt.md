# R2 completion review — drain-four-drifted-vendor-pages

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

- diff: `diff.patch` — the review scope (branch head d515b59bb3567339028f2ae71f10602b4b4906a5, review
  artefacts excluded), scope hash `233bf91a0ad5934aa12ba79aeb0f0dd7ecdac4c040741548b3d2a6bc1cc12c3f`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/host-docs-digest.yml
- agents/evidence/ratifications/drain-four-drifted-vendor-pages.md
- agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
- agents/roadmaps/road-to-re-establishing-four-drifted-vendor-pages.md
- agents/roadmaps/stubs/road-to-scheduled-reds-that-reach-someone.md
- dist/install/install.mjs
- src/scripts/_lib/host_listing_model.ts
- src/scripts/hooks/host_docs_pages.yaml
- src/scripts/hooks/host_lowering.json
- src/scripts/hooks/host_lowering.yaml
- tests/scripts/host_docs_digest_workflow.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-four-drifted-vendor-pages.findings.md`:

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
**Honest-null:** 0 findings, scope 233bf91a0ad5934aa12ba79aeb0f0dd7ecdac4c040741548b3d2a6bc1cc12c3f, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
