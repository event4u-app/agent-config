# Repository Pattern

> Only use when it solves a real problem. Eloquent already has many repository-like features built in.

## Purpose

Repositories encapsulate **complex or reusable** database queries. They keep controllers and
services clean by hiding query details behind expressive method names.

## Rule of Thumb

- **CRUD app** → usually no separate repository needed
- **Complex business app** → use selectively where it adds value
- **Never** create a repository automatically for every model

## When to Use a Repository

✅ **Multiple data sources** — DB + API + Cache behind one interface

✅ **Complex queries** — joins, subqueries, raw expressions, aggregations:

```php
// ✅ Good — complex query with joins, eager loading, raw ordering
class DatabasePlanningRepository
{
    public function findByDateAndCrewIds(CarbonInterface $date, array $crewIds): Collection
    {
        return Appointment::with([
                'project' => ['manager', 'capacityPlanningItem'],
                'plannedUsers' => fn ($q) => $q->where('termin_date', $date->format('Y-m-d')),
            ])
            ->selectRaw("*, IF(termin_uhrzeit IS NULL OR termin_uhrzeit = '00:00:00', 1, 0) as sort_order")
            ->whereDate('termin_date', $date)
            ->whereIn('tree_group_id', $crewIds)
            ->orderByRaw('termin_order, sort_order, termin_uhrzeit')
            ->get();
    }
}
```

✅ **Reusable queries** — same complex query needed in multiple services or controllers

✅ **Domain-centric access** — the method name documents business intent:

```php
$repository->findActiveEmployeesWithExpiredCertificates();
$repository->findOverdueAppointmentsByCustomer($customerId);
```

## When NOT to Use a Repository

❌ **Thin CRUD wrappers** — wrapping `findById`, `create`, `update`, `delete` around
Eloquent adds a layer with zero value. Eloquent already provides all of this:

```php
// ❌ Overengineering — don't do this
class UserRepository
{
    public function findById(int $id): ?User { return User::find($id); }
    public function create(array $data): User { return User::create($data); }
    public function delete(int $id): void { User::destroy($id); }
}

// ✅ Just use the model directly
$user = User::find($id);
$user = User::where('email', $email)->first();
$activeUsers = User::where('is_active', true)->get();
```

❌ **Single-use queries** — if a query is only used in one place and is not complex,
keep it inline in the service or controller.

## Better Alternatives for Simple Cases

Instead of a repository for every model, prefer:

- **Query Scopes** — reusable query fragments on the model itself
- **Services / Actions** — business logic with inline queries
- **Specialized query classes** — for one complex, reusable query

## Structure

- Namespace: `App\Repositories\{Domain}\` or `App\Modules\{Module}\App\Repositories\`
- Use an **interface** (contract) when the repository is injected via DI and may need mocking:

```php
// Contract
interface UserRepositoryContract
{
    public function findByCredentials(string $username, string $password): User;
}

// Implementation
class DatabaseUserRepository implements UserRepositoryContract
{
    public function findByCredentials(string $username, string $password): User
    {
        // complex query logic...
    }
}
```

- Bind interface → implementation in a ServiceProvider
- Do **NOT** mark repository classes `final` — they may need to be mocked in tests

## Naming

| Pattern                    | Example                              |
|----------------------------|--------------------------------------|
| Contract (interface)       | `UserRepositoryContract`             |
| Implementation             | `DatabaseUserRepository`             |
| Module repository          | `ClientSoftwareImportTemplateRepository` |

## Rules

- Return **typed** results: `Collection<int, Model>`, `?Model`, `Model`
- Throw domain exceptions (e.g., `EntityNotFoundException`) instead of returning `null`
  when the caller expects a result
- Use `@param` and `@return` DocBlocks for generic collection types
- Keep repositories focused — one repository per model/aggregate, not one giant "query bag"
- Prefer Eloquent/Query Builder over raw SQL

