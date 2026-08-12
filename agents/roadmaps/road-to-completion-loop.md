---
complexity: structural
---

# Road to the completion loop — measure "delivered less than was asked" before refusing on it

> **The ask (2026-08-12):** the agent should check, after each run, whether the
> task was actually fulfilled the way the user wanted, and continue if not —
> "loop engineering". This roadmap builds the missing half of that, in the order
> that keeps it honest: the **measurement** first, the **detector** only if the
> measurement finds something.

> **Most of the loop already ships.** The four components the practice names —
> trigger, verifiable end state, verifier, stop rules — are present:
> `turn-end-gate` on the `stop` slot is a trigger that can REFUSE (always armed
> since 2026-08-12), `verify-before-complete` § Turn-completion is the end state,
> detectors A/B/C are the verifier, and the N=3 ladder plus the two re-entrancy
> layers are the stop rules. What is missing is one detector.

## Context / What is verified

**The gap, stated precisely.** Detector A refuses a closing paragraph that
*promises* work. Detector C refuses an edit that ran *no check*. Neither covers
the shape the ask is about: **the user asked for three things, two were
delivered, nothing was promised and no edit went unverified.** Silent
incompleteness has no carrier today.

**The premise is UNMEASURED, and that is the reason for Phase 1.**
`conformance_scan` carries **five** checks since conformance round 7 —
`language-pin`, `git-authorization`, `vacuous-evidence`, `evidence-steering`, and
`completion-claim`. None of them measures completeness against the user's ask, so
nobody has a rate. Building a refusal on an unmeasured premise is the failure this
package has recorded under "measure the premise first, state the number".

**The fifth check is adjacent, not this gap, and the boundary is worth stating
because the names collide.** Round 7's `completion-claim` / detector D fires on a
completion claim made while the last CI read in the session was **not settled** —
a claim over an *unfinished verification*. It measured 17 over 28 sessions, 15 of
them post-carrier across 14 sessions. It says nothing about whether the delivered
work matched the ask: a session that asked for three things, delivered two, and
never touched CI is invisible to it by construction (no CI observed ⇒ no finding).
So this roadmap's gap survives round 7 intact — and the count above was corrected
here rather than left reading "four", because a stale premise in a Context section
is exactly what its own Phase 1 exists to prevent.

**One observed instance exists, and it is not a rate.** Council 2026-08-04
recorded a falsifiable hand-off rule built on *enumeration-completeness* errors —
"missing a case in a set you were responsible for enumerating" — after a session
produced two in a row. One session is an existence proof that the class is real.
It is not evidence about frequency, and this roadmap does not treat it as such.

**The extraction primitive already exists and is verified in delivery.**
`delegation_nudge_hook` pulls structural signals out of the SUBMITTED prompt —
enumerated file lists, "for each" / "alle …" shapes, explicit slice counts,
ordered-plan markers, multi-deliverable conjunctions — via `classifyTask`, and
its exit-2 injection is end-to-end verified on the `claude` platform. A
completeness detector reuses that, rather than inventing prompt parsing.

**The recursive-verification honest-null does NOT close this, and the reason is
in the null's own text.** That measurement (capability Δ = 0, McNemar p = 1.0,
fired on ~28 % of tasks, council-TERMINAL) tested a loop that ADDS A CRITIC to
judge whether an attempt was good enough. The skill states its own scope: *"It is
not evidence about retrying on a check that has already returned red: there the
verdict is deterministic and in hand, and no critic is introduced."* A detector
firing on **structural signals extracted from the prompt** introduces no critic
and produces a deterministic verdict, so it is a different mechanism. What the
null DOES bind — and this roadmap accepts it — is the falsification shape:
pre-register the reduction, and revert rather than narrate if it does not appear.

**The cost of a false positive went UP on 2026-08-12.** The gate's settings
switch was removed; a misfiring detector can no longer be turned off by
configuration, only by a revert. Bounded (one extra turn, two re-entrancy
layers), but no longer free. Measurement-before-detector is not ceremony here —
it is what pays for the missing kill-switch.

## Phase 1 — the instrument

- [ ] 1.1 Add a `task-completeness` check to `conformance_scan`: for each
  assistant turn, extract the deliverables enumerated in the turn's own user
  prompt (reusing `classifyTask`'s signals, not a new parser) and record how many
  are addressed by the turn's tool calls and closing prose.
  `verify:` `CHECK_IDS` holds 5 ids and `CHECK_MEANINGS` has a definition for the new one.
- [ ] 1.2 Write the definition into `CHECK_MEANINGS` in the shape the four
  existing ones use — what it detects, and what distinguishes a hit from a false
  read. A count with no definition is the shape this file's own comment warns
  about.
  `verify:` `--why task-completeness` prints the definition and, when it did not
  fire, prints *did not fire* rather than silence.
- [ ] 1.3 Hand-validate every hit on the first run and publish the precision.
  A detector over a small corpus can produce confident nonsense; the rate is
  worthless without it.
  `verify:` the published figure names the corpus size and the hand-validated count.

## Phase 2 — the decision, taken on the number

- [ ] 2.1 Pre-register the bar BEFORE reading Phase 1's output: the rate and the
  hand-validated precision at which detector D is worth its false-positive cost,
  and the values at which this roadmap closes as an honest null instead.
  `verify:` the bar is committed in a commit that precedes the measurement commit.
- [ ] 2.2 Read the number against the bar and record the verdict. **A null here
  is a real outcome**, not a failure of the roadmap — the sibling
  `recursive-verification` null is the precedent, and it saved a mechanism whose
  cost scaled with every task for benefit on a 28 % tail.
  `verify:` the verdict cites the pre-registered bar and the measured figure side by side.

## Phase 3 — detector D, only if Phase 2 says so

- [ ] 3.1 Build the false-positive corpus FIRST, in the shape
  `PROMISSORY_NEGATIVES` already uses: every legitimate way a turn can address
  fewer items than the prompt enumerated — a blocking question, a hand-back, a
  user-fenced scope, an explicitly deferred item. Refusing these is what teaches
  a maintainer to revert the gate, and there is no switch to reach for now.
  `verify:` the negative corpus is non-empty and every entry returns null.
- [ ] 3.2 Add detector D to `turn_end_gate_hook.ts` beside A/B/C — one guard,
  three-then-four detectors, no second hook. Building the unsafe part twice is
  how a second detector becomes a second outage.
  `verify:` the spawned suite covers D refusing and D staying silent, through the
  real process, on a workspace with no settings file.
- [ ] 3.3 Re-measure with D live and compare against the pre-registered
  reduction. Revert if it does not appear.
  `verify:` the post-flip figure is published beside the pre-flip one.

## Acceptance criteria

- `conformance_scan` measures completeness and publishes a hand-validated rate.
- The bar for shipping detector D was committed before the number was known.
- If the bar is missed, this roadmap closes as a published null and detector D is
  NOT built.
- If it is met, D ships with a non-empty false-positive corpus and a post-flip
  re-measurement.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Detector D refuses legitimate hand-backs, with no switch to disable it | implementation | A turn that answers 1 of 3 enumerated items because it is ASKING about the other two is correct behaviour, and the most common shape of a partial turn. Refusing it inverts the ask discipline the package spends nine rules on | 3.1 builds the negative corpus before the detector and pins the hand-back, blocking-question and fenced-scope shapes. The existing `PROMISSORY_NEGATIVES` block is the template and already carries three of them | Phase 3 |
| 2 | The measurement is built to find what it was built to find | implementation | The extractor and the scorer share `classifyTask`, so a prompt shape it cannot see reads as "complete" — a detector that reproduces the defect it measures, which this package has recorded before at 303 vs a real 626 | 1.3 hand-validates every hit and publishes precision; 1.2 requires the definition that lets a reader tell a hit from a false read | Phase 1 |
| 3 | The bar is set after the number is known | product | Pre-registering post-hoc is theatre — the exact wording a council used to cancel a prior hypothesis test rather than defer it | 2.1 requires the bar's commit to PRECEDE the measurement commit, which is checkable from the git log by anyone | Phase 2 |
| 4 | "Loop engineering" is read as an unbounded retry loop | product | The named practice ships with three hard stops (iteration ceiling, no-progress detection, budget cap) and the failure mode is reward hacking — an agent optimising for loop continuation rather than the user's goal | Nothing here adds a retry loop: the gate refuses ONCE per turn and the existing N=3 ladder is untouched. The turn continues in the same turn; there is no new budget and no new cap to mint | Phase 3 |
| 5 | The honest-null is read as closing this question | product | A reader who knows the recursion null exists may reject the whole track without checking the mechanism match | Context above quotes the null's own scope carve-out, and Phase 2 accepts its falsification shape rather than routing around it | Context |

## See also

- `src/scripts/hooks/turn_end_gate_hook.ts` — the guard D would join; § "Always armed".
- `src/scripts/conformance_scan.ts` — `CHECK_IDS` / `CHECK_MEANINGS`, the instrument.
- `src/scripts/hooks/delegation_nudge_hook.ts` — the prompt-signal extraction to reuse.
- `src/skills/recursive-verification/SKILL.md` — the null, and the scope it does not close.
- `src/rules/verify-before-complete.md` — the end-state this loop enforces.
