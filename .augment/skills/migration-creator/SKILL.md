---
name: migration-creator
description: "Use when the user says "create migration", "add column", or "new table". Creates migrations with correct table prefixes, column naming, and multi-tenant awareness."
source: package
---

# migration-creator

## When to use

Use this skill when the user asks to create a database migration, add a column, create a table, or modify the schema.

## Procedure: Create a migration

Read `./agents/` and `AGENTS.md` for project-specific database conventions (table prefixes,
column naming, multi-tenant setup, dual-database architecture, etc.).

## All projects

- Use `decimal` for money — never `float`.
- Add indexes for columns used in WHERE clauses and JOINs.
- Match existing column naming patterns in the same table or domain.
- Always include a reversible `down()` method.

## Laravel projects

### Multi-database architecture

Some projects use multiple database connections. Check `config/database.php` for connections.

| Check | How |
|---|---|
| Available connections | `config/database.php` → `'connections'` array |
| Migration directories | `database/migrations/` (default), check for additional directories |
| Custom migrate commands | `php artisan list migrate` — look for project-specific commands |

**Always determine which database the table belongs to before creating a migration.**

### API database migration

```bash
php artisan make:migration create_example_table
```

```php
return new class extends Migration {
    public function up(): void
    {
        Schema::connection('api_database')->create('example_table', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('customer_id');
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('customer_id')
                ->references('id')
                ->on('customers')
                ->onDelete('cascade');

            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::connection('api_database')->dropIfExists('example_table');
    }
};
```

### Customer database migration

```bash
php artisan make:migration:customer AddWeatherColumn --table=cl_lv_weather
```

Customer database tables use the `cl_` prefix (e.g. `cl_user`, `cl_lv_weather`).

### Adding a column (with explicit connection)

```php
return new class extends Migration {
    public function up(): void
    {
        Schema::connection('my_connection')->table('example', function (Blueprint $table): void {
            $table->unsignedInteger('new_column')->after('existing_column');
        });
    }

    public function down(): void
    {
        Schema::connection('my_connection')->table('example', function (Blueprint $table): void {
            $table->dropColumn('new_column');
        });
    }
};
```

### Running migrations

```bash
# Default connection
php artisan migrate                           # development
php artisan migrate --env=testing             # testing

# Multi-tenant / custom — check AGENTS.md or module docs for project-specific commands
# Example: php artisan migrate:tenants, php artisan migrate --database=tenant
```

## Composer / legacy projects

- Check where existing migrations live (e.g. `core/migrations/`).
- Use the existing migration format and naming conventions in the project.

## Column conventions

- Foreign keys: `{entity}_id` (e.g. `customer_id`, `user_id`)
- Booleans: `is_` prefix (e.g. `is_active`, `is_default`)
- Dates: descriptive suffix (e.g. `upload_date`, `deleted_at`)
- Always use `unsignedBigInteger` for foreign keys referencing `id()` columns
- Use `->after('column')` to place new columns logically

## Gotcha

- Always check if the table/column already exists before creating the migration — the model doesn't always check.
- Multi-tenant migrations need special handling — customer tables use different prefixes.
- Don't modify existing migrations that have been deployed — create a new migration instead.
- The model forgets `->after('column')` for column ordering — MariaDB respects it, and it matters for readability.

## Do NOT

- Do NOT create migrations without specifying the correct connection when multiple databases exist.
- Do NOT create tables without checking the project's naming conventions (prefixes, casing).
- Do NOT use raw SQL in migrations when Schema builder works.
- Do NOT forget to make migrations reversible (down method).
- Do NOT use `float` for money — use `decimal`.
- Do NOT forget indexes on foreign keys and frequently filtered columns.

## Adversarial review

Before finalizing a migration, run the **`adversarial-review`** skill.
Focus on the "Database migrations" attack questions: Can this destroy data? Is rollback possible?

## Auto-trigger keywords

- database migration
- create migration
- table prefix
- column naming
- add column
- create table
