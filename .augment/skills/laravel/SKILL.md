---
name: laravel
description: "Writes Laravel code following framework conventions, project architecture, and modern best practices for controllers, requests, services, jobs, events, policies, and application structure."
source: package
---

# laravel

## When to use

Laravel controllers, requests, middleware, providers, jobs, events, policies, notifications, commands, routing, structure. Extends `coder`.

## Before: apply `coder` first. Then: confirm Laravel (artisan), inspect structure (classic/modules/domain), check routes, check tests.

## Principles: Laravel conventions first, thin controllers (→ services), FormRequests for validation+auth, DI, prefer framework features, respect existing architecture.

## HTTP: Controllers accept request → delegate → return response. FormRequests for non-trivial validation. Route model binding where it fits.

## Services: orchestration + business logic, single responsibility, constructor injection. Don't extract trivial one-liners.

## Routing: follow existing organization (web/api/module), grouped, named, explicit middleware.

## Responses: match project style (Blade/JSON/Resources/redirects). APIs: consistent status codes, structured payloads, Resources.

## Jobs: async/deferred work, single responsibility, minimal data, delegate to services, serialize carefully.

## Events: meaningful domain events, past tense names, focused listeners. Don't add event complexity without existing pattern.

## Auth: policies + gates + request auth. Out of controllers. Reuse patterns.

## Config: from config files only (no `env()` outside config). Reuse existing structure.

## DB: Eloquent (or repos if project uses them), transactions, eager loading. See `eloquent` skill.

## Migrations: focused, reversible, existing naming, no mixed concerns, careful with destructive changes.

## Blade: presentation only, no business logic, reusable components, escape by default.

## Do NOT: business logic in controllers/models/Blade, `env()` outside config, new architecture layers without precedent, facades in services (use DI), skip auth middleware.
