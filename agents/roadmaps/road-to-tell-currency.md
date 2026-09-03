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
`src/skills/fe-design/references/design-patterns.md` for `scroll-reveal`,
`spotlight`, `cursor-follow`, `grain` and `noise` returns zero hits in all
three. (The third path is CORRECTED: this roadmap was written against
`src/skills/motion-choreographer/SKILL.md`, which is a text-to-video prompt
builder — `packs: [ai-video]` — and is silent on scroll position because scroll
position is not in its domain. The UI-motion authority is `fe-design`'s
§ Motion, which `design-review` names as the timing source of truth, and the
catalog's own See-also pointed at the wrong one.) When this
is finished the interaction and texture layer is represented, two entries whose
described form has moved on are amended, and every change carries its
status-table row so the parity gate stays green.

## Phase 1 — Fixtures before entries

- [~] **1.1 Commit a fixture corpus for the five uncovered tells and the two
      amended forms.** One positive fixture per tell and one negative per tell
      whose absence must not flag — a scroll-linked progress indicator is not a
      scroll reveal, a focus ring is not a hover fade. Fixtures land red for the
      new rules and green for the negatives.
      verify: the design-slop test run reports the new positive fixtures as
      unmatched and every negative as unmatched, before Phase 2 runs.
      <!-- deferred-resolution: carried-to=road-to-tell-detector-promotions -->
      **Deferred, and the step is unexecutable as written.** The fixture map in
      `src/scripts/design_slop_rules.test.ts` is guarded in BOTH directions — a
      rule without a fixture fails `missing fixture for <id>` and a fixture
      without a rule fails `orphan fixture <id>` — so a fixture cannot land in a
      commit before its rule. The verify text also inverts the suite's
      semantics: it asks the run to report the new positives as *unmatched*,
      while the suite asserts a positive MUST fire. Council 2/2: fixture and
      rule land atomically, and since no detector lands in this roadmap (2.5),
      Phase 1 has no work here. The fixture obligation travels with the rules to
      the receiver, where step A3 lands each one with its own fixture pair.
      V1's amended fixture pair DID land in this roadmap, atomically with its
      rule, under 3.1.

## Phase 2 — The interaction and texture layer

- [x] **2.1 Add the scroll-reveal entry.** Every section fading and rising into
      view on scroll is the single most recognisable tell of the current
      generation, and the UI-motion authority — `fe-design`'s § Motion, not
      `motion-choreographer`, which is a text-to-video prompt builder — said
      nothing about scroll position. Write it as an M-entry with an override
      condition —
      a reveal that carries meaning (a stepped narrative, a long-form article's
      progress) is a decision; a reveal on every section is a default.
      verify: the entry exists with an override condition, and its status row
      is present.
      Landed as **M6**, `judgment-only`. The guidance half landed in
      `src/skills/fe-design/references/design-patterns.md` § Motion step 4
      (council Fork 2, 2/2), and the catalog's stale See-also pointer to
      `motion-choreographer` was corrected in the same edit.
- [x] **2.2 Add the cursor-spotlight entry.** A radial highlight tracking the
      pointer over a dark hero. Same shape: entry, override condition, status.
      verify: as 2.1. Landed as **M7**, `judgment-only`.
- [x] **2.3 Add the hover-fade entry.** An interactive control that reduces its
      own opacity on hover, which reads as the element retreating from the
      pointer rather than responding to it. Note the collision with the
      interaction-state contract — hover must remain *legible*, and a fade is
      the one hover treatment that reduces legibility.
      verify: as 2.1. Landed as **M8**, `judgment-only`.
      **Both collision targets named in the original step do not exist.**
      `src/rules/icon-consistency.md` contains no `hover` and no `opacity`; its
      subject is mixed icon sets. And a tree-wide grep for "affordance floor"
      returns zero hits — no artefact by that name exists. The real collision
      surface is `src/skills/design-review/SKILL.md` § Six interaction states,
      whose hover row already says pointer feedback must not be the *only*
      affordance and whose disabled row names a contrast dip a user cannot read
      as a WCAG 1.4.1 failure. M8 and the `fe-design` § Motion step 5 both cite
      it.
- [x] **2.4 Add the grain-over-gradient entry.** Noise texture laid over a
      gradient as a "premium" default; the visual sibling of V6's diagonal
      stripes, which is why it belongs in Visual rather than Motion.
      verify: as 2.1. Landed as **V9** — V8 was already taken by the
      Consistency-Locks table, so V9 is the next free Visual id.
- [x] **2.5 Decide each new entry's detector status honestly.** Three of the
      four have a text-detectable signature — a scroll-reveal library or an
      `IntersectionObserver` paired with an opacity transition, a `mousemove`
      handler feeding a radial gradient, a hover opacity step below the
      affordance floor — and one, the grain overlay, may only be
      `judgment-only`. `candidate` is available but the table says it must
      resolve rather than persist, so it is used only with a named resolution
      step.
      verify: `./scripts-run src/scripts/lint_design_antipattern_parity` is
      green, and no new row carries `candidate` without a step that resolves it.
      **Decided: all four `judgment-only`, and the reason is stronger than the
      step anticipated.** The step expected three of the four to be
      text-detectable. Two independent measurements say otherwise, and the
      status notes carry both. (1) `lint_design_slop`'s `enginesForExt`
      classifies NO engine for plain `.ts` / `.js`, which is where a
      scroll-reveal hook and a `mousemove` spotlight handler normally live —
      so a detector for M6 or M7 would reach nothing in an ordinary codebase.
      (2) The pre-registered clean corpus (digest `90544389b05c1d0b`, 32 files)
      contains zero `IntersectionObserver`, zero `mousemove`, zero
      `radial-gradient` and zero `:hover { opacity }` — its only `opacity`
      occurrences sit inside a `@keyframes` block. An `M1 = 0` against it would
      be a **vacuous pass**, which is what the pre-registration itself says to
      read it as, not measured precision. Council 2/2 on Forks 3 and 4:
      judgment-only now, one-rule-one-epoch promotion later, no exemption for
      newly authored rules. No row carries `candidate`.
      Parity: `50 entries classified, 25 detector-backed`, green.

## Phase 3 — Two entries whose described form has moved

- [x] **3.1 Widen V1 beyond the side stripe.** V1 names `border-left` /
      `border-right` above 1px. The current form is a fully coloured or gradient
      card border on all four sides; the entry as written does not reach it.
      Amend the pattern text and, if the rule is `backed`, the rule with it.
      verify: a fixture with a four-sided gradient border flags, and a 1px
      neutral border does not.
      **Done, rule and fixture in one commit.** V1 is `backed`, so the rule
      moved with the prose: the detector now matches the side stripe, a fully
      coloured border on all four sides above 1px, and a gradient
      `border-image`. Three positives and five negatives are pinned in the
      fixture pair — a 1px side rule, a 1px four-sided neutral border, a
      `border-color`-only focus treatment, and `transparent` and `currentColor`
      at accent width, the last two being the layout-reservation and
      inherit-the-text-colour idioms rather than accent decisions.
      `M1 = 0` for all 25 rules on the unchanged clean corpus.
      **Why V1's widening ships while T4's does not:** the clean corpus carries
      the discriminating negative for V1 — three four-sided `1px` borders that
      must stay clean — so its `M1 = 0` measures something. For the four new
      entries and for T4 the corpus carries no near-miss at all.
- [~] **3.2 Widen T4 beyond the ALL-CAPS eyebrow.** T4 names an ALL-CAPS label
      above a section heading. The current form is a pill-shaped badge component
      sitting above the hero H1 — same function, different component, and the
      entry misses it.
      verify: a fixture with a pill badge above an `h1` flags; a badge used as
      a status chip inside a table row does not.
      <!-- deferred-resolution: carried-to=road-to-tell-detector-promotions -->
      **Deferred, prose and status both untouched, on a 2/2 council verdict.**
      T4 is `backed`, so widening its prose without widening its rule makes the
      parity gate green while the claim goes false — the exact defect class that
      gate exists to catch. And the rule cannot be widened cheaply: the defect
      is *positional* (a badge immediately preceding an `h1`), not shape-based,
      because V4's own override declares the pill legitimate on single-line tags
      and chips and V4's rule excludes exactly that radius band. A shape-scoped
      T4 would contradict a sibling entry; a position-scoped T4 needs a
      text-adjacency heuristic in a rules file that is deliberately
      dependency-free with no cascade and no DOM, and which carries a standing
      precedent of refusing to infer layout. The two seats split on whether the
      prose alone could move; resolved toward the stricter reading, which is the
      one consistent with both seats' own Fork-3 principle that a `backed` label
      must not out-run its rule.

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

- [x] AC-1 — The catalog carries an entry with an override condition for each of
      scroll-reveal, cursor-spotlight, hover-fade and grain-over-gradient, and
      each has exactly one status-table row.
      Met: M6, M7, M8, V9, each with an override condition and one status row
      (`lint_design_antipattern_parity` asserts the one-row property).
- [x] AC-2 — `lint_design_antipattern_parity` is green, and no row added by this
      roadmap carries `candidate` without a named step that resolves it.
      Met: green at `50 entries classified, 25 detector-backed`; all four new
      rows are `judgment-only` and none uses `candidate`.
- [x] AC-3a — V1 flags a four-sided coloured or gradient card border and does not
      flag a 1px neutral border.
      Met, with the negative pinned in the fixture pair rather than asserted:
      three positives (side stripe, four-sided colour, gradient `border-image`)
      and five negatives (1px side rule, 1px four-sided neutral,
      `border-color`-only focus, `transparent`, `currentColor`).
      `M1 = 0` across all 25 rules on the unchanged clean corpus.
- [~] AC-3b — T4 flags a pill badge above a hero heading and does not flag a
      status chip in a table row.
      <!-- deferred-resolution: carried-to=road-to-tell-detector-promotions -->
      **Deferred with 3.2, and split out of AC-3 so the V1 half can be claimed
      honestly rather than the pair being reported as one partial.** T4 is
      `backed`, so its prose cannot move without its rule, and the rule needs a
      position-based adjacency heuristic that the registry's own
      dependency-free, no-DOM design has a standing precedent against.
- [ ] AC-4 — The apply-skill sweep of 4.1 is recorded, and every default it
      finds is either removed or stated as intentional with a reason.
