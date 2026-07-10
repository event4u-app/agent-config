---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Writing or reviewing a diff — smallest change that solves the problem; no drive-by edits or reformatting"
triggers:
  - intent: "writing a diff"
  - intent: "reviewing a diff"
  - keyword: "drive-by"
  - keyword: "rewrite"
  - keyword: "fix"
workspaces: [engineering]
packs: [engineering-base]
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

## Before writing the diff

Ask yourself, in order:

1. **What is the minimum set of files that must change for the stated task?**
   If your answer includes files with no causal link to the task, stop and
   remove them.
2. **What is the minimum number of lines per file?** If you are editing a
   method, edit the method — not the surrounding class.
3. **Is any of this a refactor?** If yes, it belongs in its own commit or
   PR, clearly labeled as a refactor, with no behavior change.

## When the task seems to require a larger change

- A rename, restructure, or framework upgrade that crosses the minimal-diff
  line is a **separate, explicit** task — ask the user before expanding.
- A bug fix that exposes a broader design problem stays a bug fix. Log the
  design problem as a follow-up (ticket, note, TODO) and ship the fix alone.
- A new feature that tempts you to "clean up" the module first: resist.
  Add the feature, commit it, then propose the cleanup as a separate change.

## Auto-formatter or linter rewrites unrelated code

Revert those hunks before staging. The diff you present is the diff you own.
If project policy forbids partial formatting, split into two commits:
*format only* · *behavior change*.

## Red flags in your own diff — reject them

Files the task never mentioned · import reordering, whitespace, or comments
outside the edited region · "small improvements" to neighboring methods ·
test-only mixed with behavior changes in one commit · renames outside the
task scope · dependency bumps "because it was close to the cache".

## When in doubt

Ask. A minimal diff plus one follow-up is cheaper than a sprawling diff the
reviewer has to untangle.

## Anti-over-engineering

The smallest change is also the least *abstract* and least *speculative* one:

- **Three similar lines beat a premature abstraction.** Do not extract a helper
  / generic / config layer to dedupe two or three call sites — inline
  repetition is cheaper to read and change than the wrong abstraction. Per new
  abstraction: **cite the second caller — or inline it.**
- **No speculative features.** Nothing beyond what was asked: no
  configurability or "flexibility" nobody requested, no parameters with one
  call site, no error handling for scenarios that cannot occur in this
  codebase.
- **The rewrite trigger.** If the change could be half the size without losing
  behavior, rewrite before presenting. Self-check: *"Would a senior engineer
  call this overcomplicated?"* — if yes, simplify.
- **No tombstones.** Delete removed code completely — no `_oldName` renames,
  no `// removed X` / `// no longer used` markers, no dead re-export shims kept
  "for safety". Git history is the tombstone.
- **No docstrings/comments on untouched code.** Do not annotate code the diff
  does not change.

Wrong/right pairs for each ban:
[`simplicity-and-goal-demos`](../docs/guidelines/agent-infra/simplicity-and-goal-demos.md)
— the demos are the recognition surface; match your diff against the *right*
column before presenting.

**Not adopted (council):** the source's "validate only at system boundaries /
trust internal code" clause is **rejected** — internal code can be wrong, and
"trust" is not a testing strategy. Keep validating internal invariants; this
fold is about *diff shape*, not about dropping internal checks.

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

## Break-glass exception

This rule stays in force during production incidents. "Break-glass mode"
narrows verification (see `verify-before-complete`) — it does **not**
license drive-by edits.

Allowed during break-glass:

- The **smallest** change that stops the bleeding — one file, one
  method, one guard — preferred over any refactor.
- A fast revert to a known-good commit, even if it undoes unrelated
  improvements shipped in the same PR.

Not allowed, even in break-glass:

- "While I'm in there" cleanups, reformatting, or dependency bumps.
- Expanding the fix to neighboring modules without evidence they are
  part of the incident.
- Merging the hotfix with pending refactors from another branch.

After the incident, open a **follow-up PR** for any scope that was
intentionally deferred and reference the break-glass commit in its
description.

## Bounded remediation carve-out

The default stands: no drive-by edits, no opportunistic refactors. The one
bounded exception — a **small, task-aligned security/correctness fix in code
the current task already touches** — is governed by
[`active-remediation`](active-remediation.md). It is permitted inline **only**
when ALL hold: same request path / module, ≤ ~10 changed lines in one
production file (plus its test file), no public-API / response-shape change, no dependency bump or migration,
and its verification (e.g. the negative test) ships in the same commit.
Anything outside those five conditions is **not** this carve-out — it is
note + ask per `active-remediation`. This never licenses reformatting,
renames, dependency bumps, or version upgrades (a syntax-idiom modernization
is allowed only under `active-remediation`'s version-gated, behavior-preserving
clause; a dependency/version bump stays ask-only). The sole case that may
interrupt is a **live cross-user/tenant data exposure** ([`broken-access-control`](broken-access-control.md)) —
fix-now-if-small, else stop and surface; never defer it silently.

See also: `scope-control` · `downstream-changes` · `think-before-action` · `preservation-guard` · `verify-before-complete` · [`active-remediation`](active-remediation.md) · [`broken-access-control`](broken-access-control.md).
