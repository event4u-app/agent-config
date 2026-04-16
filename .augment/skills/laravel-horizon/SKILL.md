---
name: laravel-horizon
description: "Use when configuring Laravel Horizon — queue dashboard, worker supervision, job metrics, balancing strategies, or production tuning."
source: package
---

# laravel-horizon

## When to use

Use this skill for anything related to Laravel Horizon:
- Queue worker configuration and supervision
- Horizon dashboard setup and access control
- Job metrics, throughput, and failure monitoring
- Balancing strategies and scaling workers
- Production tuning and deployment

For **writing queue jobs** themselves, see [jobs-events](../jobs-events/SKILL.md).

## Procedure: Configure Horizon

### config/horizon.php

```php
'environments' => [
    'production' => [
        'supervisor-1' => [
            'maxProcesses' => 10,
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
            'connection' => 'redis',
            'queue' => ['default', 'high', 'low'],
            'balance' => 'auto',  // auto, simple, or false
            'tries' => 3,
            'timeout' => 60,
            'maxTime' => 3600,
            'maxJobs' => 1000,
            'memory' => 128,
        ],
    ],
    'local' => [
        'supervisor-1' => [
            'maxProcesses' => 3,
            'connection' => 'redis',
            'queue' => ['default', 'high', 'low'],
            'balance' => 'auto',
            'tries' => 3,
            'timeout' => 60,
        ],
    ],
],
```

### Queue priority

```php
// Higher priority queues are listed first
'queue' => ['high', 'default', 'low'],
```

## Running Horizon

```bash
# Start Horizon (foreground)
php artisan horizon

# Pause / Continue
php artisan horizon:pause
php artisan horizon:continue

# Terminate gracefully (for deployments)
php artisan horizon:terminate

# Check status
php artisan horizon:status
```

## Deployment

**Always terminate and restart Horizon after deploying new code:**

```bash
php artisan horizon:terminate
# Supervisor will auto-restart Horizon
```

### Supervisor config (production)

```ini
[program:horizon]
process_name=%(program_name)s
command=php /path/to/artisan horizon
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/horizon.log
stopwaitsecs=3600
```

## Dashboard access

```php
// HorizonServiceProvider
protected function gate(): void
{
    Gate::define('viewHorizon', function (User $user): bool {
        return $user->isSuperuser();
    });
}
```

## Balancing strategies

| Strategy | Behavior |
|---|---|
| `auto` | Distributes workers based on queue workload (recommended) |
| `simple` | Round-robin across queues |
| `false` | Fixed worker count per queue |

## Metrics and monitoring

- **Throughput** — jobs processed per minute per queue
- **Runtime** — average job execution time
- **Wait time** — time jobs spend waiting in queue
- **Failed jobs** — track and retry from dashboard
- **Tags** — auto-tagged by Eloquent models, custom tags via `tags()` method

```php
// Custom tags on a job
public function tags(): array
{
    return ['customer:' . $this->customer->getId(), 'report'];
}
```

## Core rules

- **Always use Supervisor** in production — Horizon is a long-running process.
- **Terminate on deploy** — `horizon:terminate` ensures workers pick up new code.
- **Use `auto` balancing** — it adapts to workload automatically.
- **Set `maxTime`** — prevents workers from running forever (memory leaks).
- **Set `maxJobs`** — recycles workers after N jobs to prevent memory bloat.
- **Tag jobs** — makes debugging and filtering in the dashboard much easier.

## Auto-trigger keywords

- Horizon
- queue worker
- queue dashboard
- job monitoring
- supervisor
- queue balancing

## Output format

1. Updated Horizon configuration with supervisor and queue settings
2. Environment-specific balancing strategy rationale

## Gotcha

- Horizon config changes require `php artisan horizon:terminate` and restart — they don't hot-reload.
- Don't set `maxProcesses` too high — each process holds a DB connection. Monitor your connection pool.
- The model forgets that Horizon only works with Redis queues — not database or SQS.

## Do NOT

- Do NOT run Horizon without Supervisor/systemd in production.
- Do NOT expose the Horizon dashboard without access control.
