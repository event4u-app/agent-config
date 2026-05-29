---
name: testing-anti-patterns
description: "Use BEFORE writing or changing tests, adding mocks, or putting test-only methods on production classes — five Iron Laws and gates against mocking-the-mock, production pollution, silent partial mocks."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# testing-anti-patterns

Tests must verify real behavior, not mock behavior. Mocks isolate; they are not the thing under test. This skill is the **prevention** layer; [`judge-test-coverage`](../judge-test-coverage/SKILL.md) catches what slips through afterwards.

For the **process / rationalization** failure modes that fire *before* a
test is written (the urges to skip TDD, keep code "as reference", patch
without a regression test), see the sibling reference table in
[`process-anti-patterns.md`](process-anti-patterns.md). Both layers are
required — a correctly-mocked test that was written *after* the code is
still test-after-the-fact.

## When to use

- About to write a new test that mocks a collaborator.
- Tempted to add a method to a production class purely for test cleanup.
- Mock setup is becoming longer than the test logic itself.
- A test passes but you cannot explain *what real behavior* it verified.
- Code review of a diff that adds mocks — run the gates below before approving.

Do NOT use when:

- You need to *write* tests (no anti-pattern present yet) — route to [`pest-testing`](../pest-testing/SKILL.md) or [`test-driven-development`](../test-driven-development/SKILL.md).
- The test failure is a real bug — route to [`systematic-debugging`](../systematic-debugging/SKILL.md).
- You need overall coverage assessment of a finished diff — route to [`judge-test-coverage`](../judge-test-coverage/SKILL.md).

## The Iron Laws

```
1. NEVER test mock behavior — assert on real component behavior.
2. NEVER add test-only methods to production classes — put them in test utilities.
3. NEVER mock without understanding the dependency chain — observe first, mock minimally.
4. NEVER ship partial mocks — mirror the real response shape completely.
5. NEVER treat tests as an afterthought — write the failing test first.
```

## Procedure: Run the gate before each anti-pattern

### 1. Inspect the diff before any new mock

Before writing or extending a test, **inspect** the code under test and identify which collaborators are real, which are mocked, and which produce side effects the assertion depends on. Open the file, read the dependency chain, and write the chain down. Do not start mocking until the chain is on paper.

### Anti-Pattern 1 — Asserting on mock elements

Symptom: `expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument()` or `$this->assertSee('mock-sidebar')`. Test passes when the mock is present, fails when it is not — proves nothing about the component.

Gate:

```
BEFORE asserting on any mocked element / id / class:
  Ask: "Am I asserting that the mock exists, or that the component behaves correctly?"

  IF asserting that the mock exists:
    STOP — delete the assertion or unmock the dependency.
    Replace with a behavior assertion (role, output, side effect).
```

### Anti-Pattern 2 — Test-only methods in production classes

Symptom: `Session::destroy()` only ever called from `tearDown`. Production class polluted with code dangerous in production.

Gate:

```
BEFORE adding any method to a production class:
  Ask: "Is this only used by tests?"
  IF yes:
    STOP — move it to a test utility / trait / helper.
  Ask: "Does this class own this resource's lifecycle?"
  IF no:
    STOP — wrong class for this method.
```

Replacement: a `tests/Support/cleanupSession.php` helper or a trait used only by test classes.

### Anti-Pattern 3 — Mocking without understanding

Symptom: A mocked method had a side effect the test depended on (e.g. wrote config). Mock kills the side effect; the test passes for the wrong reason or fails mysteriously.

Gate:

```
BEFORE mocking any method:
  STOP — do not mock yet.
  1. List the side effects the real method produces.
  2. List which of those side effects the test actually depends on.
  3. If the test depends on any of them, mock at a *lower* level (the slow / external bit), preserving the necessary behavior.
  IF unsure:
    Run the test with the real implementation FIRST. Observe what fails.
    THEN mock minimally, just below the failing seam.

  Red flags:
    - "I'll mock this just to be safe."
    - "This might be slow, better mock it."
    - You cannot draw the dependency chain.
```

### Anti-Pattern 4 — Partial / incomplete mocks

Symptom: Mock returns only the fields the immediate test reads. Downstream code accesses an absent field and the test passes; integration breaks.

Iron Rule: mock the **complete** response shape that the real API returns, not just the fields your assertion uses. If you cannot enumerate the shape, you should not mock.

```
BEFORE creating a mock response object:
  1. Examine the real response (docs, recorded fixture, type definition).
  2. Include EVERY documented field — even ones the test does not read.
  3. If the shape is unknown, capture a real response into `tests/fixtures/` instead of inventing one.
```

**Concrete capture tools** for recording the real shape: `curl -s <url> | jq '.'` against a staging endpoint, Postman's "Save Response", Laravel's `Http::fake()` in record mode, or a Playwright network-trace export. Filter the captured payload with `jq` / `grep` to keep only the fields your fixture documents — **do not** dump unredacted secrets into `tests/fixtures/`.

### Anti-Pattern 5 — Tests as an afterthought

Symptom: "Implementation complete, ready for testing." Implementation went in without tests. TDD was skipped, anti-patterns 1–4 are now likely.

Gate: a feature is not complete until a failing-then-passing test cycle ran for it. Route to [`test-driven-development`](../test-driven-development/SKILL.md).

## Output format

1. The mocking decision recorded as a one-line comment in the test file (`// mock at <seam>: <reason>`).
2. The replacement test (or refactor) once an anti-pattern is identified.
3. If a test-only method moved out of production, the diff must show both the deletion and the test-utility addition.

## Gotcha

- Vague-test asserts (`assertTrue($result)`) hide mock-behavior assertions — flag any test where the assertion does not name an observable behavior.
- A "complete" mock that mirrors a v1 API silently rots when v2 ships — link mock fixtures to a real recorded response and re-record on schema changes.
- Layer 3 environment guards from [`defense-in-depth`](../defense-in-depth/SKILL.md) often expose anti-pattern 2: if a production guard fires only in tests, the test setup is wrong, not the guard.
- Long mock setups (> 50% of the test) are a signal that integration tests would be simpler — consider it before piling on more mocks.
- **Diagnose, do not brute-force.** If a test fails after a mock change, **never guess** at another mock tweak — drop a debugger / Xdebug breakpoint at the seam, observe the real call shape, then mock minimally. Two retries without a root-cause hypothesis = STOP and rethink.

## Do NOT

- Do NOT add `*-mock` test ids to production templates.
- Do NOT extend a production class to expose internals "just for testing".
- Do NOT mock a method whose side effects the test depends on without reading the implementation.
- Do NOT invent mock data shapes from memory — record from the real source.
- Do NOT mark a story complete until at least one test was watched failing first.

## Auto-trigger keywords

- testing anti-patterns
- mock behavior
- test-only method
- partial mock
- mock without understanding

## Provenance

- Adopted from: `Microck/ordinary-claude-skills@8f5c83174f7aa683b4ddc7433150471983b93131:skills_all/testing-anti-patterns/SKILL.md` (MIT, © 2025 Microck).
- Cross-linked: [`pest-testing`](../pest-testing/SKILL.md), [`test-driven-development`](../test-driven-development/SKILL.md), [`judge-test-coverage`](../judge-test-coverage/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `testing-anti-patterns`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`.
