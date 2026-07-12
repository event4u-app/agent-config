# Checklist — database / migration change

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches
migrations, schema, or query-heavy data-access code.

| Check | What to look for |
|---|---|
| **N+1 queries** | Relationship / association access in loops without eager / batch loading. |
| **Missing indexes** | New columns used in `WHERE` / `JOIN` without a supporting index. |
| **Unbounded queries** | Full-table reads (`Model::all()`, `SELECT *` without `LIMIT`, unpaged list endpoints). |
| **Raw SQL** | Parameterised queries only. No string concatenation with user input. |
| **Migrations** | Reversible (expand-contract, never a bare `DROP` on a populated column). Targets the right connection / schema. Idempotent where the platform supports it. |
| **Money / precision** | Uses an exact-precision type (PHP `decimal` / `Math` helper, TS bigint / decimal lib, Python `Decimal`), never `float`. |
| **Data backfill** | A migration that rewrites data has a rollback path and is safe to run against production volume (batched, not one giant `UPDATE`). |
| **Tenant scope** | New queries on tenant-owned tables carry the tenant scope; no cross-tenant leak. |

A schema migration that drops or renames a column is a **Tier-2** alignment
flag (blast radius across consumers) even when mechanically correct — surface
the rollback path per the engineering safety floor.
