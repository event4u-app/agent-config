## Acceptance Criteria

> Added 2026-08-13 after the completion review found the roadmap had none: the
> phase-level Falsifiers state when a phase is **wrong**, which is not the same
> as stating when it is **done**. A review over closed steps had nothing to
> check against. Each criterion below is checkable from the tree.

| # | Criterion | Met? |
|---|---|---|
| A1 | The data-basis ladder exists as one table in the mechanics guideline, cited by name from both the rule's Iron-Law block and `design-review`'s verification reference | yes |
| A2 | `verification-automation.md` § Mockup-to-code branches on artifact kind; the code branch reads the code and the image branch survives unchanged | yes |
| A3 | The adopt-the-code duty exists AND its `code-provenance` scope line is present, with the cross-link readable from both rules | yes |
| A4 | `fe-design` § Ad-hoc mode carries an inventory step whose buckets are the engine's own `COVERAGE_BUCKETS` names, and it renders as a step of the loop | yes |
| A5 | Three `daf-*` fixtures exist, each carrying its measured / skipped / unmeasured state rather than an assumed pass, and each cited by a scanned surface | yes |
| A6 | The precedence chain names generative design-system tooling as its fourth member | yes |
| A7 | The Source-C harvest verdicts are recorded anonymised, with the park carrying an un-park condition | yes |
| A8 | The read-before-write rate is published over a denominator its own prose endorses, and its blind spot is stated in the output | yes |
| A9 | No new trigger ships without a near-miss row testing the direction that trigger opens | yes — enforced by withdrawing the builder-URL class rather than shipping it |
| A10 | Every Iron-Law line added to `design-fidelity` is consistent with that rule's own § What counts as the spec | yes — the screenshot line carries its scope clause |

**Not claimed:** that the operator's symptom is fixed. Phase 1 could not
reproduce it under conditions where it can occur (no capture tool, no URL
handover), so these criteria cover the *defects verified in the tree*, not the
symptom. Phase 6 is where the symptom claim would be earned, and it needs a
consumer repo.
