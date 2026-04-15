---
name: artisan-commands
description: "Use when creating or modifying Artisan commands. Covers clear signatures, safe execution flow, helpful output, and project conventions for console tooling."
source: package
---

# artisan-commands

## When to use

Use when creating or modifying Laravel Artisan commands — maintenance scripts, imports/exports, batch processing, repair/cleanup, scheduled tasks, developer utilities.

Do NOT use when:
- Writing queue jobs (use `jobs-events` skill)
- Writing scheduled task config (use `laravel-scheduling` skill)

## Procedure: Create an Artisan command

### Step 0: Inspect

1. Check existing commands — match naming, signature style, output format.
2. Determine audience: developer, support, operations, cron, or scheduler.
3. Determine if interactive or automated.
4. Identify related services — commands orchestrate, not own business logic.

### Step 1: Scaffold

1. Create command class in `app/Console/Commands/` or module `App/Commands/`.
2. Name: `{domain}:{action}` — e.g. `users:cleanup`, `orders:sync`.
3. Define arguments (required) and options (toggles/filters) explicitly.

### Step 2: Implement handle()

1. Validate preconditions (environment, input, dependencies).
2. Call service/action for business logic.
3. Report progress and results via console output.
4. Return appropriate exit code.

### Step 3: Safety checks

- Destructive? → Add `--force` flag + confirmation.
- Scheduled? → Ensure non-interactive, idempotent, loud failures.
- Long-running? → Use chunking/cursors, progress bar.
- Production? → Add environment check if needed.

### Step 4: Test

- Assert exit codes, console output, side effects, option behavior.
- Use `$this->artisan()` in Pest tests.

## Conventions

→ See guideline `php/artisan-commands.md` for full conventions.

## Gotcha

- `$this->info()` is suppressed in quiet mode — use `$this->line()` for critical info.
- Always add `--force` for destructive commands — never delete data without confirmation.
- Add environment checks for production commands.

## Do NOT

- Do NOT run destructive operations without `--force` confirmation.
- Do NOT use `$this->ask()` for non-interactive commands (cron/queue).
- Do NOT put business logic in commands — delegate to services.

## Auto-trigger keywords

- artisan command
- console command
- CLI command
- command signature
