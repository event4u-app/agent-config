---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Writing or reviewing a diff — smallest change that solves the problem; no drive-by edits or reformatting"
triggers:
  - keyword: "drive-by"
  - keyword: "rewrite"
  - keyword: "fix"
  - phrase: "from scratch"
  - phrase: "second system"
routes_to:
  - "guideline:agent-infra/minimal-safe-diff-mechanics"
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "hook:minimal-safe-diff"
collision_ok:
  "fix": "a fix is the smallest change that solves the stated problem"
# obligation: line 25
obligation_frequency: "per-edit"
---

# Minimal Safe Diff

```
THE DIFF CONTAINS THE SMALLEST CHANGE THAT SOLVES THE STATED PROBLEM.
NEVER REFORMAT, RENAME, OR RESTRUCTURE UNTOUCHED CODE IN THE SAME DIFF.
NEVER ADD DRIVE-BY EDITS, OPPORTUNISTIC REFACTORS, OR DEPENDENCY BUMPS.
```

A diff is **safe** when every line in it is traceable to the stated task.
Every other line is scope creep and must be removed or moved to a separate
change.

## The rule

- The diff contains the **smallest** change that solves the stated problem.
- Every modified file must be **directly required** by the task — not
  "while I was in there".
- Never reformat, rename, or restructure untouched code in the same diff.
- Never change dependencies, versions, or tooling "because it was outdated".
- Never consolidate or split unrelated code paths as a side effect.
- Never delete code that *looks* dead without proof it is unreachable.

## Repair the shared path, don't patch the reported call site

```
BEFORE EDITING A SHARED PATH, ENUMERATE ITS CALLERS AND REPAIR THE PATH ONCE.
PATCHING ONLY THE REPORTED CALL SITE IS NOT THE SMALLEST CHANGE — IT IS THE
SMALLEST-LOOKING ONE, AND IT LEAVES EVERY OTHER CALLER BROKEN.
```

Fires when the defect sits in something several callers reach — a shared
helper, a base class, a middleware, a query builder. The minimum set of files
then INCLUDES the shared path and EXCLUDES the N call sites a per-caller patch
would touch: repairing once is both smaller and complete.

**The PRE-fix half of a pair.** The post-fix half ships in
[`downstream-changes`](downstream-changes.md) § Defect-pattern search — name
the construct, grep the tree, report the count, AFTER the fix. Enumerate
before, sweep after; the two run over different sets.

## Re-derive the requirement, don't inherit the shape

```
A REPAIR INHERITS THE SHAPE OF WHAT IT REPAIRS UNLESS YOU ASK OTHERWISE.
BEFORE CHANGING A MECHANISM'S PARAMETER, STATE THE REQUIREMENT IN ONE LINE
AND CHECK THE SHAPE AGAINST IT — NOT AGAINST THE DOCSTRING THAT FRAMED IT.
A DOCSTRING TELLS YOU WHAT THE CODE DECIDED. IT NEVER TELLS YOU WHETHER
THAT WAS THE DECISION TO MAKE.
```

Fires on a **downstream repair** — a fix to something your own diff broke, or a
red you are clearing — where the smallest change is a different VALUE and the
thing being fixed has an unexamined FORM: a first-hit loop that should be a
union, a single field that should be a list, one root where the requirement
names three.

**This is the gap the pre-work rules leave open, by their own terms.**
[`improve-before-implement`](improve-before-implement.md) does not activate for
bug fixes ("the problem is already defined") and
[`invite-challenge`](invite-challenge.md) excludes "evidenced bug fixes" — which
is right for the case they were written for and wrong here, because a downstream
repair *looks* like a defined problem while its definition came from the broken
code.

**Worked failure, 2026-09-07.** A change emptied `.claude/skills` of skills and
left ~49 command wrappers. `resolveSkillsRoot` tried two workspace-relative roots
and took the first non-empty one, so it resolved the wrappers. The repair chosen
was to swap the ORDER; the requirement was *"rank every catalogue the session can
reach"*, which no ordering of a first-hit loop can satisfy, and the host-global
root the whole task was about appeared in neither position. The evidence had been
measured an hour earlier and was in the same session's own notes.

**The one-line check that would have caught it:** name the requirement, then ask
whether the current form *can* express it. A form that cannot is not a parameter
bug.

## Own-orphan cleanup

Your diff cleans up exactly the mess it made — nothing more:

- An identifier (import, variable, function, parameter) is an **own-orphan**
  iff its **last reference disappeared in a file THIS diff touched**. Remove
  it in the same diff — it traces to the task; leaving it is an incomplete
  change, not restraint.
- If **any reference survives in a file the diff did not touch**, the
  identifier is **pre-existing debt** — leave it untouched and surface it via
  [`active-remediation`](active-remediation.md)'s note-and-ask ladder, never
  delete drive-by.
- The check is mechanical: after editing, grep each identifier your hunks
  stopped referencing; zero remaining references and the last one was yours →
  own-orphan (delete); otherwise → note. (`downstream-changes` runs the same
  sweep for renames — this is that sweep applied to the new diff.)

Body migrated to [`guideline:agent-infra/minimal-safe-diff-mechanics`](../docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md) (per P4 of `road-to-kernel-and-router.md`) — larger-change guidance, auto-formatter hunk handling, anti-over-engineering criteria (premature abstraction, speculative features, rewrite trigger, no tombstones + the council's rejected trust-internal-code clause), break-glass exception, and the full bounded-remediation carve-out prose (five conditions summarized: same path/module, ≤ ~10 lines, no API change, no dependency/migration, verification in the same commit — everything outside is note + ask per `active-remediation`; a live cross-user/tenant exposure is the sole interrupt).
Trigger-set above activates this routing on demand, independent of the discipline profile (ADR-110).

## See also

`scope-control` · `downstream-changes` · `think-before-action` · `preservation-guard` · `verify-before-complete` · [`active-remediation`](active-remediation.md) · [`broken-access-control`](broken-access-control.md).
