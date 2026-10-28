# Findings: release-census-test-weakening
<!-- evidence-type: original-review -->

Independent verdict on the net assertion loss in
`tests/scripts/check_release_pr_shape.test.ts` (removal of the evidence census
from `task release-prepare`), required by `check_test_weakening`.

- **Reviewer:** AI council, two providers (anthropic, openai), 2/2 present, run 2026-10-28.
- **Prompt:** `release-census-test-weakening.review-input/prompt.md`, sha256 `48b9f2b9ce87cf4b90c46fee0e16159d06481fc4d048048f3b9dab2fe716192a`.
  It carries the production diff and the test diff, and asks per file for LEGITIMATE or WEAKENING. It states no expected outcome.

## Verdict per file

| Test file | Verdict | Reason |
|---|---|---|
| `tests/scripts/check_release_pr_shape.test.ts` | LEGITIMATE (anthropic) · WEAKENING (openai) | Both seats agree the glob-boundary, digit-class, writer-path and exactly-one-caller assertions tested the deleted allowlist entry and the deleted pipeline binding, and must not be restored. The WEAKENING seat named two gaps: the `censusDateStamp()` UTC-format assertion was dropped although the function survives, and the replacement checks only `release-prepare`'s literal body, so an indirect invocation (via `sync`, `generate-tools` or a workflow) would pass. |

## Disposition

- **Date-stamp coverage:** not lost. `tests/scripts/report_evidence_temperature.test.ts` § `censusDateStamp` asserts the UTC `YYYY-MM-DD` stamp on both sides of a day boundary under two pinned time zones — the census's own suite, which is where both seats said it belongs.
- **Indirect invocation:** fixed in this PR. A second test scans every tracked file (`git grep`, not a root list) and requires **zero** invocations of the census, where the removed test required exactly one.

**Sensitivity:** with the pre-change `taskfiles/content.yml` restored, both pipeline tests fail; with the current file all 19 tests pass.
