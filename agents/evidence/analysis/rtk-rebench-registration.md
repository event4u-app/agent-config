<!-- evidence-type: analysis -->

# Registration — the widened rtk re-bench

**Written 2026-08-23, before any run.** Step 3.1 of `road-to-terminal-token-economy`.
The ordering is the whole point of the phase: *"A benchmark whose success bar is written
after the numbers arrive is not a benchmark."*

## What the existing figure rests on, and why widening is the task

`src/skills/rtk-output-filtering/SKILL.md:32-38` carries **33 % overall, 0–57 % per
command**, from a **single spot-measurement on 2026-07-28: one repo, one macOS machine, an
8-command corpus**. The label is already honest where it is written. The defect is the
narrowness, and step 3.1 says so explicitly: *"Explicitly widen past the existing shape."*

## Corpus — widened on all three axes the current figure is narrow on

| axis | current figure | registered design |
|---|---|---|
| repositories | 1 | **≥ 3** — this repo, one Laravel/PHP target, one Node/TS target |
| machines | 1 (macOS) | **≥ 2** — one macOS, one Linux (a CI runner counts) |
| commands | 8 | **≥ 20**, composition fixed below |

**Command composition, fixed here so it cannot be chosen to flatter the result.** The
existing figure's own breakdown is the reason this matters: verbose commands save ~55 %,
already-compact output passes through at ~0 %, so the overall percentage is a function of
the mix. The registered mix is:

- **8 verbose** (`git status`, `git log`, `ls -la`, and five more of that shape),
- **6 already-compact** (`git log --oneline`, `--stat`, and four more),
- **6 mixed/unknown**, chosen before any run and not revised after.

A corpus reweighted toward verbose commands would raise the headline without measuring
anything new, which is the failure this composition exists to prevent.

## Metric

**Output tokens of the wrapped invocation as a fraction of the unwrapped invocation**, per
command, on identical inputs — then reported two ways, both mandatory:

1. **per-command distribution** (min / median / max), which is what a reader can act on;
2. **overall corpus percentage**, which is only meaningful next to the composition above and
   is reported *with* it or not at all.

## The bars — both directions, fixed before the run

| bar | value | consequence |
|---|---|---|
| **success** | median per-command saving **≥ 30 %** across ≥ 3 repos and ≥ 2 machines | the figure is widened and the skill's headline is replaced with it |
| **kill** | median per-command saving **≤ 10 %** | the lever is closed honestly: the skill records the null and the wrapper's value claim is withdrawn |
| **inconclusive** | median in (10 %, 30 %) | reported as inconclusive, **not rounded toward either**, and the corpus's own variance is reported alongside |

30 % is chosen as *"the existing 33 % survives widening"* rather than as a target pulled
from nothing — if the number holds up across three repos and two machines, the claim was
sound and narrow rather than wrong. 10 % is the point below which the wrapper's ~10 ms
startup and the advisory's cognitive cost are not obviously repaid.

## What the run measures, and what it does not

It measures the **existing warn-only wrapper**, which is the mechanism Phase 2 chose
(`rtk-wrapper-mechanism-decision.md`) — so the subject is settled and a re-bench is
measuring the thing that actually ships.

It does **not** measure whether the agent *acts on* the warn. That is compliance, not
compression, and it is the acknowledged limit of the chosen mechanism: the saving is
realised only when the nudge is taken. A 55 % compression on a command nobody re-runs
wrapped saves nothing, and no number in this registration speaks to that.

## Publication contract

Either outcome ships, per step 3.2: a result at or near zero is publishable and closes the
lever honestly, and a result that misses the bar closes it the same way. Step 3.3 replaces
the skill's headline with whatever this produces plus its scope; step 3.4 states the
relationship between the upstream 60–90 % range and this tree's own figure rather than
leaving a reader to pick the flattering one.

## What this registration does NOT authorise

Running it. The bars above are frozen so they cannot move to meet a result. Whether the run
happens is `b-ab-session-spend`, and its recorded deferral rested on Phase 2 being
unsettled — a condition that no longer holds as of this change.
