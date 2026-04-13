---
name: project-analysis-laravel
description: "ONLY when user explicitly requests: Laravel project analysis, upgrade readiness check, or full codebase health audit. NOT for regular bug fixes or feature work."
---

# Project Analysis for Laravel and PHP Packages

## When to use

Use this skill when:

- You need a deep analysis of a project, package, module, or monorepo to identify bugs, broken patterns, risks, code smells, or upgrade
  blockers.
- The codebase uses Laravel, Symfony components, Composer packages, or other PHP ecosystem dependencies that must be understood before
  making changes.
- A third-party package is used and its documentation, upgrade notes, changelog, or source behavior must be read to fully understand how the
  project should work.
- You want root-cause analysis for failing behavior, runtime errors, queue problems, config issues, migration problems, auth issues, caching
  issues, event/listener issues, or test failures.
- You want a compatibility review before upgrading Laravel, PHP, or key packages.

Do NOT use when:

- The task is only to implement a small isolated feature without any need for investigation.
- The request is purely visual/UI critique with no code, runtime, or architecture analysis.
- The user only wants a superficial summary of the repository contents.

## Core operating principles

1. **Understand before judging**
    - Do not propose fixes before understanding the project structure, runtime flow, package usage, and framework version.
    - Prefer evidence from code, config, tests, logs, stack traces, and official docs over assumptions.
    - If no obvious `README.md` exists, search for `.md` files across the project (`find . -name "*.md" -maxdepth 3`).
      Documentation is sometimes placed in non-standard locations (e.g., `AGENTS.md`, `docs/`, `agents/`, `.github/copilot-instructions.md`, module subdirectories).

2. **Detect versions first**
    - Determine the exact versions of Laravel, PHP, and important dependencies before analyzing behavior.
    - Use `composer.lock` as the source of truth when available.
    - Fall back to `composer.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `Dockerfile`, CI config, and framework bootstrap
      files when needed.

3. **Read documentation on demand**
    - If Laravel is present, read the official Laravel documentation for the matching major version whenever framework behavior matters.
    - If a package is important to the issue, identify its exact version and read the official package docs, changelog, upgrade guide, and
      relevant source code.
    - Prefer official docs and vendor source over blog posts.

4. **Trace actual execution paths**
    - Follow the real path through routes, middleware, controllers, actions, jobs, listeners, events, policies, requests, models, casts,
      observers, service providers, and config.
    - For packages, inspect service providers, published config, facades, contracts, macros, middleware, and boot-time registration.

5. **Focus on root causes**
    - Distinguish symptoms from root causes.
    - Explain what is broken, why it breaks, where it breaks, how confident you are, and what evidence supports the conclusion.

6. **Rank findings by severity**
    - Label findings as: Critical, High, Medium, Low, or Observation.
    - Prioritize user-facing failures, data corruption risks, security issues, queue/mail/cache misconfiguration, broken upgrade paths, and
      silent logic bugs.

## Before writing code

1. **Map the repository**
    - Identify app type: Laravel app, package, monorepo, hybrid app, legacy PHP app, or multi-service repo.
    - Inspect key files first:
        - `composer.json`
        - `composer.lock`
        - `artisan`
        - `bootstrap/app.php`
        - `config/*.php`
        - `routes/*.php`
        - `app/Providers/*`
        - `phpunit.xml*` / `pest.php`
        - `README*`
        - `UPGRADE*`, `CHANGELOG*`, `docs/*`
        - `Dockerfile*`, `docker-compose*`, CI workflows

2. **Determine the technology matrix**
    - Record PHP version constraints.
    - Record Laravel version.
    - Record first-party Laravel packages in use, for example Horizon, Octane, Sanctum, Passport, Livewire, Nova, Filament, Scout, Cashier,
      Reverb, Pennant, Pulse, Telescope.
    - Record important non-Laravel packages that shape architecture or behavior.
    - Record frontend/runtime tooling when relevant.

3. **Check for local guidance**
    - Read project docs, architecture notes, contributing guides, `CLAUDE.md`, `AGENTS.md`, `README`, internal conventions, and module-level
      docs.
    - Respect project-specific conventions unless they clearly cause defects.

4. **Choose the analysis mode**
    - Bug investigation
    - Architecture audit
    - Package integration review
    - Upgrade readiness review
    - Test reliability audit
    - Performance/configuration review
    - Security-sensitive flow review

## Laravel-specific investigation workflow

### 1) Framework and app boot analysis

Check:

- Laravel major version and PHP version compatibility
- Service providers and registration order
- Environment-specific config loading
- Cache/config/route/view compilation assumptions
- Middleware stack and route grouping
- Queue, cache, mail, broadcast, session, and filesystem drivers

Look for:

- Incorrect assumptions caused by framework-version differences
- Config values read too early or cached incorrectly
- Environment drift between local, CI, staging, and production
- Route model binding surprises
- Global scopes, casts, mutators, observers, and policy side effects

### 2) Request-to-response trace

For any bug or suspicious flow, trace:

- Route
- Middleware
- Form request / validation
- Controller / action / handler
- Service / domain layer
- Model / query / transaction layer
- Events, jobs, listeners, notifications
- Response transformation / resources / serialization

Always verify:

- Validation correctness
- Authorization and policy coverage
- Transaction boundaries
- Error handling and rollback behavior
- N+1 or eager loading problems
- Hidden state changes in observers or model events

### 3) Data and schema analysis

Inspect:

- Migrations
- Model relationships
- Index usage and uniqueness assumptions
- Soft delete behavior
- Default values and nullable mismatches
- Enum / cast / JSON column assumptions

Look for:

- Mismatches between code and schema
- Unsafe deletes or cascading surprises
- Missing indexes on hot queries
- Data integrity issues hidden by application logic

### 4) Async and infrastructure flows

Inspect when relevant:

- Queued jobs
- Failed jobs handling
- Horizon / Supervisor assumptions
- Scheduled commands
- Broadcasting / websockets
- Cache invalidation paths
- Mail / notifications
- External HTTP integrations

Look for:

- Jobs that serialize invalid state
- Missing idempotency
- Retry loops that duplicate effects
- Timezone and scheduling errors
- Cache keys with stale or inconsistent invalidation

### 5) Test posture

Check:

- Presence and quality of feature/unit/integration tests
- Factories, seeders, fixtures, and data realism
- Use of `RefreshDatabase`, transactions, fakes, and mocks
- Missing tests around critical paths and package integrations

Look for:

- Brittle tests coupled to implementation details
- False confidence from over-mocking
- Missing regression coverage for discovered bugs

## Package analysis workflow

When a package materially affects behavior, do all of the following before concluding:

1. **Identify the exact package and version**
    - Use `composer.lock` first.
    - Record the installed version and any relevant transitive dependencies.

2. **Read the package from authoritative sources**
    - Official documentation
    - Upgrade guide
    - Changelog / release notes
    - Source code for the used version
    - Published config and service provider behavior

3. **Map how the project uses the package**
    - Search for facade usage, contracts, traits, macros, config keys, middleware, commands, service container bindings, events, and
      extension points.
    - Distinguish default package behavior from project customizations.

4. **Validate integration assumptions**
    - Confirm the project uses the package according to the documented lifecycle and version.
    - Check for outdated examples copied from older docs.
    - Check for breaking changes between installed version and examples found online.

5. **Explain package-related findings precisely**
    - State whether the bug is caused by project misuse, outdated docs, version mismatch, missing setup, or a probable package limitation.

## Documentation lookup rules

### Laravel docs

- Detect the installed Laravel major version before citing framework behavior.
- Read the matching official docs first.
- If the project is on an older Laravel version, also check the latest upgrade guide or release notes to identify deprecated or risky
  patterns.
- When behavior changed across versions, explicitly say so.

### Third-party packages

- Prefer official docs, official GitHub repository, release notes, and tagged source.
- Match the package docs to the installed version whenever possible.
- If version-specific docs are unavailable, read the closest supported version and clearly mark uncertainty.

### Internet research standards

- Use web research whenever package behavior, framework changes, version compatibility, or recent updates could affect correctness.
- Favor primary sources.
- Do not rely on a random tutorial when official docs or source code exist.

## Output format

When reporting analysis, use this structure unless the user asked for another one:

### 1) Executive summary

- What was analyzed
- Main conclusion
- Highest-risk issues
- Confidence level

### 2) Environment and version matrix

- PHP version
- Laravel version
- Key packages and versions
- Relevant runtime/tooling details

### 3) Findings

For each finding include:

- **Severity**
- **Title**
- **Why it matters**
- **Evidence**
- **Root cause**
- **Recommended fix**
- **Confidence**

### 4) Package and framework notes

- Which docs were consulted
- Which version-specific constraints mattered
- Any upgrade or compatibility concerns

### 5) Missing information / uncertainty

- What could not be verified
- Which assumptions remain
- What to inspect next if deeper confirmation is needed

## Correct analysis patterns

```text
✅ Correct
- Detect Laravel and package versions before giving framework advice.
- Read official docs for the detected version.
- Trace the real execution path through the app.
- Separate direct evidence from inference.
- Rank findings by severity and confidence.

❌ Wrong
- Assume the latest Laravel behavior applies to an older project.
- Blame a package without reading its docs or source.
- Suggest broad refactors before locating the root cause.
- Treat symptoms, stack traces, and causes as the same thing.
- Ignore config, environment, queue, cache, or provider registration details.
```

## Common mistakes

| Mistake                                | Why it happens                                 | Prevention                                                                      |
|----------------------------------------|------------------------------------------------|---------------------------------------------------------------------------------|
| Assuming the latest Laravel docs apply | The analyzer skips version detection           | Detect Laravel version from lockfiles before using docs                         |
| Misreading package behavior            | The analyzer relies on memory or tutorials     | Read official docs, changelog, and source for the installed version             |
| Reporting symptoms instead of causes   | The analyzer stops at the first visible error  | Trace route-to-domain-to-data flow and identify the first broken assumption     |
| Ignoring boot/config issues            | Code review focuses only on controllers/models | Inspect providers, config, env assumptions, cache state, and runtime drivers    |
| Missing package customization          | The analyzer only reads vendor docs            | Search the project for config overrides, macros, bindings, and published assets |
| Weak recommendations                   | Findings are vague and not tied to evidence    | For each finding include impact, evidence, root cause, and concrete fix         |

## Integration with other skills

- **debugging** — use after a failing command, exception, test, or reproduction path has been identified.
- **upgrade-planning** — use when the analysis turns into a Laravel/PHP/package upgrade roadmap.
- **test-generation** — use to add regression coverage after root causes are confirmed.
- **security-review** — use when findings involve auth, policies, secrets, validation bypass, SSRF, deserialization, or unsafe file
  handling.

## Auto-trigger keywords

- analyze this Laravel project
- audit this package integration
- investigate this bug
- understand this Composer package
- review this upgrade risk
- find architecture problems
- inspect this Laravel app
- trace this runtime issue

## Integration with other skills

- **analysis-autonomous-mode** — routes here for Laravel-specific deep dives
- **universal-project-analysis** — use instead for non-Laravel or multi-framework projects
- **bug-analyzer** — chain when bugs are found during analysis (reactive or proactive mode)
- **performance-analysis** — chain when query or scaling bottlenecks are found
- **security-audit** — chain when auth, input handling, or trust boundary issues surface

## Gotcha

- Don't run a full analysis on every conversation — it's expensive and only useful for initial orientation.
- Analysis results are a snapshot — they go stale as code changes. Always note the date.
- Don't suggest architectural changes based on analysis alone — understand the business context first.

## Do NOT

- Do NOT give Laravel advice without checking the installed version.
- Do NOT judge package behavior before reading the relevant documentation or source.
- Do NOT present guesses as facts.
- Do NOT skip configuration, service providers, queues, caches, or environment differences.
- Do NOT recommend sweeping rewrites when a targeted fix is sufficient.
