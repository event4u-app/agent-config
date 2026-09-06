---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Adds one active roadmap against an estate of one, to close a defect no prior roadmap recorded: six shipped carriers state contradictory motion durations and easings, and one of them supplies an elastic curve that a backed detector already flags. The contradiction is between shipped artefacts, so it is live today and no reader can tell which value wins. It cannot fold into the two later/ roadmaps that own the adjacent surface, because both are locked on evaluation validity for NEW detector rows and this roadmap adds none."
estate_offset_exempt: "Offsets nothing because nothing it touches is scheduled anywhere. The detector-promotion and blind-judgment items an inbox draft proposed are excluded by name and left with their existing later/ owners; what remains -- an authority, its drift gate, three catalog columns, an evidence class, two brief fields and ten descriptions -- has no plan of record to displace."
---
# Road to one motion authority

> **Source:** `agents/tmp.old/inbox-2026-09-l/` — verified against the tree at `93d63073e` on 2026-09-05.

## Goal

Six shipped carriers in this tree state motion timing and easing, and they
disagree. `design-patterns.md:167` forbids elastic easing in UI and a `backed`
detector enforces it, while `motion.csv` row 3 supplies `elastic.out(1,0.4)` as a
hover recipe and row 8 supplies an overshoot curve for list stagger; the same
file's hover band (150–200 ms) contradicts the decision tree's (100–160 ms) and
its page-transition bands run to 800 ms against a stated ceiling of "above 500ms:
almost never". `design-review` already declares one of the six "the timing source
of truth", but that binding runs in one direction only and nothing tests it. This
roadmap makes the declaration real: one carrier holds the numbers, the other five
are checked against it by a gate that fails, the catalog gains the three columns
that say what class a row is and how it is verified, and a perceptual evidence
class is added so "technically correct, feels wrong" has somewhere to be recorded.
It is done when a contradiction between any two motion carriers reds CI.

Four bodies of work the inbox drafts proposed are **prevented, not deferred**, and
none appears as a step below. Automatic activation on UI work already ships
(`fe-design/SKILL.md:4`, the brief at `:49–51`). Experience-first variant
comparison already ships (`design-variations/SKILL.md:70–78`). New `backed`
detector rows are owned by `agents/roadmaps/later/road-to-tell-detector-promotions.md`
under a 2/2 council verdict that they cannot make a truthful claim until the clean
corpus carries a near-miss per signal, and blind-judgment benchmarking is owned by
`agents/roadmaps/later/road-to-routing-assurance-live-floors.md` under an
evaluator-independence lock. This roadmap adds no detector row and runs no
judgment arm, so it neither reopens nor waits on either lock.

## Phase 1 — One motion authority, and a gate that fails on drift

- [ ] **1.1 Name the single motion carrier in its own section.** `design-patterns.md`
      § Motion (`:153`) is already cited as the timing source of truth by
      `design-review/SKILL.md:72–75`, but it does not say so about itself and the
      five data carriers are bound to nothing. Add an opening line to that section
      declaring it the sole carrier of duration bands, easing choice, and the
      bounce prohibition, and listing the five dependent files by path.
      verify: `grep -n 'sole carrier' src/skills/fe-design/references/design-patterns.md`
      returns exactly one line inside the § Motion section, and the five paths that
      follow it all resolve.
- [ ] **1.2 Ship `lint_motion_authority_drift` over all six carriers.**
      `corrected-from-reproduction` — the inbox step named five; the census found a
      sixth, `src/skills/design-intelligence/data/motion.csv`, which no draft
      mentions and which carries an explicit `Duration` and `Easing` column per row.
      The gate parses duration bands and easing tokens out of
      `design-rules-checklist.md`, `ux-guidelines.csv`, `app-interface.csv`,
      `styles.csv` and `motion.csv`, and exits 2 when any of them states a band or
      an easing family the authority does not permit.
      verify: `./scripts-run src/scripts/lint_motion_authority_drift` exits non-zero
      on the tree as it stands today, and its output names `motion.csv` rows 1, 3,
      8, 11 and 12.
- [ ] **1.3 Resolve the five contradictions the gate reds on.** motion.csv row 3
      (`elastic.out(1,0.4)`) and row 8 (`back.out(1.4)`) violate the bounce
      prohibition at `design-patterns.md:167` and catalog M1, whose detector sits at
      `design_slop_rules.ts:680`; row 1's 150–200 ms hover band contradicts
      `:169`'s 100–160 ms; rows 11 and 12 (400–600 ms, 500–800 ms) exceed the stated
      page-transition ceiling. Each row is either brought inside the authority's
      bands or carries the catalog's own override condition in a new column.
      verify: `./scripts-run src/scripts/lint_motion_authority_drift` exits 0, and a
      CSV read of `motion.csv` shows no `elastic.`/`back.` easing on a row without an
      override value.
- [ ] **1.4 Register the gate.** Add it to the CI pipeline and to the gate-coverage
      ledger with its scanned scope and a self-test.
      verify: `task ci` runs the gate; the gate-coverage row records a non-empty
      `scanned` figure and a passing self-test.

## Phase 2 — The catalog says what class a row is and how it is checked

- [ ] **2.1 Add `class`, `remediation` and `verification` columns to every
      antipattern catalog row.** Today the header is `# | Pattern | Why it reads as
      AI-generated | Override condition` (`docs/guidelines/design-antipatterns.md:147`),
      so a WCAG floor and a taste presumption are typographically identical. `class`
      is one of floor · invariant · craft-presumption · style-preference ·
      reference-constraint; `remediation` names the order to try (delete before
      reduce before retune); `verification` is one of static · render · feel ·
      judgment. This is a census pass — no row changes status.
      verify: `./scripts-run src/scripts/lint_design_antipattern_parity` is green and
      every catalog row has three non-empty new cells.
- [ ] **2.2 Bind the two soft classes below existing precedence.** A
      craft-presumption or a style-preference must never outrank a supplied
      reference artifact, a coherent incumbent, or a project `DESIGN.md` — levels
      4–6 of the precedence list at `src/scripts/_lib/ui_authority.ts:18–24`. Encode
      it as a test on that module, not as prose.
      verify: a test asserts that a class `craft-presumption` signal loses to a level-4
      reference artifact and to a level-6 `DESIGN.md` register, and that a class
      `floor` signal blocks.

## Phase 3 — A perceptual evidence class

- [ ] **3.1 Add a `feel` evidence type.** `docs/contracts/evidence-artifact-types.md:55–59`
      carries `original-review`, `current-binding`, `declared-skip`, `honest-null`
      and `analysis` — every one of them mechanical or textual. Motion that is
      technically correct and still wrong has no type. Add `feel` with a closed
      method vocabulary (`slow-motion` · `frame-step` · `device` · `next-day`); its
      result may be unbacked, but the line may not be absent when motion shipped.
      verify: `grep -n 'evidence-type: feel' docs/contracts/evidence-artifact-types.md`
      returns the row, and `lint_evidence_artifacts` accepts a fixture carrying it.
- [ ] **3.2 Add the motion floor.** `craft-floor.md` § The floors carries twelve
      numbered floors and none mentions motion — the only occurrence of the word on
      the page is in "what is NOT on this page". Add floor 13: shipped motion carries
      a `feel` line naming its method.
      verify: `src/skills/fe-design/references/craft-floor.md` § The floors shows
      thirteen numbered floors and the thirteenth names motion.

## Phase 4 — Frequency is declared, never inferred

- [ ] **4.1 Add `frequency` and `initiation` to the design brief.** The brief covers
      five keys today (`src/skills/fe-design/SKILL.md:49–51`) and there is no
      frequency or input-modality field anywhere in the tree — `interaction_profile`
      has zero occurrences under `src/`. Add both as declared fields, prefilled from
      a role-default table (command palette, tooltip, modal, onboarding, toast, table
      row) and overridden only on evidence. No resolver, no inference from handlers.
      verify: `fe-design/SKILL.md` § Brief lists seven keys and the role-default table
      carries at least six rows.
- [ ] **4.2 Make the Motion taste dial read those fields.** The dial is a 1–10 scalar
      with no trigger (`context-and-registers.md:63–90`); a keyboard-initiated or
      100-plus-per-day surface should not reach a high dial value whatever the brief
      signal says.
      verify: the Dial Inference Table shows a disqualifier row for
      keyboard-initiated and high-frequency surfaces, and the § Taste Dials text names
      the two brief fields.

## Phase 5 — The design family becomes router-visible

- [ ] **5.1 Give each of the ten design-family descriptions one named sibling.** All
      ten (`design-review`, `existing-ui-audit`, `fe-design`, `design-variations`,
      `design-intelligence`, `ui-apply-generic`, `react-shadcn-ui`,
      `tailwind-engineer`, `ui-component-architect`, `canvas-design`) currently name
      zero, and the description-lint checks that would catch it are dormant by
      construction because the cluster set is empty
      (`src/scripts/lint_skill_descriptions.ts:40–44`). The router reads the
      description, not the body. Rewrite inside the 200-character cap
      (`src/scripts/skill_linter.ts:1541`); the cap does not move.
      verify: each of the ten descriptions contains the `name:` value of another
      shipped skill, and `./scripts-run src/scripts/skill_linter` reports no
      description over 200 characters.
- [ ] **5.2 Publish the sibling matcher with its number.**
      `corrected-from-reproduction` — an inbox census claimed "44/299 descriptions
      name a sibling" with no definition of naming and no script, and a companion
      figure of "218/299 bodies" that no reading of the tree reproduces (the literal
      phrase appears 12 times; the loosest variant 79). Ship the matcher that
      produces the figure so it is falsifiable next time.
      verify: the script prints a count and the per-skill list, and rerunning it
      reproduces the same number on an unchanged tree.

## Phase 6 — The modern primitives the tree has never named

- [ ] **6.1 Extend § Motion with the entry/exit and scripted-animation primitives.**
      The census over `src/` returns zero occurrences of `@starting-style` and zero
      of the scripted web-animation API, one of `transform-origin`, one of `scale(0)`
      and one of the hover-capability media query. That is a knowledge gap, not a
      contradiction: the section can state when a CSS transition suffices, when
      entry/exit needs the newer at-rule and top-layer handling, and when scripted
      animation or a view transition is the right mechanism.
      verify: `grep -ri '@starting-style' src/` returns at least one hit inside
      `design-patterns.md` § Motion, and the same for the scripted-animation API.
- [ ] **6.2 Keep the new lines under the authority.** Everything added in 6.1 lives in
      the single carrier from 1.1 and is covered by the 1.2 gate; no second file
      gains a duration or easing statement.
      verify: `./scripts-run src/scripts/lint_motion_authority_drift` is green after 6.1.

## Blockers

### blocker: exit-easing-authority

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 — One motion authority, and a gate that fails on drift
- **Recommendation:** preference only, not a finding — keep the tree's existing asymmetric position (B): `ease-out` on enter, `ease-in` on exit at roughly 60–70 percent of the enter duration. `design-rules-checklist.md`'s `exit-faster-than-enter` row already implies it, and it touches fewer carriers than switching to symmetric `ease-out`; the field itself has no settled answer, so treat this as a default to override, not a verdict.
- **If you do nothing:** 1.1 cannot write the authority's easing rule, and 1.2's drift gate has no easing family to check the six carriers against.
- **What to do:**
  1. Choose (A) `ease-out` on both enter and exit, or (B) keep the asymmetric easing with exit at ~60–70 percent of enter duration.
  2. Update all six carriers under the Phase 1 gate to match: `design-patterns.md:164–165`, `design-rules-checklist.md:153`, `ux-guidelines.csv:15`, `app-interface.csv`, `styles.csv`, and `motion.csv`.
- **Resolved when:** the owner records which of (A)/(B) the authority states, and `design-patterns.md` § Motion carries that value.

Phase 1.1 cannot write the authority's easing rule without settling one value.
The tree states, in three places, that entering elements use `ease-out` and
exiting elements use `ease-in` (`design-patterns.md:164–165`,
`design-rules-checklist.md:153`, `ux-guidelines.csv:15`). The external
design-craft reference this round came from holds the opposite for exits —
`ease-out` on both sides. Both positions are held by serious practitioners; the
field has no settled answer, and the inbox drafts correctly refused to state one
as fact. The two candidates are (A) `ease-out` on both enter and exit, or (B)
keep acceleration on exit at roughly 60–70 percent of the enter duration, which is
what `design-rules-checklist.md`'s `exit-faster-than-enter` row already implies.
Whichever is chosen propagates to all six carriers under the Phase 1 gate. This
is a taste decision with no evidence that decides it, so it is not the council's
and not the agent's.

### blocker: motion-specialist-skill-estate

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — the suite ships 299 skills against a zero-growth-allowance ratchet, so each new skill spends a slot the agent may not allocate on its own judgment, and several of the thirteen proposed skills would overlap `fe-design`, `design-review`, `existing-ui-audit` and `design-variations`.
- **If you do nothing:** none of the thirteen proposed skills gets built, and the overlap question against the four existing skills stays unexamined.
- **What to do:**
  1. Decide whether any of the thirteen proposed skills (build, review, audit, opportunity-finding, vocabulary, platform-fluidity, mobile motion, prototyping, library selection, component-library expert, expert lens, new language skill) earns an estate-growth exemption.
  2. For each one approved, name which existing skill (`fe-design`, `design-review`, `existing-ui-audit`, `design-variations`) it does not duplicate, and open a separate roadmap for it.
- **Resolved when:** the owner records a yes/no per proposed skill, or explicitly defers the whole set with a revisit condition.

The round's source material asks for up to thirteen new skills — build, review,
audit, opportunity-finding, vocabulary, platform-fluidity, mobile motion,
prototyping, library selection, a component-library expert, an expert lens, and a
new language skill. The suite ships 299 skills against a ratchet with zero growth
allowance, so each one costs its own growth-exemption claim, and several would
duplicate jobs `fe-design`, `design-review`, `existing-ui-audit` and
`design-variations` already own. This roadmap creates none and takes no position
on whether any should exist; it only records that the question is open and
owner-reserved, because the estate ratchet is a budget the agent may not spend on
its own judgment.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Drift gate over-fires on prose | implementation | Four of the six carriers are prose or CSV free text, not structured fields. A parser looking for duration bands and easing tokens can red on a sentence that is describing a rule rather than stating one, and a noisy gate gets disabled. | Parse only the two structured carriers (`motion.csv`, `styles.csv`) mechanically; check the three prose carriers against an explicit allowlist of the sentences that carry a number, and fail on an unrecognised numeric statement rather than guessing. Ship the gate red on today's tree first, so its true-positive set is known before its false-positive set. | Phase 1 — One motion authority, and a gate that fails on drift |
| 2 | Fixing motion.csv rows changes generated design output | product | Rows 3 and 8 are recipes a generator may already be emitting. Removing the elastic and overshoot curves changes what shipped surfaces look like, which is a design decision wearing a lint fix's clothes. | Route both rows through the catalog's existing override condition (M1 permits an intentional playful affordance) rather than deleting them: the curve survives where a project declares a playful register and is refused elsewhere. Nothing is silently dropped. | Phase 1 — One motion authority, and a gate that fails on drift |
| 3 | The class column becomes a status column | implementation | The catalog already carries a status ledger (`backed` / `floor` / `judgment-only` / `deferred`). A second axis named `class` invites the two to be conflated, and a parity gate that already checks the ledger could start disagreeing with itself. | State in the header row that `class` is a property of the rule and status is a property of its enforcement, and add a parity assertion that the two axes are independent — a `floor` class row may be `judgment-only` status and the gate must accept it. | Phase 2 — The catalog says what class a row is and how it is checked |
| 4 | Description rewrites lose trigger coverage | implementation | The ten design-family descriptions are the router's only signal, and rewriting them to fit a sibling name inside 200 characters means removing words that currently match user phrasings. | Each rewrite is scored against the skill's existing trigger corpus before adoption, and a rewrite that loses a matching query is rejected rather than merged. | Phase 5 — The design family becomes router-visible |
| 5 | A `feel` evidence type with no producer | implementation | An evidence class nothing emits is a vocabulary entry, not a control, and the floor in 3.2 could be satisfied by writing the word. | The floor requires the method token, not the word: a `feel` line names one of the four closed methods and its outcome, and an outcome of `unbacked` is legal. The gate checks the token is from the closed set. | Phase 3 — A perceptual evidence class |

## Acceptance Criteria

- [ ] AC-1 — Exactly one file in the tree states motion duration bands and easing choice as authority, and it says so in its own text; the other five carriers state nothing the authority does not permit.
- [ ] AC-2 — A contradiction introduced into any of the six carriers fails CI, demonstrated by a fixture that reds and a fixture that passes.
- [ ] AC-3 — No row in `motion.csv` supplies a bounce or overshoot easing outside the catalog's declared override condition, and no duration band in it falls outside the authority's bands.
- [ ] AC-4 — Every antipattern catalog row carries a class, a remediation order and a verification mode, and the parity gate is green.
- [ ] AC-5 — A craft-presumption signal provably loses to a supplied reference artifact and to a project `DESIGN.md`, asserted by a test on the precedence module.
- [ ] AC-6 — `feel` is a recorded evidence type with a closed method vocabulary, and the craft floors require a `feel` line for shipped motion.
- [ ] AC-7 — The design brief carries declared frequency and initiation fields with a role-default table, and the Motion taste dial disqualifies decorative motion on keyboard-initiated and high-frequency surfaces.
- [ ] AC-8 — Each of the ten design-family skill descriptions names at least one sibling, all remain at or under 200 characters, and no trigger-corpus match was lost.
- [ ] AC-9 — The suite's skill count is unchanged at the ratchet, and no new rule, command or persona was added by this roadmap.
