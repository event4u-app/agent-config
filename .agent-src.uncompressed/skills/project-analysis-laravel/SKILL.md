---
name: project-analysis-laravel
description: "Use for deep Laravel project analysis: boot flow, request lifecycle, container usage, Eloquent/data flow, async systems, and Laravel-specific failure patterns."
source: package
---

# project-analysis-laravel

## When to use

Use this skill when:

* The project uses Laravel
* A deep Laravel-specific architecture or runtime analysis is needed
* `universal-project-analysis` routes here after framework detection
* A broad issue spans routes, middleware, services, models, queues, config, or infrastructure

Do NOT use when:

* The task is a small isolated Laravel coding change
* The issue is already narrowed to a specific specialist skill
* The project is not actually Laravel

## Core principles

* Installed Laravel version controls behavior
* Boot order matters
* Middleware order matters
* Container behavior must be traced, not assumed
* Eloquent behavior often hides real execution cost
* Async boundaries create hidden state problems

## Procedure

### 1. Confirm Laravel version and runtime

Check: `composer.lock`, `composer.json`, `artisan --version`, PHP version and runtime environment.
Validate: Laravel version is explicit, major supporting packages are identified, deployment/runtime shape is known.

### 2. Analyze boot and configuration

Inspect: service providers, provider registration order, config files, cached config/route state, middleware registration, route groups and prefixes, env/config interaction.

Check:

* config caching risks
* `env()` usage outside config
* provider misuse
* route cache assumptions
* driver choices for queue/cache/mail/session/filesystem

### 3. Trace request-to-response flow

Trace: route → middleware → FormRequest/validation → controller → service/action → model/repository/query → events/observers → response transformation.

Validate: authorization path is visible, validation path is visible, transaction boundaries are visible, hidden side effects are identified.

### 4. Analyze data and Eloquent flow

Inspect: migrations, model relationships, casts/enums/json usage, soft deletes, nullable assumptions, eager/lazy loading, indexes and query shape.

Check:

* N+1 risks
* mismatches between schema and model assumptions
* unexpected model event behavior
* wrong relationship direction or ownership

### 5. Analyze async and infrastructure flow

Inspect: queued jobs, event listeners, scheduled commands, broadcasting, cache invalidation, mail/notification side effects, external HTTP integrations.

Check:

* serialization risks
* tenant/user context loss
* idempotency
* retry loops
* stale cache / eventual consistency
* side effects inside transactions

### 6. Analyze test posture

Check: feature tests, unit tests, integration coverage, factories/seeders/fakes, missing tests on critical paths.
Validate: risky paths have test coverage, async behavior has meaningful tests, infrastructure assumptions are testable.

### 7. Validate Laravel analysis quality

Check:

* boot flow is explicit
* request/data/async boundaries are mapped
* Laravel version-specific behavior was considered
* hidden framework side effects are identified
* next specialist skill is clear where needed

## Output format

1. Laravel version and runtime summary
2. Boot/config findings
3. Request-to-response flow
4. Data/Eloquent findings
5. Async/infrastructure findings
6. Test posture
7. Key risks and next steps

## Gotcha

* Laravel hides complexity behind convenient abstractions.
* Middleware, observers, facades, and Eloquent can make execution flow look simpler than it is.
* Cached config/routes can make the real runtime differ from the source code.

## Do NOT

* Do NOT assume Laravel behavior without version context
* Do NOT stop at controller/service level if observers, jobs, or events are involved
* Do NOT ignore middleware order
* Do NOT ignore config/cache/runtime differences
* Do NOT treat Eloquent convenience as proof of correctness or performance
