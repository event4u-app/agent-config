<!-- evidence-type: analysis -->

# Why an agent using this suite shipped an untested, broken feature

Measured 2026-09-11 against `origin/main` `c033fa82a`, after the maintainer reported
that a ToDo feature built with this suite crashed on opening a detail view, had
non-working flyouts, and then required them to hand-enumerate what should have been
tested: every view mode, every CRUD verb, drag-and-drop, mobile, categories, statuses,
filters, reminders, due dates.

Their diagnosis, verbatim: *"Solche Fehler können nur auftreten, weil Du nicht TDD
gearbeitet und die nötigen Felder, Contracts der API, etc. geprüft hast."*

The question this answers is not whether they are right. It is why **nothing in the
suite refused that turn**.

## The finding in one sentence

The suite's TDD discipline is real, rigorous, and lives entirely in the one artifact
class this package has **measured at zero use**.

## 1. The obligation is in the layer that never fires

Three skills carry it, and they are strict:

- `src/skills/test-driven-development/SKILL.md:74-78` — *"UNTESTED CODE THIS TASK JUST
  WROTE … DELETE THE CODE, WRITE THE TEST, REIMPLEMENT"*; `:331-333` — *"Do NOT write
  or modify production code before the failing test exists and has been observed to
  fail."*
- `src/skills/test-case-discovery/SKILL.md:33-38` — *"NO TEST IS WRITTEN BEFORE THE
  CASE LIST EXISTS … FLOOR PER BEHAVIOR: 1 HAPPY + 1 BOUNDARY + 1 ERROR."*
- `src/skills/testing-anti-patterns/SKILL.md:40-48` — *"NEVER treat tests as an
  afterthought — write the failing test first."*

And the measurement, from this package's own instrument (`docs/proof.md:98`, gated by
`check_skill_activation_claim`, source `agents/evidence/metrics/skill-activation-census.json`):

> Skill self-selection is measured, not assumed, and over this package's own transcript
> store it is ZERO — not near zero. `report_skill_activation` over **30 sessions and
> 11,338 assistant turns records 0 Skill invocations and 0 of 299 distinct skills**
> (measured 2026-09-06).

So every sentence above reached the agent exactly never.

## 2. The layer that DOES reach the model says "prefer"

The kernel is nine always-loaded rules (`docs/contracts/kernel-membership.md:192-195`,
`EXPECTED_KERNEL_COUNT=9`). None mandates a test. The strongest test-first sentence in
the entire 120-file rule tree is `src/rules/think-before-action.md:43`:

> - When behavior can be defined → prefer test-first / TDD.

`senior-engineering-discipline.md:50` governs test **quality** — *"A lone happy-path
assertion is a tautology, not a test"* — conditional on a test existing. It never says
one must.

## 3. "Done" accepts evidence that cannot see the change

`verify-before-complete.md:19` is the only always-loaded rule touching this:
*"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE."* Its accepted evidence is
command-shaped (`:28`, *"tests, type-checker, linter, build — whichever the project
runs"*), and its Red-flags list (`:49-54`) targets **staleness and partiality** —
never **irrelevance**.

Consequence: *"ran the full suite, 412 passed"* is a fresh, complete, exit-0 run of a
real command, and satisfies the gate literally even when zero of those tests touch the
feature.

Compounding it: `quality.local_auto_run` defaults to `false`
(`contexts/execution/verification-mechanics.md:12-22`), so on a default install the
**sanctioned** completion path runs no local test suite at all — the required residue
is a changed-files type-check and lint.

## 4. The one gate that can refuse had the same hole

`turn-end-gate` is the suite's only concern that can refuse a turn-end, and it is bound
on `claude` alone (`hook_manifest.yaml:1288`). Its detector C
(`detectUnverifiedEdit`) fires when *"the turn changed a file and then ran nothing that
could have checked it"* — and `isVerificationCommand`'s `_VERIFY_RE` matches
`test|tests|vitest|…|eslint|…|lint[-_:a-z]*|build|ci|check[-_:a-z]*|…`.

**`npx eslint src` clears it.** A turn can write four hundred lines of feature code, run
the linter, claim done, and pass every detector in that file. That is not a bug in C —
C asks whether something ran, which is what it says. Nothing asked whether the change
is tested.

The sibling with real reach, `verify-before-complete` (`before_complete_hook.ts`, bound
in the `stop` slot of every host), is explicitly observability: *"The hook itself never
blocks — it is observability infra, not control flow"* (`:22-25`). So the enforcement
landscape before this change was: **broad reach with no teeth, or teeth on one host that
any linter satisfies.**

## 5. The UI half — every enumeration is diff-scoped, every exercise obligation degrades

- **No artifact obliges the cross-product the maintainer typed by hand.**
  `test-case-discovery` enumerates per *behavior* and **caps at 5-8 cases**
  (`:33-38`), which actively discourages an entity × CRUD × view-mode × viewport
  matrix. `existing-ui-audit` enumerates *what components already exist*, not what
  states the new feature has. `playwright-architect` enumerates suite architecture.
- **The completion contract stopped before interaction.**
  `docs/contracts/design-artifact-verification.md:113` required *"at least steps 1-5"*,
  and interaction was step 6 — and read *"the **primary** interaction"*, singular. Steps
  1-5 all pass on a page whose every button is dead.
- **The UI row in the always-delivered rule is security-only.**
  `senior-engineering-discipline.md:58`'s `user-controlled render` row covers
  `dangerouslySetInnerHTML`, `v-html`, tokens in client code. Empty, loading, error and
  missing-data states live three optional hops away in
  `ai-code-blindspots/SKILL.md:60-80`.
- **The suite ARGUED AGAINST what the maintainer needed.**
  `error-handling-patterns/SKILL.md:80` forbade *"full stack traces in user-facing
  surfaces"* with **no dev/prod distinction**. Read literally it forbids the developer's
  own diagnostics in their own dev environment — which is precisely the blank crashing
  page that made the failure unreadable. There was no guidance anywhere on dev-mode
  error surfacing: no *toast*, no *error overlay*, no *blank page* prohibition.

## 6. No gate anywhere governs a consumer project's tests

`Taskfile.yml`'s ~170-gate `ci` chain operates on this repository's own tree. The only
coverage-shaped gate, `check_test_coverage_diff.ts`, is WARN-only and scoped by
`GATE_RE = /^src\/scripts\/(?:check_|lint_)[A-Za-z0-9_]+\.py$/` — it polices maintainers
adding a lint script without a test and is meaningless in a consumer repo.

The only deterministic consumer-side lever is the hook layer, and per
`docs/enforcement-by-host.md:18-28` exactly one host honours a deny.

## What this change does about it

Moves the load-bearing obligation from the layer measured at zero use into the layer
that can refuse: **detector F** on the turn-end gate — production source changed, no
test file touched anywhere in the turn, done claimed ⇒ refuse. Plus the two prose
defects above (the missing dev/prod split, the pre-interaction completion contract).

**What it does not do, stated rather than implied.** It cannot judge whether a test is
good — any test file clears it, and `testing-anti-patterns` owns that question. It
cannot enumerate a feature's state matrix. It has teeth on one host. And it is a proxy:
"no test file at all" is not "under-tested", it is the total case, which is exactly why
it is worth refusing and exactly why it under-covers everything short of it.
