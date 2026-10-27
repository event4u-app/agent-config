# multi-tenancy — shared-schema integrity

> Reference for the [`multi-tenancy`](../SKILL.md) skill. The skill body covers
> the **database-per-tenant** mode; this file covers the **shared-schema** mode.

## When this applies

Two tenancy modes exist. **Database-per-tenant** gives each tenant its own
database or schema, so a foreign key cannot cross a tenant boundary — the
boundary is the connection, and the skill body governs it. **Shared-schema**
keeps every tenant's rows in the same tables, separated only by a `tenant_id`
column. There, a plain foreign key happily links tenant A's row to tenant B's
parent, and a global scope on the model does not stop it — the scope filters
reads, the constraint governs writes. Load this file when tenant tables share a
schema and carry `tenant_id`.

## The composite-key rule

| Side | Declare |
|---|---|
| Parent | `UNIQUE (tenant_id, id)` beside the primary key — a foreign key may only reference a primary key or unique constraint ([PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK)) |
| Child | `tenant_id` **in** the foreign key: `FOREIGN KEY (tenant_id, project_id) REFERENCES projects (tenant_id, id)` |

Declare the parent's unique key in the **same column order** as the reference
list. MySQL requires an index on the referenced table whose first columns are
the referenced columns in the same order
([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html));
`UNIQUE (id, tenant_id)` paired with `REFERENCES projects (tenant_id, id)` is
refused there. Matching the order is correct on PostgreSQL too, so use it on both.

Index the child's composite key explicitly. InnoDB creates an index for a
foreign key that has none
([MySQL 8.4](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html));
PostgreSQL does not, and without one every parent delete or key update scans the
child table
([PostgreSQL 17](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-FK)).
Declared explicitly, it also serves "this tenant's tasks of this project".

```php
Schema::create('projects', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('tenant_id')->constrained();
    $table->unique(['tenant_id', 'id']);
});

Schema::create('tasks', function (Blueprint $table): void {
    $table->id();
    $table->foreignId('tenant_id')->constrained();
    $table->unsignedBigInteger('project_id');
    $table->index(['tenant_id', 'project_id']);
    $table->foreign(['tenant_id', 'project_id'])
        ->references(['tenant_id', 'id'])->on('projects')
        ->restrictOnDelete();
});
```

## Worked example — the cross-tenant reference it rejects

```sql
INSERT INTO projects (id, tenant_id) VALUES (10, 1);   -- tenant 1's project
INSERT INTO projects (id, tenant_id) VALUES (20, 2);   -- tenant 2's project

INSERT INTO tasks (tenant_id, project_id) VALUES (1, 10);  -- accepted
INSERT INTO tasks (tenant_id, project_id) VALUES (1, 20);  -- REJECTED
```

The second insert names project 20, which exists — a single-column
`FOREIGN KEY (project_id) REFERENCES projects (id)` accepts it, and tenant 1 now
owns a task inside tenant 2's project. The composite key looks up
`(tenant_id, id) = (1, 20)`, finds no such parent, and the engine raises a
foreign-key violation. The leak becomes a write error instead of a data
incident.

Use it as the test: seed both projects, attempt the second insert, and assert
the foreign-key violation. A test that only checks the accepted insert proves
nothing about isolation.

## What this does not cover

- **`tenant_id` itself must be server-derived** — the constraint keeps a row
  consistent with its parent, not with the requester. A request that supplies
  `tenant_id = 2` and `project_id = 20` passes the key. The ownership check is
  [`authz-review`](../../authz-review/SKILL.md)'s.
- **Polymorphic children** cannot carry a foreign key at all; see
  [`eloquent.md` § Relationships and their constraints](../../../../docs/guidelines/php/eloquent.md#relationships-and-their-constraints).
- **Unique business keys** are scoped by tenant: `UNIQUE (tenant_id, email)`,
  never `UNIQUE (email)`. Under soft delete, see
  [`eloquent.md` § Unique constraints under soft delete](../../../../docs/guidelines/php/eloquent.md#unique-constraints-under-soft-delete).
