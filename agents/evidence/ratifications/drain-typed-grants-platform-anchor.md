---
proposed_by: claude-opus-5/drain-session-2026-09-10
implemented_by: claude-opus-5/drain-session-2026-09-10
reviewed_by: council/anthropic+openai-2026-09-10-platform-anchor
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the platform anchor

Covers the change that adds `check_platform_anchor`, its pure evaluator, its
committed expectation, and the contract correction that goes with them. Named
for the branch rather than a PR number because the PR does not exist when the
gate first reads this file.

## Why the verdict is `confirmed-non-expanding` and not `ratified`

```
THIS CHANGE ADDS A CONTROL AND EXPANDS NO ONE'S AUTHORITY.
NOTHING THAT WAS ENFORCING BECOMES NON-ENFORCING.
NO CEILING, FLOOR OR BASELINE MOVES.
`block_kernel_rule_writes.ts` IS UNTOUCHED AND STAYS BOUND.
```

`ratified` records that an authority-EXPANDING change was approved. Nothing here
expands: a new gate is added that can only ever refuse, an expectation file is
added that nothing previously relied on, and a contract section is corrected to
say something weaker about the tree than it said before. The kernel-write deny
is not retired, not weakened, and not rebound — `grep -c
block-kernel-rule-writes src/scripts/hook_manifest.yaml` returns the same 3 it
returned at the base revision.

## Scope of this ratification — read this before citing it

```
THIS RECORD COVERS THE ADDITIVE GATE, ITS EXPECTATION FILE AND THE CONTRACT
CORRECTION. IT IS NOT APPROVAL OF RETIRING `block_kernel_rule_writes.ts`.
THAT REPLACEMENT WAS REFUSED 2/2 IN ROUND 2 AND STAYS REFUSED.
IT IS ALSO NOT APPROVAL OF ANY KERNEL-RULE EDIT.
A LATER CHANGE DOING EITHER NEEDS ITS OWN RATIFICATION AND MAY NOT CITE THIS ONE.
```

The predecessor artifact `drain-typed-grants-5-1-5-2.md` attached the same
condition to itself, and this one inherits it deliberately rather than letting
two additive passes accumulate into an implied approval of the thing both
refused.

## What is ratified

- `src/config/platform-anchor.json` — the committed expectation, with its
  threat-model question recorded as owner-reserved rather than answered.
- `src/scripts/_lib/platform_anchor.ts` — the pure evaluator and the
  `NON_NEGOTIABLE_FLOOR` a policy edit cannot cross.
- `src/scripts/check_platform_anchor.ts` — the gate. Fires only when the diff
  already requires ratification; fails closed with `unverifiable` distinct from
  `noncompliant`.
- `src/scripts/check_kernel_edit_ratified.ts` — one addition: `ANCHOR_PATHS`
  joins the self-watched set, so an edit to the expectation needs its own
  ratification. This is the only change to an existing gated file and it makes
  the gate stricter, never looser.
- `docs/contracts/ratification-artifact.md` — § The platform anchor as measured,
  and the correction to trust layer 2.
- `tests/scripts/platform_anchor.test.ts` — 25 tests, both polarities.

## Who reviewed it, and the one place they disagreed

An AI council of `anthropic/claude-sonnet-4-5` and `openai/codex-default`, two
rounds with blind peer review, under a written owner delegation for an
autonomous drain run. Both seats converged on: build the full verifier (option
a); fail closed when the platform state cannot be established; treat an
unconditional bypass actor as a failure; put the expectation in a committed file
with a floor embedded in code; correct the contract in the same diff; and leave
`ratification-platform-anchor` OPEN until the settings change lands.

They differed on how the diff that adds the verifier should land, since it
cannot pass its own check. anthropic proposed wiring the gate into CI in this
same change behind a `# BOOTSTRAP EXCEPTION` marker admitting this one PR.
openai, in the same round, objected to any escape the candidate branch controls.
The direction taken satisfies both: the gate lands **runnable and unwired**, so
no agent-writable bypass is introduced and nothing that was enforcing stops
being enforcing. Wiring it is the second half of the blocker, after the settings
change, when it can go green on merit. The choice is auditable from the tree —
`grep -c check_platform_anchor taskfiles/ci-fast.yml` returns 0.

## What this record does NOT establish

That the platform anchor holds. It does not — measured, it fails on three
counts, and that measurement is the reason this change exists. The full reading
is `agents/evidence/analysis/platform-anchor-measured-2026-09-10.md`.

It also does not establish that the review behind it was independent in the
platform sense this very change is about. The council is a different party from
the implementer and its verdict is recorded verbatim, which is process evidence;
the repository required no approving reviewer at the time this landed. Saying so
here is the honest form, and it is exactly the residual the contract correction
now names.
