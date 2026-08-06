# Mandated Lines — the forced artifact at the decision point

Shared contract for the small closed set of **verbatim lines the run must emit
at a decision point**, and for the pre-send sweep that catches an owed line that
went missing. Loaded by the rules that own each decision point
([`think-before-action`](../../rules/think-before-action.md),
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md),
[`commit-policy`](../../rules/commit-policy.md),
[`downstream-changes`](../../rules/downstream-changes.md)) rather than restated
in each.

## Why a line and not a rule

An external source published the A/B of one obligation in three forms. Absent:
**0 of 4** runs surfaced a planted contradiction. Added as mid-list prose:
**1 of 4**, scoring *below* the no-instruction control. Converted into a
mandated verbatim line the run must emit *before* the behaviour-changing edit,
paired with a mechanical sweep for owed-but-missing lines: **4 of 4**. The rule
text did not change. Only its form did.

This suite has three recorded honest nulls on *reminder-shaped* interventions —
a decay-triggered restate, a reminder-injection experiment measuring zero delta,
a recursive-verification null. Those stand. This is a different mechanism: an
artifact the run must **produce**, not a reminder it must **receive**, with an
opposite measured result and its failing baseline published first. That is the
mechanism-match test in [`decision-revisit-gate`](../../rules/decision-revisit-gate.md),
passed rather than dodged.

```
A MANDATED LINE IS EMITTED AT THE DECISION POINT, BEFORE THE ACTION —
NEVER AS A TRAILING CHECKLIST THAT PROVES THE ACTION HAPPENED.
A LINE THAT IS OWED AND MISSING IS AN INCOMPLETE REPLY.
A LINE THAT IS NOT OWED IS NOT EMITTED. SILENCE IS THE DEFAULT.
```

## The five lines

Each is bound to a **decision point**, not to a topic. One sentence each.

### 1. Intent — before a behaviour-changing edit

Three slots: **what the code does · what the failing check expects · what the
specification says.**

> Intent: `parseDate` returns null on an empty string · the failing test expects
> a thrown `RangeError` · the spec says empty input is a caller error.

The load-bearing consequence, and the whole reason the line has three slots
rather than one: **when the three disagree, the disagreement is the finding and
the edit does not proceed.** A line that reads the same three ways is a line
that was written after deciding.

### 2. Authorization — before an irreversible outward action

Carries **the user's own words**, quoted. Two denials are explicit:

- **Documentation is not authorization.** A roadmap step, a command file, or a
  prior turn's plan describing the action is not the user asking for it.
- **Completing the task is not authorization.** Reaching the point where the
  action would be natural is not permission to take it.

> Authorization: "push it and open the PR" (this turn) — covers this push and
> this PR, not the follow-up fix.

Fires for the [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
Hard-Floor set: push, deploy, prod-trunk merge, prod data or infra, bulk
destructive, and any irreversible external action (send · publish · post ·
purchase · submit).

### 3. Commit — before a commit

Three slots: **the authorization and its exact scope · that the staged set
matches the intended edit · that nothing unintended is staged.**

> Commit: authorized "commit this now" (this turn), scope = the parser fix ·
> staged set is the 2 files that fix names · nothing else staged.

This is the mandated-artifact form of an obligation
[`commit-policy`](../../rules/commit-policy.md) already carries as prose, and it
is the fifth line rather than a variant of the authorization line because its
failure mode is different: the authorization line asks *may I*, the commit line
asks *is what I am about to record what I meant to record*. A commit with a
stray file is authorized and still wrong.

### 4. Pending — when a prescribed follow-up was deliberately not taken

> Pending: the negative test for the tenant path is not written — the fixture
> needs a second tenant and I did not create one.

Unlike the other four this line gates nothing. It is a **disclosure**
obligation: it makes a deliberate skip visible to the human who reviews the
work, and it exists because this suite's work lands through reviewed pull
requests, so the line has a recipient. A skip nobody was told about is
indistinguishable from a step that was forgotten.

### 5. Sibling search — after a defect fix

Names **the exact wrong construct searched for, and the count found.**

> Sibling search: grepped `JSON.parse(` without a try — 3 sites, 2 fixed, 1 in
> a test fixture and left.

A defect found in one place is presumed to recur until searched. The count is
part of the line because "I checked" is not a finding and zero is a real answer.

## The pre-send sweep

Before a reply that claims completion, check each line above against what the
run **actually did**, and add any that is owed and missing.

- Fire only when something is owed. A reply owing nothing passes untouched, and
  no line is emitted to prove the sweep ran.
- This is the same shape as the existing
  [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) and
  [`no-cheap-questions`](../../rules/no-cheap-questions.md) pre-send checks — a
  step in an existing sequence, not a new mechanism.
- The sweep is a backstop for a line that should already have been emitted at
  its decision point. A reply where every owed line first appears in the sweep
  is a reply that took the actions before thinking about them, and the sweep
  cannot repair that — it can only surface it.

## Brevity — how these avoid becoming ceremony

This suite's [`direct-answers`](../../rules/direct-answers.md) Iron Law 3 treats
long replies as a failure mode, and its anti-ceremony discipline says not to
invent receipts solely to prove execution. Five mandated lines are in real
tension with both. Three constraints resolve it, and they are part of the
contract:

1. **One sentence per line.** A line that needs a paragraph is a line whose
   decision was not made.
2. **Emitted at the decision point, never as a trailing checklist.** The
   measured 4-of-4 result came from a line emitted *before* the action. A
   checklist at the end of a reply is the ceremony shape, and it also loses the
   only property that made the mechanism work — that writing it can still stop
   the action.
3. **Two or more owed lines merge into one block, in execution order**, with
   minimal labels — one interruption rather than five.

```
Intent (parser.ts): returns null on empty · test expects RangeError · spec says caller error
Sibling search: grepped `JSON.parse(` without a try — 3 sites, 2 fixed, 1 test fixture left
Commit: authorized "commit this" (this turn), scope = parser fix · 2 files staged · nothing else
```

## Honest scope — what this does not claim

**Enforced by:** partially. `src/scripts/lint_mandated_lines.ts` is the
deterministic half and it checks only what a **run report** can be checked for:
a report claiming a behaviour change carries an intent line, and a report
describing an outward action carries an authorization line. It cannot check that
the line was emitted *before* the action rather than reconstructed after, and it
cannot check that the three intent slots were honestly filled. Those are
model-carried, and saying so here is cheaper than discovering it later.

**The transfer risk, stated.** The 4-of-4 measurement came from one source on
one task family — contradiction detection. This suite's work is largely
construction, where there may be no planted contradiction to surface, and the
mechanism could reduce to ceremony without anyone noticing.

**The cheap observation that would detect it:** track how often an emitted
intent line has its three slots **disagree**. If disagreements are effectively
never found, the line is decorating decisions already made and the set should
shrink. If disagreements are found and the edit is then revised or stopped, the
mechanism is doing the thing it was adopted for. That observation costs one
counter and is the first thing to look at before adding a sixth line.

## See also

- [`docs/contracts/settings-classes.md`](../../../docs/contracts/settings-classes.md) — a sibling contract in the same shape: prose that a gate reads.
- [`verify-before-complete`](../../rules/verify-before-complete.md) — the evidence gate the pre-send sweep runs beside.
- `src/scripts/lint_mandated_lines.ts` — the deterministic half.
