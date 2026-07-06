---
model_tier: high
name: systematic-debugging
description: "Use on a bug, test failure, crash, or unexpected behavior — enforce reproduce → isolate → hypothesize → verify before any fix; fires even on 'this is broken' / 'quick fix'."
domain: discovery
council_depth: deep
workspaces:
  - engineering
packs:
  - engineering-base
---

# systematic-debugging

## When to use

* A test fails and the failure is not self-explanatory
* A bug is reported (Jira, Sentry, user message) and the root cause is not obvious
* Production or staging shows unexpected behavior
* Code behaves differently than the developer expected
* A previous fix did not resolve the issue or introduced a new one
* You catch yourself thinking "let me just try changing X"

Do NOT use when:

* The failure message already names the fix (typo, missing import, obvious
  off-by-one) — fix it and move on
* Pure style / formatting / lint issues
* Documentation-only questions
* You need a static trace of a specific data element — route to
  [`data-flow-mapper`](../data-flow-mapper/SKILL.md)
* You need to enumerate what a planned change will touch — route to
  [`blast-radius-analyzer`](../blast-radius-analyzer/SKILL.md)

## Goal

Find the **root cause** before changing any code. A symptom fix that
papers over an unknown cause is a regression waiting to happen.

## The Iron Law

```
NO FIX WITHOUT ROOT CAUSE. NO ROOT CAUSE WITHOUT EVIDENCE.
NO BUG MARKED FIXED WITHOUT A REGRESSION TEST.
```

"I think it's probably X" is not evidence. A log line, a stack trace, a
diff, a reproduced failure — those are evidence. A green run after a
manual edit is not a regression test — a test that fails without the fix
and passes with it, is.

## The 6-phase loop (the spine)

Every debug session walks these six phases in order. Treat them as a
checklist — tick each box before claiming the bug fixed:

- [ ] **1. Reproduce** — bug triggers on demand, smallest possible setup _(Phase 1)_
- [ ] **2. Minimize** — smallest failing case isolated, irrelevant context stripped _(Phase 1, step 2)_
- [ ] **3. Hypothesize** — one testable theory stated in one sentence _(Phase 3)_
- [ ] **4. Instrument** — log / breakpoint / trace at the boundary where expected ≠ actual _(Phase 2)_
- [ ] **5. Fix** — single, minimal change targeting the root cause _(Phase 4, step 2)_
- [ ] **6. Regression-test** — failing test added that catches the bug returning **(MANDATORY — no exception)** _(Phase 4, step 1 + Validation checklist)_

Skipping a box (especially #2 or #6) is the single biggest cause of
wasted debug time and re-opened bugs.

## Procedure

Complete each phase before starting the next. Skipping ahead is the
single biggest cause of wasted debug time.

### Phase 1 — Reproduce

Goal: make the failure happen on demand, with the smallest possible setup.

1. Read the error message, stack trace, and logs **in full**. Note the
   exact file, line, and the chain of calls above it.
2. Identify the minimum input, state, or sequence of actions that
   triggers the failure. If it is intermittent — gather more data before
   guessing.
3. Capture the exact reproduction as a command or a test. Prefer a
   failing test (see [`test-driven-development`](../test-driven-development/SKILL.md))
   — it turns Phase 4 into a verified fix.

If you cannot reproduce, you do not yet understand the bug. Stop. Add
logging, re-run, collect more evidence.

### Phase 2 — Isolate

Goal: locate the failure in a single component, layer, or call site.

1. Bisect the surface area. What is the smallest code path that still
   fails? Turn off/skip/mock adjacent features to narrow the window.
2. For multi-component systems (frontend → API → service → DB, or
   CI → build → deploy), log at **each boundary**:

   * What enters the component
   * What leaves the component
   * What config/env the component actually sees

   The goal is not to fix — it is to answer "which boundary is the one
   where expected ≠ actual?".
3. Check recent changes: `git log`, `git blame` on the failing line,
   recent dependency updates, config edits, infra changes.
4. **Consult memory for prior matches.** Via
   [`memory-access`](../../../docs/guidelines/agent-infra/memory-access.md):
   ```python
   from scripts.memory_lookup import retrieve
   priors = retrieve(
       types=["incident-learnings", "historical-patterns"],
       keys=[<error class>, <failing path(s)>],
       limit=3,
   )
   ```
   A matching `incident-learning` may already name the root cause, the
   fix, and the regression test. A matching `historical-pattern`
   narrows the hypothesis space before Phase 3. Cite matching `id`s in
   the Phase 1–4 evidence trail.
5. Trace backwards from the symptom. If `null` arrives at line 42 —
   where does the value originate? Walk up the call stack until the
   origin is found. Fix at origin, not at line 42.

### Phase 3 — Hypothesize

Goal: one testable hypothesis at a time, rejected or confirmed by evidence.

1. State the hypothesis in one sentence: *"The failure happens because
   X, which I can confirm by observing Y."*
2. Design the smallest possible experiment that either confirms or
   rejects the hypothesis. One variable at a time.
3. Run it. Read the output.
4. If confirmed → Phase 4. If rejected → back to Phase 2 with the new
   information, then form a new hypothesis.

If three hypotheses in a row fail, stop. You do not understand the
system well enough yet, or the architecture is the problem itself — see
"Three-strike rule" below.

### Phase 4 — Verify the fix

Goal: the fix resolves the root cause, not just the observed symptom.

1. Write or update a failing test that reproduces the bug (if not
   already done in Phase 1).
2. Apply a single, minimal fix targeting the root cause. No bundled
   refactors, no "while I'm here".
3. Re-run the reproduction — the failure is gone.
4. Re-run the surrounding test suite — nothing adjacent has turned red.
5. Read the output carefully — no new warnings, deprecations, or
   silent retries that would mask the same bug recurring.

If the fix does not work, **do not** stack a second fix on top. Go back
to Phase 2, treat the failure as new evidence.

## Three-strike rule

If you have tried **three** fixes and the bug is still present:

* Stop attempting fixes.
* Re-read phases 1–3 — something about the root cause is wrong.
* Ask explicitly: is this bug in the code, or in the architecture /
  design that keeps producing this class of bug?
* Surface the question to the user. Do not attempt fix #4 silently.

## Debug micro-loop — one test, one fix, one re-run

Tactical complement to the 6-phase loop, for failing test suites,
broken builds, and regressions. Each lap completes in **one turn**.
Pairs with [`context-hygiene § Read-Loop Detection`](../../rules/context-hygiene.md#read-loop-detection--the-15--25-rule)
— if you catch yourself reading-without-acting, run this loop.

1. **Pick ONE failing test.** Run it isolated:
   `npx vitest run path/to/single.test.ts`,
   `pytest tests/x.py::test_y`, `phpunit --filter test_y`. Full suite
   between laps is forbidden — it drowns the signal.
2. **Read the assertion, not the file.** `expected X to be Y` names
   the gap. Hypothesis comes from the error, not a hunch.
3. **Source first, test second.** Shape mismatch → read the producer
   (route, function, component) **once**, then align the test (or fix
   the producer if it's the regression — Phase 2 decides which).
4. **Use git as a diagnostic.** Regression in code that worked →
   `git log --oneline -- <file>` → `git show <sha> -- <file>`. The
   before/after diff names the dropped logic faster than re-reading.
5. **One edit, then re-run the same single test.** Green → next
   failing test. Red → step 2 with the new assertion. **Never** edit
   two unrelated things before re-running.
6. **Full suite at the end, not between laps.** It is the gate, not
   the feedback loop.

**Anti-patterns this loop prevents:**

* Editing source to make tests pass when the test was wrong (or
  vice versa) — step 3 forces "read producer first".
* Drowning in full-suite output every lap — step 1 pins one file.
* Three reads in a row without a fix — step 5 forces an edit per lap.
* Guessing at mock / payload shape — step 3 forces reading the route
  handler or component the mock substitutes for.

## Gathering evidence — cheap tools first

| What you need | Tool |
|---|---|
| What does the code actually do at runtime? | `dd()`, `var_dump()`, `console.log()` at suspected line |
| What does the call stack look like? | Stack trace in exception, `debug_backtrace()`, `new Error().stack` |
| What data crosses the boundary? | Log at entry and exit of each function in the path |
| What does an HTTP endpoint actually return? | `curl -s <url> \| jq`, Postman MCP, or `Http::fake()` assertions in tests |
| Is the env/config what I think? | Print the actual value, do not trust the docs |
| What changed recently? | `git log -p <file>`, `git blame -L <line>,<line> <file>` |
| Is this a known issue? | Search tracker / Sentry / changelog of the dependency |
| Step through execution | Xdebug — see [`php-debugging`](../php-debugging/SKILL.md) |

Prefer the cheapest tool that resolves the question. A `dd()` at the
right line beats five minutes of IDE breakpoints.

**Known failure signature?** If the symptom has a recognisable shape — a
tool/agent loop, HTTP 429, `ECONNREFUSED`, `ENOENT`, timeout/hang, OOM, flaky
test, or works-locally-fails-in-CI — consult the symptom → cause → first-check
lookup in [`failure-signatures`](../../../docs/guidelines/agent-infra/failure-signatures.md)
to shortcut Phase 2 (Isolate) with the highest-probability first check. It
supplements the loop; it does not replace it.

## Condition-based waiting (intermittent bugs)

Intermittent tests and race conditions usually stem from waiting on
time instead of on a condition. Replace `sleep(100)` or
`setTimeout(r, 100)` with an explicit wait-for:

```ts
async function waitFor<T>(
  check: () => T | undefined | null | false,
  label: string,
  timeoutMs = 5_000,
): Promise<T> {
  const start = Date.now();
  while (true) {
    const result = check();
    if (result) return result;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}
```

Only use an arbitrary timeout when the timing itself is the contract
(debounce, throttle) — and add a comment explaining **why** the exact
value.

## Output format

When reporting debug findings to the user:

1. **Symptom** — what was observed (one sentence + failure message)
2. **Reproduction** — the command or test that triggers it
3. **Root cause** — what is actually wrong and where
4. **Evidence** — the log line, stack frame, or diff that proves it
5. **Fix** — the minimal change
6. **Regression test** — the test that catches this bug returning

## Knowledge capture (`mistake_made` event)

If the root cause traces to a `agents/knowledge/` page that was
followed while implementing (a documented convention was wrong, an
API shape page was stale, a procedure was incomplete), append a
`mistake_made` event to the knowledge intake — never rewrite the page
mid-task (see [`knowledge-pages`](../../agent-src/templates/contexts/knowledge-pages.md)):

```bash
./scripts-run src/scripts/emit_knowledge_event \
    --type mistake_made \
    --error-category "<one or two words>" \
    --context-source "<agents/knowledge/... path, or 'null' if no page was followed>" \
    --correction "<what the fix actually was>" \
    --recurrence-key "<stable slug for this class of mistake>"
```

Verify the append landed: check the command's exit code (0 = appended),
then `grep <recurrenceKey> agents/knowledge/intake/events-*.jsonl`
finds the new line.

**Live contradiction exception.** If the followed page is DEMONSTRABLY
wrong right now (observed reality ≠ documented claim, not a one-off),
this is the hybrid immediate-fix case instead — surface the proposed
correction and ask before continuing (see
[`knowledge-pages`](../../agent-src/templates/contexts/knowledge-pages.md)
§ Contested entries). Approved → isolated fix commit. Declined →
`./scripts-run src/scripts/append_contested` on that page, then still
emit the `context_stale` event above it for the consolidation pass.

## Gotchas

* Reading half a stack trace and jumping to a fix — the actual cause is
  usually two or three frames above the one you read.
* "It works on my machine" — you are running a different env than the
  bug report. Reproduce with the exact conditions from the report.
* Adding a retry or sleep to mask an intermittent failure — this hides
  the race condition, it does not fix it. Use condition-based waiting.
* Fixing the first line that throws, when the bad value came from
  somewhere up the call chain. Trace backwards to the origin.
* "The fix works, the test is just flaky" — flaky tests are bugs in the
  test or the code. Diagnose them, do not retry-until-green.
* Turning a failing assertion into a softer one ("maybe it's 2 or 3
  retries, let's accept both") to make it pass.
* Bundling a bug fix with a refactor — if the test goes red again you
  cannot tell which change broke it.

## Red flags — STOP and restart from Phase 1

* "Let me just try X and see if it works"
* "I don't fully understand it, but this probably fixes it"
* Proposing a fix without having reproduced the bug
* Bundling multiple changes in one attempt ("fixing this and refactoring that")
* "It's probably a race condition, let me add a sleep"
* A green test run after changes, without having first seen it red
* "This looks similar to bug X, so it's the same fix"
* Suppressing a log, warning, or exception instead of tracing its source
* **Three consecutive read-only turns** (only `view` / `grep` /
  `git log` / `codebase-retrieval`, no edits, no test runs) — trips the
  Read-Loop Detection 15-minute warning. See
  [`context-hygiene § Read-Loop Detection`](../../rules/context-hygiene.md#read-loop-detection--the-15--25-rule)
  and run the Debug micro-loop instead: one failing test → read the
  assertion → read the producer once → one edit → re-run that single
  test.

## Do NOT

* Do NOT propose a fix before reproducing the bug
* Do NOT change two things at once in a single experiment
* Do NOT silence a warning, failing test, or noisy log as a "fix"
* Do NOT mark a bug as fixed without a regression test
* Do NOT attempt fix #4 after three failed fixes — surface the pattern instead

## When to hand over to another skill

* Writing the regression test → [`test-driven-development`](../test-driven-development/SKILL.md)
* Stepping through PHP with Xdebug → [`php-debugging`](../php-debugging/SKILL.md)
* Playwright / E2E test failures → [`playwright-testing`](../playwright-testing/SKILL.md)
* PHPStan / Rector / ECS output → [`quality-tools`](../quality-tools/SKILL.md)
* Verifying the fix is complete before claiming done →
  [`verify-before-complete`](../verify-before-complete/SKILL.md)

## Validation checklist

Before declaring a bug fixed:

* [ ] **6-phase loop** — all six boxes (Reproduce → Minimize → Hypothesize → Instrument → Fix → Regression-test) ticked
* [ ] The failure was reproduced before any code changed
* [ ] The root cause is named explicitly, not "probably"
* [ ] Evidence (log, trace, diff) supports the named root cause
* [ ] **Regression test added — MANDATORY**: a test that fails without the fix and passes with it. No exception. "Manual reproduction confirmed gone" is not a regression test
* [ ] The fix is minimal and targets the root cause, not the symptom
* [ ] The regression test now passes
* [ ] Adjacent tests still pass
* [ ] No warning or suppressed output hides a recurrence
