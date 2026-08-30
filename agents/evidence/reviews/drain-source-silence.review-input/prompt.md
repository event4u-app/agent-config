# R2 completion review — drain-source-silence

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

- diff: `diff.patch` — the review scope (branch head 7f3167df95e7b22dfe2a24977c44c2a421ec293b, review
  artefacts excluded), scope hash `12c96520411ce10c10b19e63510cc0115e7918d6b9ce1692c49dc8fcb074493a`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .github/workflows/pr-metadata-sources.yml
- .github/workflows/source-surface-sweep.yml
- CONTRIBUTING.md
- agents/evidence/analysis/runtime-reversal-owner-decision.md
- agents/evidence/reports/source-codename-map.md
- agents/evidence/reports/source-skip-paths-ledger.md
- agents/roadmap-assets/road-to-image-brand-typography.assets.md
- agents/roadmaps/archive/road-to-agentic-engineering-assurance.md
- agents/roadmaps/archive/road-to-ecosystem-harvest-index.md
- agents/roadmaps/archive/road-to-executable-specification-layer.md
- agents/roadmaps/archive/road-to-final-state-and-market-readiness.md
- agents/roadmaps/archive/road-to-image-brand-typography.md
- agents/roadmaps/archive/road-to-runtime-governance-flip.md
- agents/roadmaps/archive/road-to-source-silence.md
- agents/roadmaps/archive/road-to-subagent-value-realization.md
- agents/roadmaps/archive/road-to-target-project-assurance-readiness.md
- agents/roadmaps/road-to-source-silence-cutover.md
- agents/roadmaps/road-to-source-silence.md
- agents/roadmaps/road-to-supervised-telemetry-collector.md
- agents/roadmaps/stubs/road-to-legacy-target-onboarding-ratchet.md
- agents/roadmaps/stubs/road-to-public-metadata-redaction.md
- agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md
- agents/roadmaps/stubs/road-to-target-project-bootstrap-enforce.md
- agents/roadmaps/stubs/road-to-target-project-evidence-contract.md
- dist/agent-src/commands/analyze/inbox.md
- dist/agent-src/templates/roadmaps.md
- docs/CLAIMS.md
- docs/decisions/ADR-250-confidentiality-redaction-is-not-an-archive-content-change.md
- docs/decisions/INDEX.md
- docs/proof.md
- internal/reports/exec-evidence-feasibility.json
- src/agent-src/templates/roadmaps.md
- src/config/ci-local-parity.yml
- src/config/gate-violation-baselines.json
- src/domains/analysis-workbench/analyze/inbox/command.md
- src/domains/meta/pack.yaml
- src/scripts/_lib/exec_evidence.ts
- src/scripts/_lib/source_shape.ts
- src/scripts/_lib/source_snapshot_dedup.ts
- src/scripts/check_no_external_sources.ts
- src/scripts/external_sources_denylist.json
- src/scripts/hook_manifest.json
- src/scripts/hook_manifest.yaml
- src/scripts/hooks/block_speaking_inbox_dir.ts
- src/scripts/hooks/concern_registry.ts
- src/scripts/hooks/prepush_metadata_sources.sh
- src/scripts/sweep_source_surfaces.ts
- src/templates/marketing-copy.yml
- tests/hooks/block_speaking_inbox_dir.test.ts
- tests/hooks/concern_severity.test.ts
- tests/scripts/check_no_external_sources.test.ts
- tests/scripts/source_snapshot_dedup.test.ts

## Output format (contract §2.2)

Fill the findings table in `drain-source-silence.findings.md`:

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
**Honest-null:** 0 findings, scope 12c96520411ce10c10b19e63510cc0115e7918d6b9ce1692c49dc8fcb074493a, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
