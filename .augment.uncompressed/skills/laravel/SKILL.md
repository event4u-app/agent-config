---
name: laravel
description: "Writes Laravel code following framework conventions, project architecture, and modern best practices for controllers, requests, services, jobs, events, policies, and application structure."
source: package
---

# laravel

## When to use

Use this skill for all Laravel-specific code generation and editing tasks, especially when working with:

- Controllers
- Form Requests
- Middleware
- Service Providers
- Jobs / Queued Jobs
- Events / Listeners
- Policies / Gates
- Notifications
- Console Commands
- Config, Routing, and Application Structure

This skill extends the base `coder` skill and applies Laravel conventions on top of the project's general PHP rules.

## Before writing code

→ **First apply the `coder` skill** — it handles project docs, module docs, patterns, and quality tools.

Then add these **Laravel-specific** checks:

1. **Confirm this is a Laravel app** — check whether `artisan` exists.
2. **Inspect app structure** — classic Laravel, modules (`app/Modules/`), or domain folders.
3. **Check routes and HTTP flow** — understand how requests enter the application and where logic belongs.
4. **Check test conventions** — inspect existing tests in the same domain before writing new code.

## Core Laravel principles

- Follow **Laravel conventions first** unless the project explicitly does otherwise.
- Keep **controllers thin** — delegate business logic to services/actions.
- Keep **Form Requests responsible for validation and authorization**.
- Use **dependency injection** through the container.
- Prefer **framework features** over custom infrastructure when the built-in solution is sufficient.
- Avoid hidden magic when explicit code is clearer for the project.
- Respect the existing architecture — do not force "pure Laravel" if the project uses modules or service layers.

## HTTP layer rules

- Controllers should:
    - accept the request
    - delegate business logic
    - return a response / resource / redirect
- Do not put business logic, calculations, or large data transformations in controllers.
- Use **Form Request** classes for validation instead of inline controller validation when the request is non-trivial.
- Use route model binding when it improves clarity and matches existing patterns.
- Keep controller actions focused and small.

## Validation rules

- Use **Form Requests** for reusable or non-trivial validation.
- Prefer explicit validation rules over implicit behavior.
- Reuse existing custom rules when available.
- Keep validation close to the HTTP boundary.
- Do not mix validation with persistence or business decisions.

## Service layer rules

- Put orchestration and business logic into dedicated services/actions.
- Services should be framework-light when possible.
- A service should have one clear responsibility.
- Prefer constructor injection for dependencies.
- Do not move trivial one-line controller behavior into a service unless the project consistently does that.

## Routing rules

- Follow the existing route organization:
    - `routes/web.php`
    - `routes/api.php`
    - module-specific route files
- Keep route definitions readable and grouped logically.
- Use route names consistently.
- Apply middleware explicitly and according to project conventions.
- Do not introduce route patterns that differ from the surrounding code without a good reason.

## Response rules

- Use the response style already established in the project:
    - Blade views
    - JSON responses
    - API Resources
    - Redirects with flash messages
- For APIs, prefer:
    - consistent status codes
    - structured JSON payloads
    - API Resources when the project uses them
- Do not return raw models directly unless that is already the established project pattern.

## Queues, jobs, and async work

- Use Jobs for clearly asynchronous or deferred work.
- Keep Jobs focused on a single responsibility.
- Pass only the data needed by the job.
- Avoid putting excessive domain logic directly into the Job class — delegate to services where appropriate.
- Be mindful of serialization when passing models or objects.

## Events and listeners

- Use events for meaningful domain or application events, not for every small action.
- Name events clearly in the past tense when something already happened.
- Keep listeners focused and side-effect oriented.
- Do not introduce event-driven complexity unless it is already part of the project architecture.

## Auth, policies, and authorization

- Use Laravel authorization features consistently:
    - policies
    - gates
    - request authorization
- Keep authorization logic out of controllers where possible.
- Reuse existing policies and permission patterns.
- Do not hardcode role checks in multiple places if a policy/gate already exists.

## Config and environment

- Read configuration from config files, not directly from `env()` outside config files.
- Do not introduce new environment variables unless necessary.
- Reuse existing config structure and naming patterns.

## Database interaction

- Prefer Eloquent for normal application data access unless the project uses repositories or query objects.
- Use transactions when multiple writes must succeed or fail together.
- Avoid N+1 problems — eager load when appropriate.
- For heavy data access logic, follow the dedicated `eloquent` skill.

## Migrations and schema changes

- Keep migrations focused and reversible.
- Follow existing naming conventions for columns, foreign keys, and indexes.
- Do not mix unrelated schema changes in a single migration.
- Be careful with destructive changes on existing production tables.

## Blade and view rules

- Keep views dumb — presentation only.
- Avoid embedding business logic in Blade templates.
- Extract reusable UI pieces into components/partials when it matches project patterns.
- Escape output by default and use raw output only when safe and intentional.

## What NOT to do

- Do not put business logic into controllers, models, or Blade templates.
- Do not validate large requests inline in controllers when Form Requests are more appropriate.
- Do not call `env()` outside config files.
- Do not introduce new architectural layers unless the project already uses them.
- Do not bypass Laravel features already used consistently in the project.
- Do not return inconsistent API response shapes in an established API.

## Output expectations

When generating Laravel code:

- follow Laravel naming conventions
- use dependency injection
- keep classes small and focused
- match the surrounding project structure
- prefer explicit, readable code over clever abstractions
- integrate with existing requests, resources, services, policies, and tests

## Do NOT

- Do NOT put business logic in controllers — delegate to services.
- Do NOT use facades in service classes — use dependency injection.
- Do NOT skip middleware for route groups that need authentication.

## Gotcha

- `env()` only works in config files — use `config()` everywhere else.
- Don't mix `Route::resource()` with single-action controllers — pick the project's convention.
- Don't return Eloquent models directly — always use API Resources.
- Don't bypass existing middleware stacks when adding new routes.

## Auto-trigger keywords

- Laravel
- controller
- service
- middleware
- route
- application structure
