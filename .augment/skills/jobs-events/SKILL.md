---
name: jobs-events
description: "Use when creating Laravel jobs, queued workflows, events, or listeners. Covers clear responsibilities, safe serialization, and retry/failure handling."
---

# jobs-events

## When to use

Use this skill for Laravel asynchronous and event-driven code, especially when working with:

- Jobs
- Queued Jobs
- Dispatching workflows
- Events
- Listeners
- Event subscribers
- Notifications triggered by events
- Background processing
- Retry / backoff / failure handling

This skill extends `coder` and `laravel`.

## Before writing code

1. **Read the base skills first** — apply `coder` and `laravel`.
2. **Check current async conventions** — inspect existing Jobs, Events, and Listeners.
3. **Understand the workflow** — determine what should happen synchronously and what should happen asynchronously.
4. **Inspect queue configuration** — check queue connection, retry strategy, and failure handling patterns.
5. **Check how events are used** — some projects use them heavily, others only for selected integration points.
6. **Inspect related tests** — match how jobs, events, queues, and listeners are tested in the project.

## Core principles

- Use Jobs for deferred or background work.
- Use Events for meaningful application or domain occurrences.
- Keep both Jobs and Listeners focused on one responsibility.
- Prefer explicit workflows over overly magical event chains.
- Be careful with serialization, retries, idempotency, and side effects.

## Job rules

- A Job should do one clear piece of work.
- Keep constructor payloads minimal.
- Pass only the data needed for execution.
- Avoid passing large object graphs or unnecessary models.
- Delegate complex business logic to services/actions when needed.
- Keep the `handle()` method focused and readable.

## Queued job rules

- Queue work that is:
    - slow
    - retryable
    - non-blocking for the request lifecycle
    - integration-heavy
- Do not queue trivial work without a real benefit.
- Be explicit about queue behavior when the project already uses:
    - queue names
    - retry limits
    - backoff
    - timeout settings
- Follow project conventions for sync vs async dispatching.
- **Queue driver:** Check `.env` / `config/queue.php` for the driver (Redis, database, sync).
- **Horizon:** If the project uses Laravel Horizon (`laravel/horizon` in `composer.json`),
  check `config/horizon.php` for queue names, supervisors, and balancing strategies.

## Serialization rules

- Be careful when passing Eloquent models into queued jobs.
- Ensure the job still behaves correctly if the model changes between dispatch and execution.
- Prefer IDs or compact DTO-like payloads when this improves clarity or safety.
- Do not serialize closures, service instances, or large nested data structures.

## Idempotency and retries

- Assume queued jobs may run more than once.
- Write handlers so retries do not create corrupted state or duplicated side effects.
- Be especially careful with:
    - emails
    - external API calls
    - payments
    - imports
    - record creation
- Add explicit guards when duplicate execution would be harmful.

## Failure handling

- Follow existing project conventions for:
    - retry attempts
    - backoff
    - failed job logging
    - alerting / reporting
- Surface meaningful failures.
- Do not swallow exceptions silently.
- Use `failed()` behavior only when the project uses it and it adds value.

## Event rules

- Use events for meaningful occurrences, not for every internal method call.
- Event names should clearly describe what happened.
- Prefer past-tense naming for completed events, for example:
    - `OrderPlaced`
    - `InvoicePaid`
    - `UserRegistered`
- Keep event payloads focused and intentional.
- **Laravel 11+:** Events and listeners use automatic discovery — no manual registration needed.
  Discovery is configured in `bootstrap/app.php`. Do NOT manually register events in service providers.

## Listener rules

- A Listener should react to one event in one clear way.
- Keep listeners side-effect oriented.
- If a listener contains large business logic, delegate to a service/action.
- Do not build deep hidden chains of listeners unless the architecture already supports that complexity.

## Event-driven architecture rules

- Use events to decouple bounded responsibilities.
- Do not replace straightforward method calls with events when direct orchestration is clearer.
- Be careful when many listeners react to the same event — hidden behavior increases maintenance cost.
- Make side effects discoverable and understandable.

## Dispatching rules

- Use the dispatching style already established in the project.
- Be explicit about whether work runs:
    - immediately
    - after response
    - on the queue
- Do not change sync/async behavior casually in existing flows.

## Testing rules

- Test that jobs:
    - dispatch when expected
    - perform the expected side effect
    - handle important edge cases
- Use Laravel fakes where appropriate:
    - `Bus::fake()`
    - `Queue::fake()`
    - `Event::fake()`
- Do not only assert that something was dispatched — test meaningful behavior where appropriate.

## What NOT to do

- Do not put large workflows directly into controllers.
- Do not create events for trivial internal steps.
- Do not serialize unnecessary state into jobs.
- Do not ignore retries and duplicate execution risk.
- Do not hide critical business flows behind too many listeners.
- Do not swallow queue failures silently.

## Output expectations

When generating Laravel jobs/events code:

- keep jobs and listeners small and focused
- dispatch work intentionally
- use safe payloads for queues
- consider retries, failures, and idempotency
- name events clearly
- delegate large logic to services/actions
- match the project's queue and event conventions


## Gotcha

- Queued jobs serialize their constructor arguments — don't pass Eloquent models with loaded relations.
- The model forgets to implement `ShouldQueue` — without it, the job runs synchronously.
- Event listeners that throw exceptions block the event chain — use `ShouldQueue` on listeners too.
- Always set `$tries` and `$backoff` — unlimited retries can overwhelm the queue.

## Do NOT

- Do NOT put complex logic in event listeners — delegate to services.
- Do NOT use synchronous jobs for long-running tasks.
- Do NOT forget to handle job failures with failed() method.

## Auto-trigger keywords

- Laravel job
- queue
- event
- listener
- dispatch
- serialization
