# Neutral review of the code delta from PR #1700

Review the TypeScript delta below. It was written in a single autonomous run by
the same agent commissioning this review, so this is a self-commissioned review
and the prompt is recorded with the verdict.

**Scope is the whole code delta, not a subset chosen by the author:** every
change under `src/scripts/` and `tests/scripts/` on the branch, `git diff
origin/main...HEAD`. Three files changed, three test files changed. 845
insertions across the branch, of which this diff is the executable part.

Report what you find. Do not calibrate to any expected number of findings.

## What the code is supposed to do

**`check_supervision_claim_atomicity.ts` (new).** ADR-249 permits a supervised
resident process in core and asserts nothing about one behaving as described.
This gate refuses a *present-tense supervision claim* on a public surface while
no lifecycle evidence exists for the current git revision. It must NOT match the
adopted-policy sentence the README now publishes ("Resident processes are
permitted only under the supervision contract ADR-249 establishes"), and it must
match a capability claim ("The resident process is supervised and
auto-restarted"). Evidence sufficiency is four separate refusals: unnamed suite,
foreign revision, `processes_exercised != true`, and a run that was empty or
skipped at least as much as it ran.

**`check_adr_frontmatter.ts` (added `check_scoped_supersession`).** Enforces two
invariants on the `supersedes_scope` / `superseded_scope` pair: a scope with no
refs is invalid, and a scoped supersession must carry a `## Not reopened`
section. Staged by `SCOPED_SUPERSESSION_SINCE` so it warns rather than errors on
two accepted records that predate it.

**`check_claims.ts`.** Adds a fourth ledger status `withdrawn` (a claim that was
true and was retired by decision, distinct from `unbacked` debt and from
`resolved-null` measurement failure), a required `retired_by` on it, and widens
`superseded_by` from resolved-null-only to closed entries.

## Specific things worth attacking

1. **`SUPERVISION_CLAIM_RE`.** It composes three fragments — a process noun, a
   copula, a property word — with `[^.\n]{0,60}?` and `(?:\w+\s+){0,3}?` between
   them. Is it exploitable in either direction? False negatives that let a real
   capability claim through, or false positives on ordinary prose, both matter.
   Note it has no `g` flag and is used with `.test()` in a loop.
2. **The `refusal` cache in `scan()`.** It is computed once on the first match
   and reused for every subsequent file. Is that correct, or does it hide a
   per-file distinction?
3. **The GateLedger contract.** `plan()` must precede any terminal call. One
   ordering bug was already found by the self-test's positive control (skip
   before plan, which only fires when a surface is missing). Are there others?
4. **`evidenceRefusal` ordering.** The checks run in a fixed order and return the
   first refusal. Does any earlier check mask a later, more serious one?
5. **The `withdrawn` status in `check_claims.ts`.** Two separate loops iterate
   the ledger for the two new invariants; one contains a `continue` as its last
   statement. Is the logic right, and is anything reachable that should not be?
6. **Staging by date.** `SCOPED_SUPERSESSION_SINCE` uses a string comparison on
   `fm['date']`. What happens on a malformed, absent, or backdated `date:`?
7. **The self-test.** It builds a real git repo per case via `execFileSync` and
   shells out to the gate through `runGateCli`. Does it actually prove what it
   claims, or can it pass while the gate is broken? Is the positive control a

> **The diff follows in the original prompt and is omitted here**: it is
> `git diff origin/main...HEAD -- src/scripts/ tests/scripts/` at the branch tip
> before the review fixes, i.e. commit `0de0522c9`. Reproduce it with that
> command rather than trusting a copy.
