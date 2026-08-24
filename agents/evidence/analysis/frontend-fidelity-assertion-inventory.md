# Frontend fidelity — assertion inventory

<!-- evidence-type: analysis -->

Phase 1 of `road-to-frontend-fidelity-calibration`. One row per fidelity
**claim** the frontend surface makes, its `file:line`, and whether anything
downstream can falsify it. Line numbers verified 2026-08-23 against the
branch HEAD at authoring time; the verify command in step 1.1 re-resolves
every one of them.

Three known rows (320 px floor, visual diff, token violation) were the seed.
The table below is the answer: **13 rows**.

## Legend — the three classifications (step 1.2)

| Label | Meaning |
|---|---|
| `measurable` | A deterministic check can produce a number or a boolean for this claim in this tree today. |
| `measurable-but-blocked` | A deterministic check is conceivable but needs a capability this tree does not have. Names a blocker slug. |
| `unmeasurable` | No deterministic check is available, and inventing one would be a heuristic wearing a gate's clothes. Recorded as this roadmap's own scope cut. |

## The inventory

| # | Claim | `file:line` | Falsifiable downstream? | Class | Blocker |
|---|---|---|---|---|---|
| A1 | "every layout must work on 320px width" | `src/skills/fe-design/SKILL.md:236` | No — no viewport set includes 320 | `measurable` | — |
| A2 | "Mobile-first, and 320 px actually works" | `src/skills/fe-design/SKILL.md:111` | No — same gap as A1 | `measurable` | — |
| A3 | Viewports tested are 1440 / 768 / 375 | `src/skills/design-review/SKILL.md:90` | Yes — the table is the measured set, and it is readable | `measurable` | — |
| A4 | "Compare — visually diff the screenshots, flag regressions" | `src/skills/design-review/references/verification-automation.md:16` | No — the comparison is an agent looking at two pictures; no number is emitted | `measurable-but-blocked` | `b-page-capture-primitive` |
| A5 | `token_violation` is a finding kind the polish gate acts on | `src/agent-src/templates/scripts/work_engine/directives/ui/polish.ts:31` | Consumed, yes. **Produced** by a detector — not wired | `measurable` | — |
| A6 | A raw literal where the audit found a token is off-brand by construction | `src/skills/fe-design/SKILL.md:104` | Yes — `src/skills/design-tokens/scripts/tokens.ts:415` (`scanFile`) already emits exactly this kind | `measurable` | — |
| A7 | Arbitrary Tailwind values must cite their design source | `src/skills/tailwind-engineer/SKILL.md:105` | No — "cites a source" is a judgement about prose, not a value | `unmeasurable` | — |
| A8 | Render evidence is required, not optional, for a render-capable stack | `src/agent-src/templates/scripts/work_engine/directives/ui/review.ts:617` | Yes — `render_ok` is a boolean the gate reads | `measurable` | — |
| A9 | Browser automation and a live preview URL are prerequisites | `src/skills/design-review/SKILL.md:37` | Partially — presence is checkable, the resulting *visual* claim is not | `measurable-but-blocked` | `b-page-capture-primitive` |
| A10 | "Touch targets are at least 44x44px on mobile" | `src/skills/design-review/SKILL.md:110` | No — needs a computed box from a rendered page | `measurable-but-blocked` | `b-page-capture-primitive` |
| A11 | "4.5:1 contrast for text (3:1 large)" | `src/skills/fe-design/SKILL.md:114` | Yes for token pairs (static colour math); no for rendered composites | `measurable-but-blocked` | `b-page-capture-primitive` |
| A12 | Every animated transition carries a `prefers-reduced-motion` alternative | `src/skills/design-review/SKILL.md:74` | Partially — presence of the query is greppable; that the *alternative presents something* is not | `unmeasurable` | — |
| A13 | Rendered visual quality has an owner in the persona layer | `src/agent-src/personas/frontend-engineer.md:60` | No — the line explicitly declines the lens | `unmeasurable` | — |

## Counts

- `measurable` — 6 (A1, A2, A3, A5, A6, A8)
- `measurable-but-blocked` — 4 (A4, A9, A10, A11), all on `b-page-capture-primitive`
- `unmeasurable` — 3 (A7, A12, A13)

Both blocker slugs named above resolve in
`agents/roadmaps/road-to-frontend-fidelity-calibration.md` § Blockers.
`b-detector-license-verification` blocks no **row** — it blocks the
implementation of A6's detector, not the classification of any claim, so it
appears in no `Blocker` cell by design.

## The three scope cuts, stated as cuts

`unmeasurable` rows are this roadmap's own scope cut and are carried nowhere
else:

- **A7** — the claim is "the arbitrary value cites its design source". A source
  citation is prose next to a value. A detector can see the value and cannot
  see whether the sentence beside it is true. Keeping the prose channel and
  saying so is step 3.2; pretending to measure it is what this cut refuses.
- **A12** — `grep` proves a `prefers-reduced-motion` block exists. It cannot
  prove the block *presents an alternative* rather than setting
  `animation: none`. Step 9.3 closes the prose half of this; the measurement
  half stays cut.
- **A13** — no persona owns rendered visual quality. See the § Phase 8 null
  below, which is the recorded form of this cut.

## Phase 8 null — rendered visual quality has no persona owner

Recorded here because step 8.1 offers exactly two outcomes and this is the
second: *"the roadmap records that no persona does and the skill layer is the
only owner."*

Two personas come near the lens and both decline it, in their own words:

- `src/agent-src/personas/frontend-engineer.md:60` — *"Do NOT chase styling
  unless it correlates with a state or render bug."* The lens is state and
  render **correctness**, not visual quality.
- `src/agent-src/personas/design-director.md:16` — judges whether composition
  and colour *"serve the brief and the active brand, not whether the render
  technically succeeded."* The lens is art direction against a brand, not the
  rendered result.

The two together cover *why it renders wrong* and *whether it is on brand*.
Neither covers *does the rendered page look right*. That lens is owned by the
**skill layer** — `design-review` (`src/skills/design-review/SKILL.md:12`) and
`accessibility-auditor` (`src/skills/accessibility-auditor/SKILL.md:15`) — and
by no persona.

**This is a deliberate null, not an oversight.** Creating a persona to hold one
lens is what step 8.2 forbids, and `src/rules/persona-governance.md:43` makes it
costly by design: the domain cap means a new specialist requires a deprecation
candidate. There is no candidate worth spending, so the null is the answer.

**Reopening condition:** a persona is added or retired in the design domain for
an unrelated reason, at which point the lens is re-offered to the surviving set
before a new persona is considered.
