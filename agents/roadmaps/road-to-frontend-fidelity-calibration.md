---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
---
# Road to frontend fidelity calibration

> **Source:** `agents/tmp.old/improve-frontend` — a four-version external
> critique of this suite's frontend surface. The final version is a strict
> superset of the earlier three and is what this roadmap is built from. Every
> `file:line` below was re-verified against HEAD on 2026-08-22; the source
> pinned a v14.6.0 tree and several of its line numbers had drifted.

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

- [ ] **0.1 Write the near-miss fixture first.** Add `daf-wireframe-not-pixel`
      to the `daf-*` set: a greyscale wireframe handover that must NOT be
      routed as a 1:1 spec, paired with the near-miss that must stay silent —
      a finished comp handed over with the word "wireframe" in the prose, which
      must still route strictly. Neither fixture may be authored after the
      behaviour it scores.
      verify: `grep -rho "daf-wireframe-not-pixel" tests src docs | sort -u`
      returns the id, and `git show HEAD:src/rules/design-fidelity.md | grep -c
      'wireframe'` still reports the pre-state trigger count.
- [ ] **0.2 State the two axes in the rule.** `design-fidelity.md` gains a
      maturity discriminator: a handover whose own artefact declares itself
      low-fidelity carries a **structure** mandate, never a **pixel** mandate,
      regardless of `design.fidelity_mode`. Cite the outbound rule that already
      knows this (`src/skills/wireframe/SKILL.md:109-111`) rather than
      re-deriving it.
      verify: `./scripts-run src/scripts/check_references` is green and
      `grep -n 'wireframe' src/rules/design-fidelity.md` shows the trigger
      accompanied by the discriminator, not standing alone.
- [ ] **0.3 Pin the near-miss in the routing matrix.**
      `tests/scripts/design_fidelity_routing.test.ts` gains both rows — the
      wireframe class that must route to structure, and the near-miss that must
      still route strictly. The rule's own § Routing already requires a
      near-miss row per new trigger class; this pays it.
      verify: `npx vitest run tests/scripts/design_fidelity_routing.test.ts`
      passes with both new rows present.

## Phase 1 — Inventory what is measured versus what is asserted

- [ ] **1.1 Enumerate every fidelity assertion in the frontend surface.**
      One table: the claim, its `file:line`, and whether anything downstream can
      falsify it. The three known rows (320 px floor, visual diff, token
      violation) are the seed, not the answer.
      verify: the artefact exists under `agents/evidence/analysis/` and every
      row's `file:line` resolves — `while read f l; do sed -n "${l}p" "$f"; done`
      over the table produces no empty line.
- [ ] **1.2 Classify each row: measurable, measurable-but-blocked, or
      unmeasurable.** "Blocked" must name the blocker id below.
      Unmeasurable rows are the roadmap's own scope cut and are recorded as
      such, not carried.
      verify: every row carries one of the three labels and every `blocked` row
      names a `### blocker:` slug that exists in this file.

## Phase 2 — A fidelity contract with per-value provenance

- [ ] **2.1 Define the measurement sheet schema.** A per-element artefact:
      selector, dimension, expected value, observed value, source of the
      expectation. It is the artefact W3 says does not exist.
      verify: the schema file exists and
      `npx tsx -e "JSON.parse(require('fs').readFileSync('<path>','utf8'))"`
      parses, or the equivalent for the chosen format.
- [ ] **2.2 Extend the existing precedence chain with value-level
      provenance.** `docs/guidelines/design-fidelity-mechanics.md:232` already
      carries the finding-level flag; add the value-level field beside it and
      say plainly that the coarse flag stays the default. Do not restate the
      chain at `:181-241` — link it.
      verify: `git show HEAD:docs/guidelines/design-fidelity-mechanics.md |
      grep -c 'partition_artifact_covered'` shows the pre-state, and the new
      text adds a section rather than editing that block.
- [ ] **2.3 Pre-register the falsifiers, before any measurement ships.** For
      each dimension Phase 3 will measure, write down now what result would
      make it worthless — a number that varies across two runs on identical
      input, a number no finding can be derived from, a number that disagrees
      with the agent verdict more often than it agrees. A dimension whose
      falsifier fires is cut in Phase 3, not defended.
      verify: the falsifier list is committed and dated before the first
      Phase 3 step is checked off — `git log --diff-filter=A --format=%H -1
      -- <falsifier-path>` predates the Phase 3 commits.

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

- [ ] **8.1 Decide where the lens lives.** `frontend-engineer.md:60` declines
      it deliberately and that line stays. Either an existing persona takes the
      rendered-visual lens explicitly, or the roadmap records that no persona
      does and the skill layer is the only owner.
      verify: `grep -rn 'render' src/agent-src/personas/*.md` shows the lens
      claimed in exactly one file, or the Phase 1 artefact records the null.
- [ ] **8.2 Do not create a persona to hold one lens.**
      `src/rules/persona-governance.md`'s per-domain cap governs; a new
      specialist requires a deprecation candidate when the domain is full.
      verify: `./scripts-run src/scripts/skill_linter` is green and the persona
      count is unchanged, or the deprecation candidate is named in this file.

## Blockers

### blocker: b-page-capture-primitive

- **Status:** open
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

### blocker: b-detector-license-verification

- **Status:** open
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The measurement is a number nobody can act on | implementation | A detector ships, emits findings, and no gate or round is derived from them — the same shape as `token_violation` being consumed with no producer, inverted | Phase 5 requires the number to open a round through the path that already exists; a dimension that cannot is cut in 3.3 | Phase 5 — The improvement gate |
| 2 | The strict path is softened while nobody is looking | implementation | Adding a maturity axis is one edit away from weakening the 1:1 mandate the rule exists to carry | Phase 4 proves preservation by diff against `git show HEAD:`, not by argument, and re-scores all 45 existing `daf-*` fixtures | Phase 4 — The preservation gate |
| 3 | Every interesting dimension turns out to need a rendered page | implementation | The blocker below already gates one fixture class; if it gates all of them the roadmap has a contract and no measurement | Phase 1 classifies each row as measurable / blocked / unmeasurable before any detector is written, so the shape is known at Phase 1 rather than Phase 3 | Phase 1 — Inventory what is measured versus what is asserted |
| 4 | The wireframe discriminator over-fires | product | A maturity axis read too eagerly downgrades a finished comp to a structure mandate, which is a fidelity regression wearing a fix's clothes | The near-miss fixture is authored before the behaviour (0.1) and pinned in the routing matrix (0.3); the rule's own § Routing already requires this | Phase 0 — Separate artefact maturity from artefact mandate |
| 5 | Value-level provenance restates the chain that already ships | implementation | Duplicating `design-fidelity-mechanics.md:181-241` splits one contract across two places and they drift | 2.2 adds a section beside the existing block and links it; the verify asserts the pre-state block is untouched | Phase 2 — A fidelity contract with per-value provenance |

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
