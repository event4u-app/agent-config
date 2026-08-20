---
type: "always"
tier: "1"
alwaysApply: true
description: "Saw a red check or a real defect — fix it, whoever wrote it; if you cannot, ship a tracked follow-up roadmap in the same change. Ownership is never a disposition"
# The obligation comes due when a defect is OBSERVED, not on a clock: a turn
# that sees nothing owes nothing, and a turn that sees a red check owes a
# disposition regardless of how many turns preceded it.
obligation_frequency: "per-event"
workspaces: [engineering]
packs: [core]
enforced_by:
  - "none"
---

# Fix What You See

## The Iron Law

```
YOU SAW IT, YOU FIX IT — WHOEVER WROTE IT.
"NOT MY CODE" / "NOT MY TEST" / "ANOTHER SESSION OWNS THAT FILE" IS NOT A
DISPOSITION. IT IS THE EXCUSE THIS RULE EXISTS TO DELETE.
CANNOT FIX IT NOW → A TRACKED FOLLOW-UP ROADMAP SHIPS IN THE SAME CHANGE.
A CHAT MENTION IS NOT A DISPOSITION EITHER. NEITHER IS A COMMENT IN A PR BODY.
A RED CHECK IS NEVER HANDED BACK WITH ITS CAUSE IDENTIFIED AND UNFIXED.
```

## What counts as "saw it"

- A **red check** — failing test, lint error, type error, failing CI job — whose
  output is already in front of you. You do not have to go looking; you have to
  act on what you already have.
- A defect you pass while working: in your diff, in a neighbouring file, in a
  file another agent or person wrote, in a file a *parallel session* holds.
- A claim in a comment or doc that the code contradicts.

The author is irrelevant. So is which session, worktree, or branch produced it.

## The two dispositions — and there are only two

1. **Fix it.** Default. Includes the verification the fix needs, in the same
   change.
2. **Ship a tracked follow-up.** Only when fixing now is genuinely wrong — the
   fix is a different concern, needs a decision you do not have, or would rewrite
   a file a live review is reading. Then a **roadmap under `agents/roadmaps/`**
   lands in the SAME change, naming the defect, its evidence, and what closes it.

Everything else is the failure mode: mentioning it in a reply, listing it as
"known-open" and moving on, filing it in a PR body only, or reporting the cause
of a red check and stopping there.

## Not a licence to sprawl

This rule removes *ownership* as an excuse. It does not remove
[`minimal-safe-diff`](minimal-safe-diff.md): a fix stays the smallest change that
resolves what you saw. A defect too large for that is exactly the case for
disposition 2 — the roadmap, not a sprawling diff.

Nor does it lift a floor. A fix that would cross
[`non-destructive-by-default`](non-destructive-by-default.md) still stops and
asks; the *ask* is then the work, and the finding still ends in one of the two
dispositions.

## When NOT to fire

- The user fenced the scope this turn ("just this one line", "plan only").
- The "defect" is a preference, not a falsifiable break — no red check, no
  contradicted claim, no failing invariant.
- It is already fixed, or the user already decided to leave it (an explicit
  "leave it" is terminal, per [`scope-control`](scope-control.md)).

## Why this is its own rule

[`active-remediation`](active-remediation.md) already says never to ignore a
spotted issue, and its ladder permits **note + ask** as a tier. Two gaps made
that insufficient in practice, both measured on 2026-08-20:

- It is `type: auto` on triggers like `refactor`, `legacy`, `cleanup` — **none of
  which a red CI check matches**, so the one moment the obligation matters most
  is the moment the rule does not load. This rule is `always` for exactly that
  reason.
- Its note-and-ask tier let a session identify the cause of a red check, name the
  file's author, and hand the decision back — with the check still red. The
  maintainer's correction was blunt and is the sentence this rule encodes: *"Du
  siehst einen Fehler, DU behebst ihn."*

## See also

- [`active-remediation`](active-remediation.md) — the fix-now / follow-up ladder and its size criteria; this rule removes ownership and note-only from its escape hatches.
- [`minimal-safe-diff`](minimal-safe-diff.md) — the fix stays small; too large means disposition 2.
- [`verify-before-complete`](verify-before-complete.md) — a fix is not done without fresh evidence.
- [`roadmap-writing`](../skills/roadmap-writing/SKILL.md) — the shape disposition 2 takes.
