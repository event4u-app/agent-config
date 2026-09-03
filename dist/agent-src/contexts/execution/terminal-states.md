# Terminal states — what a run REPORTS when it stops

> `road-to-skill-ecosystem-runtime-enforcement` Phase 4. Loaded on demand;
> the obligation surface is [`verify-before-complete`](../../rules/verify-before-complete.md).

A run has exactly one terminal state, and reporting the wrong one is not a
wording problem. **An error or an exhausted budget is never reported as
success.** The failure this vocabulary exists to stop is the one that reads
identically to a win: a loop that hit its iteration cap, a gate that could not
run, an approval that never came — each ending with a summary that says the work
is done.

## The seven states

| state | what it means | what it is NOT |
|---|---|---|
| `success` | The stated objective is met AND verified by a command run this turn. | Not "the edits landed". Landing is not verifying. |
| `clean-no-op` | Nothing needed doing, and that was **established**, not assumed. | Not "I found nothing" from a scan that never ran. A dead scope is `blocked`. |
| `blocked` | An external precondition is missing: a credential, a permission, a service, a decision only the user can make. | Not "hard". A blocker is a thing that is absent, not a thing that is difficult. |
| `approval-required` | The work is ready and the next action crosses a gate the agent may not cross alone. | Not `blocked`: nothing is missing, and the run produced a deliverable. |
| `exhausted` | A declared budget ran out — iterations, tokens, spend, wall-clock. | **Never** `success`, whatever partial progress exists. The cap firing IS the outcome. |
| `stagnated` | The budget has not run out and progress has stopped: the same failure signature is repeating. | Not `exhausted`. Stagnation is detected by a NO-PROGRESS signal, not by a counter. |
| `premise-invalidated` | The plan premise moved: the situational-awareness fingerprint the run engaged under (`origin/main` plus every open PR head) was re-observed and differs. | Not `exhausted` — the budget is untouched. Not `stagnated` — progress may have been fine. Not `blocked` — nothing is missing; what the run knew went stale. |

**Why `premise-invalidated` is not `blocked` with a reason field.** Added
2026-09-03 (AI council, unanimous) when the continuation ladder needed a word for
a run whose base ref and open-PR set had moved under it. Reusing `blocked` keeps
the arity at six and loses two things that are not decorative: the ability to
COUNT premise invalidation separately from a missing precondition, and
type-enforced exhaustive handling in the consumers that switch on the state. The
remedies differ as sharply as `exhausted` and `stagnated` do — `blocked` says
obtain the missing thing, `premise-invalidated` says re-probe and re-plan against
the world as it now is.

A consumer that cannot represent it reports `blocked`, which is the DECLARED
downgrade in `_lib/outcome_vocabularies.ts` and not an ad-hoc substitution. The
value domain is versioned (`RUN_TERMINAL_VOCABULARY_VERSION`, v2), and a reader
meeting an unrecognised persisted value reports it as not-recorded rather than
crashing or guessing.

**Why `exhausted` and `stagnated` are separate**, when both stop a loop: they
have different remedies and different next actions. `exhausted` says *the work
may be fine and the budget was too small* — raising it is a legitimate response.
`stagnated` says *more of the same will not help* — raising the budget is the
wrong response, and a vocabulary that collapses them invites exactly that.

## The mapping onto roadmap glyphs, and the three states glyphs cannot express

Roadmap checkboxes carry four glyphs. They describe a **step's disposition**, not
a **run's outcome**, and the gap is not an oversight — it is what makes a
budget-exhausted stop indistinguishable from a completed one in a dashboard.

| glyph | meaning | nearest terminal state |
|---|---|---|
| `[x]` | done | `success` — and only when a verify clause was met |
| `[ ]` | open | *(no state — the step has not run)* |
| `[~]` | deferred | `blocked` or `approval-required`, undistinguished |
| `[-]` | cancelled | *(a decision, not a run outcome)* |

**Four states have no glyph, and they are exactly the ones a validation budget,
a hard-blocker class and a drift detector produce:**

1. **`exhausted`** — the run stopped at its cap with the step still open. The
   glyph stays `[ ]`, which is identical to *never attempted*. A reader cannot
   tell three failed attempts from zero.
2. **`stagnated`** — same `[ ]`, and the distinction that matters (retrying is
   pointless) is invisible.
3. **`approval-required`** — collapses into `[~]` alongside `blocked`, so a
   roadmap cannot show that the work is FINISHED and waiting on a human, versus
   not startable at all.
4. **`premise-invalidated`** — same `[ ]` again, and the reader cannot see that
   the step was not attempted because the plan it belonged to went stale.

**This is recorded rather than fixed.** Adding glyphs would change a format that
`update_roadmap_progress`, `check_roadmap_trackable`, `lint_empty_roadmaps` and
every archived roadmap already parse — a migration, not a step. What the
vocabulary buys today is that a run's CLOSING REPORT can say the word the glyph
cannot.

## Progress-primary ordering

When the objective is **countable** — findings closed, tests passing, occurrences
remaining — the primary stop signal is **no progress** or a **new minimum**, and
the iteration cap is the **backstop**.

**Do not remove the cap.** A no-progress signal is only as good as the metric
behind it, and a metric that stops moving because the measurement broke looks
exactly like a metric that stops moving because the work is done. The cap is what
bounds the damage when the primary signal is wrong.

Where the objective is not countable, the cap is the only signal and the N=3
validation budget in [`autonomous-execution`](../../rules/autonomous-execution.md)
applies unchanged.

## Reporting contract

A closing report names the state **by one of the seven words above**, and where the
state is not `success` it names what would change it:

- `exhausted` — the budget that ran out, its value, and what was achieved inside it.
- `stagnated` — the repeating failure signature, and the attempts it survived.
- `premise-invalidated` — which fingerprint was claimed, which was observed, and
  that the next act is a re-probe rather than another iteration.
- `blocked` — the missing thing, by name.
- `approval-required` — the exact action awaiting approval.
- `clean-no-op` — what was scanned, so "nothing to do" is distinguishable from
  "nothing was read".

## See also

- [`verify-before-complete`](../../rules/verify-before-complete.md) — no
  completion claim without fresh evidence; this names what to claim when the
  claim is not completion.
- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3
  validation budget whose firing is `exhausted`.
- [`autonomy-mechanics`](autonomy-mechanics.md) — the budget's mechanics and the
  adaptive-effort ordering this page's progress-primary section states.
