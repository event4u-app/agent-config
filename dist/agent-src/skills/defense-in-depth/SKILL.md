---
model_tier: high
name: defense-in-depth
description: "Use when validation needs entry, business-logic, environment, and instrumentation guards so a bad value cannot reach the failure point — turns a local bug fix into a structural one."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# defense-in-depth

Validate at every layer the value passes through. Fixing the bug at one layer is locally sufficient and globally fragile — the next refactor, code path, mock, or platform edge case will rediscover it. Four-layer validation makes the bug *structurally* impossible.

## When to use

- Bug fix where invalid data caused failure several frames deep.
- New entry point that funnels external input into existing internals.
- Refactor that adds a second caller to a previously single-caller routine.
- Test setup that shortcuts production guards (mocks bypassing entry validation).

Do NOT use when:

- Pure formatting / style change — no data flow, no layers to defend.
- Boundary validation alone is correct (e.g. immutable value object with constructor invariant) — route to [`laravel-validation`](../laravel-validation/SKILL.md).
- The fix belongs at a single architectural seam — adding three more guards is over-engineering. Use the gate function below to stop early.

## Procedure: Apply the four-layer pattern

### Step 0: Analyze the data flow before adding guards

1. Identify where the bad value originates (test fixture, request body, env var, config).
2. List every function that receives the value before the failure point.
3. Mark which functions are reachable from production paths and which only from tests.

### Step 1: Layer 1 — Entry-point validation

Reject obviously invalid input at the API / route / command boundary. In Laravel this is FormRequest rules; in pure PHP services it is the public method on the service.

```php
public function createProject(string $name, string $workingDirectory): Project
{
    if (trim($workingDirectory) === '') {
        throw new InvalidArgumentException('workingDirectory cannot be empty');
    }
    if (! is_dir($workingDirectory)) {
        throw new InvalidArgumentException("workingDirectory does not exist: {$workingDirectory}");
    }
    if (! is_writable($workingDirectory)) {
        throw new InvalidArgumentException("workingDirectory is not writable: {$workingDirectory}");
    }
    // ... proceed
}
```

### Step 2: Layer 2 — Business-logic validation

Verify the value still makes sense for the operation that consumes it. Different code paths can reach the same internal — re-check rather than trust the caller.

```php
public function initializeWorkspace(string $projectDir, string $sessionId): Workspace
{
    if ($projectDir === '') {
        throw new RuntimeException('projectDir required for workspace initialization');
    }
    // ... proceed
}
```

### Step 3: Layer 3 — Environment guards

Refuse dangerous operations in the wrong context — most often: running a destructive command outside a test temp dir while the test suite is active.

```php
public function gitInit(string $directory): void
{
    if (app()->environment('testing')) {
        $normalized = realpath($directory) ?: $directory;
        $tmp = realpath(sys_get_temp_dir());

        if ($tmp === false || ! str_starts_with($normalized, $tmp)) {
            throw new RuntimeException("refusing git init outside tmp during tests: {$directory}");
        }
    }
    // ... proceed
}
```

### Step 4: Layer 4 — Debug instrumentation

Capture context for forensics so the next failure surfaces *why*, not just *that*. Log only when the call is about to hit an irreversible side effect.

```php
public function gitInit(string $directory): void
{
    Log::debug('about to git init', [
        'directory' => $directory,
        'cwd' => getcwd(),
        'trace' => (new Exception)->getTraceAsString(),
    ]);
    // ... proceed
}
```

### Step 5: Verify each layer in isolation

Try to bypass Layer 1 (call the internal directly) and confirm Layer 2 catches it. Mock the production guard and confirm Layer 3 still refuses. The pattern only earns its name when each layer is independently provable.

## Gate function — when to stop adding layers

```
BEFORE adding the 5th guard:
  STOP — re-check the data flow.

  IF the value crosses ≤ 1 module boundary:
    Use a single boundary check + a value-object invariant. Two layers max.

  IF every layer would re-implement the same predicate:
    Hoist the predicate into a value object / type and inject. One check is enough.

  Layers are for distinct concerns: input shape vs operation invariant
  vs environment risk vs forensic visibility. Same concern repeated is duplication, not depth.
```

## Output format

1. The four guards (or a documented subset, with the gate-function justification).
2. Tests that bypass each layer to prove the next layer catches the failure.
3. One-line note on the data flow that motivated the layering.

## Gotcha

- Layers 1 and 2 must reject with **distinct** errors — same error string makes the second guard look like a duplicate.
- Layer 3 environment checks should fail closed: unknown environment treated as production.
- Layer 4 instrumentation must not change behavior — no early returns, no mutated state.
- Test bypasses (in-process mocks) often skip Layer 1 — Layer 2 catches them; do not weaken Layer 2 to silence the test.

## Do NOT

- Do NOT replicate Layer 1 inside private methods that only Layer 1 can reach.
- Do NOT log secrets in Layer 4 — sanitize before `Log::debug`.
- Do NOT use Layer 3 to gate business logic — environments change, business rules do not.
- Do NOT add a layer without a failing test that proves the layer was needed.

## Auto-trigger keywords

- defense in depth
- multiple validation layers
- bug deep in execution
- structurally impossible

## Provenance

- Adopted from: an external reference (MIT, © 2025 an external reference).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `defense-in-depth`).
- Iron-Law floor: `non-destructive-by-default`, `verify-before-complete`, `skill-quality`.
