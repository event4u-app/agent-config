---
model_tier: medium
name: test-driven-development
description: "Use when implementing a feature, fixing a bug, or refactoring — write the failing test first, then the code, even on 'add this function'. Owns the ORDER; test shape is `testing-anti-patterns`."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
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

## Escalate to a SPARC-style 5-phase workflow when

Plain TDD (red → green → refactor) is the right size for **most** work.
A small subset benefits from a gated 5-phase wrapper —
**S**pec → **P**seudocode → **A**rchitecture → **R**efine → **C**omplete —
where each gate produces a written artifact before the next phase runs.

Decision tree — escalate if **any** branch is true:

* The ticket has **AC count > 5** (the spec itself is non-trivial — write
  it down before testing it).
* The change **modifies a contract** consumed by ≥1 other module
  (public API signature, persisted schema, event payload, queue message).
* The change cuts across **≥3 modules / bounded contexts** at once.

When escalating: drop the `Spec` artifact in `agents/roadmaps/` (or the
project's planning location), capture it as an ADR via [`adr-create`](../adr-create/SKILL.md)
when the decision is load-bearing, then run plain TDD inside each
`Refine` cycle. Do **not** skip RED→GREEN inside a SPARC phase — the
wrapper adds gates, not exemptions.

For everything else (single-AC ticket, leaf-module change, bug fix),
stay on plain TDD — the section above.

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

### Iron Law — delete-and-restart over keep-as-reference

```
UNTESTED CODE THIS TASK JUST WROTE, AND A TEST IS NEEDED — DELETE THE CODE,
WRITE THE TEST, REIMPLEMENT. NEVER KEEP IT "AS REFERENCE".
THIS LAW COVERS YOUR OWN UNTESTED OUTPUT. IT IS NOT A LICENCE TO DELETE
PRE-EXISTING CODE, AND NEVER OVERRIDES A REUSE VERDICT.
```

Reading the existing implementation while writing its test is
test-after-the-fact with extra steps. Which code that applies to has three
answers, and only the first is a deletion:

| The code is | Do |
|---|---|
| **untested, written by this task** | delete it, write the test, reimplement — the Iron Law above |
| **pre-existing and tested** | keep it. Its tests are the record of its behavior; deleting it to re-derive the same thing discards evidence and contradicts the reuse verdict |
| **pre-existing and untested** | do NOT delete. Write a **characterization test** pinning the behavior it has today — including the behavior you think is wrong — then change it under that test |

The middle row is the one this law used to get wrong: unqualified, it read as
a standing instruction to delete tested legacy that a reuse verdict would
keep. Case detail, the characterization-test procedure, and the 12-row
anti-rationalization table are in
[`testing-anti-patterns/process-anti-patterns.md`](../testing-anti-patterns/process-anti-patterns.md),
which keeps this skill under the 400-line sunset trigger.

## Mode contracts — Goal / Activities / Forbidden / Output

The flow runs as four modes. Each Forbidden item names **how a reviewer
checks it from the diff** — an unverifiable prohibition does not ship.

| Mode | Goal | Activities | Forbidden (diff check) | Output contract |
|---|---|---|---|---|
| **Design** | One-sentence behavior + enumerated cases | Steps 1–2 | **No production code** (diff touches no `src/**` production path) · no test bodies yet | Case list (happy/boundary/error) |
| **Test-Red** | A failing test that fails RIGHT | Steps 3–4 | **No production edits** (diff = `tests/**` only) · the failure must be **about the behavior under test**. Valid: a failing **assertion** · a **missing target** — class-not-found, or a compile/type error naming the unimplemented symbol · a **contract failure** (wrong shape, wrong status, unmet interface). Invalid: a broken **fixture** · a **syntax error** in the test · a missing **unrelated dependency** · a **runner or environment** fault | Failing test + its observed failure, named as one of the three valid classes |
| **Implement** | Minimum code to green | Steps 5–6 | **No test edits** (no `tests/**` paths in Implement-phase diffs — changing the assertion to fit the code is the canonical violation; genuinely-wrong test → STOP and ask, never silently edit) · no scope beyond the one case | Green run output |
| **Debug** | Fix a defect found later | (re-enter at 3) | **No bugfix before a reproducing regression test exists** (the fix commit contains a `tests/**` addition that fails without the fix) | Regression test + fix, verified red→green |

#### What makes a RED valid — relevance, not the line number it fails on

The discriminator is **whether the failure is about the behavior under test**,
never where in the run it surfaces. A class that does not exist yet can only
fail at load, so demanding an assertion would force a production stub before
the first test — the exact thing this skill forbids. The four invalid classes
are failures of the harness: they would fail identically with the behavior
fully implemented, so they measure nothing about it. Unsure → re-read the
failure output and name which of the seven it is; an unclassified red is not a
RED.

### Mode inference on resume

Step 0 of any resume: if `agents/runtime/state/HANDOFF.md` exists, resume
from its Mode + Contract-owed fields (see `/agent-handoff` file mode) instead
of re-deriving. Otherwise infer the mode from observable state — never
assume Design:

| Observed state | Resume in |
|---|---|
| No test for the target behavior | Design |
| Test exists, currently failing at an assertion | Implement |
| Test exists + passing, defect reported | Debug |
| Test failing at load because the target does not exist yet | Implement (that is a valid RED) |
| Test failing on a harness fault — fixture, syntax, unrelated dependency, runner | Test-Red (fix the test, not the code) |

At every mode transition, one consent-checkpoint sentence (per
`ask-when-uncertain` / `autonomous-execution` — no new mechanism): name the
mode you are leaving, the output contract you hand over, and the mode you
enter; under an autonomous mandate the sentence is stated, not asked.

## Procedure

### 1. Identify the behavior to test

State in one sentence: *"When X happens, the system should do Y."*

If you cannot state it in one sentence, the scope is too big — split into
multiple tests, each covering one sentence.

### 2. Enumerate the cases — discovery before writing (MANDATORY)

Before the first test is written, run the
[`test-case-discovery`](../test-case-discovery/SKILL.md) funnel for the
behavior: dimension scan → case synthesis → optional subagent cross-check →
prioritization. Do not proceed to step 3 with fewer than the floor:

* **1 happy + 1 boundary + 1 error case per behavior** (+1 abuse case on
  security-relevant paths).
* Cap at 5–8 cases per behavior; each must be able to fail for a
  **distinct** reason.
* Trivial change (< 10 lines, pure refactor, no new behavior) → skip the
  funnel; 1 happy + 1 boundary case suffices.

Each case from the list then gets its own RED → GREEN cycle (steps 3–6).
A behavior whose only test is the happy path is **not done** — it is the
first item of an unfinished case list.

### 3. Write the failing test first

Write the smallest test that expresses the sentence from step 1.

* One assertion per behavior (multiple assertions are OK only when they
  describe the same single behavior).
* Real code paths, not mocks — mock only at I/O boundaries (HTTP, DB, time).
* Use a descriptive name: `it_rejects_empty_email`, not `test_email_1`.

### 4. Run the test and watch it fail

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

### 5. Write minimum code to pass

Add **just enough** production code to make the test green. No extra
features, no unrelated refactoring, no "while I'm here" cleanups.

If you feel the urge to add a parameter, edge case, or helper not covered
by the current test — stop. That belongs in the next RED step, not this
GREEN step.

### 6. Run again and watch it pass

Re-run the same targeted command. Required:

* The new test passes.
* No previously green tests have turned red.
* Test output is clean (no new warnings, deprecations, or noise).

### 7. Refactor (only if green)

With all tests green, you may:

* Rename variables, methods, files
* Extract duplication into helpers
* Tighten types

Do **not** add new behavior during refactor — that needs its own failing
test first. Re-run tests after the refactor to confirm still-green.

### 8. Repeat for the next behavior

Back to step 1 with the next single-sentence behavior.

## Output format

1. The failing test (file + test name) with captured failure output
2. The minimum-code diff that makes it pass
3. Captured green-run output
4. Any refactor diff (optional)

## Anti-rationalizations

Twelve common rationalizations that fire *before* the test is written —
plus the delete-and-restart Iron Law — live in
[`testing-anti-patterns/process-anti-patterns.md`](../testing-anti-patterns/process-anti-patterns.md).
Read the table when:

- You catch yourself thinking "I'll add the test after" — row 2.
- You want to keep the code "as reference" while writing the test — row 5.
- "CI is red, patch first, test later" — row 9.
- "Follow-up PR will add the test" — row 12.

For mock-isolation failure modes (separate concern), see
[`testing-anti-patterns`](../testing-anti-patterns/SKILL.md).

## Examples

### Example A — PHP / Pest

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

### Example B — TypeScript / Vitest

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
* Do NOT stop after the happy-path test — work through the enumerated
  case list from step 2 (boundary, error, abuse where relevant)
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

* Enumerating what to test before writing (case matrix, dimension scan,
  subagent cross-check) → [`test-case-discovery`](../test-case-discovery/SKILL.md)
* Project type-checker / linter / formatter (PHPStan, ECS, Rector for PHP — tsc / eslint / prettier for TS — ruff / mypy for Python) → [`quality-tools`](../quality-tools/SKILL.md)
* Full Pest conventions and Laravel test helpers → [`pest-testing`](../pest-testing/SKILL.md)
* Running tests inside Docker → [`/tests:execute`](../../domains/engineering-base/tests/execute/command.md)
* Investigating why a test is failing for non-obvious reasons →
  [`systematic-debugging`](../systematic-debugging/SKILL.md)

## Validation checklist

Before marking TDD work complete:

* [ ] Every new behavior has a test
* [ ] The case list from step 2 exists and meets the floor (1 happy +
  1 boundary + 1 error per behavior; abuse case on security paths)
* [ ] Every enumerated case is either tested or recorded as dropped with
  a one-line reason — no behavior ships happy-path-only
* [ ] Each test was observed to fail first, with a matching failure message
* [ ] The minimum code was written to turn each RED into GREEN
* [ ] All targeted tests pass
* [ ] No adjacent test has turned red
* [ ] Test output is clean (no new warnings or deprecations)

See also [`developer-like-execution`](../developer-like-execution/SKILL.md)
for the broader think → analyze → verify loop this skill plugs into.
