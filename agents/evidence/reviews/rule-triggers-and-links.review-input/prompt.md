# R2 completion review — rule-triggers-and-links

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

- diff: `diff.patch` — the review scope (branch head e0b5320f77fa9f0586923c44ce3bec3626465d92, review
  artefacts excluded), scope hash `2aa6f1f7101138f7f44293b5cbfe080cb4745d68a9e46dafe28d61aabae622e1`
- roadmap under review: none (`acceptance-criteria.md` is empty)

Changed files:

- agents/evidence/analysis/obligation-mechanism-audit-2026-10.md
- agents/evidence/analysis/per-spawn-standing-2026-10.md
- agents/evidence/analysis/single-token-triggers-2026-10.md
- agents/roadmaps/later/road-to-mixed-trigger-activation-cost.md
- agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md
- agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md
- dist/install/claudePathsPlan.js
- dist/install/claudePathsPlan.js.map
- dist/install/install.mjs
- dist/install/installedRuleLinks.js
- dist/install/installedRuleLinks.js.map
- dist/install/wizard-plan.js
- dist/install/wizard-plan.js.map
- src/config/gate-violation-baselines.json
- src/config/rule-activation-census.json
- src/install/claudePathsPlan.ts
- src/install/installedRuleLinks.ts
- src/install/wizard-plan.ts
- src/scripts/install.ts
- src/scripts/language_mirror_hook.ts
- src/scripts/report_installed_rule_links.ts
- src/scripts/report_obligation_mechanism.ts
- src/scripts/report_single_token_triggers.ts
- src/scripts/rule_activation_census.ts
- tests/scripts/condense_glob_emit.test.ts
- tests/scripts/install_rule_links.test.ts
- tests/scripts/language_mirror_hook.test.ts

## Output format (contract §2.2)

Fill the findings table in `rule-triggers-and-links.findings.md`:

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
**Honest-null:** 0 findings, scope 2aa6f1f7101138f7f44293b5cbfe080cb4745d68a9e46dafe28d61aabae622e1, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
