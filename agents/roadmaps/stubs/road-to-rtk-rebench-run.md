---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: the widened rtk re-bench

> **Stub — not active work.** Carries steps **3.2, 3.3 and 3.4** out of
> `road-to-terminal-token-economy`, which closed on 2026-08-23 with Phases 1 and 2
> shipped. The three steps were `[~]` there; this file is where they wait, so the
> Iron-Law-3 closure gate resolves against a destination rather than a promise.

## What waits here

- **3.2** Run the registered re-bench and publish the number, whatever it is. A result
  at or near zero is publishable and closes the lever honestly; a result that misses
  the pre-registered bar closes it the same way.
- **3.3** Replace the skill's headline figure with whatever 3.2 measured, plus its
  scope, keeping the honest-scoping style the current text already has.
- **3.4** State the relationship between the upstream 60–90 % range and this tree's own
  figure, rather than leaving a reader to pick the flattering one.

## The design is frozen, so this is a run and not a decision

`agents/evidence/analysis/rtk-rebench-registration.md`, written 2026-08-23 before any
run: **≥ 3 repositories · ≥ 2 machines · ≥ 20 commands** with the composition fixed in
advance (8 verbose, 6 already-compact, 6 mixed), because the existing figure's own
breakdown shows the headline is a function of the mix — verbose commands save ~55 %,
already-compact output passes through at ~0 %, so a corpus reweighted toward verbose
would raise the number without measuring anything.

Bars, both directions: **success** at median per-command saving ≥ 30 % · **kill** at
≤ 10 % · **inconclusive** in between, reported as such and not rounded toward either.

## Why it is deferred — and the reason CHANGED, which is the point

**Originally (2026-08-23, first council pass):** ordering. Phase 2 had not chosen the
wrapper mechanism, so benchmarking it would measure the wrong subject. Spend was
pre-authorized even then; both seats held that *"pre-authorized budget is permission
without reason"* and does not refute a methodological objection.

**Phase 2 then chose** — the existing warn-only nudge — so that objection is
**discharged**. `decision-revisit-gate` requires a lock whose condition has changed to
be surfaced rather than silently complied with, and it was: AI council 2026-08-23, 2/2
convergent, re-evaluated the deferral and found it standing on a **new** condition.

**Now:** the registration's own **≥ 2-machine** requirement. One machine is reachable.
A one-machine re-bench would reproduce exactly the narrowness the widening exists to
fix — it would replace a dated single-machine figure with a fresh single-machine
figure and call it progress.

Amending the registration down to one machine was considered and refused: it lowers a
bar written before any number was seen, which is the one thing a pre-registration
exists to prevent.

## Promotion criterion

**A second machine is reachable** — a CI runner counts, and the registration names it
as acceptable. At that point the design executes as written.

## What is true in the meantime, stated so nobody has to infer it

The shipped figure — **33 % overall, 0–57 % per command** — remains a single
spot-measurement from 2026-07-28: one repo, one macOS machine, eight commands. The
skill carries that label at the number itself, and the label now names the ≥ 2-machine
condition rather than the discharged ordering one.

And the limit the chosen mechanism carries either way: this measures **compression**,
never **compliance**. A 55 % saving on a command nobody re-runs wrapped saves nothing,
and no bar in the registration speaks to whether the agent acts on the warn.
