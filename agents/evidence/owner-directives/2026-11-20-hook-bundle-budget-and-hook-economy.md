<!-- evidence-type: analysis -->

# Owner directive — 2026-11-20: the hook-bundle budget, and the hook system around it

Recorded from one owner session and the inbox round `inbox-2026-11-hb` it
pointed at. The owner's words are quoted in the original German, each followed
by a translation; the decisions are the owner's, the wording around them is the
recorder's.

## The words

Session turn 1 (asked of the agent):

> `was ist das Hook-Bundle-Budget und wofür ist es da? klingt für mich nach weiteren bullshit gerade, weil es uns bei anderen dingen (in einer parallelen session) blockiert` <!-- md-language-check: ignore -->
> (*What is the hook-bundle budget and what is it for? Sounds like more nonsense to me right now, because it is blocking us on other things in a parallel session.*)

The agent answered with three options and recommended option 1: keep one
overall ceiling with generous headroom (about +20 %), drop the per-chunk
ceilings, `shrink_only` and the ratification requirement, keep the
one-YAML-parser check.

Session turn 2 (the instruction that started this run):

> `gehe mit dem wissen und deiner analyse in die roadmap planung. arbeite dabei in einem workingtress. Danach /roadmap:process-full und erstell am ende einen pr den du in main merged` <!-- md-language-check: ignore -->
> (*Take that knowledge and your analysis into roadmap planning. Work in a worktree. Then /roadmap:process-full, and at the end open a PR that you merge into main.*)

From the round's transcript (owner turns, same day):

> `Brauchen wir das? Schützt es wirklich? Gerade behindert es uns in einer Session und bei neuen Hooks.` <!-- md-language-check: ignore -->
> (*Do we need it? Does it really protect? Right now it is hindering us in a session and on new hooks.*)

> `können wir nicht das ganze Hook-System überarbeiten und verbesern?` <!-- md-language-check: ignore -->
> (*Can't we rework and improve the whole hook system?*)

## What this directs

- **D1 — the byte ceiling stops being a ratchet.** One overall ceiling with
  real headroom; `shrink_only`, the `raise_log` obligation and the per-chunk and
  chunk-group ceilings end; the parser check stays and is generalised.
- **D2 — the budget file leaves the ratification watched set** once it holds
  only the backstop and the package allowlist. The agent's option 1 named this
  explicitly and the owner's turn 2 adopted the analysis. The ratification gate
  itself is edited to do so, which carries its own record as the gate requires.
- **D3 — the hook system as a whole is in scope**, not only the budget. What
  can be closed in one run is executed now; what needs an owner decision, a
  live host observation or elapsed time is planned in `later/` and `stubs/`,
  never dropped.

## What it does not direct

It does not lower a fail-closed guard, does not reverse the council decision
against a resident dispatcher (`hook-latency-budget.json`), and does not change
which concerns are on by default.
