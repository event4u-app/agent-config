<!-- evidence-type: analysis -->

# Detector E, measured — one fire in 335 turns, and it is the reported failure

ADR-277 shipped detector E with its false-positive rate **unmeasured** and said so in
§ Honest limits. This closes that limit as far as an instrument can: the fire rate is
measured over two real transcript corpora, and the single fire was read by hand.

Command, re-runnable:

```
./scripts-run src/scripts/measure_turn_end_gate --store <transcript dir> --limit 30 [--show-fires]
```

## The numbers

| | maintainer corpus (this package) | consumer corpus (a Laravel API) |
|---|---|---|
| sessions · turns | 30 · 102 | 25 · 233 |
| turns that edited any file | 34 | 40 |
| 1. edited production source | 16 | 24 |
| 2. …and touched no test file | 7 | 9 |
| 3. …and claimed done (**E fires**) | **0** | **1** |
| detector C fired on those | — | **0** |

Combined: **1 fire in 335 turns (0.3 %)**, over 74 turns that edited something at all.

Detector C, for comparison on the same population: 13 turns (12.7 %) and 8 turns (3.4 %).
So E is roughly an order of magnitude quieter than the gate's existing edit-shaped
detector, which is what a three-condition conjunction should look like.

## The one fire is a true positive, and it is the reported feature

Read by hand at the pointer `--show-fires` prints. The turn edited **28 production PHP
files** — a recurrence model, a recurrence generator, a working-day calendar service,
request validation — touched **no test file at all**, and opened its reply with:

> *"Fertig. E9 ist umgesetzt und belegt."*

*Belegt* — "evidenced". A completion claim carrying an explicit evidence claim, over
twenty-eight untested production files. The module is the ToDo recurrence feature whose
breakage the maintainer reported on 2026-09-11 and which
`why-the-suite-did-not-require-a-test-2026-09-11.md` was written to explain.

So the detector's single fire over 335 turns is the exact turn the audit was about. That
is the strongest form of the argument available short of a labelled corpus: E was
designed from a described failure and then found that failure, unprompted, in a
transcript it was not tuned on.

## What this does and does not establish

**Established.** An upper bound on the false-positive rate: at most 1 in 335 turns, and
a hand read of that one says it was right — so the measured false-positive count is
**0**. E's noise cost is not a design argument any more.

**Established.** ADR-277's claim that detector C does not already cover E. C was
**silent on the one turn E fired on**, over a real transcript rather than over the unit
test that asserted it. The record's "two different questions deserve two detectors"
survives contact with a corpus.

**NOT established: recall.** One fire is not a rate of catching the failure class, and
nothing here scores the turns E stayed silent on. The cumulative breakdown is what makes
the silence readable rather than mysterious: of 40 turns that edited production source
across both corpora, 16 touched no test, and 15 of those 16 did not claim done. E is
silent there **by design** — that is the red step of red-green-refactor, and refusing it
is the failure mode the third condition exists to avoid.

**NOT established: that the rate generalises.** Both corpora are one maintainer's. A
team that claims done more often, or writes tests less often, would see a higher rate in
either direction, and nothing here predicts which.

**Detector D is unmeasurable this way**, stated rather than quietly skipped: it reads
`ci_last` from per-session runtime state that no transcript carries, so a
transcript-derived D figure would measure an absent file.

## Instrument notes

`measure_turn_end_gate` now rebuilds the turn's `ToolCall[]` with the gate's **own**
extractor (`extractToolCalls`, exported for this), applies the same two rules
`readTranscriptTail` applies — reset at every genuine user prompt, skip sidechain
entries — and scores with the shipped `detectUnverifiedEdit` / `detectUntestedChange`.
Population parity is the whole point; a second extractor would have measured itself.

One defect was caught by the hand read and fixed: the fire pointer first carried the
**corpus-wide** running turn total under a per-session label, which sent a reader to turn
17 of a session whose fire was on turn 6. A pointer that resolves to the wrong turn is
worse than no pointer, because it reads as a verified location.
`tests/scripts/measure_turn_end_gate.test.ts` pins the per-session ordinal, and the
turn-reset case was sensitivity-proven by neutralising the reset: 1 red, restored 8 green.
