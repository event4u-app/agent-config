<!-- evidence-type: analysis -->

# Skill use over every project store — 2026-11-07

`road-to-proof-where-the-owner-sees-it` step 4.2. The 2026-10-26 census
(`skill-activation-census-all-slugs-2026-10-26.md`, "8 of 301") read one
repository's stores and counted `Skill` calls only. This one reads every store
under both projects roots the host writes (`$CLAUDE_CONFIG_DIR/projects` and
`~/.claude/projects`) and counts a `Read` of a `SKILL.md` as use of that skill too.

Command (from a worktree; the store set does not depend on where it runs):

```bash
./scripts-run src/scripts/report_skill_activation --all-stores --per-skill --limit 100000
```

Store names are other projects' paths and are withheld; the aggregate is the
finding.

```text
  stores read                            1640 (1096 with sessions, names withheld)
  sessions read                          4072

  invocations total                      81
  SKILL.md reads total                   44
  distinct skills read                   34
  distinct skills invoked                19 of 303 (6.3%)
```

**Reading.** 36 of 303 shipped skills were reached at all, 34 of them only by an
agent opening the `SKILL.md` directly. Two were called through the `Skill` tool:
the `19 of 303` line counts every name the tool was called with, and most of the
81 calls name commands, not shipped skills. What this does not
count: a skill read through a shell command (`cat`, `sed`) rather than the `Read`
tool, and use on hosts that write no transcript here. The store set includes bench
clones and scratch projects, so it is an upper bound on sessions, not on use.

A low count is a question, not a removal (Phase 4): a skill a task never needed is
not shown to be useless by this table.

## Per skill

| Skill | Skill calls | SKILL.md reads |
| `ai-code-blindspots` | 0 | 3 |
| `feature-planning` | 0 | 3 |
| `subagent-orchestration` | 0 | 3 |
| `agent-security-review` | 0 | 2 |
| `launch-readiness` | 0 | 2 |
| `security-audit` | 0 | 2 |
| `svg-authoring` | 0 | 2 |
| `canvas-design` | 0 | 1 |
| `deep-reading-analyst` | 0 | 1 |
| `design-intelligence` | 0 | 1 |
| `design-review` | 0 | 1 |
| `design-system-capture` | 0 | 1 |
| `docx-authoring` | 0 | 1 |
| `evaluate-llm-feature` | 0 | 1 |
| `fe-design` | 0 | 1 |
| `founder-idea-interview` | 0 | 1 |
| `funnel-analysis` | 0 | 1 |
| `html-deck` | 0 | 1 |
| `humanizer` | 0 | 1 |
| `image-provider-routing` | 1 | 0 |
| `lint-skills` | 0 | 1 |
| `llm-provider-knowledge` | 0 | 1 |
| `logo-generation` | 0 | 1 |
| `pdf-tools` | 0 | 1 |
| `po-discovery` | 0 | 1 |
| `prompt-optimizer` | 0 | 1 |
| `recursive-verification` | 0 | 1 |
| `roadmap-writing` | 0 | 1 |
| `skill-improvement-pipeline` | 0 | 1 |
| `skill-reviewer` | 0 | 1 |
| `skill-writing` | 0 | 1 |
| `song-to-script` | 0 | 1 |
| `tech-debt-tracker` | 0 | 1 |
| `technical-specification` | 0 | 1 |
| `threat-modeling` | 0 | 1 |
| `using-git-worktrees` | 1 | 0 |
| `accessibility-auditor` | 0 | 0 |
| `activation-design` | 0 | 0 |
| `adr-create` | 0 | 0 |
| `adversarial-review` | 0 | 0 |
| `agent-docs-writing` | 0 | 0 |
| `agents-md-thin-root` | 0 | 0 |
| `ai-council` | 0 | 0 |
| `alerting-doctrine` | 0 | 0 |
| `analysis-autonomous-mode` | 0 | 0 |
| `analysis-skill-router` | 0 | 0 |
| `api-design` | 0 | 0 |
| `api-endpoint` | 0 | 0 |
| `api-testing` | 0 | 0 |
| `architecture-review-lens` | 0 | 0 |
| `artisan-commands` | 0 | 0 |
| `async-python-patterns` | 0 | 0 |
| `authz-review` | 0 | 0 |
| `aws-infrastructure` | 0 | 0 |
| `blade-ui` | 0 | 0 |
| `blameless-post-mortem` | 0 | 0 |
| `blast-radius-analyzer` | 0 | 0 |
| `brand` | 0 | 0 |
| `brand-asset-generation` | 0 | 0 |
| `brand-audit` | 0 | 0 |
| `brand-identity` | 0 | 0 |
| `brand-strategy` | 0 | 0 |
| `brand-to-tokens` | 0 | 0 |
| `bug-analyzer` | 0 | 0 |
| `build-buy-partner` | 0 | 0 |
| `character-consistency` | 0 | 0 |
| `check-refs` | 0 | 0 |
| `churn-prevention` | 0 | 0 |
| `code-film` | 0 | 0 |
| `code-intelligence` | 0 | 0 |
| `code-refactoring` | 0 | 0 |
| `code-review-lens` | 0 | 0 |
| `command-routing` | 0 | 0 |
| `command-writing` | 0 | 0 |
| `comp-banding` | 0 | 0 |
| `competitive-moat-analysis` | 0 | 0 |
| `competitive-positioning` | 0 | 0 |
| `complexity-first-planning` | 0 | 0 |
| `composer-packages` | 0 | 0 |
| `condense-memory` | 0 | 0 |
| `content-funnel-design` | 0 | 0 |
| `context-authoring` | 0 | 0 |
| `context-document` | 0 | 0 |
| `contract-review` | 0 | 0 |
| `contracts-cognition` | 0 | 0 |
| `conventional-commits-writing` | 0 | 0 |
| `copilot-agents-optimization` | 0 | 0 |
| `copilot-config` | 0 | 0 |
| `corpus-grounding` | 0 | 0 |
| `customer-research` | 0 | 0 |
| `dashboard-design` | 0 | 0 |
| `data-flow-mapper` | 0 | 0 |
| `data-handling-judgment` | 0 | 0 |
| `database` | 0 | 0 |
| `dcf-modeling` | 0 | 0 |
| `deal-qualification-meddic` | 0 | 0 |
| `decision-record` | 0 | 0 |
| `decision-review` | 0 | 0 |
| `defense-in-depth` | 0 | 0 |
| `dependency-upgrade` | 0 | 0 |
| `description-assist` | 0 | 0 |
| `design-tokens` | 0 | 0 |
| `design-variations` | 0 | 0 |
| `devcontainer` | 0 | 0 |
| `developer-like-execution` | 0 | 0 |
| `discovery-interview` | 0 | 0 |
| `doc-coauthoring` | 0 | 0 |
| `docker` | 0 | 0 |
| `dpa-review` | 0 | 0 |
| `editorial-calendar` | 0 | 0 |
| `eloquent` | 0 | 0 |
| `emit-tickets` | 0 | 0 |
| `error-handling-patterns` | 0 | 0 |
| `estimate-ticket` | 0 | 0 |
| `existing-ui-audit` | 0 | 0 |
| `expansion-playbook` | 0 | 0 |
| `experiment-loop` | 0 | 0 |
| `file-editor` | 0 | 0 |
| `finishing-a-development-branch` | 0 | 0 |
| `flux` | 0 | 0 |
| `forecast-accuracy` | 0 | 0 |
| `forecasting` | 0 | 0 |
| `forensics-report` | 0 | 0 |
| `form-handler` | 0 | 0 |
| `frontend-render-security` | 0 | 0 |
| `fundraising-narrative` | 0 | 0 |
| `gated-reach` | 0 | 0 |
| `git-workflow` | 0 | 0 |
| `github-ci` | 0 | 0 |
| `grafana` | 0 | 0 |
| `gtm-launch` | 0 | 0 |
| `guideline-writing` | 0 | 0 |
| `hiring-loop-design` | 0 | 0 |
| `history-design` | 0 | 0 |
| `iconography` | 0 | 0 |
| `image-analyser` | 0 | 0 |
| `image-creator` | 0 | 0 |
| `image-editing` | 0 | 0 |
| `image-generation` | 0 | 0 |
| `incident-commander` | 0 | 0 |
| `jira-integration` | 0 | 0 |
| `jobs-events` | 0 | 0 |
| `js-library-packaging` | 0 | 0 |
| `judge-artifact-completeness` | 0 | 0 |
| `judge-bug-hunter` | 0 | 0 |
| `judge-code-quality` | 0 | 0 |
| `judge-injection-defense` | 0 | 0 |
| `judge-security-auditor` | 0 | 0 |
| `judge-spec-compliance` | 0 | 0 |
| `judge-synthesis` | 0 | 0 |
| `judge-test-coverage` | 0 | 0 |
| `laravel` | 0 | 0 |
| `laravel-api-endpoint` | 0 | 0 |
| `laravel-dto` | 0 | 0 |
| `laravel-horizon` | 0 | 0 |
| `laravel-mail` | 0 | 0 |
| `laravel-middleware` | 0 | 0 |
| `laravel-migration` | 0 | 0 |
| `laravel-notifications` | 0 | 0 |
| `laravel-pennant` | 0 | 0 |
| `laravel-pulse` | 0 | 0 |
| `laravel-reverb` | 0 | 0 |
| `laravel-scheduling` | 0 | 0 |
| `laravel-validation` | 0 | 0 |
| `laravel-websocket` | 0 | 0 |
| `learning-to-rule-or-skill` | 0 | 0 |
| `learning-tutor` | 0 | 0 |
| `legal-intake-triage` | 0 | 0 |
| `legal-practice-profile` | 0 | 0 |
| `license-compliance-audit` | 0 | 0 |
| `license-compliance-borrow-check` | 0 | 0 |
| `license-compliance-credits` | 0 | 0 |
| `livewire` | 0 | 0 |
| `livewire-architect` | 0 | 0 |
| `logging-monitoring` | 0 | 0 |
| `market-entry-analysis` | 0 | 0 |
| `markitdown` | 0 | 0 |
| `mcp-builder` | 0 | 0 |
| `mcp-tool-use` | 0 | 0 |
| `md-language-check` | 0 | 0 |
| `memory-consolidation` | 0 | 0 |
| `merge-conflicts` | 0 | 0 |
| `messaging-architecture` | 0 | 0 |
| `migration-architect` | 0 | 0 |
| `mobile-e2e-strategy` | 0 | 0 |
| `module-detect-on-the-fly` | 0 | 0 |
| `module-management` | 0 | 0 |
| `monorepo-workspace` | 0 | 0 |
| `motion-choreographer` | 0 | 0 |
| `multi-tenancy` | 0 | 0 |
| `nda-triage` | 0 | 0 |
| `nextjs-patterns` | 0 | 0 |
| `okr-tree-modeling` | 0 | 0 |
| `onboarding-design` | 0 | 0 |
| `onboarding-program` | 0 | 0 |
| `one-on-one-cadence` | 0 | 0 |
| `openapi` | 0 | 0 |
| `operational-readiness` | 0 | 0 |
| `org-design` | 0 | 0 |
| `overbuild-review-lens` | 0 | 0 |
| `override-management` | 0 | 0 |
| `perf-feedback-craft` | 0 | 0 |
| `performance` | 0 | 0 |
| `performance-analysis` | 0 | 0 |
| `persona-improvement` | 0 | 0 |
| `persona-writing` | 0 | 0 |
| `pest-testing` | 0 | 0 |
| `php-coder` | 0 | 0 |
| `php-debugging` | 0 | 0 |
| `php-service` | 0 | 0 |
| `pipeline-strategy` | 0 | 0 |
| `pixar-storyteller` | 0 | 0 |
| `playbook-authoring` | 0 | 0 |
| `playwright-architect` | 0 | 0 |
| `playwright-testing` | 0 | 0 |
| `positioning-strategy` | 0 | 0 |
| `prediction-pool-optimizer` | 0 | 0 |
| `premortem` | 0 | 0 |
| `privacy-review` | 0 | 0 |
| `project-analysis-core` | 0 | 0 |
| `project-analysis-hypothesis-driven` | 0 | 0 |
| `project-analysis-laravel` | 0 | 0 |
| `project-analysis-nextjs` | 0 | 0 |
| `project-analysis-node-express` | 0 | 0 |
| `project-analysis-react` | 0 | 0 |
| `project-analysis-symfony` | 0 | 0 |
| `project-analysis-zend-laminas` | 0 | 0 |
| `project-analyzer` | 0 | 0 |
| `project-docs` | 0 | 0 |
| `prompt-engineering-image` | 0 | 0 |
| `prompt-engineering-patterns` | 0 | 0 |
| `prompt-validator` | 0 | 0 |
| `quality-tools` | 0 | 0 |
| `react-native-setup` | 0 | 0 |
| `react-shadcn-ui` | 0 | 0 |
| `readme-reviewer` | 0 | 0 |
| `readme-writing` | 0 | 0 |
| `readme-writing-package` | 0 | 0 |
| `reasoning-orchestrator` | 0 | 0 |
| `receiving-code-review` | 0 | 0 |
| `refine-prompt` | 0 | 0 |
| `refine-ticket` | 0 | 0 |
| `release-comms` | 0 | 0 |
| `repomix-packer` | 0 | 0 |
| `requesting-code-review` | 0 | 0 |
| `retention-loops` | 0 | 0 |
| `review-routing` | 0 | 0 |
| `rice-prioritization` | 0 | 0 |
| `risk-officer` | 0 | 0 |
| `roadmap-management` | 0 | 0 |
| `root-cause-frameworks` | 0 | 0 |
| `rtk-output-filtering` | 0 | 0 |
| `rule-refactor` | 0 | 0 |
| `rule-writing` | 0 | 0 |
| `runway-cognition` | 0 | 0 |
| `scenario-modeling` | 0 | 0 |
| `scene-expander` | 0 | 0 |
| `schema-review` | 0 | 0 |
| `screenshot-hygiene` | 0 | 0 |
| `script-writing` | 0 | 0 |
| `secrets-management` | 0 | 0 |
| `security` | 0 | 0 |
| `security-maturity-assessment` | 0 | 0 |
| `sentry-integration` | 0 | 0 |
| `sequential-thinking` | 0 | 0 |
| `server-hardening` | 0 | 0 |
| `skill-management` | 0 | 0 |
| `source-discovery` | 0 | 0 |
| `spreadsheet-authoring` | 0 | 0 |
| `sql-writing` | 0 | 0 |
| `stakeholder-tradeoff` | 0 | 0 |
| `standards-from-config` | 0 | 0 |
| `storybook-workshop` | 0 | 0 |
| `supply-chain-intake` | 0 | 0 |
| `symfony-workflow` | 0 | 0 |
| `systematic-debugging` | 0 | 0 |
| `tailwind-engineer` | 0 | 0 |
| `terraform` | 0 | 0 |
| `terragrunt` | 0 | 0 |
| `test-case-discovery` | 0 | 0 |
| `test-driven-development` | 0 | 0 |
| `test-performance` | 0 | 0 |
| `testing-anti-patterns` | 0 | 0 |
| `throughput-vs-morale-tradeoff` | 0 | 0 |
| `token-optimizer` | 0 | 0 |
| `traefik` | 0 | 0 |
| `type-design` | 0 | 0 |
| `typography-system` | 0 | 0 |
| `ui-apply-generic` | 0 | 0 |
| `ui-component-architect` | 0 | 0 |
| `unit-economics-modeling` | 0 | 0 |
| `universal-project-analysis` | 0 | 0 |
| `upstream-contribute` | 0 | 0 |
| `validate-feature-fit` | 0 | 0 |
| `verify-completion-evidence` | 0 | 0 |
| `verify-repair-loop` | 0 | 0 |
| `video-director` | 0 | 0 |
| `vision-articulation` | 0 | 0 |
| `voc-extract` | 0 | 0 |
| `voice-and-tone-design` | 0 | 0 |
| `wireframe` | 0 | 0 |
| `workspace-link` | 0 | 0 |
| `worktree-lifecycle` | 0 | 0 |
