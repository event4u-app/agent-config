---
complexity: structural
status: later
parent_roadmap: road-to-tell-currency
review_by: 2026-12-03
estate_growth_exempt: "Adds one later/ roadmap to receive 41 measured collisions between the design-intelligence grounding corpus and the anti-pattern catalog. It cannot fold into road-to-tell-detector-promotions, which is about promoting detectors to backed and is gated on corpus enrichment; this is about a different corpus contradicting rows that are ALREADY backed, and its first step is a scope decision rather than an edit. It cannot be left in the audit artefact either: road-to-tell-currency step 4.1 requires every finding to be fixed or stated as intentional with a reason, and for most of these 41 stated-as-intentional would be false — they are defects. A named receiver is the third disposition and the only honest one. This change archives road-to-tell-currency, so the active count falls by one."
---
# Road to grounding-corpus / catalog parity

> **Parked, not abandoned.** Created 2026-09-03 from `road-to-tell-currency`
> step 4.1, whose sweep is recorded in
> `agents/evidence/analysis/tell-currency-corpus-audit-2026-09-03.md`. That
> audit found **41 prescriptive collisions** between the `design-intelligence`
> grounding corpus and `docs/guidelines/design-antipatterns.md` — rows that hand
> an agent, as a default, something the catalog flags. Fourteen further rows were
> checked and are not defects; those are recorded in the audit so a later sweep
> does not re-flag them.
>
> **Resume when** step 0 has a decision. Every other step is an edit whose shape
> that decision determines, and doing the edits first would be answering the
> question by accident.

## The finding behind the findings

Every one of the 41 sits in a file the detector cannot read. The corpus is
`.csv`, `.txt` and `.json`; `lint_design_slop`'s `enginesForExt` classifies an
engine for `.css`, the `.html` family, `.jsx`/`.tsx` and `.md` only. So the
corpus that motivates the catalog is structurally outside the catalog's
enforcement, and no amount of detector work reaches it.

The worked example is the one collision this roadmap's parent already fixed:
`data/ux-guidelines.csv` carried `transition-all duration-200` in a column named
`Code Example Good`. That is M4's exact defect, M4 is `backed`, and the row was
invisible to it twice over — the file is not scanned, and the detector matches
`transition\s*:\s*all`, which the Tailwind class form does not contain.

## Phase 0 — the scope decision, which gates everything else

- [ ] **0.1 Decide what a served corpus column may contain.** The corpus has
      columns named `Code Example Good`, `Primary Style Recommendation`,
      `Style_Priority` and `Design System Variables`. Those are not descriptions
      of a design language; they are values an agent copies. The question is
      whether a served column may carry a value the catalog flags **when the row
      describes a style whose definition includes it** — film grain in a row
      whose `Era/Origin` is "1970s-90s Analog Revival" is the honest case for
      yes, and glassmorphism as the `Primary Style Recommendation` for fifteen
      unrelated product types is the honest case for no.
      verify: the rule is written down with both of those cases resolved by it,
      and it decides all 41 findings without a per-row argument.
- [ ] **0.2 Decide whether the corpus enters detector reach at all.** Either the
      engine map gains a corpus-shaped reader, or the corpus is declared
      out of detector scope and the parity is maintained by review. Declaring it
      out of scope is a complete answer; leaving it undeclared is what produced
      41 findings nobody was looking for.
      verify: the decision is recorded with its cost, and if it is "in scope",
      the pre-registered `M1 = 0` ceiling is re-run for every existing rule
      against the widened surface.

## Phase 1 — the two CI-floor breaches, which are not stylistic

- [ ] **1.1 `data/motion.csv` has zero reduced-motion coverage.** Sixteen
      animation recipes, `grep -c "reduced-motion"` = 0, against **M5**
      ("Never acceptable; always add a `prefers-reduced-motion` variant") and the
      CI-enforced floor **Q4**. The mitigation exists in sibling files and is
      never co-retrieved, because `gsap` is absent from the `ground` plan — so
      an agent that asks for a scroll reveal gets the recipe without the floor.
      verify: every recipe either carries the variant or the file carries one
      statement that governs all sixteen, and a motion query retrieves it.
- [ ] **1.2 Four sub-floor tracking defaults.** `letter-spacing: -0.05em` and
      its Tailwind `tracking-tighter` form, on display text, in
      `data/styles.csv:48,70` and `design-languages/monochrome.txt:65`,
      `bauhaus.txt:39`. **T6** is `backed` and floor **Q7** puts the minimum at
      −0.04em.
      verify: no served column carries a value below the Q7 floor, and any row
      that keeps a tight-tracking treatment states the floor it respects.

## Phase 2 — defaults keyed on a product type rather than an aesthetic

- [ ] **2.1 Glassmorphism as a primary default.** Fifteen `Primary Style
      Recommendation` rows, fifteen `Style_Priority` rows and four literal
      `Backdrop blur (10-20px)` recipes, against **V2**, whose override restricts
      glass to a surface that genuinely floats above a blurred layer. The corpus
      contradicts itself here: `references/design-rules-checklist.md:107` says
      "use blur to indicate background dismissal … not as decoration".
      verify: the checklist and the recommendation columns agree, and every
      surviving glass recommendation names the depth relation it depends on.
- [ ] **2.2 Violet-on-dark palettes keyed on bare product types.** Two rows
      state the **C1** triad verbatim in their own `Notes` field
      ("violet + … cyan on dark"); 24 of 161 colour rows carry a violet primary
      or accent. C1 is `judgment-only` *because* which colours are primary is a
      judgment — and a column named `Primary` removes that judgment.
      verify: no colour row declares the C1 combination as primary without a
      brand input, and the status note's premise holds again.
- [ ] **2.3 Side-stripe status indicators.** `data/styles.csv:31,44` offer
      `border-left` colour as the status mechanism for a dashboard and an
      AI-native UI — **V1**, `backed`, and widened by this roadmap's parent to
      cover four-sided and gradient forms too.
      verify: neither row hands a stripe as the status mechanism; the
      alternatives V1's override allows are named instead.

## Phase 3 — the remaining clusters

- [ ] **3.1 T7/T8 in the files that have no flag column.** The `AI-Default Flag`
      mitigation works, and reaches only `font-pairings-reference.csv`. At least
      8 `styles.csv` rows and 6 `design-languages` specs pin a T7 family as a
      token with no flag and no stated reason — and the same Nunito + DM Sans
      pairing is flagged in one file and unflagged in the other.
      verify: the flag mechanism covers every file that pins a family, or the
      files that cannot carry it state their reason per row.
- [ ] **3.2 Radius tokens above the V4 cap.** Eight `styles.csv` rows carry card
      or button radii above 16px on sub-200px surfaces, against **V4** and floor
      **Q9**. The `--radius-pill: 999` rows are excluded — V4's own override
      sanctions them.
      verify: every surviving radius above the cap is either a pill or names the
      override it invokes.
- [ ] **3.3 Elastic and overshoot easing as a default.** `data/motion.csv:4,9`,
      against **M1**, `backed`. One row carries a partial self-authored
      mitigation that stops short of M1's principle.
      verify: neither row hands an overshoot curve as the default for an
      ordinary UI interaction.
- [ ] **3.4 Gradient text shipped as a token.** `data/styles.csv:49` and
      `design-languages/cyberpunk.txt:150` — both halves of **C2**'s
      deterministic rule co-occur in served columns, and one ships
      `--gradient-text` as a system variable.
      verify: no served column ships a chromatic text gradient as a token.
- [ ] **3.5 Decide the CP6 register question, which is not a defect until it is
      decided.** Four rows name a stock render subject — "floating blobs",
      "futuristic HUD", "gradient mesh" — but **CP6** governs art direction, and
      two of the four are UI-style specs rather than image briefs. A register
      mismatch has to be resolved, not assumed in either direction.
      verify: CP6's scope says whether it reaches a UI-style spec, and the four
      rows are dispositioned by that answer.
- [ ] **3.6 An italic serif pinned as the display face beside a hero size
      range.** `data/styles.csv:78` — **T2** is `judgment-only` because it
      requires knowing which element is the hero, and this row names the hero
      size in the same cell.
      verify: the row either drops the pairing or states the editorial rationale
      T2's override asks for.

## Phase 4 — the two consumer-side gaps the same sweep found

- [ ] **4.1 `blade-ui` names no Laravel ecosystem default.** It cites V1, T3 and
      L1/L2 — none of which is a Laravel default — and delegates concrete bans
      to `tailwind-engineer`, which bans Tailwind's. Breeze and Jetstream
      scaffold markup and the default `x-` component look are never named
      anywhere.
      verify: the skill names its own ecosystem's scaffold tell with a catalog
      citation, in the shape `react-shadcn-ui` already uses.
- [ ] **4.2 `tailwind-engineer`'s typography and layout bans carry no inline
      id.** T7 and L1/L2 appear only in a roll-up sentence, so a reader who
      jumps to the bullet gets the ban without the citation. The skill also owns
      "concrete Tailwind class / hex bans" per the catalog's ownership table and
      ships no ban list.
      verify: each bullet carries its own id, and the ownership the catalog
      assigns is either discharged or handed back.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The corpus is edited into blandness | product | The corpus's value is that its rows describe real design languages specifically; stripping every flagged value would leave generic rows that ground nothing, which is worse than the collisions | Phase 0.1 must produce a rule that resolves the analog-film case as KEEP before any Phase 2 or 3 edit runs, and the audit already separates the 14 descriptive rows from the 41 prescriptive ones | Phase 0 — the scope decision, which gates everything else |
| 2 | Widening detector reach re-opens 25 M1 epochs | implementation | 0.2's in-scope branch means the pre-registered M1 = 0 ceiling is re-measured for every existing rule against a larger surface, and one new false positive on any rule demotes it | 0.2 requires the re-run to be part of the decision's cost rather than a discovery afterwards, and declaring the corpus out of detector scope is an explicitly complete answer | Phase 0 — the scope decision, which gates everything else |
| 3 | The two floor breaches wait behind a scope debate | implementation | 1.1 and 1.2 breach CI-enforced floors (Q4, Q7) and are true regardless of how 0.1 resolves, so gating them on a policy decision delays the only findings with an objective bar | Phase 1 is ordered before Phases 2 and 3 and depends on 0.1 only for wording, not for whether to act | Phase 1 — the two CI-floor breaches, which are not stylistic |
| 4 | The audit ages faster than the roadmap | product | The corpus is edited by other work; a 41-row inventory pinned to one commit drifts, and a stale inventory reads as a fixed one | Every row in the audit carries `path:line` against a named commit, and the resume condition is a decision rather than a date, so a re-measure is the first action on resume | Phase 0 — the scope decision, which gates everything else |

## Acceptance Criteria

- [ ] AC-1 — Phase 0 carries a written rule that decides all 41 findings without
      a per-row argument, and the analog-film and glassmorphism cases are both
      resolved by it explicitly.
- [ ] AC-2 — The two CI-floor breaches (M5/Q4 in `motion.csv`, T6/Q7 tracking)
      are closed, or each carries the floor it respects.
- [ ] AC-3 — No served corpus column hands a `backed` catalog tell as a default
      value, measured by re-running the audit's own greps.
- [ ] AC-4 — The corpus's detector reach is declared either way, and if it is
      in scope, every existing rule carries a fresh `M1` number.
- [ ] AC-5 — `blade-ui` names its own ecosystem default with a catalog citation,
      and `tailwind-engineer`'s bans each carry an inline id.
