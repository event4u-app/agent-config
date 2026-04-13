---
name: project-analyzer
description: "ONLY when user explicitly requests: full project analysis, tech stack detection, or structured analysis documents for agents/analysis/. NOT for regular feature work."
---

# project-analyzer

## When to use

Unfamiliar project, onboarding, agent docs audit, baseline understanding, knowledge transfer.

NOT for: small changes, regular feature dev.

## Concept

Systematic codebase walkthrough: detect stack → inventory modules/services/models → analyze domains/flows/contracts → document to `agents/analysis/` → assess gaps/debt.

Goal: **rebuild the project from these documents alone.**

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

### Domain files (`agents/analysis/domains/`)

One per business domain. Only create for domains that exist. Contains: Purpose, Models (table), Services (table), Controllers/Endpoints (table), Jobs & Events, Business Rules, Data Flow, Dependencies.

### Module files (`agents/analysis/modules/`)

One per module. Contains: Purpose, Structure, Public API, Internal Components, Configuration, Testing.

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

## Phases

1. **Overview** — AGENTS.md, README, framework, version, stack → `overview.md`
2. **Architecture** — dir structure, patterns, multi-tenancy, counts → `architecture/*.md`
3. **Data layer** — models, schema, multi-tenant split → `models/*.md`
4. **Business domains** — models→services→controllers→jobs→events, rules, flows → `domains/{domain}.md`
5. **API surface** — endpoints, contracts, version diffs → `api/*.md`
6. **Service map** — services, deps, god services → `services/service-map.md`
7. **Modules** (if exist) — structure, public API, tests → `modules/{module}.md`
8. **Infrastructure & testing** — Docker, CI, test suites → `architecture/infrastructure.md`, `testing/test-map.md`
9. **Agent docs audit** — existing docs, outdated refs, undocumented areas
10. **Gap analysis** — missing docs → offer creation, stale roadmaps → suggest archiving

## Integration: `project-docs`, `module`, `context`, `feature-planning`, `agent-docs`, `roadmap-manager`, `api-endpoint`, `database`

## Workflow

1. Ask scope (full or specific area)
2. Run phases incrementally — show findings, ask before continuing
3. Write files after each phase
4. Ask before creating each file (numbered options)
5. Update existing files on re-run

## Gotcha: takes minutes (warn user), respect scope, output to `agents/analysis/`

## Do NOT: create without asking, modify code, commit/push, analyze vendor/node_modules, duplicate existing docs
