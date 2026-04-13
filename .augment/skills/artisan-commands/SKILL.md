---
name: artisan-commands
description: "Use when creating or modifying Artisan commands. Covers clear signatures, safe execution flow, helpful output, and project conventions for console tooling."
---

# artisan-commands

## When to use

Use this skill for Laravel console tooling, especially when working with:

- Artisan commands
- Maintenance scripts
- Imports / exports
- Batch processing
- Repair / cleanup tasks
- Scheduled command workflows
- Developer utility commands
- Operational commands

This skill extends `coder` and `laravel`.

## Before writing code

1. **Read the base skills first** — apply `coder` and `laravel`.
2. **Inspect existing commands** — match naming, signature style, output format, and dependency usage.
3. **Understand who runs the command** — developer, support, operations, cron, or scheduler.
4. **Check whether the command is interactive or automated**.
5. **Inspect related services** — console commands should orchestrate work, not own all business logic.
6. **Review scheduler usage** — if the command is intended for scheduled execution, ensure it behaves safely in unattended runs.

## Core principles

- Commands should be easy to discover, understand, and run.
- A command should orchestrate work, not contain large business workflows.
- Console output should be useful and concise.
- Interactive behavior should be intentional.
- Automated commands should be safe for non-interactive execution.

## Signature and naming rules

- Use clear, intention-revealing command names.
- Follow Laravel naming style, for example:
    - `users:cleanup`
    - `orders:sync`
    - `reports:generate`
- Define arguments and options explicitly.
- Provide meaningful descriptions.
- Do not create vague command names.

## Command structure rules

- Keep the command class focused.
- Use the command to:
    - accept input
    - validate execution conditions
    - orchestrate services/actions
    - report results
- Move heavy business logic into services/actions.
- Keep `handle()` readable and linear.

## Input rules

- Use arguments for required primary input.
- Use options for toggles, filters, and execution modes.
- Validate critical inputs before running expensive or destructive work.
- Provide safe defaults where appropriate.
- Be careful with destructive options such as `--force`.

## Output rules

- Print useful progress and result information.
- Keep output readable for both humans and logs.
- Use:
    - info
    - warn
    - error
    - table
    - progress indicators
      according to project style
- Do not flood the console with noisy output unless verbose mode is intended.

## Interactive command rules

- Use confirmations for destructive operations when appropriate.
- Ask questions only when the command is clearly intended for manual execution.
- Do not add interactive prompts to commands expected to run from the scheduler or CI.
- Support non-interactive execution where it matters.

## Batch and long-running command rules

- Be mindful of memory and query volume.
- Use chunking, cursors, or batching for large datasets.
- Report progress for long-running tasks when useful.
- Handle partial failures intentionally.
- Avoid loading large datasets into memory at once.

## Safety rules

- Treat cleanup, migration-like repair, sync, and deletion commands as high-risk.
- Add safeguards for destructive operations.
- Be explicit about dry-run behavior if supported.
- Do not perform irreversible work silently.

## Scheduling rules

- Commands intended for the scheduler should:
    - run non-interactively
    - be idempotent where possible
    - log/report useful status
    - fail loudly enough for monitoring
- Keep scheduler-facing commands stable and predictable.

## Error handling rules

- Fail with meaningful messages.
- Do not swallow exceptions silently.
- Return appropriate exit codes.
- Surface enough context to diagnose the issue without exposing sensitive data.

## Testing rules

- Test the command's behavior, not just the class existence.
- Assert:
    - exit codes
    - console output when meaningful
    - side effects
    - option/argument behavior
- Reuse services and factories according to the project's test style.

## What NOT to do

- Do not place large business workflows directly into commands.
- Do not make scheduled commands interactive.
- Do not run destructive operations without safeguards.
- Do not load huge datasets into memory carelessly.
- Do not produce vague or noisy console output.
- Do not hide important failures.

## Output expectations

When generating Artisan commands:

- use clear command names and signatures
- keep commands orchestration-focused
- validate input and execution safety
- provide useful console output
- support scheduled/non-interactive execution when needed
- delegate heavy logic to services/actions


## Gotcha

- Don't use `$this->info()` for important output — it's suppressed in quiet mode. Use `$this->line()` for critical info.
- Always add `--force` flag for destructive commands and check it — never delete data without confirmation.
- The model forgets to handle the case where the command is run in production — add environment checks.

## Do NOT

- Do NOT put business logic in commands — delegate to services.
- Do NOT use dd() or var_dump() in commands — use $this->info() / $this->error().
- Do NOT skip input validation in command signatures.

## Auto-trigger keywords

- artisan command
- console command
- CLI command
- command signature
