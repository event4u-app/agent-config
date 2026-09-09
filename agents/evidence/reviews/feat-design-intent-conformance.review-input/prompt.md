# R2 completion review — feat-design-intent-conformance

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

- diff: `diff.patch` — the review scope (branch head b40531ab91c3331867592cade6f774cb89dd9e20, review
  artefacts excluded), scope hash `beb47058c54503d450fd8b6656250825f7ab07d0e0783ec225201f0432390ab2`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-design-intent-conformance.md
- dist/agent-src/rules/brand-source-of-truth.md
- dist/agent-src/skills/tailwind-engineer/SKILL.md
- src/domains/brand/pack.yaml
- src/rules/brand-source-of-truth.md
- src/scripts/hooks/block_speaking_inbox_dir.ts
- src/skills/tailwind-engineer/SKILL.md
- tests/hooks/block_speaking_inbox_dir.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-design-intent-conformance.findings.md`:

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
**Honest-null:** 0 findings, scope beb47058c54503d450fd8b6656250825f7ab07d0e0783ec225201f0432390ab2, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
