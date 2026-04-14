---
name: multi-tenancy
description: "Use when working with the multi-tenant architecture — customer DB switching, FQDN routing, tenant isolation, or cross-tenant operations."
source: package
---

# multi-tenancy

## When to use

Tenant data, customer DB connections, dual-database architecture. NOT for: single-DB, frontend-only.

## Before: `agents/docs/` for architecture, `config/database.php` for connections, search tenant switching service.

## Architecture overview

```
Request → Identify Tenant (JWT / subdomain / API key)
        → Lookup credentials from central database
        → Reconfigure tenant connection at runtime
        → All tenant queries use tenant connection
```

### Dual-database pattern

| Connection type | Purpose | Scope |
|---|---|---|
| Central / shared | Global data — tenants, config, shared resources | Shared across all tenants |
| Tenant / customer | Tenant-specific data — domain entities | One per tenant |

The central connection is typically the **default connection**.
The tenant connection starts **empty** and is configured dynamically per request.

### Additional connections

Projects may have additional connections for admin operations, provisioning, or monitoring. Check `config/database.php`.

## Tenant switching: stores context → loads config → sets monitoring → reconfigures DB → binds services.

## Model conventions

### Setting `$connection`

Every model **must** explicitly set its connection:

```php
// Central models
class Tenant extends Model
{
    protected $connection = 'central_database';
}

// Tenant models
class Project extends Model
{
    protected $connection = 'tenant_database';
}
```

Check the project for the actual connection names and namespace conventions.

## Isolation: never query before tenant set, never mix connections, always set `$connection`, transactions per connection, artisan commands need tenant trait.

## Testing: dedicated tenant seeders, testing DB may consolidate connections, never assume tenant state.

## Common pitfalls

| Problem | Solution |
|---|---|
| Query on `customer_database` returns empty | Customer not set yet — check middleware order |
| Race condition in parallel tests | Each test process gets its own DB (parallel testing with separate DBs) |
| Wrong tenant data in background jobs | Serialize customer ID, re-resolve in job's `handle()` method |
| Migration on wrong connection | Specify `--database=customer_database` or set `$connection` in migration |


## Auto-trigger keywords

- multi-tenant
- tenant isolation
- customer database
- FQDN routing

## Gotcha: cross-tenant leaks are critical, switch back after tenant ops, restore tenant context in jobs, use switching helpers not raw `DB::connection()`.

## Do NOT: hardcode DB names, assume customer_database in early boot, tenant data before customer identification, credentials in code.
