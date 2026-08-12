# R2 completion review — conformance-round7

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

- diff: `diff.patch` — the review scope (branch head c4ace013e564bd1882fb2c14f7c700649fa6903b, review
  artefacts excluded), scope hash `d2372d2fe6318b008bc63e149e3c1fbf7b2df2da33909261de0b35121833be92`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/roadmaps/archive/road-to-conformance-round7.md
- agents/roadmaps/road-to-conformance-round7-followup.md
- dist/agent-src/rules/session-canary.md
- src/config/ci-local-parity.yml
- src/rules/session-canary.md
- src/scripts/before_complete_hook.ts
- src/scripts/check_ci_local_parity.ts
- src/scripts/check_references.ts
- src/scripts/conformance_scan.ts
- src/scripts/council_cli.ts
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/block_no_verify.ts
- src/scripts/hooks/turn_end_gate_hook.ts
- src/scripts/probe_promissory_closing.ts
- src/scripts/probe_session_canary.ts
- taskfiles/ci-fast.yml
- tests/scripts/ai_council/council_cli.test.ts
- tests/scripts/check_ci_local_parity.test.ts
- tests/scripts/conformance_scan.test.ts
- tests/scripts/hooks/before_complete_hook.test.ts
- tests/scripts/hooks/block_no_verify.test.ts
- tests/scripts/turn_end_gate_hook.test.ts

## Output format (contract §2.2)

Fill the findings table in `conformance-round7.findings.md`:

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
**Honest-null:** 0 findings, scope d2372d2fe6318b008bc63e149e3c1fbf7b2df2da33909261de0b35121833be92, reviewed <YYYY-MM-DD>
```
