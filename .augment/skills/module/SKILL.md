---
name: module
description: "Use when the user says "create module", "explore module", or works within app/Modules/. Understands module structure, auto-loading, route registration, and namespace conventions."
source: package
---

# module

## When to use

Working in `app/Modules/`. Before: `app/Modules/README.md`, `ModuleServiceProvider.php`, module `agents/`.

## Detection

Check if `app/Modules/` exists in the project. If it doesn't, the project doesn't use modules.

## Architecture

### ModuleServiceProvider

`app/Providers/ModuleServiceProvider.php` auto-discovers modules by scanning `app/Modules/`:

1. **Route loading** — automatically loads `Routes/api.php`, `Routes/web.php`, `Routes/console.php`
   - API routes: prefixed with `/api`, `api` middleware
   - Web routes: `web` middleware
   - Console routes: loaded via `require_once`
   - Fallback: also checks lowercase `routes/` for legacy modules
2. **Command registration** — auto-discovers commands in `App/Console/Commands/`
   - Fallback: also checks `Console/Commands/` for legacy modules

### Module structure

```
app/Modules/{ModuleName}/
├── App/                         # All application code (PSR-4)
│   ├── Console/Commands/        # Artisan commands (auto-registered)
│   ├── Enums/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Jobs/
│   ├── Models/
│   ├── Rules/
│   └── Services/
├── Routes/                      # Auto-loaded route files
│   ├── api.php
│   ├── web.php
│   └── console.php
├── Tests/                       # Module-specific tests
│   ├── Component/
│   ├── Integration/
│   └── Unit/
├── Docs/                        # Optional technical docs
├── agents/                      # Agent docs for this module
│   ├── features/
│   ├── roadmaps/
│   └── contexts/
└── README.md                    # Optional module description
```

**Important:** Directory names use capital letters (App, Routes, Tests) for PSR-4 compliance.

### Namespace convention

```
App\Modules\{ModuleName}\App\{Layer}\{Class}
```

Examples:
- `App\Modules\ClientSoftware\App\Services\ImportService`
- `App\Modules\ClientSoftware\App\Http\Controllers\Import\ImportDataController`
- `App\Modules\ClientSoftware\App\Console\Commands\ProcessImportUploadsCommand`

### Route conventions

```php
// Routes/api.php — auto-prefixed with /api by ModuleServiceProvider
Route::name('v1.')
    ->prefix('v1/{module-prefix}')
    ->group(function(): void {
        Route::get('/', [Controller::class, 'index'])->name('{module-prefix}.index');
    });
```

- Route prefix: **kebab-case** (e.g., `client-software`, `grafana`)
- Route names: **dot notation** (e.g., `v1.imports.index`)
- Module name: **PascalCase** (e.g., `ClientSoftware`, `Grafana`)

## Existing modules

| Module | Purpose |
|---|---|
| `ApiClient` | External API client utilities |
| `Backoff` | Retry/backoff logic |
| `ClientSoftware` | Client software imports, uploads, processing |
| `Grafana` | Grafana/Loki dashboard integration |
| `Stubbing` | Test stubs and mocks |

## Template

The `.module-template` directory provides a scaffold for new modules:
- `app/Modules/.module-template/` — copy and rename to create a new module
- Contains placeholder route files, README, and directory structure
- Replace `[MODULE_NAME]` and `[module-prefix]` placeholders

## Agent docs in modules

Modules can have their own agent documentation:

```
app/Modules/{Module}/agents/
├── features/       # Module-scoped feature plans
├── roadmaps/       # Module-scoped roadmaps
└── contexts/       # Module-scoped context documents
```

## Gotcha: namespace `App\Modules\{Name}\App\{Layer}` (extra `App`), auto-registered routes, shared code → `app/`.

## Do NOT: manual route registration, lowercase dirs, logic in controllers, module for trivial functionality.
