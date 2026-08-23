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
      `file:line` resolves — the `sed -n "${l}p"` sweep over all **18** distinct citations
      produced **no empty line**, and every line was re-read for *content* rather than
      merely non-emptiness. **Both halves hold, re-verified at the final commit.**

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

      **The citations DRIFTED mid-roadmap and were re-anchored; the drift is recorded
      because the verify would otherwise have been green on stale lines.** Phase 1 wrote
      the table, then Phases 5.2, 6, 7.1 and 9.3 edited the very files it cites. Re-run at
      the final commit, **six** citations pointed at the wrong content and one —
      `fe-design/SKILL.md:213` — pointed at a **blank line**, which is the one condition
      this step's verify actually tests. Re-anchored: `fe-design` 81→104, 88→111, 91→114,
      213→236; `design-review` 84→90, 90→110; `review.ts` 403→617.

      Two things follow. First, a `file:line` inventory over files the same roadmap edits
      is drift by construction — the same defect step 4.1's verify hit from the other side,
      and worth stating twice because it bit twice. Second, "no empty line" is a weak
      test: five of the six drifted citations resolved to a **non-empty wrong** line and
      would have passed it. The sweep above therefore re-read each line's content, and
      that is the check that caught them.

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

- [x] **3.1 Produce `token_violation` from a detector, not from judgement.**
      Wire a deterministic check that emits the kind `.../directives/ui/polish.ts:31`
      already declares and `:191` already classifies. Scope it to the narrowest
      dimension that survives 2.3 — a raw literal where the audit found a token
      is the candidate, because `src/skills/design-tokens/SKILL.md:43-44`
      already names it and the consumer already exists.
      verify (discharged): on the seeded raw-literal fixture
      (`tests/design-artifacts/fixtures/token-detector/seeded-raw-literal.json`) the
      detector emits **2** `token_violation` findings; on its paired clean fixture
      (`.../clean.json`) it emits **0**. `npx vitest run
      tests/scripts/work_engine/directives_ui_token_detector.test.ts` → **14/14**.
      **Both halves hold.**

      **The step's premise was wrong and the correction shrank the work.** 3.1 says
      "wire a deterministic check"; W4 says `token_violation` is "never produced by a
      detector". A producer already exists:
      `src/skills/design-tokens/scripts/tokens.ts:415` (`scanFile`) emits
      `kind: 'token_violation'` per raw hex / rgb / px / rem literal, and
      `src/skills/design-tokens/SKILL.md:79` documents it and says to wire it into
      review/polish. **Nothing did.** So no detector was written — the two existing
      halves were connected, which is what "wire" asked for and what the Phase 1
      inventory (row A6) predicted.

      **Red first, against unmodified code.** The test and both fixtures were committed
      before the implementation and run against HEAD's `review.ts`, verbatim:

      ```
      × the seeded raw-literal fixture emits at least one token_violation
        AssertionError: expected 0 to be greater than or equal to 1
      × F4-unscoped: only values the audit holds a token for are emitted
        AssertionError: expected [] to deeply equal [ '#2563EB', '12px' ]
      × every emitted finding names the audit category the value was found in
        AssertionError: expected undefined to be 'color'
      × a detector finding carries the file:line it was measured at
        AssertionError: expected undefined to be 'src/components/Button.tsx'
      × emitting a finding takes the review off clean
        AssertionError: expected true to be false
      × a judgement finding already in the envelope keeps its own channel
        AssertionError: expected Set{ 'judgement' } to deeply equal Set{ 'judgement', 'detector' }
      × one detector-produced token_violation opens a polish round
        AssertionError: expected 'success' not to be 'success'
      Tests  7 failed | 7 passed (14)
      ```

      **The wiring copies the a11y shape rather than inventing one.**
      `review.ts:349` (`_synthesize_a11y_findings`) already turns a raw
      `state.ui_review.a11y.violations` envelope into deduped findings and sets
      `review_clean = false`. `_synthesize_token_findings` is the same move over
      `state.ui_review.tokens.violations`, deduped by `(file, line, value)`, called from
      `run()` beside the a11y gate. No new halt, no new `AMBIGUITIES` entry, no gating
      mechanism beside the existing one.

      **Scope is the pre-registered dimension, enforced by a shared predicate.** The
      dimension is *a raw literal **where the audit found a token***, so
      `_audit_token_category` emits only values some `state.ui_audit.design_tokens`
      bucket holds — tested with `Object.values(bucket).includes(value)`, byte-for-byte
      the predicate `polish._classify_token_violations` uses at `:418`. Two consequences,
      both deliberate: the seeded fixture's third violation (`#FF00AA`, in no bucket) is
      **not** emitted, which is `F4-unscoped` held rather than merely declared; and every
      detector finding classifies as `matched` downstream, so **the detector channel can
      never trip the token-extraction halt**. The unscoped claim stays with the judgement
      channel, where Phase 1 classified it (row A7, `unmeasurable`).

      **Sabotage-proven.** Removing the membership test from `_audit_token_category` —
      the one line that makes the detector scoped — takes **4** assertions red: *the
      paired clean fixture emits zero*, *F4-unscoped*, *every emitted finding names the
      audit category*, *the clean fixture stays clean*. Restored, 14/14. The clean
      fixture is not decoration: it is the assertion that fails when the detector becomes
      the wider claim.

      **Own analysis, no external shape.** Per `b-detector-license-verification` option
      (b): the predicate is this tree's own token model, the synthesis mirrors this
      tree's own a11y function, and nothing is added to `provenance/borrows.jsonl` —
      that absence is the decision, not an omission.

      Regression: `npx vitest run tests/scripts/work_engine/` → **800 passed (89 files)**,
      and `npx tsc --noEmit` is clean.

- [x] **3.2 Keep the prose channel and say which is which.**
      `src/skills/tailwind-engineer/SKILL.md:105,110` stays as the judgement
      layer; the detector is additive. A finding must record which channel
      produced it.
      verify (discharged): `grep -n 'arbitrary values' src/skills/tailwind-engineer/SKILL.md`
      returns **four** lines including both cited ones (`:105`, `:110`), and the stronger
      form of the same claim also holds — `diff` against `git show HEAD:` on that file is
      **empty, byte-identical**. **The prose channel is untouched.**

      **The verify as written would pass on a file this phase had rewritten**, since a
      `grep -n` for a phrase says nothing about the lines around it. So it is discharged
      by the byte-diff instead, which is what "unchanged after the phase lands" means. The
      grep is reported too because the step asked for it; it is the weaker of the two.

      **The channel field is on the finding, and both values are named in one place.**
      `review.ts` now exports `DETECTOR_CHANNEL = 'detector'` and
      `JUDGEMENT_CHANNEL = 'judgement'`, and every synthesized finding carries
      `channel: 'detector'`. Two assertions pin the split: a detector finding declares
      `detector`, and a judgement finding **already in the envelope keeps its own
      `channel` untouched** while the detector appends beside it — the run yields
      `Set{'judgement','detector'}`, which is additivity measured rather than asserted.

      **A finding carrying no `channel` at all is treated as judgement**, stated in the
      `JUDGEMENT_CHANNEL` doc comment. That is the safe direction and it is why nothing
      downstream had to change: every finding that existed before this phase reads as
      judgement, which is what it was.

      **Why the prose channel is kept rather than tolerated.** Phase 1 classified the
      claim it carries — *an arbitrary value cites its design source* — as row A7,
      `unmeasurable`: a detector sees the value and cannot see whether the sentence beside
      it is true. The prose channel survives because it is the only channel that can carry
      that claim, not as a courtesy to existing text.

- [x] **3.3 Record the nulls as nulls.** Any dimension whose 2.3 falsifier fired
      is removed from the matrix in this phase with one line saying which
      falsifier fired. An unshipped dimension with no null recorded is the
      failure this step exists to catch.
      verify (discharged): the count identity holds, read off both artefacts by script
      rather than by eye — the sheet at
      `agents/evidence/analysis/frontend-fidelity-measurement-sheet.json` declares **4**
      dimensions; **2 shipped** (`token-literal`, `viewport-floor`, each carrying >= 1
      measured row) **+ 2 recorded nulls** (`render-diff`, `reduced-motion-alternative`)
      **= 4**. **Equal.**

      **The nulls are the deliverable here, and each names one falsifier.**

      - `render-diff` → **`F0-uncapturable`**, covering claims **A4, A9, A10, A11**. This
        is the `b-page-capture-primitive` class, resolved 2026-08-23 to option (b).
      - `reduced-motion-alternative` → **`F2-inert`**, covering claim **A12**. The only
        obtainable number is a presence count, and no finding about the *claim* can be
        derived from it.

      Both carry the four required fields — falsifier · unavailable capability · affected
      claims · reopening condition — because the schema **requires** them when
      `status: "null"`. The `affected_claims` enumeration is the part that discharges the
      obligation the `b-page-capture-primitive` resolution wrote down: *a null that does
      not enumerate what it covers is indistinguishable from a matrix that never had
      those rows.*

      **The prediction recorded in 2.3 was half right, and the miss is recorded rather
      than smoothed over.** It said *exactly one* dimension ships. Two did:
      `token-literal` as predicted, and `viewport-floor` — which 2.3 itself described as
      resolving to "a coverage fix and not a measurement". Both readings are defensible
      and the sheet takes the stricter one: `viewport-floor` is `shipped` because it
      carries a real row whose `observed` value is read off a file and is stable across
      reads, with a `_note` on the dimension saying plainly it is a documented set and
      **not** a runtime number. Recording it as a null would have been the easier way to
      match the prediction, and would have claimed less than is true.

      **The F4-unscoped case is a row, not an omission.** `#FF00AA` sits in the sheet with
      `status: "unspecified"` and `expectation_source.kind: "agent_inference"` — the
      detector emits nothing for it and the clean fixture asserts that. A scoped detector
      and a silent one differ exactly here: `expected: null` says no source specifies a
      value, so there is nothing to deviate from.

      **Validated against the schema, with negative controls.** `ajv` compiles
      `fidelity-measurement-sheet.schema.json` and reports the instance **valid: true**.
      Two deliberate corruptions prove the validation has teeth rather than passing
      everything: deleting `reopening_condition` from a `null_record` → **false**; setting
      `expectation_source.kind` to `"vibes"` → **false**. A schema that accepted both
      would have made the count identity above unfalsifiable.

## Phase 4 — The preservation gate

- [x] **4.1 The strict path stays byte-for-byte today's Iron Law.** The
      measurement channel may add findings; it may not soften
      `src/rules/design-fidelity.md:101`. Prove it by diff, not by argument.
      verify (discharged): proven by diff, in the strongest available form.
      `git show HEAD:src/rules/design-fidelity.md` and the working tree are
      **byte-identical for the WHOLE FILE**, so the named range holds trivially. Reported
      both ways: lines 99–103 identical, and lines 116–122 — the actual mode table, header
      row included — identical. **No softening, and none possible: the file is untouched.**

      **The step's line range no longer points at the mode table, and the discharge says
      so rather than reporting a green from the wrong lines.** Phase 0 inserted the
      § Two axes block above it, so `99,103` now lands on the `strict` gloss and the
      artefact-not-prose clause; the mode table moved to **116–122**. A verify pinned to
      absolute line numbers in a file the same roadmap edits is drift by construction —
      recorded because the next reader of this range will hit the same thing.

      The whole-file diff makes the distinction moot here, which is why it is the
      evidence quoted: a range argument can be defeated by a range that moved, a
      byte-identical file cannot.

      **Risk #2 in the register is what this closes** — *"the strict path is softened
      while nobody is looking"*. It could have been: Phase 3 adds a finding channel and
      Phase 5 lets it drive a round, both one edit away from `:119`'s "Build 1:1". Neither
      touched it. The measurement channel adds findings; it changes no mandate.

- [x] **4.2 Every pre-existing `daf-*` fixture still scores the same.** A
      changed verdict on any id in the existing set is a regression until
      argued otherwise in this file. Take the pre-state id list from
      `git show HEAD` rather than from a number written here, which drifts.
      verify (discharged): the pre-state id list is taken from `git show HEAD` rather than
      from a number written anywhere — **50 ids** at HEAD, **52** in the working tree, and
      the set difference is **exactly the two fixtures this branch adds** with
      **nothing removed** (`comm -23` is empty). `git diff --stat` over the fixture
      expectations (`tests/scripts/design_fidelity_routing.test.ts`,
      `tests/design-artifacts/`) is **empty**. The four `daf-*`-bearing suites run
      **121 passed**. **All three hold**: no pre-existing id lost, no expectation edited,
      suite green.

      **The register's "45 existing `daf-*` fixtures" is stale; the measured count is 50.**
      Taken tree-wide across `src`, `docs` and `tests` at HEAD. This is exactly why the
      step says to take the list from `git show HEAD` and not from a number written down —
      the number had already drifted, and a verify that trusted it would have been
      comparing against fiction.

      **The first measurement of this step was WRONG, and the defect is recorded rather
      than quietly corrected.** It reported 50 ids at HEAD and 50 in the working tree,
      `diff` empty — and concluded the id set was unchanged. It is not: this branch adds
      two. The bug was the probe, not the tree: `git grep` **without a ref searches only
      TRACKED files**, and both new fixtures were still untracked, so the working-tree
      side of the comparison silently omitted exactly the files the step exists to notice.
      A probe that cannot see new files cannot detect a changed fixture set — it was
      structurally incapable of failing.

      Re-measured with a filesystem `grep -rhoE` over `src docs tests`: **50 → 52**, the
      difference being `daf-token-detector-seeded` and `daf-token-detector-clean`, with
      `comm -23` (removed) **empty**. That empty removal set is the assertion this step
      actually wants: **no pre-existing `daf-*` id disappeared.** "The set is identical"
      was never the right claim for a branch that adds fixtures; "nothing was lost and
      nothing was re-scored" is.

      **No expected verdict was edited.** The two additions are new fixture *files* under
      `tests/design-artifacts/fixtures/token-detector/`; they add rows and re-score
      nothing, which `git diff --stat` over the expectation files confirms as empty.

      The four suites are `design_fidelity_routing` (29), `design_slop_vs_provided` (5),
      `ui_lane_matrix` (63) and `provided_artifact_port` (24). 121 total, green, with no
      expectation touched — the only honest way to say "still scores the same".

## Phase 5 — The improvement gate

- [x] **5.1 A measured delta drives a round.** The number from Phase 3 must be
      able to open a polish round through the path `.../directives/ui/polish.ts:94-100`
      already implements, without a new gating mechanism beside it.
      verify (discharged): the seeded fixture carrying detector-produced
      `token_violation` findings opens **exactly one** round — `polish.run` returns a
      non-`success` outcome, which is how the gate opens a round (it delegates to the
      stack polish skill). The **same** fixture with every finding marked
      `artifact_covered: true` returns `success` — **zero rounds** — exercising
      `partition_artifact_covered` at `polish.ts:142`. **Both halves hold**, and both were
      red before step 3.1 landed.

      **No mechanism was added beside the existing one, which is the actual requirement.**
      The detector's findings enter `state.ui_review.findings` in the review step and are
      read by the polish gate through the path already at `polish.ts:94-100`. The diff to
      `polish.ts` is **empty** — the file is byte-identical to HEAD. A measured number now
      drives a round because it arrives in the shape the round-driver already consumed.

      Four assertions pin it, and the middle two are the ones that matter:

      - one detector finding → a round opens (`outcome !== 'success'`);
      - the same finding marked `artifact_covered` → **zero** rounds, i.e. the
        artifact-covered partition governs detector findings exactly as it governs
        judgement findings. A detector that could force a round the provided artifact
        already answers would be a fidelity regression wearing a measurement's clothes;
      - `partition_artifact_covered` over the detector's own findings yields
        `actionable: 0 / informational: 2` — the mechanism named directly, not inferred
        from an outcome;
      - `POLISH_CEILING` is still **2**. This phase adds findings, never rounds.

      **Risk #1 in the register is what this closes** — *"a detector ships, emits findings,
      and no gate or round is derived from them"*. The `F2-inert` falsifier is the
      pre-registered form of the same risk, and for `token-literal` it did **not** fire:
      that is why the dimension ships rather than joining the two nulls.

- [x] **5.2 The 320 px floor enters the measured set or is withdrawn.** Either
      `src/skills/design-review/SKILL.md:84-86` gains the row that
      `src/skills/fe-design/SKILL.md:88,213` already asserts, or the assertion
      is downgraded to a heuristic in both places. Asserting an unmeasured
      floor is what this step closes.
      verify (discharged): `grep -c '320' src/skills/design-review/SKILL.md` → **4**
      (non-zero) and `grep -c '320 px actually works' src/skills/fe-design/SKILL.md` →
      **1** (non-zero). **Exactly one of the two conditions is true**, which is what the
      step requires: the first branch was taken, so the second must NOT hold.

      **First branch: the measured set gains the row.** `src/skills/design-review/SKILL.md`
      Phase 2 was "Test at three viewports" (1440 / 768 / 375); it is now four, with
      `| Floor | 320px | Narrowest supported — the asserted floor |`. The heading count
      was corrected with it — a table saying "three" above four rows is the same
      assertion-drift defect in miniature.

      **The downgrade branch was available and is the worse trade.** Deleting *"320 px
      actually works"* from `fe-design:88` and *"every layout must work on 320px width"*
      from `:213` would also discharge the step, and would remove a claim this suite is
      right to make: 375px passing says nothing about 320px, which is exactly where a
      two-column grid or a fixed `min-width` breaks. The cheaper edit would have cost the
      claim; this one costs three lines of prose and keeps it.

      Three sentences of rationale ship beside the row, pointing at `fe-design` as the
      asserting file, so a reader who wonders why a fourth viewport appeared finds the
      answer without this roadmap.

      **What this is NOT, stated because 2.3 pre-registered the trap.** The
      `viewport-floor` dimension resolves as a **coverage fix, not a runtime measurement**
      — the pre-registration says so in advance, precisely so this step could not later
      claim a detector it does not have. What is now true is narrower and checkable: the
      asserted floor is in the set a reviewer is told to test. Whether any given surface
      passes at 320px still needs a rendered page, and that half sits under
      `b-page-capture-primitive` with the rest of its class.

      `skill_linter --all` → 446 pass, 0 warn, 0 fail.

## Phase 6 — A bounded convergence loop in the ad-hoc path

- [x] **6.1 Give `fe-design`'s loop a declared round ceiling.** Step 5 at
      `src/skills/fe-design/SKILL.md:68-71` becomes re-enterable with a stated
      maximum and a stated stop condition. The ceiling is a number in the text,
      not an implication.
      verify (discharged): `grep -nE 'round|ceiling' src/skills/fe-design/SKILL.md` returns
      the maximum stated as a number, twice — `:72` *"at most **2 rounds**"* and `:80`
      *"The ceiling is **2**"* — and the `ui-trivial` skip at `:30-32` is **byte-identical**
      to `git show HEAD:` on that range. **Both hold.**

      **Pre-state, measured before the edit: `grep -nE 'round|ceiling'` already returned 4
      lines and not one stated a maximum** — all four were `grounded` / `grounding`
      matching the substring `round`. That is worth recording because the verify as
      written would have passed on the pre-state file: a `grep` for `round` was
      non-empty before this step ran. It is discharged against the stronger reading — a
      line stating *the maximum* — which is what the step's prose asks for.

      Step 5 was *"Review — run design-review before calling it done"* and nothing
      re-entered. It is now **"Review, then re-enter"**: findings → fix → re-enter step 5,
      at most 2 rounds, and at the ceiling with findings still open the loop **hands the
      remaining list back** — ship-as-is or abort is the user's call. *"Judgement alone
      never buys a third round"* is the sentence that closes W5.

      **The number is 2 because that is the number the engine already enforces**
      (`directives/ui/polish.ts`, `POLISH_CEILING`), and the prose says so. A test asserts
      the identity in both directions — the regex over the skill text **and**
      `POLISH_CEILING === 2` — so the ad-hoc path and the ticketed path cannot drift into
      two conventions. Picking a different number here would have been the cheaper edit
      and would have created exactly that drift.

      The `ui-trivial` skip is untouched by design: a ≤ 5-line change gaining a 2-round
      convergence loop would be the over-application this skill's own escape hatch exists
      to prevent.

- [x] **6.2 The loop terminates on a null too.** A round that produces no new
      measured finding ends the loop; it does not license another pass on
      judgement alone.
      verify (discharged): the stop condition is in the **same paragraph** as the ceiling —
      asserted mechanically, not by eye: the test splits the skill on blank lines, finds the
      block containing `at most **2 rounds**`, and requires that same block to contain
      `no new finding`. And the fixture pair scores **both** outcomes:
      `daf-adhoc-converges` → `success` (loop ends), `daf-adhoc-ceiling` → **not**
      `success` (hands back). **Both hold**; 19/19 in
      `tests/scripts/work_engine/directives_ui_token_detector.test.ts`.

      **"In the same paragraph" is asserted as a paragraph, which is the only reading that
      cannot be satisfied by putting the two sentences four sections apart.** The
      same-block test is what makes 6.2 a check rather than a claim.

      The pair is scored **through `polish.run`**, the mechanism that already bounds the
      ticketed loop — no parallel verifier was built for the ad-hoc path. That choice is
      what makes the fixtures evidence for the prose: the converging fixture ends at
      `review_clean` with zero findings and one round taken, and `polish.run` returns
      `success` at `polish.ts:167`, which **is** the stop condition the paragraph states.
      The ceiling fixture sits at `rounds: 2` with an open finding and does not return
      success — a third pass is unavailable, not merely discouraged.

      **A null round is defined and not left to inference.** The paragraph states that a
      round producing **only** findings the provided artifact already covers produces no
      new finding — which is `partition_artifact_covered` (`polish.ts:142`) read as a stop
      rule rather than as a ceiling exemption. Without that sentence, an
      artifact-covered-only round would look like progress and buy another pass.

      **Sabotage-proven:** replacing the stop condition with *"and keep going until it
      looks right"* takes the same-paragraph assertion **RED** (1 failed / 18 passed).
      Restored, 19/19. The assertion is sensitive to exactly the regression it guards —
      a ceiling with no stop condition beside it.

## Phase 7 — Verdict scoping when nothing can render

Runs in parallel with Phase 3; depends only on Phase 2.

- [x] **7.1 Make the static-scoped verdict an artefact, not a promise.** When
      `src/skills/design-review/SKILL.md:35-41`'s prerequisites are unmet, the
      review emits the list of checks that actually ran. The rule already
      demands the scope be named; this makes it readable.
      verify (discharged): on the render-absent fixture
      (`tests/design-artifacts/fixtures/render-absent/static-scoped.json`) the review
      output carries `verdict_scope` with `scope: "static"`, an enumerated
      `checks_run` (`findings-review`, `token-detector`), an enumerated `checks_not_run`
      (the four render-dependent checks) and the blocker slug — **and no unscoped verdict
      string is reachable**: `scope` is stamped on every path, asserted over both the
      render-absent and render-present fixtures. **Both halves hold**, 29/29.

      **Red first.** The six assertions were run against `review.ts` with the
      `_stamp_verdict_scope(r)` call removed — the pre-implementation state — and all six
      failed (`6 failed | 19 passed`). Restored: 29/29.

      **The artefact is derived, never asserted, and that is the load-bearing property.**
      A check appears in `checks_run` because the envelope carries its evidence:
      `token-detector` is listed only when `review.tokens.violations` is an array,
      `a11y-axe` only when `review.a11y.violations` is. One assertion exists purely to pin
      that — the static fixture carries a `tokens` envelope and no `a11y` one, so
      `token-detector` is listed and `a11y-axe` is **not**. A skill claiming a check ran
      cannot get it into the list.

      **`checks_not_run` is the half that makes the scope honest.** An enumerated
      `checks_run` with nothing beside it reads as a complete review. `RENDER_DEPENDENT_CHECKS`
      names the four (`viewport-sweep`, `touch-target-size`, `rendered-contrast`,
      `screenshot-diff`), and on the static path they land in `checks_not_run` with
      `blocker: b-page-capture-primitive` — so the artefact says what it did, what it did
      not do, and why.

      **A control fixture ships beside it** (`daf-render-absent-control`, `render_ok: true`)
      because without it the static branch could be the only branch and nothing would
      notice: it asserts `scope: "render"`, the four checks moved into `checks_run`, and
      `checks_not_run` / `blocker` **absent**. It carries its own honesty line — it
      *synthesises* `render_ok` as state and does not render, so it proves the branch
      exists and proves nothing about any render-dependent check working.

      This is the rule `design-review-after-ui-write` states ("scope the verdict to what
      was statically checked and say so") turned from prose into a readable field. It adds
      no halt and no `AMBIGUITIES` entry — a scope stamp is not a gate.

- [x] **7.2 Gate the render-dependent fixtures behind the blocker.** Any
      fixture in this roadmap that needs a page-reaching capture primitive is
      registered as SKIPPED with the blocker slug as its reason, following the
      precedent already recorded at
      `docs/guidelines/design-handover-extraction.md:74-80`.
      verify (discharged): each render-dependent fixture names `b-page-capture-primitive`
      as its skip reason **in the fixture itself** (`_skip_reason`), and **none is silently
      absent** — all three ids appear in the skip register at
      `docs/guidelines/design-handover-extraction.md`, each on a table row that carries the
      slug on the same row. Asserted mechanically: every `| \`daf-` row in that file must
      contain the slug. **Both hold.**

      **The precedent is followed rather than re-invented.**
      `design-handover-extraction.md:74-80` already recorded `daf-source-over-screenshot`
      as SKIPPED on 2026-08-13 "for want of a page-reaching capture primitive". That
      section now carries a **skip register** — one table, the reason string stated once
      instead of restated per fixture — with the 2026-08-13 row plus the two this roadmap
      adds.

      **The probe belongs in this step, and it changed what the register says.** A
      `not-available:` line is only honest if someone tried: `command -v` finds no browser
      on `PATH`; `agent-config mcp:available` reports `declared servers: none`; and the
      `playwright` library **does** resolve in this tree — which reads as a capture
      primitive until you run it. Launching chromium fails with *"Executable doesn't exist
      at …/chromium_headless_shell-1234/chrome-headless-shell"*. Library present, **no
      browser binary** → `not-available: headless-browser-binary`, recorded in the register
      and in the blocker.

      **`npx playwright install` was available and not run.** It would trade a named
      unavailable capability for a host dependency nobody in this tree controls — the cost
      the blocker's own § Recommendation prices — and `missing-tool-handling` forbids
      installing a missing tool silently. The probe therefore **confirms** the council's
      option (b) with execution evidence rather than overturning it.

      **One fixture was made honest instead of the assertion being relaxed.** The register
      listed the control fixture as SKIPPED while the file carried no skip reason, so the
      first run of *"every render-absent fixture names the blocker"* went **RED**. The fix
      was to put `_skip_reason` and an `_honesty` line into the fixture — it synthesises
      `render_ok` and does not render — not to narrow the test to the fixtures that already
      passed.

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

- [x] **9.1 A story-beat ledger and a style-bible schema, hosted in `wireframe`.**
      The one cleanly unmet gap:
      `grep -rilE 'beat ledger|story ledger|style bible' src/` returns zero paths
      today, verified 2026-08-22. Land the schema under `src/skills/wireframe/`,
      the skill that already owns the low-fidelity artefact, and the guidance row
      under `src/skills/design-intelligence/data/landing.csv`. Do not create a
      skill to hold a schema.
      verify (discharged): `grep -rilE 'beat ledger|story ledger|style bible' src/` now
      returns **one path**, and it is under `src/skills/wireframe/` —
      `src/skills/wireframe/references/story-beat-ledger.schema.json`. It parses via
      `npx tsx -e "JSON.parse(...)"`. `ls src/skills | wc -l` is **294, unchanged**.
      **All three hold.**

      **The gap was re-verified before filling it:** the same grep returned **zero** paths
      on this branch's base, so this is a new shape rather than a second copy of one.

      **Both halves live in one file on purpose.** A ledger is what happens in order; a
      style bible is what holds still throughout. Split across two files, a beat can
      reference a style that no longer exists. The split *inside* the schema is the load-
      bearing one: a property that changes per beat belongs on the beat, not in the bible.

      **Hosted in `wireframe` because a beat ledger IS a low-fidelity artefact** — one
      axis further along than a static skeleton — and that skill already owns the class.
      No skill was created to hold a schema, which is what the step forbids and what the
      unchanged 294 proves.

      Three fields the step did not ask for, each closing a hole this roadmap opened
      elsewhere:

      - `beats[].maturity` (`wireframe` | `comp`) — so a ledger cannot be handed over as a
        pixel spec **by omission**. Phase 0 made maturity an axis the routing layer reads;
        an artefact that carries beats and no maturity would default to `comp` and inherit
        a 1:1 mandate over greys nobody chose.
      - `style_bible.reduced_motion_presentation` — the schema half of step 9.3. A beat
        carrying `motion` obliges the bible to say what replaces it.
      - `enters_at` accepts **null**, because at wireframe stage no layout exists yet and
        an honest null beats a fabricated scroll offset.

      The guidance row is `landing.csv` row **35, "Scroll-Driven Narrative"** — 8 columns,
      no ragged rows, and the manifest carries only file paths and column names, so a row
      addition has no downstream surface to sync.

- [x] **9.2 Renderer selection is a third row in the `fe-design` mode table, not
      a new owner.** `src/skills/fe-design/SKILL.md:20-23` is a two-row table
      naming who owns the UI write; the renderer axis becomes a third row there.
      Grounding routes through machinery that already exists —
      `src/skills/corpus-grounding/scripts/decision_engine.ts:269`
      (`search_stack`), whose stack corpus already carries `threejs.csv` among 16
      stacks — and the axis is recorded beside the existing register read at
      `src/skills/design-intelligence/references/context-and-registers.md:28`.
      `fe-design` stays the owner and no second frontend executor is declared.
      verify (discharged): `grep -c 'search_stack' src/skills/fe-design/SKILL.md` → **2**
      (non-zero), the mode table has **exactly three body rows**, and
      `ls src/skills | wc -l` is **294, unchanged**. **All three hold.**

      **The row says "still you".** The renderer axis is a *grounding* question, not a
      second executor: `| A renderer axis is in play — WebGL / Three.js / canvas /
      scroll-scrubbed video | **still you** — the renderer is a grounding question, not a
      second executor | the executor, grounded via search_stack |`. A sentence beneath the
      table states it in the other direction too — *a renderer changes what you ground
      against, never who writes the UI* — because a third row in an ownership table is
      exactly where a second owner would sneak in.

      Grounding routes through machinery that already exists: `search_stack` in
      `src/skills/corpus-grounding/scripts/decision_engine.ts:269`, whose stack corpus
      carries `threejs.csv`, read beside the register at
      `src/skills/design-intelligence/references/context-and-registers.md` § Register.
      Nothing new was built to select a renderer.

      **A counting trap, recorded because the next reader will hit it:** `awk` over the
      table piped to `grep -c '^| '` reports **4**, not 3 — the separator row
      `|---|---|---|` starts with `|-`, not `| `, so it is excluded while the header is
      not. Body rows are `4 - 1`. The "exactly three body rows" claim above is counted
      off the file, not off that pipe.

- [x] **9.3 `prefers-reduced-motion` becomes a presentation mode, not
      `animation: none`.** It appears in 11 files under `src/` today — verified
      2026-08-22; the source claimed 18 — and in every one of them as a check,
      including `src/ui/tokens.css`, `src/scripts/lint_design_quality.ts` and
      `src/skills/design-review/SKILL.md:74`. `src/skills/accessibility-auditor/`
      names it zero times. Extend that skill and `design-review` with what the
      surface presents *instead of* motion, which is the half no file carries.
      verify (discharged): `grep -ric 'reduced.motion' src/skills/accessibility-auditor/`
      sums to **3** where it was **0**, and `grep -rl 'prefers-reduced-motion' src/ | wc -l`
      is **14**, at least 12. **Both hold.**

      **The half no file carried is *what the surface presents instead*.** The word appears
      in 11 files at base and in every one as a **check** — `src/ui/tokens.css`,
      `src/scripts/lint_design_quality.ts`, `src/skills/design-review/SKILL.md:74`. None
      said what should be there when the motion is gone.

      `accessibility-auditor` § 2 gains a fifth checklist whose opening line is the point:
      *"audit the PRESENTATION, not the presence of the query."* A four-row verdict table
      maps what the motion carries to what must replace it:

      | reveal → the content at its **final** state | scrubbed sequence → each beat at its
      **resting** state | transition → an instant state change, still announced |
      decoration → **nothing; removal is correct** |

      **Decoration being the only removal case is why `animation: none` is wrong so
      often** — it is right for exactly one of four rows and reads as right for all of
      them. The one-question form is in the text: *if the motion never plays, is the
      content still there and still understandable?*

      `design-review` gets the compressed form beside its existing M5/Q4 line, pointing at
      the table rather than restating it — one contract, not two.

      **This closes the PROSE half of inventory row A12 and deliberately not the
      measurement half.** A12 stays `unmeasurable`, and the `reduced-motion-alternative`
      dimension stays a recorded null on `F2-inert` in the Phase 3 sheet: `grep` proves a
      block exists, and nothing available here reads the declarations inside it to tell a
      presented alternative from a suppression. Closing the prose half does not license
      claiming the measurement.

- [x] **9.4 A scroll evidence artefact the existing review consumes.**
      `src/skills/design-review/references/verification-automation.md:9-52`
      captures screenshots and diffs them by eye, emitting no machine-readable
      artefact. Extend that file with the artefact schema — scroll position, beat
      id, and the element states asserted at that position — and have
      `design-review` read it. Build no parallel verifier beside it.
      verify (discharged): `grep -c 'scroll'
      src/skills/design-review/references/verification-automation.md` → **4** (non-zero),
      `grep -c 'visually diff the screenshots'` on the same file → **1** (unchanged), and
      `ls src/skills/design-review/references | wc -l` → **2, unchanged**. **All three
      hold.**

      **The existing eye-diff step is untouched, which the third assertion is there to
      prove.** `:16` still reads *"Compare — visually diff the screenshots, flag
      regressions"*. The new section sits above it and is explicit about being the
      machine-readable **half** of that comparison, not its replacement.

      The artefact is `scroll_evidence` on the review envelope: `scroll` position,
      `beat_id`, and per-element `state` vs `observed`. `beat_id` references the 9.1
      ledger, which is what makes a sample checkable **against an intent** rather than
      against a remembered screenshot — a row whose `state` and `observed` disagree is a
      finding, and two runs of the file can be diffed. The embedded example is asserted to
      be valid JSON, not just fenced.

      **"Have `design-review` read it" was made true rather than asserted.** The step's own
      verify does not check the consumer, so risk #6 in the register (*"the narrative
      schema ships and no review reads it"*) would have survived a green. `design-review`
      Phase 2 now carries the read beside the viewport sweep, with the disagreement rule
      and the null rule: **an empty `samples` array is a recorded null, not a pass.**

      **No verifier was built beside it**, per the step: the async verifier already on that
      page captures the samples in the pass that captures the screenshots, and the sampling
      positions come from the ledger's `enters_at` values rather than an arbitrary scroll
      grid. Where no capture primitive exists the samples are absent and the verdict is
      static-scoped through `verdict_scope` from step 7.1 — the two phases join up instead
      of each inventing a way to say "nothing rendered".

- [x] **9.5 Scroll-storytelling trigger fixtures go into the existing evals
      file.** `src/skills/fe-design/evals/triggers.json` is the only file in that
      directory and returns zero `scroll` hits today. The should-trigger and
      should-not-trigger rows land there. This is a fixture addition — not a rule
      and not a phase of its own.
      verify (discharged): `ls src/skills/fe-design/evals | wc -l` still reports **1**, and
      `grep -c scroll src/skills/fe-design/evals/triggers.json` → **4** where it was **0**.
      The file still parses. **Both hold.**

      Three rows into the existing file, no new file and no new rule: two
      should-trigger (*"build the scroll-driven story section for the launch page"*,
      *"make the hero pin and scrub through three beats as you scroll"*) and one
      should-NOT-trigger.

      **The should-not row is the one that earns its place.** *"the scroll position resets
      when I navigate back — fix the restoration bug"* is a state/restoration defect and
      belongs to the `frontend-engineer` lens, not to design. Without it, the word
      `scroll` alone would route every scroll bug to a design skill — the over-broad
      trigger this repo's own routing discipline keeps catching. The file's `description`
      records that reasoning inline, so a later editor cannot read the row as noise and
      delete it.

- [x] **9.6 Anti-generic art direction is one slop row plus one corpus row.**
      One row in `src/scripts/design_slop_rules.ts` on the `copy` engine — the
      engine `slop-cp1-em-dash` and `slop-cp2-buzzword` already use — because a
      CSS engine cannot see subject matter: the detectable surface is the brief's
      own wording, never the render. Plus one guidance row in
      `src/skills/design-intelligence/data/stacks/threejs.csv` under an existing
      `Category` value. `slop-c3-dark-glow` (`:549`) already covers the CSS
      neon-glow tell and is not duplicated. This is never a rule.
      verify (discharged): `grep -c 'id: "slop-' src/scripts/design_slop_rules.ts` → **25**,
      exactly one higher than the pre-state **24**. `wc -l` on `threejs.csv` → **55**.
      `ls src/rules | wc -l` → **120, unchanged** — this is never a rule. **All three hold.**

      **`slop-cp6-generic-art-direction`, on the `copy` engine**, and the reason is in the
      code comment: a CSS engine cannot see subject matter — `transform: translateZ()`
      looks identical whether it moves a product or a glowing orb. The detectable surface
      is the brief's own wording, never the render. A test asserts the rule is on `copy`
      and **not** on `css`, so the engine choice cannot drift.

      Mechanism is `STOCK_RENDER_SUBJECTS`, a phrase list beside `BUZZWORDS` — the same
      mechanism CP2 already ships **backed**, applied to art direction instead of prose,
      with the same delete-test: swap the phrase for what the product actually shows and
      the brief says more. `slop-c3-dark-glow` (`:549`) covers the CSS neon-glow tell and
      is not duplicated.

      **A parity invariant the step does not mention had to be paid.**
      `lint_design_antipattern_parity` requires every registry `catalogId` to have a
      catalog entry **and** a detector-status row in
      `docs/guidelines/design-antipatterns.md`. Adding the rule alone would have reddened
      it. CP6 now has both rows; the gate reports **46 entries classified, 25
      detector-backed** (was 45/24). `check_depth_budget` still reports **4 violations at
      baseline** — `design-antipatterns.md` was already over the ceiling, so the count did
      not move and no fifth file appeared.

      **Sabotage-proven:** forcing the detector to return an empty hit list takes **2**
      assertions red. Restored, 5/5. Two of the five are near-misses that must stay
      silent: a brief naming a real subject (*"the assembled chassis rotates, one component
      highlighted per beat"*) and a technique-only brief (*"WebGL with instanced meshes"*)
      — because naming WebGL is not the defect, **defaulting the subject** is.

      One limitation is documented rather than hidden: the rule fires on prose that
      *argues against* the pattern, since the phrase is present either way. The test
      asserts that behaviour explicitly instead of pretending it does not happen.

      **A `wc -l` trap, recorded:** the first version of the corpus row used multi-line
      `Code Good` / `Code Bad` cells. Valid CSV, 54 data rows — and `wc -l` reported **57**,
      failing a verify that counts physical lines. The row was rewritten single-line.

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

  **Probed 2026-08-23, and the probe is why (a) is closed rather than merely
  unattractive.** The council decision predates the probe; execution evidence now
  confirms it. `command -v` finds no browser on `PATH`, no MCP server is declared
  (`agent-config mcp:available` → `declared servers: none`), and the one candidate that
  looked like a primitive is not one: the `playwright` library **does** resolve in this
  tree, and launching chromium fails with *"Executable doesn't exist at
  …/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"*.
  Library present, **no browser binary installed** →
  `not-available: headless-browser-binary`.

  This is recorded rather than resolved by `npx playwright install` on purpose. Installing
  a browser binary would make the fixture harness depend on a host capability nobody in
  this tree controls — the exact cost the § Recommendation above prices — and
  `missing-tool-handling` forbids installing a missing tool silently. The honest state is
  a named unavailable capability, not a downloaded one.

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

- [x] AC-1 — A greyscale handover no longer resolves to a pixel mandate, and a
      finished comp still does. Both directions are pinned by a committed
      fixture pair whose near-miss was authored first.
      **Met.** `daf-wireframe-not-pixel` routes to a structure mandate and `daf-wireframe-near-miss` still routes strictly; the near-miss was authored first and its baseline recorded as PASS-vacuously (0.1). `design_fidelity_routing.test.ts` → 29/29, and softening the artefact-not-prose clause takes it red.

- [x] AC-2 — At least one fidelity dimension is decided by a number a gate
      reads, and that number opens a polish round through the mechanism that
      already exists rather than a new one beside it.
      **Met.** `token-literal` is decided by a detector, not by judgement: the seeded fixture emits 2 findings and its paired clean fixture 0. The number opens exactly one polish round through `polish.ts:94-100`, and the same findings marked `artifact_covered: true` open zero via `partition_artifact_covered` at `:142`. `polish.ts` is byte-identical to HEAD — no mechanism was added beside the existing one.

- [x] AC-3 — Every dimension named in the Phase 2 schema is either shipped with
      a measurement or recorded as a null naming the pre-registered falsifier
      that fired. The two sets together account for the whole schema.
      **Met, and checked by script rather than by eye.** The Phase 2 schema accounts for 4 dimensions; 2 shipped with measured rows (`token-literal`, `viewport-floor`) + 2 recorded nulls (`render-diff` → `F0-uncapturable`, `reduced-motion-alternative` → `F2-inert`) = 4. Each null names its pre-registered falsifier and enumerates the claims it covers (A4/A9/A10/A11 and A12). `ajv` validates the sheet, and two deliberate corruptions are rejected.

- [x] AC-4 — The strict mode table in `src/rules/design-fidelity.md` is
      byte-for-byte what it is at HEAD, and no `daf-*` fixture that existed
      before this roadmap had its expected verdict edited.
      **Met, in the strongest available form.** `diff` of `src/rules/design-fidelity.md` against `git show origin/main:` is **empty — the whole file is byte-identical**, so the strict mode table is too. No pre-existing `daf-*` id disappeared (`comm -23` empty, 50 → 52 with two additions) and `git diff --stat` over the fixture expectations is empty.

- [x] AC-5 — The ad-hoc path carries a stated round ceiling and a stated stop
      condition in the same paragraph, so a single-pass review is a choice
      rather than the only available shape.
      **Met.** `fe-design` step 5 states a ceiling of **2** and a stop-on-null condition **in the same paragraph** — asserted mechanically by splitting the skill on blank lines and requiring the block containing `at most **2 rounds**` to contain `no new finding`. A fixture pair scores both outcomes through `polish.run`; moving the stop condition out of the paragraph takes the assertion red.

- [x] AC-6 — The 320 px floor is either measured or withdrawn. An asserted-only
      floor remains in neither skill.
      **Met, by measurement rather than withdrawal.** `src/skills/design-review/SKILL.md` Phase 2 now tests four viewports including `| Floor | 320px |`, so the floor `fe-design:88,213` asserts is in the set a reviewer is told to test. Neither skill carries an asserted-only floor. What still needs a page — whether a given surface passes at 320px — is a recorded null under `b-page-capture-primitive`, not an assertion.

- [x] AC-7 — Rendered visual quality has exactly one named owner, or the
      absence of one is recorded as a deliberate null with its reason.
      **Met as a deliberate null.** No persona owns rendered visual quality: `frontend-engineer.md:60` declines it for state/render correctness, `design-director.md:16` for brand art direction. The skill layer (`design-review`, `accessibility-auditor`) is the only owner. Recorded with its reason and a reopening condition in the Phase 1 artefact § Phase 8 null; the persona count is unchanged at 30 and `skill_linter --all` is 446/0/0.

- [x] AC-8 — Scroll-driven narrative work has a beat/style schema and a
      machine-readable scroll evidence artefact that the existing `design-review`
      flow reads, with no new skill, no new verifier and no new rule added to
      carry them.
      **Met.** The beat/style schema lives under `src/skills/wireframe/references/`, the scroll evidence artefact extends the file `design-review` already loads, and `design-review` Phase 2 reads it with a stated disagreement rule and a stated null rule. Counts unchanged: **294** skills, **120** rules, **2** files in `design-review/references/`, **1** in `fe-design/evals/`. No new skill, no new verifier, no new rule.

- [x] AC-9 — Renderer selection is a row in the `fe-design` mode table and
      `fe-design` is still the owner of the ad-hoc UI write. No second frontend
      executor exists.
      **Met.** Renderer selection is the third row of the `fe-design` mode table, and the row itself says **"still you"** — grounded via `search_stack`, which already exists. A sentence below the table states the same in the other direction: a renderer changes what you ground against, never who writes the UI. `fe-design` remains the owner and no second frontend executor exists.

