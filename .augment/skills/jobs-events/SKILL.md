---
name: jobs-events
description: "Use when creating Laravel jobs, queued workflows, events, or listeners. Covers clear responsibilities, safe serialization, and retry/failure handling."
---

# jobs-events

## When to use

Laravel jobs, queued workflows, events, listeners, subscribers, background processing, retry/failure handling. Extends `coder` and `laravel`.

## Before: base skills, inspect existing jobs/events/listeners, understand sync vs async, check queue config, check event patterns, inspect tests.

## Jobs: one responsibility, minimal constructor payload (IDs/DTOs over models), delegate to services. Queue: slow/retryable/non-blocking work only. Check queue driver (`.env`/`config/queue.php`) and Horizon config.

## Serialization: careful with Eloquent (models may change between dispatch/execution). Prefer IDs. No closures/services/large structures.

## Idempotency: assume multiple runs. Guard against duplicate emails, API calls, payments, record creation.

## Failures: follow conventions (retry attempts, backoff, logging). Surface failures. No silent swallowing.

## Events: meaningful occurrences, past-tense names (`OrderPlaced`). Laravel 11+: automatic discovery, no manual registration. Focused payloads.

## Listeners: one event, one reaction, side-effect oriented. Large logic → delegate to service. No deep hidden chains.

## Dispatching: match project style. Explicit sync/async/after-response. Don't casually change behavior.

## Testing: `Bus::fake()`, `Queue::fake()`, `Event::fake()`. Test side effects, not just dispatching.

## Gotcha: serialized args (no loaded relations), `ShouldQueue` required for async, listener exceptions block chain (use ShouldQueue), always set `$tries`/`$backoff`.

## Do NOT: complex logic in listeners, sync jobs for long tasks, skip `failed()` method, workflows in controllers, events for trivial steps, silent failures.
