---
name: module-management
description: "Use when working within any module under the project's configured `modules.root_paths` — Laravel HMVC, Symfony DDD-lite, Node monorepo, Python src layout, Go internal/, or a custom path. Reads roots from `.agent-project-settings.yml` instead of hardcoding `app/Modules/`."
source: package
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# module

## When to use

Use this skill when creating, exploring, or working within a module under
any directory listed in `modules.root_paths` (team setting in
`.agent-project-settings.yml`). The skill is stack-agnostic — Laravel
HMVC, Symfony DDD-lite, Node monorepo, Python src layout, Go internal/,
or a custom path all flow through the same procedure with a
stack-specific carve-out at the bottom.

When `modules.enabled` is `false` (the default) the skill is a no-op —
the project does not opt into module-aware behavior.

## Procedure: Work with modules

1. Read `modules:` block from `.agent-project-settings.yml` via the
   loader (`get_modules_config()` in `scripts/_lib/agent_settings.py`).
2. For each path in `modules.root_paths`, read the module's `README.md`
   (or `package.json` / `pyproject.toml` description) for purpose.
3. If module-level agent docs exist under
   `{module_root}/{modules.agent_folder}/` (default `agents/`), read them.
4. Match the stack carve-out below by `modules.namespace_template` shape
   or root-path heuristic — apply stack-specific conventions on top of
   the generic procedure.

## Detection (fallback when `modules:` block is empty)

When `modules.enabled` is unset / false, the skill consults the
auto-detection table in
[`/module explore` Step 1](../../commands/module/explore.md) — same six
stack shapes, fallback only. The skill never writes the `modules:`
block automatically; that is `propose_modules_config.py` plus user
confirmation per
[`/agents init`](../../commands/agents/init.md) Step 7.

## Generic module structure

```
{module_root}/{ModuleName}/
├── <stack-native source layout>      # see carve-out below
├── tests/                            # module-specific tests
├── README.md                         # module description
└── {modules.agent_folder}/           # default: agents/
    ├── features/                     # module-scoped feature plans
    ├── roadmaps/                     # module-scoped roadmaps
    └── contexts/                     # module-scoped context docs
```

The agent-folder name comes from `modules.agent_folder` (default
`agents`). Skip directories listed in `modules.skip_dirs` (default
`.module-template`, `.example`).

## Stack carve-outs

Apply the section that matches the project's
`modules.namespace_template` and root-path layout.

### Laravel HMVC carve-out

**Triggers when:** `modules.namespace_template` starts with
`App\Modules\` or root path is `app/Modules`.

```
app/Modules/{ModuleName}/
├── App/                              # PSR-4 source (capitalized)
│   ├── Console/Commands/             # auto-registered
│   ├── Http/{Controllers,Middleware,Requests}/
│   ├── Jobs/  Models/  Services/  Rules/  Enums/
├── Routes/                           # auto-loaded
│   ├── api.php   web.php   console.php
├── Tests/{Unit,Integration,Component}/
└── agents/
```

**Namespace:** `App\Modules\{ModuleName}\App\{Layer}\{Class}` — note the
extra `App` segment.

**Auto-loading:** `app/Providers/ModuleServiceProvider.php` scans
`app/Modules/` and registers routes (`Routes/api.php` → `/api` prefix +
`api` middleware; `Routes/web.php` → `web` middleware) plus Artisan
commands under `App/Console/Commands/`.

**Route conventions:**

```php
// Routes/api.php — auto-prefixed /api
Route::name('v1.')->prefix('v1/{module-prefix}')->group(function(): void {
    Route::get('/', [Controller::class, 'index'])->name('{module-prefix}.index');
});
```

Module name = PascalCase. Route prefix = kebab-case. Route names = dot
notation.

### Symfony DDD-lite carve-out

**Triggers when:** `modules.namespace_template` starts with `App\` (no
`Modules` segment) or root path is `src/` with `<Domain>/` subdirs.

```
src/{Domain}/
├── Application/                      # use cases, command handlers
├── Domain/                           # entities, value objects
├── Infrastructure/                   # adapters, repositories
├── UserInterface/                    # controllers, console
└── Tests/
```

**Namespace:** `App\{Domain}\{Layer}\{Class}` — no extra segment.

**Auto-loading:** Symfony service container auto-wires each
`{Domain}/` subtree per `services.yaml` resource imports.

### Node monorepo carve-out

**Triggers when:** root path is `packages/` and each child has
`package.json`.

```
packages/{pkg-name}/
├── package.json
├── src/                              # entry points re-exported via "main"
├── tests/   __tests__/
└── README.md
```

**Module identity** comes from `package.json#name`, not the directory
name. The agent folder still lives at
`packages/{pkg-name}/{modules.agent_folder}/`.

### Python src-layout carve-out

**Triggers when:** root path is `src/` and each child has `__init__.py`.

```
src/{package_name}/
├── __init__.py
├── <module files>
└── tests/                            # or root-level tests/{package_name}/
```

**Namespace** is the import path: `{package_name}.<sub>.<class>`. Project
metadata in `pyproject.toml`.

### Go internal carve-out

**Triggers when:** root path is `internal/` (one-level structure).

```
internal/{pkgname}/
├── *.go                              # package files
└── *_test.go                         # tests colocated
```

**Import path:** `{module-path-from-go.mod}/internal/{pkgname}`. No
top-level grouping — each subdir of `internal/` is its own package.

## Output format

1. Module directory under the matched stack carve-out.
2. Stack-native auto-loading + routing (if applicable).
3. Optional per-module `{modules.agent_folder}/` scaffold.

## Auto-trigger keywords

- module structure
- module creation
- module namespace
- create / explore module
- per-module agent docs

### Validate

- Verify namespace matches `modules.namespace_template` (when set).
- Run stack-native auto-loading check (e.g. `php artisan route:list` for
  Laravel HMVC, `bin/console debug:container` for Symfony,
  `npm test --workspace=<pkg>` for Node monorepo).
- Run module tests — must pass.
- Run quality tools scoped to the new path.

## Gotcha

- **Laravel HMVC only** — namespace has the extra `App` segment
  (`App\Modules\X\App\…`). Other stacks do **not**.
- Routes auto-register in Laravel HMVC and Symfony — don't register
  manually.
- Shared code lives outside module roots — never inside
  `modules.root_paths`.
- Capitalize directory names only where the stack requires it (Laravel
  PSR-4 yes, Node `packages/` no).

## Do NOT

- Do NOT hardcode any stack-specific module root (Laravel
  `<app>/<Modules>/`, Symfony `src/Domain`, Node `packages/`, …) in
  skill bodies, commands, or context docs — read from
  `modules.root_paths`.
- Do NOT create a module for trivial functionality — only when logical
  separation is needed.
- Do NOT register module routes manually when the stack provides
  auto-loading.
- Do NOT add the `framework: laravel` frontmatter back to this skill —
  the lint guard fails the build.
