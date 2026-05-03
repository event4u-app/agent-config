# Artisan Command Guidelines

> Console command conventions — naming, structure, input/output, safety, scheduling.

**Related Skills:** `artisan-commands`
**Related Guidelines:** [patterns/service-layer.md](patterns/service-layer.md)

## Naming

- Clear, intention-revealing names: `users:cleanup`, `orders:sync`, `reports:generate`
- Follow Laravel naming style: `{domain}:{action}`

## Structure

- Commands **orchestrate** — they accept input, validate conditions, call services, report results.
- Heavy business logic belongs in services/actions, not in `handle()`.
- Keep `handle()` readable and linear.

## Input

- **Arguments** for required primary input.
- **Options** for toggles, filters, execution modes.
- Validate critical inputs before expensive/destructive work.
- Provide safe defaults where appropriate.
- Use `--force` flag for destructive commands — always check it.

## Output

- Use `$this->info()`, `$this->warn()`, `$this->error()`, `$this->table()`, progress bars.
- Keep output readable for both humans and logs.
- Don't flood the console — use verbose mode for noisy output.
- `$this->info()` is suppressed in quiet mode — use `$this->line()` for critical info.

## Interactive vs Automated

- Use confirmations for destructive operations in manual commands.
- **Never** add interactive prompts to scheduler/CI commands.
- Support non-interactive execution (`--no-interaction`).

## Batch and Long-Running

- Use chunking, cursors, or batching for large datasets.
- Report progress for long-running tasks.
- Handle partial failures intentionally.
- Avoid loading large datasets into memory at once.

## Safety

- Treat cleanup, repair, sync, and deletion as high-risk.
- Add safeguards for destructive operations.
- Be explicit about dry-run behavior if supported.
- Never perform irreversible work silently.
- Add environment checks for production commands.

## Scheduling

Commands for the scheduler must:
- Run non-interactively
- Be idempotent where possible
- Log/report useful status
- Fail loudly enough for monitoring

## Error Handling

- Fail with meaningful messages.
- Don't swallow exceptions silently.
- Return appropriate exit codes.
- Surface enough context to diagnose without exposing sensitive data.

## Testing

- Test behavior, not just class existence.
- Assert: exit codes, console output, side effects, option/argument behavior.

## Do NOT

- Put business logic in commands — delegate to services.
- Use `dd()` or `var_dump()` — use `$this->info()` / `$this->error()`.
- Skip input validation in command signatures.
- Make scheduled commands interactive.
- Run destructive operations without safeguards.
