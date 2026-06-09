# Skill-family taxonomy

A navigable grouping of the **227 skills** into families, so you can find a skill
by *what it's for* rather than scrolling the flat [catalog](catalog.md). This is a
**navigation aid, not a contract** — no file moves, no description edits, no
merges. A skill appears in exactly one family (its primary use); many are useful
across families.

> **Derivation (reproducible):** each skill is bucketed by declared `pack:` where
> present, otherwise by a name/topic pattern. The grouping is heuristic and
> refinable — when a skill reads better in another family, move the entry.
> Counts here match the [artefact census](artefact-census.md) (227 skills).

## Engineering

### Backend & data (34)
`api-design` · `api-endpoint` · `artisan-commands` · `async-python-patterns` · `composer-packages` · `database` · `eloquent` · `form-handler` · `jobs-events` · `laravel` · `laravel-api-endpoint` · `laravel-dto` · `laravel-horizon` · `laravel-mail` · `laravel-middleware` · `laravel-migration` · `laravel-notifications` · `laravel-pennant` · `laravel-pulse` · `laravel-reverb` · `laravel-scheduling` · `laravel-validation` · `laravel-websocket` · `multi-tenancy` · `nextjs-patterns` · `php-coder` · `php-debugging` · `php-service` · `project-analysis-laravel` · `project-analysis-nextjs` · `project-analysis-node-express` · `project-analysis-symfony` · `sql-writing` · `symfony-workflow`

### Frontend & design (15)
`accessibility-auditor` · `blade-ui` · `canvas-design` · `design-intelligence` · `design-tokens` · `existing-ui-audit` · `fe-design` · `flux` · `livewire` · `livewire-architect` · `project-analysis-react` · `react-native-setup` · `react-shadcn-ui` · `tailwind-engineer` · `ui-component-architect`

### Architecture & refactor (7)
`code-refactoring` · `dependency-upgrade` · `error-handling-patterns` · `messaging-architecture` · `migration-architect` · `openapi` · `performance`

### Engineering workflow (8)
`conventional-commits-writing` · `developer-like-execution` · `finishing-a-development-branch` · `git-workflow` · `merge-conflicts` · `quality-tools` · `technical-specification` · `verify-completion-evidence`

### Testing (8)
`api-testing` · `mobile-e2e-strategy` · `pest-testing` · `playwright-architect` · `playwright-testing` · `test-driven-development` · `test-performance` · `testing-anti-patterns`

### DevOps & infra (7)
`aws-infrastructure` · `docker` · `github-ci` · `grafana` · `terraform` · `terragrunt` · `traefik`

### Debugging & analysis (12)
`analysis-autonomous-mode` · `analysis-skill-router` · `bug-analyzer` · `deep-reading-analyst` · `image-analyser` · `performance-analysis` · `project-analysis-core` · `project-analysis-hypothesis-driven` · `project-analysis-zend-laminas` · `project-analyzer` · `systematic-debugging` · `universal-project-analysis`

## Quality & risk

### Review & judging (12)
`architecture-review-lens` · `authz-review` · `code-review` · `design-review` · `judge-bug-hunter` · `judge-code-quality` · `judge-security-auditor` · `judge-test-coverage` · `privacy-review` · `receiving-code-review` · `requesting-code-review` · `review-routing`

### Security (8)
`blast-radius-analyzer` · `data-flow-mapper` · `data-handling-judgment` · `defense-in-depth` · `secrets-management` · `security` · `security-audit` · `threat-modeling`

### Operations & reliability (6)
`dashboard-design` · `incident-commander` · `jira-integration` · `launch-readiness` · `logging-monitoring` · `sentry-integration`

### AI Council & decision (5)
`adversarial-review` · `ai-council` · `decision-record` · `risk-officer` · `stakeholder-tradeoff`

## Product, growth & business

### Product & discovery (12)
`activation-design` · `churn-prevention` · `customer-research` · `discovery-interview` · `estimate-ticket` · `feature-planning` · `funnel-analysis` · `onboarding-design` · `po-discovery` · `refine-ticket` · `retention-loops` · `rice-prioritization`

### Strategy (9)
`build-buy-partner` · `competitive-moat-analysis` · `competitive-positioning` · `contracts-cognition` · `market-entry-analysis` · `okr-tree-modeling` · `positioning-strategy` · `validate-feature-fit` · `vision-articulation`

### Finance (7)
`dcf-modeling` · `forecast-accuracy` · `forecasting` · `fundraising-narrative` · `runway-cognition` · `scenario-modeling` · `unit-economics-modeling`

### GTM & sales (4)
`deal-qualification-meddic` · `expansion-playbook` · `gtm-launch` · `pipeline-strategy`

### People & org (7)
`comp-banding` · `hiring-loop-design` · `onboarding-program` · `one-on-one-cadence` · `org-design` · `perf-feedback-craft` · `throughput-vs-morale-tradeoff`

## Content & media

### Content & writing (7)
`content-funnel-design` · `doc-coauthoring` · `editorial-calendar` · `release-comms` · `script-writing` · `voc-extract` · `voice-and-tone-design`

### AI video & image (8)
`character-consistency` · `image-creator` · `motion-choreographer` · `pixar-storyteller` · `prediction-pool-optimizer` · `scene-expander` · `song-to-script` · `video-director`

## Platform & maintenance

### Agent-admin & meta (51)
The largest family — skills that maintain the package itself (authoring,
condensation, routing, memory, MCP, prompt tooling). Day-to-day product work
rarely touches these directly.

`adr-create` · `agent-docs-writing` · `agents-md-thin-root` · `check-refs` · `command-routing` · `command-writing` · `condense-memory` · `context-authoring` · `context-document` · `copilot-agents-optimization` · `copilot-config` · `corpus-grounding` · `description-assist` · `devcontainer` · `file-editor` · `guideline-writing` · `learning-to-rule-or-skill` · `lint-skills` · `markitdown` · `mcp` · `mcp-builder` · `md-language-check` · `memory-consolidation` · `module-detect-on-the-fly` · `module-management` · `override-management` · `persona-writing` · `project-docs` · `prompt-engineering-patterns` · `prompt-optimizer` · `prompt-validator` · `readme-reviewer` · `readme-writing` · `readme-writing-package` · `refine-prompt` · `repomix-packer` · `roadmap-management` · `roadmap-writing` · `rtk-output-filtering` · `rule-refactor` · `rule-writing` · `sequential-thinking` · `skill-improvement-pipeline` · `skill-management` · `skill-reviewer` · `skill-writing` · `subagent-orchestration` · `tech-debt-tracker` · `token-optimizer` · `upstream-contribute` · `using-git-worktrees`

## See also

- [`catalog.md`](catalog.md) — the flat, public capability surface (all types).
- [`flows.md`](flows.md) — the work journeys these skills compose into.
- [`profiles.md`](profiles.md) · [`experiences/`](experiences/) — which profiles surface which families.
- [`artefact-census.md`](artefact-census.md) — the counted baseline (227 skills).
