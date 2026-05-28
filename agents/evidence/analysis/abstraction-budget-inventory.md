# Abstraction-Budget Inventory

> Read-only discovery output for `agents/roadmaps/road-to-abstraction-budget-discovery.md`. Counts are grep-backed via the inventory script `scripts/inventory_abstraction_budget.py`. `bloat_candidate = Y` means usage-count threshold not met (typically zero external references) OR purpose overlap.

_Generated: 2026-05-28_


## Summary

| Class | Total | Bloat candidates |
|---|---:|---:|
| command | 135 | 2 |
| council_member | 3 | 0 |
| directive_set | 4 | 1 |
| flow | 3 | 0 |
| pack | 16 | 0 |
| persona | 29 | 0 |
| role | 6 | 5 |
| rule | 71 | 0 |
| skill | 129 | 0 |
| trust_level | 5 | 0 |


## Phase 2 gate signals

- **Abstractions with usage_count == 0:** 7
- **Frontmatter fields >95% boilerplate:** 26
- **Overlap notes surfaced:** 17

Zero-usage list:

- `role/reviewer` (last modified 2026-05-18)
- `role/tester` (last modified 2026-05-18)
- `role/po` (last modified 2026-05-18)
- `role/incident` (last modified 2026-05-18)
- `role/planner` (last modified 2026-05-18)
- `command/agents:user:show` (last modified 2026-05-27)
- `command/agents:user:review` (last modified 2026-05-26)


Frontmatter boilerplate candidates:

- `skill.source` — dominant `package` in 98% of 129 artefacts
- `skill.lifecycle` — dominant `active` in 100% of 129 artefacts
- `skill.trust.level` — dominant `core` in 100% of 129 artefacts
- `skill.trust.confidence` — dominant `high` in 100% of 129 artefacts
- `skill.trust.human_review_required` — dominant `false` in 100% of 129 artefacts
- `skill.install.default` — dominant `true` in 100% of 129 artefacts
- `skill.install.removable` — dominant `false` in 100% of 129 artefacts
- `skill.execution.type` — dominant `assisted` in 100% of 26 artefacts
- `rule.source` — dominant `package` in 100% of 71 artefacts
- `rule.lifecycle` — dominant `active` in 100% of 71 artefacts
- `rule.trust.level` — dominant `core` in 100% of 71 artefacts
- `rule.trust.confidence` — dominant `high` in 100% of 71 artefacts
- `rule.trust.human_review_required` — dominant `false` in 100% of 71 artefacts
- `rule.install.default` — dominant `true` in 100% of 71 artefacts
- `rule.install.removable` — dominant `false` in 100% of 71 artefacts
- `rule.validator_ignore.- type` — dominant `"substring"` in 100% of 13 artefacts
- `command.disable-model-invocation` — dominant `true` in 100% of 135 artefacts
- `command.lifecycle` — dominant `active` in 100% of 135 artefacts
- `command.trust.level` — dominant `core` in 100% of 135 artefacts
- `command.trust.confidence` — dominant `high` in 100% of 135 artefacts
- `command.trust.human_review_required` — dominant `false` in 100% of 135 artefacts
- `command.install.default` — dominant `true` in 100% of 135 artefacts
- `command.install.removable` — dominant `false` in 100% of 135 artefacts
- `command.type` — dominant `orchestrator` in 100% of 21 artefacts
- `persona.version` — dominant `"1.0"` in 97% of 30 artefacts
- `persona.source` — dominant `package` in 100% of 30 artefacts


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
| command | `agent-handoff` | 68 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agent-handoff.md |
| command | `agent-status` | 90 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agent-status.md |
| command | `agents` | 8318 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents.md |
| command | `agents:audit` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/audit.md |
| command | `agents:init` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/init.md |
| command | `agents:optimize` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/optimize.md |
| command | `agents:user` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user.md |
| command | `agents:user:accept` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user/accept.md |
| command | `agents:user:init` | 6 | 2026-05-27 | N | packages/core/.agent-src.uncondensed/commands/agents/user/init.md |
| command | `agents:user:review` | 0 | 2026-05-26 | Y | packages/core/.agent-src.uncondensed/commands/agents/user/review.md |
| command | `agents:user:show` | 0 | 2026-05-27 | Y | packages/core/.agent-src.uncondensed/commands/agents/user/show.md |
| command | `agents:user:update` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/agents/user/update.md |
| command | `analytics` | 551 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics.md |
| command | `analytics:prune` | 3 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics/prune.md |
| command | `analytics:show` | 11 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analytics/show.md |
| command | `analyze-reference-repo` | 64 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/analyze-reference-repo.md |
| command | `bug-fix` | 74 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/bug-fix.md |
| command | `bug-investigate` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/bug-investigate.md |
| command | `challenge-me` | 217 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me.md |
| command | `challenge-me:vision` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me/vision.md |
| command | `challenge-me:with-docs` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/challenge-me/with-docs.md |
| command | `chat-history` | 1204 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history.md |
| command | `chat-history:import` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/import.md |
| command | `chat-history:learn` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/learn.md |
| command | `chat-history:show` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/chat-history/show.md |
| command | `check-current-md` | 24 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/check-current-md.md |
| command | `commit` | 8214 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/commit.md |
| command | `commit:in-chunks` | 37 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/commit/in-chunks.md |
| command | `condense` | 12304 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/condense.md |
| command | `context` | 31883 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context.md |
| command | `context:create` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context/create.md |
| command | `context:refactor` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/context/refactor.md |
| command | `cost-report` | 38 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/cost-report.md |
| command | `council` | 5539 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council.md |
| command | `council:analysis` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/analysis.md |
| command | `council:debate` | 10 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/debate.md |
| command | `council:default` | 7 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/default.md |
| command | `council:design` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/design.md |
| command | `council:optimize` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/optimize.md |
| command | `council:pr` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/council/pr.md |
| command | `create-pr` | 467 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/create-pr.md |
| command | `create-pr:description-only` | 41 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/create-pr/description-only.md |
| command | `e2e-heal` | 33 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/e2e-heal.md |
| command | `e2e-plan` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/e2e-plan.md |
| command | `estimate-ticket` | 142 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/estimate-ticket.md |
| command | `feature` | 3928 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature.md |
| command | `feature:dev` | 9 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/dev.md |
| command | `feature:explore` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/explore.md |
| command | `feature:plan` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/plan.md |
| command | `feature:refactor` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/refactor.md |
| command | `feature:roadmap` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/feature/roadmap.md |
| command | `fix` | 25591 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix.md |
| command | `fix:ci` | 9 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/ci.md |
| command | `fix:portability` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/portability.md |
| command | `fix:pr-bot-comments` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-bot-comments.md |
| command | `fix:pr-comments` | 12 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-comments.md |
| command | `fix:pr-developer-comments` | 7 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/pr-developer-comments.md |
| command | `fix:refs` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/refs.md |
| command | `fix:seeder` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/fix/seeder.md |
| command | `ghostwriter` | 1005 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter.md |
| command | `ghostwriter:delete` | 18 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/delete.md |
| command | `ghostwriter:fetch` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/fetch.md |
| command | `ghostwriter:list` | 29 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/list.md |
| command | `ghostwriter:show` | 27 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/show.md |
| command | `ghostwriter:write` | 103 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/ghostwriter/write.md |
| command | `grill-me` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/grill-me.md |
| command | `implement-ticket` | 753 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/implement-ticket.md |
| command | `jira-ticket` | 112 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/jira-ticket.md |
| command | `judge` | 1928 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge.md |
| command | `judge:on-diff` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/on-diff.md |
| command | `judge:solo` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/solo.md |
| command | `judge:steps` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/judge/steps.md |
| command | `knowledge` | 898 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge.md |
| command | `knowledge:forget` | 7 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/forget.md |
| command | `knowledge:ingest` | 12 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/ingest.md |
| command | `knowledge:list` | 13 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/knowledge/list.md |
| command | `memory` | 5826 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory.md |
| command | `memory:add` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/add.md |
| command | `memory:learn-low-impact` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/learn-low-impact.md |
| command | `memory:load` | 31 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/load.md |
| command | `memory:mine-session` | 14 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/mine-session.md |
| command | `memory:promote` | 20 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/promote.md |
| command | `memory:propose` | 10 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/memory/propose.md |
| command | `mode` | 35081 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/mode.md |
| command | `module` | 72469 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module.md |
| command | `module:create` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module/create.md |
| command | `module:explore` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/module/explore.md |
| command | `optimize` | 3131 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize.md |
| command | `optimize-prompt` | 49 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize-prompt.md |
| command | `optimize:agents-dir` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/agents-dir.md |
| command | `optimize:augmentignore` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/augmentignore.md |
| command | `optimize:rtk` | 6 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/rtk.md |
| command | `optimize:skills` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/optimize/skills.md |
| command | `orchestrate` | 142 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/orchestrate.md |
| command | `override` | 5486 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override.md |
| command | `override:create` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override/create.md |
| command | `override:manage` | 4 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/override/manage.md |
| command | `package-reset` | 34 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/package-reset.md |
| command | `package-test` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/package-test.md |
| command | `post-as` | 243 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/post-as.md |
| command | `post-as:ghostwriter` | 45 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/post-as/ghostwriter.md |
| command | `post-as:me` | 50 | 2026-05-27 | N | packages/core/.agent-src.uncondensed/commands/post-as/me.md |
| command | `prepare-for-review` | 61 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/prepare-for-review.md |
| command | `project-analyze` | 116 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/project-analyze.md |
| command | `project-health` | 25 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/project-health.md |
| command | `quality-fix` | 68 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/quality-fix.md |
| command | `refine-ticket` | 527 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/refine-ticket.md |
| command | `research` | 603 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research.md |
| command | `research:deep` | 26 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research/deep.md |
| command | `research:report` | 28 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/research/report.md |
| command | `review-changes` | 434 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/review-changes.md |
| command | `review-routing` | 183 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/review-routing.md |
| command | `roadmap` | 7860 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap.md |
| command | `roadmap:ai-council` | 14 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/ai-council.md |
| command | `roadmap:create` | 53 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/create.md |
| command | `roadmap:process-full` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-full.md |
| command | `roadmap:process-phase` | 51 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-phase.md |
| command | `roadmap:process-step` | 47 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/roadmap/process-step.md |
| command | `rule-compliance-audit` | 25 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/rule-compliance-audit.md |
| command | `set-cost-profile` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/set-cost-profile.md |
| command | `sync-agent-settings` | 38 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-agent-settings.md |
| command | `sync-gitignore` | 108 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-gitignore.md |
| command | `sync-gitignore:fix` | 15 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/sync-gitignore/fix.md |
| command | `tests` | 6750 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests.md |
| command | `tests:create` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests/create.md |
| command | `tests:execute` | 5 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/tests/execute.md |
| command | `threat-model` | 361 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/threat-model.md |
| command | `update-form-request-messages` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/update-form-request-messages.md |
| command | `upstream-contribute` | 143 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/upstream-contribute.md |
| command | `video` | 4835 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video.md |
| command | `video:from-script` | 50 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/from-script.md |
| command | `video:scene` | 37 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/scene.md |
| command | `video:stitch` | 25 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/stitch.md |
| command | `video:storyboard` | 27 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/video/storyboard.md |
| command | `work` | 40200 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/commands/work.md |
| council_member | `anthropic` | 7 | 2026-05-26 | N | ai-council provider slot |
| council_member | `gemini` | 6 | 2026-05-26 | N | ai-council provider slot |
| council_member | `openai` | 7 | 2026-05-26 | N | ai-council provider slot |
| directive_set | `backend` | 105 | 2026-05-26 | N | work_engine directive set |
| directive_set | `mixed` | 62 | 2026-05-26 | N | work_engine directive set |
| directive_set | `ui` | 277 | 2026-05-26 | N | work_engine directive set |
| directive_set | `ui_trivial` | 1 | 2026-05-26 | Y | work_engine directive set |
| flow | `implement-ticket-flow` | 86 | 2026-05-26 | N | docs/contracts/implement-ticket-flow.md |
| flow | `ui-track-flow` | 25 | 2026-05-26 | N | docs/contracts/ui-track-flow.md |
| flow | `workflow-packs` | 11 | 2026-05-26 | N | docs/contracts/workflow-packs.md |
| pack | `pack-ai-video` | 16 | 2026-05-28 | N | total=16, internal=0 |
| pack | `pack-finance-advanced` | 11 | 2026-05-28 | N | total=11, internal=0 |
| pack | `pack-finance-basic` | 23 | 2026-05-28 | N | total=23, internal=0 |
| pack | `pack-founder-strategy` | 19 | 2026-05-28 | N | total=19, internal=0 |
| pack | `pack-gtm-marketing` | 9 | 2026-05-28 | N | total=9, internal=0 |
| pack | `pack-gtm-sales` | 9 | 2026-05-28 | N | total=9, internal=0 |
| pack | `pack-laravel` | 37 | 2026-05-28 | N | total=37, internal=0 |
| pack | `pack-nextjs` | 5 | 2026-05-28 | N | total=5, internal=0 |
| pack | `pack-ops-people` | 12 | 2026-05-28 | N | total=12, internal=0 |
| pack | `pack-php` | 11 | 2026-05-28 | N | total=11, internal=0 |
| pack | `pack-product-basic` | 12 | 2026-05-28 | N | total=12, internal=0 |
| pack | `pack-product-discovery` | 5 | 2026-05-28 | N | total=5, internal=0 |
| pack | `pack-python` | 3 | 2026-05-28 | N | total=3, internal=0 |
| pack | `pack-react` | 5 | 2026-05-28 | N | total=5, internal=0 |
| pack | `pack-symfony` | 5 | 2026-05-28 | N | total=5, internal=0 |
| pack | `pack-typescript` | 2 | 2026-05-28 | N | total=2, internal=0 |
| persona | `ai-agent` | 55 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/ai-agent.md |
| persona | `ai-video-technical-director` | 30 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/ai-video-technical-director.md |
| persona | `backend-architect` | 41 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/backend-architect.md |
| persona | `cmo` | 301 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/cmo.md |
| persona | `contrarian` | 62 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/contrarian.md |
| persona | `critical-challenger` | 88 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/critical-challenger.md |
| persona | `customer-success-lead` | 19 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/customer-success-lead.md |
| persona | `developer` | 17826 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/developer.md |
| persona | `discovery-lead` | 17 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/discovery-lead.md |
| persona | `eloquent-tamer` | 22 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/eloquent-tamer.md |
| persona | `engineering-manager` | 28 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/engineering-manager.md |
| persona | `executor` | 222 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/executor.md |
| persona | `expansionist` | 14 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/expansionist.md |
| persona | `finance-partner` | 61 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/finance-partner.md |
| persona | `first-principles` | 46 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/first-principles.md |
| persona | `frontend-engineer` | 50 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/frontend-engineer.md |
| persona | `growth-pm` | 24 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/growth-pm.md |
| persona | `hollywood-director` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/hollywood-director.md |
| persona | `outsider` | 18 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/advisors/outsider.md |
| persona | `people-strategist` | 54 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/people-strategist.md |
| persona | `product-owner` | 86 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/product-owner.md |
| persona | `qa` | 1870 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/qa.md |
| persona | `revops` | 32 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/revops.md |
| persona | `revops-maintainer` | 8 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/revops-maintainer.md |
| persona | `security-engineer` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/security-engineer.md |
| persona | `senior-engineer` | 404 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/senior-engineer.md |
| persona | `stakeholder` | 298 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/stakeholder.md |
| persona | `strategist` | 141 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/strategist.md |
| persona | `tech-writer` | 15 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/personas/tech-writer.md |
| role | `developer` | 1 | 2026-05-18 | N | enum role-contracts.md |
| role | `incident` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `planner` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `po` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `reviewer` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| role | `tester` | 0 | 2026-05-18 | Y | enum role-contracts.md |
| rule | `agent-authority` | 114 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/agent-authority.md |
| rule | `analysis-skill-routing` | 39 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/analysis-skill-routing.md |
| rule | `architecture` | 1455 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/architecture.md |
| rule | `artifact-drafting-protocol` | 175 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/artifact-drafting-protocol.md |
| rule | `artifact-engagement-recording` | 69 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/artifact-engagement-recording.md |
| rule | `ask-when-uncertain` | 508 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/ask-when-uncertain.md |
| rule | `augment-edit-discipline` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/augment-edit-discipline.md |
| rule | `augment-source-of-truth` | 112 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/augment-source-of-truth.md |
| rule | `autonomous-execution` | 322 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/autonomous-execution.md |
| rule | `cli-output-handling` | 67 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/cli-output-handling.md |
| rule | `command-suggestion-policy` | 74 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/command-suggestion-policy.md |
| rule | `commit-conventions` | 84 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/commit-conventions.md |
| rule | `commit-policy` | 480 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/commit-policy.md |
| rule | `context-hygiene` | 114 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/context-hygiene.md |
| rule | `copilot-routing` | 16 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/copilot-routing.md |
| rule | `devcontainer-routing` | 16 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/devcontainer-routing.md |
| rule | `direct-answers` | 318 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/direct-answers.md |
| rule | `docker-commands` | 48 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/docker-commands.md |
| rule | `domain-adoption-policy` | 37 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-adoption-policy.md |
| rule | `domain-safety-disclaimer` | 41 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-disclaimer.md |
| rule | `domain-safety-pii` | 38 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-pii.md |
| rule | `domain-safety-retention` | 28 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/domain-safety-retention.md |
| rule | `downstream-changes` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/downstream-changes.md |
| rule | `engineering-safety-floor` | 34 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/engineering-safety-floor.md |
| rule | `external-reference-deep-dive` | 27 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/external-reference-deep-dive.md |
| rule | `fast-path-marker-visibility` | 32 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/fast-path-marker-visibility.md |
| rule | `framework-neutrality-in-generic-skills` | 51 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/framework-neutrality-in-generic-skills.md |
| rule | `git-history-discipline` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/git-history-discipline.md |
| rule | `guidelines` | 1421 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/guidelines.md |
| rule | `improve-before-implement` | 93 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/improve-before-implement.md |
| rule | `invite-challenge` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/invite-challenge.md |
| rule | `language-and-tone` | 289 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/language-and-tone.md |
| rule | `low-impact-corpus-privacy-floor` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/low-impact-corpus-privacy-floor.md |
| rule | `markdown-safe-codeblocks` | 40 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/markdown-safe-codeblocks.md |
| rule | `media-governance-routing` | 34 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/media-governance-routing.md |
| rule | `minimal-safe-diff` | 170 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/minimal-safe-diff.md |
| rule | `missing-tool-handling` | 26 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/missing-tool-handling.md |
| rule | `model-recommendation` | 75 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/model-recommendation.md |
| rule | `no-attribution-footers` | 58 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-attribution-footers.md |
| rule | `no-cheap-questions` | 166 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-cheap-questions.md |
| rule | `no-decorative-emojis-in-git-surfaces` | 18 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-decorative-emojis-in-git-surfaces.md |
| rule | `no-pr-progress-comments` | 15 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-pr-progress-comments.md |
| rule | `no-roadmap-references` | 82 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/no-roadmap-references.md |
| rule | `non-destructive-by-default` | 484 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/non-destructive-by-default.md |
| rule | `onboarding-gate` | 105 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/onboarding-gate.md |
| rule | `package-ci-checks` | 30 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/package-ci-checks.md |
| rule | `persona-governance` | 51 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/persona-governance.md |
| rule | `preservation-guard` | 98 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/preservation-guard.md |
| rule | `provider-lifecycle-discipline` | 33 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/provider-lifecycle-discipline.md |
| rule | `reviewer-awareness` | 88 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/reviewer-awareness.md |
| rule | `roadmap-ci-steps-policy` | 75 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/roadmap-ci-steps-policy.md |
| rule | `roadmap-progress-sync` | 203 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/roadmap-progress-sync.md |
| rule | `role-mode-adherence` | 87 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/role-mode-adherence.md |
| rule | `rule-type-governance` | 94 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/rule-type-governance.md |
| rule | `runtime-safety` | 30 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/runtime-safety.md |
| rule | `scope-control` | 707 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/scope-control.md |
| rule | `security-sensitive-stop` | 117 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/security-sensitive-stop.md |
| rule | `size-enforcement` | 99 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/size-enforcement.md |
| rule | `skill-improvement-trigger` | 25 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/skill-improvement-trigger.md |
| rule | `skill-quality` | 234 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/skill-quality.md |
| rule | `slash-command-routing-policy` | 62 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/slash-command-routing-policy.md |
| rule | `telegraph-speak` | 141 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/telegraph-speak.md |
| rule | `think-before-action` | 116 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/think-before-action.md |
| rule | `token-efficiency` | 167 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/token-efficiency.md |
| rule | `token-optimizer-maintenance` | 29 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/token-optimizer-maintenance.md |
| rule | `tool-safety` | 38 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/tool-safety.md |
| rule | `ui-audit-gate` | 53 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/ui-audit-gate.md |
| rule | `upstream-proposal` | 24 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/upstream-proposal.md |
| rule | `user-interaction` | 332 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/user-interaction.md |
| rule | `user-interrupt-priority` | 64 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/user-interrupt-priority.md |
| rule | `verify-before-complete` | 509 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/rules/verify-before-complete.md |
| skill | `accessibility-auditor` | 45 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/accessibility-auditor/SKILL.md |
| skill | `adr-create` | 150 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/adr-create/SKILL.md |
| skill | `adversarial-review` | 113 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/adversarial-review/SKILL.md |
| skill | `agent-docs-writing` | 163 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/agent-docs-writing/SKILL.md |
| skill | `agents-md-thin-root` | 109 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/agents-md-thin-root/SKILL.md |
| skill | `ai-council` | 637 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/ai-council/SKILL.md |
| skill | `analysis-autonomous-mode` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/analysis-autonomous-mode/SKILL.md |
| skill | `analysis-skill-router` | 41 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/analysis-skill-router/SKILL.md |
| skill | `api-design` | 151 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-design/SKILL.md |
| skill | `api-endpoint` | 161 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-endpoint/SKILL.md |
| skill | `api-testing` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/api-testing/SKILL.md |
| skill | `architecture-review-lens` | 51 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/architecture-review-lens/SKILL.md |
| skill | `authz-review` | 129 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/authz-review/SKILL.md |
| skill | `aws-infrastructure` | 50 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/aws-infrastructure/SKILL.md |
| skill | `blast-radius-analyzer` | 113 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/blast-radius-analyzer/SKILL.md |
| skill | `bug-analyzer` | 149 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/bug-analyzer/SKILL.md |
| skill | `check-refs` | 174 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/check-refs/SKILL.md |
| skill | `code-refactoring` | 74 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/code-refactoring/SKILL.md |
| skill | `code-review` | 278 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/code-review/SKILL.md |
| skill | `command-routing` | 111 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/command-routing/SKILL.md |
| skill | `command-writing` | 72 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/command-writing/SKILL.md |
| skill | `condense-memory` | 44 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/condense-memory/SKILL.md |
| skill | `context-authoring` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/context-authoring/SKILL.md |
| skill | `context-document` | 23 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/context-document/SKILL.md |
| skill | `conventional-commits-writing` | 86 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/conventional-commits-writing/SKILL.md |
| skill | `copilot-agents-optimization` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/copilot-agents-optimization/SKILL.md |
| skill | `copilot-config` | 98 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/copilot-config/SKILL.md |
| skill | `dashboard-design` | 49 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/dashboard-design/SKILL.md |
| skill | `data-flow-mapper` | 95 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/data-flow-mapper/SKILL.md |
| skill | `data-handling-judgment` | 69 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/data-handling-judgment/SKILL.md |
| skill | `database` | 1770 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/database/SKILL.md |
| skill | `decision-record` | 145 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/decision-record/SKILL.md |
| skill | `deep-reading-analyst` | 126 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/deep-reading-analyst/SKILL.md |
| skill | `defense-in-depth` | 70 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/defense-in-depth/SKILL.md |
| skill | `dependency-upgrade` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/dependency-upgrade/SKILL.md |
| skill | `description-assist` | 88 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/description-assist/SKILL.md |
| skill | `design-review` | 195 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/design-review/SKILL.md |
| skill | `devcontainer` | 150 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/devcontainer/SKILL.md |
| skill | `developer-like-execution` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/developer-like-execution/SKILL.md |
| skill | `doc-coauthoring` | 52 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/doc-coauthoring/SKILL.md |
| skill | `docker` | 639 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/docker/SKILL.md |
| skill | `error-handling-patterns` | 49 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/error-handling-patterns/SKILL.md |
| skill | `existing-ui-audit` | 349 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/existing-ui-audit/SKILL.md |
| skill | `fe-design` | 149 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/fe-design/SKILL.md |
| skill | `file-editor` | 58 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/file-editor/SKILL.md |
| skill | `finishing-a-development-branch` | 87 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/finishing-a-development-branch/SKILL.md |
| skill | `form-handler` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/form-handler/SKILL.md |
| skill | `git-workflow` | 104 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/git-workflow/SKILL.md |
| skill | `github-ci` | 38 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/github-ci/SKILL.md |
| skill | `grafana` | 80 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/grafana/SKILL.md |
| skill | `guideline-writing` | 61 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/guideline-writing/SKILL.md |
| skill | `incident-commander` | 45 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/incident-commander/SKILL.md |
| skill | `jira-integration` | 50 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/jira-integration/SKILL.md |
| skill | `judge-bug-hunter` | 155 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-bug-hunter/SKILL.md |
| skill | `judge-code-quality` | 116 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-code-quality/SKILL.md |
| skill | `judge-security-auditor` | 159 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-security-auditor/SKILL.md |
| skill | `judge-test-coverage` | 167 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/judge-test-coverage/SKILL.md |
| skill | `learning-to-rule-or-skill` | 158 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/learning-to-rule-or-skill/SKILL.md |
| skill | `lint-skills` | 349 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/lint-skills/SKILL.md |
| skill | `logging-monitoring` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/logging-monitoring/SKILL.md |
| skill | `markitdown` | 298 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/markitdown/SKILL.md |
| skill | `mcp` | 3701 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mcp/SKILL.md |
| skill | `mcp-builder` | 58 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mcp-builder/SKILL.md |
| skill | `md-language-check` | 54 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/md-language-check/SKILL.md |
| skill | `memory-consolidation` | 61 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/memory-consolidation/SKILL.md |
| skill | `merge-conflicts` | 29 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/merge-conflicts/SKILL.md |
| skill | `migration-architect` | 56 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/migration-architect/SKILL.md |
| skill | `mobile-e2e-strategy` | 44 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/mobile-e2e-strategy/SKILL.md |
| skill | `module-detect-on-the-fly` | 14 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/module-detect-on-the-fly/SKILL.md |
| skill | `module-management` | 70 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/module-management/SKILL.md |
| skill | `multi-tenancy` | 93 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/multi-tenancy/SKILL.md |
| skill | `openapi` | 156 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/openapi/SKILL.md |
| skill | `override-management` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/override-management/SKILL.md |
| skill | `performance` | 1609 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/performance/SKILL.md |
| skill | `performance-analysis` | 58 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/performance-analysis/SKILL.md |
| skill | `persona-writing` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/persona-writing/SKILL.md |
| skill | `playwright-architect` | 32 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/playwright-architect/SKILL.md |
| skill | `playwright-testing` | 77 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/playwright-testing/SKILL.md |
| skill | `privacy-review` | 111 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/privacy-review/SKILL.md |
| skill | `project-analysis-core` | 59 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analysis-core/SKILL.md |
| skill | `project-analysis-hypothesis-driven` | 36 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analysis-hypothesis-driven/SKILL.md |
| skill | `project-analyzer` | 60 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-analyzer/SKILL.md |
| skill | `project-docs` | 51 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/project-docs/SKILL.md |
| skill | `prompt-engineering-patterns` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/prompt-engineering-patterns/SKILL.md |
| skill | `prompt-optimizer` | 95 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/prompt-optimizer/SKILL.md |
| skill | `quality-tools` | 209 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/quality-tools/SKILL.md |
| skill | `readme-reviewer` | 34 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-reviewer/SKILL.md |
| skill | `readme-writing` | 102 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-writing/SKILL.md |
| skill | `readme-writing-package` | 48 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/readme-writing-package/SKILL.md |
| skill | `receiving-code-review` | 71 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/receiving-code-review/SKILL.md |
| skill | `refine-prompt` | 359 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/refine-prompt/SKILL.md |
| skill | `repomix-packer` | 40 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/repomix-packer/SKILL.md |
| skill | `requesting-code-review` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/requesting-code-review/SKILL.md |
| skill | `review-routing` | 189 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/review-routing/SKILL.md |
| skill | `risk-officer` | 67 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/risk-officer/SKILL.md |
| skill | `roadmap-management` | 86 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/roadmap-management/SKILL.md |
| skill | `roadmap-writing` | 72 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/roadmap-writing/SKILL.md |
| skill | `rtk-output-filtering` | 75 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rtk-output-filtering/SKILL.md |
| skill | `rule-refactor` | 42 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rule-refactor/SKILL.md |
| skill | `rule-writing` | 120 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/rule-writing/SKILL.md |
| skill | `script-writing` | 37 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/script-writing/SKILL.md |
| skill | `secrets-management` | 46 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/secrets-management/SKILL.md |
| skill | `security` | 1879 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/security/SKILL.md |
| skill | `security-audit` | 299 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/security-audit/SKILL.md |
| skill | `sentry-integration` | 34 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sentry-integration/SKILL.md |
| skill | `sequential-thinking` | 35 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sequential-thinking/SKILL.md |
| skill | `skill-improvement-pipeline` | 66 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-improvement-pipeline/SKILL.md |
| skill | `skill-management` | 59 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-management/SKILL.md |
| skill | `skill-reviewer` | 114 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-reviewer/SKILL.md |
| skill | `skill-writing` | 168 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/skill-writing/SKILL.md |
| skill | `sql-writing` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/sql-writing/SKILL.md |
| skill | `subagent-orchestration` | 334 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/subagent-orchestration/SKILL.md |
| skill | `systematic-debugging` | 142 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/systematic-debugging/SKILL.md |
| skill | `tailwind-engineer` | 59 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/tailwind-engineer/SKILL.md |
| skill | `tech-debt-tracker` | 23 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/tech-debt-tracker/SKILL.md |
| skill | `terraform` | 143 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/terraform/SKILL.md |
| skill | `terragrunt` | 62 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/terragrunt/SKILL.md |
| skill | `test-driven-development` | 131 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/test-driven-development/SKILL.md |
| skill | `test-performance` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/test-performance/SKILL.md |
| skill | `testing-anti-patterns` | 143 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/testing-anti-patterns/SKILL.md |
| skill | `threat-modeling` | 293 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/threat-modeling/SKILL.md |
| skill | `token-optimizer` | 128 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/token-optimizer/SKILL.md |
| skill | `traefik` | 90 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/traefik/SKILL.md |
| skill | `ui-component-architect` | 43 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/ui-component-architect/SKILL.md |
| skill | `universal-project-analysis` | 82 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/universal-project-analysis/SKILL.md |
| skill | `upstream-contribute` | 144 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/upstream-contribute/SKILL.md |
| skill | `using-git-worktrees` | 57 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/using-git-worktrees/SKILL.md |
| skill | `validate-feature-fit` | 123 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/validate-feature-fit/SKILL.md |
| skill | `verify-completion-evidence` | 81 | 2026-05-26 | N | packages/core/.agent-src.uncondensed/skills/verify-completion-evidence/SKILL.md |
| trust_level | `advisory` | 39 | 2026-05-26 | N | trust enum value |
| trust_level | `core` | 556 | 2026-05-26 | N | trust enum value |
| trust_level | `experimental` | 59 | 2026-05-26 | N | trust enum value |
| trust_level | `professional` | 95 | 2026-05-26 | N | trust enum value |
| trust_level | `restricted` | 13 | 2026-05-26 | N | trust enum value |

## Frontmatter field audit

| Class | Field | Total | Distinct | Dominant value | Share | Bloat? |
|---|---|---:|---:|---|---:|:---:|
| command | `disable-model-invocation` | 135 | 1 | `true` | 100% | Y |
| command | `lifecycle` | 135 | 1 | `active` | 100% | Y |
| command | `trust.level` | 135 | 1 | `core` | 100% | Y |
| command | `trust.confidence` | 135 | 1 | `high` | 100% | Y |
| command | `trust.human_review_required` | 135 | 1 | `false` | 100% | Y |
| command | `install.default` | 135 | 1 | `true` | 100% | Y |
| command | `install.removable` | 135 | 1 | `false` | 100% | Y |
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
| persona | `source` | 30 | 1 | `package` | 100% | Y |
| persona | `council_advisor` | 5 | 1 | `true` | 100% | N |
| persona | `version` | 30 | 2 | `"1.0"` | 97% | Y |
| persona | `tier` | 30 | 2 | `specialist` | 83% | N |
| persona | `wing` | 8 | 2 | `3` | 50% | N |
| persona | `mode` | 30 | 5 | `reviewer` | 40% | N |
| persona | `id` | 30 | 30 | `backend-architect` | 3% | N |
| persona | `role` | 30 | 30 | `Backend Architect` | 3% | N |
| persona | `description` | 30 | 30 | `"The voice that watches service-layer boundaries — module se…` | 3% | N |
| rule | `source` | 71 | 1 | `package` | 100% | Y |
| rule | `lifecycle` | 71 | 1 | `active` | 100% | Y |
| rule | `trust.level` | 71 | 1 | `core` | 100% | Y |
| rule | `trust.confidence` | 71 | 1 | `high` | 100% | Y |
| rule | `trust.human_review_required` | 71 | 1 | `false` | 100% | Y |
| rule | `install.default` | 71 | 1 | `true` | 100% | Y |
| rule | `install.removable` | 71 | 1 | `false` | 100% | Y |
| rule | `validator_ignore.- type` | 13 | 1 | `"substring"` | 100% | Y |
| rule | `routes_to.- "command` | 1 | 1 | `set-cost-profile"` | 100% | N |
| rule | `triggers.- file_pattern` | 1 | 1 | `"*.md"` | 100% | N |
| rule | `council_depth` | 2 | 1 | `deep` | 100% | N |
| rule | `triggers.- command` | 1 | 1 | `"/roadmap:process-full"` | 100% | N |
| rule | `validator_ignore.- type.pattern` | 13 | 3 | `".agent-src.uncondensed/"` | 85% | N |
| rule | `type` | 71 | 4 | `"auto"` | 76% | N |
| rule | `alwaysApply` | 36 | 2 | `false` | 72% | N |
| rule | `tier` | 71 | 6 | `"2a"` | 38% | N |
| rule | `routes_to.- "guideline` | 4 | 4 | `agent-infra/skill-quality-checklist"` | 25% | N |
| rule | `routes_to.- "contract` | 4 | 4 | `command-suggestion-flow"` | 25% | N |
| rule | `triggers.- path_prefix` | 14 | 13 | `".agent-src.uncondensed/skills/"` | 14% | N |
| rule | `validator_ignore.- type.reason` | 13 | 13 | `"Rule documents the source-of-truth boundary; mentioning the…` | 8% | N |
| rule | `routes_to.- "skill` | 20 | 20 | `existing-ui-audit"` | 5% | N |
| rule | `triggers.- keyword` | 48 | 47 | `"composer"` | 4% | N |
| rule | `triggers.- phrase` | 25 | 25 | `"after completing"` | 4% | N |
| rule | `triggers.- intent` | 27 | 27 | `"mode marker"` | 4% | N |
| rule | `description` | 71 | 71 | `"When roles.active_role is set — closing outputs must match …` | 1% | N |
| skill | `lifecycle` | 129 | 1 | `active` | 100% | Y |
| skill | `trust.level` | 129 | 1 | `core` | 100% | Y |
| skill | `trust.confidence` | 129 | 1 | `high` | 100% | Y |
| skill | `trust.human_review_required` | 129 | 1 | `false` | 100% | Y |
| skill | `install.default` | 129 | 1 | `true` | 100% | Y |
| skill | `install.removable` | 129 | 1 | `false` | 100% | Y |
| skill | `execution.type` | 26 | 1 | `assisted` | 100% | Y |
| skill | `status` | 9 | 1 | `active` | 100% | N |
| skill | `tier` | 5 | 1 | `senior` | 100% | N |
| skill | `framework` | 3 | 1 | `laravel` | 100% | N |
| skill | `council_depth` | 4 | 1 | `deep` | 100% | N |
| skill | `meta_skill` | 2 | 1 | `true` | 100% | N |
| skill | `external_source` | 1 | 1 | `"https://github.com/ginobefun/deep-reading-analyst-skill/tre…` | 100% | N |
| skill | `source` | 129 | 2 | `package` | 98% | Y |
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

---

## Verdict (Phase 2) — **GO (scoped)**

Council (claude-sonnet-4-5 + gpt-4o, 2026-05-28, analysis lens, $0.0557 actual) converged on **GO** with a single bounded scope: factor the 26 >95% boilerplate frontmatter fields into contract-level defaults. The reduction roadmap is authored as `road-to-abstraction-reduction.md`; this discovery roadmap does **not** perform removals.

### Findings the gate validates

- **Frontmatter boilerplate (GO trigger).** 26 fields are essentially constant across 335 artefacts (skill 129, rule 71, command 135, persona 30). See `## Frontmatter field audit` table. Estimated redundant repetition ≈ 8,400 lines.

### Findings the gate rejects in writing

- **Role-enum "zero usage" is contract vocabulary.** The 5 unused values (`reviewer`, `tester`, `po`, `incident`, `planner`) are part of the multi-user role-contract schema; removing them would break consumers who select a different role. Reject the literal "usage_count == 0" reading on these rows.
- **Naming families are per-lens specialisation.** The 17 family notes (`judge-*`, `project-*`, `no-*`, command namespaces) reflect distinct review lenses or namespace organisation, not duplicate purpose. Reject the literal "≥2 overlap" reading without behavioural-overlap evidence.
- **Zero-usage commands need a discovery loop first.** `command/agents:user:show` and `command/agents:user:review` need an indirect-invocation audit before any removal call; not in scope for the authorized reduction roadmap.

### Blind spot the reduction roadmap must address first

Schema-stability pre-flight: audit `scripts/` and runtime code for `frontmatter.get("trust.level")`-style accesses that assume explicit values, and survey external consumers parsing artefact YAML, before defaulting any field.

### Re-running the discovery

`python3 scripts/inventory_abstraction_budget.py [--quiet]` regenerates this output. The script is read-only and safe to re-run when feedback round 14+ revisits the complexity claim.
