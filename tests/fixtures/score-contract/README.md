# Score-contract twin fixtures

Every file under `twins/` is a **deliberately broken** scorecard. Each one
isolates exactly one defect and must turn `check_score_contract` red **on its own
finding code and no other** — the property that separates a real negative control
from a fixture that happens to fail.

Pattern borrowed from `tests/fixtures/pack-conformance/twins/`, which
`road-to-score-contract.md` Phase 1 step 1.1 names.

| Twin | Defect | Required finding code |
|---|---|---|
| `a-ten-with-empty-class.yaml` | a `ten` whose `negative_control_evidence` is empty | `class_rule` |
| `b-stale-pin.yaml` | a `path@<sha>` URI whose sha is not an ancestor of HEAD | `unresolvable_evidence` |
| `c-fixture-as-production.yaml` | `production_window` pointing at a `fixture:` run | `fixture_in_production_class` |
| `d-unresolvable-path.yaml` | an evidence path that does not exist | `unresolvable_evidence` |
| `e-false-completeness.yaml` | `rubric.state: complete` while the authoritative rubric is unavailable | `false_completeness` |
| `f-max-boundary-no-constraint.yaml` | `max-boundary` naming no standing constraint | `class_rule` |

Run one by hand:

```bash
./scripts-run src/scripts/check_score_contract --file tests/fixtures/score-contract/twins/b-stale-pin.yaml
```

`tests/scripts/check_score_contract.test.ts` asserts the table above, and also
the direction that is easy to forget: that the **real** scorecard is green, so a
twin failing is evidence about the twin and not about the gate being broken in
general.

**`b-stale-pin` is the one twin with a durability caveat**, stated because a
fixture that silently stops testing its defect is worse than none: it relies on
an all-zero sha never becoming an ancestor of HEAD. That is safe in practice, and
if git ever resolved it differently the twin would go green while the check it
guards still worked — so the test asserts the finding *code*, not merely a
non-zero exit.
