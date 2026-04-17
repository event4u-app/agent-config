# Skill Classification Matrix

Classification of all skills based on the [Execution Classification Standard](execution-classification-standard.md).

## Legend

- **Type:** `M` = manual, `AS` = assisted, `AU` = automated
- **Handler:** `none`, `shell`, `internal`
- **Source:** `pkg` = .augment/skills (package), `cmd` = .claude/skills (command)

## Automated skills

| Skill | Source | Handler | allowed_tools | Rationale |
|---|---|---|---|---|
| `compress` | cmd | `shell` | `[]` | Deterministic file transform, reversible, local |
| `package-test` | cmd | `shell` | `[]` | Runs test suite, no side effects, exit code = result |
| `package-reset` | cmd | `shell` | `[]` | Resets package state, reversible via git |
| `optimize-rtk-filters` | cmd | `internal` | `[]` | Generates config from toolchain analysis |
| `fix-portability` | cmd | `internal` | `[]` | Find/replace project refs, reversible |
| `fix-references` | cmd | `internal` | `[]` | Find/fix broken cross-refs, reversible |

## Assisted skills (commands)

| Skill | Source | Handler | allowed_tools | Rationale |
|---|---|---|---|---|
| `commit` | cmd | `shell` | `[]` | Creates git history — irreversible (#2, #5) |
| `create-pr` | cmd | `internal` | `[github]` | External write to GitHub |
| `create-pr-description` | cmd | `internal` | `[github]` | Reads PR context from GitHub |
| `fix-pr-comments` | cmd | `internal` | `[github]` | External write to GitHub |
| `fix-pr-bot-comments` | cmd | `internal` | `[github]` | External write to GitHub |
| `fix-pr-developer-comments` | cmd | `internal` | `[github]` | External write to GitHub |
| `fix-ci` | cmd | `internal` | `[github]` | Reads CI state, may push |
| `quality-fix` | cmd | `shell` | `[]` | PHPStan fixes need judgment (#6) |
| `tests-execute` | cmd | `shell` | `[]` | May need env setup, judgment on failures |
| `tests-create` | cmd | `internal` | `[]` | Requires content judgment (#6) |
| `jira-ticket` | cmd | `internal` | `[jira]` | Reads Jira, implements feature |
| `bug-fix` | cmd | `internal` | `[jira]` | Implements fix, needs judgment |
| `bug-investigate` | cmd | `internal` | `[jira]` | Reads Jira/Sentry, traces root cause |
| `review-changes` | cmd | `internal` | `[github]` | Self-review before PR |
| `prepare-for-review` | cmd | `shell` | `[github]` | Git operations, merge chain |
| `config-agent-settings` | cmd | `internal` | `[]` | Interactive setup prompts |
| `agents-audit` | cmd | `internal` | `[]` | Analysis + recommendations |
| `agents-cleanup` | cmd | `internal` | `[]` | Executes cleanup actions |
| `agents-prepare` | cmd | `shell` | `[]` | Scaffolds directories |
| `context-create` | cmd | `internal` | `[]` | Requires analysis judgment |
| `context-refactor` | cmd | `internal` | `[]` | Requires analysis judgment |
| `copilot-agents-optimize` | cmd | `internal` | `[]` | Dedup + restructure, needs review |
| `e2e-heal` | cmd | `internal` | `[]` | Debug + fix Playwright tests |
| `e2e-plan` | cmd | `internal` | `[]` | Explore app, create test plan |
| `feature-explore` | cmd | `internal` | `[]` | Brainstorm, interactive |
| `feature-plan` | cmd | `internal` | `[]` | Interactive planning |
| `feature-refactor` | cmd | `internal` | `[]` | Refine existing plan |
| `feature-roadmap` | cmd | `internal` | `[]` | Generate roadmap from plan |
| `module-create` | cmd | `internal` | `[]` | Interactive module setup |
| `module-explore` | cmd | `internal` | `[]` | Load module context |
| `optimize-agents` | cmd | `internal` | `[]` | Audit + suggest, never auto-apply |
| `optimize-augmentignore` | cmd | `internal` | `[]` | Analysis + recommendations |
| `optimize-skills` | cmd | `internal` | `[]` | Audit + suggest |
| `override-create` | cmd | `internal` | `[]` | Creates override files |
| `override-manage` | cmd | `internal` | `[]` | Reviews overrides |
| `project-analyze` | cmd | `internal` | `[]` | Full project analysis |
| `project-health` | cmd | `internal` | `[]` | Quick health check |
| `roadmap-create` | cmd | `internal` | `[]` | Interactive roadmap creation |
| `roadmap-execute` | cmd | `internal` | `[]` | Execute roadmap steps |
| `rule-compliance-audit` | cmd | `internal` | `[]` | Audit rules |
| `update-form-request-messages` | cmd | `internal` | `[]` | Sync messages, needs review |
| `fix-seeder` | cmd | `internal` | `[]` | Fix broken refs, needs judgment |
| `agent-handoff` | cmd | `internal` | `[]` | Generate context summary |
| `agent-status` | cmd | `internal` | `[]` | Show conversation stats |


## Assisted skills (package)

| Skill | Source | Handler | allowed_tools | Rationale |
|---|---|---|---|---|
| `command-routing` | pkg | `internal` | `[]` | Routes slash commands, interactive |
| `conventional-commits-writing` | pkg | `internal` | `[github]` | Generates commits, needs approval |
| `developer-like-execution` | pkg | `internal` | `[]` | Enforces workflow, interactive |
| `file-editor` | pkg | `shell` | `[]` | Opens files in IDE |
| `git-workflow` | pkg | `internal` | `[github]` | Git operations, may push |
| `learning-to-rule-or-skill` | pkg | `internal` | `[]` | Creates rules/skills, needs judgment |
| `override-management` | pkg | `internal` | `[]` | Creates overrides |
| `quality-tools` | pkg | `shell` | `[]` | Runs quality checks, needs judgment on fixes |
| `readme-writing` | pkg | `internal` | `[]` | Content creation, needs judgment |
| `readme-writing-package` | pkg | `internal` | `[]` | Content creation, needs judgment |
| `readme-reviewer` | pkg | `internal` | `[]` | Review + recommendations |
| `rtk-output-filtering` | pkg | `shell` | `[]` | Wraps CLI, needs config decisions |
| `skill-improvement-pipeline` | pkg | `internal` | `[]` | Multi-step improvement, needs approval |
| `skill-management` | pkg | `internal` | `[]` | Compress/decompress/refactor, needs judgment |
| `skill-reviewer` | pkg | `internal` | `[]` | Audit + recommendations |
| `skill-writing` | pkg | `internal` | `[]` | Creates skills, needs judgment |
| `upstream-contribute` | pkg | `internal` | `[github]` | Creates upstream PRs, needs consent |
| `copilot-agents-optimization` | pkg | `internal` | `[]` | Dedup + restructure |

## Manual skills (knowledge/convention — no execution block needed)

79 skills classified as manual. These provide knowledge, patterns, and conventions.
They have no deterministic execution flow and depend entirely on agent judgment.

Categories:
- **Laravel ecosystem:** `laravel`, `eloquent`, `livewire`, `flux`, `blade-ui`, `laravel-*` (12 skills)
- **PHP coding:** `php-coder`, `php-service`, `php-debugging`, `dto-creator`
- **Testing:** `pest-testing`, `api-testing`, `playwright-testing`, `test-performance`
- **Infrastructure:** `docker`, `aws-infrastructure`, `terraform`, `terragrunt`, `devcontainer`, `traefik`
- **Analysis:** `project-analysis-*` (8 skills), `bug-analyzer`, `performance-analysis`, `security-audit`
- **Design:** `api-design`, `fe-design`, `dashboard-design`, `design-review`
- **Agent infra:** `agent-docs-writing`, `project-docs`, `copilot-config`, `mcp`, `sequential-thinking`
- **Other:** `database`, `logging-monitoring`, `websocket`, `openapi`, `sql-writing`, etc.

Full list: see `ls .agent-src.uncompressed/skills/` — any skill not listed in Automated
or Assisted tables above is Manual.

## Summary

| Type | Count | Description |
|---|---|---|
| Automated | 6 | Self-running, deterministic, reversible |
| Assisted (commands) | 45 | Interactive command workflows |
| Assisted (package) | 18 | Interactive package skills |
| Manual | ~79 | Knowledge/convention skills |
| **Total** | **~148** | |