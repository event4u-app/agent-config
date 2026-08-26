# Testing process anti-patterns — reference table

Sibling reference for [`testing-anti-patterns`](SKILL.md) and
[`test-driven-development`](../test-driven-development/SKILL.md).

`testing-anti-patterns/SKILL.md` covers **mock-isolation** failure modes
(mocking-the-mock, production pollution, partial mocks). This doc covers
the **process / rationalization** failure modes — the urges that fire
*before* the test is written and convince you to skip TDD entirely.

Both layers are required. A correctly-mocked test that was written *after*
the code is still test-after-the-fact. A TDD-first test that mocks itself
is still mocking the mock.

## The Iron Law (delete-and-restart)

```
WHEN YOU FIND YOURSELF KEEPING UNTESTED CODE "AS REFERENCE" WHILE WRITING
A TEST FOR IT — DELETE THE CODE. WRITE THE TEST. THEN REIMPLEMENT.
THE CODE IN QUESTION IS THE UNTESTED CODE THIS TASK JUST WROTE.
IT IS NOT PRE-EXISTING CODE, AND THE LAW NEVER OVERRIDES A REUSE VERDICT.
```

The cheap path is one extra round-trip. The expensive path is a test that
silently encodes the bug it was supposed to catch.

### The three cases — only one of them is a deletion

Unqualified, this law reads as a standing instruction to delete any untested
code in reach. That reading is wrong in two of the three cases, and the wrong
one is expensive: it discards working behaviour a reuse verdict would keep.

| The code is | Do | Why |
|---|---|---|
| **untested, written by this task** | delete it, write the test, reimplement | Nothing is lost — you can rewrite what you wrote minutes ago, and the test is then written against the behaviour you wanted rather than the code you happened to produce |
| **pre-existing and tested** | keep it | Its tests ARE the record of its behaviour. Deleting it to re-derive the same thing throws away evidence you cannot cheaply rebuild, and directly contradicts a reuse / extend verdict |
| **pre-existing and untested** | write a characterization test first | Deleting it destroys the only remaining record of what it does. The test comes first, but it pins TODAY's behaviour — not the behaviour you wish it had |

### The characterization-test procedure

For the third case, in order:

1. **Observe, do not judge.** Run the code on real inputs and record what it
   actually returns — including outputs you believe are wrong. Bug-compatible
   is the point: the test's job is to detect *change*, not to assert *correctness*.
2. **Pin the observed values.** Assert them exactly. A characterization test
   whose expected value is derived from the same code it tests is a tautology.
3. **Name it as one.** Prefix or tag the test (`characterizes_…`, a
   `@characterization` marker) so a later reader does not mistake a pinned bug
   for a desired behaviour.
4. **Now change the behaviour.** With the pin in place, the intended change is
   an ordinary red-green cycle: the characterization test that must now change
   is the blast radius, made visible.
5. **Update or delete the pin deliberately.** When the new behaviour is
   correct, the pinned assertion is edited *because the behaviour changed* —
   stated in the diff, never quietly.

**What this is NOT.** Not permission to skip TDD on new behaviour — the pin
covers what exists, the new behaviour still starts from a failing test. Not a
coverage exercise: pin the behaviour the change will touch, not the whole file.

## 12-row anti-rationalization table

The urge to skip TDD is strongest on tasks where TDD matters most. Name
the rationalization, then reject it:

| # | Thought | Reality |
|---|---|---|
| 1 | "This is too simple to need a test" | Simple code still breaks. A test takes less time than one debug cycle. |
| 2 | "I'll add the test after the code works" | A test written after code that passed first try has never failed. It does not prove the code is correct. |
| 3 | "I already ran it manually" | Manual runs are not repeatable. The next edit breaks it silently. |
| 4 | "Deleting code I just wrote is wasteful" | Sunk cost. The cheap path: delete, write the test, reimplement minimally. |
| 5 | "I'll keep the code as reference while I write the test" | You will read it and adapt to it. That is test-after-the-fact with extra steps. Delete it. |
| 6 | "I just need to explore the API first" | Spike on a throwaway branch. Then delete the spike and restart with TDD. |
| 7 | "The test is too hard to write" | That signals a design problem in the code, not the test. Listen to it — refactor the seam, then test. |
| 8 | "This bug is urgent, no time for a test" | The test **is** the fastest path to a verified fix. Guessing takes longer and re-occurs. |
| 9 | "CI is red — patch first, test later" | A red CI is the cheapest moment to write the regression test. The patch without the test invites the same bug back. |
| 10 | "The test is just proof-of-work for the PR review" | A test that exists to placate review is not a test — it is theater. Either it asserts behavior or delete it. |
| 11 | "The dependency is too awkward to seam" | The seam discomfort *is* the design feedback. A constructor-injection refactor pays for itself the second time you change the dependency. |
| 12 | "We'll add the test in a follow-up PR" | Follow-up PRs that add tests to merged code arrive 0% of the time. The test ships with the change or never. |

## When to use this doc

- Reviewing your own draft before writing a test — read the table, check
  none of the 12 are firing in your head.
- Reviewing a teammate's PR — if the PR description matches one of the 12
  patterns, surface the row number in the review.
- Onboarding — pair with [`test-driven-development`](../test-driven-development/SKILL.md)
  to give new devs the *why* behind the discipline.

## Cross-references

- Mock-specific anti-patterns: [`testing-anti-patterns`](SKILL.md)
- TDD discipline: [`test-driven-development`](../test-driven-development/SKILL.md)
- Coverage hygiene on a finished diff: [`judge-test-coverage`](../judge-test-coverage/SKILL.md)
- Pest conventions: [`pest-testing`](../pest-testing/SKILL.md)
- Quality tooling: [`quality-tools`](../quality-tools/SKILL.md)

## Provenance

- Adapted from an external reference (internal provenance, redacted).
- Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
  2026-05-07): both members ADOPT — the catalogue surfaces specific
  rationalization patterns that would otherwise leak past code review.
