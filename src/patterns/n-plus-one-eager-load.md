---
applies_to: [laravel, eloquent]
reliability: high
last_verified: 2026-06-15
---

# N+1 query → eager load

## Problem

A loop renders a relationship per row, firing one query per iteration (the "+1"
× N). Pages feel fine on seed data and collapse under real row counts; the
symptom is latency that scales with list length, not a crash.

## Before

```php
$orders = Order::where('status', 'open')->get();
foreach ($orders as $order) {
    echo $order->customer->name; // 1 query per order
}
```

## After

```php
$orders = Order::where('status', 'open')->with('customer')->get();
foreach ($orders as $order) {
    echo $order->customer->name; // already loaded
}
```

For nested relations: `->with('customer.company')`. For a count without the
rows: `->withCount('items')`.

## Verification

Wrap the request in `DB::enableQueryLog()` (or Telescope / Clockwork) and assert
the query count is **constant** as N grows — not `N+1`. A feature test that
seeds 2 vs 20 rows and asserts the same query count locks it.

## Gotchas

- Eager-loading a relation the view never touches trades N+1 for one wasted
  join — only eager-load what the loop reads.
- `with()` on a paginated query still loads only the current page's relations —
  correct, not a bug.
- Conditional access (`$order->customer?->name`) inside the loop can still
  lazy-load if the relation was filtered out; eager-load with a constraint
  (`with(['customer' => fn ($q) => …])`) instead of guarding after the fact.
