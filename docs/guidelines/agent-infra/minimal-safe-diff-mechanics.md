# Minimal Safe Diff — Mechanics

> Anti-over-engineering criteria, larger-change guidance, break-glass exception, and the bounded remediation carve-out for the `minimal-safe-diff` rule

_Origin: migrated from `src/rules/minimal-safe-diff.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, "The rule", "Before writing the diff", the red-flags list, and "Own-orphan cleanup" (anchor-referenced by `downstream-changes`) stay in the rule; this file carries the worked criteria._

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

## Anti-over-engineering

The smallest change is also the least *abstract* and least *speculative* one:

- **Three similar lines beat a premature abstraction.** Do not extract a helper
  / generic / config layer to dedupe two or three call sites — inline
  repetition is cheaper to read and change than the wrong abstraction. Per new
  abstraction: **cite the second caller — or inline it.** The operative
  **code-level** threshold in this suite is the **second real repetition** (or a
  genuine second axis of change), matching `architecture` and
  [`component-oriented-and-oop-development`](../component-oriented-and-oop-development.md);
  the "three lines" phrasing is about *line* count inside one call site, not a
  third-occurrence gate. A borrowed "wait for the third occurrence" rule is
  **not** adopted for code — it would fork a threshold this repo already
  decided. UI extractions carry deliberately higher, scoped bars (ADR-213) —
  the per-class canon is [`abstraction-thresholds`](../abstraction-thresholds.md).
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

### The sanctioned-rewrite trap (second-system effect)

Distinct from *the rewrite trigger* above, which fires **mid-diff** on your own
bloated change. This one fires at **intake**, when the user has already
sanctioned a rewrite, a v2, a from-scratch replacement, or a large refactor —
and it is the single highest over-build context there is. The second system a
person builds is the most over-built one they will ever build: every constraint
the first system taught them arrives as a feature, and none of it is demanded
by the ticket in front of them.

Permission to rewrite is permission to **replace the behaviour that exists** —
not a licence to add the capability the old system lacked. The v2 ships the
v1 surface, minus what is provably dead, plus only what was explicitly asked
for. Everything the rewrite "makes easy to add now" is a separate change with
its own demand gate (guideline § 8-pre) and its own place on the
solution-size ladder (§ 8b-ladder).

Wrong/right pairs for each ban:
[`simplicity-and-goal-demos`](simplicity-and-goal-demos.md)
— the demos are the recognition surface; match your diff against the *right*
column before presenting.

**Not adopted (council):** the source's "validate only at system boundaries /
trust internal code" clause is **rejected** — internal code can be wrong, and
"trust" is not a testing strategy. Keep validating internal invariants; this
fold is about *diff shape*, not about dropping internal checks.

## Break-glass exception

The rule stays in force during production incidents. "Break-glass mode"
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
the current task already touches** — is governed by `active-remediation`
(mechanics: [`active-remediation-mechanics`](active-remediation-mechanics.md)).
It is permitted inline **only** when ALL hold: same request path / module,
≤ ~10 changed lines in one production file (plus its test file), no
public-API / response-shape change, no dependency bump or migration, and its
verification (e.g. the negative test) ships in the same commit. Anything
outside those five conditions is **not** this carve-out — it is note + ask
per `active-remediation`. This never licenses reformatting, renames,
dependency bumps, or version upgrades (a syntax-idiom modernization is
allowed only under `active-remediation`'s version-gated,
behavior-preserving clause; a dependency/version bump stays ask-only). The
sole case that may interrupt is a **live cross-user/tenant data exposure**
(`broken-access-control`) — fix-now-if-small, else stop and surface; never
defer it silently.

## Shared-path repair — scope, and when NOT to fire

The rule's pre-fix clause is the obligation; this is its boundary.

**Does not fire** when nothing else reaches the code (a leaf function, a
one-caller private), or when the shared repair is genuinely larger than the
five-condition bounded carve-out above permits. In the second case it is
note + ask per [`active-remediation`](active-remediation-mechanics.md) — never
a silent per-caller patch presented as the minimal diff, and never a
shared-path rewrite smuggled in under a bug-fix label.

**Enumerate with the tool, not from memory.** The caller set is a grep or an
index query, and its COUNT is what makes "repairing once is smaller" a claim
rather than an intuition — two callers and a three-line patch each is not
obviously worse than one shared change, while nine callers is.

## Before writing the diff — the three questions

Migrated verbatim from the rule (road-to-trigger-delivered-rule-bodies A1),
which had to pay for the pre-fix root-cause clause out of its own token
ceiling. Nothing was cut; this is where it now lives.

Ask yourself, in order:

1. **What is the minimum set of files that must change for the stated task?**
   If your answer includes files with no causal link to the task, stop and
   remove them.
2. **What is the minimum number of lines per file?** If you are editing a
   method, edit the method — not the surrounding class.
3. **Is any of this a refactor?** If yes, it belongs in its own commit or
   PR, clearly labeled as a refactor, with no behavior change.

## Red flags in your own diff — reject them

Files the task never mentioned · import reordering, whitespace, or comments
outside the edited region · "small improvements" to neighboring methods ·
test-only mixed with behavior changes in one commit · renames outside the
task scope · dependency bumps "because it was close to the cache".

## When in doubt

Ask. A minimal diff plus one follow-up is cheaper than a sprawling diff the
reviewer has to untangle.

## See also

- `minimal-safe-diff` (rule) — Iron Law, the rule, the pre-fix shared-path repair clause, own-orphan cleanup. The pre-diff checklist, the red-flag catalog and the when-in-doubt line live HERE since A1.
- [`active-remediation-mechanics`](active-remediation-mechanics.md) — the fix-now / note+ask / follow-up-PR ladder detail.
