---
complexity: bounded
status: later
parent_roadmap: road-to-tell-currency
review_by: 2026-12-03
estate_growth_exempt: "Adds one later/ roadmap because a [~] deferral has no other legal receiver: deferralProblems resolves carried-to only against agents/roadmaps/<slug>.md or agents/roadmaps/later/<slug>.md and fail-closes on a stubs/ path, and the receiver must additionally carry parent_roadmap: verified from both ends. This change archives road-to-tell-currency (active 4 to 3) and defers two of its steps on a 2/2 council verdict that neither can ship a truthful backed claim today; without a later/ receiver those two steps could be expressed only as [ ] on an archived roadmap, which the archival guard refuses, or as [-] cancelled, which is owner-reserved and would drop work the council explicitly parked. One later entry is the cost of not lying about two."
---

# Road to the interaction-layer detector promotions

> **Arrivals:** 3 (at least) — latest `inbox-2026-09-l` (2026-09-05); earlier: agents/roadmaps/archive/road-to-design-craft-antislop.md, agents/roadmaps/stubs/road-to-frontend-power-detector-promotions.md.

> **Parked, not abandoned.** Created 2026-09-03 when `road-to-tell-currency`
> closed. It receives two deferrals from that roadmap — the four new
> interaction/texture detectors, and the T4 widening — on an AI-council verdict
> of 2/2 convergence that neither can ship a truthful `backed` claim against
> today's scanner reach and today's clean corpus.
>
> **Resume when** the pre-registered clean corpus carries a legitimate
> near-miss for each of the four signals (step A1), which is the gate every
> other item here is measured against. A2 — the scanner-reach decision — can be
> taken independently and is the cheaper half.

## Why the parent could not close these

Three properties have to hold before a row reads `backed`, and the council's own
framing is that the parity gate conflates them:

1. **Catalog classification** — `backed` vs `judgment-only`.
2. **Scanner reach** — which extensions and engines can expose the signal.
3. **Evaluation validity** — whether the pre-registered clean corpus contains
   meaningful near-misses for the pattern.

Property 3 fails for all four new entries, and property 2 fails for two of them.
Measured 2026-09-03 against the corpus digest `90544389b05c1d0b` (32 clean
files):

| Signal the detector would need | Occurrences in the clean corpus |
|---|---|
| `IntersectionObserver` | 0 |
| `mousemove` | 0 |
| `radial-gradient` | 0 |
| `:hover { opacity }` | 0 (the only `opacity` uses sit inside a `@keyframes` block) |
| grain / noise over a gradient | 0 |

So an `M1 = 0` for any of these would be a **vacuous pass** — a statement about
the corpus, which is what the pre-registration says to read it as, not a
measurement of precision. The bench's own footer says the same thing in its own
words on every run.

And `lint_design_slop`'s engine map classifies no engine for plain `.ts` / `.js`
(`src/scripts/lint_design_slop.ts`, `enginesForExt`), which is exactly where a
scroll-reveal hook (`useReveal.ts`) and a cursor-spotlight `mousemove` handler
normally live. A `.jsx`/`.tsx`-only detector would be honest about nothing a
`.ts`-hook codebase does.

## The received work

### A — the four interaction and texture detectors

- [ ] **A1 Enrich the clean corpus with real near-misses, not just occurrences.**
      The distinction is the whole point: adding files that merely *contain*
      `IntersectionObserver` makes the bench non-vacuous while still not
      measuring precision. The near-misses have to be **legitimate** uses —
      an `IntersectionObserver` doing lazy-loading or scroll-progress, cursor
      tracking driving a functional canvas interaction, hover opacity on a
      genuinely disabled control, and grain used *without* the gradient
      composition V9 names.
      verify: the corpus digest changes, and for each of the four signals the
      corpus contains at least one legitimate use that a naive detector would
      flag.
- [ ] **A2 Decide the scanner-reach question, and record it either way.** Widen
      `enginesForExt` to `.ts` / `.js`, or scope the interaction rules to
      colocated-markup extensions and say so in the § Detector status note.
      Widening re-opens the M1 epoch for **all 25 existing rules** against a
      larger surface, and the pre-registered ceiling is `M1 = 0` per rule — one
      new false positive on any existing rule demotes it. That cost is the
      decision, not a footnote to it.
      verify: the decision is recorded with its measurement; if the answer is
      widen, every one of the 25 existing rules carries a fresh M1 number.
- [ ] **A3 Promote at most one row per epoch.** M6, M7, M8 and V9, each on its
      own epoch with its own M1 number, each carrying a `provenance/borrows.jsonl`
      row or an explicit own-analysis label. A batch promotion has no per-rule
      number and cannot satisfy any of the verifies above — the constraint is
      the sibling stub `road-to-frontend-power-detector-promotions.md`'s
      promotion gate 1, and the council declined to exempt newly authored rules
      from it on the ground that new rules are where independent evidence is
      most useful.
      verify: § Detector status shows each promotion with its epoch, and
      `lint_design_antipattern_parity` is green after each.

### B — the T4 widening

- [ ] **B1 Show that dependency-free adjacency can carry the position claim.**
      T4's current form is ALL-CAPS-and-ratio: it counts `text-transform:
      uppercase` and `uppercase` classes against a `sections / 3` cap and
      requires `sections >= 3`, so a single sentence-case pill badge above a
      hero `h1` is structurally out of its reach. The defect is **positional**
      — a badge immediately preceding an `h1` — and the shape is not the defect:
      V4's own override declares the pill legitimate on single-line tags and
      chips, and V4's rule excludes exactly that radius band. So a shape-scoped
      T4 would contradict a sibling entry's override, and a position-scoped T4
      needs a text-adjacency heuristic in a rules file that is deliberately
      dependency-free with no cascade and no DOM, and which carries a standing
      precedent of refusing to infer layout.
      verify: a fixture with a pill badge above an `h1` flags and a status chip
      inside a table row does not, with the adjacency heuristic's failure mode
      stated rather than assumed.
- [ ] **B2 Keep T4's prose and its `backed` status in step.** T4 is `backed`
      today, so widening its prose without widening its rule makes the parity
      gate green while the claim goes false — which is the exact defect class
      that gate exists to catch. Prose and rule move together or neither moves.
      verify: `lint_design_antipattern_parity` is green and T4's pattern text
      describes only what its rule reaches.

## Resume condition

A1 is the gate for everything else: until the clean corpus can discriminate,
no `M1` number from it licenses a promotion, and A3 and B1 are unmeasurable by
construction. A2 can be decided independently and is the cheaper half.

## What this stub does NOT cover

The four catalog entries themselves — M6, M7, M8, V9 — **already shipped** as
`judgment-only` rows with override conditions, and the interaction guidance
already shipped in `fe-design`'s § Motion. Nothing here is blocked on them, and
this stub must not re-author them. V1's widening also shipped, with its rule and
its fixtures, because the clean corpus *does* carry the discriminating negative
for it — three four-sided `1px` borders that must stay clean — which is the one
property the four deferred entries lack.
