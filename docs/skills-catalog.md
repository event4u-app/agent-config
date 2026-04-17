# Skills Catalog

All **98 skills** available in this package, in alphabetical order.
Click a skill name to open its SKILL.md and read the full guidance.

> **Regenerate:** `python3 scripts/generate_catalog.py`
> This file is auto-generated from `SKILL.md` frontmatter — do not edit manually.

| Skill | What your agent learns |
|---|---|
| [`adversarial-review`](../.augment/skills/adversarial-review/SKILL.md) | ONLY when user explicitly requests: adversarial review, devil's advocate analysis, or critical challenge of a plan. NOT for regular code review. |
| [`agent-docs-writing`](../.augment/skills/agent-docs-writing/SKILL.md) | Use when reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md. Understands the full .augment/, agents/, and copilot-instructions structure. |
| [`analysis-autonomous-mode`](../.augment/skills/analysis-autonomous-mode/SKILL.md) | ONLY when user explicitly requests: autonomous analysis, deep investigation, or multi-step research workflow. NOT for regular tasks. |
| [`analysis-skill-router`](../.augment/skills/analysis-skill-router/SKILL.md) | Use when deciding which analysis skill should handle a request. Routes by scope, framework, and problem shape. |
| [`api-design`](../.augment/skills/api-design/SKILL.md) | Use when designing a new API, planning endpoints, discussing REST conventions, adding API versions, or managing deprecation. |
| [`api-endpoint`](../.augment/skills/api-endpoint/SKILL.md) | Use when the user says "create endpoint", "new API route", or "add controller". Creates a complete endpoint with Controller, FormRequest, Resource, route, and OpenAPI docs. |
| [`api-testing`](../.augment/skills/api-testing/SKILL.md) | Use when writing tests for API endpoints — integration tests, contract validation, response structure verification, and mocked external services. |
| [`artisan-commands`](../.augment/skills/artisan-commands/SKILL.md) | Use when creating or modifying Artisan commands. Covers clear signatures, safe execution flow, helpful output, and project conventions for console tooling. |
| [`aws-infrastructure`](../.augment/skills/aws-infrastructure/SKILL.md) | Use when working with AWS resources — ECS Fargate, ECR, EFS, Secrets Manager, gomplate templates, or multi-environment deployment setup. |
| [`blade-ui`](../.augment/skills/blade-ui/SKILL.md) | Use when creating or editing Blade views, components, partials, or view logic. Covers clean separation of concerns and reusable UI structure. |
| [`bug-analyzer`](../.augment/skills/bug-analyzer/SKILL.md) | Use when the user shares a Sentry error, Jira bug ticket, or error description and wants root cause analysis. Also for proactive bug hunting and code audits for hidden bugs. |
| [`code-refactoring`](../.augment/skills/code-refactoring/SKILL.md) | Use when the user says "refactor this", "rename class", or "move method". Safely refactors PHP code — finds all callers, updates downstream dependencies, and verifies with quality tools. |
| [`code-review`](../.augment/skills/code-review/SKILL.md) | Use when the user says "review this", "check my code", or wants feedback on changes. Reviews for correctness, quality, security, and coding standards. |
| [`command-routing`](../.augment/skills/command-routing/SKILL.md) | Use when the user types a slash command like '/create-pr' or '/commit'. Extends the commands rule with context inference and GitHub API patterns. |
| [`composer-packages`](../.augment/skills/composer-packages/SKILL.md) | Use when developing or maintaining a Composer library package — versioning, Laravel integration, autoloading, and publishing to private registries. |
| [`context-document`](../.augment/skills/context-document/SKILL.md) | Use when the user says "create context", "document this area", or wants a structured snapshot of a codebase area for agent orientation. |
| [`conventional-commits-writing`](../.augment/skills/conventional-commits-writing/SKILL.md) | Use when generating, reviewing, or correcting Conventional Commit messages or squash merge titles. |
| [`copilot-agents-optimization`](../.augment/skills/copilot-agents-optimization/SKILL.md) | Use when optimizing AGENTS.md or copilot-instructions.md — deduplicates against .augment/ content, enforces line budgets, and focuses each file on its audience. |
| [`copilot-config`](../.augment/skills/copilot-config/SKILL.md) | Use when configuring GitHub Copilot behavior, managing copilot-instructions.md, PR review patterns, or optimizing Copilot output for the project. |
| [`dashboard-design`](../.augment/skills/dashboard-design/SKILL.md) | Use when designing monitoring dashboards — visualization selection, layout principles, observability strategies (RED/USE/Golden Signals), and data storytelling. |
| [`database`](../.augment/skills/database/SKILL.md) | Use when working with database architecture, MariaDB optimization, indexing strategies, query performance, or multi-connection patterns. |
| [`dependency-upgrade`](../.augment/skills/dependency-upgrade/SKILL.md) | Use when upgrading dependencies — "update Laravel", "bump PHP version", or "upgrade packages". Covers changelog review, breaking change detection, and verification. |
| [`design-review`](../.augment/skills/design-review/SKILL.md) | Use when the user says "review the design", "check the UI", or wants a comprehensive UI/UX review. Uses a 7-phase methodology covering interaction, responsiveness, accessibility, and more. |
| [`devcontainer`](../.augment/skills/devcontainer/SKILL.md) | Use when setting up or modifying DevContainers, GitHub Codespaces, custom images, secrets management, or workspace configuration. |
| [`developer-like-execution`](../.augment/skills/developer-like-execution/SKILL.md) | Use when implementing, debugging, refactoring, or reviewing code, skills, rules, or configs. Enforces think → analyze → verify → execute workflow. |
| [`docker`](../.augment/skills/docker/SKILL.md) | Use when working with Docker — Dockerfile changes, docker-compose services, container management, or the dual-container architecture (fast + Xdebug). |
| [`dto-creator`](../.augment/skills/dto-creator/SKILL.md) | Use when the user says "create a DTO", "new data transfer object", or needs to convert request/response data into a typed PHP class. Creates DTOs with SimpleDto base class and attribute mapping. |
| [`eloquent`](../.augment/skills/eloquent/SKILL.md) | Use when writing Eloquent models, relationships, scopes, queries, or database interactions. Covers eager loading, type safety, getter/setter conventions, and performance. |
| [`fe-design`](../.augment/skills/fe-design/SKILL.md) | Use when designing frontend interfaces — component architecture, layout patterns, form design, table patterns, responsive strategies, and UX principles for Blade/Livewire/Flux/Tailwind. |
| [`feature-planning`](../.augment/skills/feature-planning/SKILL.md) | Use when the user says "plan a feature", "brainstorm", "explore this idea", or wants to go from idea to structured plan and roadmap. |
| [`file-editor`](../.augment/skills/file-editor/SKILL.md) | Use when opening edited files in the user's IDE. Reads settings from .agent-settings to determine IDE and whether auto-open is enabled. |
| [`flux`](../.augment/skills/flux/SKILL.md) | Use when writing Laravel Flux UI components — the official Livewire component library by the Laravel team. Covers components, slots, and variants. |
| [`git-workflow`](../.augment/skills/git-workflow/SKILL.md) | Use when working with Git — branch naming, commit messages, PR conventions, rebasing, or the code review process. |
| [`github-ci`](../.augment/skills/github-ci/SKILL.md) | Use when working with GitHub Actions CI/CD — quality checks, test workflows, deployment triggers, or reusable workflow modules. |
| [`grafana`](../.augment/skills/grafana/SKILL.md) | Use when creating Grafana dashboards, writing Loki log queries, configuring alerting rules, or building monitoring panels. |
| [`jira-integration`](../.augment/skills/jira-integration/SKILL.md) | Use when the user says "check Jira", "create ticket", "update issue", or needs JQL queries, ticket transitions, or branch-to-ticket linking. |
| [`jobs-events`](../.augment/skills/jobs-events/SKILL.md) | Use when creating Laravel jobs, queued workflows, events, or listeners. Covers clear responsibilities, safe serialization, and retry/failure handling. |
| [`laravel`](../.augment/skills/laravel/SKILL.md) | Writes Laravel code following framework conventions, project architecture, and modern best practices for controllers, requests, services, jobs, events, policies, and application structure. |
| [`laravel-horizon`](../.augment/skills/laravel-horizon/SKILL.md) | Use when configuring Laravel Horizon — queue dashboard, worker supervision, job metrics, balancing strategies, or production tuning. |
| [`laravel-mail`](../.augment/skills/laravel-mail/SKILL.md) | Use when creating Laravel Mailables — templates, Markdown emails, queued sending, attachments, or mail testing. |
| [`laravel-middleware`](../.augment/skills/laravel-middleware/SKILL.md) | Use when creating or modifying Laravel middleware — request/response filtering, groups, priority, terminable middleware, or route-level assignment. |
| [`laravel-notifications`](../.augment/skills/laravel-notifications/SKILL.md) | Use when sending notifications via mail, Slack, database, or custom channels — with queuing, on-demand recipients, and notification preferences. |
| [`laravel-pennant`](../.augment/skills/laravel-pennant/SKILL.md) | Use when managing feature flags with Laravel Pennant — gradual rollouts, A/B testing, scope-based flags, or database/array drivers. |
| [`laravel-pulse`](../.augment/skills/laravel-pulse/SKILL.md) | Use when setting up Laravel Pulse monitoring — real-time dashboard, built-in cards, custom recorders, or performance insights. |
| [`laravel-reverb`](../.augment/skills/laravel-reverb/SKILL.md) | Use when configuring Laravel Reverb — the first-party WebSocket server with Pusher protocol compatibility, horizontal scaling, and Pulse monitoring. |
| [`laravel-scheduling`](../.augment/skills/laravel-scheduling/SKILL.md) | Use when configuring Laravel task scheduling — cron expressions, frequency helpers, overlap prevention, maintenance mode, or output handling. |
| [`laravel-validation`](../.augment/skills/laravel-validation/SKILL.md) | Use when writing validation logic — Form Requests, rules, custom rule objects, and request-boundary design with strong correctness. |
| [`learning-to-rule-or-skill`](../.augment/skills/learning-to-rule-or-skill/SKILL.md) | Use when a repeated learning, mistake, or successful pattern should be turned into a new rule or skill. Also use after completing a task to capture learnings from the work. |
| [`livewire`](../.augment/skills/livewire/SKILL.md) | Use when writing Livewire components — reactive state, events, lifecycle hooks, and clean separation between component logic and Blade templates. |
| [`logging-monitoring`](../.augment/skills/logging-monitoring/SKILL.md) | Use when working with logging or monitoring — Sentry error tracking, Grafana/Loki log aggregation, structured logging channels, or monitoring helpers. |
| [`mcp`](../.augment/skills/mcp/SKILL.md) | Use when working with MCP (Model Context Protocol) servers — their tools, capabilities, and best practices for effective agent workflows. |
| [`merge-conflicts`](../.augment/skills/merge-conflicts/SKILL.md) | Use when the user has merge conflicts or says "resolve conflicts". Understands conflict markers, resolution strategies, and verification workflow. |
| [`migration-creator`](../.augment/skills/migration-creator/SKILL.md) | Use when the user says "create migration", "add column", or "new table". Creates migrations with correct table prefixes, column naming, and multi-tenant awareness. |
| [`module-management`](../.augment/skills/module-management/SKILL.md) | Use when the user says "create module", "explore module", or works within app/Modules/. Understands module structure, auto-loading, route registration, and namespace conventions. |
| [`multi-tenancy`](../.augment/skills/multi-tenancy/SKILL.md) | Use when working with the multi-tenant architecture — customer DB switching, FQDN routing, tenant isolation, or cross-tenant operations. |
| [`openapi`](../.augment/skills/openapi/SKILL.md) | Use when writing OpenAPI/Swagger documentation — PHP attributes, project annotation patterns, or spec validation with Redocly. |
| [`override-management`](../.augment/skills/override-management/SKILL.md) | Creates and manages project-level overrides for shared skills, rules, and commands — extending or replacing originals from .augment/ with project-specific behavior in agents/overrides/. |
| [`performance`](../.augment/skills/performance/SKILL.md) | Use when optimizing application performance — caching strategies, eager loading, query optimization, Redis patterns, or background job design. |
| [`performance-analysis`](../.augment/skills/performance-analysis/SKILL.md) | ONLY when user explicitly requests: performance audit, bottleneck analysis, or N+1 query detection. NOT for regular feature work. |
| [`pest-testing`](../.augment/skills/pest-testing/SKILL.md) | Use when writing, generating, or improving Pest tests for Laravel — clear intent, good coverage, maintainable structure, and alignment with project testing conventions. |
| [`php-coder`](../.augment/skills/php-coder/SKILL.md) | Writes PHP code following project coding guidelines, SOLID principles, modern PHP best practices, and established patterns — for both legacy and Laravel projects. |
| [`php-debugging`](../.augment/skills/php-debugging/SKILL.md) | Use when debugging PHP with Xdebug — dual-container architecture, IDE configuration, header-based routing, or debugging workflows. |
| [`php-service`](../.augment/skills/php-service/SKILL.md) | Use when the user says 'create service', 'new service class', or needs a PHP service following SOLID principles with proper DI and repository usage. |
| [`playwright-testing`](../.augment/skills/playwright-testing/SKILL.md) | Use when writing Playwright E2E tests — browser automation, visual regression testing, Page Objects, fixtures, and reliable test patterns. |
| [`project-analysis-core`](../.augment/skills/project-analysis-core/SKILL.md) | Use for the universal deep-analysis workflow: project discovery, version resolution, docs loading, architecture mapping, execution flow, and package research. |
| [`project-analysis-hypothesis-driven`](../.augment/skills/project-analysis-hypothesis-driven/SKILL.md) | Use for deep root-cause analysis with multiple competing hypotheses, validation loops, and evidence-based conclusions. |
| [`project-analysis-laravel`](../.augment/skills/project-analysis-laravel/SKILL.md) | Use for deep Laravel project analysis: boot flow, request lifecycle, container usage, Eloquent/data flow, async systems, and Laravel-specific failure patterns. |
| [`project-analysis-nextjs`](../.augment/skills/project-analysis-nextjs/SKILL.md) | Use for deep Next.js analysis: server vs client boundaries, routing, data fetching, caching, rendering modes, and hydration/runtime issues. |
| [`project-analysis-node-express`](../.augment/skills/project-analysis-node-express/SKILL.md) | Use for deep Node.js / Express project analysis: boot flow, middleware order, async behavior, data layer, auth/security, and Node-specific runtime failure patterns. |
| [`project-analysis-react`](../.augment/skills/project-analysis-react/SKILL.md) | Use for deep React analysis: component tree, state flow, props flow, hooks usage, rendering behavior, and React-specific failure patterns. |
| [`project-analysis-symfony`](../.augment/skills/project-analysis-symfony/SKILL.md) | Use for deep Symfony project analysis: kernel/bootstrap, container wiring, routing/request flow, Doctrine, security, Messenger, and Symfony-specific failure patterns. |
| [`project-analysis-zend-laminas`](../.augment/skills/project-analysis-zend-laminas/SKILL.md) | Use for deep Zend Framework or Laminas project analysis: bootstrap, config merge order, service manager, MVC flow, data layer, and migration-specific risks. |
| [`project-analyzer`](../.augment/skills/project-analyzer/SKILL.md) | ONLY when user explicitly requests: full project analysis, tech stack detection, or structured analysis documents for agents/analysis/. NOT for regular feature work. |
| [`project-docs`](../.augment/skills/project-docs/SKILL.md) | Use when looking for project-specific documentation. Knows which docs exist in agents/docs/ and agents/contexts/ and maps work areas to relevant docs. |
| [`quality-tools`](../.augment/skills/quality-tools/SKILL.md) | Use when running code quality checks — \"run PHPStan\", \"fix code style\", \"run Rector\". Knows all commands, parameters, execution rules, and language detection for PHP and JS/TS. |
| [`readme-reviewer`](../.augment/skills/readme-reviewer/SKILL.md) | Use when reviewing a README for accuracy, usability, and alignment with the actual repository. Detects invented content, broken setup steps, and structural issues. |
| [`readme-writing`](../.augment/skills/readme-writing/SKILL.md) | Use when creating, rewriting, or significantly improving a README based on the actual repository structure, commands, and intended audience. |
| [`readme-writing-package`](../.augment/skills/readme-writing-package/SKILL.md) | Use when creating or rewriting a README for a reusable package or library. Focus on installability, minimal usage example, compatibility, and developer onboarding. |
| [`roadmap-management`](../.augment/skills/roadmap-management/SKILL.md) | Use when the user says "create roadmap", "show roadmap", or "execute roadmap". Creates, reads, and manages roadmap files with phase tracking. |
| [`rtk-output-filtering`](../.augment/skills/rtk-output-filtering/SKILL.md) | Use when running verbose CLI commands — wraps them with rtk (Rust Token Killer) for 60-90% token savings. Covers installation, configuration, and usage patterns. |
| [`security`](../.augment/skills/security/SKILL.md) | Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding. |
| [`security-audit`](../.augment/skills/security-audit/SKILL.md) | ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work. |
| [`sentry-integration`](../.augment/skills/sentry-integration/SKILL.md) | Use when the user shares a Sentry URL, says "check Sentry", or wants to investigate production errors. Uses Sentry MCP tools for deep analysis. |
| [`sequential-thinking`](../.augment/skills/sequential-thinking/SKILL.md) | ONLY when user explicitly requests: step-by-step reasoning, structured problem decomposition, or iterative analysis. NOT for regular coding tasks. |
| [`skill-improvement-pipeline`](../.augment/skills/skill-improvement-pipeline/SKILL.md) | ONLY when user explicitly requests: run the skill improvement pipeline after a learning was detected. Orchestrates capture, classify, create, validate, and apply. |
| [`skill-management`](../.augment/skills/skill-management/SKILL.md) | Use when compressing, decompressing, refactoring, or improving existing skills. Covers the full skill lifecycle from verbose → sharp → maintained. |
| [`skill-reviewer`](../.augment/skills/skill-reviewer/SKILL.md) | Use when reviewing, auditing, or optimizing skills — validates against the 7 Skill Killers checklist and produces fix recommendations. |
| [`skill-writing`](../.augment/skills/skill-writing/SKILL.md) | Use when creating or improving agent skills. Covers structure, quality checklist, and best practices. |
| [`sql-writing`](../.augment/skills/sql-writing/SKILL.md) | Use when writing raw SQL — MariaDB/MySQL syntax, parameterization, or preventing common mistakes like PHP notation in SQL. |
| [`technical-specification`](../.augment/skills/technical-specification/SKILL.md) | Use when the user says "write a spec", "create RFC", or "document this decision". Writes technical specifications, RFCs, and ADRs with clear structure. |
| [`terraform`](../.augment/skills/terraform/SKILL.md) | Use when writing Terraform configurations — AWS modules, resources, variables, outputs, state management, and project conventions. |
| [`terragrunt`](../.augment/skills/terragrunt/SKILL.md) | Use when writing Terragrunt configurations — DRY multi-environment configs, dependency management, and remote state orchestration. |
| [`test-performance`](../.augment/skills/test-performance/SKILL.md) | Use when optimizing test suite performance — database setup, seeder optimization, parallel testing, CI pipeline efficiency, or RefreshDatabase alternatives. |
| [`traefik`](../.augment/skills/traefik/SKILL.md) | Use when setting up Traefik as a local reverse proxy — real domains on 127.0.0.1, trusted HTTPS via mkcert, automatic service discovery, and multi-project routing. |
| [`universal-project-analysis`](../.augment/skills/universal-project-analysis/SKILL.md) | ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. Routes to core and framework-specific analysis skills. |
| [`upstream-contribute`](../.augment/skills/upstream-contribute/SKILL.md) | Use when a learning, new skill, rule improvement, or bug fix from a consumer project should be contributed back to the shared agent-config package. |
| [`"validate-feature-fit"`](../.augment/skills/"validate-feature-fit"/SKILL.md) | Validate whether a feature request fits the existing codebase — check for duplicates, contradictions, scope creep, and architectural misfit |
| [`websocket`](../.augment/skills/websocket/SKILL.md) | Use when implementing WebSocket communication, real-time features, broadcasting patterns, or connection management. |

---

← [Back to README](../README.md)
