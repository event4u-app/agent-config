---
name: artisan-commands
description: "Use when creating or modifying Artisan commands. Covers clear signatures, safe execution flow, helpful output, and project conventions for console tooling."
---

# artisan-commands

## When to use

Artisan commands, maintenance scripts, imports/exports, batch processing, scheduled tasks. Extends `coder`, `laravel`.

## Before: base skills, existing commands, who runs it (dev/ops/cron), interactive vs automated, related services, scheduler safety.

## Principles: orchestrate (don't own logic), useful concise output, intentional interactivity, safe for automation.

## Naming: `{domain}:{action}` (`users:cleanup`). Explicit args/options, meaningful descriptions.

## Structure: `handle()` = accept input → validate → orchestrate services → report. Heavy logic → services.

## Input: args=required, options=toggles/filters. Validate before destructive work. Safe defaults. `--force` for destructive.

## Output: info/warn/error/table/progress. Readable for humans+logs. No noisy output.

## Interactive: confirmations for destructive only. No prompts in scheduled/CI commands.

## Batch: chunking/cursors, progress reporting, handle partial failures, don't load all in memory.

## Safety: high-risk commands (cleanup/sync/delete) get safeguards, dry-run support, no silent irreversible work.

## Scheduling: non-interactive, idempotent, log status, fail loudly.

## Errors: meaningful messages, exit codes, no swallowed exceptions.

## Testing: exit codes, output, side effects, option behavior.

## Gotcha: `$this->info()` suppressed in quiet mode (use `$this->line()`), `--force` for destructive, environment checks for production.

## Do NOT: business logic in commands, dd()/var_dump(), skip input validation, interactive prompts in scheduled commands.

## Auto-trigger keywords

- artisan command
- console command
- CLI command
- command signature
