---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Saw a red check or a real defect — fix it, whoever wrote it; if you cannot, ship a tracked follow-up roadmap in the same change. Ownership is never a disposition"
# Due when a defect is OBSERVED, not on a clock: a turn that sees nothing owes
# nothing; a turn that sees a red check owes a disposition.
obligation_frequency: "per-event"
routes_to:
  - "guideline:agent-infra/active-remediation-mechanics"
triggers:
  - keyword: "failing"
  - keyword: "fails"
  - keyword: "broken"
  - keyword: "regression"
  - phrase: "is red"
  - phrase: "ci failed"
  - phrase: "ci is"
  - phrase: "not my"
  - phrase: "nicht mein"
  - phrase: "someone else's"
  - phrase: "whose test"
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "instruction-only: ownership-as-excuse is a disposition in prose; no gate can see a red check handed back with its cause named"
---

# Fix What You See

## The Iron Law

```
YOU SAW IT, YOU FIX IT — WHOEVER WROTE IT.
"NOT MY CODE" / "NOT MY TEST" / "ANOTHER SESSION OWNS THAT FILE" IS NOT A
DISPOSITION. CANNOT FIX IT NOW → A TRACKED FOLLOW-UP ROADMAP SHIPS IN THE
SAME CHANGE. A CHAT MENTION IS NOT ONE EITHER, NOR A "KNOWN-OPEN" LINE IN A
PR BODY. A RED CHECK IS NEVER HANDED BACK WITH ITS CAUSE NAMED AND UNFIXED.
```

**Saw it** = a red check already in front of you (test, lint, type, CI), or a
defect you pass while working — in your diff, a neighbouring file, a file
another agent or a parallel session wrote. The author is irrelevant.

**Two dispositions, and only two:** fix it with its verification, or land a
roadmap under `agents/roadmaps/` in the SAME change naming the defect, its
evidence, and what closes it.

**Read the red before fixing it, with the narrowest tool.** A CI job:
`gh run view --job <id> --log-failed | grep -E '×|FAIL|Error'` — never the whole
log into context, and never `--watch`'s exit code, which is 0 even on a failure.
A local red: the test runner with a filter on the one failing name, `tsc
--noEmit` for a type error, the linter scoped to the changed files. **Reproduce
it before you believe your diagnosis** — an environment-dependent red reproduces
under the condition, not on your machine's defaults.

Match the probe to the surface, because a passing unit test is not evidence for
a broken surface: an HTTP red is proven with `curl` against the running
endpoint, a UI red with a Playwright spec, a runtime red with the debugger
(`xdebug`, breakpoints) rather than by reading the diff again.

**Prove the fix with the same tool that showed the red**, in the same change.
For a guard or a concurrency fix, prove SENSITIVITY too: neutralise the mechanism,
watch the test fail, restore it. A test never seen red has unknown sensitivity.

## Bounds

Removes *ownership* as an excuse, not the diff limit:
[`minimal-safe-diff`](minimal-safe-diff.md) still caps the change — too large
IS the roadmap case. A fix crossing
[`non-destructive-by-default`](non-destructive-by-default.md) still stops and
asks; the ask becomes the work, not the exit.

**Does NOT fire:** user fenced the scope this turn · no falsifiable break (a
preference, not a red) · already decided by the user.

## Why separate from `active-remediation`

That rule forbids ignoring a spotted issue and its ladder permits **note + ask**.
Two properties made it insufficient, both measured 2026-08-20: it is `type: auto`
on `refactor`/`legacy`/`cleanup` triggers — **none of which a failing CI job
matches**, so it does not load when the obligation matters most — and its
note-and-ask tier is what let a session name a red check's cause, name the
file's author, and hand it back still red.

Mechanics (fix-now size criteria, follow-up shape) stay there; this rule only
deletes the two escapes.

## Honest activation gap — this rule is `auto`, and it wanted to be `always`

It shipped `auto` for a budget reason, not a design one, and the gap that leaves
is exactly the one it was written to close: **a red check the agent sees in tool
output triggers nothing.** Keyword triggers match the PROMPT. So the rule loads
when a human says "CI is red" or "not my test", and does NOT load when a test
run comes back red and nobody has said a word.

`check_always_budget` is the reason: the extended always-budget sat at
60,252 / 60,254 chars — **two characters of headroom** — and the cap is a
ratchet that may only move down. The other nine always-rules are the kernel,
which `block_kernel_rule_writes` denies agent writes to, so no room can be made
from this side. A 2,332-char rule puts the total at 103.9 %.

Closing the gap needs one of: the ext-cap ratchet opened deliberately (a
maintainer decision, recorded), a kernel rule shortened to make room, or a
`post_tool_use` carrier that notices a non-zero verification exit — the only
option that would fire on tool output rather than on wording. Until then, `auto`
plus this paragraph is the honest state: the obligation is real, its delivery is
partial, and the partiality is named rather than implied away.
