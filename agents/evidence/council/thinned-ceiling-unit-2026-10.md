<!-- evidence-type: analysis -->

# Which unit is the thinned layer's "hard 75,000" read in?

> Council record for `road-to-a-thinned-layer-measured-in-one-unit` step 4.1.
> Run 2026-10-06 on branch `drain/thinned-layer-one-unit-20261006`.
> Members present 2/2: `anthropic/claude-sonnet-4-5`, `openai/codex-default`.
> Two rounds, blind chairman. Both seats on subscription transport; billed
> $0.00. Named beside the sums of step 3.2 in
> `agents/evidence/analysis/thinned-layer-composition-2026-10.md`.

## verdict: unresolved-as-asked — the record says one thing and the instrument counts another, and nothing reconciled them

Not an evasion and not a split. **Both seats independently reached the same
conclusion**: the question cannot be answered from the measurements alone,
because it is a question about what the ceiling was protecting, and that is
recoverable from the record rather than derivable from the layer.

- `openai/codex-default`: "The correct historical unit remains unresolved
  because neither the ceiling's rationale nor the old report's counting
  semantics is supplied." Its highest-leverage action was to **inspect the
  old installed-layer report and its tests**, calling that "the most direct
  evidence of what 75,000 actually meant".
- `anthropic/claude-sonnet-4-5`: "the unit question is actually two questions
  — what did the original ceiling protect (historical), and what should it
  protect going forward (design)." Its reading of historical intent was
  "likely unconditional, based on *stands under*, but verify".

## The evidence the council asked for, fetched after the run

Both actions it named are cheap and were carried out. Both resolve, and they
resolve in **opposite directions**, which is the finding.

### 1. The record that set the figure says "standing"

`agents/evidence/council/inbox-2026-10-c-standing-form.md`, the Adopted table,
row 3 — Ceilings:

> "Contract target 1,200, hard 2,000 (reviewed, expiring exception above it);
> **standing** target ~65,000, hard 75,000 with ≥10 % headroom; a separate
> warning on the combined package-plus-user total."

The word is *standing*, which is the unconditional population and not the
whole layer. The same row already distinguishes a second bound for a second
population — "a separate warning on the combined package-plus-user total" — so
the council that set the figure was already thinking in terms of one ceiling
per population rather than one number for everything.

### 2. The instrument AC-1 names counted everything

AC-1 of the extended roadmap reads "under 75,000 package-owned characters,
**read by the installed-layer report**". At `origin/main` before step 1.1 of
this roadmap, that report computed:

```
chars:         readings.reduce((n, r) => n + r.chars, 0)
unconditional: readings.filter((r) => r.unconditional).length
```

`chars` summed **every** `.md` in the directory, path-scoped files included.
`unconditional` was a FILE COUNT, not characters — so the report could not
produce an unconditional character figure at all until step 1.1 added one.

The single number AC-1 binds itself to therefore counted **all** characters,
and it could not have counted anything else.

## What that makes the answer

**The record and the instrument disagree, and the disagreement was never
visible** because the instrument only ever printed one number and the record's
word for it was never tested against that number.

- Read from the **record**: the ceiling is on standing — unconditional —
  characters.
- Read from the **instrument AC-1 names**: it is on all characters.

Neither reading is a misreading. The criterion was phrased against a report
that could not express the distinction its own governing record had already
made.

## What both seats converged on for the way forward

Two bounds, not one — reached independently and agreed in the second round:

- `anthropic`: "unconditional **plus** a separate conditional bound".
- `openai`: records it as F5, a dual-budget model, and marks it
  **speculative-as-policy** — correctly, since a bound nobody has derived is a
  number nobody can defend. It asks for the bound to be derived from the
  protected resource and representative workloads rather than asserted.

`anthropic` proposed ~20,000 for the conditional population, and both seats
then rejected that figure as arbitrary — `openai` for having "no workload
distribution, context-window target, matched-path frequency, or acceptable
worst-case load" behind it, `anthropic` conceding the same of its own number in
round two. **No conditional bound is proposed here**, and that is the council's
position rather than an omission.

## What this record does NOT do

- **It does not choose a unit.** Choosing would mean deciding which of the two
  findings above governs, and that is a decision about a recorded council
  figure, not a reading of it.
- **It does not propose a conditional bound.** Both seats rejected the one
  number that was offered.
- **It does not change AC-1, its blocker, or any decision** of the extended
  roadmap.

## What it changed in the analysis page

The council read the measurement memo adversarially and found two defects in
it. Both are real and both are now fixed:

1. **The reachability sums omitted the largest row they claimed to include.**
   The prose said "every move above taken" while the arithmetic subtracted
   only the law moves, leaving out the 12,371-character pointer prefix.
   `openai`: "materially false or, at best, undefined." The page now states
   its inclusion set explicitly and carries a third sum with the pointer in —
   which changes the conclusion: under a bare 75,000 on the unconditional
   reading the ceiling IS reachable with every row taken, and under the
   headroom-adjusted 68,181 it is not at any realistic package-root prefix.
   (That last clause first read "not, on any reading" — the same absolute the
   page itself then had to retract, because Sum 3's ceiling column dips 567
   characters under 68,181. Corrected here on 2026-10-06 after a second review
   round found it surviving in this record; the analysis page's § The corrected
   conclusion carries the full statement.)
2. **A three-row table followed by "both readings are over 75,000"** — the
   path-scoped row is a population, not a candidate ceiling. Reworded.

The first of those is the reason this round was worth running even though its
verdict on the asked question is "unresolved": it caught a claim this page
would otherwise have shipped, in the direction of overstating how far from the
ceiling the package is.

## Honest limits of this record

- The pre-run probe reported `openai` unavailable and the run proceeded as
  degraded on that basis; **both seats answered**, and the post-run quorum line
  records 2/2 present. The verdict is provider-diverse. A reader checking the
  run log will see the degraded pre-run line and should read the post-run one.
- `prompt-mode: analysis`, two rounds, blind chairman. The question put to the
  council is reproduced in full in the run artefact under
  `agents/runtime/council/responses/`, which is gitignored and pruned — the
  question's substance is reproduced in this record's own body above rather
  than cited by path.
- The two findings in "the evidence the council asked for" were fetched by the
  agent AFTER the run, not by the council. They are checkable from the tree at
  the commits named and are not council output.
