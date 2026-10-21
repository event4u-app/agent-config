<!-- evidence-type: analysis -->

# The hook command's trust order — the verdict behind the rewritten tests

`check_test_weakening` reads a net loss of assertions in five test files of this
change. The behaviour those assertions pinned was removed on purpose, by a
decision the implementer did not make.

## The decision

17.0.0 is held on `road-to-hook-guards-that-hold-17-findings`. Its phases 2 and
3 are findings `feaebdef733b` (a project-tree dispatcher runs as the user's
global hook, ahead of the guards) and `bb6ab0f5f37d` (with no dispatcher the
`fail_closed` guards pass silently). The AI council split on the design
(`agents/evidence/council/hook-command-trust-order-20261021.md`); the owner chose
option 2 — nothing in the project tree runs, and `PreToolUse` refuses without a
dispatcher — on 2026-10-21. The plugin-carrier exception came from a second
council round recorded in the same file.

## What the tests lost, and what replaced it

Removed, because the behaviour is gone: "a project-local install still wins",
"project-install bundle present → exec node bundle", "source-checkout bundle
runs once hook_manifest.yaml is present", "still uses the local wrapper once
the checkout has node_modules", "two worktrees each take their own route" (the
local half), and "PreToolUse with no dispatcher prints nothing and exits 0".

Added in their place, each seen red against `main`'s command before the change:
planted dispatchers never run, with and without a staged runtime; `PreToolUse`
with no dispatcher refuses with the repair message; the plugin carrier and every
other event keep exit 0; an `agent-config` on `PATH` inside the project is not
taken, one outside is; a dispatcher exiting 1, 126 or 127 on `PreToolUse` is
refused, a refusal (2) and an allow (0) pass through. The rewritten worktree and
fallback tests assert the new route — the global CLI — rather than nothing.

## What this does not establish

No independent reviewer read the test diff. The verdict discharging the
weakening is the owner's decision recorded above; the gate can see only that a
record exists.
