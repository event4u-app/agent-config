# R2 completion review — advisories-fixes-worktree-cleanup

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

- diff: `diff.patch` — the review scope (branch head 499c8e358d2680230bd3f284bf26f2614d5f406e, review
  artefacts excluded), scope hash `425c1b05569c88be05ad5a271f167542d0077b355b5078492b2bae3ecc2f5de5`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- .gitignore
- .path-leak-allow
- CAPABILITIES.yaml
- README.md
- agents/evidence/analysis/worktree-estate-cleanup-2026-10-21.md
- agents/evidence/council/advisories-worktree-run-design-20261021.md
- agents/evidence/council/advisories-worktree-run-design-20261021.question.md
- agents/evidence/council/advisory-kev-epss-sources-20261021.md
- agents/evidence/council/advisory-kev-epss-sources-20261021.question.md
- agents/evidence/council/advisory-session-notice-20261021.md
- agents/evidence/council/advisory-session-notice-20261021.question.md
- agents/evidence/council/review-advisories-code-20261021.md
- agents/evidence/owner-directives/2026-10-21-advisories-and-worktree-cleanup.md
- agents/roadmaps-owned.md
- agents/roadmaps/later/road-to-advisory-latency-measured.md
- agents/roadmaps/road-to-advisories-heard-the-same-day.md
- agents/roadmaps/road-to-security-fixes-carried-to-the-merge.md
- agents/roadmaps/road-to-worktrees-that-leave-after-the-merge.md
- dist/agent-src/commands/audit.md
- dist/agent-src/commands/worktree/cleanup.md
- dist/agent-src/contexts/execution/pr-merge-queue.md
- dist/agent-src/contexts/execution/process-full-all.md
- dist/agent-src/skills/composer-packages/SKILL.md
- dist/agent-src/skills/dependency-upgrade/SKILL.md
- dist/agent-src/skills/docker/SKILL.md
- dist/agent-src/skills/finishing-a-development-branch/SKILL.md
- dist/agent-src/skills/using-git-worktrees/SKILL.md
- dist/agent-src/skills/worktree-lifecycle/SKILL.md
- dist/agent-src/templates/github-workflows/advisories-daily.yml
- docs/CLAIMS.md
- docs/architecture.md
- docs/command-flows.md
- docs/contracts/egress-placeholders-v1.md
- docs/contracts/retrieval-read-surfaces.md
- docs/contracts/settings-classes.md
- docs/decisions/ADR-295-worktree-removal-on-the-proven-set.md
- docs/decisions/ADR-296-advisory-session-notice-declared.md
- docs/decisions/INDEX.md
- docs/featured-skills.md
- docs/getting-started-by-role.md
- docs/getting-started.md
- docs/proof.md
- docs/settings-reference.md
- site/src/content/docs/agent-commands/clusters.md
- site/src/content/docs/agent-commands/key-commands.md
- site/src/content/docs/agent-commands/overview.md
- site/src/content/docs/architecture/overview.md
- site/src/content/docs/getting-started/introduction.md
- src/agent-src/contexts/execution/pr-merge-queue.md
- src/agent-src/contexts/execution/process-full-all.md
- src/agent-src/templates/github-workflows/advisories-daily.yml
- src/cli/registry.ts
- src/config/agent-settings.template.yml
- src/config/evaluator-budgets.json
- src/config/skill-body-budget.json
- src/domains/engineering-base/audit/command.md
- src/domains/engineering-base/worktree/cleanup/command.md
- src/domains/meta/README.md
- src/domains/meta/pack.yaml
- src/scripts/_dispatch.bash
- src/scripts/_lib/advisory_inventory.ts
- src/scripts/_lib/advisory_notice.ts
- src/scripts/_lib/advisory_sources.ts
- src/scripts/_lib/advisory_verdicts.ts
- src/scripts/_lib/security_fix.ts
- src/scripts/_lib/security_fix_context.ts
- src/scripts/_lib/worktree_git.ts
- src/scripts/_lib/worktree_ignored.ts
- src/scripts/advisories.ts
- src/scripts/check_update_banner.ts
- src/scripts/session_register_hook.ts
- src/scripts/worktree_cleanup_check.ts
- src/server/schemas/settings.ts
- src/skills/composer-packages/SKILL.md
- src/skills/dependency-upgrade/SKILL.md
- src/skills/docker/SKILL.md
- src/skills/finishing-a-development-branch/SKILL.md
- src/skills/using-git-worktrees/SKILL.md
- src/skills/worktree-lifecycle/SKILL.md
- tests/fixtures/advisories/F1-fastify-hono/expected.json
- tests/fixtures/advisories/F1-fastify-hono/project/package-lock.json
- tests/fixtures/advisories/F1-fastify-hono/transport.json
- tests/fixtures/advisories/F10-five-sessions/expected.json
- tests/fixtures/advisories/F10-five-sessions/project/package-lock.json
- tests/fixtures/advisories/F10-five-sessions/transport.json
- tests/fixtures/advisories/F2-php-preannouncement/expected-after-release.json
- tests/fixtures/advisories/F2-php-preannouncement/expected.json
- tests/fixtures/advisories/F2-php-preannouncement/project/Dockerfile
- tests/fixtures/advisories/F2-php-preannouncement/project/composer.json
- tests/fixtures/advisories/F2-php-preannouncement/transport-after-release.json
- tests/fixtures/advisories/F2-php-preannouncement/transport.json
- tests/fixtures/advisories/F3-composer-binary/expected.json
- tests/fixtures/advisories/F3-composer-binary/native.json
- tests/fixtures/advisories/F3-composer-binary/transport.json
- tests/fixtures/advisories/F4-malware/expected.json
- tests/fixtures/advisories/F4-malware/project/package-lock.json
- tests/fixtures/advisories/F4-malware/transport.json
- tests/fixtures/advisories/F5-php-eol-soon/expected.json
- tests/fixtures/advisories/F5-php-eol-soon/project/.php-version
- tests/fixtures/advisories/F5-php-eol-soon/transport.json
- tests/fixtures/advisories/F6-offline/expected.json
- tests/fixtures/advisories/F6-offline/native.json
- tests/fixtures/advisories/F6-offline/project/.nvmrc
- tests/fixtures/advisories/F6-offline/project/package-lock.json
- tests/fixtures/advisories/F6-offline/transport.json
- tests/fixtures/advisories/F7-private-name/expected.json
- tests/fixtures/advisories/F7-private-name/project/package-lock.json
- tests/fixtures/advisories/F7-private-name/transport.json
- tests/fixtures/advisories/F8-vendor-backport/expected.json
- tests/fixtures/advisories/F8-vendor-backport/project/.php-version
- tests/fixtures/advisories/F8-vendor-backport/transport.json
- tests/fixtures/advisories/F9-corrected-advisory/expected.json
- tests/fixtures/advisories/F9-corrected-advisory/project/package-lock.json
- tests/fixtures/advisories/F9-corrected-advisory/transport-corrected.json
- tests/fixtures/advisories/F9-corrected-advisory/transport.json
- tests/fixtures/security-fixes/G1-trunk-clean-lockfile/context.json
- tests/fixtures/security-fixes/G1-trunk-clean-lockfile/expected.json
- tests/fixtures/security-fixes/G2-feature-other-files/context.json
- tests/fixtures/security-fixes/G2-feature-other-files/expected.json
- tests/fixtures/security-fixes/G3-feature-same-lockfile/context.json
- tests/fixtures/security-fixes/G3-feature-same-lockfile/expected.json
- tests/fixtures/security-fixes/G4-branch-introduced-dependency/context.json
- tests/fixtures/security-fixes/G4-branch-introduced-dependency/expected.json
- tests/fixtures/security-fixes/G5-library-releases/context.json
- tests/fixtures/security-fixes/G5-library-releases/expected.json
- tests/fixtures/security-fixes/G6-php-runtime-pinned/context.json
- tests/fixtures/security-fixes/G6-php-runtime-pinned/expected.json
- tests/fixtures/security-fixes/G7-open-bot-pr/context.json
- tests/fixtures/security-fixes/G7-open-bot-pr/expected.json
- tests/fixtures/security-fixes/G8-no-fix-exists/context.json
- tests/fixtures/security-fixes/G8-no-fix-exists/expected.json
- tests/fixtures/security-fixes/G9-fix-fresh/context.json
- tests/fixtures/security-fixes/G9-fix-fresh/expected.json
- tests/scripts/advisories.test.ts
- tests/scripts/check_command_examples.test.ts
- tests/scripts/cli/python/workspace_inbox.test.ts
- tests/scripts/consumer_invocations.test.ts
- tests/scripts/security_fix.test.ts
- tests/scripts/worktree_cleanup_check.test.ts

## Output format (contract §2.2)

Fill the findings table in `advisories-fixes-worktree-cleanup.findings.md`:

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
**Honest-null:** 0 findings, scope 425c1b05569c88be05ad5a271f167542d0077b355b5078492b2bae3ecc2f5de5, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
