# Galawork API

**A governed AI development layer** for the Galawork platform — a Laravel SaaS application for the landscaping industry.

## Agent Infrastructure

| Layer | Location | Purpose |
|---|---|---|
| **Shared package** | `.augment/` | Skills, rules, commands, guidelines, templates, contexts (read-only) |
| **Project overrides** | `agents/overrides/` | Project-specific customizations of shared resources |
| **Project docs** | `agents/` | Architecture docs, features, roadmaps, sessions, contexts |
| **Module docs** | `app/Modules/*/agents/` | Module-specific documentation |

### Key References

| What | Where |
|---|---|
| Behavior rules | `.augment/rules/` (always active) |
| Coding guidelines | `.augment/guidelines/php/` |
| Skills (on-demand expertise) | `.augment/skills/` |
| Commands (workflows) | `.augment/commands/` |
| Override system | `.augment/contexts/override-system.md` |
| Full infrastructure overview | `.augment/contexts/augment-infrastructure.md` |
| Copilot instructions | `.github/copilot-instructions.md` |

### Multi-Agent Support

Rules, skills, and commands are available for multiple AI coding tools:

| Tool | Rules | Skills | How |
|---|---|---|---|
| **Augment Code** | `.augment/rules/` | `.augment/skills/` | Native (source of truth) |
| **Claude Code** | `.claude/rules/` | `.claude/skills/` | Symlinks + Agent Skills standard |
| **Cursor** | `.cursor/rules/` | — | Symlinks |
| **Cline** | `.clinerules/` | — | Symlinks |
| **Windsurf** | `.windsurfrules` | — | Concatenated file |
| **Gemini CLI** | `GEMINI.md` | — | Symlink → AGENTS.md |

Skills follow the [Agent Skills open standard](https://agentskills.io) (SKILL.md with YAML frontmatter).
Commands are converted to Claude Code Skills with `disable-model-invocation: true`.

Regenerate: `task generate-tools` · Clean: `task clean-tools`

---

## Tech Stack

- **Framework:** Laravel 11 (PHP ^8.2)
- **Database:** MariaDB / MySQL (multi-tenant, customer-specific databases)
- **Queue:** Redis + Laravel Horizon
- **Search:** Meilisearch (to be removed)
- **Testing:** Pest (PHPUnit 11 under the hood)
- **Static Analysis:** PHPStan Level 9 (with Larastan)
- **Code Style:** ECS (Easy Coding Standard) — PSR-12 based
- **Refactoring:** Rector
- **Quality Tooling:** `galawork/php-quality` package (wraps ECS, Rector, PHPStan)
- **Editor Config:** `.editorconfig` is used — respect it

---

## Development Setup

The project runs in Docker. All commands are executed **inside the PHP container** unless stated otherwise.

```bash
# Start all containers
make start

# Enter the PHP container
make console

# Run composer install inside the container
make composer-install

# Run migrations + seed (local)
make migrate-and-seed

# Run migrations + seed (testing environment)
make migrate-testing

# Open Artisan tinker
make tinker
```

### Environment Files

| File                 | Purpose                                             |
|----------------------|-----------------------------------------------------|
| `.env`               | Main environment (auto-created from `.env.example`) |
| `.env.local`         | Local overrides (DB credentials, etc.)              |
| `.env.testing`       | Testing environment configuration                   |
| `.env.testing.local` | Local Testing environment configuration             |

Files are loaded in the listed order — each subsequent file overrides values from the previous one.
For testing: `.env` → `.env.testing` → `.env.testing.local`.

### Important: `--env=testing`

When running Artisan commands that should operate on the **testing database**, always pass `--env=testing`:

```bash
php artisan migrate --env=testing
php artisan db:seed --env=testing
php artisan db:seed --class=ApiDatabaseSeeder --env=testing
php artisan migrate:customers --fresh --env=testing
php artisan db:seed:customers --fqdn=local.galawork.de --env=testing
```

Or use the Makefile targets which handle this automatically:

```bash
make migrate-testing
make seed-testing
```

---

## Project Structure & Modules

Before creating new files, always check the existing directory structure (`app/`, `app/Modules/`, `tests/`)
to place code in the correct location. New features should preferably go into the appropriate module
in `app/Modules/`. Use `.module-template` as a starting point for new modules.

Key directories: `app/Http/Controllers/`, `app/Services/`, `app/Models/`, `app/Repositories/`,
`app/DTO/`, `app/Enums/`, `app/Events/`, `app/Jobs/`, `app/Policies/`, `app/Modules/`.

Module namespace pattern: `App\Modules\{ModuleName}\App\{Layer}\` (e.g. `App\Modules\Import\App\Services\`).
Module routes (`Routes/api.php`, `Routes/web.php`, `Routes/console.php`) are auto-loaded by `ModuleServiceProvider`.

See `app/Modules/README.md` and `docs/creating-a-new-module.md` for full details.

---

## Testing

### Test Framework: Pest

This project uses **Pest** as the test framework. All tests are written in Pest syntax.

### Running Tests

```bash
# Run all tests (parallel, fastest)
make test

# Run specific test suites
make test-unit              # Unit tests only
make test-component         # Component tests only
make test-integration       # Integration tests only

# Run with stop-on-failure for quick feedback
make test-quick

# Run a specific test file or filter
php artisan test --filter=YourTestName

# Run tests synchronously (useful for debugging)
make test-synchron
```

### Test Suites (defined in `phpunit.xml`)

| Suite        | Location                                                   | Purpose                           |
|--------------|------------------------------------------------------------|-----------------------------------|
| Unit         | `tests/Unit/`, `app/Modules/*/Tests/Unit/`                 | Isolated class tests, no DB       |
| Component    | `tests/Component/`, `app/Modules/*/Tests/Component/`       | Tests with real DB connections    |
| Integration  | `tests/Integration/`, `app/Modules/*/Tests/Integration/`   | Full HTTP request/response cycles |
| Architecture | `tests/Architecture/`, `app/Modules/*/Tests/Architecture/` | Structural/architecture tests     |

### Test Environment

- `phpunit.xml` sets `APP_ENV=testing`, `CACHE_DRIVER=array`, `QUEUE_CONNECTION=sync`
- Parallel testing is configured with 8 processes by default
- Use **seeders** for test data setup; model **factories** MAY be used in tests unless a module- or feature-specific agent doc (e.g.
  `agents/docs/seeders.md`) explicitly forbids factories for that area
- Mock external services using `Http::fake()` or Mockery
- Feature/integration tests are preferred over unit tests

### Test Guidelines

- Write clear, human-readable test names
- Focus on meaningful tests over 100% coverage obsession
- See `.augment/rules/php-coding.md` for Pest-specific rules (readonly, final, use statements)
- See `.augment/skills/pest-testing/SKILL.md` for flaky test prevention and best practices

---

## Quality Tools

Uses `galawork/php-quality` v2. Configs in project root: `phpstan.neon`, `ecs.php`, `rector.php`.

```bash
php artisan quality:phpstan          # PHPStan (Level 9)
php artisan quality:rector --fix     # Rector (auto-fix)
php artisan quality:ecs --fix        # ECS (auto-fix)
php artisan quality:finalize         # Full pipeline
```

**Do NOT add entries to `phpstan-baseline.neon`** — always fix the actual error.

See `.augment/rules/quality-workflow.md` for full workflow and policies.

---

## Additional Documentation

| Document | Topic |
|---|---|
| `.github/copilot-instructions.md` | Coding standards for GitHub Copilot (self-contained) |
| `.augment/contexts/augment-infrastructure.md` | Full agent infrastructure overview |
| `.augment/contexts/override-system.md` | How project overrides work |
| `app/Modules/README.md` | Module system documentation |
| `docs/creating-a-new-module.md` | Step-by-step module creation guide |
| `scripts/skill_linter.py` | Skill/rule/command linter (0 FAIL required) |
| `agents/roadmaps/` | Active roadmaps for agent infrastructure work |
