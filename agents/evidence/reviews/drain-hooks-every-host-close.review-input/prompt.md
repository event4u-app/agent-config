# R2 completion review — drain-hooks-every-host-close

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

- diff: `diff.patch` — the review scope (branch head fc46660c1399722fa6906646b759ce87066e52d6, review
  artefacts excluded), scope hash `b77418b4f8e8b771be3076d68fb4ede2103089174e2e18c1a9271ac3a609fd46`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/host-docs-digest.yml
- agents/evidence/ratifications/drain-hooks-every-host-close.md
- agents/roadmaps/archive/road-to-hooks-on-every-host.md
- agents/roadmaps/road-to-hooks-on-every-host.md
- docs/contracts/retrieval-read-surfaces.md
- docs/enforcement-by-host.md
- src/config/ci-local-parity.yml
- src/config/gate-coverage.yml
- src/scripts/check_host_docs_digest.ts
- src/scripts/hooks/host_lowering.json
- src/scripts/hooks/host_lowering.ts
- src/scripts/hooks/host_lowering.yaml
- tests/install/global_install_hooks_smoke.test.ts
- tests/scripts/host_docs_digest.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-hooks-every-host-close.findings.md`:

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
**Honest-null:** 0 findings, scope b77418b4f8e8b771be3076d68fb4ede2103089174e2e18c1a9271ac3a609fd46, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
