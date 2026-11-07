<!-- evidence-type: original-review -->

# Independent test review — removing the owned digest's budget assertions

- **Date:** 2026-11-07
- **Reviewer:** the AI council, anthropic (cli) + openai (cli), subscription transport, $0 — another provider than the implementing session for the openai seat. Commissioned by the implementing session on the owner's decision to drop the budget.
- **Scope:** the diff of `src/scripts/generate_owned_digest.ts` and `tests/scripts/generate_owned_digest.test.ts` against `origin/main`, shown in full in the prompt.
- **Why a review:** the change net-removes assertions (`check_test_weakening`); per `evaluator-independence` § Tests are evaluators, the implementer does not validate its own weakening.

## Verdict

Both seats `ratified`: every removed assertion tested only the removed budget; freshness, formatting, registration and the no-truncation property stay covered. Both named one non-blocking addition — a test that writes a digest past the former limit, checks every row survives, and that `main()` and `--check` succeed. It was added after the round (`writes every row however large the digest grows — no size budget, no truncation`, 600 rows, > 42,000 characters); it is red against the generator on `origin/main` and green against this branch.

## The prompt, verbatim (diff omitted — it is the branch diff of the two files at the time of the round)

~~~~markdown
# Review — removed assertions in tests/scripts/generate_owned_digest.test.ts

Context: `src/scripts/generate_owned_digest.ts` writes `agents/roadmaps-owned.md`, one row per roadmap. It carried a 10,500-token budget (exit 1 when exceeded, comment forbidding a second raise). Adding a roadmap the owner asked for pushed the digest over it. The owner decided on 2026-11-07 that how many roadmaps exist is the owner's call and the budget should go entirely (verbatim: "Erhöhen. Es ist dem Owner/User überlassen wie viele Roadmaps er anlegt. Diese Regel ist bullshit und kann sogar weg").

The diff removes the budget from the generator and removes the test assertions that exercised it. CI's check_test_weakening flagged the net assertion loss.


## Question

Does every removed assertion test only the removed budget behaviour, or does any of them guard something the generator still does (e.g. no truncation, freshness)? Is any remaining behaviour left untested by this diff? Any other defect? Return findings, then one final verdict from exactly: `ratified` · `confirmed-non-expanding` · `refused` · `non-convergent`.
~~~~
