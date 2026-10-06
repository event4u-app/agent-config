<!-- evidence-type: analysis -->

# Stack composition gate — python, typescript, go — 2026 Q4

> **Pin:** `21da7191` (`main`, 2026-10-02). Written by step 1.1 of
> `road-to-stacks-beyond-php`, which requires this table to exist **before** any
> stack skill is created. Nothing here authorises a skill: the `create` rows are
> candidates, and Phase 2 is gated on the programme's `b5-skill-growth-for-stacks`
> question.

## What was measured, and how

For each skill a Laravel repository gets for **testing**, **quality** or
**conventions**, the question is what a python, typescript or go repository
should get instead. Three verdicts, and the discriminator is stated here rather
than left to taste:

- **compose** — the skill's guidance is about *shape* (what to test, what makes
  an assertion tautological, what a coverage judge looks for). A non-PHP
  repository uses it unchanged. Stack mentions in the body are examples, not
  structure.
- **adapt** — the guidance is sound but its *commands and assertions* are
  expressed only in a PHP idiom, so a reader of another stack has to translate.
  The fix is one paragraph in the existing skill keyed on the resolver's
  `ecosystems`, never a copy of the skill.
- **create** — no stack-agnostic artefact covers the concern, because the
  existing one is a single-stack skill by construction. These are the only rows
  Phase 2 may turn into files.

Stack-specificity was counted, not estimated — occurrences of each stack's
vocabulary in the skill body on the pin:

| Skill | php | js | py | go |
|---|---|---|---|---|
| `test-case-discovery` | 4 | 0 | 0 | 0 |
| `test-driven-development` | 16 | 5 | 1 | 0 |
| `testing-anti-patterns` | 6 | 0 | 1 | 0 |
| `api-testing` | 11 | 1 | 1 | 0 |
| `test-performance` | 21 | 0 | 0 | 0 |
| `quality-tools` | 30 | 11 | 6 | 6 |
| `pest-testing` | 52 | 0 | 0 | 0 |
| `php-coder` | 31 | 0 | 0 | 0 |
| `sql-writing` | 10 | 0 | 0 | 0 |

`judge-test-coverage` is included below as a tenth row and carries no stack
vocabulary at all.

## The composition table

| Skill | Concern | Stack | Verdict | Basis |
|---|---|---|---|---|
| `test-case-discovery` | testing | python | compose | enumerates what to test; its four php mentions are worked examples |
| `test-case-discovery` | testing | typescript | compose | same |
| `test-case-discovery` | testing | go | compose | same |
| `test-driven-development` | testing | python | adapt | red/green/refactor is shape, but every runner invocation in the body is a PHP one |
| `test-driven-development` | testing | typescript | adapt | five js mentions cover the runner, none the filtered-probe form |
| `test-driven-development` | testing | go | adapt | no go vocabulary at all; `go test -run` is the missing form |
| `testing-anti-patterns` | testing | python | compose | tautological assertions and overfit fixtures are language-independent |
| `testing-anti-patterns` | testing | typescript | compose | same |
| `testing-anti-patterns` | testing | go | compose | same |
| `api-testing` | testing | python | adapt | eleven php mentions; the HTTP-assertion examples are Laravel's |
| `api-testing` | testing | typescript | adapt | same, one js mention |
| `api-testing` | testing | go | adapt | same, no go vocabulary |
| `test-performance` | testing | python | adapt | twenty-one php mentions; the slow-test diagnosis is PHPUnit-shaped |
| `test-performance` | testing | typescript | adapt | same |
| `test-performance` | testing | go | adapt | same; `-race` and build tags have no counterpart in the body |
| `judge-test-coverage` | testing | python | compose | carries no stack vocabulary; judges coverage shape |
| `judge-test-coverage` | testing | typescript | compose | same |
| `judge-test-coverage` | testing | go | compose | same |
| `quality-tools` | quality | python | adapt | router head; `references/python-tools.md` added by step 1.4, no new skill |
| `quality-tools` | quality | typescript | compose | `references/js-ts-tools.md` already covers it |
| `quality-tools` | quality | go | adapt | `references/go-tools.md` added by step 1.4, no new skill |
| `sql-writing` | conventions | python | compose | SQL is the subject; the ten php mentions are the calling idiom |
| `sql-writing` | conventions | typescript | compose | same |
| `sql-writing` | conventions | go | compose | same |
| `pest-testing` | testing | python | create | PHP-only by construction (52 php mentions, 0 others); the python runner has no artefact |
| `pest-testing` | testing | typescript | create | same |
| `pest-testing` | testing | go | create | same |
| `php-coder` | conventions | python | create | PHP-only by construction (31 php mentions, 0 others); no conventions artefact for python |
| `php-coder` | conventions | typescript | create | same |
| `php-coder` | conventions | go | create | same |

**30 rows: 13 compose, 11 adapt, 6 create.** (Corrected 2026-10-06 from 12 / 12 / 6 by recounting the table; the release finding that caught it is dispositioned by `road-to-findings-that-get-a-disposition`.)

## What the verdicts commit to

- **Nothing is created by this table.** The six `create` rows are exactly the
  two-per-stack Phase 2 proposes, and Phase 2 is blocked on `b5`. If the owner
  answers b5 with a different cap, the rows that survive are chosen from these
  six and no others.
- **No `adapt` row becomes a file.** Each is one paragraph in the skill that
  already exists, keyed on the resolver's `ecosystems` — step 1.2, whose verify
  line asserts the skill count is unchanged.
- **The two quality rows are already discharged.** Step 1.4 added
  `references/python-tools.md` and `references/go-tools.md` under the existing
  `quality-tools` skill, which is why quality is an `adapt` and not a `create`.

## What this table does not answer

Whether a stack's repository *wants* this suite's testing doctrine at all. The
gate asks what the equivalent artefact is, not whether the discipline
transfers — a python team with its own conventions file is outside what any row
here decides.
