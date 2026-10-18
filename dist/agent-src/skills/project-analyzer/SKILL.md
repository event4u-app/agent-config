---
model_tier: high
context_window: large
name: project-analyzer
description: "Single-pass tech-stack detection with an agents/evidence/analysis/ write-up; explicit request only. Deep multi-pass audit → universal-project-analysis. Raw primitives → project-analysis-core."
domain: discovery
workspaces:
  - engineering
packs:
  - engineering-base
---

# project-analyzer

## When to use

Use this skill when:

- Starting work on an unfamiliar project
- Onboarding to a new codebase
- Auditing the current state of agent docs, contexts, and features
- Creating a baseline understanding of the project for future work
- Generating comprehensive project documentation for knowledge transfer


Do NOT use when:
- Small, focused code changes
- Regular feature development

## Procedure: Analyze a project

A **project analysis** is a systematic walkthrough of the entire codebase that:

1. **Detects** — framework, language, tech stack, patterns, legacy vs. modern
2. **Inventories** — modules, services, models, endpoints, tests
3. **Analyzes** — business domains, data flows, API contracts, dependencies
4. **Documents** — writes structured analysis files to `agents/evidence/analysis/`
5. **Assesses** — identifies gaps, technical debt, missing docs

It orchestrates other skills and commands to produce a comprehensive picture.

The order is held by [`procedure.yaml`](procedure.yaml). Run the analysis phases one at a time, in order, and start a step only after the one before it has met its exit. A `judgement` exit is sequenced, not verified: state what you decided before moving on.

1. [Phase 1: Project overview](references/steps/01-project-overview.md) — exit: `check: analysis-overview-matches-manifests`
2. [Phase 2: Architecture](references/steps/02-architecture.md) — exit: `exists: agents/evidence/analysis/architecture`
3. [Phase 3: Data layer](references/steps/03-data-layer.md) — exit: `exists: agents/evidence/analysis/models`
4. [Phase 4: Business domains](references/steps/04-business-domains.md) — exit: `exists: agents/evidence/analysis/domains`
5. [Phase 5: API surface](references/steps/05-api-surface.md) — exit: `exists: agents/evidence/analysis/api`
6. [Phase 6: Service map](references/steps/06-service-map.md) — exit: `exists: agents/evidence/analysis/services/service-map.md`
7. [Phase 7: Module inventory (if modules exist)](references/steps/07-module-inventory.md) — exit: `judgement`
8. [Phase 8: Infrastructure & testing](references/steps/08-infrastructure-and-testing.md) — exit: `exists: agents/evidence/analysis/testing/test-map.md`
9. [Phase 9: Agent docs audit](references/steps/09-agent-docs-audit.md) — exit: `judgement`
10. [Phase 10: Gap analysis & action plan](references/steps/10-gap-analysis.md) — exit: `judgement`

## Analysis output

All analysis results are written to `agents/evidence/analysis/` in a structured directory layout.
The goal: **someone could rebuild the project from these documents alone.**

### Directory structure

```
agents/evidence/analysis/
├── overview.md                  ← Project profile, tech stack, architecture summary
├── architecture/
│   ├── database.md              ← Schema, connections, multi-tenancy, migrations
│   ├── api.md                   ← Versioning, routes, middleware, auth flow
│   ├── infrastructure.md        ← Docker, CI/CD, deployment, AWS, monitoring
│   └── patterns.md              ← Design patterns used (Repository, Service, Pipeline, etc.)
├── domains/
│   ├── {domain}.md              ← One file per business domain (see below)
│   └── ...
├── modules/
│   ├── {module}.md              ← One file per module (see below)
│   └── ...
├── models/
│   ├── api-database.md          ← All api_database models, relationships, key columns
│   └── customer-database.md     ← All customer_database models, relationships, key columns
├── services/
│   └── service-map.md           ← All services with purpose, dependencies, key methods
├── api/
│   ├── endpoints-v1.md          ← All v1 endpoints: route, controller, request, resource
│   ├── endpoints-v2.md          ← All v2 endpoints: route, controller, request, resource
│   └── contracts.md             ← API contracts: request/response shapes, validation rules
└── testing/
    └── test-map.md              ← Test suites, coverage areas, test data strategy
```

### Domain analysis files

Each business domain gets its own file in `agents/evidence/analysis/domains/`. A domain groups
related models, services, controllers, jobs, and events around a business concept:

| Domain             | What it covers                                           |
|--------------------|----------------------------------------------------------|
| `projects.md`      | Construction sites, positions, project status, geocoding |
| `planning.md`      | Appointments, crew assignments, capacity planning        |
| `users.md`         | Employees, roles, permissions, authentication            |
| `equipment.md`     | Machines, vehicles, repairs, time registration           |
| `working-times.md` | Time tracking, absences, wage types, logs                |
| `reports.md`       | Daily reports, images, measured quantities               |
| `files.md`         | File uploads, file links, storage                        |
| `customers.md`     | Tenant management, customer config, modules              |
| `webhooks.md`      | Webhook dispatching, retry logic                         |
| `imports.md`       | Client software imports (cross-reference with module)    |
| `gps.md`           | GPS tracking, geofencing                                 |
| `notifications.md` | Email, push, private messages, Slack                     |
| `dashboard.md`     | Dashboard widgets, statistics                            |

Not every project has all domains. Only create files for domains that actually exist.

### Domain file template

Each domain file should contain:

```markdown
# Domain: {Name}

## Purpose

{What this domain does in 2-3 sentences}

## Models

| Model | Table | Connection | Key Relationships |
|---|---|---|---|

## Services

| Service | Purpose | Key Methods |
|---|---|---|

## Controllers (API Endpoints)

| Endpoint | Controller | Request | Resource |
|---|---|---|---|

## Jobs & Events

| Class | Type | Trigger | What it does |
|---|---|---|---|

## Business Rules

- {Rule 1: e.g. "A project can only be deleted if it has no working times"}
- {Rule 2}

## Data Flow

{Describe how data moves through this domain — from input to storage to output}

## Dependencies

- Depends on: {other domains}
- Depended on by: {other domains}
```

### Module analysis files

Each module gets its own file in `agents/evidence/analysis/modules/`. Format:

```markdown
# Module: {Name}

## Purpose

{What this module does}

## Structure

{Directory tree with key files}

## Public API

{What other parts of the app use from this module: Services, Events, Models}

## Internal Components

{Controllers, Jobs, Commands, Listeners that are module-internal}

## Configuration

{Config files, .env variables, feature flags}

## Testing

{Test suites, test data, stubs}
```

## Detection checklist

### Framework & language (multi-stack)

| Check                  | How to detect                                                                |
|------------------------|------------------------------------------------------------------------------|
| PHP runtime + version  | `composer.json` → `require.php`                                              |
| Laravel application    | `artisan` file at repo root + `laravel/framework` in `composer.json`         |
| Symfony application    | `bin/console` + `symfony/framework-bundle` in `composer.json`                |
| Composer package       | `composer.json` without `artisan` / `bin/console`                            |
| Node.js runtime        | `package.json` exists                                                        |
| TypeScript             | `tsconfig.json` exists                                                       |
| Frontend framework     | `package.json` → `react`, `vue`, `svelte`, `solid`, `astro`, `@angular/core` |
| Meta-framework         | `package.json` → `next`, `nuxt`, `remix`, `sveltekit`, `astro`               |
| Python runtime         | `pyproject.toml`, `requirements.txt`, `setup.py`, or `Pipfile`               |
| Python framework       | `pyproject.toml` / `requirements.txt` → `django`, `fastapi`, `flask`         |
| Go module              | `go.mod` exists                                                              |
| Rust crate / workspace | `Cargo.toml` exists                                                          |
| Ruby app               | `Gemfile` → `rails`, `sinatra`                                               |
| .NET project           | `*.csproj`, `*.fsproj`, or `global.json`                                     |
| Java / Kotlin          | `pom.xml`, `build.gradle`, or `build.gradle.kts`                             |

After detecting **any** match, record the stack in the analysis output and select the matching `project-analysis-*` sub-skill (Laravel, Symfony, Next.js, React, Node/Express, Zend/Laminas) — fall back to `project-analysis-core` if no framework-specific sub-skill applies.

### Project type

| Signal                                                                | Type                                  |
|-----------------------------------------------------------------------|---------------------------------------|
| `artisan` + `laravel/framework`                                       | Laravel application                   |
| `bin/console` + `symfony/framework-bundle`                            | Symfony application                   |
| `composer.json` without `artisan` / `bin/console`                     | Composer package or legacy PHP        |
| `package.json` with `next` / `nuxt` / `remix` / `sveltekit` / `astro` | Meta-framework SSR/SSG app            |
| `package.json` with `express` / `fastify` / `koa` / `hapi`            | Node HTTP service                     |
| `package.json` with `@nestjs/core`                                    | NestJS application                    |
| `pyproject.toml` with `django` / `fastapi` / `flask`                  | Python web app                        |
| `go.mod` with `gin-gonic/gin` / `labstack/echo` / `gofiber/fiber`     | Go HTTP service                       |
| Module system (`app/Modules/`, `src/modules/`, `packages/*`)          | Modular monolith / monorepo           |
| Multi-tenant signal (`customer_database`, tenant middleware, `RLS`)   | Multi-tenant SaaS                     |
| `apps/*` + `packages/*` + `turbo.json` / `nx.json` / `pnpm-workspace` | Monorepo                              |

### Legacy indicators (stack-aware)

| Signal                                                                       | Meaning                       |
|------------------------------------------------------------------------------|-------------------------------|
| PHP: no `declare(strict_types=1)` in most files                              | Pre-modern PHP style          |
| PHP: no typed properties / return types                                      | Legacy PHP (< 7.4)            |
| PHP: no `phpstan.neon` / `rector.php`                                        | No static analysis            |
| TS: `// @ts-ignore` / `// @ts-nocheck` density; `any` widespread             | Untyped TypeScript            |
| TS: no `tsconfig.json` `strict: true`                                        | Loose TypeScript              |
| JS: no ESLint config or `eslint.config.*`                                    | No linting                    |
| Python: no type hints in most signatures; no `py.typed`                      | Untyped Python                |
| Python: no `mypy.ini` / `pyrightconfig.json` / `ruff.toml`                   | No static analysis            |
| Go: no `golangci.yml`                                                        | No lint pipeline              |
| Rust: no `clippy.toml` and warnings ignored                                  | No lint hygiene               |
| `var_dump()` / `console.log()` / `print()` / `fmt.Println()` left in code   | Legacy debugging patterns     |
| No tests or very few tests                                                   | Low test coverage             |
| Mixed naming conventions across the same module                              | Inconsistent standards        |

### Build & tooling (stack-agnostic)

| Check         | How to detect                                                                                                                                                       |
|---------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Task runner   | `Makefile`, `Taskfile.yml`, `justfile`, `package.json scripts`, `composer.json scripts`                                                                             |
| Docker        | `docker-compose.yml`, `compose.yaml`, `Dockerfile`                                                                                                                  |
| CI/CD         | `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/config.yml`, `azure-pipelines.yml`                                                                               |
| Quality tools | PHP: `phpstan.neon`, `ecs.php`, `rector.php`. TS/JS: `eslint.config.*`, `.prettierrc*`, `tsconfig.json`. Python: `ruff.toml`, `mypy.ini`. Go: `.golangci.yml`. Rust: `clippy.toml` |
| Editor config | `.editorconfig`                                                                                                                                                     |
| Code review   | `CODEOWNERS`, PR templates (`.github/pull_request_template.md`)                                                                                                     |
| Dependencies  | Lockfile presence: `composer.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `go.sum`, `Cargo.lock`                            |

## Integration with other skills

| Skill              | How it's used                                               |
|--------------------|-------------------------------------------------------------|
| `project-docs`     | Read existing docs before analyzing each area               |
| `module-management`           | Detect and inventory modules                                |
| `context-create`          | Create/update context documents                             |
| `feature-planning` | Identify planned but undocumented features                  |
| `agent-docs-writing`       | Audit and maintain agent documentation                      |
| `roadmap-management`  | Review roadmap status                                       |
| `api-endpoint`     | Understand endpoint structure for API analysis              |
| `database`         | Understand schema and multi-tenancy for data layer analysis |

## Workflow

1. **Ask scope**: Full analysis or specific area (e.g. only domains, only API)?
2. **Run phases incrementally** — show findings after each phase, ask before continuing.
3. **Write files after each phase** — don't batch all writing to the end.
4. **Ask before creating each file** with numbered options:
   ```
   > 1. Create — {filename}
   > 2. Skip
   ```
5. **Update existing files** if re-running analysis — don't create duplicates.


## Output format

1. Structured analysis document in agents/evidence/analysis/
2. Tech stack inventory with versions and dependencies
3. Architecture diagram or module map

## Gotcha

- Full project analysis can take several minutes — warn the user about the time investment.
- Don't analyze parts of the codebase that the user hasn't asked about — respect scope.
- Analysis documents go in `agents/evidence/analysis/`, not in `.augment/`.

## Do NOT

- Do NOT create analysis files without asking — always confirm each creation.
- Do NOT modify existing code — this is analysis only.
- Do NOT commit or push.
- Do NOT overwhelm the user — present findings incrementally, one phase at a time.
- Do NOT analyze third-party code in `vendor/` or `node_modules/`.
- Do NOT duplicate content that already exists in `agents/reference/docs/` or `agents/settings/contexts/` —
  reference it instead. Analysis files complement existing docs, they don't replace them.
