---
adr: 251
status: superseded
date: 2026-08-30
decision: authorization-window-shape-not-width
supersedes: —
superseded_by: ADR-252
phase: road-to-turnaround-followups · Phase 2
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: mixed
  decision_makers: [maintainer, agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/agent-turnaround-2026-08-30.md
    - src/scripts/hooks/block_unauthorized_git.ts
    - src/scripts/git_authorization_hook.ts
    - src/domains/git/pr/merge/command.md
    - src/rules/decision-revisit-gate.md
authority_basis: evidence
review_trigger: >-
  Reopen when the pause-and-renew shape is measured to be routed around — a
  hand-widened `LEDGER_MAX_AGE_MS` reaching any executing bundle, an operator
  merging out of band to avoid the pause, or a run recorded as abandoned at
  expiry rather than resumed. Reopen also when the ledger gains a binding to a
  PR number or a HEAD sha: a clock-scoped window and an operation-scoped
  authorization answer different questions, and the residual named in
  § The residual this record does not resolve is what makes the second trigger
  a real condition rather than a hypothetical. Explicitly NOT a trigger: a run
  being long, which is the pressure this record already weighed.
---

# ADR-251 — The authorization window's SHAPE moves, its WIDTH does not

## Status

**Superseded** by [ADR-252](ADR-252-specificity-replaces-recency-for-merge.md) on
2026-09-03, on both of this record's own reopening conditions: the pause-and-renew
shape was routed around a third time, and the ledger gained the PR-number binding
this record named as the transition that changes the question.

**The 30-minute width is unchanged** and still governs every operation that has
not frozen its targets. What ADR-252 adds is that a target-bound authorization no
longer needs a clock, because what protects the user there is object identity
rather than recency. The measurements, the residual and the authority analysis
below stand — they are the input to that record, not something it overturned.

Originally **accepted** · 2026-08-30. `LEDGER_MAX_AGE_MS` in
`src/scripts/hooks/block_unauthorized_git.ts:545` stays at **30 minutes**. What
changes is the behaviour AT expiry: a run that outlives its authorization
**pauses, reports, and asks for re-authorization** instead of terminating.

The decision was taken by an AI council convened 2026-08-30 — members
`anthropic` (claude-sonnet-4-5) and `openai` (gpt-4o), **2/2 convergent**. Both
seats classified the transition as within council authority, and both
independently proposed the same shape without seeing each other's answer. The
council artefact is local-only and gitignored, so it is cited by date and
membership rather than by path.

## Context

`LEDGER_MAX_AGE_MS` is the freshness bound on the git-authorization ledger. The
guard reads a ledger's `detected_at` and refuses it once
`now - detected_at > LEDGER_MAX_AGE_MS` (`block_unauthorized_git.ts:599`). It
gates `pr-merge`, a `BLOCK_OPS` member, precisely because merging is
irreversible.

**The pressure is measured, not asserted.** Over the ten most recent sessions of
this package, wall-clock spans were 0.0 · 0.4 · 0.4 · 0.5 · 1.2 · 3.1 · 3.9 ·
6.8 · 7.0 · 35.0 hours — **7 of 10 exceed the window**, median span **3.1 h**.
Span is the correct metric even though most elapsed session time is neither
model nor tool time: the window is wall-clock, so an idle session expires the
ledger exactly as a busy one does. The corpus is the one measured in
`agents/evidence/analysis/agent-turnaround-2026-08-30.md`.

**The pressure has already produced two security regressions, and this is the
reason the question could not be left standing.** On 2026-08-21 and again on
2026-08-30 the constant was hand-patched to twelve times its value behind a
`PR-drain` marker promising a revert that never came. The first reached the
trunk and was the value actually executing: the built dispatcher carried the
widened number and no occurrence of the 30-minute one. Both edits sat directly
beneath a docblock forbidding exactly that edit and recording the previous
occurrence. Finding F6 of the turnaround evidence file records both.

So the question put to the council was narrow: **is a 30-minute window usable at
the measured run lengths, or is it an unusable path that will keep being routed
around?**

## Decision

**1. The window stays 30 minutes.** `LEDGER_MAX_AGE_MS` is unchanged.
Widening it remains forbidden practice, and the guard's docblock keeps saying
so. This record does not authorise a larger default, a per-run flag that raises
it, or an environment override.

**2. At expiry the run PAUSES rather than ends.** The supported behaviour is:
stop before the guarded operation, report what remains with a `window-expired`
disposition per unprocessed unit, name the exact re-authorization needed, and
wait. The operator's reply resumes the run. Previously the command surface said
the run "stops cleanly and reports", which a reader could and did take as
*terminates* — so a long run's only two readings were "abandon the run" or
"widen the constant", and the second is what happened twice.

**3. Renewal uses the path that already exists.** No new machinery is
introduced, because none is needed —
see § The mechanism finding.

**4. Raising the constant would NOT have been the council's to decide.** See
§ Authority analysis. It is recorded here so a later reader does not infer from
this record that the width is now negotiable at council level.

## The mechanism finding

`src/scripts/git_authorization_hook.ts` writes the ledger on the
`user_prompt_submit` slot, keyed by session id. Read at this record's base:

- `run()` (`:478`) returns early only for a machine wake — a payload whose text
  begins with `<task-notification>` or `<system-reminder>` (`:512`). A
  human-typed turn is never suppressed.
- `classifyAuthorization()` (`:370`) is stateless per prompt. There is no
  first-authorization-only branch, no once-per-session latch, and no suppression
  of a repeat.
- Every human-typed prompt therefore writes a ledger stamped
  `detected_at: new Date().toISOString()` (`:530`) to this session's own file
  (`:537`).
- The guard compares `now - detected_at` against the constant (`:599`).

**Consequence:** a mid-run reply carrying an authorization phrase already resets
the age the constant is compared against. The renewal path is not new work — it
is the write path, used a second time in the same session. That is why option B
lands as a behaviour and documentation change rather than as a feature.

**What that preserves, and why the council checked it.** The renewal signal
still originates in text the user typed, so it stays agent-unforgeable — an
agent cannot write the ledger, only the prompt-submit hook can, and only from a
human turn. The ledger stays session-scoped, so one conversation cannot renew
another's authorization. No agent-writable store is introduced. Those three
properties are what make a longer effective authorization lifetime under this
shape different in kind from the same lifetime bought by widening the constant:
under the widened constant, a single consent silently covers six hours of
unattended operation; under this shape every additional 30 minutes costs a fresh
human turn.

## Authority analysis

`decision-revisit-gate`'s reserved table sends to the owner any transition that
**lowers or removes a recorded security floor**, and keeps with the council
**strengthening a floor, or an equivalent swap above it**.

- **Keeping the value and changing the expiry behaviour does not lower the
  floor.** The refusal threshold is untouched; what changes is what the run does
  when refused. Both seats reached this independently.
- **Raising `LEDGER_MAX_AGE_MS` would lower it,** and would have been
  owner-reserved. It was off the table before the council convened, and it is
  still off the table after.

`reopen_policy: owner` with `protected_dimensions: security_floor` is recorded
for exactly this reason: this record may be strengthened by a council, and the
width may be weakened by nobody but the owner.

## The residual this record does not resolve

The council named a limitation and did **not** resolve it, and it is recorded
here rather than dropped because it is the strongest argument in the whole
question.

> A merge authorization is not "consent to merge right now" — it is "consent to
> merge this PR at this HEAD sha". The ledger binds neither. It records that the
> user said yes, and when. So a 30-minute window is already not ensuring fresh
> consent to *this specific merge*; it is ensuring recency of *some* consent.

Two things follow. First, the window's protective value is weaker than its
30-minute precision suggests — it is a recency heuristic standing in for an
operation binding. Second, the honest reason to keep 30 minutes is not that it
is the correct number: it is that no measurement in this tree establishes a
better one, and the one recorded attempt to change it by hand produced two live
weakenings of a `BLOCK_OPS` guard.

Binding the ledger to a PR number and a HEAD sha would make the clock a
secondary control rather than the primary one. That is a real design change, it
was not proposed to the council, and it is named in this record's
`review_trigger` as a reopening condition rather than promised as work.

**Also unresolved, and stated:** the window has never been recorded catching an
unintended merge. It has been recorded being removed twice. This record keeps a
control whose benefit is unmeasured and whose cost is measured — the
conservative direction on an irreversible operation, not an evidenced optimum.

## Evidence

| Claim | Basis |
|---|---|
| The window is 30 minutes and gates an irreversible operation | `src/scripts/hooks/block_unauthorized_git.ts:545` (`LEDGER_MAX_AGE_MS = 30 * 60 * 1000`) and `:599` (the `now - detected_at` comparison); `pr-merge` is a `BLOCK_OPS` member in the same file |
| 7 of the 10 most recent sessions exceed the window; median span 3.1 h | The ten-session corpus measured by `src/scripts/probe_turnaround.ts` and written up in `agents/evidence/analysis/agent-turnaround-2026-08-30.md`; spans 0.0 · 0.4 · 0.4 · 0.5 · 1.2 · 3.1 · 3.9 · 6.8 · 7.0 · 35.0 h. The same file records the range independently at `:151` ("The sessions in this corpus run 1.1–35 h") |
| The constant was hand-widened twice, both times twelvefold, both times behind a `PR-drain` marker with an unkept revert | `agents/evidence/analysis/agent-turnaround-2026-08-30.md` finding F6 (`:130-160`), which records the 2026-08-30 working-tree diff and the identical 2026-08-21 occurrence named in the guard's own docblock |
| The first widening was the value actually executing, not a proposal | Same finding: the built dispatcher (built 2026-08-29 17:46) carried the widened value and no occurrence of the 30-minute one. Restored and rebuilt 2026-08-30 |
| Renewal already works through the existing prompt-submit path | `src/scripts/git_authorization_hook.ts` — `run()` at `:478`, machine-wake early return at `:512`, stateless `classifyAuthorization()` at `:370`, `detected_at` stamped at `:530`, per-session write at `:537`. No branch in that path is conditional on whether an authorization was already recorded this session |
| A machine wake cannot renew the ledger, so the signal stays agent-unforgeable | `src/scripts/_lib/machine_wake.ts` — `humanTypedThisTurn` returns false for the `<task-notification>` / `<system-reminder>` prefixes, and `run()` returns before touching any per-turn record |
| The ledger is session-scoped, so one conversation cannot renew another's | `git_authorization_hook.ts` `ledgerFileFor()` and the session check in `block_unauthorized_git.ts` `_readLedgerFile`, which discards a ledger whose `session_id` differs |
| Keeping the value while changing expiry behaviour is council-decidable; raising it is not | `src/rules/decision-revisit-gate.md` § Who decides — the owner-reserved row is "**Lowers or removes** a recorded security / privacy / safety / data-handling floor"; the council-decidable row is "Strengthening a floor, or an equivalent swap above it" |
| The command surface previously read as "terminate" | `src/domains/git/pr/merge/command.md` § 7 before this change: "the run stops cleanly and reports", with no resumption path stated |
| The docblock citation does not change what executes | The hook bundle rebuilt from this checkout before and after the comment-only docblock edit is byte-identical (sha256 `355fd72d056a`, 1.2 MB); esbuild strips non-legal comments, so `check_hook_bundle_content` needs no rebuild for this change |

**The grade is E2 — repeated and comparative.** Every row is read off a named
file at a named line in this tree, or off a committed evidence artefact that
states its own corpus and instrument. Nothing here rests on recollection.

**What no evidence establishes**, stated because it is the load-bearing gap:
**that 30 minutes is the right number.** No measurement in this tree says so.
The number is kept because the alternative on the table was to weaken an
irreversible-operation guard against a benefit nobody has measured, and because
the residual above shows the window is a proxy for a binding it does not have.

## Consequences

**Positive.** The forbidden action stops being the only reading of a long run:
an operator whose run outlives the window now has a supported path that is not
"abandon" and not "patch the constant". The command surface and the guard now
say the same thing. The blocker `authorization-shape-for-long-runs` — carried
from `road-to-agent-turnaround` into `road-to-turnaround-followups` Phase 2 —
has the recorded answer its closure condition requires.

**Negative, and named.** A 3-hour median run now carries roughly one
re-authorization prompt per 30 minutes of guarded operation. That friction is
real and this record accepts it rather than dissolving it; the council's
position is that friction on an irreversible operation is the intended cost, not
a defect. If the friction is what drives the next hand-widening, the
`review_trigger` above is written to catch that and this record is the thing
that reopens.

**Unresolved.** No PR/HEAD binding is designed, specified, or scheduled here.
No enforcement exists for the pause-and-renew behaviour itself — it is prose in
a command surface and a docblock, model-carried like every other behavioural
obligation in this tree. `check_hook_bundle_content` refuses a source edit that
did not reach the executing bundle, which catches the *widening*, not a run that
ignores the pause.

## Alternatives

**Option A — leave the supported path exactly as it was.** The run ends at
expiry and the operator starts again. Rejected by both seats on the same
evidence: the path has now been routed around twice, both times by weakening a
`BLOCK_OPS` guard, and a supported path that is reliably bypassed is not a
control. Keeping it unchanged would have been a recorded decision too — the
closure condition accepted "leave it as is" — but neither seat could argue it
against two live regressions.

**Widen `LEDGER_MAX_AGE_MS`.** Not on the table. It lowers a recorded security
floor, which is owner-reserved and not the council's to take, and it is the
action the guard's own docblock forbids and that produced both regressions.

**An authorization scoped to a named PR rather than to a clock.** Not rejected —
**deferred**, and it is the shape the residual above points at. It requires the
ledger to carry a PR number and a HEAD sha, which is a design change nobody has
specified, and shipping a half-form of it would replace a weak control with an
untested one. Recorded as a reopening condition instead of as a rejection.

**A longer window reachable only behind an explicit per-run flag the operator
types.** Rejected. It is the widening with a keystroke in front of it: the
operator who types the flag once has authorized six unattended hours, which is
the property that made the hand-patches dangerous. The pause-and-renew shape
buys the same run length while charging a human turn for each interval.

## References

- `src/scripts/hooks/block_unauthorized_git.ts` — the guard, the constant at `:545`, and the docblock that cites this record.
- `src/scripts/git_authorization_hook.ts` — the ledger writer; the renewal path this record relies on.
- `src/scripts/_lib/machine_wake.ts` — why a background notification cannot renew an authorization.
- `src/domains/git/pr/merge/command.md` § 7 — the command surface updated to match this decision.
- `agents/evidence/analysis/agent-turnaround-2026-08-30.md` — the ten-session corpus, the span measurements, and finding F6 on both widenings.
- `src/rules/decision-revisit-gate.md` § Who decides — the reserved-transition table the authority analysis applies.
- ADR-247 — the decision-revisit doctrine this record's reopen fields are written against.
