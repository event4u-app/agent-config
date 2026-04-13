---
name: laravel-scheduling
description: "Use when configuring Laravel task scheduling — cron expressions, frequency helpers, overlap prevention, maintenance mode, or output handling."
---

# laravel-scheduling

## When to use

Recurring tasks: command scheduling, job dispatch, closures, overlap prevention.

## Defining schedules

### In routes/console.php (Laravel 11+)

```php
use Illuminate\Support\Facades\Schedule;

Schedule::command('reports:generate')->dailyAt('06:00');
Schedule::command('telescope:prune --hours=48')->daily();
Schedule::command('queue:prune-batches --hours=48')->daily();
Schedule::job(new CleanupTemporaryFiles())->hourly();
```

### Frequency helpers

| Method | Schedule |
|---|---|
| `->everyMinute()` | Every minute |
| `->everyFiveMinutes()` | Every 5 minutes |
| `->everyFifteenMinutes()` | Every 15 minutes |
| `->hourly()` | Every hour |
| `->hourlyAt(17)` | Every hour at :17 |
| `->daily()` | Daily at midnight |
| `->dailyAt('13:00')` | Daily at 1 PM |
| `->twiceDaily(1, 13)` | Daily at 1 AM and 1 PM |
| `->weekly()` | Weekly on Sunday at midnight |
| `->weeklyOn(1, '8:00')` | Weekly on Monday at 8 AM |
| `->monthly()` | Monthly on the 1st at midnight |
| `->monthlyOn(4, '15:00')` | Monthly on the 4th at 3 PM |
| `->quarterly()` | Quarterly |
| `->yearly()` | Yearly |

### Cron expressions

```php
Schedule::command('reports:generate')->cron('0 6 * * 1-5'); // Weekdays at 6 AM
```

## Overlap prevention

```php
// Prevent overlapping — skip if previous instance is still running
Schedule::command('import:customers')->hourly()->withoutOverlapping();

// With custom expiration (minutes)
Schedule::command('import:customers')->hourly()->withoutOverlapping(30);
```

## Conditional scheduling

```php
// Only in production
Schedule::command('reports:send')->daily()->environments(['production']);

// Custom condition
Schedule::command('sync:data')->hourly()->when(function () {
    return Config::boolean('services.sync.enabled');
});

// Skip condition
Schedule::command('emails:send')->daily()->skip(function () {
    return app()->isDownForMaintenance();
});
```

## Output handling

```php
// Log output to file
Schedule::command('reports:generate')
    ->daily()
    ->appendOutputTo(storage_path('logs/reports.log'));

// Email output on failure
Schedule::command('import:data')
    ->daily()
    ->emailOutputOnFailure('admin@example.com');
```

## Maintenance mode

```php
// Run even during maintenance mode
Schedule::command('queue:work')->everyMinute()->evenInMaintenanceMode();
```

## Running the scheduler

```bash
# The scheduler itself runs every minute via system cron
* * * * * cd /path-to-project && php artisan schedule:run >> /dev/null 2>&1

# Test locally
php artisan schedule:work   # Runs scheduler in foreground
php artisan schedule:list   # Show all scheduled tasks
php artisan schedule:test   # Run a specific task interactively
```

## Grouped schedules

```php
// routes/console.php — include schedule groups
Schedule::group('reports.php');
Schedule::group('imports.php');

// routes/console/reports.php
Schedule::command('reports:daily')->dailyAt('06:00');
Schedule::command('reports:weekly')->weeklyOn(1, '07:00');
```

## Core rules

- **Always use `withoutOverlapping()`** for long-running tasks.
- **Use `environments()`** to restrict production-only tasks.
- **Log output** for debugging — use `appendOutputTo()`.
- **Group related schedules** in separate files under `routes/console/`.
- **Monitor failures** — use `emailOutputOnFailure()` or Horizon for queued jobs.
- **One cron entry** — only `schedule:run` goes in crontab, everything else in Laravel.

## Gotcha: cache lock clear = overlapping, `runInBackground()` for long tasks, no per-minute unless needed.

## Do NOT: multiple cron entries, heavy work directly (queue it), skip withoutOverlapping, hardcode times.
