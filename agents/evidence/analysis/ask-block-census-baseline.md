<!-- evidence-type: analysis -->
<!-- ask-block-census: v1 | commit: 0ea82eadd5df1df58d64ae50959d242aacb08bec | commit-date: 2026-09-07T05:05:45+02:00 -->

# Ask-block census

Emitted by `src/scripts/ask_block_census.ts`. The classification definition is
published in that script's module header, above any count — read it before reading
a number here. No figure from the source draft is carried forward.

- **Commit pin:** `0ea82eadd5df1df58d64ae50959d242aacb08bec` (2026-09-07T05:05:45+02:00)
- **Roots:** `src/domains`, `src/skills`, `src/agent-src/contexts`
- **Files scanned:** 623

## Totals

| class | regions |
|---|---|
| `single` | 174 |
| `batch` | 79 |
| `count-only` | 2 |
| `file-parked` | 4 |

## Native-ask rate

- **Native asks:** 0 of 3 unblocked asks (0.0%)
- **Source:** probe_unblocked_ask --limit 80 --store ~/.claude/projects/…-agent-config, 2026-09-07 — 202 hand-backs, 45 with a numbered block, 3 unblocked asks

A native ask is a hand-back carrying a structured-ask tool call. No host in the
capability registry has an observed structured-ask tool, so a zero here is a
MEASURED zero, not an uninstrumented one.

## Per file

| file | single | batch | count-only | file-parked |
|---|---|---|---|---|
| `src/domains/ai-video/video/from-song/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/analysis-workbench/analyze/command.md` | 1 | 1 | 0 | 0 |
| `src/domains/analysis-workbench/analyze/conformance/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/analysis-workbench/analyze/inbox/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/analysis-workbench/analyze/reference-repo/command.md` | 1 | 0 | 0 | 1 |
| `src/domains/engineering-base/bug/fix/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/engineering-base/bug/investigate/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/engineering-base/feature/dev/command.md` | 0 | 2 | 0 | 0 |
| `src/domains/engineering-base/feature/explore/command.md` | 4 | 1 | 0 | 0 |
| `src/domains/engineering-base/feature/plan/command.md` | 6 | 4 | 1 | 0 |
| `src/domains/engineering-base/feature/refactor/command.md` | 3 | 1 | 1 | 0 |
| `src/domains/engineering-base/feature/roadmap/command.md` | 3 | 0 | 0 | 0 |
| `src/domains/engineering-base/fix/pr-comments/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/engineering-base/module/create/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/engineering-base/module/explore/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/engineering-base/tests/e2e-heal/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/engineering-base/tests/execute/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/engineering-base/update-form-request-messages/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/fun/prediction-pool/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/git/commit/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/gtm-marketing/ghostwriter/fetch/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/agent-handoff/command.md` | 0 | 0 | 0 | 1 |
| `src/domains/meta/agent-status/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/agents/init/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/agents/user/accept/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/agents/user/delete/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/agents/user/init/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/challenge-me/with-docs/command.md` | 2 | 1 | 0 | 0 |
| `src/domains/meta/context/create/command.md` | 6 | 0 | 0 | 0 |
| `src/domains/meta/context/refactor/command.md` | 3 | 0 | 0 | 0 |
| `src/domains/meta/cost/report/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/council/analysis/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/council/debate/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/council/design/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/council/optimize/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/council/pr/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/memory/add/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/memory/load/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/memory/promote/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/memory/propose/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/optimize/augmentignore/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/optimize/deep/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/override/create/command.md` | 3 | 0 | 0 | 0 |
| `src/domains/meta/override/manage/command.md` | 2 | 1 | 0 | 0 |
| `src/domains/meta/package/reset/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/package/test/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/rule-compliance-audit/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/meta/team/adversarial/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/meta/upstream-contribute/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/product-basic/jira-ticket/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/product-basic/roadmap/ai-council/command.md` | 0 | 1 | 0 | 0 |
| `src/domains/product-basic/roadmap/create/command.md` | 2 | 0 | 0 | 0 |
| `src/domains/product-basic/roadmap/process-full/command.md` | 1 | 0 | 0 | 0 |
| `src/domains/product-discovery/research/command.md` | 0 | 1 | 0 | 0 |
| `src/skills/activation-design/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/adr-create/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/adversarial-review/SKILL.md` | 0 | 8 | 0 | 0 |
| `src/skills/agent-docs-writing/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/agent-security-review/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/agents-md-thin-root/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/ai-council/references/advanced-modes.md` | 1 | 0 | 0 | 0 |
| `src/skills/analysis-autonomous-mode/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/api-design/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/authz-review/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/bug-analyzer/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/canvas-design/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/code-refactoring/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/code-review/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/command-writing/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/competitive-moat-analysis/SKILL.md` | 4 | 1 | 0 | 0 |
| `src/skills/condense-memory/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/context-authoring/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/context-document/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/conventional-commits-writing/SKILL.md` | 1 | 2 | 0 | 0 |
| `src/skills/copilot-agents-optimization/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/dashboard-design/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/data-flow-mapper/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/decision-record/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/decision-record/references/weighted-matrix.md` | 1 | 0 | 0 | 0 |
| `src/skills/dependency-upgrade/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/design-review/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/developer-like-execution/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/discovery-interview/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/doc-coauthoring/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/eloquent/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/error-handling-patterns/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/estimate-ticket/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/fe-design/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/fe-design/references/design-patterns.md` | 7 | 0 | 0 | 0 |
| `src/skills/feature-planning/SKILL.md` | 2 | 1 | 0 | 0 |
| `src/skills/finishing-a-development-branch/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/frontend-render-security/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/funnel-analysis/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/git-workflow/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/guideline-writing/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/image-provider-routing/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/jira-integration/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/js-library-packaging/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/judge-bug-hunter/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/judge-security-auditor/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/laravel-migration/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/learning-to-rule-or-skill/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/legal-intake-triage/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/market-entry-analysis/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/markitdown/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/merge-conflicts/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/migration-architect/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/mobile-e2e-strategy/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/okr-tree-modeling/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/perf-feedback-craft/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/persona-writing/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/php-coder/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/pixar-storyteller/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/playwright-testing/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/po-discovery/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/privacy-review/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/project-analysis-hypothesis-driven/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/project-analyzer/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/readme-writing-package/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/readme-writing/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/refine-ticket/SKILL.md` | 2 | 1 | 0 | 0 |
| `src/skills/roadmap-management/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/roadmap-writing/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/rule-writing/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/scene-expander/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/screenshot-hygiene/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/script-writing/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/security-audit/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/sequential-thinking/SKILL.md` | 0 | 3 | 0 | 0 |
| `src/skills/skill-management/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/skill-reviewer/SKILL.md` | 4 | 2 | 0 | 0 |
| `src/skills/skill-writing/SKILL.md` | 2 | 1 | 0 | 0 |
| `src/skills/skill-writing/references/procedure.md` | 0 | 1 | 0 | 0 |
| `src/skills/subagent-orchestration/SKILL.md` | 0 | 1 | 0 | 0 |
| `src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md` | 0 | 1 | 0 | 0 |
| `src/skills/subagent-orchestration/prompts/do-competitively.md` | 0 | 1 | 0 | 0 |
| `src/skills/systematic-debugging/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/technical-specification/SKILL.md` | 0 | 0 | 0 | 2 |
| `src/skills/test-case-discovery/SKILL.md` | 2 | 0 | 0 | 0 |
| `src/skills/testing-anti-patterns/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/validate-feature-fit/SKILL.md` | 0 | 2 | 0 | 0 |
| `src/skills/video-director/SKILL.md` | 1 | 1 | 0 | 0 |
| `src/skills/vision-articulation/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/skills/voc-extract/SKILL.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/communication/rules-auto/token-efficiency-mechanics.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/communication/rules-auto/user-interaction-mechanics.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/execution/autonomy-detection.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/execution/non-interactive-contract.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/execution/roadmap-process-loop.md` | 3 | 0 | 0 | 0 |
| `src/agent-src/contexts/model-recommendations.md` | 1 | 0 | 0 | 0 |
| `src/agent-src/contexts/override-system.md` | 1 | 1 | 0 | 0 |
