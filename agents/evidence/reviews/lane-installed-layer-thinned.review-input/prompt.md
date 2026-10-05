# R2 completion review — lane-installed-layer-thinned

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

- diff: `diff.patch` — the review scope (branch head a42028bd2dd5aba69bb6a7be0ed3ae51a17a5636, review
  artefacts excluded), scope hash `a916ccd7c59ae9c64eedc49f2756ce2b1fe3a9dc3460fd1408d42e46b33e8d26`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/adr-evidence-census-2026-08.md
- agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md
- dist/install/globalRuleScope.js
- dist/install/globalRuleScope.js.map
- dist/install/install.mjs
- dist/install/installThinLayer.js
- dist/install/installThinLayer.js.map
- docs/decisions/ADR-278-the-user-global-layer-may-carry-the-thinning-opt-in.md
- docs/decisions/INDEX.md
- src/config/gate-violation-baselines.json
- src/config/host-instruction-limits.json
- src/install/globalRuleScope.ts
- src/install/installThinLayer.ts
- src/scripts/_lib/agent_settings.ts
- src/scripts/_lib/installed_layer.ts
- src/scripts/_lib/lean_projection_mode.ts
- src/scripts/_lib/thin_rules.ts
- src/scripts/install.ts
- src/scripts/project_thin_rules.ts
- src/scripts/report_standing_payload_by_host.ts
- tests/lib/agent_settings.test.ts
- tests/scripts/install_thin_layer.test.ts
- tests/scripts/installed_layer_report.test.ts
- tests/scripts/lean_projection_mode_parity.test.ts

## Output format (contract §2.2)

Fill the findings table in `lane-installed-layer-thinned.findings.md`:

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
**Honest-null:** 0 findings, scope a916ccd7c59ae9c64eedc49f2756ce2b1fe3a9dc3460fd1408d42e46b33e8d26, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
