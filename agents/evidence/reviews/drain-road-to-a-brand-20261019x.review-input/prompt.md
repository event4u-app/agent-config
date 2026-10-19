# R2 completion review — drain-road-to-a-brand-20261019x

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

- diff: `diff.patch` — the review scope (branch head 31e62cfd4c71f73a099a9055059ed8bb351852fd, review
  artefacts excluded), scope hash `b52e20f07964d303cbf9055e2438ab75bc0386fe11e482ed74f1af45f11dede0`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .gitignore
- agents/evidence/analysis/voice-lexicon-claim-corpus-2026-10-19.md
- agents/roadmaps/road-to-a-brand-the-tree-can-check.md
- dist/agent-src/commands/brand/review.md
- dist/agent-src/commands/ghostwriter/write.md
- dist/agent-src/commands/post-as/me.md
- dist/agent-src/guidelines/agent-infra/rule-body-migration-inventory.md
- dist/agent-src/rules/brand-source-of-truth.md
- dist/agent-src/skills/humanizer/SKILL.md
- docs/CLAIMS.md
- docs/contracts/command-clusters.md
- docs/guidelines/agent-infra/rule-body-migration-inventory.md
- docs/proof.md
- internal/reports/exec-evidence-feasibility.json
- src/domains/brand/brand/review/command.md
- src/domains/brand/pack.yaml
- src/domains/gtm-marketing/ghostwriter/write/command.md
- src/domains/gtm-marketing/post-as/me/command.md
- src/domains/meta/pack.yaml
- src/rules/brand-source-of-truth.md
- src/scripts/_lib/claim_phrases.ts
- src/scripts/check_voice_lexicon.ts
- src/skills/humanizer/SKILL.md
- tests/fixtures/brand-voice-read-rate/prompts.json
- tests/fixtures/voice-lexicon/negative-corpus-v2.txt
- tests/scripts/brand_scenarios.test.ts
- tests/scripts/check_voice_lexicon.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-road-to-a-brand-20261019x.findings.md`:

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
**Honest-null:** 0 findings, scope b52e20f07964d303cbf9055e2438ab75bc0386fe11e482ed74f1af45f11dede0, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
