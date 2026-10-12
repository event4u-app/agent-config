# Council reading — may a ceiling over the installed layer rest on a stored baseline?

<!-- evidence-type: analysis -->

Session 2026-10-12, `--prompt-mode pr`, two rounds. Configured members
`anthropic/claude-sonnet-4-5` and `openai/codex-default`.
**Quorum concluded at 1 of 2 seats present.** The anthropic seat answered; the
openai seat failed to exchange with `os_error: ENOBUFS` and contributed nothing.
Spend `$0.00` billed — both seats are on subscription transport. Question
artefact lives in the local, untracked council runtime and is reproduced in
substance below.

**Read this as a one-seat reading, because that is what it is.** It is not
provider-diverse, it is not a 2/2 convergence, and the degradation is recorded
here rather than left to be inferred from a quorum field. What makes it worth
committing is that its operative finding is structural and independently
checkable against the tree, not a matter of the seat's judgement.

## The question

Step 3.2 of `road-to-an-installed-layer-that-is-thinned` asks for a CI ceiling
over the installed Claude rule layer: *"The installed-layer report fails CI above
the measured thinned total plus 10 %, never above 75,000, and moves down only."*

Decision D6 of the same roadmap had parked it: the ceiling "stays a reported
finding, not a hard CI gate, until the real total is reachable", because a real
opt-in install reads **111,197 characters** — 48 % over the 75,000 the step
names — so a hard gate at that number would be red on `main` the day it merged,
over a corpus (16 kernel / path-only / trigger-less rules the thinning predicate
deliberately keeps full-bodied) that this roadmap excludes from its own scope.
D6's revisit condition had not fired.

Two questions were put, both answerable either way:

1. **Scope of the lock.** Does D6 bar a *shrink-only ratchet seeded at the
   measured total plus 10 %*, green on landing, with 75,000 recorded as the
   destination — or is that a different mechanism from the hard 75,000 gate D6
   tested? The seat was told explicitly that the agent proposing the ratchet was
   the same agent reading the lock as inapplicable, and asked to weigh that.
2. **Soundness.** If permitted, is a *stored* baseline sound, given that the
   stub body pointer is absolute and every figure therefore moves by 89
   characters per character of package-root prefix?

Both the in-repo precedent for the proposal (`preamble-payload-budget.json`, a
ratchet that fails on growth with its target recorded separately) and the
counter-precedent against it (`estate-count-budget.json`, a stored baseline
deleted because the number moved on nearly every merge) were given.

## The reading

**Q1 — the lock does not bar the proposal, narrowly.** D6 settles the mechanism
it tested. A ratchet seeded at the measurement is not the hard 75,000 gate, so
mechanism-match fails and D6 does not govern it. The seat added a finding the
question had not asked for: D6's wording admits a *narrow* reading (not that
gate) and a *broad* one (not any hard gate), and should be amended to say which.
It also pressed the independence point — a self-assessed permission to reopen
warrants a check — which is why this reading was obtained before anything was
built rather than after.

**Q2 — a stored baseline is UNSOUND, and the verdict is REQUEST_CHANGES.** The
measurement is environment-dependent by construction, so a ratchet over it
measures the runner as much as the corpus and locks at the shortest package-root
path any runner ever presents. The seat named `estate-count-budget.json` as the
in-repo instance of exactly this failure and recommended the form that replaced
it: **base-ref comparison** — measure both revisions in one fixed-length path,
require `head <= base`, store no number. It also named what a valid normaliser
would have to do if the stored form were kept: strip or substitute *every*
absolute-path occurrence, not merely count stubs, with test coverage over
differing root lengths, and a demonstration that the normalised figure really is
environment-independent.

## One finding in the reading is wrong, and the correction is recorded here

The seat read an **unexplained 4,139-character environment variance** out of the
evidence pages and made it the blocking item — "a stored baseline cannot ship
until this gap is explained".

That figure is not environment variance. 4,139 is the predicted effect of the
**stub-form change** (111,197 -> 107,058 package-owned, 97,496 -> 93,357
unconditional), recorded as such in
`agents/evidence/analysis/thinned-layer-composition-2026-10.md`. The environment
term is a different, separately documented number: **3,738 = 42 x 89**, the gap
between an ordinary checkout's reading and the opt-in reading at a differing
root length. The arithmetic reconciles; there is no unexplained residue.

**The correction does not rescue the proposal**, and saying so is the point of
recording it rather than quietly dropping the seat's number. The half that was
wrong is the magnitude. The half that decides is structural and was never in
doubt: 89 characters per character of prefix is a property of the absolute body
pointer, visible in the code, and it is sufficient on its own for every
conclusion in Q2.

## Adopted

Recorded as **D7** in `road-to-an-installed-layer-that-is-thinned`:

> A ceiling over the installed layer may not rest on a STORED baseline, in any
> shape, until the measurement is environment-independent. The acceptable forms
> are a normalised total (every absolute-path occurrence stripped or
> substituted, with tests over differing root lengths) or a base-ref comparison
> that stores nothing and requires `head <= base`.

D6 is amended in the same change to state the narrow reading explicitly, so that
a future proposal of a *different* mechanism is not refused by a sentence that
never meant to refuse it. Step 3.2 stays open, with its reason upgraded: it now
waits on the measurement rather than only on the corpus.

## What was not decided

- **Nothing about the default.** The flip is owner-reserved (D4/D5) and was not
  put to this session.
- **Nothing about the 75,000 or 65,000 targets.** D2 set them and they stand;
  Q2 is about how a ceiling may be *measured*, never about where it sits.
- **Whether the base-ref form is worth its cost.** It needs two real installs per
  CI run, and the session was not asked to price that against the alternative.
