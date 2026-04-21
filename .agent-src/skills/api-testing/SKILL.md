---
name: api-testing
description: "Use when writing API endpoint tests — integration tests, contract validation, response assertions, mocked external services — even when the user says 'test this route' without naming API testing."
source: package
---

# api-testing

## When to use

Use this skill when writing or reviewing API endpoint tests — integration tests,
contract validation, response structure checks, or external service mocking.

## Procedure: Write API tests

1. **Understand the endpoint** — Read controller, form request, existing tests. Understand expected behavior and edge cases before writing anything.
2. **Set up test data** — Use seeders (preferred) or factories. Mock external services with `Http::fake()`.
3. **Write test cases** — Cover success, validation errors, authorization failures, edge cases.
4. **Assert response** — Check status code, JSON structure, data values. Use `assertJsonStructure()`.
5. **Verify** — Run the test. Must pass. Check no flaky assertions (no time-dependent, no random ordering).

### Example

```php
describe('GET /api/v1/projects', function () {
    it('returns paginated projects for authenticated user', function () {
        $user = loginAsTestUser();

        $response = $this->getJson('/api/v1/projects');

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'title', 'status']],
                'meta' => ['current_page', 'per_page', 'total'],
            ]);
    });

    it('returns 401 for unauthenticated request', function () {
        $this->getJson('/api/v1/projects')
            ->assertUnauthorized();
    });

    it('returns 403 when user lacks permission', function () {
        loginAsRestrictedUser();

        $this->getJson('/api/v1/projects')
            ->assertForbidden();
    });
});
```

## Test categories

### Happy path

Test the expected success scenario with valid input:

```php
it('creates a project', function () {
    loginAsTestUser();

    $this->postJson('/api/v1/projects', [
        'title' => 'New Project',
        'customer_id' => $customerId,
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'New Project');

    $this->assertDatabaseHas('projects', ['title' => 'New Project']);
});
```

### Validation

Test that invalid input is rejected with correct error messages:

```php
it('rejects project without title', function () {
    loginAsTestUser();

    $this->postJson('/api/v1/projects', [
        'customer_id' => $customerId,
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['title']);
});
```

### Authorization

Test that unauthorized access is blocked:

```php
it('prevents non-owner from updating project', function () {
    $otherUser = loginAsOtherUser();

    $this->putJson("/api/v1/projects/{$project->id}", [
        'title' => 'Hijacked',
    ])
        ->assertForbidden();
});
```

### Edge cases

Test boundary conditions:

```php
it('handles empty collection', function () {
    loginAsTestUser();

    $this->getJson('/api/v1/projects')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('paginates large result sets', function () {
    loginAsTestUser();

    $this->getJson('/api/v1/projects?per_page=5')
        ->assertOk()
        ->assertJsonPath('meta.per_page', 5);
});
```

## Response contract validation

### Assert JSON structure

```php
// Verify response shape (keys exist)
$response->assertJsonStructure([
    'data' => ['id', 'title', 'status', 'created_at'],
]);

// Verify exact values
$response->assertJsonPath('data.status', 'active');

// Verify collection count
$response->assertJsonCount(3, 'data');
```

### Assert response types

```php
// When strict typing matters
$data = $response->json('data');
expect($data['id'])->toBeInt();
expect($data['title'])->toBeString();
expect($data['total'])->toBeString(); // Money as string, not float
```

## External service mocking

```php
it('handles external API failure gracefully', function () {
    Http::fake([
        'external-api.com/*' => Http::response(null, 500),
    ]);

    loginAsTestUser();

    $this->postJson('/api/v1/sync')
        ->assertStatus(502)
        ->assertJsonPath('message', 'External service unavailable');
});
```

## Test checklist per endpoint

| Category | Tests needed |
|---|---|
| **Auth** | Unauthenticated (401), unauthorized (403) |
| **Validation** | Missing fields, wrong types, boundary values |
| **Happy path** | Success with valid input, correct status code |
| **Response** | JSON structure, field types, pagination meta |
| **Side effects** | Database changes, events dispatched, jobs queued |
| **Edge cases** | Empty results, large payloads, concurrent access |

## Output format

1. Pest test file covering happy path, validation, auth, and edge cases
2. Test names as readable sentences describing expected behavior
3. Mocked external services where applicable

## Auto-trigger keywords

- API test
- endpoint test
- integration test
- response validation
- contract testing

## Gotcha

- Don't test framework internals (e.g., "does Laravel return 422 on validation error") — test YOUR validation rules.
- Always seed test data explicitly — don't rely on data from other tests (parallel execution).
- Mock external APIs with `Http::fake()` — never hit real services in tests.
- The model forgets to assert response structure, only checking status codes — always check both.

## Do NOT

- Do not hardcode IDs or timestamps — use factories or seeders.
- Do not skip auth tests — always test both authenticated and unauthenticated.
- Do not assert entire JSON responses — assert only meaningful fields.
- Do not use `Http::fake()` without also testing the real integration path.
