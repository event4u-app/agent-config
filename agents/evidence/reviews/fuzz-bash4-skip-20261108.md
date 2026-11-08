<!-- evidence-type: original-review -->

# Test review: the bash-version skip in the generated bash test

**Subject.** In `tests/scripts/shell_acts_bash_fuzz.test.ts`, the generated comparison skipped on bash < 4. CI's `check_test_weakening` gate counts that as a net-added suppression, and `src/rules/evaluator-independence.md` § Tests are evaluators requires an independent verdict for it.

**Prompt.** `agents/evidence/council/fuzz-bash4-skip-review-20261108.question.md`. It is committed and states no expected outcome.

**Reviewer and level.** The AI council's necessity classifier declined the question twice (`skipped (agent, lookup)`), in both `pr` and `design` modes. The review therefore ran at level L1: a fresh subagent session with no implementation context, given only the prompt file and read access to the repository. The subagent was told not to edit anything.

## Verdict

`STANCE: ratified | CONFIDENCE: high | DEALBREAKER: no`

The reviewer checked the prompt's facts against the test, the harness, the curated oracle and `.github/workflows/tests.yml`, and found them accurate. Its reasoning, condensed:

- **The skip is legitimate.** The recogniser follows bash 5 where versions differ, so an exact comparison with bash 3.2 would measure against a different spec.
- **The behaviour is still covered.** Linux CI cannot skip. The curated oracle covers the version-dependent forms on every platform.
- **Recommended change (a).** Raise the threshold from 4 to 5, because only 3.2 against 5.2 is measured.
- **Recommended change (b).** Replace the skip with a weaker check on older bash: every act bash runs must be named.
- **Soft spots named.** Test selection can leave the file out of a targeted run. The guard depends on `CI` being set and on the runner platform. No gate asserts that the comparison ran on at least one lane. A version string that cannot be read would turn into `NaN` and pass the guard by accident.

## What was adopted

Both recommendations, plus the NaN case.

- The exact comparison needs bash ≥ 5, and Linux CI throws without it.
- Under an older bash the test now **runs**. It asserts that every act bash runs is named by the recogniser; naming more is allowed. This replaces the `describe.skipIf`, so the suppression is gone, not just justified.
- An unreadable bash version now throws.
- The curated oracle no longer skips when bash is missing; it throws.
