<!-- evidence-type: analysis -->

# Gate-class sweep — how much of the blocker estate is a couriered command?

Produced by `road-to-gate-autonomy` step 1.2. Measured against `origin/main`
@ `86cdbf652`, 2026-08-17.

## 1. Pre-registration — written before a single blocker was classified

`road-to-gate-autonomy` § 0 asserts that the estate's blockers "are not
decisions. They are commands and agent runs waiting for a human to type them."
Step 1.2 exists to falsify that, and its risk register (item 6) names the
failure mode directly: *a sweep that sets its own expectation after looking at
the blockers proves nothing about the premise it claims to test.*

So the bar is fixed here, before the classification table below exists:

> **Pre-registered expectation: at least 40 % of open blockers classify as
> class 0 or class 1** — deterministic-and-free, or billable-but-reversible.
> Both are gates whose human ingredient is a keystroke or a spend consent, not
> a judgement.

**Falsification consequence, also pre-registered.** Below 40 %, the
"gates are mostly couriered commands" framing is published as weaker than it
felt, Phase 2 ships as a thin convenience over the class-0 path only, and the
drawdown campaign leans on the consolidated decision sheet instead. This is
the roadmap's own honest-null clause; it is restated here so the outcome
cannot be renegotiated after the numbers land.

**Disclosure, because it bears on how much the pre-registration is worth.**
The author had prior partial exposure to this estate: selecting this roadmap
required a feasibility screen that read blocker text across ten candidate
roadmaps, roughly a quarter of the population classified below. The 40 % bar
is therefore *not* blind. It is stated in advance and against a named
consequence, which is the part that can be checked; calling it blind would be
the forgery this section exists to prevent.

**Why 40 % and not a rounder number.** "A substantial share" has to become a
number to be falsifiable at all, and the number has to be one the premise
would actually fail. The roadmap's own three worked examples (§ 0) are one
class-1, one class-2 and one class-0 — a third each. A bar at 33 % would be
met by the examples alone and would test nothing; a bar at 50 % would demand
the estate be *majority* couriered, which the roadmap never claims. 40 % sits
above the illustrative third and below the majority claim.

## 2. Population

Every **open** blocker in `agents/roadmaps/*.md`, as enumerated by
`agent-config gates --json --all`. Resolved entries are history and are out of
scope; `later/`, `archive/` and `skipped/` are not active estate.

## 3. Classification table

<!-- filled by step 1.2; the pre-registration above predates it -->

## 4. Result

<!-- filled by step 1.2 -->
