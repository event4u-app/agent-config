---
model_tier: medium
name: testing-anti-patterns
description: "Use BEFORE writing/changing tests or adding mocks — mocking-the-mock, production pollution, overfit assertions — even on 'is this test any good?'. Test SHAPE; the order is `test-driven-development`."
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
- You need to *enumerate* what to test before writing (case matrix, edge-case discovery) — route to [`test-case-discovery`](../test-case-discovery/SKILL.md).
- The test failure is a real bug — route to [`systematic-debugging`](../systematic-debugging/SKILL.md).
- You need overall coverage assessment of a finished diff — route to [`judge-test-coverage`](../judge-test-coverage/SKILL.md).

## The Iron Laws

```
1. NEVER test mock behavior — assert on real component behavior.
2. NEVER add test-only methods to production classes — put them in test utilities.
3. NEVER mock without understanding the dependency chain — observe first, mock minimally.
4. NEVER ship partial mocks — mirror the real response shape completely.
5. NEVER treat tests as an afterthought — write the failing test first.
6. NEVER overfit an assertion — assert the general rule, derive expected values from inputs/seeded data, cover boundary + error cases.
7. NEVER game the green — a failing test is a finding, not an obstacle; fix the code, never skip/weaken/delete the test or rewrite `expected` to the buggy output.
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

### Anti-Pattern 6 — Overfit / tautological assertions & unrealistic test data

Symptom: the test passes only for one crafted input and proves nothing about the general rule — a hardcoded expected value the code will always emit, a narrow regex pinned to a fixed date/id, or an assertion that restates the seed. AI-written tests reach the same coverage as human tests but ~4× worse fault detection (the weak-oracle problem): they execute the path and then assert something too weak to catch a bug. Same shape as mocking-the-mock — asserting on your own construction rather than the system's behavior.

Gate:

```
BEFORE writing an assertion:
  Ask: "Would this still pass if the input changed, and FAIL if the RULE broke?"
  IF it only passes for one crafted value, or restates a hardcoded literal:
    STOP — derive the expected from the input, and add cases that vary it.
```

Test-data realism — seeders/factories emit random data; the test derives its expectation from that data, never from a hardcoded literal:

```js
// ❌ WRONG — hardcoded expectation, single happy case
const res = await api.get('/users/1')
expect(res.body).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' })
expect(log).toMatch(/User 1 logged in at 2026-01-01/)   // pins incidental values

// ✅ RIGHT — derive from seeded random data + cover more than the happy path
const user = await seedUser()                     // faker-random name/email
const res = await api.get(`/users/${user.id}`)
expect(res.body.id).toBe(user.id)                 // derived, not hardcoded
expect(res.body.name).toBe(user.name)
expect(res.body).not.toHaveProperty('passwordHash')            // security property
expect((await api.get('/users/999999')).status).toBe(404)      // boundary: missing
expect((await api.get('/users/abc')).status).toBe(400)         // error: invalid input
expect([403, 404]).toContain((await api.get(`/users/${otherTenantUser.id}`)).status) // abuse: tenant isolation (404 hides existence)
```

Deriving from seeded data is necessary but **not sufficient** — a test that only reads back the exact fields it seeded is still overfit (a mutation in the code survives it). A real test also exercises boundary (empty / null / max / Unicode), error (missing / invalid), and, on security-sensitive paths, an abuse case (IDOR, injection string, XSS payload). Coverage of *cases*, not just lines.

**The adversarial variant, and it is the one that looks safest.** A *negative* test — the abuse case just named — fails the same way, but nothing about it reads as weak: it names an attack, it asserts a refusal, it goes green. It passes because **something other than the control under test** produced that refusal. Two shapes, both from one real review:

- **The hostile value sits only in the argument.** A guard rejecting a path-traversing `token` was pinned by planting a fixture whose own `token` field held the *legitimate* value while `'../outside'` was passed as the argument. Downstream, an ordinary token comparison mismatched and returned exactly the expected refusal — delete the guard and the test still passes. The hostile value belongs in the **field under test**, not only in the call.
- **The assertion cannot fail.** The same test asserted the planted file still existed after a rejected claim. The two directories were siblings, so both `../x.json` joins resolved to one path and the rename could never have moved it — a green no implementation could turn red.

Gate:

```
BEFORE trusting a negative test:
  Delete or invert the control it claims to pin. Does it FAIL?
  RESTORE THE CONTROL IMMEDIATELY — before any other edit, before any commit.
    The mutation is a probe, never a change. A deleted guard left deleted is
    a shipped vulnerability produced by a test-quality check.
  IF it still passes: it is pinning something else. Name what, then fix the test.
  IF an assertion cannot fail for ANY implementation: delete THE ASSERTION —
    it is decoration. Only after proving vacuity, and never to turn a red test
    green — that is Anti-Pattern 7 below.
```

No mutation-testing rig required: comment the control out, run that one spec, put it back. A negative test nobody has ever watched fail is a claim, not evidence.

### Anti-Pattern 7 — Gaming the green (test-integrity)

Symptom: a test fails, and the "fix" edits the *test* instead of the code — `.skip` / `it.skip` / `xfail` / `@Disabled` on the failing case, deleting the failing assertion, loosening `toBe(x)` to `toBeTruthy()`, or rewriting the `expected` value to whatever the (possibly buggy) code now emits. The suite goes green while the behavior stays broken — the worst outcome, because green now *hides* the bug. This is the automation-bias trap: under pressure to finish, the agent optimizes the signal (green) instead of the target (correct behavior).

Gate:

```
BEFORE editing a test that is currently failing:
  Ask: "Is the TEST wrong, or is the CODE wrong?"
  IF the code is wrong:
    STOP — fix the code. Editing the test to match buggy output ships the bug green.
  Editing a test is legitimate ONLY when it encodes a genuinely stale/incorrect
  expectation (a real, intended spec change) — and then the reason is stated in
  the diff, never a silent skip/xfail/delete.
```

Backstop grep — skip/xfail added to chase green (a hit in a diff that also "fixes" a failure is the smell):

```bash
rg -n '\b(it|test|describe)\.skip\b|\.only\b|xit\(|xdescribe\(|@pytest\.mark\.(skip|xfail)|@Disabled|->markTestSkipped\(' .
```

This is the test-surface instance of the `autonomous-execution` N=3 / allowlist-growth antipattern (bulk `skip`/`xfail` to force green counts as the tool being wrong, not the content) and the `verify-before-complete` floor (green must be *earned*, not manufactured).

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
- An assertion that derives from seeded data but only checks the happy path is still overfit — a code mutation survives it. Require ≥1 boundary/error/abuse case per behavior, not just line coverage.

## Do NOT

- Do NOT add `*-mock` test ids to production templates.
- Do NOT extend a production class to expose internals "just for testing".
- Do NOT mock a method whose side effects the test depends on without reading the implementation.
- Do NOT invent mock data shapes from memory — record from the real source.
- Do NOT mark a story complete until at least one test was watched failing first.
- Do NOT hardcode an expected value the code will emit, or pin a regex to an incidental fixed date/id — derive from inputs and seeded data, and vary the input across cases.
- Do NOT skip / `xfail` / delete a failing test, or rewrite its `expected` to the code's current output, to get a green run — fix the code, or state a real spec change in the diff.
- Do NOT trust a negative test you have never watched fail — delete the control it pins, confirm the test goes red, restore the control immediately.

## Auto-trigger keywords

- testing anti-patterns
- mock behavior
- test-only method
- partial mock
- mock without understanding
- overfit assertion
- tautological test
- hardcoded expected value
- gaming the green
- skip failing test
- test integrity
- negative test
- vacuous assertion
- abuse-case test

## Provenance

- Adopted from: an external reference (internal provenance, redacted).
- Cross-linked: [`pest-testing`](../pest-testing/SKILL.md), [`test-driven-development`](../test-driven-development/SKILL.md), [`judge-test-coverage`](../judge-test-coverage/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `testing-anti-patterns`).
- Iron-Law floor: `verify-before-complete`, `skill-quality`, `senior-engineering-discipline`.
- Cross-cutting anchor: [`ai-code-blindspots`](../ai-code-blindspots/SKILL.md) routes here for the test surface.
