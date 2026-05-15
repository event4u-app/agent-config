# Getting started — Laravel

> Laravel is the deepest reference stack in the package today. This page collects the Laravel-specific guidance previously embedded in the root README. The relocation is part of step-12 Phase 2; the root README continues to surface Laravel under the dev role until the Phase 6 identity rewrite lands.

## Why Laravel is the reference stack

Laravel ships with the broadest, battle-tested skill coverage in the package — Pest, PHPStan, Rector, Eloquent, Livewire / Flux, Horizon, Pulse, Reverb, Pennant. That coverage exists because the package was originally extracted from a Laravel monorepo (Galawork). Symfony and Next.js are the second tier (`symfony-workflow`, `nextjs-patterns`); other stacks ship as they are battle-tested, not second-class.

## Laravel-flavored skills

| Skill | What it covers |
|---|---|
| [`laravel`](../.agent-src/skills/laravel/SKILL.md) | Eloquent, Artisan controllers, FormRequests, jobs, events, policies, providers |
| [`eloquent`](../.agent-src/skills/eloquent/SKILL.md) | Models, relationships, scopes, query patterns |
| [`artisan-commands`](../.agent-src/skills/artisan-commands/SKILL.md) | Console command structure, signatures, safe execution |
| [`jobs-events`](../.agent-src/skills/jobs-events/SKILL.md) | Queued workflows, listeners, retry / failure handling |
| [`laravel-validation`](../.agent-src/skills/laravel-validation/SKILL.md) | Form Requests, rules, custom rule objects |
| [`laravel-middleware`](../.agent-src/skills/laravel-middleware/SKILL.md) | Request / response filtering, groups, priority |
| [`laravel-notifications`](../.agent-src/skills/laravel-notifications/SKILL.md) | Mail, Slack, database, custom channels |
| [`laravel-mail`](../.agent-src/skills/laravel-mail/SKILL.md) | Mailables, Markdown templates, queued sending |
| [`laravel-scheduling`](../.agent-src/skills/laravel-scheduling/SKILL.md) | Cron expressions, overlap prevention, maintenance mode |
| [`laravel-horizon`](../.agent-src/skills/laravel-horizon/SKILL.md) | Worker supervision, job metrics, balancing strategies |
| [`laravel-pulse`](../.agent-src/skills/laravel-pulse/SKILL.md) | Real-time dashboard, custom recorders, performance insights |
| [`laravel-reverb`](../.agent-src/skills/laravel-reverb/SKILL.md) | First-party WebSocket server, Pusher protocol compatibility |
| [`laravel-pennant`](../.agent-src/skills/laravel-pennant/SKILL.md) | Feature flags, gradual rollouts, A/B testing |

## Quality pipeline

The Laravel quality pipeline runs PHPStan + Rector + ECS, with Pest as the test runner:

- [`quality-tools`](../.agent-src/skills/quality-tools/SKILL.md) — PHPStan output triage, Rector apply, ECS fix.
- [`pest-testing`](../.agent-src/skills/pest-testing/SKILL.md) — Pest test authoring patterns.
- [`/quality-fix`](../.agent-src/commands/quality-fix.md) — runs the full pipeline and fixes reported errors.

## Docker and dev environment

- [`docker`](../.agent-src/skills/docker/SKILL.md) — Dockerfile, compose, dual-container (fast + Xdebug) setup.
- [`php-debugging`](../.agent-src/skills/php-debugging/SKILL.md) — Xdebug breakpoints, dual-container, header-based routing.
- [`traefik`](../.agent-src/skills/traefik/SKILL.md) — local reverse proxy, real domains on 127.0.0.1, mkcert HTTPS.

## Multi-tenancy and database

- [`multi-tenancy`](../.agent-src/skills/multi-tenancy/SKILL.md) — customer DB switching, FQDN routing, tenant isolation.
- [`database`](../.agent-src/skills/database/SKILL.md) — MariaDB / MySQL tuning, indexing, multi-connection patterns.
- [`sql-writing`](../.agent-src/skills/sql-writing/SKILL.md) — raw SQL, parameterization, raw migrations.

## Project analysis

- [`project-analysis-laravel`](../.agent-src/skills/project-analysis-laravel/SKILL.md) — boot flow, request lifecycle, container usage, async systems, Laravel-specific failure patterns.

## Install for a Laravel project

```bash
cd path/to/your/laravel/app
npx @event4u/agent-config init --tools=claude-code,cursor
```

The installer detects `composer.json` + `artisan` + the Laravel framework dependency, enables stack-aware skills, and writes `.agent-settings.yml` with sensible defaults. The first `/onboard` run captures your name, preferred IDE, and cost profile.

## Other PHP stacks

| Stack | Coverage |
|---|---|
| **Symfony** | [`symfony-workflow`](../.agent-src/skills/symfony-workflow/SKILL.md) — DI, Doctrine, Messenger, voters, Twig; [`project-analysis-symfony`](../.agent-src/skills/project-analysis-symfony/SKILL.md) |
| **Zend / Laminas** | [`project-analysis-zend-laminas`](../.agent-src/skills/project-analysis-zend-laminas/SKILL.md) + shared PHP coder / quality skills |
| **Framework-free PHP** | [`php-coder`](../.agent-src/skills/php-coder/SKILL.md) — modern idioms, SOLID refactors, type hints without framework lock-in |

## See also

- [`docs/getting-started-by-role.md`](getting-started-by-role.md) — pick the entry that matches your day-to-day.
- [`docs/getting-started.md`](getting-started.md) — generic three-step quickstart.
- [`docs/installation.md`](installation.md) — detailed install variants (npx, curl, global npm).
