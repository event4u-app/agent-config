# agent-config — Public Catalog

Consumer-facing catalog of all **299 public artefacts** shipped by
this package. Internal package-maintenance rules and deprecation shims
are excluded.

> **Regenerate:** `python3 scripts/generate_index.py`
> Auto-generated — do not edit manually.

## Skills (129)

| kind | name | extra | description |
|---|---|---|---|
| skill | [`adversarial-review`](../.agent-src/skills/adversarial-review/SKILL.md) |  | ONLY when user explicitly requests adversarial review, devil's advocate analysis, stress-testing a plan, or 'poke holes in this' — NOT for regular code review or design feedback. |
| skill | [`agent-docs-writing`](../.agent-src/skills/agent-docs-writing/SKILL.md) |  | Use when reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md. Understands the full .augment/, agents/, and copilot-instructions structure. |
| skill | [`ai-council`](../.agent-src/skills/ai-council/SKILL.md) |  | Use when polling external AIs (OpenAI, Anthropic) outside the host session for a neutral second opinion on a roadmap, diff, prompt, or file set — or 'cross-check with another model'. |
| skill | [`analysis-autonomous-mode`](../.agent-src/skills/analysis-autonomous-mode/SKILL.md) |  | ONLY when user explicitly requests autonomous analysis, deep investigation, multi-step research, or 'dig into this end-to-end without asking me each step' — NOT for normal feature work. |
| skill | [`analysis-skill-router`](../.agent-src/skills/analysis-skill-router/SKILL.md) |  | Use when picking which analysis or project-analysis-* skill fits a request — routes by scope, framework, and symptom — even if the user just says 'analyze this' or 'dig into the codebase'. |
| skill | [`api-design`](../.agent-src/skills/api-design/SKILL.md) |  | Use when designing APIs, planning endpoints, REST conventions, versioning, or deprecation — even when the user just says 'expose this as an endpoint' without naming API design. |
| skill | [`api-endpoint`](../.agent-src/skills/api-endpoint/SKILL.md) |  | Use when the user says "create endpoint", "new API route", or "add controller". Creates a complete endpoint with Controller, FormRequest, Resource, route, and OpenAPI docs. |
| skill | [`api-testing`](../.agent-src/skills/api-testing/SKILL.md) |  | Use when writing API endpoint tests — integration tests, contract validation, response assertions, mocked external services — even when the user says 'test this route' without naming API testing. |
| skill | [`artisan-commands`](../.agent-src/skills/artisan-commands/SKILL.md) |  | Use when creating or modifying Artisan commands. Covers clear signatures, safe execution flow, helpful output, and project conventions for console tooling. |
| skill | [`authz-review`](../.agent-src/skills/authz-review/SKILL.md) |  | Use when reviewing authorization end-to-end — route → gate → policy → query scope → response filter — before changes to permissions, tenants, ownership, or admin flows. |
| skill | [`aws-infrastructure`](../.agent-src/skills/aws-infrastructure/SKILL.md) |  | Use when working with AWS resources — ECS Fargate, ECR, EFS, Secrets Manager, gomplate templates, multi-env deployments — even when the user says 'deploy to staging' without naming AWS. |
| skill | [`blade-ui`](../.agent-src/skills/blade-ui/SKILL.md) |  | Use when the project's frontend stack is Blade — dispatched by `directives/ui/{apply,review,polish}.py`. Covers views, components, partials, layouts, and view logic. |
| skill | [`blast-radius-analyzer`](../.agent-src/skills/blast-radius-analyzer/SKILL.md) |  | Use BEFORE editing shared code — enumerates every call site, event consumer, queue worker, API client, migration, and test that a planned change will touch, with a file:line citation per dependency. |
| skill | [`bug-analyzer`](../.agent-src/skills/bug-analyzer/SKILL.md) |  | Use when the user shares a Sentry error, Jira bug ticket, or error description and wants root cause analysis. Also for proactive bug hunting and code audits for hidden bugs. |
| skill | [`check-refs`](../.agent-src/skills/check-refs/SKILL.md) |  | Use when verifying cross-references between skills, rules, commands, guidelines, and context documents are not broken after edits, renames, or deletions. |
| skill | [`code-refactoring`](../.agent-src/skills/code-refactoring/SKILL.md) |  | Use when the user says "refactor this", "rename class", or "move method". Safely refactors PHP code — finds all callers, updates downstream dependencies, and verifies with quality tools. |
| skill | [`code-review`](../.agent-src/skills/code-review/SKILL.md) |  | Use when the user says "review this", "check my code", or wants feedback on changes. Reviews for correctness, quality, security, and coding standards. |
| skill | [`command-routing`](../.agent-src/skills/command-routing/SKILL.md) |  | Use when the user invokes a slash command like /create-pr, /commit, /fix-ci, or pastes command file content — routes to the right command with context inference and GitHub API patterns. |
| skill | [`command-writing`](../.agent-src/skills/command-writing/SKILL.md) |  | Use when creating or editing a slash command in .agent-src.uncompressed/commands/ — frontmatter, numbered steps, safety gates — even when the user just says 'add a /command for X'. |
| skill | [`composer-packages`](../.agent-src/skills/composer-packages/SKILL.md) |  | Use when building or maintaining a Composer library — versioning, Laravel integration, autoloading, publishing to private registries — even when the user says 'release a new version'. |
| skill | [`context-authoring`](../.agent-src/skills/context-authoring/SKILL.md) |  | Use when filling in knowledge-layer context files — auth-model, tenant-boundaries, data-sensitivity, deployment-order, observability — interactive walkthrough that turns templates into reviewer fuel. |
| skill | [`context-document`](../.agent-src/skills/context-document/SKILL.md) |  | Use when the user says "create context", "document this area", or wants a structured snapshot of a codebase area for agent orientation. |
| skill | [`conventional-commits-writing`](../.agent-src/skills/conventional-commits-writing/SKILL.md) |  | Use when writing commit messages or squash-merge titles — `feat:`, `fix:`, `chore:`, scopes, breaking changes — even when the user just says 'commit this' without naming Conventional Commits. |
| skill | [`copilot-agents-optimization`](../.agent-src/skills/copilot-agents-optimization/SKILL.md) |  | Use when optimizing AGENTS.md or copilot-instructions.md — deduplicates against .augment/ content, enforces line budgets, and focuses each file on its audience. |
| skill | [`copilot-config`](../.agent-src/skills/copilot-config/SKILL.md) |  | Use when configuring GitHub Copilot — copilot-instructions.md, PR review patterns, output optimization — even when the user just says 'tune Copilot' or 'why is Copilot commenting on X'. |
| skill | [`dashboard-design`](../.agent-src/skills/dashboard-design/SKILL.md) |  | Use when designing monitoring dashboards — visualization selection, layout principles, observability strategies (RED/USE/Golden Signals), and data storytelling. |
| skill | [`data-flow-mapper`](../.agent-src/skills/data-flow-mapper/SKILL.md) |  | Use BEFORE editing code that touches user data — traces the value from entry → validation → transformation → storage → egress, every hop cited with file:line. |
| skill | [`database`](../.agent-src/skills/database/SKILL.md) |  | Use when working with database architecture, MariaDB/MySQL tuning, indexing strategies, slow queries, or multi-connection patterns — even when the user just says 'this query is slow'. |
| skill | [`dependency-upgrade`](../.agent-src/skills/dependency-upgrade/SKILL.md) |  | Use when upgrading dependencies — "update Laravel", "bump PHP version", or "upgrade packages". Covers changelog review, breaking change detection, and verification. |
| skill | [`description-assist`](../.agent-src/skills/description-assist/SKILL.md) |  | Use when polishing a skill/rule/command/guideline frontmatter description — pushier phrasing, trigger coverage, undertrigger audit — even if the user just says 'make this pushier'. |
| skill | [`design-review`](../.agent-src/skills/design-review/SKILL.md) |  | Use when the user says "review the design", "check the UI", or wants a comprehensive UI/UX review. Uses a 7-phase methodology covering interaction, responsiveness, accessibility, and more. |
| skill | [`devcontainer`](../.agent-src/skills/devcontainer/SKILL.md) |  | Use when configuring DevContainers or GitHub Codespaces — devcontainer.json, custom images, secrets, VS Code features — even when the user just says 'why does my Codespace not start'. |
| skill | [`developer-like-execution`](../.agent-src/skills/developer-like-execution/SKILL.md) |  | Use when implementing, debugging, refactoring, or reviewing code — enforces the think → analyze → verify → execute workflow — even when the user just says 'implement X' without naming it. |
| skill | [`docker`](../.agent-src/skills/docker/SKILL.md) |  | Use when working with Docker — Dockerfile edits, docker-compose services, containers, or the dual-container (fast + Xdebug) setup — even when the user just says 'my container won't start'. |
| skill | [`dto-creator`](../.agent-src/skills/dto-creator/SKILL.md) |  | Use when the user says "create a DTO", "new data transfer object", or needs to convert request/response data into a typed PHP class. Creates DTOs with SimpleDto base class and attribute mapping. |
| skill | [`eloquent`](../.agent-src/skills/eloquent/SKILL.md) |  | Use when writing Eloquent models, relationships, scopes, or queries via Model:: — 'fetch users with their orders'. NOT for PHPStan output, non-Eloquent services, or raw SQL questions. |
| skill | [`estimate-ticket`](../.agent-src/skills/estimate-ticket/SKILL.md) |  | Estimate a Jira/Linear ticket — 'estimate PROJ-123', 'wie groß ist das?', 'should we split this?' — size + risk + split + uncertainty, sibling of /refine-ticket, close-prompt. |
| skill | [`existing-ui-audit`](../.agent-src/skills/existing-ui-audit/SKILL.md) |  | Use BEFORE writing or editing any non-trivial UI — inventories components, design tokens, shadcn primitives, and reusable patterns into state.ui_audit. Hard gate for the ui directive set. |
| skill | [`fe-design`](../.agent-src/skills/fe-design/SKILL.md) |  | Reference for frontend-design heuristics — component architecture, layout patterns, form/table design, responsive strategy, a11y, UX principles. Stack-agnostic; cited by directives/ui/design.py. |
| skill | [`feature-planning`](../.agent-src/skills/feature-planning/SKILL.md) |  | Use when the user says "plan a feature", "brainstorm", "explore this idea", or wants to go from idea to structured plan and roadmap. |
| skill | [`file-editor`](../.agent-src/skills/file-editor/SKILL.md) |  | Use when opening edited files in the user's IDE. Reads settings from .agent-settings.yml to determine IDE and whether auto-open is enabled. |
| skill | [`finishing-a-development-branch`](../.agent-src/skills/finishing-a-development-branch/SKILL.md) |  | Use when the feature is implementation-complete and the next step is 'ship it' — verifies, cleans up, and routes to merge/PR/park/discard — even when the user just says 'I'm done, what now?'. |
| skill | [`flux`](../.agent-src/skills/flux/SKILL.md) |  | Use when the project uses `livewire/flux` — dispatched by `directives/ui/{apply,review,polish}.py`. Covers Flux components, slots, variants, and form primitives. |
| skill | [`git-workflow`](../.agent-src/skills/git-workflow/SKILL.md) |  | Use when working with Git — branch naming, commit messages, PR creation, rebasing, or the code review process — even when the user says 'push this' or 'merge the branch' without naming Git. |
| skill | [`github-ci`](../.agent-src/skills/github-ci/SKILL.md) |  | Use when working with GitHub Actions — workflow YAML, quality gates, test matrices, deployment triggers, reusable workflows — even when the user just says 'my CI is failing' or 'add a check'. |
| skill | [`grafana`](../.agent-src/skills/grafana/SKILL.md) |  | Use when working with Grafana — dashboards, Loki LogQL queries, alerting rules, monitoring panels — even when the user just says 'build me a dashboard' or 'query the logs' without naming Grafana. |
| skill | [`guideline-writing`](../.agent-src/skills/guideline-writing/SKILL.md) |  | Use when creating or editing a guideline in docs/guidelines/ — reference material cited by skills, no auto-triggers — even when the user just says 'write up our naming conventions'. |
| skill | [`jira-integration`](../.agent-src/skills/jira-integration/SKILL.md) |  | Use when the user says "check Jira", "create ticket", "update issue", or needs JQL queries, ticket transitions, or branch-to-ticket linking. |
| skill | [`jobs-events`](../.agent-src/skills/jobs-events/SKILL.md) |  | Use when creating Laravel jobs, queued workflows, events, or listeners. Covers clear responsibilities, safe serialization, and retry/failure handling. |
| skill | [`judge-bug-hunter`](../.agent-src/skills/judge-bug-hunter/SKILL.md) |  | Use when a diff needs correctness review — null-safety, edge cases, off-by-one, races, error handling — dispatched by /review-changes, /do-and-judge, /judge, even without 'judge'. |
| skill | [`judge-code-quality`](../.agent-src/skills/judge-code-quality/SKILL.md) |  | Use when a diff needs a readability review — naming, single-responsibility, DRY, dead code, mismatch with codebase conventions — dispatched by /review-changes, /do-and-judge, /judge. |
| skill | [`judge-security-auditor`](../.agent-src/skills/judge-security-auditor/SKILL.md) |  | Use when a diff may introduce security risk — authZ, injection, secrets, unsafe deserialization, SSRF, XSS, mass assignment — dispatched by /review-changes, /do-and-judge, /judge. |
| skill | [`judge-test-coverage`](../.agent-src/skills/judge-test-coverage/SKILL.md) |  | Use when a diff may lack tests — missing assertions, uncovered branches, over-mocking, no regression test for a bug fix — dispatched by /review-changes, /do-and-judge, /judge, even without 'tests'. |
| skill | [`laravel`](../.agent-src/skills/laravel/SKILL.md) |  | Writes Laravel code following framework conventions, project architecture, and modern best practices for controllers, requests, services, jobs, events, policies, and application structure. |
| skill | [`laravel-horizon`](../.agent-src/skills/laravel-horizon/SKILL.md) |  | Use when working with Laravel queues in production — Horizon dashboard, worker supervision, job metrics, balancing strategies — even when the user just says 'my jobs are piling up'. |
| skill | [`laravel-mail`](../.agent-src/skills/laravel-mail/SKILL.md) |  | Use when building Laravel emails — Mailables, Markdown templates, queued sending, attachments, previews — even when the user says 'send this as an email' without naming Mailables. |
| skill | [`laravel-middleware`](../.agent-src/skills/laravel-middleware/SKILL.md) |  | Use when creating or modifying Laravel middleware — request/response filtering, groups, priority, terminable middleware, or route-level assignment. |
| skill | [`laravel-notifications`](../.agent-src/skills/laravel-notifications/SKILL.md) |  | Use when sending notifications via mail, Slack, database, or custom channels — with queuing, on-demand recipients, and notification preferences. |
| skill | [`laravel-pennant`](../.agent-src/skills/laravel-pennant/SKILL.md) |  | Use when working with feature flags — Laravel Pennant, gradual rollouts, A/B testing, scope-based flags — even when the user just says 'hide this behind a flag' without naming Pennant. |
| skill | [`laravel-pulse`](../.agent-src/skills/laravel-pulse/SKILL.md) |  | Use when setting up Laravel Pulse — real-time dashboard, built-in cards, custom recorders, performance insights — even when the user just says 'I need app monitoring' without naming Pulse. |
| skill | [`laravel-reverb`](../.agent-src/skills/laravel-reverb/SKILL.md) |  | Use when configuring Laravel Reverb — the first-party WebSocket server with Pusher protocol compatibility, horizontal scaling, and Pulse monitoring. |
| skill | [`laravel-scheduling`](../.agent-src/skills/laravel-scheduling/SKILL.md) |  | Use when configuring Laravel task scheduling — cron expressions, frequency helpers, overlap prevention, maintenance mode, or output handling. |
| skill | [`laravel-validation`](../.agent-src/skills/laravel-validation/SKILL.md) |  | Use when writing validation — Form Requests, rules, custom rule objects, request-boundary design — even when the user just says 'validate this input' or 'check the request' without naming it. |
| skill | [`learning-to-rule-or-skill`](../.agent-src/skills/learning-to-rule-or-skill/SKILL.md) |  | Use when a repeated learning, mistake, or successful pattern should be turned into a new rule or skill. Also use after completing a task to capture learnings from the work. |
| skill | [`lint-skills`](../.agent-src/skills/lint-skills/SKILL.md) |  | Use when running the package's skill linter against all skills and rules to validate frontmatter, required sections, and execution metadata. |
| skill | [`livewire`](../.agent-src/skills/livewire/SKILL.md) |  | Use when the project's frontend stack is Livewire — dispatched by `directives/ui/{apply,review,polish}.py`. Covers reactive state, events, lifecycle hooks, and component/view separation. |
| skill | [`logging-monitoring`](../.agent-src/skills/logging-monitoring/SKILL.md) |  | Use when working with logging or monitoring — Sentry error tracking, Grafana/Loki log aggregation, structured logging channels, or monitoring helpers. |
| skill | [`mcp`](../.agent-src/skills/mcp/SKILL.md) |  | Use when working with MCP (Model Context Protocol) servers — their tools, capabilities, and best practices for effective agent workflows. |
| skill | [`md-language-check`](../.agent-src/skills/md-language-check/SKILL.md) |  | Use BEFORE saving any .md under .augment/, .agent-src*/, or agents/ — scans umlauts, German function words, and quoted German phrases outside DE:/EN: anchor blocks. Hard gate per language-and-tone. |
| skill | [`merge-conflicts`](../.agent-src/skills/merge-conflicts/SKILL.md) |  | Use when the user has merge conflicts or says "resolve conflicts". Understands conflict markers, resolution strategies, and verification workflow. |
| skill | [`migration-creator`](../.agent-src/skills/migration-creator/SKILL.md) |  | Use when the user says "create migration", "add column", or "new table". Creates migrations with correct table prefixes, column naming, and multi-tenant awareness. |
| skill | [`module-management`](../.agent-src/skills/module-management/SKILL.md) |  | Use when the user says "create module", "explore module", or works within app/Modules/. Understands module structure, auto-loading, route registration, and namespace conventions. |
| skill | [`multi-tenancy`](../.agent-src/skills/multi-tenancy/SKILL.md) |  | Use when working with the multi-tenant architecture — customer DB switching, FQDN routing, tenant isolation, or cross-tenant operations. |
| skill | [`openapi`](../.agent-src/skills/openapi/SKILL.md) |  | Use when documenting APIs — OpenAPI/Swagger, PHP attributes, Redocly validation, versioned specs — even when the user just says 'document this endpoint' without naming OpenAPI. |
| skill | [`override-management`](../.agent-src/skills/override-management/SKILL.md) |  | Creates and manages project-level overrides for shared skills, rules, and commands — extending or replacing originals from .augment/ with project-specific behavior in agents/overrides/. |
| skill | [`performance`](../.agent-src/skills/performance/SKILL.md) |  | Use when optimizing application performance — caching strategies, eager loading, query optimization, Redis patterns, or background job design. |
| skill | [`performance-analysis`](../.agent-src/skills/performance-analysis/SKILL.md) |  | ONLY when user explicitly requests: performance audit, bottleneck analysis, or N+1 query detection. NOT for regular feature work. |
| skill | [`pest-testing`](../.agent-src/skills/pest-testing/SKILL.md) |  | Use when writing, generating, or improving Pest tests for Laravel — clear intent, good coverage, maintainable structure, and alignment with project testing conventions. |
| skill | [`php-coder`](../.agent-src/skills/php-coder/SKILL.md) |  | Writes or edits PHP code — controllers, classes, type hints, SOLID refactors, modern idioms — even without naming PHP. NOT for writing tests (use pest-testing) or explaining PHP concepts. |
| skill | [`php-debugging`](../.agent-src/skills/php-debugging/SKILL.md) |  | Use when debugging PHP with Xdebug — breakpoints, step-through, dual-container setup, IDE configuration, header-based routing — even when the user just says 'why does this blow up on request X'. |
| skill | [`php-service`](../.agent-src/skills/php-service/SKILL.md) |  | Use when the user says 'create service', 'new service class', or needs a PHP service following SOLID principles with proper DI and repository usage. |
| skill | [`playwright-testing`](../.agent-src/skills/playwright-testing/SKILL.md) |  | Use when writing Playwright E2E tests — browser automation, visual regression testing, Page Objects, fixtures, and reliable test patterns. |
| skill | [`project-analysis-core`](../.agent-src/skills/project-analysis-core/SKILL.md) |  | Use for the universal deep-analysis workflow: project discovery, version resolution, docs loading, architecture mapping, execution flow, and package research. |
| skill | [`project-analysis-hypothesis-driven`](../.agent-src/skills/project-analysis-hypothesis-driven/SKILL.md) |  | Use when a bug has multiple plausible causes across layers — competing hypotheses, validation loops, evidence-based conclusions — even when the user just says 'why is this happening?'. |
| skill | [`project-analysis-laravel`](../.agent-src/skills/project-analysis-laravel/SKILL.md) |  | Use for deep Laravel project analysis: boot flow, request lifecycle, container usage, Eloquent/data flow, async systems, and Laravel-specific failure patterns. |
| skill | [`project-analysis-nextjs`](../.agent-src/skills/project-analysis-nextjs/SKILL.md) |  | Use for deep Next.js analysis: server vs client boundaries, routing, data fetching, caching, rendering modes, and hydration/runtime issues. |
| skill | [`project-analysis-node-express`](../.agent-src/skills/project-analysis-node-express/SKILL.md) |  | Use for deep Node.js / Express project analysis: boot flow, middleware order, async behavior, data layer, auth/security, and Node-specific runtime failure patterns. |
| skill | [`project-analysis-react`](../.agent-src/skills/project-analysis-react/SKILL.md) |  | Use for deep React analysis: component tree, state flow, props flow, hooks usage, rendering behavior, and React-specific failure patterns. |
| skill | [`project-analysis-symfony`](../.agent-src/skills/project-analysis-symfony/SKILL.md) |  | Use for deep Symfony project analysis: kernel/bootstrap, container wiring, routing/request flow, Doctrine, security, Messenger, and Symfony-specific failure patterns. |
| skill | [`project-analysis-zend-laminas`](../.agent-src/skills/project-analysis-zend-laminas/SKILL.md) |  | Use for deep Zend Framework or Laminas project analysis: bootstrap, config merge order, service manager, MVC flow, data layer, and migration-specific risks. |
| skill | [`project-analyzer`](../.agent-src/skills/project-analyzer/SKILL.md) |  | ONLY when user explicitly requests: full project analysis, tech stack detection, or structured analysis documents for agents/analysis/. NOT for regular feature work. |
| skill | [`project-docs`](../.agent-src/skills/project-docs/SKILL.md) |  | Use when looking for project-specific documentation. Knows which docs exist in agents/docs/ and agents/contexts/ and maps work areas to relevant docs. |
| skill | [`quality-tools`](../.agent-src/skills/quality-tools/SKILL.md) |  | Use when PHPStan, Rector, or ECS output appears — \"phpstan says mixed\", type errors, \"fix code style\", \"run rector\" — even when Eloquent/Laravel/model code is also mentioned. |
| skill | [`react-shadcn-ui`](../.agent-src/skills/react-shadcn-ui/SKILL.md) |  | Use when building React UI on shadcn/ui primitives + Tailwind — the apply/review/polish skill dispatched by `directives/ui/*` for the `react-shadcn` stack. |
| skill | [`readme-reviewer`](../.agent-src/skills/readme-reviewer/SKILL.md) |  | Use when reviewing a README for accuracy, usability, and alignment with the actual repository. Detects invented content, broken setup steps, and structural issues. |
| skill | [`readme-writing`](../.agent-src/skills/readme-writing/SKILL.md) |  | Use when creating, rewriting, or significantly improving a README based on the actual repository structure, commands, and intended audience. |
| skill | [`readme-writing-package`](../.agent-src/skills/readme-writing-package/SKILL.md) |  | Use when creating or rewriting a README for a reusable package or library. Focus on installability, minimal usage example, compatibility, and developer onboarding. |
| skill | [`receiving-code-review`](../.agent-src/skills/receiving-code-review/SKILL.md) |  | Use when processing code review feedback (bot or human) before changing anything — triages, verifies, and pushes back with technical reasoning — even when the user just says 'fix the comments'. |
| skill | [`refine-prompt`](../.agent-src/skills/refine-prompt/SKILL.md) |  | Reconstruct a free-form prompt into actionable AC + assumptions + confidence band before the engine plans — '/work \"…\"', 'baue X', 'ist der Prompt klar genug für die Engine?'. |
| skill | [`refine-ticket`](../.agent-src/skills/refine-ticket/SKILL.md) |  | Refine a Jira/Linear ticket before planning — 'refine ticket', 'tighten AC on PROJ-123', 'ist das Ticket klar?' — rewritten ticket, Top-5 risks, persona voices, sub-skills orchestrated, close-prompt. |
| skill | [`requesting-code-review`](../.agent-src/skills/requesting-code-review/SKILL.md) |  | Use when asking for a review or creating a PR — self-review first, frame the right context, test plan included — even when the user just says 'open a PR' or 'ready to merge'. |
| skill | [`review-routing`](../.agent-src/skills/review-routing/SKILL.md) |  | Use when preparing a PR description, suggesting reviewers, or flagging risk — produces owner-mapped roles plus historical bug-pattern matches from project-local YAML. |
| skill | [`roadmap-management`](../.agent-src/skills/roadmap-management/SKILL.md) |  | Use when the user says "create roadmap", "show roadmap", or "execute roadmap". Creates, reads, and manages roadmap files with phase tracking. |
| skill | [`rtk-output-filtering`](../.agent-src/skills/rtk-output-filtering/SKILL.md) |  | Use when running verbose CLI commands — wraps them with rtk (Rust Token Killer) for 60-90% token savings. Covers installation, configuration, and usage patterns. |
| skill | [`rule-writing`](../.agent-src/skills/rule-writing/SKILL.md) |  | Use when creating or editing a rule in .agent-src.uncompressed/rules/ — trigger wording, always vs auto classification, size budget — even when the user just says 'add a rule for X'. |
| skill | [`security`](../.agent-src/skills/security/SKILL.md) |  | Use when applying security best practices — authentication, authorization via Policies, CSRF protection, input sanitization, rate limiting, or secure coding. |
| skill | [`security-audit`](../.agent-src/skills/security-audit/SKILL.md) |  | ONLY when user explicitly requests: security audit, vulnerability scan, or penetration test review. NOT for regular feature work. |
| skill | [`sentry-integration`](../.agent-src/skills/sentry-integration/SKILL.md) |  | Use when the user shares a Sentry URL, says "check Sentry", or wants to investigate production errors. Uses Sentry MCP tools for deep analysis. |
| skill | [`sequential-thinking`](../.agent-src/skills/sequential-thinking/SKILL.md) |  | ONLY when user explicitly requests: step-by-step reasoning, structured problem decomposition, or iterative analysis. NOT for regular coding tasks. |
| skill | [`skill-improvement-pipeline`](../.agent-src/skills/skill-improvement-pipeline/SKILL.md) |  | ONLY when user explicitly requests: run the skill improvement pipeline after a learning was detected. Orchestrates capture, classify, create, validate, and apply. |
| skill | [`skill-management`](../.agent-src/skills/skill-management/SKILL.md) |  | Use when compressing, decompressing, refactoring, or improving existing skills. Covers the full skill lifecycle from verbose → sharp → maintained. |
| skill | [`skill-reviewer`](../.agent-src/skills/skill-reviewer/SKILL.md) |  | Use when reviewing, auditing, or optimizing skills — validates against the 7 Skill Killers checklist and produces fix recommendations. |
| skill | [`skill-writing`](../.agent-src/skills/skill-writing/SKILL.md) |  | Use when deciding 'should this be a skill or a rule?', creating/improving/reviewing agent skills, SKILL.md frontmatter, or procedure sections — even without saying 'skill-writing'. |
| skill | [`sql-writing`](../.agent-src/skills/sql-writing/SKILL.md) |  | Use when writing raw SQL — MariaDB/MySQL syntax, parameterization, raw migrations, seeders with `DB::statement` — even when the user just pastes a query and asks 'why is this slow' without naming SQL. |
| skill | [`subagent-orchestration`](../.agent-src/skills/subagent-orchestration/SKILL.md) |  | Use when orchestrating implementer/judge subagents — five modes (do-and-judge, do-in-steps, do-in-parallel, do-competitively, judge-with-debate) — models from .agent-settings.yml. |
| skill | [`systematic-debugging`](../.agent-src/skills/systematic-debugging/SKILL.md) |  | Use when hitting a bug, test failure, crash, or unexpected behavior — enforces reproduce → isolate → hypothesize → verify before any fix — even when the user just says 'this is broken' or 'quick fix'. |
| skill | [`technical-specification`](../.agent-src/skills/technical-specification/SKILL.md) |  | Use when the user says "write a spec", "create RFC", or "document this decision". Writes technical specifications, RFCs, and ADRs with clear structure. |
| skill | [`terraform`](../.agent-src/skills/terraform/SKILL.md) |  | Use when writing Terraform — AWS modules, resources, variables, outputs, remote state — even when the user just says 'provision this infra' or 'add an S3 bucket' without naming Terraform. |
| skill | [`terragrunt`](../.agent-src/skills/terragrunt/SKILL.md) |  | Use when working with Terragrunt — DRY multi-env configs, module dependencies, remote state orchestration — even when the user just says 'deploy this to staging and prod' without naming Terragrunt. |
| skill | [`test-driven-development`](../.agent-src/skills/test-driven-development/SKILL.md) |  | Use when implementing a feature, fixing a bug, or refactoring — write a failing test first, then the code — even if the user just says 'add this function' or 'fix this bug'. |
| skill | [`test-performance`](../.agent-src/skills/test-performance/SKILL.md) |  | Use when optimizing test suite performance — database setup, seeder optimization, parallel testing, CI pipeline efficiency, or RefreshDatabase alternatives. |
| skill | [`threat-modeling`](../.agent-src/skills/threat-modeling/SKILL.md) |  | Use when adding auth, webhooks, uploads, queues, secrets, tenant boundaries, or public endpoints — produces trust boundaries + abuse cases mapped to files, BEFORE implementation. |
| skill | [`traefik`](../.agent-src/skills/traefik/SKILL.md) |  | Use when setting up Traefik as a local reverse proxy — real domains on 127.0.0.1, trusted HTTPS via mkcert, automatic service discovery, and multi-project routing. |
| skill | [`universal-project-analysis`](../.agent-src/skills/universal-project-analysis/SKILL.md) |  | ONLY when user explicitly requests: full project analysis, deep codebase audit, or comprehensive architecture review. Routes to core and framework-specific analysis skills. |
| skill | [`upstream-contribute`](../.agent-src/skills/upstream-contribute/SKILL.md) |  | Use when a learning, new skill, rule improvement, or bug fix from a consumer project should be contributed back to the shared agent-config package. |
| skill | [`using-git-worktrees`](../.agent-src/skills/using-git-worktrees/SKILL.md) |  | Use when starting parallel work in isolation from the current branch — spawn a git worktree with ignore-safety checks and a clean test baseline — even when the user says 'try this on the side'. |
| skill | [`validate-feature-fit`](../.agent-src/skills/validate-feature-fit/SKILL.md) |  | Validate whether a feature request fits the existing codebase — check for duplicates, contradictions, scope creep, and architectural misfit |
| skill | [`verify-completion-evidence`](../.agent-src/skills/verify-completion-evidence/SKILL.md) |  | Use when claiming 'done', suggesting a commit, push, or PR — runs the evidence gate so completion claims come from fresh output in this message, not memory or earlier runs. |
| skill | [`websocket`](../.agent-src/skills/websocket/SKILL.md) |  | Use when building real-time features — WebSocket broadcasting, live updates, presence channels, connection state — even when the user just says 'push this to the client live'. |

## Rules (54)

| kind | name | type | description |
|---|---|---|---|
| rule | [`agent-authority`](../.agent-src/rules/agent-authority.md) | always | Priority Index for the four authority rules — Hard Floor → Permission Gate → Commit Default → Trivial-vs-Blocking; read first, route to canonical rule |
| rule | [`agent-docs`](../.agent-src/rules/agent-docs.md) | auto | Reading, creating, or updating agent documentation, module docs, roadmaps, or AGENTS.md |
| rule | [`analysis-skill-routing`](../.agent-src/rules/analysis-skill-routing.md) | auto | When choosing an analysis skill, route to the narrowest matching skill instead of defaulting to broad analysis |
| rule | [`architecture`](../.agent-src/rules/architecture.md) | auto | Architecture rules for creating new files, classes, controllers, modules, or making structural decisions about project organization |
| rule | [`artifact-drafting-protocol`](../.agent-src/rules/artifact-drafting-protocol.md) | auto | Creating a new skill, rule, command, or guideline, or significantly rewriting one — runs a mandatory Understand → Research → Draft sequence before any artifact content is written. |
| rule | [`artifact-engagement-recording`](../.agent-src/rules/artifact-engagement-recording.md) | auto | After a /implement-ticket or /work phase-step (refine/memory/analyze/plan/implement/test/verify/report) or full task — emit one telemetry:record call with consulted+applied ids when enabled |
| rule | [`ask-when-uncertain`](../.agent-src/rules/ask-when-uncertain.md) | always | Ask when uncertain — don't guess, assume, or improvise |
| rule | [`autonomous-execution`](../.agent-src/rules/autonomous-execution.md) | auto | Deciding whether to ask the user or just act on a workflow step — trivial-vs-blocking classification, autonomy opt-in detection, commit default; defers to non-destructive-by-default for the Hard Floor |
| rule | [`capture-learnings`](../.agent-src/rules/capture-learnings.md) | auto | After completing a task where a repeated mistake or successful pattern appeared — capture as rule or skill |
| rule | [`chat-history-cadence`](../.agent-src/rules/chat-history-cadence.md) | auto | Appending to .agent-chat-history — cadence boundaries (per_turn/per_phase/per_tool), turn-check ownership refusal handling, never writing the file directly; cadence is the trigger, not reply length |
| rule | [`chat-history-ownership`](../.agent-src/rules/chat-history-ownership.md) | auto | First turn or reference to .agent-chat-history — detects ownership (match/returning/foreign/missing) and HOOK/ENGINE/CHECKPOINT/MANUAL path classification with numbered-options prompt |
| rule | [`chat-history-visibility`](../.agent-src/rules/chat-history-visibility.md) | auto | Emitting the chat-history heartbeat marker — paste subprocess stdout verbatim or nothing, never type from memory, hybrid mode prints on drift only, slip handling per language-and-tone |
| rule | [`cli-output-handling`](../.agent-src/rules/cli-output-handling.md) | auto | Running CLI commands that produce verbose output — git, tests, linters, docker, build tools, artisan, npm, composer. Wrap with rtk when installed; tail/grep is fallback. |
| rule | [`command-suggestion-policy`](../.agent-src/rules/command-suggestion-policy.md) | auto | User prompt without /command but matching an eligible slash command — surface matches as numbered options with as-is escape hatch; never auto-executes, user always picks |
| rule | [`commit-conventions`](../.agent-src/rules/commit-conventions.md) | auto | Git commit message format, branch naming, conventional commits, committing, pushing, or creating pull requests |
| rule | [`commit-policy`](../.agent-src/rules/commit-policy.md) | always | Commit policy — never commit and never ask about committing unless the user said so this turn, the roadmap authorizes it, or a commit command is invoked |
| rule | [`context-hygiene`](../.agent-src/rules/context-hygiene.md) | auto | When debugging, fixing errors, or running long conversations — 3-failure stop rule, tool-loop detection, fresh-chat triggers |
| rule | [`direct-answers`](../.agent-src/rules/direct-answers.md) | always | Always — direct, unembellished answers. No flattery, no invented facts (verify load-bearing claims, otherwise ask). Emojis only as functional markers. Brevity is the default. |
| rule | [`docker-commands`](../.agent-src/rules/docker-commands.md) | auto | Running PHP commands inside Docker containers — artisan, composer, phpstan, rector, ecs, phpunit, tests, migrations, and any CLI tool execution |
| rule | [`downstream-changes`](../.agent-src/rules/downstream-changes.md) | auto | After EVERY code edit, find ALL downstream changes needed to existing files, including callers, tests, imports, types, and documentation |
| rule | [`e2e-testing`](../.agent-src/rules/e2e-testing.md) | auto | Playwright E2E tests — locators, assertions, Page Objects, fixtures, CI, and flaky test prevention |
| rule | [`guidelines`](../.agent-src/rules/guidelines.md) | auto | Writing or reviewing code — check relevant guideline before writing or reviewing code |
| rule | [`improve-before-implement`](../.agent-src/rules/improve-before-implement.md) | auto | Before implementing features or architectural changes — validate the request against existing code, challenge weak requirements, and suggest improvements |
| rule | [`language-and-tone`](../.agent-src/rules/language-and-tone.md) | always | Language and tone — informal German Du, English code comments, .md files always English |
| rule | [`laravel-translations`](../.agent-src/rules/laravel-translations.md) | auto | Laravel language files, translations, i18n, lang/de, lang/en, __() helper, localization, multilingual text |
| rule | [`markdown-safe-codeblocks`](../.agent-src/rules/markdown-safe-codeblocks.md) | auto | Generating markdown output that contains code blocks — prevent broken nesting |
| rule | [`minimal-safe-diff`](../.agent-src/rules/minimal-safe-diff.md) | auto | When writing or reviewing a diff — the smallest change that solves the stated problem; no drive-by edits, no opportunistic refactors, no reformatting of untouched code |
| rule | [`missing-tool-handling`](../.agent-src/rules/missing-tool-handling.md) | auto | When a CLI tool needed for the task is not installed — ask before working around it; do NOT install silently |
| rule | [`model-recommendation`](../.agent-src/rules/model-recommendation.md) | auto | Starting a new task, switching task type, or invoking a command — detect task complexity and recommend the optimal model (Opus/Sonnet/GPT) before any work |
| rule | [`no-cheap-questions`](../.agent-src/rules/no-cheap-questions.md) | always | No cheap questions — never ask what context answers, never offer Iron-Law-violating options, never stage no-trade-off choices; mode-independent (off / auto / on) |
| rule | [`non-destructive-by-default`](../.agent-src/rules/non-destructive-by-default.md) | always | Agent is never destructive — Hard Floor always asks for prod-trunk merges, deploys, pushes, prod data/infra, bulk deletions, and bulk-deletion/infra commits; no autonomy or roadmap bypass |
| rule | [`onboarding-gate`](../.agent-src/rules/onboarding-gate.md) | auto | First turn of a conversation on a project — check onboarding.onboarded in .agent-settings.yml; when false, prompt the user to run /onboard before executing any other request |
| rule | [`package-ci-checks`](../.agent-src/rules/package-ci-checks.md) | auto | Before pushing to remote or creating a PR in the agent-config package — run all CI checks locally first |
| rule | [`php-coding`](../.agent-src/rules/php-coding.md) | auto | Writing or reviewing PHP code — strict types, naming, comparisons, early returns, Eloquent conventions |
| rule | [`preservation-guard`](../.agent-src/rules/preservation-guard.md) | auto | When merging, refactoring, compressing, or restructuring skills, rules, commands, or guidelines — prevent quality loss |
| rule | [`review-routing-awareness`](../.agent-src/rules/review-routing-awareness.md) | auto | When routing reviewers or flagging risk hotspots — consult ownership-map and historical-bug-patterns before suggesting reviewers or claiming a change is safe |
| rule | [`reviewer-awareness`](../.agent-src/rules/reviewer-awareness.md) | auto | When suggesting reviewers for a change — anchor the choice in paths and risk, never prestige or seniority; require primary + secondary role for medium/high risk |
| rule | [`roadmap-progress-sync`](../.agent-src/rules/roadmap-progress-sync.md) | auto | Any touch to agents/roadmaps/ — create/rename/delete/move, edit checkboxes ([x]/[~]/[-]), add/rename/remove phases — must regenerate dashboard and archive if 0 open items, same response |
| rule | [`role-mode-adherence`](../.agent-src/rules/role-mode-adherence.md) | auto | When roles.active_role is set in .agent-settings.yml — closing outputs must match the mode's contract and emit the structured mode marker |
| rule | [`rule-type-governance`](../.agent-src/rules/rule-type-governance.md) | auto | Creating or editing rules, or auditing rule types — decides when a rule should be always vs auto |
| rule | [`runtime-safety`](../.agent-src/rules/runtime-safety.md) | auto | When a skill declares execution metadata — enforce safety constraints for assisted and automated execution types |
| rule | [`scope-control`](../.agent-src/rules/scope-control.md) | always | Scope control — no unsolicited architectural changes, refactors, or library replacements |
| rule | [`security-sensitive-stop`](../.agent-src/rules/security-sensitive-stop.md) | auto | Security-sensitive paths — auth, billing, tenant boundaries, secrets, file uploads, external integrations, webhooks, public endpoints — stop and run threat analysis BEFORE editing |
| rule | [`size-enforcement`](../.agent-src/rules/size-enforcement.md) | auto | Creating or editing rules, skills, commands, guidelines, AGENTS.md, or copilot-instructions.md — enforce size and scope limits |
| rule | [`skill-improvement-trigger`](../.agent-src/rules/skill-improvement-trigger.md) | auto | After completing a meaningful task — trigger post-task learning capture if pipelines.skill_improvement is enabled |
| rule | [`skill-quality`](../.agent-src/rules/skill-quality.md) | auto | Creating, editing, or reviewing skills — minimum quality standard, every skill must be executable, validated, and self-contained |
| rule | [`slash-command-routing-policy`](../.agent-src/rules/slash-command-routing-policy.md) | auto | When user types a slash command like /create-pr, /commit, or pastes command file content |
| rule | [`think-before-action`](../.agent-src/rules/think-before-action.md) | auto | Before coding, modifying, or debugging — analyze first, verify with real tools, never guess or trial-and-error |
| rule | [`token-efficiency`](../.agent-src/rules/token-efficiency.md) | auto | When running CLI tools, fetching logs, or producing replies — redirect verbose output, minimize tool calls, keep replies concise |
| rule | [`tool-safety`](../.agent-src/rules/tool-safety.md) | auto | When a skill uses external tools — enforce allowlist, deny-by-default, and no hidden credential patterns |
| rule | [`ui-audit-gate`](../.agent-src/rules/ui-audit-gate.md) | auto | Writing or editing UI — components, screens, partials, layouts, design tokens — require existing-ui-audit findings in state.ui_audit before non-trivial UI change; gate, not suggestion |
| rule | [`upstream-proposal`](../.agent-src/rules/upstream-proposal.md) | auto | After creating or significantly improving a skill, rule, guideline, or command — ask if it should be contributed upstream to the shared package |
| rule | [`user-interaction`](../.agent-src/rules/user-interaction.md) | auto | Asking the user a question, presenting options, or summarizing progress — numbered-options Iron Law, single-recommendation rule, progress indicators |
| rule | [`verify-before-complete`](../.agent-src/rules/verify-before-complete.md) | always | Verify before completion — run tests and quality tools before claiming done |

## Commands (69)

| kind | name | cluster | description |
|---|---|---|---|
| command | [`agent-handoff`](../.agent-src/commands/agent-handoff.md) |  | Generate a context summary for continuing work in a fresh chat. Replaces the session system. |
| command | [`agent-status`](../.agent-src/commands/agent-status.md) |  | Show current conversation stats — message count, token costs, task progress, next freshness check. |
| command | [`agents-audit`](../.agent-src/commands/agents-audit.md) |  | Audits agents/ and module agents/ directories — finds outdated docs, structural issues, duplicates, orphaned overrides, and creates an improvement roadmap. |
| command | [`agents-cleanup`](../.agent-src/commands/agents-cleanup.md) |  | Execute cleanup actions from an agents-audit — move, merge, delete, and update agent docs |
| command | [`agents-prepare`](../.agent-src/commands/agents-prepare.md) |  | Scaffold the agents/ directory structure with all required subdirectories and .gitkeep files |
| command | [`analyze-reference-repo`](../.agent-src/commands/analyze-reference-repo.md) |  | Analyze an external reference repository (competitor, inspiration, peer) and produce a structured comparison + adoption plan for this project. |
| command | [`bug-fix`](../.agent-src/commands/bug-fix.md) |  | Plan and implement a bug fix — based on investigation, with quality checks and test verification |
| command | [`bug-investigate`](../.agent-src/commands/bug-investigate.md) |  | Investigate a bug — auto-detect ticket from branch, gather Jira/Sentry/description context, trace root cause |
| command | [`chat-history-checkpoint`](../.agent-src/commands/chat-history-checkpoint.md) |  | Append a phase-boundary entry to .agent-chat-history — CHECKPOINT fallback for platforms without a native hook (Augment IDE, Cursor pre-1.7, Cline non-Mac/Linux). ~1s. |
| command | [`chat-history-clear`](../.agent-src/commands/chat-history-clear.md) |  | Manually delete the persistent chat-history log — asks for confirmation, optionally archives to a timestamped backup before wiping |
| command | [`chat-history-resume`](../.agent-src/commands/chat-history-resume.md) |  | Load the persistent chat-history log into the current conversation — picks match/returning/foreign flow and supports resume, merge, replace, or continue |
| command | [`chat-history`](../.agent-src/commands/chat-history.md) |  | Show the status of the persistent chat-history log — file size, entry count, header fingerprint, age, and the last few entries |
| command | [`check-current-md`](../.agent-src/commands/check-current-md.md) |  | Check the open .md file (or a passed path) for German outside DE:/EN: anchor blocks — umlauts, function words, untranslated quotes. Reports and offers fixes. |
| command | [`commit-in-chunks`](../.agent-src/commands/commit-in-chunks.md) |  | Stage and commit all uncommitted changes in logical chunks WITHOUT confirmation — sibling of /commit for autonomous flows |
| command | [`commit`](../.agent-src/commands/commit.md) |  | Stage and commit all uncommitted changes — splits into logical commits following Conventional Commits |
| command | [`compress`](../.agent-src/commands/compress.md) |  | Compress .md files from .agent-src.uncompressed/ into caveman format and write to .agent-src/ |
| command | [`context-create`](../.agent-src/commands/context-create.md) |  | Analyze a codebase area and create a structured context document |
| command | [`context-refactor`](../.agent-src/commands/context-refactor.md) |  | Analyze, update, and extend an existing context document |
| command | [`copilot-agents-init`](../.agent-src/commands/copilot-agents-init.md) |  | Create AGENTS.md and .github/copilot-instructions.md from scratch in the consumer project — interactive, auto-detects stack, never leaks other projects' identifiers. |
| command | [`copilot-agents-optimize`](../.agent-src/commands/copilot-agents-optimize.md) |  | Analyzes and refactors AGENTS.md and copilot-instructions.md — removes duplications, enforces line budgets, and ensures both files are optimized for their audience. |
| command | [`council-design`](../.agent-src/commands/council-design.md) | cluster: optimize | Run the council on a design document, ADR, or architecture proposal — surfaces hidden coupling, missing rollback, and sequencing risk before commitment. |
| command | [`council-optimize`](../.agent-src/commands/council-optimize.md) | cluster: optimize | Run the council on an optimization target — perf hot path, memory pattern, query, or an /optimize-* output — for ranked, evidence-based suggestions instead of generic advice. |
| command | [`council-pr`](../.agent-src/commands/council-pr.md) | cluster: optimize | Pull a GitHub PR via gh CLI and run the council on the diff with a PR-specific neutrality preamble — read-only by default; comment posting is opt-in. |
| command | [`council`](../.agent-src/commands/council.md) | cluster: optimize | Consult external AIs (OpenAI, Anthropic) for an independent second opinion on a prompt, roadmap, diff, or file set — neutral framing, redacted context, advisory output only. |
| command | [`create-pr-description`](../.agent-src/commands/create-pr-description.md) |  | Generate a PR description as a copyable markdown block — used standalone or by create-pr |
| command | [`create-pr`](../.agent-src/commands/create-pr.md) |  | Create a GitHub PR with structured description from Jira ticket and code changes |
| command | [`do-and-judge`](../.agent-src/commands/do-and-judge.md) |  | Run a single change through an implementer→judge loop with a two-revision ceiling, then hand back to the user |
| command | [`do-in-steps`](../.agent-src/commands/do-in-steps.md) |  | Execute an ordered plan step by step with a judge gate between steps — stops on first failed verdict |
| command | [`e2e-heal`](../.agent-src/commands/e2e-heal.md) |  | Find, debug, and fix failing Playwright E2E tests |
| command | [`e2e-plan`](../.agent-src/commands/e2e-plan.md) |  | Explore the application and create a structured E2E test plan in Markdown |
| command | [`estimate-ticket`](../.agent-src/commands/estimate-ticket.md) |  | Estimate a Jira/Linear ticket before sprint planning — size + risk + split recommendation + uncertainty, sibling to /refine-ticket, ends with a close-prompt |
| command | [`feature-dev`](../.agent-src/commands/feature-dev.md) |  | Full 7-phase feature development workflow for complex features. |
| command | [`feature`](../.agent-src/commands/feature.md) | cluster: feature | Feature orchestrator — routes to explore, plan, refactor, roadmap, dev |
| command | [`fix`](../.agent-src/commands/fix.md) | cluster: fix | Fix orchestrator — routes to ci, references, portability, seeder, pr-comments, pr-bot-comments, pr-developer-comments |
| command | [`implement-ticket`](../.agent-src/commands/implement-ticket.md) |  | Drive a ticket end-to-end through refine → memory → analyze → plan → implement → test → verify → report — Option-A loop over the `work_engine` Python engine, block-on-ambiguity, no auto-git. |
| command | [`jira-ticket`](../.agent-src/commands/jira-ticket.md) |  | Read Jira ticket from branch name, analyze linked Sentry issues, implement feature or fix bug |
| command | [`judge`](../.agent-src/commands/judge.md) |  | Run a standalone judge on an existing diff or code change — no implementer, no revision loop, verdict only |
| command | [`memory-add`](../.agent-src/commands/memory-add.md) |  | Interactively add a validated entry to an engineering-memory file (domain-invariants, architecture-decisions, incident-learnings, product-rules) |
| command | [`memory-full`](../.agent-src/commands/memory-full.md) |  | Load ALL curated entries of a given memory type into the current context — opt-in full load for deep analysis, never auto-triggered |
| command | [`memory-promote`](../.agent-src/commands/memory-promote.md) |  | Promote an intake signal (or provisional proposal) into a curated memory entry — opens a PR and runs the admission gate. |
| command | [`mode`](../.agent-src/commands/mode.md) |  | Set the active role mode — prints the contract, lists default skills, and refuses work outside the contract (see role-contracts) |
| command | [`module-create`](../.agent-src/commands/module-create.md) |  | Create a new module from .module-template with interactive setup |
| command | [`module-explore`](../.agent-src/commands/module-explore.md) |  | Explore a module — load its structure, docs, and context into the current conversation |
| command | [`onboard`](../.agent-src/commands/onboard.md) |  | First-run setup for a developer on this project — captures name, IDE, bot-icon preference, rtk, cost_profile, and learning opt-out, then sets onboarding.onboarded=true |
| command | [`optimize`](../.agent-src/commands/optimize.md) | cluster: optimize | Optimize orchestrator — routes to skills, agents, augmentignore, rtk-filters |
| command | [`override-create`](../.agent-src/commands/override-create.md) |  | Creates a project-level override for a shared skill, rule, or command. |
| command | [`override-manage`](../.agent-src/commands/override-manage.md) |  | Reviews, updates, and refactors existing project-level overrides. |
| command | [`package-reset`](../.agent-src/commands/package-reset.md) |  | /package-reset |
| command | [`package-test`](../.agent-src/commands/package-test.md) |  | /package-test |
| command | [`prepare-for-review`](../.agent-src/commands/prepare-for-review.md) |  | Prepare a PR branch for local review — updates main and merges the full branch chain so the branch is up to date |
| command | [`project-analyze`](../.agent-src/commands/project-analyze.md) |  | Full project analysis — detect stack, inventory modules, audit docs, create missing contexts |
| command | [`project-health`](../.agent-src/commands/project-health.md) |  | Quick project health check — show status of docs, modules, contexts, and roadmaps without creating anything |
| command | [`propose-memory`](../.agent-src/commands/propose-memory.md) |  | Append a provisional memory signal to the intake stream — the universal fallback for any producer (human or agent) to record a finding without committing to a curated entry. |
| command | [`quality-fix`](../.agent-src/commands/quality-fix.md) |  | Run quality pipeline (PHP and/or JS/TS) and fix all errors — auto-detects language from changed files |
| command | [`refine-ticket`](../.agent-src/commands/refine-ticket.md) |  | Refine a Jira/Linear ticket before planning — rewritten ticket + Top-5 risks + persona voices, orchestrates validate-feature-fit and threat-modeling, ends with a close-prompt |
| command | [`review-changes`](../.agent-src/commands/review-changes.md) |  | Self-review local changes before creating a PR — dispatches to four specialized judges (bug, security, tests, quality) and consolidates verdicts |
| command | [`review-routing`](../.agent-src/commands/review-routing.md) |  | Compute reviewer roles and matched historical bug patterns for the current diff, using project-local ownership-map.yml and historical-bug-patterns.yml |
| command | [`roadmap-create`](../.agent-src/commands/roadmap-create.md) |  | Interactively create a new roadmap file in agents/roadmaps/ |
| command | [`roadmap-execute`](../.agent-src/commands/roadmap-execute.md) |  | Read and interactively execute a roadmap from agents/roadmaps/ |
| command | [`rule-compliance-audit`](../.agent-src/commands/rule-compliance-audit.md) |  | Audit rule trigger quality, simulate activation, detect overlaps, and find never-activating rules |
| command | [`set-cost-profile`](../.agent-src/commands/set-cost-profile.md) |  | Change the cost_profile in .agent-settings.yml — shows each profile's meaning and applies the selection |
| command | [`sync-agent-settings`](../.agent-src/commands/sync-agent-settings.md) |  | Sync `.agent-settings.yml` against the current template + profile — adds new sections/keys, preserves user values, shows a diff before writing |
| command | [`sync-gitignore`](../.agent-src/commands/sync-gitignore.md) |  | Sync the `event4u/agent-config` block in the consumer project's .gitignore — adds missing entries, preserves user-added lines, shows a diff before writing |
| command | [`tests-create`](../.agent-src/commands/tests-create.md) |  | Write meaningful tests for the changes in the current branch |
| command | [`tests-execute`](../.agent-src/commands/tests-execute.md) |  | Run PHP tests inside the Docker container |
| command | [`threat-model`](../.agent-src/commands/threat-model.md) |  | Run a pre-implementation threat model on a proposed change — enumerates abuse cases, trust boundaries, and authorization gaps before the first line of code is written |
| command | [`update-form-request-messages`](../.agent-src/commands/update-form-request-messages.md) |  | Sync the messages() method of a FormRequest class — add missing entries, link them to language keys, and clean up stale ones |
| command | [`upstream-contribute`](../.agent-src/commands/upstream-contribute.md) |  | Contribute a learning, skill, rule, or fix from a consumer project back to the shared agent-config package |
| command | [`work`](../.agent-src/commands/work.md) |  | Drive a free-form prompt end-to-end through refine → score → plan → implement → test → verify → report — Option-A loop over the `work_engine` Python engine, confidence-band gated, no auto-git. |

## Guidelines (47)

| kind | name | category | description |
|---|---|---|---|
| guideline | [`agent-interaction-and-decision-quality`](../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md) | agent-infra |  |
| guideline | [`break-glass-usage`](../docs/guidelines/agent-infra/break-glass-usage.md) | agent-infra |  |
| guideline | [`developer-judgment`](../docs/guidelines/agent-infra/developer-judgment.md) | agent-infra |  |
| guideline | [`engineering-memory-data-format`](../docs/guidelines/agent-infra/engineering-memory-data-format.md) | agent-infra |  |
| guideline | [`language-and-tone-examples`](../docs/guidelines/agent-infra/language-and-tone-examples.md) | agent-infra |  |
| guideline | [`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md) | agent-infra |  |
| guideline | [`memory-access`](../docs/guidelines/agent-infra/memory-access.md) | agent-infra |  |
| guideline | [`naming`](../docs/guidelines/agent-infra/naming.md) | agent-infra |  |
| guideline | [`output-patterns`](../docs/guidelines/agent-infra/output-patterns.md) | agent-infra |  |
| guideline | [`review-routing-data-format`](../docs/guidelines/agent-infra/review-routing-data-format.md) | agent-infra |  |
| guideline | [`role-contracts`](../docs/guidelines/agent-infra/role-contracts.md) | agent-infra |  |
| guideline | [`role-mode-router`](../docs/guidelines/agent-infra/role-mode-router.md) | agent-infra |  |
| guideline | [`runtime-layer`](../docs/guidelines/agent-infra/runtime-layer.md) | agent-infra |  |
| guideline | [`self-improvement-pipeline`](../docs/guidelines/agent-infra/self-improvement-pipeline.md) | agent-infra |  |
| guideline | [`size-and-scope`](../docs/guidelines/agent-infra/size-and-scope.md) | agent-infra |  |
| guideline | [`tool-integration`](../docs/guidelines/agent-infra/tool-integration.md) | agent-infra |  |
| guideline | [`readme-size-and-splitting`](../docs/guidelines/docs/readme-size-and-splitting.md) | docs |  |
| guideline | [`playwright`](../docs/guidelines/e2e/playwright.md) | e2e |  |
| guideline | [`api-design`](../docs/guidelines/php/api-design.md) | php |  |
| guideline | [`artisan-commands`](../docs/guidelines/php/artisan-commands.md) | php |  |
| guideline | [`blade-ui`](../docs/guidelines/php/blade-ui.md) | php |  |
| guideline | [`controllers`](../docs/guidelines/php/controllers.md) | php |  |
| guideline | [`database`](../docs/guidelines/php/database.md) | php |  |
| guideline | [`eloquent`](../docs/guidelines/php/eloquent.md) | php |  |
| guideline | [`flux`](../docs/guidelines/php/flux.md) | php |  |
| guideline | [`general`](../docs/guidelines/php/general.md) | php |  |
| guideline | [`git`](../docs/guidelines/php/git.md) | php |  |
| guideline | [`jobs`](../docs/guidelines/php/jobs.md) | php |  |
| guideline | [`livewire`](../docs/guidelines/php/livewire.md) | php |  |
| guideline | [`logging`](../docs/guidelines/php/logging.md) | php |  |
| guideline | [`naming`](../docs/guidelines/php/naming.md) | php |  |
| guideline | [`dependency-injection`](../docs/guidelines/php/patterns/dependency-injection.md) | patterns |  |
| guideline | [`dtos`](../docs/guidelines/php/patterns/dtos.md) | patterns |  |
| guideline | [`events`](../docs/guidelines/php/patterns/events.md) | patterns |  |
| guideline | [`factory`](../docs/guidelines/php/patterns/factory.md) | patterns |  |
| guideline | [`pipelines`](../docs/guidelines/php/patterns/pipelines.md) | patterns |  |
| guideline | [`policies`](../docs/guidelines/php/patterns/policies.md) | patterns |  |
| guideline | [`repositories`](../docs/guidelines/php/patterns/repositories.md) | patterns |  |
| guideline | [`service-layer`](../docs/guidelines/php/patterns/service-layer.md) | patterns |  |
| guideline | [`strategy`](../docs/guidelines/php/patterns/strategy.md) | patterns |  |
| guideline | [`patterns`](../docs/guidelines/php/patterns.md) | php |  |
| guideline | [`performance`](../docs/guidelines/php/performance.md) | php |  |
| guideline | [`resources`](../docs/guidelines/php/resources.md) | php |  |
| guideline | [`security`](../docs/guidelines/php/security.md) | php |  |
| guideline | [`sql`](../docs/guidelines/php/sql.md) | php |  |
| guideline | [`validations`](../docs/guidelines/php/validations.md) | php |  |
| guideline | [`websocket`](../docs/guidelines/php/websocket.md) | php |  |

---

← [Back to README](../README.md)
