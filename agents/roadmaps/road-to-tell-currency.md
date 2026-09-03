---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-declared-coverage-truth
    relation: disjoint
    note: "that roadmap's Phase 3 removes the Lucide default in iconography, which is one of the two tells this repository's own guidance actively produces; the other one is here"
estate_offset_exempt: "Adds one active roadmap against a floor of 1. It is not foldable into road-to-declared-coverage-truth: that roadmap fixes artefacts whose claims are false, while every entry here is a coverage gap in an artefact whose claims are true — and the parity gate makes catalog work a different change shape (catalog row, detector rule and status table land together or CI reds)."
---
# Road to tell currency

> **Source:** `agents/tmp.old/inbox-2026-09-c/set-5/` — an analysis of current
> AI-page tells against the anti-pattern catalog. Its wider architecture is not
> adopted; the coverage matrix is, after re-verification against
> `main@022c0d240`.

## Goal

The anti-pattern catalog detects the generation of AI page tells that is
current, not the one that was current when it was written. Today its coverage
is entirely static — colour, type, layout, copy — and a grep across
`docs/guidelines/design-antipatterns.md`, `src/scripts/design_slop_rules.ts` and
`src/skills/motion-choreographer/SKILL.md` for `scroll-reveal`, `spotlight`,
`cursor-follow`, `grain` and `noise` returns zero hits in all three. When this
is finished the interaction and texture layer is represented, two entries whose
described form has moved on are amended, and every change carries its
status-table row so the parity gate stays green.

## Phase 1 — Fixtures before entries

- [ ] **1.1 Commit a fixture corpus for the five uncovered tells and the two
      amended forms.** One positive fixture per tell and one negative per tell
      whose absence must not flag — a scroll-linked progress indicator is not a
      scroll reveal, a focus ring is not a hover fade. Fixtures land red for the
      new rules and green for the negatives.
      verify: the design-slop test run reports the new positive fixtures as
      unmatched and every negative as unmatched, before Phase 2 runs.

## Phase 2 — The interaction and texture layer

- [ ] **2.1 Add the scroll-reveal entry.** Every section fading and rising into
      view on scroll is the single most recognisable tell of the current
      generation, and `motion-choreographer` (206 lines) says nothing about
      scroll position. Write it as an M-entry with an override condition —
      a reveal that carries meaning (a stepped narrative, a long-form article's
      progress) is a decision; a reveal on every section is a default.
      verify: the entry exists with an override condition, and its status row
      is present.
- [ ] **2.2 Add the cursor-spotlight entry.** A radial highlight tracking the
      pointer over a dark hero. Same shape: entry, override condition, status.
      verify: as 2.1.
- [ ] **2.3 Add the hover-fade entry.** An interactive control that reduces its
      own opacity on hover, which reads as the element retreating from the
      pointer rather than responding to it. Note the collision with
      `icon-consistency` and the affordance floors — hover must remain
      *legible*, and a fade is the one hover treatment that reduces legibility.
      verify: as 2.1.
- [ ] **2.4 Add the grain-over-gradient entry.** Noise texture laid over a
      gradient as a "premium" default; the visual sibling of V6's diagonal
      stripes, which is why it belongs in Visual rather than Motion.
      verify: as 2.1.
- [ ] **2.5 Decide each new entry's detector status honestly.** Three of the
      four have a text-detectable signature — a scroll-reveal library or an
      `IntersectionObserver` paired with an opacity transition, a `mousemove`
      handler feeding a radial gradient, a hover opacity step below the
      affordance floor — and one, the grain overlay, may only be
      `judgment-only`. `candidate` is available but the table says it must
      resolve rather than persist, so it is used only with a named resolution
      step.
      verify: `./scripts-run src/scripts/lint_design_antipattern_parity` is
      green, and no new row carries `candidate` without a step that resolves it.

## Phase 3 — Two entries whose described form has moved

- [ ] **3.1 Widen V1 beyond the side stripe.** V1 names `border-left` /
      `border-right` above 1px. The current form is a fully coloured or gradient
      card border on all four sides; the entry as written does not reach it.
      Amend the pattern text and, if the rule is `backed`, the rule with it.
      verify: a fixture with a four-sided gradient border flags, and a 1px
      neutral border does not.
- [ ] **3.2 Widen T4 beyond the ALL-CAPS eyebrow.** T4 names an ALL-CAPS label
      above a section heading. The current form is a pill-shaped badge component
      sitting above the hero H1 — same function, different component, and the
      entry misses it.
      verify: a fixture with a pill badge above an `h1` flags; a badge used as
      a status chip inside a table row does not.

## Phase 4 — What the tree itself emits

- [ ] **4.1 Check the remaining own-estate tell after the icon default is
      removed.** `road-to-declared-coverage-truth` Phase 3 removes the Lucide
      default from `iconography`. Re-run the same question across the other apply
      skills — `react-shadcn-ui`, `tailwind-engineer`, `blade-ui`,
      `fe-design` — for any other set, font, or component this repository hands
      an agent as a default that the catalog then flags.
      verify: the sweep is recorded with per-skill findings, and each finding is
      either fixed or stated as intentional with a reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new detectors flag legitimate motion | implementation | A scroll-reveal rule that matches any `IntersectionObserver` will flag lazy-loading and scroll-progress code, and a detector that fires on everything is suppressed wholesale | 1.1 requires a negative fixture per tell, committed before the rule, and 2.5 permits `judgment-only` rather than forcing a rule that does not hold | Phase 1 — Fixtures before entries |
| 2 | The catalog grows faster than the judgment behind it | product | Four new entries in one change is a fifteen-percent growth of a curated list whose value is that every row is worth reading | Each entry carries an override condition in the same step that adds it, which is the bar an entry has to clear to exist at all | Phase 2 — The interaction and texture layer |
| 3 | Amending V1 and T4 silently changes existing verdicts | implementation | A widened pattern re-flags surfaces that were previously clean, and the change arrives as a review comment nobody asked for | 3.1 and 3.2 each name the negative case that must stay unflagged, so the widening is bounded by a fixture rather than by intent | Phase 3 — Two entries whose described form has moved |
| 4 | The tell set is dated the day it lands | product | This layer moves; a catalog updated once is a catalog that will be stale again, and the fix reads as a one-off | 4.1 turns the currency question into a repeatable sweep over the apply skills rather than a single edit | Phase 4 — What the tree itself emits |

## Acceptance Criteria

- [ ] AC-1 — The catalog carries an entry with an override condition for each of
      scroll-reveal, cursor-spotlight, hover-fade and grain-over-gradient, and
      each has exactly one status-table row.
- [ ] AC-2 — `lint_design_antipattern_parity` is green, and no row added by this
      roadmap carries `candidate` without a named step that resolves it.
- [ ] AC-3 — V1 flags a four-sided coloured or gradient card border and does not
      flag a 1px neutral border; T4 flags a pill badge above a hero heading and
      does not flag a status chip in a table row.
- [ ] AC-4 — The apply-skill sweep of 4.1 is recorded, and every default it
      finds is either removed or stated as intentional with a reason.
