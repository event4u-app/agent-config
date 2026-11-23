# R2 completion review — road-to-a-halt-that-holds-every-lane

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Severity

Severity binds to correctness and to the requirements the change states
(the roadmap step, its acceptance criteria):

- `critical` / `high` — wrong behaviour, a broken or missing check, a data
  or security exposure, or a stated requirement not met.
- `medium` — a defect that misleads a reader or fails under a condition the
  change itself names.
- `low` — style, naming, formatting or wording that changes no behaviour,
  including in record prose (roadmaps, evidence, decision records, comments).

A false statement in record prose — a wrong figure, path or status — is not
style: it keeps the severity of what it breaks, which is high when a gate,
a command or the next step acts on it and medium when nothing does.

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 42eff09d95c5a01f6cba120aed09239fd398a88f, review
  artefacts excluded), scope hash `74d5b6beb171180951083ee978c957110f8f85da4ac05386a26736e164187f93`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps-owned.md
- agents/roadmaps/archive/road-to-a-halt-that-holds-every-lane.md
- agents/roadmaps/road-to-a-halt-that-holds-every-lane.md
- agents/roadmaps/road-to-prose-holds-that-read-their-object.md
- dist/agent-src/contexts/execution/process-full-all.md
- src/agent-src/contexts/execution/process-full-all.md
- src/scripts/roadmap_drain_queue.ts
- tests/scripts/roadmap_drain_queue.test.ts

## Output format (contract §2.2)

Fill the findings table in `road-to-a-halt-that-holds-every-lane.findings.md`:

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
**Honest-null:** 0 findings, scope 74d5b6beb171180951083ee978c957110f8f85da4ac05386a26736e164187f93, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
