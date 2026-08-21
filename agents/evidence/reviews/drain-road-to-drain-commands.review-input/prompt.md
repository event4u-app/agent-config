# R2 completion review — drain-road-to-drain-commands

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

- diff: `diff.patch` — the review scope (branch head c6c99a415d4a98cfb2b729d0c343a0c21fba6349, review
  artefacts excluded), scope hash `8411daa1c534817bb7c39408da666d6f2445ef74ef5859a6f7498793c429785d`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- CAPABILITIES.yaml
- README.md
- agents/index.md
- agents/reports/originality.json
- agents/reports/originality.md
- agents/roadmaps-progress.md
- agents/roadmaps/road-to-drain-commands.md
- dist/agent-src/commands/evals/git-pr-merge.json
- dist/agent-src/commands/evals/roadmap.json
- dist/agent-src/commands/pr/merge.md
- dist/agent-src/commands/roadmap.md
- dist/agent-src/commands/roadmap/process-full.md
- docs/CLAIMS.md
- docs/architecture.md
- docs/catalog.md
- docs/command-flows.md
- docs/contracts/command-clusters.md
- docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
- docs/decisions/INDEX.md
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/getting-started.md
- docs/proof.md
- internal/reports/secret-scanner-adversarial.json
- src/agent-src/commands/evals/git-pr-merge.json
- src/agent-src/commands/evals/roadmap.json
- src/config/ci-local-parity.yml
- src/config/estate-count-budget.json
- src/domains/git/README.md
- src/domains/git/pack.yaml
- src/domains/git/pr/merge/command.md
- src/domains/product-basic/roadmap/command.md
- src/domains/product-basic/roadmap/process-full/command.md
- src/flows/surface-map.yaml
- src/scripts/check_hook_bundle_content.ts
- src/scripts/hooks/block_unauthorized_git.ts
- taskfiles/ci-fast.yml

## Output format (contract §2.2)

Fill the findings table in `drain-road-to-drain-commands.findings.md`:

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
**Honest-null:** 0 findings, scope 8411daa1c534817bb7c39408da666d6f2445ef74ef5859a6f7498793c429785d, reviewed <YYYY-MM-DD>
```
