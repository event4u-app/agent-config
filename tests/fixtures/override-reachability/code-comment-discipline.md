> Overrides: code-comment-discipline § What a comment is FOR — this fixture's project
> documents its public API for external consumers, so a docblock mirroring a signature
> earns its place there in a way it does not in the base rule.

# Override: code-comment-discipline

**Mode:** `extend`

A **valid** override fixture for `tests/scripts/override_reachability.test.ts`.

Chosen subject: `code-comment-discipline` is **non-kernel** (it is not one of the nine
in `KERNEL_RULE_IDS`) and **not a safety floor**, so the audit row it produces is the
ordinary-override shape — which is the shape the reachability check needs to prove it
discovers. A kernel subject would exercise the registration branch instead and prove
something else.

## What this fixture asserts by existing

That an override file placed in the audited directory is **discovered at all**, that
its `rule` field resolves to the rule it overrides, and that `cited` is `true`
because the `> Overrides:` citation line above is present and well-formed.
