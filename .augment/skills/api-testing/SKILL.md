---
name: api-testing
description: "Use when writing tests for API endpoints — integration tests, contract validation, response structure verification, and mocked external services."
source: package
---

# api-testing

## When to use

API endpoint tests: integration, contracts, response structure, external mocking.

## Test structure (Laravel / Pest)

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

## Gotcha: test YOUR rules not framework, explicit seed data, `Http::fake()` for externals, assert structure not just status.

## Do NOT: hardcode IDs, skip auth tests, assert entire response, `Http::fake()` without also testing real path.
