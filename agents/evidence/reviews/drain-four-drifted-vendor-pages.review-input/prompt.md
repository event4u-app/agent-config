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

- diff: `diff.patch` — the review scope (branch head e69d14bf7bcf1118e5e0a06f7f81ebe7104e00a9, review
  artefacts excluded), scope hash `26e6e408ead31074a7df385c5e7ebcb5bd80831534032905914ba7970c1fd450`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/host-docs-digest.yml
- agents/evidence/ratifications/drain-four-drifted-vendor-pages.md
- agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
- agents/roadmaps/road-to-re-establishing-four-drifted-vendor-pages.md
- agents/roadmaps/stubs/road-to-scheduled-reds-that-reach-someone.md
- dist/install/install.mjs
- src/scripts/_lib/host_listing_model.ts
- src/scripts/_lib/source_shape.ts
- src/scripts/hooks/host_docs_pages.yaml
- src/scripts/hooks/host_lowering.json
- src/scripts/hooks/host_lowering.yaml
- tests/scripts/host_docs_digest_workflow.test.ts
- tests/scripts/source_shape.test.ts

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
**Honest-null:** 0 findings, scope 26e6e408ead31074a7df385c5e7ebcb5bd80831534032905914ba7970c1fd450, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
