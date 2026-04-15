# Naming Guidelines

> Naming conventions — PHP classes, database, routes, variables, modules, agent infrastructure.

**Related Skills:** none (naming is a convention — use this guideline directly)
**Related Guidelines:** [controllers.md](controllers.md), [resources.md](resources.md)

## PHP Classes

| Type | Pattern | Example |
|---|---|---|
| Controller | `{Action}{Entity}Controller` | `CreateProjectController` |
| FormRequest | `{Action}{Entity}Request` | `UpdateProjectRequest` |
| Resource | `{Entity}Resource` | `ProjectResource` |
| Minimal Resource | `{Entity}MinimalResource` | `ProjectMinimalResource` |
| Simple Resource | `Simple{Entity}Resource` | `SimpleUserResource` |
| Service | `{Domain}Service` | `ImportService` |
| DTO | `{Entity}{Purpose}Dto` | `ProjectCreateDto` |
| Job | `{Action}{Entity}Job` | `SyncCustomerJob` |
| Event | `{Entity}{PastTense}` | `ProjectCreated` |
| Enum | `{Entity}{Concept}` | `ImportStatus` |
| Policy | `{Entity}Policy` | `ProjectPolicy` |
| Interface | `{Capability}` (no suffix) | `SmsProvider` |

**Controller special cases:** List uses **plural** (`ListProjectsController`), all others singular.

## Database

| Element | Convention | Example |
|---|---|---|
| Tables | snake_case, plural | `projects`, `import_rows` |
| Columns | snake_case | `created_at`, `user_id` |
| Foreign keys | `{entity}_id` | `project_id` |
| Booleans | `is_` or `has_` prefix | `is_active`, `has_permission` |
| Timestamps | `_at` suffix | `synced_at`, `imported_at` |
| Pivot tables | Alphabetical, singular | `project_user` |

## Routes

| Element | Convention | Example |
|---|---|---|
| URL segments | kebab-case, plural | `/api/v1/import-uploads` |
| Route names | dot notation | `v1.import-uploads.index` |
| Route params | camelCase | `{importUpload}` |
| API versioning | Prefix | `/api/v1/`, `/api/v2/` |

## Variables

| Element | Convention | Example |
|---|---|---|
| Variables | camelCase | `$projectId` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES` |
| Array keys | snake_case | `['user_id' => 1]` |
| Config keys | snake_case, dot notation | `config('import.max_rows')` |
| Env vars | UPPER_SNAKE_CASE | `APP_ENV` |

## Modules

| Element | Convention | Example |
|---|---|---|
| Directory | PascalCase | `app/Modules/Import/` |
| Namespace | `App\Modules\{Name}\App\` | `App\Modules\Import\App\Services\` |
| Route prefix | kebab-case | `import`, `client-software` |

## Agent Infrastructure

| Element | Convention | Example |
|---|---|---|
| Skills | kebab-case | `bug-analyzer` |
| Rules | kebab-case | `php-coding` |
| Commands | kebab-case | `feature-plan` |
| Guidelines | kebab-case | `controllers.md` |

## Enums

- PascalCase class name
- UPPERCASE cases: `case PENDING;`, `case IN_PROGRESS;`
- Backed enums for DB values: `case PENDING = 'pending';`

## Interfaces

- Namespace: `App\Contracts\{Subdomain}\`
- No `Interface` suffix: `SmsProvider`, not `SmsProviderInterface`

## Do NOT

- Use abbreviations that aren't universally understood.
- Mix naming conventions within the same context.
- Use generic names (Manager, Helper, Utils) without specificity.
