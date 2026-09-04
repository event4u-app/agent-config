# Silent-catch corpus

Fixtures for `detect_silent_catch` (`road-to-deterministic-defect-detectors`
step 3.1). Every fixture is a unified diff; `manifest.json` is the index.

## Scope is the load-bearing part

The check reads the lines a diff **adds**. A pre-existing empty catch is debt
this check does not own, and `neg-preexisting-empty-catch.diff` is the fixture
that pins that: the same empty block appears as unchanged context beside one
unrelated added line, and the check must stay silent. If that fixture starts
firing, the check has quietly become a whole-tree sweep, which is a different
tool with a different false-positive budget.

## The comment is not an escape hatch

`ts-comment-only-catch.diff` exists because the roadmap's risk register names
the evasion directly: a `pass  # intentional` comment satisfies a naive shape
check while changing nothing. Comments are not statements here, so the comment
does not rescue the block — the block is still empty.
