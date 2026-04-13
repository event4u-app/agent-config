---
name: project-analysis-laravel
description: "ONLY when user explicitly requests: Laravel project analysis, upgrade readiness check, or full codebase health audit. NOT for regular bug fixes or feature work."
---

# Project Analysis — Laravel & PHP Packages

## When to use

- Deep analysis of project/package/module/monorepo for bugs, broken patterns, risks, upgrade blockers
- Codebase uses Laravel/Symfony/Composer packages needing understanding before changes
- Third-party package docs/changelog/source must be read for correct usage
- Root-cause analysis for runtime errors, queue/config/auth/cache/event/test failures
- Compatibility review before upgrading Laravel/PHP/key packages

NOT when: small isolated feature, purely visual/UI critique, superficial repo summary.

## Core principles

1. **Understand before judging** — no fixes before understanding structure/flow/version. Evidence from code/config/tests/logs over assumptions. No README? Search `.md` files across project.
2. **Detect versions first** — exact Laravel/PHP/dependency versions. `composer.lock` = source of truth. Fallback: `composer.json`, lock files, Dockerfile, CI, bootstrap.
3. **Read docs on demand** — official Laravel docs for INSTALLED version. Package docs/changelog/source for exact version. Official > blog posts.
4. **Trace actual paths** — routes → middleware → controllers → services → models → DB. Packages: providers, config, facades, contracts, macros.
5. **Focus on root causes** — distinguish symptoms from causes. Explain what/why/where/confidence/evidence.
6. **Rank by severity** — Critical/High/Medium/Low/Observation. Prioritize: user-facing failures, data corruption, security, queue/mail/cache misconfig, silent bugs.

## Before writing code

### 1. Map repository
App type: Laravel app, package, monorepo, hybrid, legacy, multi-service.
Key files: `composer.json/lock`, `artisan`, `bootstrap/app.php`, `config/*.php`, `routes/*.php`, `app/Providers/*`, `phpunit.xml`/`pest.php`, `README*`, `UPGRADE*`, `CHANGELOG*`, `Dockerfile*`, CI.

### 2. Technology matrix
PHP version, Laravel version, first-party packages (Horizon, Octane, Sanctum, Livewire, Nova, Filament, Scout, Cashier, Reverb, Pennant, Pulse, Telescope), important third-party packages, frontend tooling.

### 3. Local guidance
Read: project docs, architecture notes, `CLAUDE.md`, `AGENTS.md`, `README`, conventions, module docs. Respect unless causing defects.

### 4. Analysis mode
Bug investigation / Architecture audit / Package review / Upgrade readiness / Test reliability / Performance review / Security flow review.

## Laravel investigation workflow

### 1) Boot analysis

**Check:** Laravel+PHP compatibility, provider registration order, env-specific config, cache/config/route compilation, middleware stack, queue/cache/mail/broadcast/session/filesystem drivers.

**Look for:** Framework-version assumption errors, config read too early/cached wrong, env drift, route model binding surprises, global scopes/casts/observers side effects.

### 2) Request-to-response trace

Trace: Route → Middleware → FormRequest → Controller → Service → Model/Query/Transaction → Events/Jobs/Listeners → Response/Resource.

Verify: validation, authorization/policy, transaction boundaries, error handling/rollback, N+1, hidden state changes in observers.

### 3) Data & schema

**Inspect:** Migrations, relationships, indexes, soft deletes, defaults/nullables, enum/cast/JSON columns.
**Look for:** Code↔schema mismatch, unsafe cascading, missing indexes, data integrity hidden by app logic.

### 4) Async & infrastructure

**Inspect:** Queued jobs, failed jobs, Horizon/Supervisor, scheduled commands, broadcasting, cache invalidation, mail/notifications, HTTP integrations.
**Look for:** Invalid serialization, missing idempotency, retry duplication, timezone errors, stale cache keys.

### 5) Test posture

**Check:** Feature/unit/integration test quality, factories/seeders, RefreshDatabase/transactions/fakes/mocks, missing critical path tests.
**Look for:** Brittle implementation-coupled tests, over-mocking false confidence, missing regression coverage.

## Package analysis workflow

Per package affecting behavior:
1. **Identify** exact version from `composer.lock` + transitive deps
2. **Read** official docs, upgrade guide, changelog, source, published config/provider
3. **Map** project usage: facades, contracts, traits, macros, config keys, middleware, bindings, events
4. **Validate** integration matches documented lifecycle/version. Check outdated examples, breaking changes.
5. **Explain** precisely: project misuse vs outdated docs vs version mismatch vs missing setup vs package limitation

## Doc lookup rules

**Laravel:** Detect installed major version first. Read matching docs. Check upgrade guide for deprecated patterns. Note behavior changes across versions.

**Third-party:** Official docs/GitHub/release notes for installed version. If unavailable, closest version + mark uncertainty.

**Research:** Web search when package behavior/version compat/updates affect correctness. Primary sources preferred.

## Output format

### 1) Executive summary
What analyzed, main conclusion, highest-risk issues, confidence.

### 2) Environment matrix
PHP version, Laravel version, key packages+versions, runtime details.

### 3) Findings
Per finding: **Severity**, **Title**, **Why it matters**, **Evidence**, **Root cause**, **Fix**, **Confidence**.

### 4) Package & framework notes
Docs consulted, version constraints, upgrade/compat concerns.

### 5) Uncertainty
What unverified, remaining assumptions, next inspection steps.

## Common mistakes

| Mistake | Prevention |
|---|---|
| Assume latest Laravel docs | Detect version from lockfiles first |
| Misread package behavior | Read docs/changelog/source for installed version |
| Report symptoms not causes | Trace route→domain→data, find first broken assumption |
| Ignore boot/config | Inspect providers, config, env, cache, drivers |
| Miss package customization | Search project for config overrides, macros, bindings |
| Weak recommendations | Include impact, evidence, root cause, concrete fix |

## Integration

- **analysis-autonomous-mode** — routes here for Laravel deep dives
- **universal-project-analysis** — non-Laravel or multi-framework
- **bug-analyzer** — chain when bugs found
- **performance-analysis** — chain for bottlenecks
- **security-audit** — chain for auth/input/trust boundary issues

## Gotcha

- Full analysis expensive — only for initial orientation, not every conversation
- Results = snapshot — note date, goes stale
- No architectural changes without business context

## Do NOT

- Give Laravel advice without checking installed version
- Judge package behavior before reading docs/source
- Present guesses as facts
- Skip config/providers/queues/caches/env differences
- Recommend sweeping rewrites when targeted fix suffices
