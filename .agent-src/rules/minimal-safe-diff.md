---
type: "always"
alwaysApply: true
description: "Minimal safe diff — the smallest change that solves the stated problem; no drive-by edits, no opportunistic refactors, no reformatting of untouched code"
source: package
---

# Minimal Safe Diff

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

See also: `scope-control` · `downstream-changes` · `think-before-action` · `preservation-guard`.
