# Abstraction-Budget Inventory

> Read-only discovery output for `agents/roadmaps/road-to-abstraction-budget-discovery.md`. Counts are grep-backed via the inventory script `scripts/inventory_abstraction_budget.py`. `bloat_candidate = Y` means usage-count threshold not met (typically zero external references) OR purpose overlap.

_Generated: 2026-05-29_


## Summary

| Class | Total | Bloat candidates |
|---|---:|---:|
| command | 135 | 2 |
| council_member | 3 | 0 |
| directive_set | 4 | 0 |
| flow | 3 | 0 |
| pack | 16 | 0 |
| persona | 29 | 0 |
| role | 6 | 5 |
| rule | 72 | 0 |
| skill | 129 | 0 |
| trust_level | 5 | 0 |


## Phase 2 gate signals

- **Abstractions with usage_count == 0:** 5
- **Frontmatter fields >95% boilerplate:** 3
- **Overlap notes surfaced:** 17

Zero-usage list:

- `role/reviewer` (last modified 2026-05-18)
- `role/tester` (last modified 2026-05-18)
- `role/po` (last modified 2026-05-18)
- `role/incident` (last modified 2026-05-18)
- `role/planner` (last modified 2026-05-18)


Frontmatter boilerplate candidates:

- `skill.execution.type` — dominant `assisted` in 100% of 26 artefacts
- `rule.validator_ignore.- type` — dominant `"substring"` in 100% of 14 artefacts
- `command.type` — dominant `orchestrator` in 100% of 21 artefacts


Overlap notes:

- skill family 'judge' has 4 members: judge-bug-hunter, judge-code-quality, judge-security-auditor, judge-test-coverage
- skill family 'project' has 4 members: project-analysis-core, project-analysis-hypothesis-driven, project-analyzer, project-docs
- skill family 'skill' has 4 members: skill-improvement-pipeline, skill-management, skill-reviewer, skill-writing
- rule family 'domain' has 4 members: domain-adoption-policy, domain-safety-disclaimer, domain-safety-pii, domain-safety-retention
- rule family 'no' has 5 members: no-attribution-footers, no-cheap-questions, no-decorative-emojis-in-git-surfaces, no-pr-progress-comments, no-roadmap-references
- command family 'agents' has 10 members: agents, agents:audit, agents:init, agents:optimize, agents:user, agents:user:accept, agents:user:init, agents:user:review, agents:user:show, agents:user:update
- command family 'chat' has 4 members: chat-history, chat-history:import, chat-history:learn, chat-history:show
- command family 'council' has 7 members: council, council:analysis, council:debate, council:default, council:design, council:optimize, council:pr
- command family 'feature' has 6 members: feature, feature:dev, feature:explore, feature:plan, feature:refactor, feature:roadmap
- command family 'fix' has 8 members: fix, fix:ci, fix:portability, fix:pr-bot-comments, fix:pr-comments, fix:pr-developer-comments, fix:refs, fix:seeder
- command family 'ghostwriter' has 6 members: ghostwriter, ghostwriter:delete, ghostwriter:fetch, ghostwriter:list, ghostwriter:show, ghostwriter:write
- command family 'judge' has 4 members: judge, judge:on-diff, judge:solo, judge:steps
- command family 'knowledge' has 4 members: knowledge, knowledge:forget, knowledge:ingest, knowledge:list
- command family 'memory' has 7 members: memory, memory:add, memory:learn-low-impact, memory:load, memory:mine-session, memory:promote, memory:propose
- command family 'optimize' has 6 members: optimize, optimize-prompt, optimize:agents-dir, optimize:augmentignore, optimize:rtk, optimize:skills
- command family 'roadmap' has 6 members: roadmap, roadmap:ai-council, roadmap:create, roadmap:process-full, roadmap:process-phase, roadmap:process-step
- command family 'video' has 5 members: video, video:from-script, video:scene, video:stitch, video:storyboard


## Full inventory

| Class | Name | Refs | Last modified | Bloat? | Notes |
|---|---|---:|---|:---:|---|
| command | `agent-handoff` | 535 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agent-handoff.md |
| command | `agent-status` | 667 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agent-status.md |
| command | `agents` | 47800 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents.md |
| command | `agents:audit` | 46 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/audit.md |
| command | `agents:init` | 46 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/init.md |
| command | `agents:optimize` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/optimize.md |
| command | `agents:user` | 468 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user.md |
| command | `agents:user:accept` | 44 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user/accept.md |
| command | `agents:user:init` | 66 | 2026-05-27 | N | packages/core/.agent-src.uncondensed/commands/agents/user/init.md |
| command | `agents:user:review` | 2 | 2026-05-26 | Y | packages/core/.agent-src.uncondensed/commands/agents/user/review.md |
| command | `agents:user:show` | 2 | 2026-05-27 | Y | packages/core/.agent-src.uncondensed/commands/agents/user/show.md |
| command | `agents:user:update` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user/update.md |
| command | `analytics` | 2328 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics.md |
| command | `analytics:prune` | 29 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics/prune.md |
| command | `analytics:show` | 61 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics/show.md |
| command | `analyze-reference-repo` | 461 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analyze-reference-repo.md |
| command | `bug-fix` | 497 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/bug-fix.md |
| command | `bug-investigate` | 465 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/bug-investigate.md |
| command | `challenge-me` | 1719 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me.md |
| command | `challenge-me:vision` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me/vision.md |
| command | `challenge-me:with-docs` | 46 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me/with-docs.md |
| command | `chat-history` | 6297 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history.md |
| command | `chat-history:import` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/import.md |
| command | `chat-history:learn` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/learn.md |
| command | `chat-history:show` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/show.md |
| command | `check-current-md` | 165 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/check-current-md.md |
| command | `commit` | 40491 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/commit.md |
| command | `commit:in-chunks` | 280 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/commit/in-chunks.md |
| command | `condense` | 41785 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/condense.md |
| command | `context` | 67509 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context.md |
| command | `context:create` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context/create.md |
| command | `context:refactor` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context/refactor.md |
| command | `cost-report` | 199 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/cost-report.md |
| command | `council` | 30329 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council.md |
| command | `council:analysis` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/analysis.md |
| command | `council:debate` | 63 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/debate.md |
| command | `council:default` | 63 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/default.md |
| command | `council:design` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/design.md |
| command | `council:optimize` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/optimize.md |
| command | `council:pr` | 60 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/pr.md |
| command | `create-pr` | 3019 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/create-pr.md |
| command | `create-pr:description-only` | 368 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/create-pr/description-only.md |
| command | `e2e-heal` | 225 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/e2e-heal.md |
| command | `e2e-plan` | 239 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/e2e-plan.md |
| command | `estimate-ticket` | 901 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/estimate-ticket.md |
| command | `feature` | 20024 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature.md |
| command | `feature:dev` | 120 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/dev.md |
| command | `feature:explore` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/explore.md |
| command | `feature:plan` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/plan.md |
| command | `feature:refactor` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/refactor.md |
| command | `feature:roadmap` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/roadmap.md |
| command | `fix` | 57856 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix.md |
| command | `fix:ci` | 53 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/ci.md |
| command | `fix:portability` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/portability.md |
| command | `fix:pr-bot-comments` | 60 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-bot-comments.md |
| command | `fix:pr-comments` | 106 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-comments.md |
| command | `fix:pr-developer-comments` | 73 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-developer-comments.md |
| command | `fix:refs` | 47 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/refs.md |
| command | `fix:seeder` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/seeder.md |
| command | `ghostwriter` | 7702 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter.md |
| command | `ghostwriter:delete` | 196 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/delete.md |
| command | `ghostwriter:fetch` | 495 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/fetch.md |
| command | `ghostwriter:list` | 290 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/list.md |
| command | `ghostwriter:show` | 291 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/show.md |
| command | `ghostwriter:write` | 944 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/write.md |
| command | `grill-me` | 335 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/grill-me.md |
| command | `implement-ticket` | 3792 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/commands/implement-ticket.md |
| command | `jira-ticket` | 716 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/jira-ticket.md |
| command | `judge` | 13253 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge.md |
| command | `judge:on-diff` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/on-diff.md |
| command | `judge:solo` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/solo.md |
| command | `judge:steps` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/steps.md |
| command | `knowledge` | 4904 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge.md |
| command | `knowledge:forget` | 45 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/forget.md |
| command | `knowledge:ingest` | 82 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/ingest.md |
| command | `knowledge:list` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/list.md |
| command | `memory` | 25909 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory.md |
| command | `memory:add` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/add.md |
| command | `memory:learn-low-impact` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/learn-low-impact.md |
| command | `memory:load` | 188 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/load.md |
| command | `memory:mine-session` | 99 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/mine-session.md |
| command | `memory:promote` | 147 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/promote.md |
| command | `memory:propose` | 87 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/propose.md |
| command | `mode` | 86243 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/mode.md |
| command | `module` | 93203 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module.md |
| command | `module:create` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module/create.md |
| command | `module:explore` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module/explore.md |
| command | `optimize` | 9824 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize.md |
| command | `optimize-prompt` | 405 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize-prompt.md |
| command | `optimize:agents-dir` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/agents-dir.md |
| command | `optimize:augmentignore` | 44 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/augmentignore.md |
| command | `optimize:rtk` | 44 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/rtk.md |
| command | `optimize:skills` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/skills.md |
| command | `orchestrate` | 896 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/orchestrate.md |
| command | `override` | 16631 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override.md |
| command | `override:create` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override/create.md |
| command | `override:manage` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override/manage.md |
| command | `package-reset` | 249 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/package-reset.md |
| command | `package-test` | 283 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/package-test.md |
| command | `post-as` | 1731 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/post-as.md |
| command | `post-as:ghostwriter` | 405 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/post-as/ghostwriter.md |
| command | `post-as:me` | 399 | 2026-05-27 | N | packages/core/.agent-src.uncondensed/commands/post-as/me.md |
| command | `prepare-for-review` | 482 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/prepare-for-review.md |
| command | `project-analyze` | 897 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/project-analyze.md |
| command | `project-health` | 174 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/project-health.md |
| command | `quality-fix` | 375 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/quality-fix.md |
| command | `refine-ticket` | 3210 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/refine-ticket.md |
| command | `research` | 4363 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research.md |
| command | `research:deep` | 253 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research/deep.md |
| command | `research:report` | 244 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research/report.md |
| command | `review-changes` | 2421 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/review-changes.md |
| command | `review-routing` | 1076 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/review-routing.md |
| command | `roadmap` | 46323 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap.md |
| command | `roadmap:ai-council` | 158 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/ai-council.md |
| command | `roadmap:create` | 284 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/create.md |
| command | `roadmap:process-full` | 395 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-full.md |
| command | `roadmap:process-phase` | 449 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-phase.md |
| command | `roadmap:process-step` | 389 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-step.md |
| command | `rule-compliance-audit` | 164 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/rule-compliance-audit.md |
| command | `set-cost-profile` | 570 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/set-cost-profile.md |
| command | `sync-agent-settings` | 224 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-agent-settings.md |
| command | `sync-gitignore` | 1021 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-gitignore.md |
| command | `sync-gitignore:fix` | 173 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-gitignore/fix.md |
| command | `tests` | 28330 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests.md |
| command | `tests:create` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests/create.md |
| command | `tests:execute` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests/execute.md |
| command | `threat-model` | 2393 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/threat-model.md |
| command | `update-form-request-messages` | 216 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/update-form-request-messages.md |
| command | `upstream-contribute` | 956 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/upstream-contribute.md |
| command | `video` | 11415 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video.md |
| command | `video:from-script` | 361 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/from-script.md |
| command | `video:scene` | 270 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/scene.md |
| command | `video:stitch` | 209 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/stitch.md |
| command | `video:storyboard` | 203 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/storyboard.md |
| command | `work` | 97932 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/work.md |
| council_member | `anthropic` | 37 | 2026-05-26 | N | ai-council provider slot |
| council_member | `gemini` | 34 | 2026-05-26 | N | ai-council provider slot |
| council_member | `openai` | 37 | 2026-05-26 | N | ai-council provider slot |
| directive_set | `backend` | 479 | 2026-05-26 | N | work_engine directive set |
| directive_set | `mixed` | 341 | 2026-05-26 | N | work_engine directive set |
| directive_set | `ui` | 1167 | 2026-05-26 | N | work_engine directive set |
| directive_set | `ui_trivial` | 9 | 2026-05-26 | N | work_engine directive set |
| flow | `implement-ticket-flow` | 429 | 2026-05-26 | N | docs/contracts/implement-ticket-flow.md |
| flow | `ui-track-flow` | 100 | 2026-05-26 | N | docs/contracts/ui-track-flow.md |
| flow | `workflow-packs` | 59 | 2026-05-26 | N | docs/contracts/workflow-packs.md |
| pack | `pack-ai-video` | 63 | 2026-05-29 | N | total=63, internal=0 |
| pack | `pack-finance-advanced` | 83 | 2026-05-29 | N | total=83, internal=0 |
| pack | `pack-finance-basic` | 118 | 2026-05-29 | N | total=118, internal=0 |
| pack | `pack-founder-strategy` | 89 | 2026-05-29 | N | total=89, internal=0 |
| pack | `pack-gtm-marketing` | 36 | 2026-05-29 | N | total=36, internal=0 |
| pack | `pack-gtm-sales` | 36 | 2026-05-29 | N | total=36, internal=0 |
| pack | `pack-laravel` | 148 | 2026-05-29 | N | total=148, internal=0 |
| pack | `pack-nextjs` | 20 | 2026-05-29 | N | total=20, internal=0 |
| pack | `pack-ops-people` | 48 | 2026-05-29 | N | total=48, internal=0 |
| pack | `pack-php` | 44 | 2026-05-29 | N | total=44, internal=0 |
| pack | `pack-product-basic` | 48 | 2026-05-29 | N | total=48, internal=0 |
| pack | `pack-product-discovery` | 20 | 2026-05-29 | N | total=20, internal=0 |
| pack | `pack-python` | 12 | 2026-05-29 | N | total=12, internal=0 |
| pack | `pack-react` | 20 | 2026-05-29 | N | total=20, internal=0 |
| pack | `pack-symfony` | 20 | 2026-05-29 | N | total=20, internal=0 |
| pack | `pack-typescript` | 8 | 2026-05-29 | N | total=8, internal=0 |
| persona | `ai-agent` | 354 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/ai-agent.md |
| persona | `ai-video-technical-director` | 255 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/ai-video-technical-director.md |
| persona | `backend-architect` | 283 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/backend-architect.md |
| persona | `cmo` | 514 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/cmo.md |
| persona | `contrarian` | 296 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/contrarian.md |
| persona | `critical-challenger` | 729 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/critical-challenger.md |
| persona | `customer-success-lead` | 128 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/customer-success-lead.md |
| persona | `developer` | 21571 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/developer.md |
| persona | `discovery-lead` | 144 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/discovery-lead.md |
| persona | `eloquent-tamer` | 123 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/eloquent-tamer.md |
| persona | `engineering-manager` | 194 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/engineering-manager.md |
| persona | `executor` | 561 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/executor.md |
| persona | `expansionist` | 64 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/expansionist.md |
| persona | `finance-partner` | 415 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/finance-partner.md |
| persona | `first-principles` | 214 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/first-principles.md |
| persona | `frontend-engineer` | 295 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/frontend-engineer.md |
| persona | `growth-pm` | 201 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/growth-pm.md |
| persona | `hollywood-director` | 309 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/hollywood-director.md |
| persona | `outsider` | 56 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/outsider.md |
| persona | `people-strategist` | 463 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/people-strategist.md |
| persona | `product-owner` | 655 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/product-owner.md |
| persona | `qa` | 4391 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/qa.md |
| persona | `revops` | 215 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/revops.md |
| persona | `revops-maintainer` | 59 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/revops-maintainer.md |
| persona | `security-engineer` | 213 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/security-engineer.md |
| persona | `senior-engineer` | 1941 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/senior-engineer.md |
| persona | `stakeholder` | 2041 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/stakeholder.md |
| persona | `strategist` | 1071 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/strategist.md |
| persona | `tech-writer` | 114 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/tech-writer.md |
| role | `developer` | 4 | 2026-05-18 | N | enum role-contracts.md |
| role | `incident` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `planner` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `po` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `reviewer` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `tester` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| rule | `agent-authority` | 447 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/agent-authority.md |
| rule | `analysis-skill-routing` | 156 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/analysis-skill-routing.md |
| rule | `architecture` | 7845 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/architecture.md |
| rule | `artifact-drafting-protocol` | 1010 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/artifact-drafting-protocol.md |
| rule | `artifact-engagement-recording` | 395 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/artifact-engagement-recording.md |
| rule | `ask-when-uncertain` | 2947 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/ask-when-uncertain.md |
| rule | `augment-edit-discipline` | 321 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/augment-edit-discipline.md |
| rule | `augment-source-of-truth` | 703 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/augment-source-of-truth.md |
| rule | `autonomous-execution` | 1630 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/autonomous-execution.md |
| rule | `cli-output-handling` | 458 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/cli-output-handling.md |
| rule | `command-suggestion-policy` | 357 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/command-suggestion-policy.md |
| rule | `commit-conventions` | 656 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/commit-conventions.md |
| rule | `commit-policy` | 2594 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/commit-policy.md |
| rule | `context-hygiene` | 566 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/context-hygiene.md |
| rule | `copilot-routing` | 127 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/copilot-routing.md |
| rule | `devcontainer-routing` | 142 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/devcontainer-routing.md |
| rule | `direct-answers` | 1604 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/direct-answers.md |
| rule | `docker-commands` | 321 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/docker-commands.md |
| rule | `domain-adoption-policy` | 192 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-adoption-policy.md |
| rule | `domain-safety-disclaimer` | 281 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-disclaimer.md |
| rule | `domain-safety-pii` | 299 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-pii.md |
| rule | `domain-safety-retention` | 156 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-retention.md |
| rule | `downstream-changes` | 278 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/downstream-changes.md |
| rule | `engineering-safety-floor` | 169 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/engineering-safety-floor.md |
| rule | `external-reference-deep-dive` | 139 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/external-reference-deep-dive.md |
| rule | `fast-path-marker-visibility` | 185 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/fast-path-marker-visibility.md |
| rule | `framework-neutrality-in-generic-skills` | 317 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/framework-neutrality-in-generic-skills.md |
| rule | `git-history-discipline` | 193 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/git-history-discipline.md |
| rule | `guidelines` | 8645 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/guidelines.md |
| rule | `improve-before-implement` | 497 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/improve-before-implement.md |
| rule | `invite-challenge` | 230 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/invite-challenge.md |
| rule | `language-and-tone` | 1561 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/rules/language-and-tone.md |
| rule | `linked-projects-onboarding-gate` | 9 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/rules/linked-projects-onboarding-gate.md |
| rule | `low-impact-corpus-privacy-floor` | 226 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/low-impact-corpus-privacy-floor.md |
| rule | `markdown-safe-codeblocks` | 241 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/markdown-safe-codeblocks.md |
| rule | `media-governance-routing` | 181 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/media-governance-routing.md |
| rule | `minimal-safe-diff` | 840 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/minimal-safe-diff.md |
| rule | `missing-tool-handling` | 123 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/missing-tool-handling.md |
| rule | `model-recommendation` | 404 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/model-recommendation.md |
| rule | `no-attribution-footers` | 425 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-attribution-footers.md |
| rule | `no-cheap-questions` | 782 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-cheap-questions.md |
| rule | `no-decorative-emojis-in-git-surfaces` | 203 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-decorative-emojis-in-git-surfaces.md |
| rule | `no-pr-progress-comments` | 100 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-pr-progress-comments.md |
| rule | `no-roadmap-references` | 442 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-roadmap-references.md |
| rule | `non-destructive-by-default` | 2528 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/non-destructive-by-default.md |
| rule | `onboarding-gate` | 433 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/onboarding-gate.md |
| rule | `package-ci-checks` | 117 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/package-ci-checks.md |
| rule | `persona-governance` | 229 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/persona-governance.md |
| rule | `preservation-guard` | 492 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/preservation-guard.md |
| rule | `provider-lifecycle-discipline` | 178 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/provider-lifecycle-discipline.md |
| rule | `reviewer-awareness` | 524 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/reviewer-awareness.md |
| rule | `roadmap-ci-steps-policy` | 410 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/roadmap-ci-steps-policy.md |
| rule | `roadmap-progress-sync` | 1247 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/rules/roadmap-progress-sync.md |
| rule | `role-mode-adherence` | 514 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/role-mode-adherence.md |
| rule | `rule-type-governance` | 602 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/rule-type-governance.md |
| rule | `runtime-safety` | 167 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/runtime-safety.md |
| rule | `scope-control` | 3987 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/scope-control.md |
| rule | `security-sensitive-stop` | 708 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/security-sensitive-stop.md |
| rule | `size-enforcement` | 555 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/size-enforcement.md |
| rule | `skill-improvement-trigger` | 154 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/skill-improvement-trigger.md |
| rule | `skill-quality` | 1382 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/skill-quality.md |
| rule | `slash-command-routing-policy` | 383 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/slash-command-routing-policy.md |
| rule | `telegraph-speak` | 543 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/telegraph-speak.md |
| rule | `think-before-action` | 608 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/think-before-action.md |
| rule | `token-efficiency` | 947 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/token-efficiency.md |
| rule | `token-optimizer-maintenance` | 151 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/token-optimizer-maintenance.md |
| rule | `tool-safety` | 197 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/tool-safety.md |
| rule | `ui-audit-gate` | 221 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/ui-audit-gate.md |
| rule | `upstream-proposal` | 124 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/upstream-proposal.md |
| rule | `user-interaction` | 2105 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/user-interaction.md |
| rule | `user-interrupt-priority` | 276 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/user-interrupt-priority.md |
| rule | `verify-before-complete` | 2850 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/verify-before-complete.md |
| skill | `accessibility-auditor` | 258 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/accessibility-auditor/SKILL.md |
| skill | `adr-create` | 974 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/adr-create/SKILL.md |
| skill | `adversarial-review` | 710 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/adversarial-review/SKILL.md |
| skill | `agent-docs-writing` | 1233 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/agent-docs-writing/SKILL.md |
| skill | `agents-md-thin-root` | 726 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/agents-md-thin-root/SKILL.md |
| skill | `ai-council` | 3723 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/ai-council/SKILL.md |
| skill | `analysis-autonomous-mode` | 289 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/analysis-autonomous-mode/SKILL.md |
| skill | `analysis-skill-router` | 251 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/analysis-skill-router/SKILL.md |
| skill | `api-design` | 814 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-design/SKILL.md |
| skill | `api-endpoint` | 857 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-endpoint/SKILL.md |
| skill | `api-testing` | 220 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-testing/SKILL.md |
| skill | `architecture-review-lens` | 315 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/architecture-review-lens/SKILL.md |
| skill | `authz-review` | 908 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/authz-review/SKILL.md |
| skill | `aws-infrastructure` | 337 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/aws-infrastructure/SKILL.md |
| skill | `blast-radius-analyzer` | 695 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/blast-radius-analyzer/SKILL.md |
| skill | `bug-analyzer` | 912 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/bug-analyzer/SKILL.md |
| skill | `check-refs` | 784 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/check-refs/SKILL.md |
| skill | `code-refactoring` | 329 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/code-refactoring/SKILL.md |
| skill | `code-review` | 1547 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/code-review/SKILL.md |
| skill | `command-routing` | 690 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/skills/command-routing/SKILL.md |
| skill | `command-writing` | 402 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/command-writing/SKILL.md |
| skill | `condense-memory` | 162 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/condense-memory/SKILL.md |
| skill | `context-authoring` | 233 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/context-authoring/SKILL.md |
| skill | `context-document` | 108 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/context-document/SKILL.md |
| skill | `conventional-commits-writing` | 508 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/conventional-commits-writing/SKILL.md |
| skill | `copilot-agents-optimization` | 320 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/copilot-agents-optimization/SKILL.md |
| skill | `copilot-config` | 614 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/copilot-config/SKILL.md |
| skill | `dashboard-design` | 289 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/dashboard-design/SKILL.md |
| skill | `data-flow-mapper` | 596 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/data-flow-mapper/SKILL.md |
| skill | `data-handling-judgment` | 471 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/data-handling-judgment/SKILL.md |
| skill | `database` | 5062 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/database/SKILL.md |
| skill | `decision-record` | 945 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/decision-record/SKILL.md |
| skill | `deep-reading-analyst` | 683 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md |
| skill | `defense-in-depth` | 431 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/defense-in-depth/SKILL.md |
| skill | `dependency-upgrade` | 171 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/dependency-upgrade/SKILL.md |
| skill | `description-assist` | 517 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/description-assist/SKILL.md |
| skill | `design-review` | 907 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/design-review/SKILL.md |
| skill | `devcontainer` | 1299 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/devcontainer/SKILL.md |
| skill | `developer-like-execution` | 306 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/developer-like-execution/SKILL.md |
| skill | `doc-coauthoring` | 268 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/doc-coauthoring/SKILL.md |
| skill | `docker` | 3249 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/docker/SKILL.md |
| skill | `error-handling-patterns` | 277 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/error-handling-patterns/SKILL.md |
| skill | `existing-ui-audit` | 1773 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/existing-ui-audit/SKILL.md |
| skill | `fe-design` | 825 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/fe-design/SKILL.md |
| skill | `file-editor` | 484 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/file-editor/SKILL.md |
| skill | `finishing-a-development-branch` | 466 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/finishing-a-development-branch/SKILL.md |
| skill | `form-handler` | 203 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/form-handler/SKILL.md |
| skill | `git-workflow` | 637 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/git-workflow/SKILL.md |
| skill | `github-ci` | 229 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/github-ci/SKILL.md |
| skill | `grafana` | 578 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/grafana/SKILL.md |
| skill | `guideline-writing` | 338 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/guideline-writing/SKILL.md |
| skill | `incident-commander` | 255 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/incident-commander/SKILL.md |
| skill | `jira-integration` | 368 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/jira-integration/SKILL.md |
| skill | `judge-bug-hunter` | 984 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-bug-hunter/SKILL.md |
| skill | `judge-code-quality` | 703 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-code-quality/SKILL.md |
| skill | `judge-security-auditor` | 1017 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-security-auditor/SKILL.md |
| skill | `judge-test-coverage` | 1052 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-test-coverage/SKILL.md |
| skill | `learning-to-rule-or-skill` | 1044 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/learning-to-rule-or-skill/SKILL.md |
| skill | `lint-skills` | 1578 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/lint-skills/SKILL.md |
| skill | `logging-monitoring` | 320 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/logging-monitoring/SKILL.md |
| skill | `markitdown` | 2330 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/markitdown/SKILL.md |
| skill | `mcp` | 11360 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mcp/SKILL.md |
| skill | `mcp-builder` | 363 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mcp-builder/SKILL.md |
| skill | `md-language-check` | 398 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/md-language-check/SKILL.md |
| skill | `memory-consolidation` | 436 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/memory-consolidation/SKILL.md |
| skill | `merge-conflicts` | 150 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/merge-conflicts/SKILL.md |
| skill | `migration-architect` | 251 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/migration-architect/SKILL.md |
| skill | `mobile-e2e-strategy` | 282 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mobile-e2e-strategy/SKILL.md |
| skill | `module-detect-on-the-fly` | 82 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/module-detect-on-the-fly/SKILL.md |
| skill | `module-management` | 361 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/module-management/SKILL.md |
| skill | `multi-tenancy` | 519 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/multi-tenancy/SKILL.md |
| skill | `openapi` | 459 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/openapi/SKILL.md |
| skill | `override-management` | 346 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/override-management/SKILL.md |
| skill | `performance` | 3653 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/performance/SKILL.md |
| skill | `performance-analysis` | 374 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/performance-analysis/SKILL.md |
| skill | `persona-writing` | 229 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/persona-writing/SKILL.md |
| skill | `playwright-architect` | 160 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/playwright-architect/SKILL.md |
| skill | `playwright-testing` | 500 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/playwright-testing/SKILL.md |
| skill | `privacy-review` | 826 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/privacy-review/SKILL.md |
| skill | `project-analysis-core` | 371 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analysis-core/SKILL.md |
| skill | `project-analysis-hypothesis-driven` | 233 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analysis-hypothesis-driven/SKILL.md |
| skill | `project-analyzer` | 425 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analyzer/SKILL.md |
| skill | `project-docs` | 275 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-docs/SKILL.md |
| skill | `prompt-engineering-patterns` | 242 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/prompt-engineering-patterns/SKILL.md |
| skill | `prompt-optimizer` | 572 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/prompt-optimizer/SKILL.md |
| skill | `quality-tools` | 1167 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/quality-tools/SKILL.md |
| skill | `readme-reviewer` | 189 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-reviewer/SKILL.md |
| skill | `readme-writing` | 555 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-writing/SKILL.md |
| skill | `readme-writing-package` | 271 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-writing-package/SKILL.md |
| skill | `receiving-code-review` | 457 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/receiving-code-review/SKILL.md |
| skill | `refine-prompt` | 1891 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/refine-prompt/SKILL.md |
| skill | `repomix-packer` | 189 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/repomix-packer/SKILL.md |
| skill | `requesting-code-review` | 330 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/requesting-code-review/SKILL.md |
| skill | `review-routing` | 1082 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/review-routing/SKILL.md |
| skill | `risk-officer` | 393 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/risk-officer/SKILL.md |
| skill | `roadmap-management` | 569 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/skills/roadmap-management/SKILL.md |
| skill | `roadmap-writing` | 359 | 2026-05-29 | N | packages/core/.agent-src.uncondensed/skills/roadmap-writing/SKILL.md |
| skill | `rtk-output-filtering` | 482 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rtk-output-filtering/SKILL.md |
| skill | `rule-refactor` | 247 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rule-refactor/SKILL.md |
| skill | `rule-writing` | 696 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rule-writing/SKILL.md |
| skill | `script-writing` | 198 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/script-writing/SKILL.md |
| skill | `secrets-management` | 294 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/secrets-management/SKILL.md |
| skill | `security` | 8355 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/security/SKILL.md |
| skill | `security-audit` | 1921 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/security-audit/SKILL.md |
| skill | `sentry-integration` | 196 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sentry-integration/SKILL.md |
| skill | `sequential-thinking` | 194 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sequential-thinking/SKILL.md |
| skill | `skill-improvement-pipeline` | 344 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-improvement-pipeline/SKILL.md |
| skill | `skill-management` | 329 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-management/SKILL.md |
| skill | `skill-reviewer` | 624 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-reviewer/SKILL.md |
| skill | `skill-writing` | 901 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-writing/SKILL.md |
| skill | `sql-writing` | 252 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sql-writing/SKILL.md |
| skill | `subagent-orchestration` | 1921 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md |
| skill | `systematic-debugging` | 850 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/systematic-debugging/SKILL.md |
| skill | `tailwind-engineer` | 348 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/tailwind-engineer/SKILL.md |
| skill | `tech-debt-tracker` | 121 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/tech-debt-tracker/SKILL.md |
| skill | `terraform` | 856 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/terraform/SKILL.md |
| skill | `terragrunt` | 542 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/terragrunt/SKILL.md |
| skill | `test-driven-development` | 830 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/test-driven-development/SKILL.md |
| skill | `test-performance` | 233 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/test-performance/SKILL.md |
| skill | `testing-anti-patterns` | 862 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/testing-anti-patterns/SKILL.md |
| skill | `threat-modeling` | 1966 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/threat-modeling/SKILL.md |
| skill | `token-optimizer` | 704 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/token-optimizer/SKILL.md |
| skill | `traefik` | 918 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/traefik/SKILL.md |
| skill | `ui-component-architect` | 257 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/ui-component-architect/SKILL.md |
| skill | `universal-project-analysis` | 579 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/universal-project-analysis/SKILL.md |
| skill | `upstream-contribute` | 957 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/upstream-contribute/SKILL.md |
| skill | `using-git-worktrees` | 342 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/using-git-worktrees/SKILL.md |
| skill | `validate-feature-fit` | 678 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/validate-feature-fit/SKILL.md |
| skill | `verify-completion-evidence` | 516 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/verify-completion-evidence/SKILL.md |
| trust_level | `advisory` | 183 | 2026-05-26 | N | trust enum value |
| trust_level | `core` | 5931 | 2026-05-26 | N | trust enum value |
| trust_level | `experimental` | 344 | 2026-05-26 | N | trust enum value |
| trust_level | `professional` | 1174 | 2026-05-26 | N | trust enum value |
| trust_level | `restricted` | 52 | 2026-05-26 | N | trust enum value |

## Frontmatter field audit

| Class | Field | Total | Distinct | Dominant value | Share | Bloat? |
|---|---|---:|---:|---|---:|:---:|
| command | `type` | 21 | 1 | `orchestrator` | 100% | Y |
| command | `council_depth` | 4 | 1 | `deep` | 100% | N |
| command | `framework` | 4 | 1 | `laravel` | 100% | N |
| command | `suggestion.eligible` | 135 | 2 | `true` | 81% | N |
| command | `tier` | 135 | 3 | `2` | 75% | N |
| command | `personas` | 4 | 3 | `[hollywood-director, ai-video-technical-director]` | 50% | N |
| command | `suggestion.rationale` | 25 | 20 | `"Package-internal — only the event4u/agent-config repo runs …` | 16% | N |
| command | `cluster` | 105 | 24 | `agents` | 10% | N |
| command | `skills` | 106 | 60 | `[file-editor]` | 9% | N |
| command | `sub` | 79 | 64 | `user` | 8% | N |
| command | `suggestion.trigger_context` | 110 | 109 | `"user has a fuzzy plan/idea/feature draft and wants it sharp…` | 2% | N |
| command | `suggestion.trigger_description` | 110 | 110 | `"check this session's token cost, see budget utilization, su…` | 1% | N |
| command | `name` | 135 | 135 | `cost-report` | 1% | N |
| command | `description` | 135 | 135 | `Capture token cost from the active Claude Code session, appe…` | 1% | N |
| persona | `source` | 6 | 1 | `package` | 100% | N |
| persona | `council_advisor` | 5 | 1 | `true` | 100% | N |
| persona | `version` | 7 | 2 | `"1.0"` | 86% | N |
| persona | `tier` | 30 | 2 | `specialist` | 83% | N |
| persona | `wing` | 8 | 2 | `3` | 50% | N |
| persona | `mode` | 30 | 5 | `reviewer` | 40% | N |
| persona | `id` | 30 | 30 | `backend-architect` | 3% | N |
| persona | `role` | 30 | 30 | `Backend Architect` | 3% | N |
| persona | `description` | 30 | 30 | `"The voice that watches service-layer boundaries — module se…` | 3% | N |
| rule | `validator_ignore.- type` | 14 | 1 | `"substring"` | 100% | Y |
| rule | `routes_to.- "command` | 1 | 1 | `set-cost-profile"` | 100% | N |
| rule | `lifecycle` | 1 | 1 | `experimental` | 100% | N |
| rule | `trust.level` | 1 | 1 | `experimental` | 100% | N |
| rule | `trust.confidence` | 1 | 1 | `medium` | 100% | N |
| rule | `install.removable` | 1 | 1 | `true` | 100% | N |
| rule | `triggers.- file_pattern` | 1 | 1 | `"*.md"` | 100% | N |
| rule | `council_depth` | 2 | 1 | `deep` | 100% | N |
| rule | `triggers.- command` | 1 | 1 | `"/roadmap:process-full"` | 100% | N |
| rule | `validator_ignore.- type.pattern` | 14 | 4 | `".agent-src.uncondensed/"` | 79% | N |
| rule | `type` | 72 | 4 | `"auto"` | 76% | N |
| rule | `alwaysApply` | 37 | 2 | `false` | 73% | N |
| rule | `tier` | 72 | 6 | `"2a"` | 38% | N |
| rule | `routes_to.- "guideline` | 4 | 4 | `agent-infra/skill-quality-checklist"` | 25% | N |
| rule | `routes_to.- "contract` | 4 | 4 | `command-suggestion-flow"` | 25% | N |
| rule | `triggers.- path_prefix` | 15 | 14 | `".agent-src.uncondensed/skills/"` | 13% | N |
| rule | `validator_ignore.- type.reason` | 14 | 14 | `"Rule documents the source-of-truth boundary; mentioning the…` | 7% | N |
| rule | `routes_to.- "skill` | 20 | 20 | `existing-ui-audit"` | 5% | N |
| rule | `triggers.- keyword` | 49 | 48 | `"composer"` | 4% | N |
| rule | `triggers.- phrase` | 25 | 25 | `"after completing"` | 4% | N |
| rule | `triggers.- intent` | 28 | 28 | `"mode marker"` | 4% | N |
| rule | `description` | 72 | 72 | `"When roles.active_role is set — closing outputs must match …` | 1% | N |
| skill | `execution.type` | 26 | 1 | `assisted` | 100% | Y |
| skill | `source` | 3 | 1 | `project` | 100% | N |
| skill | `status` | 9 | 1 | `active` | 100% | N |
| skill | `tier` | 5 | 1 | `senior` | 100% | N |
| skill | `framework` | 3 | 1 | `laravel` | 100% | N |
| skill | `council_depth` | 4 | 1 | `deep` | 100% | N |
| skill | `meta_skill` | 2 | 1 | `true` | 100% | N |
| skill | `external_source` | 1 | 1 | `"https://github.com/ginobefun/deep-reading-analyst-skill/tre…` | 100% | N |
| skill | `execution.allowed_tools` | 26 | 3 | `[]` | 88% | N |
| skill | `execution.handler` | 26 | 2 | `internal` | 69% | N |
| skill | `execution.timeout_seconds` | 4 | 3 | `30` | 50% | N |
| skill | `context_spine` | 4 | 3 | `[regulatory-regime, customer-segment, product]` | 50% | N |
| skill | `domain` | 129 | 6 | `process` | 45% | N |
| skill | `refresh_trigger` | 3 | 3 | `"≥30% of cited upstream pattern catalogues become deprecated…` | 33% | N |
| skill | `sunset_criterion` | 3 | 3 | `"When the upstream framework docs (Laravel, FastAPI, Express…` | 33% | N |
| skill | `recommended_for_user_types` | 10 | 7 | `[developer]` | 20% | N |
| skill | `name` | 129 | 129 | `copilot-config` | 1% | N |
| skill | `description` | 129 | 129 | `"Tune the GitHub Copilot AI — `copilot-instructions.md`, PR-…` | 1% | N |
