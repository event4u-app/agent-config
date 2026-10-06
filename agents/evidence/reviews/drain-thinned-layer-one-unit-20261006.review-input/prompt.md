# R2 completion review — drain-thinned-layer-one-unit-20261006

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

- diff: `diff.patch` — the review scope (branch head 485f3512eccdb69cf39856ab3eedc41d4ae2d107, review
  artefacts excluded), scope hash `34677233165368a76549b5f19cea7ef6354eda8027449117279ca3f572e20878`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/evidence/analysis/thinned-layer-composition-2026-10.md
- agents/evidence/council/thinned-ceiling-unit-2026-10.md
- agents/roadmaps/road-to-a-thinned-layer-measured-in-one-unit.md
- agents/roadmaps/road-to-an-installed-layer-that-is-thinned.md
- dist/install/install.mjs
- dist/install/installThinLayer.js
- dist/install/installThinLayer.js.map
- src/install/installThinLayer.ts
- src/scripts/_cli/cmd_conformance.ts
- src/scripts/_lib/global_deploy_inventory.ts
- src/scripts/_lib/installed_layer.ts
- src/scripts/_lib/thin_rules.ts
- src/scripts/install.ts
- src/scripts/probe_host_compliance.ts
- tests/scripts/bench_quality_run.test.ts
- tests/scripts/install_thin_layer.test.ts
- tests/scripts/install_thin_layer_root_length.test.ts
- tests/scripts/installed_layer_ownership_fixture.test.ts
- tests/scripts/installed_layer_unconditional_chars.test.ts
- tests/scripts/probe_host_compliance.test.ts
- tests/scripts/project_thin_rules.test.ts
- tests/scripts/thin_entry_bare_pointer.test.ts
- tests/scripts/thin_marker_single_spelling.test.ts
- tests/scripts/thin_marker_unique_in_corpus.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-thinned-layer-one-unit-20261006.findings.md`:

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
**Honest-null:** 0 findings, scope 34677233165368a76549b5f19cea7ef6354eda8027449117279ca3f572e20878, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
