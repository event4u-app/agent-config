---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to frontend fidelity calibration

> **Source:** `agents/tmp.old/improve-frontend` — a four-version external
> critique of this suite's frontend surface. The final version is a strict
> superset of the earlier three and is what this roadmap is built from. Every
> `file:line` below was re-verified against HEAD on 2026-08-22; the source
> pinned a v14.6.0 tree and several of its line numbers had drifted.
>
> **Phase 9 merged in.** Phase 9 arrived via `/analyze:inbox` on 2026-08-22 from
> a dropped inbox roadmap (bundle: `ENC1:NgLuS2TsKFfTMquCWiotCstSx1LRuo5uOQTKUhaqqlbH7zuJlj2dceHNTYDHx9cU+15GBb26H3ckGP6G1VFnB3ALaLG50vjXFxbUyS6YdlhSPvodiSU28bTranG/NJC712AmDHAbsXY8vtDIf0L4s0V3HXaA1nmttP8JnfBc`) — four
> verified survivors plus two one-line items. What was dropped, and why, is
> recorded at Phase 9 rather than here.

## Goal

The frontend surface stops asserting fidelity and starts measuring it. Three
things are true when this is finished. First, an artefact's **maturity** (is
this a wireframe or a finished comp?) and the **mandate** over it (must it be
reproduced 1:1?) are two separate axes that the routing layer reads
separately, so a greyscale skeleton can no longer be routed as a pixel spec.
Second, at least one fidelity dimension that today is checked by an agent
looking at two pictures is checked by a number that a gate can read, and that
number lands in a per-element artefact a reviewer can diff. Third, the
single-pass review in the ad-hoc path becomes a bounded convergence loop with
a declared round ceiling, so "reviewed once and shipped" is no longer the only
shape available. Every dimension that fails to produce a stable number is
recorded as a null and cut from the matrix rather than shipped as a heuristic
wearing a gate's clothes.

## Context

The defects this roadmap acts on, each re-verified at HEAD:

- **W1 — a wireframe is routed as a 1:1 spec.** `src/rules/design-fidelity.md:8`
  carries `keyword: "wireframe"`, and once the rule fires,
  `design-fidelity.md:101` (`strict`) reads "Build 1:1" while
  `design-fidelity.md:102` (`structural`) locks fonts — both wrong for a
  greyscale skeleton whose typography is deliberately a non-decision.
  `strict` is the shipped default (`src/config/agent-settings.template.yml:723`).
  An **outbound** counterpart already exists:
  `src/skills/wireframe/SKILL.md:109-111` forbids promoting the wireframe's own
  skeleton into hi-fi, because "the wireframe's greyscale skeleton hard-codes
  non-decisions". Nothing carries that fact **inbound** — the rule that fires
  on the word has never been told it.
- **W2 — comparison is an agent looking at two pictures.**
  `src/skills/design-review/references/verification-automation.md:16` is
  "Compare — visually diff the screenshots, flag regressions". The engine
  collects render artefacts (`.../directives/ui/review.ts:112` names
  `{render_ok, screenshot_path, dom_dump_path}`, and `:403-407` gates on
  `render_ok`) and compares no numbers from them.
- **W3 — no per-element measurement artefact.** A tree-wide search for
  measurement-sheet shapes (`measurement-sheet`, `measurement_sheet`,
  `per-element measurement`) across `src/` and `docs/` returns zero hits.
- **W4 — `token_violation` is consumed but never produced by a detector.**
  `.../directives/ui/polish.ts:31` declares `TOKEN_VIOLATION_KIND`, `:94-100`
  gates a round on those findings, `:191` classifies them — and the only thing
  that creates one is an agent's judgement.
  `src/skills/design-tokens/SKILL.md:43-44` *suggests* wiring the validate
  linter into review/polish; nothing does it.
  **Narrowed from the source's claim:** the arbitrary-value half is **not**
  uncovered — `src/skills/tailwind-engineer/SKILL.md:105` already requires
  arbitrary values be "flagged with the design source they cite" and `:110`
  names them as a risk call-out. The real defect is the absence of a
  **deterministic** channel, not the absence of coverage.
- **W5 — one review, no loop.** The ad-hoc loop in
  `src/skills/fe-design/SKILL.md:34-71` runs Audit → Brief → Inventory → Build
  → Review exactly once; step 5 (`:68-71`) says "run `design-review` before
  calling it done" and nothing re-enters. The engine has a round ceiling; the
  ad-hoc path has no round concept at all.
- **W6 — render-absent means no visual check.**
  `src/skills/design-review/SKILL.md:35-41` makes browser automation and a live
  preview URL a hard prerequisite. Below it there is a static path in prose but
  no artefact that records which checks actually ran.
- **W9/W10 — a 320 px floor is asserted and never measured.**
  `src/skills/fe-design/SKILL.md:88` ("Mobile-first, and 320 px actually
  works") and `:213` ("every layout must work on 320px width") assert it;
  `src/skills/design-review/SKILL.md:84-86` measures 1440 / 768 / 375 only.
  The asserted floor is not in the measured set.
- **W12 — nobody owns rendered visual quality.**
  `src/agent-src/personas/frontend-engineer.md:60` reads "Do NOT chase styling
  unless it correlates with a state or render bug" — the frontend persona
  explicitly declines the lens.

**Excluded as already fixed**, verified rather than assumed:

- Port-coverage bucketing. `.../directives/ui/apply.ts:116` defines
  `COVERAGE_BUCKETS` and `:151` iterates it; `src/skills/fe-design/SKILL.md`
  step 3 already copies the vocabulary. Nothing to add.
- The a11y semantic half. `.../directives/ui/review.ts:349-366`
  (`_synthesize_a11y_findings`) already synthesises `a11y_violation` findings
  deduped by `(rule, selector)`.

**Excluded as maintenance, not roadmap content.** The WCAG target is stale and
self-contradictory across two skills — `src/skills/design-review/SKILL.md:26`
and `:100` say 2.1 AA, `src/skills/accessibility-auditor/SKILL.md:17` says 2.2
AA. That is a two-line correction in the losing file, not a phase.

**Extended, not restated.** The source proposed a provided-artifact precedence
chain. One already ships, with a mechanical half:
`docs/guidelines/design-fidelity-mechanics.md:181` opens
`## Provided-artifact precedence`, and `:232` records that a finding carrying
`artifact_covered: true` is dropped from the round-driving set before the
ceiling check (`.../directives/ui/polish.ts:134` `ARTIFACT_COVERED_KEY`, `:142`
`partition_artifact_covered`, `:166` the call site), with `daf-slop-vs-provided`
as the regression witness (`:241`). What does **not** exist is provenance at
the level of a single value — the flag is per finding, so a reviewer cannot ask
"where did this `16px` come from" and get an answer. Phase 2 adds that and
nothing else.

**The source's own destination was wrong.** Its P1/P2 proposed landing work in
a skill named `design-handover-extraction`. No such skill exists and none ever
did — it is a **guideline**, `docs/guidelines/design-handover-extraction.md`.
Work aimed there lands in the guideline.

## Phase 0 — Separate artefact maturity from artefact mandate

- [x] **0.1 Write the near-miss fixture first.** Add `daf-wireframe-not-pixel`
      to the `daf-*` set: a greyscale wireframe handover that must NOT be
      routed as a 1:1 spec, paired with the near-miss that must stay silent —
      a finished comp handed over with the word "wireframe" in the prose, which
      must still route strictly. Neither fixture may be authored after the
      behaviour it scores.
      verify (discharged): `grep -rho "daf-wireframe-not-pixel" tests src docs | sort -u`
      returns the id, and `git show HEAD:src/rules/design-fidelity.md | grep -c
      'wireframe'` still reports the pre-state trigger count. **Both: the id resolves,
      and the pre-state count is 1.**

      Both fixtures written **before** the behaviour they score, and the pair is committed
      together because the near-miss is the half that catches the over-broadness: a
      finished full-colour comp whose prose says *"this replaces the wireframe we reviewed
      last week"* must still route **strictly**. The word is a reference to a previous
      artefact, not a declaration about this one.

      The baseline is recorded per fixture, and the near-miss's is recorded as **PASS,
      vacuously** — with no discriminator there is nothing to be over-broad, so it passes
      before the change and must still pass after. Saying so is the point: it is the row
      that fails if the discriminator ends up reading the prose.
- [x] **0.2 State the two axes in the rule.** `design-fidelity.md` gains a
      maturity discriminator: a handover whose own artefact declares itself
      low-fidelity carries a **structure** mandate, never a **pixel** mandate,
      regardless of `design.fidelity_mode`. Cite the outbound rule that already
      knows this (`src/skills/wireframe/SKILL.md:109-111`) rather than
      re-deriving it.
      verify (discharged): `./scripts-run src/scripts/check_references` is green and
      `grep -n 'wireframe' src/rules/design-fidelity.md` shows the trigger accompanied by
      the discriminator, not standing alone. **Green; the trigger at `:8` is now joined by
      the § Two axes block at `:92`.**

      The rule states the split as an Iron Law — *maturity is a property of the ARTEFACT,
      mandate is a property of the INSTRUCTION* — and cites `wireframe`'s own § Gotchas
      rather than re-deriving it: *"the wireframe's greyscale skeleton hard-codes
      non-decisions."* A non-decision reproduced 1:1 is a decision nobody made, and a rule
      that routes a wireframe as a pixel spec contradicts the skill that produced it.

      Two clauses added that the step did not name, both because leaving them implicit is
      how this trigger would go wrong: **the discriminator reads the artefact, never the
      prose**, and **an artefact that does not declare its maturity is treated as
      finished** — the safe direction, since guessing low-fidelity would authorise exactly
      the redesign this rule exists to prevent.
      **The rule is now AT its hard cap — 200 lines; `rule_too_large` fires at 201.** The
      first draft landed at 218 and reddened `lint_regression`. The maturity→spec table, the
      full `wireframe` quotation and the near-miss rationale were migrated to
      `design-fidelity-mechanics § Artefact maturity` — this rule's established P4 pattern —
      leaving the Iron Law and the two discriminator clauses where a session actually reads
      them. Recorded because it constrains what comes next: **any further maturity prose goes
      to the mechanics guideline, not to the rule.** There is no headroom left.

      **The migration target had 735 chars of headroom, not the 1,347 the first pass used.**
      `check_depth_budget` reds a FIFTH over-ceiling file, and `design-fidelity-mechanics.md`
      sits at 15,265 against a 16,000-char ceiling — so the rule's own overflow lane is
      nearly full. CI caught it on #1589 (`5 violation(s) against a baseline of 4`), not
      preflight: the ratchet compares against `origin/main`, so the local run was green
      until the branch was updated. The section was cut to the table plus two pointer
      sentences (final file 15,892). Recorded because it constrains the same next step from
      the other side: **the rule is at 200 lines AND its mechanics file is ~100 chars from
      a ceiling** — further maturity prose needs its own file, not either of these two.

      One trap worth naming, hit while trimming: reflowing the paragraph moved *"it is
      treated as finished"* across a line break and took the 0.3 discriminator assertion RED.
      A `toContain` over a hand-wrapped rule is whitespace-sensitive — the asserted clause
      stays on one line.
- [x] **0.3 Pin the near-miss in the routing matrix.**
      `tests/scripts/design_fidelity_routing.test.ts` gains both rows — the
      wireframe class that must route to structure, and the near-miss that must
      still route strictly. The rule's own § Routing already requires a
      near-miss row per new trigger class; this pays it.
      verify (discharged): `npx vitest run tests/scripts/design_fidelity_routing.test.ts`
      passes with both new rows present. **29/29, up from 25.**

      **The rows alone were a hollow pass and are not left that way.** `Row` gained an
      optional `mandate` field, and adding two rows with it made the suite green while
      asserting nothing — the field was data no test read. Four assertions now carry it:
      the two rows exist and **disagree on mandate while agreeing on `routes`** (which is
      exactly the shape of this phase's change — two rows agreeing on both would measure
      nothing new); **absent mandate means `pixel`**, so no pre-existing row was silently
      downgraded; the rule carries the artefact-not-prose clause and the
      treated-as-finished default; and — the one that makes the near-miss mean something —
      **a naive `includes('wireframe')` DOES misfire on the near-miss prompt**, so the row
      guards a real failure mode rather than a hypothetical one.

      **Sabotage-proven:** softening the artefact-not-prose clause to "matches the handover
      text" takes the discriminator assertion RED. Restored, 29/29.

## Phase 1 — Inventory what is measured versus what is asserted

- [x] **1.1 Enumerate every fidelity assertion in the frontend surface.**
      One table: the claim, its `file:line`, and whether anything downstream can
      falsify it. The three known rows (320 px floor, visual diff, token
      violation) are the seed, not the answer.
      verify (discharged): the artefact exists at
      `agents/evidence/analysis/frontend-fidelity-assertion-inventory.md` and every row's
      `file:line` resolves — the `sed -n "${l}p"` sweep over all 17 distinct citations in
      the table produced **no empty line**. **Both halves hold.**

      **13 rows, not the 3 seeds.** The three known rows are A1/A2 (320 px floor), A4
      (visual diff) and A5 (`token_violation` consumed with no producer). Ten more came
      out of the sweep, and two of them changed what later phases have to do.

      **The sweep found the detector this roadmap assumed did not exist.** W4 reads
      "`token_violation` is consumed but never produced by a detector". The consumer is
      real (`polish.ts:31`), and so is a producer nobody wired:
      `src/skills/design-tokens/scripts/tokens.ts:415` (`scanFile`) already emits
      `kind: 'token_violation'` for every raw hex / px / rem literal, and
      `src/skills/design-tokens/SKILL.md:79` documents that it does and says to "wire it
      into review/polish runs". Nothing does. **The defect is the wiring, not the
      absence** — recorded as row A6, and it is what narrows step 3.1 from "write a
      detector" to "connect two things that already exist".

      Four rows classify as `measurable-but-blocked` and every one of them names
      `b-page-capture-primitive`. That is the shape risk #3 in the register warned about
      — but it did not materialise: six rows are `measurable` with no page needed, so a
      measurement channel exists that the blocker does not reach.

      Three rows are `unmeasurable` and are stated as this roadmap's own scope cut rather
      than carried: A7 (a value's *source citation* is prose beside the value, invisible
      to a detector), A12 (`grep` proves a `prefers-reduced-motion` block exists, never
      that it presents an alternative) and A13 (no persona owns rendered visual quality).

- [x] **1.2 Classify each row: measurable, measurable-but-blocked, or
      unmeasurable.** "Blocked" must name the blocker id below.
      Unmeasurable rows are the roadmap's own scope cut and are recorded as
      such, not carried.
      verify (discharged): every one of the 13 rows carries exactly one of the three
      labels (6 `measurable`, 4 `measurable-but-blocked`, 3 `unmeasurable` — the counts
      sum to 13 and are published in the artefact's § Counts), and every `blocked` row
      names `b-page-capture-primitive`, a `### blocker:` slug that exists in this file.
      **Both hold.**

      **All four blocked rows name the same slug, and that is a finding rather than a
      coincidence.** A4 (visual diff), A9 (preview prerequisite), A10 (44×44 touch
      targets) and A11 (rendered contrast composites) fail for one reason: each needs a
      computed box or a pixel off a rendered page. One capability gates the whole class.

      `b-detector-license-verification` appears in **no** `Blocker` cell, deliberately.
      It gates the *implementation* of A6's detector, not the *classification* of any
      claim — and A6 classifies `measurable` on the strength of a producer that already
      exists in this tree (`tokens.ts:415`), which is exactly the option-(b) own-analysis
      path that blocker resolved to. A blocker that constrains how a row is built does
      not make the row unmeasurable, and recording it as though it did would inflate the
      blocked count from 4 to 5.

      **The unmeasurable rows are cut here, not deferred.** Each carries its own
      paragraph in the artefact's § The three scope cuts saying what a detector would
      have to see and cannot. A7 in particular is the row that keeps step 3.2 honest:
      the prose channel stays *because* the claim it carries is not measurable, not as a
      courtesy to the existing text.

## Phase 2 — A fidelity contract with per-value provenance

- [x] **2.1 Define the measurement sheet schema.** A per-element artefact:
      selector, dimension, expected value, observed value, source of the
      expectation. It is the artefact W3 says does not exist.
      verify (discharged): the schema exists at
      `src/scripts/schemas/fidelity-measurement-sheet.schema.json` and
      `npx tsx -e "JSON.parse(...)"` parses it — top-level keys
      `$schema,$id,title,description,type,required,additionalProperties,properties`.
      **Parses.**

      **W3's premise re-verified before the schema was written, not assumed from the
      roadmap.** `grep -rilE 'measurement.sheet|per-element measurement' src/ docs/`
      returned zero paths, so this is a new shape rather than a second copy of one.

      The five required row fields are the step's five: `selector`, `dimension`,
      `expected`, `observed`, `expectation_source`. A sixth is required that the step did
      not name — **`status`**, a four-member enum — because without it the artefact
      cannot express the two states this roadmap actually produces: `unspecified` (the
      expectation source is silent, so there is nothing to deviate from) and `unmeasured`
      (the dimension is blocked, and the row records that it was not skipped silently).
      A sheet that can only say match-or-deviation would force a blocked dimension to be
      absent, which is the exact indistinguishability step 3.3 exists to prevent.

      `dimensions[]` is the half that makes AC-3 checkable rather than argued: every
      entry is `shipped` or `null`, and `null` **requires** a four-field `null_record`
      (falsifier · unavailable capability · affected claims · reopening condition). The
      `affected_claims` array is required for the reason the `b-page-capture-primitive`
      resolution already recorded — *a null that does not enumerate what it covers is
      indistinguishable from a matrix that never had those rows.*

      `expectation_source.kind` is a five-member enum ordered by authority, which is the
      2.2 half landing in the schema rather than beside it.

      Two traps avoided, both recorded in this tree already: `enum` not `const` for the
      version pin (`validate_frontmatter.ts` enforces `enum` and **silently ignores**
      `const`, so a `const` would be a pin nothing checks — the same note
      `review-findings.schema.json` carries), and this is deliberately **not** a findings
      format: `review-findings.schema.json` owns findings. A sheet is the measurement; a
      finding is what someone decided about it.

- [x] **2.2 Extend the existing precedence chain with value-level
      provenance.** `docs/guidelines/design-fidelity-mechanics.md:232` already
      carries the finding-level flag; add the value-level field beside it and
      say plainly that the coarse flag stays the default. Do not restate the
      chain at `:181-241` — link it.
      verify (discharged): `git show HEAD:docs/guidelines/design-fidelity-mechanics.md |
      grep -c 'partition_artifact_covered'` reports the pre-state **1**; the working tree
      reports **2**, the increment being the new section's single reference. And the
      existing block is proven untouched rather than argued: `diff` of lines 171–232
      between `git show HEAD:` and the working tree is **empty — byte-identical**.

      **The chain is linked, not restated.** The new § Value-level provenance opens by
      saying the block above stays the default and that every consumer of
      `artifact_covered` — `partition_artifact_covered` and the ceiling check it feeds —
      is unchanged. The only reason the word appears a second time in the file at all is
      that one sentence naming what is unchanged.

      Two boundaries are stated because leaving them implicit is how risk #5 in the
      register (*"value-level provenance restates the chain that already ships"*) would
      land: the row-level `artifact_covered` mirror is **optional, defaulted-absent, and
      read by no gate**, and the `kind` ordering is *a mirror, not a second source of
      truth* — a `kind` that disagreed with the block above would be a schema defect, not
      a competing chain.

      **The file had 1,945 chars of headroom against the 16,000 depth ceiling, and the
      section used 1,450 of them.** Final size 15,505. Phase 0's own note warned this file
      was ~100 chars from the ceiling; commit `a6e082976` had since trimmed it to 14,055,
      so the headroom existed — but it was *measured before writing*, not assumed, because
      `check_depth_budget` is a shrink-only ratchet where a fifth over-ceiling file reds.
      It still reports 4 violations at baseline. **495 chars remain: the next addition to
      this file needs its own file.**

- [x] **2.3 Pre-register the falsifiers, before any measurement ships.** For
      each dimension Phase 3 will measure, write down now what result would
      make it worthless — a number that varies across two runs on identical
      input, a number no finding can be derived from, a number that disagrees
      with the agent verdict more often than it agrees. A dimension whose
      falsifier fires is cut in Phase 3, not defended.
      verify (discharged): the falsifier list is committed at
      `agents/evidence/analysis/frontend-fidelity-preregistered-falsifiers.md` in the
      commit that closes Phase 2, and **no Phase 3 step is checked off in that commit or
      any earlier one** — so `git log --diff-filter=A --format=%H -1 -- <falsifier-path>`
      predates every Phase 3 commit by construction, not by luck. The ordering is the
      reason Phase 2 is committed as its own chunk.

      **Three generic falsifiers, given ids so a null can name one:** `F1-unstable` (a
      different number across two runs on identical input), `F2-inert` (no finding can be
      derived from it — risk #1 in the register), `F3-disagrees` (disagrees with the agent
      verdict *more often than it agrees*; the majority clause matters, because a number
      that is sometimes surprising is the number working).

      **A fourth falsifier had to be invented, and inventing it is the honest move rather
      than a gap in the roadmap's wording.** F1–F3 all presuppose that a run can be
      attempted. For the `render-diff` dimension no run can be, because
      `b-page-capture-primitive` resolved to option (b). Scoring it `F1-unstable` would
      claim two runs happened. So it gets **`F0-uncapturable`** — *the capability the
      measurement requires is not available on the host the fixtures run on* — stated here,
      before Phase 3, so the cut is not a post-hoc rationalisation of a measurement nobody
      tried.

      One dimension-specific falsifier is pre-registered too: **`F4-unscoped`** on
      `token-literal`. The dimension is *a raw literal **where the audit found a token***.
      A detector that flags every literal in the tree measures a wider claim than the one
      Phase 1 classified as measurable — so the wider behaviour is pre-registered as a
      failure, before the detector that could exhibit it exists.

      **A prediction is recorded, so Phase 3 can be scored rather than narrated:** of four
      dimensions, exactly one ships (`token-literal`); `viewport-floor` resolves as a
      coverage fix and not a measurement; `render-diff` is cut on `F0-uncapturable`;
      `reduced-motion-alternative` is cut on `F2-inert`. Writing the expected outcome down
      first is what makes 3.3 a check instead of a summary.

## Phase 3 — One deterministic measurement channel

- [ ] **3.1 Produce `token_violation` from a detector, not from judgement.**
      Wire a deterministic check that emits the kind `.../directives/ui/polish.ts:31`
      already declares and `:191` already classifies. Scope it to the narrowest
      dimension that survives 2.3 — a raw literal where the audit found a token
      is the candidate, because `src/skills/design-tokens/SKILL.md:43-44`
      already names it and the consumer already exists.
      verify: on a seeded raw-literal fixture the detector emits at least one
      `token_violation` finding, and on its paired clean fixture it emits zero.
- [ ] **3.2 Keep the prose channel and say which is which.**
      `src/skills/tailwind-engineer/SKILL.md:105,110` stays as the judgement
      layer; the detector is additive. A finding must record which channel
      produced it.
      verify: `grep -n 'arbitrary values' src/skills/tailwind-engineer/SKILL.md`
      still returns both lines unchanged after the phase lands.
- [ ] **3.3 Record the nulls as nulls.** Any dimension whose 2.3 falsifier fired
      is removed from the matrix in this phase with one line saying which
      falsifier fired. An unshipped dimension with no null recorded is the
      failure this step exists to catch.
      verify: the count of dimensions in the Phase 2 schema equals shipped
      dimensions plus recorded nulls, checked by reading both artefacts.

## Phase 4 — The preservation gate

- [ ] **4.1 The strict path stays byte-for-byte today's Iron Law.** The
      measurement channel may add findings; it may not soften
      `src/rules/design-fidelity.md:101`. Prove it by diff, not by argument.
      verify: `git show HEAD:src/rules/design-fidelity.md | sed -n '99,103p'`
      and the working-tree equivalent are identical — that range is the mode
      table, header row included.
- [ ] **4.2 Every pre-existing `daf-*` fixture still scores the same.** A
      changed verdict on any id in the existing set is a regression until
      argued otherwise in this file. Take the pre-state id list from
      `git show HEAD` rather than from a number written here, which drifts.
      verify: the `daf-*` fixture suite runs green with no id's expected verdict
      edited — `git diff --stat` over the fixture expectations is empty.

## Phase 5 — The improvement gate

- [ ] **5.1 A measured delta drives a round.** The number from Phase 3 must be
      able to open a polish round through the path `.../directives/ui/polish.ts:94-100`
      already implements, without a new gating mechanism beside it.
      verify: a seeded fixture with one detector-produced `token_violation`
      opens exactly one round; the same fixture with the finding marked
      `artifact_covered: true` opens zero, exercising `:142`.
- [ ] **5.2 The 320 px floor enters the measured set or is withdrawn.** Either
      `src/skills/design-review/SKILL.md:84-86` gains the row that
      `src/skills/fe-design/SKILL.md:88,213` already asserts, or the assertion
      is downgraded to a heuristic in both places. Asserting an unmeasured
      floor is what this step closes.
      verify: `grep -c '320' src/skills/design-review/SKILL.md` is non-zero, or
      `grep -c '320 px actually works' src/skills/fe-design/SKILL.md` is zero.
      Exactly one of the two.

## Phase 6 — A bounded convergence loop in the ad-hoc path

- [ ] **6.1 Give `fe-design`'s loop a declared round ceiling.** Step 5 at
      `src/skills/fe-design/SKILL.md:68-71` becomes re-enterable with a stated
      maximum and a stated stop condition. The ceiling is a number in the text,
      not an implication.
      verify: `grep -nE 'round|ceiling' src/skills/fe-design/SKILL.md` returns
      a line stating the maximum, and the `ui-trivial` skip at `:30-32` is
      unchanged.
- [ ] **6.2 The loop terminates on a null too.** A round that produces no new
      measured finding ends the loop; it does not license another pass on
      judgement alone.
      verify: the stop condition is stated in the same paragraph as the
      ceiling, and a fixture pair (one converging, one that would not) scores
      both outcomes.

## Phase 7 — Verdict scoping when nothing can render

Runs in parallel with Phase 3; depends only on Phase 2.

- [ ] **7.1 Make the static-scoped verdict an artefact, not a promise.** When
      `src/skills/design-review/SKILL.md:35-41`'s prerequisites are unmet, the
      review emits the list of checks that actually ran. The rule already
      demands the scope be named; this makes it readable.
      verify: on a render-absent fixture the review output contains an
      enumerated check list and no unscoped verdict string.
- [ ] **7.2 Gate the render-dependent fixtures behind the blocker.** Any
      fixture in this roadmap that needs a page-reaching capture primitive is
      registered as SKIPPED with the blocker slug as its reason, following the
      precedent already recorded at
      `docs/guidelines/design-handover-extraction.md:74-80`.
      verify: each such fixture's skip reason names
      `b-page-capture-primitive`, and none is silently absent.

## Phase 8 — Name the owner of rendered visual quality

Runs in parallel with Phase 3; depends only on Phase 1.

- [x] **8.1 Decide where the lens lives.** `frontend-engineer.md:60` declines
      it deliberately and that line stays. Either an existing persona takes the
      rendered-visual lens explicitly, or the roadmap records that no persona
      does and the skill layer is the only owner.
      verify (discharged): the second branch. `grep -rn 'render' src/agent-src/personas/*.md`
      shows the word in **two** files and the lens claimed in **neither** — so the Phase 1
      artefact records the null, at
      `agents/evidence/analysis/frontend-fidelity-assertion-inventory.md` § Phase 8 null.
      **Recorded as row A13 and as a named section.**

      **Both near-owners decline the lens in their own words, which is why this is a null
      and not a gap nobody looked at.** `frontend-engineer.md:60` — *"Do NOT chase styling
      unless it correlates with a state or render bug"*: the lens is render
      **correctness**. `design-director.md:16` — composition and colour must *"serve the
      brief and the active brand, not whether the render technically succeeded"*: the
      lens is art direction against a brand.

      Together they answer *why it renders wrong* and *whether it is on brand*. Neither
      answers *does the rendered page look right*. That lens is owned by the skill layer
      — `design-review` and `accessibility-auditor` — and by no persona.

      **The step's `grep` is not satisfiable by its own first branch, and saying so is
      part of the discharge.** "The lens claimed in exactly one file" cannot be read off
      a bare `grep -rn 'render'`: the word appears 20 times across the two personas above,
      every occurrence about state/hydration/art-direction. A verify whose first branch
      is unreachable by construction resolves to its second branch, and the second branch
      is the one that was true anyway.

      The null carries a **reopening condition** rather than being closed forever: if a
      persona is added or retired in the design domain for an unrelated reason, the lens
      is re-offered to the surviving set before a new persona is considered.

- [x] **8.2 Do not create a persona to hold one lens.**
      `src/rules/persona-governance.md`'s per-domain cap governs; a new
      specialist requires a deprecation candidate when the domain is full.
      verify (discharged): `./scripts-run src/scripts/skill_linter --all` → **446 pass,
      0 warn, 0 fail**, and the persona count is **unchanged at 30** files under
      `src/agent-src/personas/`. No deprecation candidate is named because no persona
      was created. **Both hold.**

      **Nothing was built here, and that is the step succeeding.** 8.1 resolved to the
      null, so the only way to fail 8.2 was to invent a `visual-qa` persona to hold the
      lens the null just recorded — precisely the move `src/rules/persona-governance.md:43`
      prices: a new specialist in a full domain requires a deprecation candidate.

      The domain already carries `design-director` (art direction) and
      `frontend-engineer` (render correctness). Adding a third to cover the seam between
      them would have cost a deprecation of one of the two, and neither is worth spending
      on a lens the skill layer already owns and exercises.

      **Bare `skill_linter` with no argument prints "No matching skill/rule files found"
      and exits 0** — a green that scans nothing, which is this repository's recorded
      false-green shape. The run above passes `--all` and reports a denominator (446), so
      the green is a measurement rather than an empty sweep.

## Phase 9 — Scroll-driven narrative surfaces

Depends only on Phase 1. The render-dependent half of 9.4 additionally needs a
page-reaching capture primitive; that is not a new obstacle and gets no blocker
here — `agents/roadmaps/road-to-frontend-power.md:334` (step E3.2) resolves
`b-page-capture-primitive` as option (a) and is the resolver this phase
references.

**Why the rest of that source is not landing.** The bundle it came from is a
16-phase, 96-step plan carrying no `verify:` line on any step, no `Source:`, and
no `estate_offset_exempt`, so it cannot pay its own estate charge; four of its
claims were already false at its own drafting SHA, and one step "respects" a
convergence ceiling that Phase 6 of *this* roadmap has yet to build, which is a
sequencing error rather than a dependency. Its renderer phases would have this
package own a scroll conductor, a video loader and a WebGL renderer, colliding
with the "No app runtime" line in `CLAUDE.md`. What survived verification is the
six steps below and nothing else.

**Dropped, one line each.** Its Phases 3, 5 and 6 (normalized scroll conductor,
video scrub renderer, WebGL renderer) are that app-runtime collision and are
dropped whole. Its Phase 8 is dropped whole because
`agents/roadmaps/road-to-chained-clip-continuity-and-provider-truth.md` already
owns that exact scope and landed in the same run. Its "no Three.js guidance
exists" premise is false — `src/skills/design-intelligence/data/stacks/threejs.csv`
carries 54 lines (one header, 53 rows) across 13 `Category` values. Its "no
scrub patterns exist" premise is false —
`src/skills/design-intelligence/data/motion.csv:7` carries
`scroll, pin, scrub, storytelling, scrollytelling` with a pinned scrub snippet,
and `:14-15` add parallax scrub.

- [ ] **9.1 A story-beat ledger and a style-bible schema, hosted in `wireframe`.**
      The one cleanly unmet gap:
      `grep -rilE 'beat ledger|story ledger|style bible' src/` returns zero paths
      today, verified 2026-08-22. Land the schema under `src/skills/wireframe/`,
      the skill that already owns the low-fidelity artefact, and the guidance row
      under `src/skills/design-intelligence/data/landing.csv`. Do not create a
      skill to hold a schema.
      verify: that same grep returns at least one path under
      `src/skills/wireframe/`, the schema parses via
      `npx tsx -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"`, and
      `ls src/skills | wc -l` is unchanged.
- [ ] **9.2 Renderer selection is a third row in the `fe-design` mode table, not
      a new owner.** `src/skills/fe-design/SKILL.md:20-23` is a two-row table
      naming who owns the UI write; the renderer axis becomes a third row there.
      Grounding routes through machinery that already exists —
      `src/skills/corpus-grounding/scripts/decision_engine.ts:269`
      (`search_stack`), whose stack corpus already carries `threejs.csv` among 16
      stacks — and the axis is recorded beside the existing register read at
      `src/skills/design-intelligence/references/context-and-registers.md:28`.
      `fe-design` stays the owner and no second frontend executor is declared.
      verify: `grep -c 'search_stack' src/skills/fe-design/SKILL.md` is non-zero,
      that mode table has exactly three body rows, and `ls src/skills | wc -l` is
      unchanged.
- [ ] **9.3 `prefers-reduced-motion` becomes a presentation mode, not
      `animation: none`.** It appears in 11 files under `src/` today — verified
      2026-08-22; the source claimed 18 — and in every one of them as a check,
      including `src/ui/tokens.css`, `src/scripts/lint_design_quality.ts` and
      `src/skills/design-review/SKILL.md:74`. `src/skills/accessibility-auditor/`
      names it zero times. Extend that skill and `design-review` with what the
      surface presents *instead of* motion, which is the half no file carries.
      verify: `grep -ric 'reduced.motion' src/skills/accessibility-auditor/` is
      non-zero where it is zero today, and
      `grep -rl 'prefers-reduced-motion' src/ | wc -l` is at least 12.
- [ ] **9.4 A scroll evidence artefact the existing review consumes.**
      `src/skills/design-review/references/verification-automation.md:9-52`
      captures screenshots and diffs them by eye, emitting no machine-readable
      artefact. Extend that file with the artefact schema — scroll position, beat
      id, and the element states asserted at that position — and have
      `design-review` read it. Build no parallel verifier beside it.
      verify: `grep -c 'scroll' src/skills/design-review/references/verification-automation.md`
      is non-zero, `grep -c 'visually diff the screenshots'` on the same file
      still reports 1, and `ls src/skills/design-review/references | wc -l` is
      unchanged.
- [ ] **9.5 Scroll-storytelling trigger fixtures go into the existing evals
      file.** `src/skills/fe-design/evals/triggers.json` is the only file in that
      directory and returns zero `scroll` hits today. The should-trigger and
      should-not-trigger rows land there. This is a fixture addition — not a rule
      and not a phase of its own.
      verify: `ls src/skills/fe-design/evals | wc -l` still reports 1, and
      `grep -c scroll src/skills/fe-design/evals/triggers.json` is non-zero.
- [ ] **9.6 Anti-generic art direction is one slop row plus one corpus row.**
      One row in `src/scripts/design_slop_rules.ts` on the `copy` engine — the
      engine `slop-cp1-em-dash` and `slop-cp2-buzzword` already use — because a
      CSS engine cannot see subject matter: the detectable surface is the brief's
      own wording, never the render. Plus one guidance row in
      `src/skills/design-intelligence/data/stacks/threejs.csv` under an existing
      `Category` value. `slop-c3-dark-glow` (`:549`) already covers the CSS
      neon-glow tell and is not duplicated. This is never a rule.
      verify: `grep -c 'id: "slop-' src/scripts/design_slop_rules.ts` is exactly
      one higher than its pre-state, `wc -l` on `threejs.csv` reports 55, and
      `ls src/rules | wc -l` is unchanged.

## Blockers

### blocker: b-page-capture-primitive

- **Status:** resolved
- **Owner:** maintainer / host
- **Blocks:** Phase 7 step 7.2, and any Phase 3 dimension whose measurement
  requires reaching a rendered page.
- **What to do:** pick exactly one — (a) confirm a page-reaching capture
  primitive is available on the host the fixtures run on, and un-skip the
  render-dependent fixtures against it; or (b) accept that the render-dependent
  dimensions ship as recorded nulls, and cut them from the Phase 2 matrix in
  Phase 3 step 3.3.
- **Recommendation:** **(b) — accept the recorded nulls for now.** The suite has
  already lived with this exact constraint since 2026-08-13 without inventing a
  witness, and Phase 1's classification step is designed to survive it: a
  measurable dimension exists (raw literal versus token) that reaches no page.
  Choosing (a) makes the roadmap wait on a host capability nobody in this tree
  controls.
- **If you do nothing:** Phase 7 step 7.2 has no reason string to register, and
  Phase 3 ships whichever dimensions happened not to need a page — which is
  option (b) taken silently, with no null recorded and no reader able to tell a
  cut dimension from one nobody thought of.
- **Resolved when:** either a render-dependent fixture runs and scores without
  a skip reason, or the Phase 3 null record names every render-dependent
  dimension that was cut.

This is not a new obstacle. `docs/guidelines/design-handover-extraction.md:74-80`
already records `daf-source-over-screenshot` as SKIPPED on 2026-08-13 "for want
of a page-reaching capture primitive", and states that claiming a regression
witness before then would be fabrication. The same constraint reaches every
render-dependent fixture this roadmap would add.
- **Resolution (2026-08-23) — option (b): the render-dependent dimensions ship as
  recorded nulls and are cut from the Phase 2 matrix in step 3.3.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent.
  This environment has no verified page-reaching capture primitive wired to the fixture
  harness, so (a) is not decidable here.

  The null carries the four parts this run records for every null: *unavailable
  capability* — a page-reaching capture primitive on the host the fixtures run on;
  *affected claims* — every dimension whose measurement requires reaching a rendered
  page is unmeasured, and the Phase 2 matrix must not carry a score for it; *evidence
  boundary* — the static-scoped dimensions are unaffected and measurable; *reopening
  condition* — a capture primitive is confirmed available, at which point the
  render-dependent fixtures are un-skipped against it and the cut dimensions return to
  the matrix.

  **Step 7.2's obligation follows from this and is not discharged by it:** the
  render-dependent fixtures stay gated behind this blocker, and step 3.3's null record
  must **name every dimension that was cut** — a null that does not enumerate what it
  covers is indistinguishable from a matrix that never had those rows.
### blocker: b-detector-license-verification

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3.1.
- **What to do:** pick exactly one — (a) run the borrow-check skill over the two
  detector shapes the source flags as license-unverified and record the verdict
  in `provenance/borrows.jsonl` before any adapted code lands; or (b) derive the
  detector independently from this tree's own token model and record that it is
  own analysis, taking no external shape at all.
- **Recommendation:** **(b) — derive the detector from this tree's own token
  model.** The dimension Phase 3 scopes to is a raw literal where the audit found
  a token, and this tree already carries the audit and the token model. There is
  little to borrow, so the cheaper answer is to owe nothing.
- **If you do nothing:** Phase 3.1 is written by whoever picks it up, from
  whatever shape is nearest to hand, and the licence question is answered after
  the code exists — which is the post-hoc justification `code-provenance` names
  as the failure.
- **Resolved when:** either a `borrows.jsonl` row exists for each adapted
  detector shape with a real `transformation_note`, or the Phase 3
  implementation carries an own-analysis label and cites no external shape.

The source's own harvest register flags two of its proposed detector shapes as
license-unverified. `src/rules/code-provenance.md` is unambiguous: an unknown
source license is never permissive by default. This blocker exists so the
question is answered before the code is written, not after.
- **Resolution (2026-08-23) — option (b): derive the detector independently from this
  tree's own token model, own-analysis label, no external shape taken.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent;
  the maintainer delegated owner-reserved blockers to the council for this autonomous
  drain run. Reason: independent derivation **removes** the licensing question rather
  than answering it, and is executable here with no external evidence to fetch. Option
  (a) — run the borrow-check skill and record verdicts in `provenance/borrows.jsonl` —
  stays available if a future implementation does take an external shape, and the
  ledger row would then be required before any adapted code lands.

  **Consequence for Phase 3 step 3.1, recorded here so it is not rediscovered:** the
  detector carries an **own-analysis label** and cites no external shape. Nothing in
  `provenance/borrows.jsonl` is added by this decision, and that absence is the
  decision rather than an omission.
## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The measurement is a number nobody can act on | implementation | A detector ships, emits findings, and no gate or round is derived from them — the same shape as `token_violation` being consumed with no producer, inverted | Phase 5 requires the number to open a round through the path that already exists; a dimension that cannot is cut in 3.3 | Phase 5 — The improvement gate |
| 2 | The strict path is softened while nobody is looking | implementation | Adding a maturity axis is one edit away from weakening the 1:1 mandate the rule exists to carry | Phase 4 proves preservation by diff against `git show HEAD:`, not by argument, and re-scores all 45 existing `daf-*` fixtures | Phase 4 — The preservation gate |
| 3 | Every interesting dimension turns out to need a rendered page | implementation | The blocker below already gates one fixture class; if it gates all of them the roadmap has a contract and no measurement | Phase 1 classifies each row as measurable / blocked / unmeasurable before any detector is written, so the shape is known at Phase 1 rather than Phase 3 | Phase 1 — Inventory what is measured versus what is asserted |
| 4 | The wireframe discriminator over-fires | product | A maturity axis read too eagerly downgrades a finished comp to a structure mandate, which is a fidelity regression wearing a fix's clothes | The near-miss fixture is authored before the behaviour (0.1) and pinned in the routing matrix (0.3); the rule's own § Routing already requires this | Phase 0 — Separate artefact maturity from artefact mandate |
| 5 | Value-level provenance restates the chain that already ships | implementation | Duplicating `design-fidelity-mechanics.md:181-241` splits one contract across two places and they drift | 2.2 adds a section beside the existing block and links it; the verify asserts the pre-state block is untouched | Phase 2 — A fidelity contract with per-value provenance |
| 6 | The narrative schema ships and no review reads it | implementation | 9.1 lands a beat ledger and 9.4 lands an evidence artefact; if `design-review` never consumes either, this phase adds two shapes and no check — the same producer-without-consumer defect as W4, inverted | 9.4 extends the file the review already loads rather than adding a verifier beside it, and its verify asserts the existing diff step is still present | Phase 9 — Scroll-driven narrative surfaces |

## Acceptance Criteria

- [ ] AC-1 — A greyscale handover no longer resolves to a pixel mandate, and a
      finished comp still does. Both directions are pinned by a committed
      fixture pair whose near-miss was authored first.
- [ ] AC-2 — At least one fidelity dimension is decided by a number a gate
      reads, and that number opens a polish round through the mechanism that
      already exists rather than a new one beside it.
- [ ] AC-3 — Every dimension named in the Phase 2 schema is either shipped with
      a measurement or recorded as a null naming the pre-registered falsifier
      that fired. The two sets together account for the whole schema.
- [ ] AC-4 — The strict mode table in `src/rules/design-fidelity.md` is
      byte-for-byte what it is at HEAD, and no `daf-*` fixture that existed
      before this roadmap had its expected verdict edited.
- [ ] AC-5 — The ad-hoc path carries a stated round ceiling and a stated stop
      condition in the same paragraph, so a single-pass review is a choice
      rather than the only available shape.
- [ ] AC-6 — The 320 px floor is either measured or withdrawn. An asserted-only
      floor remains in neither skill.
- [ ] AC-7 — Rendered visual quality has exactly one named owner, or the
      absence of one is recorded as a deliberate null with its reason.
- [ ] AC-8 — Scroll-driven narrative work has a beat/style schema and a
      machine-readable scroll evidence artefact that the existing `design-review`
      flow reads, with no new skill, no new verifier and no new rule added to
      carry them.
- [ ] AC-9 — Renderer selection is a row in the `fe-design` mode table and
      `fe-design` is still the owner of the ad-hoc UI write. No second frontend
      executor exists.
