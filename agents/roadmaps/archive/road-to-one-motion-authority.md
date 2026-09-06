---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_growth_exempt: "Adds one active roadmap against an estate of one, to close a defect no prior roadmap recorded: six shipped carriers state contradictory motion durations and easings, and one of them supplies an elastic curve that a backed detector already flags. The contradiction is between shipped artefacts, so it is live today and no reader can tell which value wins. It cannot fold into the two later/ roadmaps that own the adjacent surface, because both are locked on evaluation validity for NEW detector rows and this roadmap adds none. Also claims the +16 `skill_description_tokens` the execution spends: Phase 5 rewrites the ten design-family descriptions so each names a sibling, and the router reads descriptions and nothing else, so a family whose members never point at each other is one it cannot traverse. The cost is bounded by the existing 200-character cap, which does not move; measured 11444 -> 11460 across ten files, an average of 1.6 tokens each — the first pass cost 44 and was compressed back to 16 to keep the per-spawn preamble ratchet green rather than raising its baseline. No skill, rule, command or persona is added, and `open_blockers` falls 49 -> 47 in the same change."
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

- [x] **1.1 Name the single motion carrier in its own section.** `design-patterns.md`
      § Motion (`:153`) is already cited as the timing source of truth by
      `design-review/SKILL.md:72–75`, but it does not say so about itself and the
      five data carriers are bound to nothing. Add an opening line to that section
      declaring it the sole carrier of duration bands, easing choice, and the
      bounce prohibition, and listing the five dependent files by path.
      verify: DONE — `grep -c 'sole carrier'` returns **1**, at
      `design-patterns.md:155`, inside § Motion (which opens at `:153`). All five
      listed paths resolve on disk; checked with a `test -f` loop over each.
- [x] **1.2 Ship `lint_motion_authority_drift` over all six carriers.**
      `corrected-from-reproduction` — the inbox step named five; the census found a
      sixth, `src/skills/design-intelligence/data/motion.csv`, which no draft
      mentions and which carries an explicit `Duration` and `Easing` column per row.
      The gate parses duration bands and easing tokens out of
      `design-rules-checklist.md`, `ux-guidelines.csv`, `app-interface.csv`,
      `styles.csv` and `motion.csv`, and exits 2 when any of them states a band or
      an easing family the authority does not permit.
      verify: DONE — run against the tree carrying only the 1.1 authority edit, the
      gate exited **2** with 13 findings, naming `motion.csv` rows **1, 3, 8, 11 and
      12** (`row 1: states 150-200ms for "button/micro-feedback", above the
      authority's 100-160ms`; `row 3: supplies an elastic curve`; `row 8: supplies a
      back curve`; `rows 11/12: above the authority's 300-500ms`) plus 8 prose-carrier
      statements. The authority is PARSED, not restated: `parseAuthority()` reads the
      bands, the ceiling and the two easing values out of § Motion.
- [x] **1.3 Resolve the five contradictions the gate reds on.** motion.csv row 3
      (`elastic.out(1,0.4)`) and row 8 (`back.out(1.4)`) violate the bounce
      prohibition at `design-patterns.md:167` and catalog M1, whose detector sits at
      `design_slop_rules.ts:680`; row 1's 150–200 ms hover band contradicts
      `:169`'s 100–160 ms; rows 11 and 12 (400–600 ms, 500–800 ms) exceed the stated
      page-transition ceiling. Each row is either brought inside the authority's
      bands or carries the catalog's own override condition in a new column.
      verify: DONE — the gate exits **0** (`128 motion statement(s) across 5
      dependent carrier(s) agree with § Motion`). A CSV read of `motion.csv` over the
      `Easing` + `GSAP Snippet` columns reports **0** rows carrying `elastic.`/`back.`
      without an `Override Condition` value. Per Risk 2 the two curves were NOT
      deleted: rows 3 and 8 keep them behind the catalog's own M1 override condition,
      so the recipe survives where a project declares a playful register.
- [x] **1.4 Register the gate.** Add it to the CI pipeline and to the gate-coverage
      ledger with its scanned scope and a self-test.
      verify: DONE — `taskfiles/ci-fast.yml` defines `lint-motion-authority-drift`
      and `Taskfile.yml:221` adds it to the `ci` task list. `src/config/gate-coverage.yml`
      carries the row (`min_scanned: 90`, corpus derived per carrier, `status: enforced`)
      and `check_gate_coverage` is green. `--self-test` reports **13/13 case(s) behaved
      (8 rejecting, floor 12)**, including both directions of both override paths.

## Phase 2 — The catalog says what class a row is and how it is checked

- [x] **2.1 Add `class`, `remediation` and `verification` columns to every
      antipattern catalog row.** Today the header is `# | Pattern | Why it reads as
      AI-generated | Override condition` (`docs/guidelines/design-antipatterns.md:147`),
      so a WCAG floor and a taste presumption are typographically identical. `class`
      is one of floor · invariant · craft-presumption · style-preference ·
      reference-constraint; `remediation` names the order to try (delete before
      reduce before retune); `verification` is one of static · render · feel ·
      judgment. This is a census pass — no row changes status.
      verify: DONE — `lint_design_antipattern_parity` green (`50 entries classified,
      25 detector-backed`), now also asserting the three cells. All **50** rows carry
      a class, a remediation order and a verification mode from closed vocabularies;
      `censusCells()` + 5 new negative unit cases prove it discriminates (probe: emptying
      M7's class cell turns the gate red, restoring it turns it green).
- [x] **2.2 Bind the two soft classes below existing precedence.** A
      craft-presumption or a style-preference must never outrank a supplied
      reference artifact, a coherent incumbent, or a project `DESIGN.md` — levels
      4–6 of the precedence list at `src/scripts/_lib/ui_authority.ts:18–24`. Encode
      it as a test on that module, not as prose.
      verify: DONE — `resolveSignal()` in `src/scripts/_lib/ui_authority.ts` and
      `tests/scripts/ui_authority_signal_class.test.ts` (14 cases, green): both soft
      classes yield to a level-4 reference artifact, a level-5 coherent incumbent and a
      level-6 `DESIGN.md`, and still flag when nothing outranks them; `floor` and
      `invariant` block even with all three present.

## Phase 3 — A perceptual evidence class

- [x] **3.1 Add a `feel` evidence type.** `docs/contracts/evidence-artifact-types.md:55–59`
      carries `original-review`, `current-binding`, `declared-skip`, `honest-null`
      and `analysis` — every one of them mechanical or textual. Motion that is
      technically correct and still wrong has no type. Add `feel` with a closed
      method vocabulary (`slow-motion` · `frame-step` · `device` · `next-day`); its
      result may be unbacked, but the line may not be absent when motion shipped.
      verify: DONE — the grep returns the table row at
      `evidence-artifact-types.md:60` and the worked example at `:83`.
      `lint_evidence_artifacts` accepts fixtures carrying every one of the four
      methods, accepts an `unbacked` outcome, and refuses both a missing method line
      and a method outside the set (`tests/scripts/lint_evidence_artifacts.test.ts`,
      29 cases green). Per Risk 5 the floor is the METHOD TOKEN, not the word.
- [x] **3.2 Add the motion floor.** `craft-floor.md` § The floors carries twelve
      numbered floors and none mentions motion — the only occurrence of the word on
      the page is in "what is NOT on this page". Add floor 13: shipped motion carries
      a `feel` line naming its method.
      verify: DONE — § The floors now carries **13** numbered entries (counted by
      regex over the section) and floor 13 is "Shipped motion carries a `feel` line
      naming its method", pointing at the closed method vocabulary.

## Phase 4 — Frequency is declared, never inferred

- [x] **4.1 Add `frequency` and `initiation` to the design brief.** The brief covers
      five keys today (`src/skills/fe-design/SKILL.md:49–51`) and there is no
      frequency or input-modality field anywhere in the tree — `interaction_profile`
      has zero occurrences under `src/`. Add both as declared fields, prefilled from
      a role-default table (command palette, tooltip, modal, onboarding, toast, table
      row) and overridden only on evidence. No resolver, no inference from handlers.
      verify: DONE — step 2 of the loop lists **seven** keys: the five the engine
      gates plus `frequency` and `initiation`, and the role-default table carries
      **6** rows (command palette, tooltip, modal/sheet, onboarding, toast, table row).
      HONEST LIMIT, stated in the skill itself: the two new keys are DECLARED, not
      gated — adding them to `REQUIRED_BRIEF_KEYS` would halt every brief already
      written against the five, which is a consumer-visible breaking change this
      roadmap has no authorisation for.
- [x] **4.2 Make the Motion taste dial read those fields.** The dial is a 1–10 scalar
      with no trigger (`context-and-registers.md:63–90`); a keyboard-initiated or
      100-plus-per-day surface should not reach a high dial value whatever the brief
      signal says.
      verify: DONE — `context-and-registers.md:81` carries the row `**DISQUALIFIER**
      — brief \`frequency: high\` or \`initiation: keyboard\` | — | **cap 3** | —`, and
      the paragraph under the table names both `frequency` and `initiation`, links the
      brief that declares them, and states that the cap outranks the brief signal
      rather than averaging with it.

## Phase 5 — The design family becomes router-visible

- [x] **5.1 Give each of the ten design-family descriptions one named sibling.** All
      ten (`design-review`, `existing-ui-audit`, `fe-design`, `design-variations`,
      `design-intelligence`, `ui-apply-generic`, `react-shadcn-ui`,
      `tailwind-engineer`, `ui-component-architect`, `canvas-design`) currently name
      zero, and the description-lint checks that would catch it are dormant by
      construction because the cluster set is empty
      (`src/scripts/lint_skill_descriptions.ts:40–44`). The router reads the
      description, not the body. Rewrite inside the 200-character cap
      (`src/scripts/skill_linter.ts:1541`); the cap does not move.
      verify: DONE — all ten name a sibling (`design-review → existing-ui-audit`,
      `existing-ui-audit → fe-design`, `fe-design → existing-ui-audit`,
      `design-variations → fe-design`, `design-intelligence → fe-design`,
      `ui-apply-generic → react-shadcn-ui`, `react-shadcn-ui → tailwind-engineer`,
      `tailwind-engineer → react-shadcn-ui`, `ui-component-architect → react-shadcn-ui`,
      `canvas-design → design-intelligence`). Lengths 172-184, cap untouched;
      `skill_linter --all` reports `450 pass, 1 warn, 0 fail` with the single warn on
      `server-hardening` (pre-existing, unrelated). Per Risk 4 every rewrite was scored
      against a 32-query trigger corpus with the real ranker before adoption:
      **0 regressions**.
- [x] **5.2 Publish the sibling matcher with its number.**
      `corrected-from-reproduction` — an inbox census claimed "44/299 descriptions
      name a sibling" with no definition of naming and no script, and a companion
      figure of "218/299 bodies" that no reading of the tree reproduces (the literal
      phrase appears 12 times; the loosest variant 79). Ship the matcher that
      produces the figure so it is falsifiable next time.
      verify: DONE — `./scripts-run src/scripts/measure_sibling_naming` prints
      `sibling-naming: 50/299` plus the per-skill list; two consecutive runs are
      byte-identical. Measured on the tree BEFORE the ten rewrites: **41/299**. The
      inbox census's "44/299" reproduces under neither reading and is refuted. The
      script states its definition of naming (identifier-boundary containment, self
      excluded) and its one unfixable false positive (`canvas-design` scores `brand`
      on the phrase "brand assets"), which is exactly what the census omitted.

## Phase 6 — The modern primitives the tree has never named

- [x] **6.1 Extend § Motion with the entry/exit and scripted-animation primitives.**
      The census over `src/` returns zero occurrences of `@starting-style` and zero
      of the scripted web-animation API, one of `transform-origin`, one of `scale(0)`
      and one of the hover-capability media query. That is a knowledge gap, not a
      contradiction: the section can state when a CSS transition suffices, when
      entry/exit needs the newer at-rule and top-layer handling, and when scripted
      animation or a view transition is the right mechanism.
      verify: DONE — `@starting-style` at `design-patterns.md:223` and the Web
      Animations API (`Element.animate()`) at `:227`, both inside § Motion, in a new
      step 6 that also covers `transition-behavior: allow-discrete`, view transitions,
      `transform-origin`, and the `@media (hover: hover)` gate. Each is a MECHANISM
      statement; none of them adds a duration or an easing value.
- [x] **6.2 Keep the new lines under the authority.** Everything added in 6.1 lives in
      the single carrier from 1.1 and is covered by the 1.2 gate; no second file
      gains a duration or easing statement.
      verify: DONE — green after 6.1 (`128 motion statement(s) … agree with § Motion`).
      Everything 6.1 adds lives in the single carrier; no second file gained a duration
      or easing statement in this phase.

## Blockers

### blocker: exit-easing-authority

- **Status:** resolved
- **Resolved:** 2026-09-06 by AI council (2 seats, anthropic + openai) under the maintainer's standing delegation of 2026-09-06.
- **Outcome:** decided — option (A). One shared `ease-out` curve is authoritative for both entering and exiting elements, normalised across every carrier that states an enter/exit easing rule, plus the Phase 1 drift gate. **Exit *duration* is NOT decided here and remains open**: the recommendation below offered "~60-70 percent of the enter duration" as if it answered the question, and a duration ratio cannot answer an easing-curve question. `design-rules-checklist.md`'s `exit-faster-than-enter` row is deliberately left untouched.
- **Owner:** maintainer
- **Blocks:** Phase 1 — One motion authority, and a gate that fails on drift
- **Recommendation:** preference only, not a finding — keep the tree's existing asymmetric position (B): `ease-out` on enter, `ease-in` on exit at roughly 60–70 percent of the enter duration. `design-rules-checklist.md`'s `exit-faster-than-enter` row already implies it, and it touches fewer carriers than switching to symmetric `ease-out`; the field itself has no settled answer, so treat this as a default to override, not a verdict.
- **If you do nothing:** 1.1 cannot write the authority's easing rule, and 1.2's drift gate has no easing family to check the six carriers against.
- **What to do:**
  1. Choose (A) `ease-out` on both enter and exit, or (B) keep the asymmetric easing with exit at ~60–70 percent of enter duration.
  2. Update all six carriers under the Phase 1 gate to match: `design-patterns.md:164–165`, `design-rules-checklist.md:153`, `ux-guidelines.csv:15`, `app-interface.csv`, `styles.csv`, and `motion.csv`.
- **Resolved when:** the owner records which of (A)/(B) the authority states, and `design-patterns.md` § Motion carries that value. — MET: (A) recorded here, and `design-patterns.md` § Motion states `ease-out` for both directions.

**Resolution.** The round-1 split resolved on one observation: the blocker asks
which **easing curve** is authoritative, and "60-70 percent of the enter
duration" is a **duration ratio**. It cannot settle a curve question, so option
(B) as written never contained an answer to the question being asked. That
leaves (A), and (A) is also the value a drift gate can check — a single curve is
one token in five carriers, an asymmetric rule is two tokens plus a directional
condition each.

**The inventory check both seats required, run before normalising.** No carrier's
easing value is a published design-system token, a value a visual or snapshot
test relies on, or a contractual or accessibility commitment:

- **No design-system token.** There is no `tokens.json` anywhere in the tree, and
  neither `design-tokens` nor `brand-to-tokens` defines an easing token. The one
  `ease-out` token *value* in the repository is inside a fixture of a
  third-party design system being imported
  (`tests/scripts/fixtures/design-system-import/dembrandt.json`) — input data,
  not a carrier this change touches, and already `ease-out`.
- **No test relies on `ease-in`.** Every easing in the test corpus is `ease-out`
  (`tests/design-artifacts/fixtures/design.html`,
  `tests/scripts/work_engine/provided_artifact_port.test.ts`,
  `src/scripts/design_slop_rules.test.ts`). Zero occurrences of a test asserting
  `ease-in`.
- **No contractual or accessibility commitment.** `docs/contracts/` and
  `docs/CLAIMS.md` carry no easing statement at all. The tree's accessibility
  obligation on motion is `prefers-reduced-motion`, which is orthogonal to curve
  choice.
- **Two adjacent surfaces are deliberately NOT normalised**, because they are
  reference-constraints rather than carriers of the authority's rule:
  `design-intelligence/data/design-languages/bauhaus.txt` (`ease-in-out`) and
  `enterprise.txt` describe named external design languages, and `styles.csv`'s
  per-style rows describe named visual registers. Under
  `src/scripts/_lib/ui_authority.ts` a supplied reference outranks a craft
  presumption, so overriding them would be the inversion this suite exists to
  prevent.

Nothing found controls, so the normalisation proceeded. **Roadmap closure is not
the whole of the substantive question**: the curve is settled, the exit-duration
ratio is not, and no future ruling on it is prejudged.

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

- **Status:** resolved
- **Resolved:** 2026-09-06 by AI council (2 seats, anthropic + openai) under the maintainer's standing delegation of 2026-09-06.
- **Outcome:** decided — **no** to all thirteen, **for this round**. No non-duplication showing was supplied for any of them, and the estate ratchet is a budget an agent may not spend on its own judgement. Refusing a proposal that would spend a ratcheted budget is a decision to preserve the status quo, which is council-reachable; approving one is not.
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap — it gates work deliberately excluded from it.
- **Recommendation:** none; this is the owner's call — the suite ships 299 skills against a zero-growth-allowance ratchet, so each new skill spends a slot the agent may not allocate on its own judgment, and several of the thirteen proposed skills would overlap `fe-design`, `design-review`, `existing-ui-audit` and `design-variations`.
- **If you do nothing:** none of the thirteen proposed skills gets built, and the overlap question against the four existing skills stays unexamined.
- **What to do:**
  1. Decide whether any of the thirteen proposed skills (build, review, audit, opportunity-finding, vocabulary, platform-fluidity, mobile motion, prototyping, library selection, component-library expert, expert lens, new language skill) earns an estate-growth exemption.
  2. For each one approved, name which existing skill (`fe-design`, `design-review`, `existing-ui-audit`, `design-variations`) it does not duplicate, and open a separate roadmap for it.
- **Resolved when:** the owner records a yes/no per proposed skill, or explicitly defers the whole set with a revisit condition. — MET: a recorded **no** for all thirteen, scoped to this round, with the revisit condition below.

**Resolution.** Build, review, audit, opportunity-finding, vocabulary,
platform-fluidity, mobile motion, prototyping, library selection,
component-library expert, expert lens, and a new language skill: **not
authorised this round.** The suite ships 299 skills against a zero-growth
ratchet, and not one of the thirteen arrived with the showing the ratchet
requires — which existing skill's job it does not already do.

**This is scoped, and the scope is the point.** It is *not* a permanent
prohibition, and it may not be read as one: a standing "never" would itself be a
commitment the council cannot make. Revisit is **per skill**, not for the set,
and each revisit needs a named gap against `fe-design`, `design-review`,
`existing-ui-audit` and `design-variations` — the four skills the overlap
question was raised against. A skill that can name that gap is a candidate
again; the refusal recorded here does not prejudge it.

**Roadmap closure only.** This roadmap creates none of the thirteen and its
Phase 5 makes the existing family router-visible instead, which is the cheaper
half of the same problem and needs no estate slot at all.

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

- [x] AC-1 — DONE. `design-patterns.md` § Motion declares itself the **sole carrier** at `:155` and lists the five dependents by path. `lint_motion_authority_drift` is green over all five, and every statement it reads is either inside the authority's bands or an allowlisted statement with a recorded verdict.
- [x] AC-2 — DONE. `--self-test` runs 13 fixtures, 8 rejecting: a duration above a band, a page transition above the ceiling, an elastic curve with no override, a prose statement contradicting the shared curve, an unreviewed new motion statement, an overshoot in `styles.csv` without a playful register, a gutted authority, a missing dependent — each paired against an accepting fixture that differs by one edit. Wired into `task ci` via `Taskfile.yml:221`.
- [x] AC-3 — DONE. A CSV read reports **0** rows with `elastic.`/`back.` and no `Override Condition`; rows 3 and 8 carry the M1 override rather than losing the curve. Row 1 is 100-160ms, rows 11 and 12 are 300-500ms. HONEST LIMIT: 12 rows name interactions the authority does not band (scroll reveal, stagger list, parallax, loading loop) and are reported `unbanded` rather than checked — failing them would mean inventing a band § Motion never stated.
- [x] AC-4 — DONE. All **50** rows carry all three, from closed vocabularies; `lint_design_antipattern_parity` green and now enforcing them, with 5 new negative unit cases and a live red/green probe.
- [x] AC-5 — DONE. `tests/scripts/ui_authority_signal_class.test.ts`, 14 cases green, asserting it on `_lib/ui_authority.ts` — the module that owns precedence — rather than as catalog prose.
- [x] AC-6 — DONE. `evidence-artifact-types.md` § The six types carries `feel`, its four methods, and its grammar; `lint_evidence_artifacts` enforces the method token; `craft-floor.md` floor 13 requires the line for shipped motion. Stated limit: the gate reads a declaration, not a video.
- [x] AC-7 — DONE. `fe-design/SKILL.md` step 2 carries both fields, their value sets, why each is declared rather than inferred, and a 6-row role-default table; `context-and-registers.md:81` caps the Motion dial at 3 for `frequency: high` or `initiation: keyboard`. Both fields are declared and NOT engine-gated, said so in the skill.
- [x] AC-8 — DONE. Ten of ten name a sibling, lengths 172-184, `skill_linter --all` clean of any over-length description. Trigger corpus of 32 queries scored with the real ranker (`skill_tools/score_skill_relevance.rank`) before and after: **0 regressions**, no query lost its skill and none fell in rank. Pinned by `tests/scripts/measure_sibling_naming.test.ts`.
- [x] AC-9 — DONE. Skills **299** on this branch and 299 on `origin/main`; rules 120 = 120; personas 30 = 30. The four files this roadmap adds are two `src/scripts/` gates/measures and their two test files — none of which is a skill, rule, command or persona.
