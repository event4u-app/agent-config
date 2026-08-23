<!-- evidence-type: analysis -->

# Pre-registration — does an override change what the agent does?

**Written 2026-08-23, before any session runs, and before any budget conversation.**
Steps 2.1 and 2.2 of `road-to-override-efficacy-proof`.

The ordering is the point twice over. A pre-registration written after the first numbers
is a results section; one written after a budget is approved is a pre-registration written
after someone has an expectation. `b-paired-session-spend` deliberately does **not** gate
2.1 or 2.2 for that reason, and both were written while the run itself stands deferred.

## The question

> With the override present, does the agent's completion message on a UI-affecting change
> name the four things the override demands — and with the override absent, everything else
> byte-identical, does it not?

## The observable — textual, not a judgement call

`agents/overrides/rules/verify-before-complete.md:57` opens *"The completion message must
name:"* and enumerates the mode tested, the URL fetched, the screens walked and the text
assertions that passed. That is a **string-level** observable in the transcript.

This is why this override is the right subject and a different one would not be: the
obligation is checkable by reading the reply, so the arms can be scored without anyone
judging whether the agent "took it seriously".

**Scoring:** a pair is a HIT when the override-present arm names all four and the
override-absent arm names fewer than four. A pair where both arms name all four is a MISS
and counts against the lift — the agent may already do this without being told, and that
possibility is exactly what the absent arm exists to detect.

## Arms

Two arms, **byte-identical except for the presence of `agents/overrides/rules/`**: same
task text, same host, same model, same session shape, same repository state. The override
file is the only difference.

## Pair count and the pass bar — fixed here

| | |
|---|---|
| **pairs** | **20** |
| **pass bar** | ≥ 14 of 20 pairs are HITs (70 %) |
| **honest-null bar** | ≤ 12 of 20 (60 %) — no measurable difference |
| **ambiguous** | 13 of 20 — report as inconclusive, do not round toward either |

20 is chosen for what it can and cannot support, and the limit is stated rather than
implied: at n=20 a 70 % observed rate has a wide interval, so the bar is a **screening**
threshold and the outcome is reported as such. It is not a claim about effect size.

## The population limit, stated before the run rather than after it

**This measurement is n=1 in overrides, whatever the pair count.** There is exactly one
real override in the tree, so 20 pairs measure *that file* twenty times. A `PASS` would say
"this override was honoured", never "overrides work"; a null would say "this override
changed nothing measurable", never "overrides do nothing".

Recorded here because it is the whole reason the run is deferred (`b-paired-session-spend`,
option (b), AI council 2026-08-23 2/2): **spend was pre-authorized and the deferral still
held**, because pre-authorized budget is permission without a reason and does not answer a
population-validity objection. The spend is better placed once a second override exists to
widen the population.

## Publication contract — either outcome ships

Per step 2.4, the result lands in `docs/benchmark.md` under one of the existing honesty
labels. `grep -c 'HONEST' docs/benchmark.md` = **9** at this commit — the honest-null
outcome has a shipped precedent and needs no new argument when it happens.

Per step 2.5, a null is not published as a neutral fact. The consequence is written in the
same commit: the override layer costs prose in `override-system.md`, a lint, a registry and
a contract, and a null means that surface bought no observed behaviour change — a live input
to whether the layer is worth its cost.

## What this pre-registration does NOT authorise

Running it. The bar above is frozen so it cannot move to meet a result; it is not a budget
approval, and steps 2.3–2.5 stand deferred with their reasoning recorded at 2.5.
