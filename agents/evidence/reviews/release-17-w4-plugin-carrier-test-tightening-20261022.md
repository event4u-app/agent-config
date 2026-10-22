<!-- evidence-type: analysis -->

# The plugin carrier refuses with no dispatcher — the verdict behind the changed test

`tests/install/hook_carrier_never_silent.test.ts` counts one assertion fewer
after wave 4 of the 17.0.0 self-review fixes, and `check_test_weakening`
asks for the verdict that licenses it. The test now asserts the opposite of
what it pinned before, and the behaviour it pinned was a finding.

## The decision

Finding `c72572abf2e4` of the 17.0.0 self-review ("Plugin carrier fails open
for fail_closed guards, and the test pins that") was put to the AI council in
the release-17 accepted-risk round. Both seats converged in round 2 on
`FIX-BEFORE-RELEASE`:

- anthropic: the advertised plugin installation path has fail-closed guards
  failing open, a materially unprotected path;
- openai: advertised fail-closed guards cannot ship through a plugin carrier
  that knowingly disables them when its dispatcher is unavailable.

The verdict file is
`agents/runtime/release-17/accepted-risk-verdicts.json` (gitignored runtime
state of the release-17 review, entry `c72572abf2e4`). The decision that the
old assertion was wrong is the council's, not the implementer's.

## What the test lost, and what it holds now

Before: on a plugin-only install with no reachable dispatcher, `PreToolUse`
was asserted to exit 0, to print the `no hook dispatcher reachable` warning
and NOT to print the refusal line — three assertions pinning the fail-open.

After (commit `6ae0be0e43`): the same call is asserted to exit 2 and to print
the refusal line. The `not.toContain(refusal)` assertion has no counterpart
because the refusal is now required; the warning assertion is replaced by the
refusal assertion. Net one assertion fewer, and every remaining one is
stricter: the state that used to pass now has to refuse, matching the settings
carrier the neighbouring case already asserts.

## What this does not establish

The council judged the finding, not this diff of the test. The record states
the finding's verdict and why the assertion count fell; whether the new
assertions fully cover the refusal path rests on the test file itself.
