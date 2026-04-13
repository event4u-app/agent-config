# Repository Pattern

Only when it solves real problems. CRUD → no repo. Complex business → selective. Never auto-create per model.

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

❌ **Thin CRUD wrappers** — zero value over Eloquent:

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

❌ **Single-use queries** — keep inline.

## Alternatives — Query Scopes, Services/Actions, specialized query classes

## Structure

- Namespace: `App\Repositories\{Domain}\` or `App\Modules\{Module}\App\Repositories\`
Interface when DI + mocking needed:

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

Bind in ServiceProvider. NOT `final` (mocking). Naming:

| Pattern                    | Example                              |
|----------------------------|--------------------------------------|
| Contract (interface)       | `UserRepositoryContract`             |
| Implementation             | `DatabaseUserRepository`             |
| Module repository          | `ClientSoftwareImportTemplateRepository` |

## Rules

- Typed returns. Domain exceptions > `null`. DocBlocks for generics. One per model/aggregate. Eloquent > raw SQL.

