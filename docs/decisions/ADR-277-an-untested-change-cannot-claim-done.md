---
adr: 277
status: accepted
date: 2026-09-11
decision: a-completion-claim-over-production-code-with-no-test-touched-is-refused-at-the-turn-end-gate
supersedes: —
superseded_by: —
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: delegated
  decision_makers: [agent]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/analysis/why-the-suite-did-not-require-a-test-2026-09-11.md
    - src/scripts/hooks/turn_end_gate_hook.ts
    - src/scripts/_lib/turn_end_refusals.ts
    - src/skills/error-handling-patterns/SKILL.md
    - docs/contracts/design-artifact-verification.md
    - tests/scripts/turn_end_gate_hook.test.ts
    - agents/evidence/analysis/detector-e-measured-over-two-corpora-2026-09-11.md
review_trigger: >-
  The false-positive half fired and was discharged on 2026-09-11 (0 false
  positives in 335 turns; see § Honest limits). What remains open is RECALL:
  reopened when E's catch rate is measured against a labelled corpus, to decide
  whether the claim gate is the right trigger or whether it should also fire on
  a ship verb — the measurement showed 15 of 16 no-test production turns did
  not claim done, so the claim gate is where nearly all the filtering happens
  and is the right thing to question first. Also reopened if skill activation stops being zero — the whole
  argument for moving this obligation into a hook is that the skill layer
  carrying it is measured at 0 invocations over 11,338 turns, and a non-zero
  figure changes that premise. Also reopened if a second host gains a
  refusal-capable stop slot, because the reach statement in § Honest limits is
  written against exactly one.
---

# ADR-277 — an untested change cannot claim done

## Status

Accepted 2026-09-11, on a maintainer report and a measured audit of why the
suite did not prevent it. Not council-decided: the mechanism adds a refusal on
one host for a case the maintainer named directly, and no owner-reserved
dimension is touched.

## Context

A feature built with this suite in a consumer project shipped broken — a detail
view that crashed on open, flyouts that never fired — and with no tests. The
maintainer then had to hand-enumerate what should have been exercised: every
view mode, every CRUD verb, drag-and-drop, mobile, filters, reminders.

Their diagnosis was that TDD had not been followed. The question this record
answers is the one behind it: **why did nothing in the suite refuse that turn?**

The audit is in
`agents/evidence/analysis/why-the-suite-did-not-require-a-test-2026-09-11.md`.
Four findings, each independently sufficient:

1. **The obligation is in the layer measured at zero use.** Three skills carry
   a strict test-first discipline. `docs/proof.md:98`: skill self-selection over
   this package's own store is **0 invocations across 30 sessions and 11,338
   assistant turns**.
2. **The layer that reaches the model says "prefer".** The strongest test-first
   sentence in the 120-file rule tree is *"prefer test-first / TDD"*
   (`think-before-action.md:43`). No kernel rule mandates a test.
3. **"Done" accepts evidence that cannot see the change.**
   `verify-before-complete` requires FRESH evidence and never RELEVANT evidence,
   so a green full-suite run over untouched tests satisfies it literally.
4. **The one gate that can refuse had the same hole.** The turn-end gate's
   detector C asks whether any verification command ran; `npx eslint src`
   clears it.

## Decision

**Detector E on the turn-end gate.** It fires when all three hold:

- the turn edited at least one **production source** file (by extension, minus
  test paths),
- the turn edited **no test file at all**, in any of the conventions this
  suite's stacks use,
- and the reply makes a **completion claim** — reusing detector D's
  `_COMPLETION_RE` and its same-line negation check rather than a second dialect
  of "done".

Each condition is load-bearing. Without the first it fires on a docs turn;
without the second it fires on a turn that did its job; without the third it
fires on the red step of red-green-refactor, which is the discipline it exists
to encourage.

**Two prose defects are fixed in the same change**, because both are the same
failure reaching the same page from a different direction:

- `error-handling-patterns/SKILL.md` forbade full stack traces *"in user-facing
  surfaces"* with **no dev/prod distinction** — read literally, a prohibition on
  the developer's own diagnostics in their own dev environment, which is exactly
  the unreadable blank page that made this failure expensive. It now carries the
  environment split and the rule that **a blank page is never an acceptable
  failure mode in dev**.
- `docs/contracts/design-artifact-verification.md` made only steps 1-5 of its
  checklist mandatory, leaving interaction at step 6 — and step 6 read *"the
  **primary** interaction"*, singular. Steps 1-5 all pass on a page whose every
  button is dead. The mandatory range now ends at 6, and 6 covers every
  interaction the change introduces or touches.

## Why a hook rather than a rule

Three reasons, and the first is decisive.

**A rule would land in the layer that already failed.** Finding 2 is that the
rule layer carries a "prefer". Adding a stronger sentence there produces another
model-carried obligation, which is the shape that did not work.

**A rule costs standing payload, and there is none.** ADR-275/276 left the
measured ceiling at the base with **zero headroom**. New rule prose reds the
gate for every pull request until an offsetting reduction lands. The hook costs
nothing standing — it is code.

**A hook can refuse.** That is the property the whole audit points at: the
suite's only refusal-capable surface had a hole, and the fix belongs in it.

## Honest limits

- **Teeth on one host.** `turn-end-gate` is bound on `claude` only
  (`hook_manifest.yaml:1288`). Everywhere else this obligation stays
  model-carried, and the sibling with universal reach
  (`before_complete_hook.ts`) is observability that *"never blocks"* by its own
  contract.
- **It cannot judge a test's quality.** Any test file clears it.
  `testing-anti-patterns` owns assertion quality, and a guard that tried to
  judge it from a path would be judging what it cannot see.
- **It is a proxy, and the narrow one.** "No test file at all" is not
  "under-tested" — it is the total case. That is why it is worth refusing and
  why it under-covers everything short of it: a feature with one token test
  passes.
- **It does not enumerate anything.** The state matrix the maintainer typed by
  hand — entity × CRUD verb × view mode × viewport × filter — is still enumerated
  by no artifact in this suite. Detector E refuses the turn that wrote none of
  it; it does not produce the list.
- **~~The false-positive rate is unmeasured.~~ MEASURED 2026-09-11, same day.**
  `measure_turn_end_gate` now scores E (and C) over a real corpus:
  **1 fire in 335 turns across two stores**, and a hand read of that one fire
  says it was right — so the measured false-positive count is **0**. The fire
  is the reported feature itself: a turn that edited 28 production PHP files of
  the ToDo recurrence module, touched no test, and opened with *"Fertig. E9 ist
  umgesetzt und belegt."* Detector C was silent on it, which is this record's
  own C-does-not-cover-E argument surviving contact with a corpus.
  **RECALL stays unmeasured** — one fire is not a catch rate, and nothing
  scores the turns E stayed silent on.
  `agents/evidence/analysis/detector-e-measured-over-two-corpora-2026-09-11.md`.

## Alternatives rejected

- **A new always-loaded rule.** Costs standing payload against zero headroom,
  and lands in the layer finding 2 shows to be insufficient.
- **Strengthening `think-before-action`'s "prefer" to "must".** Same layer, same
  problem, plus it would add prose to a rule at a zero-headroom ceiling.
- **Making detector C's `isVerificationCommand` narrower** (dropping `lint`,
  `build`). Rejected: C's narrowness is already argued at length in its own
  comment, and a linter run IS verification of something — it is just not
  evidence the change works. Two different questions deserve two detectors.
- **Requiring a coverage delta.** Coverage lives in the consumer's tooling,
  which this hook cannot run, and a threshold nobody derived would be the
  invented-number failure this repository refuses elsewhere.
- **Firing on every edit rather than on the claim.** Refuses the red step of
  red-green-refactor, and a guard that fires on the majority of turns gets
  switched off.

## Evidence

- `agents/evidence/analysis/why-the-suite-did-not-require-a-test-2026-09-11.md`
  — the full audit with citations for all four findings, including the measured
  zero-activation figure and the `_VERIFY_RE` that `eslint` satisfies.
- `src/scripts/hooks/turn_end_gate_hook.ts` — detector E, its three conditions,
  and the path heuristics with their false-positive direction argued.
- `tests/scripts/turn_end_gate_hook.test.ts` — 8 new cases. The first reproduces
  the reported failure; the second asserts that **detector C is silent on the
  identical input**, so the argument for adding E fails loudly if C ever starts
  covering it. Sensitivity proven by neutralising the test-path check: 1 red,
  restored 108 green.
- `agents/evidence/analysis/detector-e-measured-over-two-corpora-2026-09-11.md`
  — the fire rate over two corpora, the cumulative condition breakdown that
  makes E's silence readable, and the hand read of the single fire.
- `src/scripts/measure_turn_end_gate.ts`,
  `tests/scripts/measure_turn_end_gate.test.ts` — the instrument that produced
  it, scoring with the shipped detectors over the gate's own population.
- `src/skills/error-handling-patterns/SKILL.md`,
  `docs/contracts/design-artifact-verification.md` — the two prose fixes.
