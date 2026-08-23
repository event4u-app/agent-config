# Override: token-efficiency

**Mode:** `extend`

The **deliberately broken twin** for `tests/scripts/override_reachability.test.ts`:
identical in shape to its valid sibling, with the `> Overrides: …` citation line
**removed**.

It exists so the reachability check can be shown RED on demand. A check never
observed failing has unknown sensitivity, and step 1.1 of
`road-to-override-efficacy-proof` requires the twin for exactly that reason.

**Do not add a citation line to this file.** Its whole contract is the absence of
one: the test asserts `cited === false` and a `missing-citation` violation against
it, and restoring the line is the sensitivity probe recorded in the test's header —
run deliberately, then reverted.

A different rule name from its sibling (`token-efficiency`, also non-kernel and not a
safety floor) so the two rows cannot collide on `rule` and mask each other.
