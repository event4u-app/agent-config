<!-- evidence-type: analysis -->
<!-- semantic-parity-census: v1 | commit: 35e37a64d0236eb423f2a2c1c5869741c545b754 | commit-date: 2026-09-29T10:03:03+02:00 -->

# Semantic-parity census — MCP-lite `ContentEntry`

Emitted by `src/scripts/semantic_parity_census.ts`. **Carrier measured: `ContentEntry`**
in `src/cli/mcp/content.ts` — one delivery path, MCP-lite. A different path drops a
different set; a second carrier is a second report, never an edit to this one. Read the
script's module header for the classification before reading a number here.

This report states coverage only. It marks no skill, excludes none, and is not a
verdict about which skills matter.

- **Commit pin:** `35e37a64d0236eb423f2a2c1c5869741c545b754` (2026-09-29T10:03:03+02:00)
- **Schema:** `src/scripts/schemas/skill.schema.json`
- **Corpus:** `src/skills/*/SKILL.md` — 299 file(s)

## Field coverage

38 declared properties, each in exactly one column: 4 carried, 1 partial, 33 dropped.

| field | carried | partial | dropped | travels |
|---|---|---|---|---|
| `compatibility` |  |  | x |  |
| `composition_review` |  |  | x |  |
| `context` |  |  | x |  |
| `context_spine` |  |  | x |  |
| `council_depth` |  |  | x |  |
| `description` | x |  |  |  |
| `domain` |  |  | x |  |
| `effort` |  |  | x |  |
| `enforced_by` |  |  | x |  |
| `execution` |  |  | x |  |
| `external_source` |  |  | x |  |
| `framework` |  |  | x |  |
| `gaps` |  |  | x |  |
| `harness_compat` |  |  | x |  |
| `install` |  |  | x |  |
| `lifecycle` |  |  | x |  |
| `meta_skill` |  |  | x |  |
| `model_tier` |  |  | x |  |
| `name` | x |  |  |  |
| `packs` |  |  | x |  |
| `parallelizable` |  |  | x |  |
| `personas` | x |  |  |  |
| `provenance` |  |  | x |  |
| `recommended_for_user_types` |  |  | x |  |
| `refresh_trigger` |  |  | x |  |
| `replaced_by` |  |  | x |  |
| `requires_skills` |  |  | x |  |
| `runtime_requires` |  |  | x |  |
| `scope` |  |  | x |  |
| `source` | x |  |  |  |
| `status` |  |  | x |  |
| `sunset_criterion` |  |  | x |  |
| `tier` |  |  | x |  |
| `token_budget_class` |  |  | x |  |
| `triggers` |  | x |  | `keyword`, `phrase` |
| `trust` |  |  | x |  |
| `user-invocable` |  |  | x |  |
| `workspaces` |  |  | x |  |

## Corpus declarations against the uncarried set

How many skills declare each field the carrier drops or truncates. A field absent from
this table is declared by no skill today — the gap for it is theoretical.

| field | column | skills declaring |
|---|---|---|
| `domain` | dropped | 299 |
| `model_tier` | dropped | 299 |
| `packs` | dropped | 299 |
| `workspaces` | dropped | 299 |
| `install` | dropped | 129 |
| `trust` | dropped | 121 |
| `status` | dropped | 63 |
| `tier` | dropped | 58 |
| `execution` | dropped | 52 |
| `scope` | dropped | 52 |
| `context_spine` | dropped | 46 |
| `recommended_for_user_types` | dropped | 38 |
| `lifecycle` | dropped | 15 |
| `triggers` | partial | 12 |
| `council_depth` | dropped | 11 |
| `context` | dropped | 6 |
| `framework` | dropped | 6 |
| `parallelizable` | dropped | 5 |
| `requires_skills` | dropped | 5 |
| `runtime_requires` | dropped | 4 |
| `token_budget_class` | dropped | 4 |
| `refresh_trigger` | dropped | 3 |
| `sunset_criterion` | dropped | 3 |
| `compatibility` | dropped | 2 |
| `enforced_by` | dropped | 2 |
| `harness_compat` | dropped | 2 |
| `meta_skill` | dropped | 2 |
| `user-invocable` | dropped | 2 |
| `gaps` | dropped | 1 |

**299 of 299 skills declare at least one semantic the carrier does not transport whole.**

## Per skill

| skill | dropped | partial |
|---|---|---|
| `accessibility-auditor` | `domain`, `enforced_by`, `model_tier`, `packs`, `token_budget_class`, `workspaces` | — |
| `activation-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `adr-create` | `domain`, `execution`, `model_tier`, `packs`, `runtime_requires`, `scope`, `workspaces` | — |
| `adversarial-review` | `council_depth`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `agent-docs-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `agent-security-review` | `council_depth`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `agents-md-thin-root` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `ai-code-blindspots` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `ai-council` | `domain`, `meta_skill`, `model_tier`, `packs`, `parallelizable`, `workspaces` | — |
| `alerting-doctrine` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `analysis-autonomous-mode` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `analysis-skill-router` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `api-design` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | — |
| `api-endpoint` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `api-testing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `architecture-review-lens` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `artisan-commands` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `async-python-patterns` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `refresh_trigger`, `status`, `sunset_criterion`, `trust`, `workspaces` | — |
| `authz-review` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | `triggers` |
| `aws-infrastructure` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `blade-ui` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `blameless-post-mortem` | `domain`, `install`, `model_tier`, `packs`, `requires_skills`, `trust`, `workspaces` | — |
| `blast-radius-analyzer` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `brand` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `brand-asset-generation` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `brand-audit` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `brand-identity` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `brand-strategy` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `brand-to-tokens` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `bug-analyzer` | `council_depth`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `build-buy-partner` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `canvas-design` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `character-consistency` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `check-refs` | `domain`, `execution`, `gaps`, `model_tier`, `packs`, `runtime_requires`, `scope`, `workspaces` | — |
| `churn-prevention` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `code-intelligence` | `domain`, `model_tier`, `packs`, `requires_skills`, `workspaces` | — |
| `code-refactoring` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `code-review` | `domain`, `model_tier`, `packs`, `parallelizable`, `user-invocable`, `workspaces` | — |
| `command-routing` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `command-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `comp-banding` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `competitive-moat-analysis` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `competitive-positioning` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `complexity-first-planning` | `context_spine`, `domain`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `composer-packages` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `condense-memory` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `content-funnel-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `context-authoring` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `context-document` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `contract-review` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `contracts-cognition` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `conventional-commits-writing` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `copilot-agents-optimization` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `copilot-config` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `corpus-grounding` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `customer-research` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `dashboard-design` | `domain`, `framework`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | — |
| `data-flow-mapper` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `data-handling-judgment` | `context_spine`, `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `database` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `dcf-modeling` | `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `deal-qualification-meddic` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `decision-record` | `context_spine`, `domain`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `decision-review` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `deep-reading-analyst` | `context`, `domain`, `model_tier`, `packs`, `status`, `workspaces` | — |
| `defense-in-depth` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `dependency-upgrade` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `description-assist` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `design-intelligence` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `token_budget_class`, `trust`, `workspaces` | — |
| `design-review` | `domain`, `enforced_by`, `model_tier`, `packs`, `workspaces` | — |
| `design-system-capture` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `token_budget_class`, `workspaces` | — |
| `design-tokens` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `design-variations` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `devcontainer` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `developer-like-execution` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `discovery-interview` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `doc-coauthoring` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `docker` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `docx-authoring` | `compatibility`, `domain`, `harness_compat`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `dpa-review` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `editorial-calendar` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `eloquent` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `emit-tickets` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `error-handling-patterns` | `domain`, `model_tier`, `packs`, `refresh_trigger`, `status`, `sunset_criterion`, `workspaces` | — |
| `estimate-ticket` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `evaluate-llm-feature` | `domain`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `existing-ui-audit` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `expansion-playbook` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `experiment-loop` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `fe-design` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `feature-planning` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `file-editor` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `finishing-a-development-branch` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `flux` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `forecast-accuracy` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `forecasting` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `forensics-report` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `form-handler` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `frontend-render-security` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `fundraising-narrative` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `funnel-analysis` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `gated-reach` | `domain`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `git-workflow` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `github-ci` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `grafana` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `gtm-launch` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `guideline-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `hiring-loop-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `history-design` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `html-deck` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `humanizer` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `iconography` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `image-analyser` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `image-creator` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `image-editing` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `image-generation` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `image-provider-routing` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `incident-commander` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | — |
| `jira-integration` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `jobs-events` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `js-library-packaging` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-artifact-completeness` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-bug-hunter` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-code-quality` | `domain`, `model_tier`, `packs`, `parallelizable`, `workspaces` | — |
| `judge-injection-defense` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-security-auditor` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-spec-compliance` | `domain`, `model_tier`, `packs`, `parallelizable`, `workspaces` | — |
| `judge-synthesis` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `judge-test-coverage` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `laravel` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-api-endpoint` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-dto` | `domain`, `framework`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-horizon` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-mail` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-middleware` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-migration` | `domain`, `framework`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | `triggers` |
| `laravel-notifications` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-pennant` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-pulse` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-reverb` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-scheduling` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-validation` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `laravel-websocket` | `domain`, `framework`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `launch-readiness` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `learning-to-rule-or-skill` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `learning-tutor` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `legal-intake-triage` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `legal-practice-profile` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `license-compliance-audit` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `license-compliance-borrow-check` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `license-compliance-credits` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `lint-skills` | `domain`, `execution`, `model_tier`, `packs`, `runtime_requires`, `scope`, `workspaces` | — |
| `livewire` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `livewire-architect` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `llm-provider-knowledge` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `logging-monitoring` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `logo-generation` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `market-entry-analysis` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `markitdown` | `domain`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `mcp` | `domain`, `model_tier`, `packs`, `user-invocable`, `workspaces` | — |
| `mcp-builder` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `md-language-check` | `domain`, `execution`, `model_tier`, `packs`, `runtime_requires`, `scope`, `workspaces` | — |
| `memory-consolidation` | `context_spine`, `domain`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `merge-conflicts` | `domain`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `messaging-architecture` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `migration-architect` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `mobile-e2e-strategy` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `module-detect-on-the-fly` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `module-management` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `monorepo-workspace` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `motion-choreographer` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `multi-tenancy` | `domain`, `framework`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `nda-triage` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `nextjs-patterns` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `okr-tree-modeling` | `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `onboarding-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `onboarding-program` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `one-on-one-cadence` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `openapi` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `operational-readiness` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `org-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `overbuild-review-lens` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `override-management` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `pdf-tools` | `compatibility`, `domain`, `harness_compat`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `perf-feedback-craft` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `performance` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `performance-analysis` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `persona-improvement` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `persona-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `pest-testing` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | `triggers` |
| `php-coder` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `php-debugging` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `php-service` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `pipeline-strategy` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `pixar-storyteller` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `playbook-authoring` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `playwright-architect` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | — |
| `playwright-testing` | `domain`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `po-discovery` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `positioning-strategy` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `prediction-pool-optimizer` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `premortem` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `privacy-review` | `context_spine`, `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | `triggers` |
| `project-analysis-core` | `context`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `project-analysis-hypothesis-driven` | `context`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `project-analysis-laravel` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analysis-nextjs` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analysis-node-express` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analysis-react` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analysis-symfony` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analysis-zend-laminas` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `project-analyzer` | `context`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `project-docs` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `prompt-engineering-image` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `prompt-engineering-patterns` | `domain`, `model_tier`, `packs`, `status`, `workspaces` | — |
| `prompt-optimizer` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `prompt-validator` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `quality-tools` | `domain`, `execution`, `model_tier`, `packs`, `recommended_for_user_types`, `scope`, `workspaces` | — |
| `react-native-setup` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `react-shadcn-ui` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `readme-reviewer` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `readme-writing` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `readme-writing-package` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `reasoning-orchestrator` | `context_spine`, `domain`, `model_tier`, `packs`, `requires_skills`, `status`, `tier`, `workspaces` | — |
| `receiving-code-review` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `recursive-verification` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `refine-prompt` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `refine-ticket` | `domain`, `execution`, `install`, `model_tier`, `packs`, `requires_skills`, `scope`, `trust`, `workspaces` | — |
| `release-comms` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `repomix-packer` | `context`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `requesting-code-review` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `retention-loops` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `review-routing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `rice-prioritization` | `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `risk-officer` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `roadmap-management` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `roadmap-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `root-cause-frameworks` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `rtk-output-filtering` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `rule-refactor` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `rule-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `runway-cognition` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | `triggers` |
| `scenario-modeling` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `workspaces` | — |
| `scene-expander` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `schema-review` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `screenshot-hygiene` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `script-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `secrets-management` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `refresh_trigger`, `status`, `sunset_criterion`, `workspaces` | `triggers` |
| `security` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `security-audit` | `domain`, `model_tier`, `packs`, `parallelizable`, `workspaces` | — |
| `security-maturity-assessment` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `sentry-integration` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `sequential-thinking` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `server-hardening` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `skill-improvement-pipeline` | `domain`, `execution`, `model_tier`, `packs`, `requires_skills`, `scope`, `workspaces` | — |
| `skill-management` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `skill-reviewer` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `skill-writing` | `domain`, `meta_skill`, `model_tier`, `packs`, `workspaces` | — |
| `song-to-script` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `source-discovery` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `spreadsheet-authoring` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `sql-writing` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `stakeholder-tradeoff` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `standards-from-config` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `storybook-workshop` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `subagent-orchestration` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `supply-chain-intake` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `symfony-workflow` | `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `systematic-debugging` | `council_depth`, `domain`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `tailwind-engineer` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `tech-debt-tracker` | `domain`, `model_tier`, `packs`, `recommended_for_user_types`, `workspaces` | — |
| `technical-specification` | `council_depth`, `domain`, `install`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `terraform` | `domain`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `terragrunt` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `test-case-discovery` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `test-driven-development` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `test-performance` | `domain`, `framework`, `model_tier`, `packs`, `workspaces` | — |
| `testing-anti-patterns` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `threat-modeling` | `council_depth`, `domain`, `model_tier`, `packs`, `workspaces` | `triggers` |
| `throughput-vs-morale-tradeoff` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `trust`, `workspaces` | — |
| `token-optimizer` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `traefik` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `typography-system` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `token_budget_class`, `trust`, `workspaces` | — |
| `ui-apply-generic` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `ui-component-architect` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `unit-economics-modeling` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `universal-project-analysis` | `context`, `domain`, `model_tier`, `packs`, `workspaces` | — |
| `upstream-contribute` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `using-git-worktrees` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `validate-feature-fit` | `domain`, `execution`, `model_tier`, `packs`, `scope`, `workspaces` | — |
| `verify-completion-evidence` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `verify-repair-loop` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `video-director` | `domain`, `install`, `lifecycle`, `model_tier`, `packs`, `trust`, `workspaces` | — |
| `vision-articulation` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `status`, `tier`, `workspaces` | — |
| `voc-extract` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `voice-and-tone-design` | `context_spine`, `domain`, `install`, `model_tier`, `packs`, `recommended_for_user_types`, `status`, `tier`, `trust`, `workspaces` | — |
| `wireframe` | `domain`, `execution`, `install`, `model_tier`, `packs`, `scope`, `trust`, `workspaces` | — |
| `workspace-link` | `domain`, `model_tier`, `packs`, `workspaces` | — |
| `worktree-lifecycle` | `domain`, `model_tier`, `packs`, `workspaces` | — |
