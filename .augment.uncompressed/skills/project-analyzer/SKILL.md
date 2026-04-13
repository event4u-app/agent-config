---
name: project-analyzer
description: "ONLY when user explicitly requests: full project analysis, tech stack detection, or structured analysis documents for agents/analysis/. NOT for regular feature work."
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

## Concept

A **project analysis** is a systematic walkthrough of the entire codebase that:

1. **Detects** — framework, language, tech stack, patterns, legacy vs. modern
2. **Inventories** — modules, services, models, endpoints, tests
3. **Analyzes** — business domains, data flows, API contracts, dependencies
4. **Documents** — writes structured analysis files to `agents/analysis/`
5. **Assesses** — identifies gaps, technical debt, missing docs

It orchestrates other skills and commands to produce a comprehensive picture.

## Analysis output

All analysis results are written to `agents/analysis/` in a structured directory layout.
The goal: **someone could rebuild the project from these documents alone.**

### Directory structure

```
agents/analysis/
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

Each business domain gets its own file in `agents/analysis/domains/`. A domain groups
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

Each module gets its own file in `agents/analysis/modules/`. Format:

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

### Framework & language

| Check                 | How to detect                                 |
|-----------------------|-----------------------------------------------|
| PHP version           | `composer.json` → `require.php`               |
| Laravel version       | `composer.json` → `require.laravel/framework` |
| Laravel or standalone | `artisan` file exists → Laravel               |
| Node.js               | `package.json` exists                         |
| Frontend framework    | `package.json` → Vue, React, etc.             |
| TypeScript            | `tsconfig.json` exists                        |

### Project type

| Signal                             | Type                           |
|------------------------------------|--------------------------------|
| `artisan` + `laravel/framework`    | Laravel application            |
| `composer.json` without `artisan`  | Composer package or legacy PHP |
| Module system (`app/Modules/`)     | Modular Laravel                |
| Multi-tenant (`customer_database`) | Multi-tenant SaaS              |

### Legacy indicators

| Signal                                     | Meaning                   |
|--------------------------------------------|---------------------------|
| No `declare(strict_types=1)` in most files | Legacy codebase           |
| No typed properties / return types         | Legacy PHP (< 7.4)        |
| `var_dump()` / `print_r()` in code         | Legacy debugging patterns |
| No tests or very few tests                 | Low test coverage         |
| No PHPStan / Rector config                 | No static analysis        |
| Mixed naming conventions                   | Inconsistent standards    |

### Build & tooling

| Check         | How to detect                                             |
|---------------|-----------------------------------------------------------|
| Task runner   | `Makefile` or `Taskfile.yml`                              |
| Docker        | `docker-compose.yml` or `compose.yaml`                    |
| CI/CD         | `.github/workflows/`                                      |
| Quality tools | `phpstan.neon`, `ecs.php`, `rector.php`, or `config-dev/` |
| Editor config | `.editorconfig`                                           |
| Code review   | `CODEOWNERS`, PR templates                                |

## Analysis phases

### Phase 1: Project overview

- Read `AGENTS.md`, `.github/copilot-instructions.md`, `README.md`
- Detect framework, version, tech stack
- Identify build tools and quality tooling
- Classify: legacy vs. modern, monolith vs. modular
- **Output:** `agents/analysis/overview.md`

### Phase 2: Architecture

- Map directory structure (top 3 levels)
- Identify architectural patterns (MVC, modules, services, repositories)
- Detect multi-tenancy, queue system, caching
- Count: models, controllers, services, jobs, commands
- **Output:** `agents/analysis/architecture/*.md`

### Phase 3: Data layer

- List all models with their connections, tables, and key relationships
- Map database schema: tables, foreign keys, indexes
- Document multi-tenant split (which tables in which DB)
- **Output:** `agents/analysis/models/api-database.md`, `customer-database.md`

### Phase 4: Business domains

- Identify domains from models, services, routes, and directory structure
- For each domain: map models → services → controllers → jobs → events
- Document business rules and data flows
- Document inter-domain dependencies
- **Output:** `agents/analysis/domains/{domain}.md` (one per domain)

### Phase 5: API surface

- List all endpoints with controller, request, resource, OpenAPI attributes
- Document request/response contracts (field names, types, validation rules)
- Map version differences (v1 vs v2)
- **Output:** `agents/analysis/api/endpoints-v1.md`, `endpoints-v2.md`, `contracts.md`

### Phase 6: Service map

- List all services with purpose, key methods, and dependencies
- Map service → repository → model relationships
- Identify God services (too many responsibilities)
- **Output:** `agents/analysis/services/service-map.md`

### Phase 7: Module inventory (if modules exist)

- List all modules with purpose
- For each module: structure, public API, internal components, tests
- Check for module-level agent docs
- **Output:** `agents/analysis/modules/{module}.md` (one per module)

### Phase 8: Infrastructure & testing

- Docker setup, CI/CD pipelines, deployment
- Test suites, coverage areas, test data strategy
- **Output:** `agents/analysis/architecture/infrastructure.md`, `agents/analysis/testing/test-map.md`

### Phase 9: Agent docs audit

- List all existing docs in `agents/docs/`, `agents/contexts/`, module `agents/`
- Check for outdated docs (reference deleted files/classes)
- Identify undocumented areas
- Check for stale roadmaps

### Phase 10: Gap analysis & action plan

- Modules without context docs → offer `/context-create`
- Complex services without docs → offer `/context-create`
- Existing docs that reference deleted code → offer `/context-refactor`
- Stale roadmaps (all steps done) → suggest archiving

## Integration with other skills

| Skill              | How it's used                                               |
|--------------------|-------------------------------------------------------------|
| `project-docs`     | Read existing docs before analyzing each area               |
| `module`           | Detect and inventory modules                                |
| `context`          | Create/update context documents                             |
| `feature-planning` | Identify planned but undocumented features                  |
| `agent-docs`       | Audit and maintain agent documentation                      |
| `roadmap-manager`  | Review roadmap status                                       |
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


## Auto-trigger keywords

- project analysis
- codebase analysis
- architecture analysis

## Gotcha

- Full project analysis can take several minutes — warn the user about the time investment.
- Don't analyze parts of the codebase that the user hasn't asked about — respect scope.
- Analysis documents go in `agents/analysis/`, not in `.augment/`.

## Do NOT

- Do NOT create analysis files without asking — always confirm each creation.
- Do NOT modify existing code — this is analysis only.
- Do NOT commit or push.
- Do NOT overwhelm the user — present findings incrementally, one phase at a time.
- Do NOT analyze third-party code in `vendor/` or `node_modules/`.
- Do NOT duplicate content that already exists in `agents/docs/` or `agents/contexts/` —
  reference it instead. Analysis files complement existing docs, they don't replace them.
