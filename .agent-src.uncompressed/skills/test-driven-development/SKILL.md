---
name: test-driven-development
description: "Use when implementing a feature, fixing a bug, or refactoring — write a failing test first, then the code — even if the user just says 'add this function' or 'fix this bug'."
source: package
---

# test-driven-development

## When to use

* Adding a new function, method, or behavior
* Fixing a bug (the bug needs a regression test before the fix)
* Refactoring a unit whose current behavior is unclear
* Any task where expected behavior can be expressed as an assertion

Do NOT use when:

* Writing throwaway prototype or spike code explicitly marked as exploration
* Generating boilerplate (migrations, config files, scaffolding)
* Editing pure documentation (`.md`, `AGENTS.md`, README)
* Working inside this `agent-config` package on skill/rule markdown

## Goal

* Drive implementation from a verified-failing test, not from the agent's
  belief that the code "should work".
* Catch edge cases **before** they become production bugs.
* Leave every change with a regression test that runs in CI.

## The core discipline

```
1. Write ONE failing test that describes the desired behavior.
2. Run it. WATCH it fail for the right reason.
3. Write the MINIMUM production code to make it pass.
4. Run it again. Watch it pass.
5. Clean up (rename, deduplicate) while keeping the test green.
```

If step 2 is skipped, the test is not trusted — a test that has never
failed proves nothing about the code under test.

## Procedure

### 1. Identify the behavior to test

State in one sentence: *"When X happens, the system should do Y."*

If you cannot state it in one sentence, the scope is too big — split into
multiple tests, each covering one sentence.

### 2. Write the failing test first

Write the smallest test that expresses the sentence from step 1.

* One assertion per behavior (multiple assertions are OK only when they
  describe the same single behavior).
* Real code paths, not mocks — mock only at I/O boundaries (HTTP, DB, time).
* Use a descriptive name: `it_rejects_empty_email`, not `test_email_1`.

### 3. Run the test and watch it fail

Execute the single test (targeted, not the full suite):

```bash
# PHP/Pest
./vendor/bin/pest --filter=it_rejects_empty_email

# JS/Vitest
npx vitest run --testNamePattern "rejects empty email"
```

Required observations **before proceeding**:

* The test **fails** (not errors).
* The failure message matches what you expected (missing behavior, not typo).
* If the test passes immediately → it does not test what you think. Fix
  the test, do not start writing production code.

### 4. Write minimum code to pass

Add **just enough** production code to make the test green. No extra
features, no unrelated refactoring, no "while I'm here" cleanups.

If you feel the urge to add a parameter, edge case, or helper not covered
by the current test — stop. That belongs in the next RED step, not this
GREEN step.

### 5. Run again and watch it pass

Re-run the same targeted command. Required:

* The new test passes.
* No previously green tests have turned red.
* Test output is clean (no new warnings, deprecations, or noise).

### 6. Refactor (only if green)

With all tests green, you may:

* Rename variables, methods, files
* Extract duplication into helpers
* Tighten types

Do **not** add new behavior during refactor — that needs its own failing
test first. Re-run tests after the refactor to confirm still-green.

### 7. Repeat for the next behavior

Back to step 1 with the next single-sentence behavior.

## Output format

1. The failing test (file + test name) with captured failure output
2. The minimum-code diff that makes it pass
3. Captured green-run output
4. Any refactor diff (optional)

## Anti-rationalizations table

The urge to skip TDD is strongest on tasks where TDD matters most. Name
the rationalization and reject it:

| Thought | Reality |
|---|---|
| "This is too simple to need a test" | Simple code still breaks. A test takes less time than one debug cycle. |
| "I'll add the test after the code works" | A test written after code passes on the first run — it has never failed. It does not prove the code is correct. |
| "I already ran it manually" | Manual runs are not repeatable. The next edit breaks it silently. |
| "Deleting this code I just wrote is wasteful" | Sunk cost. The cheap path is: delete, write the test, reimplement minimally. |
| "I'll keep the code as reference while I write the test" | You will read it and adapt it. That is test-after-the-fact with extra steps. Delete it. |
| "I just need to explore the API first" | Spike it on a throwaway branch. Then delete it and restart with TDD. |
| "The test is too hard to write" | That signals a design problem in the code, not in the test. Listen to it. |
| "This bug is urgent, no time for a test" | The test **is** the fastest path to a verified fix. Guessing takes longer. |


## Examples

### PHP / Pest

```php
// tests/Unit/EmailValidatorTest.php — RED
it('rejects empty email', function () {
    $result = (new EmailValidator())->validate('');
    expect($result->isValid())->toBeFalse();
    expect($result->error())->toBe('Email required');
});
```

Run: `./vendor/bin/pest --filter='rejects empty email'` → fails
(EmailValidator does not exist yet, or returns isValid()=true).

```php
// app/Validators/EmailValidator.php — GREEN (minimum)
final class EmailValidator
{
    public function validate(string $email): EmailResult
    {
        if (trim($email) === '') {
            return EmailResult::invalid('Email required');
        }
        return EmailResult::valid();
    }
}
```

Run the filter again → passes. No additional rules (format, MX, length)
until a next failing test drives them.

### JS / Vitest

```ts
// src/retry.test.ts — RED
import { retry } from './retry';

it('retries a failing operation up to 3 times', async () => {
  let attempts = 0;
  const op = async () => {
    attempts += 1;
    if (attempts < 3) throw new Error('transient');
    return 'ok';
  };
  await expect(retry(op)).resolves.toBe('ok');
  expect(attempts).toBe(3);
});
```

Run: `npx vitest run --testNamePattern "retries a failing"` → fails
(`retry` is undefined).

```ts
// src/retry.ts — GREEN (minimum)
export async function retry<T>(op: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < 3; i += 1) {
    try { return await op(); } catch (e) { lastError = e; }
  }
  throw lastError;
}
```

Run again → passes. Configurable attempt count, backoff, and jitter all
wait for their own failing tests.

## Gotchas

* Running the full suite instead of a filtered test hides the RED→GREEN
  signal in noise. Always target first.
* A test that passes on the very first run is not TDD — it was written
  against code that already exists.
* `expect()` with three or four assertions on unrelated fields describes
  multiple behaviors. Split them.
* Snapshot tests invert the discipline — they generate the expected value
  from the code. Only use snapshots where human-readable output is the
  contract (CLI output, SQL strings).
* Mocking the thing under test (instead of its I/O) tests the mock, not
  the code.

## Do NOT

* Do NOT write or modify production code before the failing test exists
  and has been observed to fail
* Do NOT accept a test that never failed as evidence the code works
* Do NOT bundle refactors into the GREEN step
* Do NOT silence a flaky test — diagnose it, or delete it
* Do NOT skip the targeted RED-run because "I just wrote it, I know it fails"

## Anti-patterns

* `it('works')` — no behavior described
* One test covering "and/and/and" — split per behavior
* Test that reaches into private state instead of testing observable behavior
* Test that duplicates the production code's algorithm (tautology)

## When to hand over to another skill

* Quality tools, PHPStan, ECS, Rector → [`quality-tools`](../quality-tools/SKILL.md)
* Full Pest conventions, Laravel testing helpers → [`pest-testing`](../pest-testing/SKILL.md)
* Running tests inside Docker → [`tests-execute`](../tests-execute/SKILL.md)
* Investigating why a test is failing for non-obvious reasons →
  [`systematic-debugging`](../systematic-debugging/SKILL.md)

## Validation checklist

Before marking TDD work complete:

* [ ] Every new behavior has a test
* [ ] Each test was observed to fail first, with a matching failure message
* [ ] The minimum code was written to turn each RED into GREEN
* [ ] All targeted tests pass
* [ ] No adjacent test has turned red
* [ ] Test output is clean (no new warnings or deprecations)

See also [`developer-like-execution`](../developer-like-execution/SKILL.md)
for the broader think → analyze → verify loop this skill plugs into.
