# Skills Audit Results

> Generated from linter baseline. 111 unique uncompressed skills.
> Baseline: 110 fail, 1 warn, 0 pass.

## Audit Table

| # | Skill | Status | Errors | Warns | Classification | Action |
|---|---|---|---|---|---|---|
| 1 | `adversarial-review` | fail | 3 | 5 | KEEP | Upgrade to template — good 3-step procedural workflow (Attack/Defend/Revise), clear trigger |
| 2 | `agent-docs-writing` | fail | 3 | 5 | KEEP | Upgrade to template — documentation hierarchy is essential reference knowledge; some constraints overlap with scope-control rule |
| 3 | `agents-audit` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural audit workflow with checklist and output format |
| 4 | `analysis-autonomous-mode` | fail | 2 | 6 | KEEP | Upgrade to template — procedural coordination workflow with routing matrix and escalation rules |
| 5 | `api-design` | fail | 3 | 5 | SPLIT | Extract conventions (status codes, response format, pagination) → guideline `php/api-design.md`; keep design decision workflow as skill |
| 6 | `api-endpoint` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill (create Controller + FormRequest + Resource + Route + Policy) |
| 7 | `api-testing` | fail | 3 | 5 | KEEP | Upgrade to template — concrete test patterns with checklist per endpoint; distinct from pest-testing |
| 8 | `api-versioning` | fail | 3 | 5 | MERGE | Merge into `api-design` — versioning is a subsection of API design, not a standalone workflow; deprecation workflow fits within api-design |
| 9 | `artisan-commands` | fail | 3 | 5 | SPLIT | Extract conventions/rules → guideline `php/artisan-commands.md`; keep focused "create artisan command" procedure |
| 10 | `aws-infrastructure` | fail | 3 | 6 | KEEP | Upgrade to template — domain-specific reference knowledge needed for AWS deployment work; no procedure but essential context |
| 11 | `blade-ui` | fail | 3 | 5 | SPLIT | Extract conventions → guideline `php/blade-ui.md`; keep focused Blade component/view creation procedure |
| 12 | `bug-analyzer` | fail | 3 | 5 | KEEP | Upgrade to template — strong 4-phase procedural skill with iron law, proactive/reactive modes |
| 13 | `cloudflare-workers` | fail | 3 | 5 | REMOVE | Generic framework reference — model already knows CF Workers APIs; no project-specific content or procedures |
| 14 | `code-review` | fail | 3 | 5 | KEEP | Upgrade to template — strong procedural skill with review order, checklist, and feedback response pattern |
| 15 | `coder` | fail | 3 | 5 | SPLIT | Heavy overlap with `php-coding` rule and `copilot-instructions.md`; extract unique "before writing code" checklist as procedure, merge redundant conventions into existing rules |
| 16 | `commands` | fail | 4 | 5 | SPLIT | Core "execute immediately" behavior already in `commands` rule; extract GitHub API reply pattern + context inference as separate concern; remove duplicate rule content from skill |
| 17 | `composer-packages` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill for creating/maintaining Composer packages with pre-publish checklist |
| 18 | `composer` | fail | 3 | 5 | REMOVE | Generic Composer knowledge the model already has; only project-specific rule ("run inside Docker") is already in `docker-commands` rule |
| 19 | `context` | fail | 3 | 5 | KEEP | Upgrade to template — procedural skill for creating context documents with clear workflow and file structure |
| 20 | `copilot-agents-optimizer` | fail | 3 | 5 | KEEP | Upgrade to template — clear optimization checklist, deduplication strategy, and line budgets for AGENTS.md/copilot-instructions.md |
| 21 | `copilot` | fail | 3 | 5 | KEEP | Upgrade to template — valuable project-specific knowledge: what Copilot can/cannot read, false positive table, PR comment handling |
| 22 | `dashboard-design` | fail | 3 | 6 | SPLIT | Extract Grafana embedding patterns → `grafana` skill; remove generic visualization/observability reference (RED/USE/Golden Signals) the model already knows; keep only project-specific patterns |
| 23 | `database` | fail | 3 | 5 | SPLIT | Heavy overlap with `eloquent` skill; extract project-specific conventions (multi-connection, Math helper) to rules/guidelines; merge query optimization into `eloquent`; remove generic DB knowledge |
| 24 | `dependency-upgrade` | fail | 3 | 5 | KEEP | Upgrade to template — clear 5-step procedural workflow (Assess → Plan → Execute → Verify → Document) |
| 25 | `design-review` | fail | 3 | 5 | KEEP | Upgrade to template — strong 7-phase methodology with clear output format and triage matrix |
| 26 | `devcontainer` | fail | 3 | 5 | KEEP | Upgrade to template — domain-specific reference knowledge needed when working with DevContainers |
| 27 | `docker` | fail | 3 | 5 | KEEP | Upgrade to template — critical infrastructure knowledge; project-specific architecture, dual-container setup, Makefile targets |
| 28 | `dto-creator` | fail | 3 | 5 | KEEP | Upgrade to template — procedural skill for creating DTOs with project-specific base class and mapping conventions |
| 29 | `eloquent` | fail | 3 | 5 | SPLIT | Heavy overlap with `php-coding` rule (getter/setter), `database` skill (queries), and `eloquent.md` guideline; extract conventions to existing rules/guidelines, keep model creation workflow |
| 30 | `fe-design` | fail | 3 | 5 | KEEP | Upgrade to template — project-specific stack knowledge (Blade/Livewire/Flux/Tailwind) tying together frontend skills |
| 31 | `feature-planning` | fail | 3 | 5 | KEEP | Upgrade to template — strong 7-phase procedural workflow with understanding lock, decision log, adversarial review integration |
| 32 | `file-editor` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill for IDE integration with settings-based behavior and batch open rules |
| 33 | `flux` | fail | 3 | 5 | SPLIT | Extract component conventions (variant usage, form rules) → guideline `php/flux.md`; keep focused "create Flux view" procedure with component reference |
| 34 | `git-workflow` | fail | 3 | 5 | SPLIT | Heavy overlap with `commit-conventions` rule; branch naming + commit format → existing rule/guideline `php/git.md`; keep PR creation workflow + branch finishing procedure as skill |
| 35 | `github-action-docs` | fail | 1 | 5 | KEEP | Already partially upgraded; clear procedure for documenting CI workflows |
| 36 | `github-ci` | fail | 3 | 5 | KEEP | Upgrade to template — critical project-specific CI knowledge: workflow matrix, PHP version extraction, Composer auth, debugging steps |
| 37 | `grafana` | fail | 3 | 5 | KEEP | Upgrade to template — project-specific Loki labels, dashboard conventions, alerting structure, LogQL patterns |
| 38 | `graphql` | fail | 3 | 5 | REMOVE | Generic GraphQL knowledge (schema design, DataLoader, Relay pagination) — model already knows all of this; no project-specific content |
| 39 | `guidelines` | fail | 3 | 5 | REMOVE | Meta-skill about guideline structure; `guidelines` rule already handles discovery; agents discover `.augment/guidelines/` automatically |
| 40 | `javascript` | fail | 3 | 5 | REMOVE | Generic JS knowledge (ES2020+ syntax, async/await, DOM) — model already knows all of this; no project-specific patterns |
| 41 | `jira` | fail | 3 | 5 | KEEP | Upgrade to template — project-specific Jira workflow with MCP tool usage, branch-to-ticket detection, ADF format reference |
| 42 | `jobs-events` | fail | 3 | 5 | SPLIT | Mix of conventions (naming, serialization, idempotency rules) and procedure; extract conventions → guideline `php/jobs.md`; keep focused job/event creation workflow |
| 43 | `laravel-horizon` | fail | 3 | 5 | KEEP | Upgrade to template — domain-specific Horizon reference: config, balancing, deployment, monitoring |
| 44 | `laravel-mail` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill for creating Mailables with Envelope+Content pattern and testing |
| 45 | `laravel-middleware` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill for creating middleware with before/after/terminable patterns |
| 46 | `laravel-notifications` | fail | 3 | 5 | KEEP | Upgrade to template — clear procedural skill for creating notifications with channel-specific examples |
| 47 | `laravel-pennant` | fail | 3 | 5 | KEEP | Upgrade to template — domain-specific Pennant reference with class-based features, scopes, drivers |
| 48 | `laravel-pulse` | fail | 3 | 5 | KEEP | Upgrade to template — domain-specific Pulse reference with cards, recorders, config |
| 49 | `laravel-reverb` | fail | 3 | 6 | KEEP | Upgrade to template — domain-specific Reverb reference with scaling, deployment, Pulse integration |
| 50 | `laravel-scheduling` | fail | 3 | 5 | KEEP | Upgrade to template — clear reference for scheduling with frequency helpers, overlap prevention |
| 51 | `laravel-validation` | fail | 3 | 5 | SPLIT | Heavy overlap with `validations.md` guideline; extract conventions → existing guideline; keep focused FormRequest creation workflow |
| 52 | `laravel` | fail | 3 | 6 | NARROW | Too broad — covers controllers, routing, services, jobs, events, auth, config, migrations, Blade; split into focused skills or merge sections into existing specialized skills |
| 53 | `learning-to-rule-or-skill` | fail | 1 | 2 | KEEP | Upgrade to template — clear 7-step decision workflow with concrete examples; part of meta-skill toolchain |
| 54 | `livewire` | fail | 3 | 5 | SPLIT | Extract conventions (state management rules, performance rules) → guideline `php/livewire.md`; keep focused component creation procedure |
| 55 | `logging-monitoring` | fail | 3 | 5 | SPLIT | Mix of reference (monitoring stack, Sentry helpers) and conventions (log levels, structured logging); extract logging conventions → guideline; keep monitoring setup/integration workflow |
| 56 | `markdown-safe-codeblocks` | fail | 1 | 4 | RULE | Primarily constraints ("NEVER nest triple backticks"); migrate to rule; too simple for a full skill |
| 57 | `markdown-template-generator` | warn | 0 | 4 | MERGE | Heavy overlap with `markdown-safe-codeblocks`; merge unique template structure steps into a single `markdown-safe` rule or thin skill |
| 58 | `mcp` | fail | 3 | 5 | KEEP | Upgrade to template — valuable MCP tool catalog with workflow patterns, permission boundaries; project-specific tool combinations |
| 59 | `merge-conflicts` | fail | 3 | 5 | KEEP | Upgrade to template — strong procedural skill with resolution strategies, file-type rules, verification steps |
| 60 | `microservices` | fail | 3 | 5 | REMOVE | Generic microservices knowledge (boundaries, patterns, resilience) — model already knows all of this; no project-specific content |
| 61 | `migration-creator` | fail | 3 | 5 | **KEEP** | Clear creation workflow with multi-tenant awareness and connection-specific patterns |
| 62 | `mobile` | fail | 3 | 5 | **REMOVE** | Generic React Native/Swift knowledge, no project-specific patterns |
| 63 | `module` | fail | 3 | 5 | **KEEP** | Project-specific module structure, namespace conventions, existing modules list |
| 64 | `multi-tenancy` | fail | 3 | 5 | **KEEP** | Critical domain-specific dual-database architecture reference |
| 65 | `naming` | fail | 3 | 5 | **SPLIT** | Conventions → Guideline `php/naming.md`; decision workflow stays as skill |
| 66 | `nextjs` | fail | 3 | 5 | **REMOVE** | Generic Next.js knowledge, model knows App Router/Server Components |
| 67 | `npm-packages` | fail | 3 | 5 | **REMOVE** | Generic npm package publishing, no project-specific patterns |
| 68 | `npm` | fail | 3 | 6 | **REMOVE** | Generic npm/build tooling knowledge, model already knows |
| 69 | `nuxt` | fail | 3 | 5 | **REMOVE** | Generic Nuxt knowledge, model already knows auto-imports/file-routing |
| 70 | `openapi` | fail | 3 | 5 | **KEEP** | Project-specific OpenAPI attribute patterns and versioning conventions |
| 71 | `override` | fail | 4 | 5 | **KEEP** | Essential infrastructure skill for project override mechanism |
| 72 | `performance-analysis` | fail | 2 | 6 | **KEEP** | Strong analysis workflow with structured output format |
| 73 | `performance` | fail | 3 | 5 | **SPLIT** | Overlap with `database` skill on eager loading; caching conventions → guideline |
| 74 | `pest-testing` | fail | 3 | 6 | **KEEP** | Essential testing skill with project-specific patterns (coduo/php-matcher, snapshots) |
| 75 | `php-debugging` | fail | 3 | 5 | **KEEP** | Project-specific dual-container Xdebug architecture reference |
| 76 | `php-service` | fail | 3 | 5 | **SPLIT** | Overlap with `service-layer.md` guideline; extract conventions → guideline; keep focused service creation procedure |
| 77 | `php` | fail | 3 | 5 | **REMOVE** | Generic PHP 8.2+ knowledge (strict types, match, enums, named args) — model already knows; overlap with `php-coding` rule |
| 78 | `playwright-testing` | fail | 3 | 5 | **KEEP** | Upgrade to template — clear test patterns with locator strategies, Page Objects, flaky test prevention; complements e2e rule |
| 79 | `post-task-learning-capture` | fail | 1 | 1 | **MERGE** | Heavy overlap with `learning-to-rule-or-skill`; merge unique "post-task reflection" trigger into that skill |
| 80 | `project-analysis-laravel` | fail | 2 | 6 | **MERGE** | Heavy overlap with `universal-project-analysis`; merge Laravel-specific sections (boot analysis, Eloquent, queues) into universal skill as a "Laravel mode" |
| 81 | `project-analyzer` | fail | 3 | 5 | **KEEP** | Upgrade to template — clear phased workflow for generating `agents/analysis/` docs; distinct from investigation skills |
| 82 | `project-docs` | fail | 3 | 6 | **KEEP** | Upgrade to template — essential doc discovery workflow; maps work areas to docs; distinct from `agent-docs-writing` |
| 83 | `quality-tools` | fail | 3 | 5 | **KEEP** | Upgrade to template — critical reference for all quality tool commands, flags, detection logic; complements `quality-workflow` rule |
| 84 | `react` | fail | 3 | 5 | **REMOVE** | Generic React knowledge (hooks, components, state) — model already knows; no project-specific patterns |
| 85 | `readme-generator` | fail | 1 | 4 | **REMOVE** | Too generic — model already knows how to write READMEs; no unique procedure beyond obvious steps |
| 86 | `refactorer` | fail | 3 | 5 | **KEEP** | Upgrade to template — strong procedural skill with downstream dependency tracking, test approval workflow, API layer checklist |
| 87 | `roadmap-manager` | fail | 3 | 5 | **KEEP** | Upgrade to template — clear roadmap CRUD workflow with checkpoint rules and template reference |
| 88 | `security-audit` | fail | 2 | 6 | **KEEP** | Upgrade to template — structured audit workflow with OWASP categories and evidence-based output format |
| 89 | `security` | fail | 3 | 5 | **SPLIT** | Mix of conventions (input validation, mass assignment, headers) and procedure; extract conventions → guideline `php/security.md`; keep auth/policy creation workflow |
| 90 | `sentry` | fail | 3 | 5 | **KEEP** | Upgrade to template — project-specific MCP tools, MonitoringHelper convention, investigation workflow |
| 91 | `sequential-thinking` | fail | 3 | 4 | **KEEP** | Upgrade to template — clear reasoning framework with revision tracking and branch exploration; distinct meta-skill |
| 92 | `skill-caveman-compression` | fail | 1 | 0 | **MERGE** | Merge into single `skill-management` skill — compression is one step of skill lifecycle, not standalone workflow |
| 93 | `skill-decompression` | fail | 1 | 0 | **MERGE** | Merge into single `skill-management` skill — decompression is one step of skill lifecycle |
| 94 | `skill-linter` | fail | 1 | 1 | **MERGE** | Merge into `skill-reviewer` — linting is a subset of skill review; heavy structural overlap |
| 95 | `skill-refactor` | fail | 1 | 2 | **MERGE** | Merge into single `skill-management` skill — refactoring is one step of skill lifecycle |
| 96 | `skill-reviewer` | fail | 5 | 6 | **KEEP** | Upgrade to template — 5 Killers checklist is unique and actionable; absorb `skill-linter` and `skill-validator` |
| 97 | `skill-validator` | fail | 1 | 3 | **MERGE** | Merge into `skill-reviewer` — validation is a subset of review; nearly identical checklist |
| 98 | `skill-writing` | fail | 1 | 0 | **KEEP** | Upgrade to template — clear skill creation workflow with quality checklist; distinct from review |
| 99 | `sql` | fail | 3 | 5 | **SPLIT** | Iron Law (parameterized queries) → `php-coding` rule or guideline; keep MariaDB-specific patterns and raw SQL reference |
| 100 | `tailwind` | fail | 3 | 5 | **REMOVE** | Generic Tailwind knowledge (class ordering, responsive, dark mode) — model already knows; no project-specific config |
| 101 | `technical-specification` | fail | 3 | 5 | **KEEP** | Upgrade to template — clear spec/ADR/RFC templates with writing guidelines; procedural document creation |
| 102 | `terraform` | fail | 3 | 5 | **KEEP** | Upgrade to template — project-specific conventions (naming, state, lifecycle, OIDC) for infrastructure repo |
| 103 | `terragrunt` | fail | 3 | 5 | **KEEP** | Upgrade to template — project-specific DRY config patterns, root.hcl conventions, dependency management |
| 104 | `test-generator` | fail | 3 | 5 | **MERGE** | Heavy overlap with `pest-testing`; merge unique generation workflow (what to test, data providers) into `pest-testing` |
| 105 | `test-performance` | fail | 4 | 5 | **KEEP** | Upgrade to template — specific optimization strategies (schema dump, template DB, bulk inserts) with ROI ordering |
| 106 | `traefik` | fail | 3 | 5 | **KEEP** | Upgrade to template — project-specific reverse proxy setup with cert strategies, Docker labels, multi-project routing |
| 107 | `typescript` | fail | 3 | 5 | **REMOVE** | Generic TypeScript knowledge (interfaces, generics, utility types) — model already knows; no project-specific patterns |
| 108 | `universal-project-analysis` | fail | 3 | 6 | **KEEP** | Upgrade to template — strong hypothesis-driven analysis framework; absorb Laravel-specific mode from `project-analysis-laravel` |
| 109 | `vue` | fail | 3 | 5 | **REMOVE** | Generic Vue 3 knowledge (Composition API, Pinia, composables) — model already knows; no project-specific patterns |
| 110 | `websocket` | fail | 3 | 5 | **SPLIT** | Overlap with `laravel-reverb`; extract Laravel Broadcasting conventions → existing skill; keep raw WebSocket patterns only if needed |
| 111 | `wordpress` | fail | 3 | 6 | **REMOVE** | Generic WordPress knowledge (hooks, filters, WooCommerce) — model already knows; no project-specific content |

## Classification Legend

| Code | Meaning | Action |
|---|---|---|
| RULE | Primarily constraints | Migrate to rules/ |
| KEEP | Good procedural workflow | Upgrade to template |
| SPLIT | Mix of rule + procedure | Extract rules, refine skill |
| MERGE | Overlaps another skill | Combine, delete redundant |
| NARROW | Too broad | Split into focused variants |
| REMOVE | Too generic | Delete |


## Summary Statistics

| Classification | Count | % |
|---|---|---|
| **KEEP** | 61 | 55% |
| **SPLIT** | 20 | 18% |
| **REMOVE** | 18 | 16% |
| **MERGE** | 10 | 9% |
| **NARROW** | 1 | 1% |
| **RULE** | 1 | 1% |
| **Total** | **111** | **100%** |

### Impact Summary

- **Skills after restructuring (estimated):** ~65 (61 KEEP + ~4 from SPLIT procedures)
- **Skills to remove:** 18 (generic framework knowledge the model already has) ✅ Done
- **Skills to merge:** 10 → ~4 target skills (reducing ~6 redundant skills) ✅ Done
- **Skills to split:** 20 (extract conventions → guidelines/rules, keep procedures) ✅ Done
- **Net reduction:** 111 → 83 skills (-25%), total lines -34% combined (skills + guidelines)

### Phase 3 Results: Quality Upgrade (83 skills)

**Completed.** All 83 remaining skills upgraded to standard template:
- **Do NOT sections:** Added to all 20 SPLIT skills
- **Procedure headings:** Added to 65 skills missing them
- **6 FAIL skills fixed:** Missing required sections added
- **Linter result:** 0 FAIL, 74 WARN, 9 PASS

### Phase 3 Results: SPLIT (20 skills)

**Completed.** All 20 SPLIT skills processed:
- **Skills trimmed to procedures:** 20 skills reduced from ~3750 → 1379 lines (-63%)
- **New guidelines created:** 12 files (1103 lines)
  - `api-design.md`, `artisan-commands.md`, `blade-ui.md`, `database.md`, `flux.md`
  - `livewire.md`, `logging.md`, `naming.md`, `performance.md`, `security.md`, `sql.md`, `websocket.md`
- **Existing guidelines extended:** `php.md` (JSON handling), `jobs.md` (events, serialization, idempotency), `validations.md` (custom rules, nested validation, API patterns)
- **Guidelines rule updated** with all 16 new entries

### Merge Targets

| Target Skill | Absorbs |
|---|---|
| `api-design` | `api-versioning` |
| `learning-to-rule-or-skill` | `post-task-learning-capture` |
| `universal-project-analysis` | `project-analysis-laravel` |
| `skill-reviewer` | `skill-linter`, `skill-validator` |
| `skill-management` (new) | `skill-caveman-compression`, `skill-decompression`, `skill-refactor` |
| `pest-testing` | `test-generator` |
| `markdown-safe-codeblocks` → rule | `markdown-template-generator` (partial) |

### REMOVE List (18 skills)

Generic framework knowledge — model already knows:

1. `cloudflare-workers` — CF Workers APIs
2. `composer` — basic Composer usage
3. `graphql` — GraphQL schema/resolvers
4. `guidelines` — meta-skill, rule handles discovery
5. `javascript` — ES2020+ syntax
6. `microservices` — patterns, boundaries
7. `mobile` — React Native/Swift
8. `nextjs` — App Router/Server Components
9. `npm-packages` — npm publishing
10. `npm` — build tooling
11. `nuxt` — auto-imports/file-routing
12. `php` — PHP 8.2+ features
13. `react` — hooks/components/state
14. `readme-generator` — README structure
15. `tailwind` — utility classes/responsive
16. `typescript` — interfaces/generics
17. `vue` — Composition API/Pinia
18. `wordpress` — hooks/filters/WooCommerce
