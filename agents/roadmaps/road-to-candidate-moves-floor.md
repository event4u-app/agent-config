---
complexity: lightweight
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-limited-commitment-horizon
    relation: disjoint
    note: >
      That roadmap owns how far a chosen candidate may be executed before the
      next observation. This one owns whether a second candidate was ever
      generated. A run can generate three candidates and then execute a
      twelve-step plan on the winner without re-reading the position, and a run
      can commit narrowly to a form it never compared. Neither failure implies
      the other, and neither fix moves the other's measurement.
estate_offset_exempt: "Offsets nothing, and the two nearest candidates were checked. `road-to-frontier-grade-reasoning` is archived with its Phase 7 eval `[~]`-deferred as billable; reopening an archived roadmap to carry a new obligation would hide this work inside a closed record and re-open a risk register that was signed off. `road-to-the-reasoning-surface-that-is-wired` owns four wiring defects on one skill and its corpus — this owns one missing step in the Plan chain, measured on the same corpus, which is adjacency of substrate and not of question."
estate_growth_exempt: "Growth is one active roadmap for a defect reproduced at HEAD 2c75232fe in six files, none of which any active roadmap, later roadmap or stub names. The measurement that decides whether the obligation survives costs 32 API calls (~$0.84, dry-run measured) and its baseline half costs nothing, so the roadmap is sized to end in a keep-or-delete verdict rather than to accumulate. Re-stated 2026-09-08 to cover open_blockers +2, which is the honest cost of executing this roadmap rather than an accumulation: `sixth-line-shipping-blocked` records that two councils independently shut the shipping gate (2026-09-07 split, and 2026-09-08 after step 2.0 measured zero qualifying emissions of all five existing mandated lines), and `prohibition-step-has-no-closing-glyph` records that step 3.4's content is a prohibition, which no `verify:` command can close. Both are owner-reserved dispositions this autonomous run may not take, and suppressing either to keep the metric flat would launder an unfinished decision — the failure the ratchet exists to catch."
---
# Road to the candidate-moves floor

> **Source:** `agents/tmp.old/inbox-2026-09-v/` — a five-artifact round (two
> external proposal roadmaps, two of their own consolidations, one review and
> one self-critique) on a single defect, re-verified against HEAD rather than
> inherited. The round's own strongest finding is that its parents planned
> five things this tree already has.

## Goal

The Plan step generates more than one solution form before choosing one, at
the decision classes where a choice actually exists, and the tree can say from
its own measurement whether that changed anything. When this is finished
either the obligation is backed by a published baseline-versus-treatment
reading on the existing 16-slot corpus, or it is deleted and the reading is
what remains.

## Context

The defect is not that the agent thinks too little. It is that the thinking
starts after the form is fixed. Six places in the tree at HEAD confirm it:

- `src/skills/reasoning-orchestrator/SKILL.md:77` — link 2 is `intent — state
  the inferred goal + one recommendation`. The chain
  (`:108`) runs `ground → intent → notes → resolve-hardest-first → audit →
  verify`; nothing between grounding and the single recommendation generates a
  second form. Links 3–6 then verify the one that was picked.
- `src/agent-src/contexts/communication/rules-auto/think-before-action-mechanics.md:18`
  — `**Plan** — Decide what to change`. Singular, and it is the step the
  whole coding path routes through.
- `src/agent-src/contexts/execution/autonomy-mechanics.md` § Retry-budget
  escalation ladder — the first re-think is bound to a *failed attempt*. Before
  move one there is no trigger at all.
- `src/skills/sequential-thinking/SKILL.md:4` — `explicit request only, never
  for regular coding tasks, and at most once per task`; its branch section
  (`:101`) fires once approaches already `seem viable`, which is after the
  choice was noticed.
- `src/skills/decision-record/SKILL.md:4` — `Use when choosing between
  alternatives`. Same precondition, one artifact later.
- `src/rules/notes-first-reasoning.md:50-59` — `## In-Task Hypothesis Log`,
  `## Killed beliefs`, `## Decisions` (`decision · alternatives · reason ·
  revisit-if`). Every slot is post-conditional: `alternatives` records the ones
  that were generated and does not cause any.

`src/skills/feature-planning/SKILL.md:111-117` is the exception and the reason
this roadmap is small. Phase 4 already says `Design 2-3 implementation
approaches with different tradeoffs`, already names the axes
(Minimal / Clean / Pragmatic), and already asks for a comparison. It cannot be
lifted into the Plan step unchanged, because `:117` ends
`**Ask the user which approach to use**` — a mandatory question at every form
choice is the stop-and-ask surface this suite is trying to shrink, not grow.
So the floor is Phase 4's *generation* without Phase 4's *gate*, and that
variant is the one the round's own self-critique names as never having been
played.

## Prerequisites

- `tests/reasoning-layer-eval/` — the corpus, the rubric and the runner all
  exist. 16 L6N slots, `rubric.md` with five dimensions (four until 1.2), published metric bars
  (trigger ≥ 60 %, rubric mean ≥ 70 %, treatment − baseline ≥ +15 pp standard
  host / ≥ 0 strong host).
- `src/scripts/rdp_quality_eval.ts` — reproduced dry-run at HEAD: `--mode l6`
  over `l6-corpus.json` is 16 slots × 2 variants = 32 calls, ~$0.84 worst case.
  `--score-with <model>` already supplies the independent rater.
- `tests/reasoning-layer-eval/golden-transcripts/l6n-results.json` — 32
  complete transcripts from 2026-06-22, 866–5995 chars each, all `standard`
  band. This is the free half of the measurement.

## Phase 1 — Take the calendar and the free baseline

- [x] **1.1 Extend the RDP beta window before it errors.**
      `docs/contracts/reasoning-discipline-protocol.md` carries
      `keep-beta-until: 2026-09-14`. `check_beta_review_markers` reports it as
      `[fresh]`, i.e. absent from the frozen 2026-08-25 baseline, so on that
      date it becomes an error rather than an inherited warning. Extend it with
      the reason being this roadmap's Phase 3 verdict, or promote it — either
      is a one-line edit; leaving it is the only wrong answer.
      verify: `./scripts-run src/scripts/check_beta_review_markers` no longer
      lists `reasoning-discipline-protocol.md` under upcoming fresh lapses.
- [x] **1.2 Split the rubric dimension that cannot see this defect.**
      `tests/reasoning-layer-eval/rubric.md:33-35` dim 3
      `Premature-solution avoidance` anchors on
      `0 = built easy parts first, reworked later` — it scores sequencing
      *inside* a chosen form. Add dim 5, `Form-alternative surfacing`: was a
      materially different form generated and discriminated before the choice,
      scored 0–3, with `0` = one form only and `3` = a second form named on a
      stated axis with the observation that decided between them. Dim 3 keeps
      its own anchors unchanged.
      verify: `rubric.md` lists five dimensions and its scoring sheet has a
      `dim5` column.
- [x] **1.3 Score the baseline off the stored transcripts, at zero spend.**
      The 32 transcripts in `l6n-results.json` predate every change in this
      roadmap, so they *are* the baseline arm for dim 5. Score them on dim 5
      only, with `rdp_quality_eval --score-with` for the rater, and publish the
      rate in `tests/reasoning-layer-eval/RESULTS-candidates-baseline-<date>.md`.
      verify: the results file exists, names the rater model, and reports a
      dim-5 rate per slot with zero API calls attributable to capture.
      Done 2026-09-07 — `tests/reasoning-layer-eval/RESULTS-candidates-baseline-2026-09-07.md`,
      rater `claude-sonnet-4-5`, 32 transcripts, **0 capture calls** (~$0.336 of
      rater spend), 0 unparsable replies. **dim5 mean 0.875/3 (29.2 %); 18 of 32
      score `0`, i.e. one form only.** The reading needed a new `--score-only`
      mode on `rdp_quality_eval`: the tool could capture-and-score but not score
      what already existed, and re-capturing would have produced a different
      corpus rather than this one's baseline. That mode inherits the capture
      path's non-tty billing guard verbatim rather than becoming an unguarded
      way to bill the same account.
      The finding worth carrying into Phase 3: dim1 scores `3` on 29 of 32 and
      dim3 on 27 of 32 while dim5 sits at 29 %. If dim 3 could see this defect
      the two could not diverge like that — the roadmap's premise is now
      measured rather than argued.
- [x] **1.4 Record what the stored corpus cannot answer.**
      All 32 transcripts are `band: standard`. The published bar includes
      `no regression (≥ 0) on a strong-reasoning host`, and no strong-band
      transcript exists — so that half is unmeasured and stays unmeasured until
      someone pays for a strong-band capture run. State it in the results file
      rather than letting a standard-band-only reading stand in for both.
      verify: the results file carries the limitation in one sentence naming
      the missing band.
      Done 2026-09-07 — the results file's § What this corpus cannot answer
      states it in bold and names the band: all 32 transcripts are
      `band: standard`, so the bar's "no regression (≥ 0) on a strong-reasoning
      host" half is unmeasured and stays so until a strong-band capture is paid
      for. Recorded there rather than here because the file is what a later
      reader of the delta opens, and the case that produced this roadmap was
      maintainer reasoning on a strong host — the exact band this reading does
      not cover.

## Phase 2 — The one artifact, owed by decision class and not by file count

> **RE-SCOPED 2026-09-07 by a split AI council. Read this before 2.1.**
>
> **The lock nobody in this roadmap noticed.** `mandated-lines.md` § Honest
> scope ends: *"That observation costs one counter and is **the first thing to
> look at before adding a sixth line.**"* The observation is the count of intent
> lines whose three slots **disagree** — the file's own test for whether a
> mandated line is decorating decisions already made. **That counter does not
> exist anywhere in the tree.** Step 2.1 adds the sixth line, so following this
> roadmap literally walks through a lock recorded in the very file it edits.
>
> **Council, 2 seats, SPLIT.**
> - Seat 1 → **(c) both**: the roadmap's measurement authorizes *this* line, and
>   the counter is still owed because it answers a different question — whether
>   the five EXISTING lines earn their place, which nothing here measures.
> - Seat 2 → **(a) the lock blocks**, on an argument this roadmap must record
>   because it is correct and it corrects the request that was put to them:
>   **the published baseline measures the DEFECT, not the EFFICACY of the fix.**
>   It was taken *before the line exists*. Calling it a direct measurement of
>   non-ceremony "conflates evidence of a problem with evidence that a
>   particular intervention solves it". The delete branch is real governance but
>   it operates *after* the prohibited addition, and a reversible violation of a
>   recorded ordering is still a violation of it.
>
> **A split escalates, and this run reaches no user, so the disposition is the
> intersection neither seat calls unauthorized** — the same rule
> `road-to-first-reference-analysis-observation` records for its own split. Seat
> 2 names that intersection itself: *"If such an experiment can be conducted
> without first making the line globally mandatory … That supports an
> experimental trial — not immediate adoption."* Seat 1 authorises proceeding
> outright and therefore authorises the narrower form a fortiori.
>
> **The disposition, binding on the steps below:**
>
> 1. **The counter is built first.** It is the lock's stated precondition and
>    both seats want it. It counts intent lines whose three slots disagree, and
>    what threshold means "ceremony" is read off its distribution — **not set in
>    advance**, which both seats flagged as the invented number in the request.
> 2. **`Candidates:` may be instructed to the model under test in the eval's
>    TREATMENT ARM**, where it can be measured without being a shipped
>    obligation on anyone.
> 3. **No sixth line ships in `mandated-lines.md` § The five lines, and
>    `lint_mandated_lines` gains no third obligation, in this phase.** That is
>    the "globally mandatory" step seat 2 blocks, and it is what Phase 3.3's
>    KEEP branch would authorise — as a further decision, not automatically.
> 4. **`direct-answers` Iron Law 3 is not suspended.** Both seats read six as at
>    or over the ceiling for the set; seat 2 named `Sibling search` as the most
>    plausible retirement candidate if a sixth ever does ship. Recorded, not
>    decided — retiring a line is its own change.
>
> Steps 2.1 and 2.4 are therefore **deferred, not descoped**: their content is
> unchanged and their gate moved behind Phase 3's reading. 2.2, 2.3, 2.5 and 2.6
> define the line's SHAPE and are executable now, because a shape the treatment
> arm instructs must exist before the treatment arm can instruct it.
>
> *Reopening:* the counter's distribution is read, or Phase 3.3 returns a KEEP
> verdict. Either reopens items 2 and 3 above on their own terms.
>
> Council record: `2026-09-07-sixth-mandated-line-lock.md` under
> `agents/runtime/council/responses/` — local-only (`agents/runtime/` is
> gitignored), so the substance is transcribed here rather than linked.

- [x] **2.0 Build the counter the lock asks for, and read it before 2.1.**
      Added 2026-09-07 by the split council above; it is the lock's own stated
      precondition and both seats want it. Count the emitted intent lines whose
      three slots **disagree** — `mandated-lines.md` § Honest scope defines
      disagreement as the finding that stops the edit, so a run where the three
      slots always agree is a run writing the line after deciding. The counter
      answers a question **nothing else in this roadmap measures**: whether the
      five EXISTING lines earn their place, as opposed to whether a sixth would.
      **No threshold is set in advance.** Both seats flagged the "≥ 80 % zero
      disagreement = ceremony" figure put to them as invented; what counts as
      ceremony is read off the distribution once one exists. Setting the number
      first is how a measurement gets its answer chosen for it.
      verify (AMENDED 2026-09-08): the counter exists, reports a population
      count over identified inspectable emission surfaces and — when the
      population is non-zero — a disagreement rate, and the roadmap records
      those findings, not a verdict derived from a number picked beforehand.
      *Original verify, kept visible rather than overwritten:* "the counter
      exists, reports a disagreement rate over a real population of emitted
      intent lines, and the roadmap records the rate". Amended because the
      population measured **zero**, so no rate exists to report; authority is
      the 2026-09-08 AI council, D2 = closed-with-amendment, 2 seats
      convergent, which required the original text stay legible so the
      criterion cannot read as having been met.
      Done 2026-09-08 — `src/scripts/count_intent_disagreement.ts`, 13 tests;
      reading published in
      `agents/evidence/analysis/mandated-line-emission-2026-09-08.md`.
      **18 labelled `Intent:` matches, 0 of them well-formed, rate undefined.**
      Of the 18: 5 are the contract's own `parseDate` blockquote example carried
      into a session's context, 13 are `Intent:` used as a prose heading with no
      `·`-separated slots. Not one is the three-slot artifact emitted at a
      decision point, so the lock's rate has no denominator. Surfaces: 4,917
      local transcript files (3,739 JSON/JSONL, string leaves decoded), 400
      merged PR bodies (0), full `git log --all` (0 — and not a normative
      surface anyway). No threshold was set in advance.
      **The first reading of this counter was wrong and the correction is
      recorded rather than quietly replaced.** It said `population 0`, because
      it imported the shipped `INTENT_RE`, which matches no markdown emphasis —
      so `**Intent:**` was invisible to it. The paid Phase 3 run proved the gap
      by emitting its one compliant line as `**Candidates:**` and being scored
      absent. A counter must be wider than the gate it reports on, or the null
      is self-confirming. Widening with an `i` flag then over-corrected to 172,
      almost all lowercase `intent:` YAML keys; the pattern is
      emphasis-tolerant and case-sensitive. The same blind spot in
      `lint_mandated_lines`' own `INTENT_RE` and `AUTHORIZATION_RE` is recorded
      as a finding, not fixed — that gate is adjacent to the blocked contract
      and widening what it accepts is its own change.
      The finding the lock did not anticipate: the null is **not specific to the
      intent line**. Across all five labels there are six labelled matches and
      at most one arguably well-formed line, and two `Authorization:` matches
      paraphrase instead of quoting — the
      documentation-is-not-authorization failure the contract denies outright.
      That is a carrier-reach defect, ruled out of scope for this roadmap but
      **shipment-gating** by the 2026-09-08 council (D3) — no efficacy reading
      may authorise a sixth line while the first five reach nothing.
- [ ] **2.1 Add the sixth mandated line.**
      <!-- blocked-by: sixth-line-shipping-blocked | asked: no — autonomous drain lane, no interactive user reachable this run -->

      `src/agent-src/contexts/execution/mandated-lines.md` carries five lines
      and the argument for why a line beats a clause. Add `Candidates:` on the
      same terms — emitted at the decision point, before the form-changing
      edit. Compact form, one line: the candidates with `K0` first, each with
      the axis it differs on, then the choice and the observation that decided
      it.
      verify: `./scripts-run src/scripts/lint_mandated_lines --stdin` reports a
      third obligation and a report owing `Candidates:` without it exits 2.
      DEFERRED 2026-09-07, not descoped — the content above is unchanged and its
      gate moved behind Phase 3's reading. This is the step the split council's
      seat 2 blocks: shipping the line into § The five lines and giving the
      linter a third obligation is what "globally mandatory" means, and the
      published baseline measures the DEFECT rather than the EFFICACY of the
      fix. Phase 3.3's KEEP branch is what authorises it, as a further decision
      and not automatically. The lock's counter is built first — see 2.0.
      `K0` is `keep the current form / change nothing`. It is owed wherever the
      line is owed, and it is dropped in exactly one case: the user prescribed
      the form, which is an authorization of that form rather than a choice the
      agent made. Without `K0` the candidate set still assumes that some edit
      is correct before any reasoning starts.
      verify: a fixture whose correct answer is "leave it" produces `K0` as the
      drawn candidate rather than as an unchosen first row.
- [x] **2.3 Bind the line to semantic decision classes.**
      A file count is the wrong trigger — a controller plus its test is two
      files and no architectural choice; a rename touches four and offers none.
      The line is owed at: a new ownership boundary · a new abstraction · a
      contract, schema, DTO or signature change · a state transition · a
      migration or rollout · new failure semantics · an irreversible action ·
      an unresolved root cause · a maintainer decision about roadmap, budget,
      ratchet or projection shape. It is not owed at: a typo · a format change
      · a pure rename · a user-prescribed form · a mechanical test update · a
      generated-code refresh · a one-line deterministic config change.
      verify: fixtures for two owed classes and two not-owed classes score
      correctly, and the not-owed pair stays silent.
      Done 2026-09-08 — `src/scripts/check_candidate_lines.ts`
      (`OWED_CLASS_TRIGGERS`, nine classes; `NOT_OWED_TRIGGERS`, seven),
      fixtures in `tests/scripts/check_candidate_lines.test.ts` § 2.3. Owed
      pair: a new ownership boundary and a contract change both report
      `missing-candidates`. Not-owed pair: a pure rename and a generated-code
      refresh both return `owed: false` with zero findings. The asymmetry is
      recorded in the source: an exemption suppresses **only** when no owed
      trigger fired, so a rename that also changes a signature is a contract
      change — fixture `an exemption never overrules a positive owed match`.
      The residual is stated there too: a report describing an abstraction
      change in pure-rename vocabulary owes nothing, and no lexical check
      fixes that.
      The checker is a **separate script and `lint_mandated_lines` is
      untouched** — `git diff origin/main` over that file and over
      `mandated-lines.md` is empty, which is the evidence that the 2026-09-07
      council's item 3 was honoured rather than merely promised.
- [ ] **2.4 Change the Plan step from a decision into a generation.**
      <!-- blocked-by: sixth-line-shipping-blocked | asked: no — autonomous drain lane, no interactive user reachable this run -->

      `think-before-action-mechanics.md:18` becomes: generate the forms
      (`K0` plus at least one material alternative), choose on a stated
      discriminator, then decide what not to change and how to verify. Bind
      the line at `src/rules/think-before-action.md` and extend its
      `workspaces` to cover maintainer work — the failure this round is about
      was maintainer reasoning, so a floor that skips that workspace skips the
      case.
      verify: `./scripts-run src/scripts/check_condensed_paths` and the
      projection regeneration both stay green after the edit.
- [x] **2.5 Require an axis, not a count.**
      Three candidates that differ only in where a helper lives are one
      candidate. Each non-`K0` candidate carries the axis it differs on, the
      tree fact it stands on, the observation that would decide it, and the
      condition that kills it. The check is that the axes are pairwise
      distinct — that is decidable from the line, unlike whether the thinking
      preceded it.
      verify: a fixture whose three candidates share an axis is reported as one
      material candidate.
      Done 2026-09-08 — `shared-axis` finding, whose message says "they count
      as ONE material candidate". Fixture: two candidates both carrying
      `[where the helper lives]` report `shared-axis` at content-word overlap
      1.0; the distinct pair (`[ownership boundary]` / `[call-site coupling]`)
      passes. A non-`K0` candidate with no bracket at all reports
      `missing-axis`. Threshold `AXIS_OVERLAP = 0.6` is a **stated default,
      not a measured optimum**, and the overlap is printed in the finding so a
      reader can recompute at another value.
- [x] **2.6 Do not generate a second form where there is only one.**
      After grounding, some requirements admit exactly one form — the
      framework fixes the extension point, an existing contract fixes the
      location. The obligation is to *check* whether a material alternative
      exists and to name it when it does, never to invent two so the line looks
      full. A single-candidate line stating the constraint that forecloses the
      alternatives satisfies the obligation.
      verify: a fixture with a genuinely forced form produces a one-candidate
      line naming the constraint, and is not reported as a violation.
      Done 2026-09-08 — a `[forced: <constraint>]` bracket makes a
      one-candidate line legal: `Candidates: K0 register in `register()`
      [forced: the base class fixes the extension point] → K0; no other
      location is admissible.` returns zero findings. The paired rejecting
      fixture is what gives the carve-out teeth: a bare single candidate with
      no constraint reports `single-candidate-unforced`, because otherwise
      "I only thought of one" and "exactly one is admissible" are the same
      line and the obligation to *check* evaporates.
      Step 2.1's `K0`-drawability half also lands here, since it is a property
      of the shape rather than of the shipped obligation: a fixture whose
      correct answer is "leave it" draws `→ K0` and passes with zero findings,
      and `--corpus` reports `K0 actually drawn` separately from `K0 present`
      so K0-as-an-unchosen-first-row is visible across a whole run rather than
      only per line. 2.1's shipping half stays blocked — see `## Blockers`.

## Phase 3 — Measure it, then keep it or delete it

- [x] **3.1 Run the treatment arm.**
      `rdp_quality_eval --mode l6 --corpus
      tests/reasoning-layer-eval/golden-transcripts/l6-corpus.json --confirm
      --score-with <model>` — 32 calls, ~$0.84 at the measured dry-run
      estimate, with the line active. Deterministic checks run before any
      scoring: line present at owed slots, `K0` present, axes pairwise
      distinct.
      verify: a results file exists carrying the three deterministic counts and
      the dim-5 score per slot.
      Done 2026-09-08 —
      `tests/reasoning-layer-eval/RESULTS-candidates-treatment-2026-09-08.md`,
      capture in `golden-transcripts/l6n-candidates-treatment.json`
      (`mode: l6+candidates`). **Actual spend $0.7933**, 32 capture + 32 rater
      calls, against a $1.2068 dry-run worst case. The line was instructed in
      the eval's system prompt only — `git diff origin/main` over
      `lint_mandated_lines.ts` and `mandated-lines.md` is empty.
      Deterministic counts, run before any scoring: 32 transcripts · line
      present **1** · `K0` present 1 · axes pairwise distinct 1 · `K0` drawn 0
      · shape findings 0. Baseline control with the same checker: 0 across the
      board. **Instruction delivery 100 % by construction, compliance 1/32
      (3.1 %).**
      The first reading of this step said `0` and was wrong: the checker had
      copied the shipped `INTENT_RE` shape, which matches no markdown emphasis,
      and the one compliant model wrote `**Candidates:**`. That line is now a
      regression fixture. See the results file § The detector correction.
- [x] **3.2 Publish the delta against Phase 1's baseline, and the cost.**
      Dim-5 treatment minus dim-5 baseline on the same 16 slots, plus the
      token-overhead delta on the single-step (`ss`) slots, which are the
      trivial-task proxy this corpus has.
      verify: both numbers are in the results file, computed from the two
      stored runs rather than asserted.
      Done 2026-09-08 — `src/scripts/rdp_candidates_delta.ts`, 8 tests, joins
      the two stored runs on slot plus variant and exits 2 on a join hole
      rather than computing a delta over a partial join. 32 of 32 paired.
      **dim 5, intention-to-treat: 0.875 → 1.156 / 3, delta +0.281
      (+9.4 pp of the 0-3 scale).** One-form-only transcripts 18/32 → 14/32;
      `>= 2` 8/32 → 11/32; `ms` +0.187, `ss` +0.375. ITT is primary on the
      2026-09-08 council's instruction — conditioning on compliance selects on
      post-treatment behaviour; the compliant-only figure is 3.000 at n=1 and
      carries no weight.
      **`ss` output-token overhead: -8.0 % token-weighted (8,542 → 7,858),
      -8.1 % mean per-slot.** Output got *shorter*, so the published ~5 % L10
      cost guard passes with margin. This is treatment-versus-baseline, which
      no stored field holds — the `output_token_overhead_pct` in each run is
      arm-versus-arm within that run.
      **dim 1 tripwire: 2.906 → 3.000, +0.094.** It did not fire.
      The bar's unit is recorded both ways rather than picked, because the two
      source documents disagree: +9.4 pp of the 0-3 scale against `README.md`'s
      `+15 %` / the roadmap's `+15 pp`, versus +32.1 % as a relative change on
      the baseline mean. The verdict rests on the conservative reading.
- [x] **3.3 Apply the verdict, including the one that deletes the work.**
      Keep the line if dim 5 moves and the `ss` overhead stays under the
      published cost guard. Delete it if dim 5 does not move — in which case
      the two results files are the deliverable and Phase 2 is reverted. A
      third outcome is real and must be named rather than rounded: dim 5 moves
      and dim 1 (notes-first adherence) drops, which means the line is being
      emitted into the reply instead of the notes.
      verify: the roadmap closes with one of the three verdicts written into
      the results file, naming the readings it rests on.
      Done 2026-09-08 — **a fourth outcome**, written into
      `RESULTS-candidates-treatment-2026-09-08.md` § Step 3.3: *"Treatment
      signal observed; line validation failed. Retain the evaluation artifacts
      and the block for research. Promote neither the line nor the prose."*
      Decided by a 2-seat council (3 rounds, depth deep, quorum 2/2, $0.0000 —
      subscription transport), convergent on all four questions. The step's own
      three verdicts are recorded as inapplicable rather than one of them
      forced: KEEP is what the literal rule selects and is wrong because it
      would assert the *artifact* earned the gain at 1/32 compliance; DELETE
      misdescribes a dim 5 that did move; the third outcome did not occur
      because dim 1 rose.
      The arithmetic that settles attribution, verified from the two stored
      runs: the delta is **exactly 9 rubric points** (sum 28 → 37), the one
      compliant transcript moved 0 → 3, so **3 of 9 points came from the
      compliant line and 6 from transcripts carrying no line at all.** Per-cell
      movement is churn — 10 improved (+20 gross), 7 regressed (-11 gross), 15
      unchanged — which against a bimodal baseline and a single rater is a
      replication risk rather than a caveat.
      Dissent recorded in the results file: the narrower of the two negative
      claims is the one published ("not reliably produced in this setup", not
      "the form is falsified"), and one seat's dismissal of the
      historical-control confound rested on a false premise — the arms are 78
      days apart (`2026-06-22` vs `2026-09-08`), not the same date.
      `CANDIDATES_BLOCK` stays eval-only. Nothing is promoted; the +9.4 pp is a
      directional observation, not a result.
- [ ] **3.4 Do not build the enforcement.** <!-- deferred: gated on 3.3 and on a capture bar this tree has not met -->
      <!-- blocked-by: prohibition-step-has-no-closing-glyph | asked: no — autonomous drain lane, no interactive user reachable this run -->
      No blocking hook, in either direction of the verdict. A hook that decides
      candidates are missing while the host handled them internally is the
      stop-and-ask behaviour this floor exists to avoid, and the last
      trajectory-capture measurement in this tree came in under its own bar. An
      observation-only counter is the most this may become, and only after 3.3.

## Blockers

### blocker: sixth-line-shipping-blocked
- **Status:** open            <!-- open | resolved -->
- **Owner:** user             <!-- user | maintainer | external -->
- **Blocks:** Phase 2 — The one artifact, owed by decision class and not by file count
- **Question:** may the sixth mandated line ship into the contract and gain a
  linter obligation, given that the first five lines reach nothing?
- **Recommendation:** no, not yet. Two independent gates are shut. The
  2026-09-07 split council blocked shipping in this phase and named Phase 3.3's
  KEEP branch as the only thing that authorises it, *as a further decision and
  not automatically*. The 2026-09-08 council then added a second, harder gate:
  step 2.0 measured zero qualifying emissions of **all five** existing lines, so
  no efficacy result may authorise a sixth while the carrier reaches nothing.
  Both councils are recorded; neither can be discharged by this run.
- **If you do nothing:** steps 2.1 and 2.4 stay open and AC-4 stays
  unsatisfiable, so the roadmap cannot archive. Nothing degrades — the shape,
  the baseline and the treatment reading are all landed and independently
  useful. The cost of the non-decision is that the measurement sits unapplied.
- **What to do:**
  1. Read `agents/evidence/analysis/mandated-line-emission-2026-09-08.md` — the
     carrier null and its surface map.
  2. Read Phase 3's verdict in
     `tests/reasoning-layer-eval/RESULTS-candidates-treatment-2026-09-08.md`.
  3. Decide one of: authorise a scoped carrier-reach investigation (the gate
     that must clear first either way); authorise shipping 2.1 and 2.4 and
     amend AC-4; or record the sixth line as abandoned and close AC-4 by
     amendment.
- **Resolved when:** the owner records one of those three dispositions, and
  either 2.1/2.4 land or AC-4 is amended to match the chosen outcome.

### blocker: prohibition-step-has-no-closing-glyph
- **Status:** open            <!-- open | resolved -->
- **Owner:** user             <!-- user | maintainer | external -->
- **Blocks:** Phase 3 — Measure it, then keep it or delete it
- **Question:** how does a step whose content is a **prohibition** close, when
  no `verify:` command can go green on a non-action?
- **Recommendation:** leave 3.4 `[ ]` and decide the semantics once, for every
  roadmap. `[~]` would oblige a receiver roadmap that this work does not
  justify, and `[-]` is cancellation and owner-reserved — neither describes
  "the prohibition was honoured".
- **If you do nothing:** 3.4 stays open and the roadmap does not archive. The
  prohibition itself is honoured either way: no hook, counter or gate was built
  in this run, in either direction of the verdict.
- **What to do:**
  1. Confirm the prohibition held — `git diff origin/main --stat` shows no hook
     under `src/scripts/hooks/` and no new entry in `hook_manifest.yaml`.
  2. Either close 3.4 by fiat with a one-line note, or record a general
     convention for prohibition-shaped steps in the roadmap template.
- **Resolved when:** 3.4 carries a disposition the archival sweep accepts.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-07 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The line becomes a costume | product | A candidate line with an axis and a discriminator is reconstructable in ten seconds after the choice. No check can see the order, and the tree's own mandated-line contract says so. The failure is silent: the reply looks compliant and the reasoning did not change | Dim 5 scores whether the alternative is *material*, not whether the line is present; the axis-distinctness check kills the cosmetic set; 3.3's delete verdict is a real branch, not a formality | Phase 3 — Measure it, then keep it or delete it |
| 2 | The evidence for the mechanism is a transfer | implementation | `mandated-lines.md:21-27` measured 0/4 → 4/4 for a **different** obligation, at N=4, from an external source. That a candidates line behaves the same way is a same-mechanism-class prior, not a result. Treating it as a foundation is how the whole roadmap ends up resting on four runs | Phase 1's baseline and Phase 3's treatment measure this obligation on this corpus; the prior only justifies trying it, never keeping it | Phase 1 — Take the calendar and the free baseline |
| 3 | The floor turns into an interview | product | Every generated choice invites an ask, and `feature-planning:117` shows the shape it takes. A floor that asks at each form choice makes routine development worse than no floor | 2.3's not-owed classes; 2.6's forced-form case; the discriminator is an *observation* the agent takes, and the user is reached only when the deciding fact is genuinely theirs | Phase 2 — The one artifact, owed by decision class and not by file count |
| 4 | The reply grows a process framework | product | `Intent:` `Authorization:` `Pending:` `Sibling:` `Commit:` and now `Candidates:` — six mandated lines read as ceremony, and the suite's own value is that it reads like a good engineer | The compact one-line form; dim 1 as the tripwire in 3.3; the line is scoped as a bootstrap and measurement device, so its removal from the user-facing reply is a later step and not a reversal | Phase 3 — Measure it, then keep it or delete it |
| 5 | The strong-host half stays dark | implementation | The published bar wants no regression on a strong-reasoning host and the stored corpus has no strong-band transcript. A standard-band-only reading can pass while the case that produced this round — maintainer work on a strong host — is unmeasured | 1.4 states the gap in the results file; the verdict in 3.3 is scoped to the band it measured and claims nothing about the other | Phase 1 — Take the calendar and the free baseline |

## Acceptance Criteria

- [x] AC-1 — `docs/contracts/reasoning-discipline-protocol.md` no longer
      appears in `check_beta_review_markers`' upcoming-fresh-lapse list, and
      the edit that removed it names a reason.
      Verified 2026-09-08 — the gate's upcoming-fresh list names
      `release-sizing`, `harness-expectations`, `install-layout`,
      `install-scopes` and `surface-tiers`, and not this contract.
      `docs/contracts/reasoning-discipline-protocol.md:3` reads
      `keep-beta-until: 2026-12-06` and `:6` carries the reason inline.
- [x] AC-2 — `tests/reasoning-layer-eval/rubric.md` carries a fifth dimension
      that scores form-alternative surfacing, with anchors that a run
      generating one form cannot score above 0 on.
      Verified 2026-09-08 — five numbered dimensions; `rubric.md:39-63` is
      `Form-alternative surfacing` with all four anchors, `0` reading "one form
      only … no amount of good execution raises it"; the scoring sheet at `:80`
      carries the `dim5 form-alt` column.
- [x] AC-3 — A baseline results file reports a dim-5 rate over the 32 stored
      transcripts, names its rater, and states that the strong-reasoning band
      is absent from the corpus.
      Verified 2026-09-08 — `RESULTS-candidates-baseline-2026-09-07.md`:
      rater `claude-sonnet-4-5` (`:22`), dim5 mean 0.875/3 = 29.2 % over 32
      transcripts (`:33`), and § What this corpus cannot answer (`:72-83`)
      states in bold that all 32 carry `band: standard` so the strong-host half
      of the bar is unmeasured.
- [ ] AC-4 — `lint_mandated_lines` reports a third obligation, and a report
      owing `Candidates:` without one exits non-zero while a not-owed report
      stays silent.
- [x] AC-5 — A treatment results file reports the three deterministic counts,
      the dim-5 delta against AC-3's baseline, and the token-overhead delta on
      the single-step slots.
      Verified 2026-09-08 — `RESULTS-candidates-treatment-2026-09-08.md` § 3.1
      carries the three counts with a baseline control column, § 3.2 the dim-5
      ITT delta (+0.281 / +9.4 pp) against AC-3's file, and the `ss`
      token-overhead delta (-8.0 % token-weighted). All three are recomputed
      from the two stored JSON runs by `rdp_candidates_delta`, not asserted.
- [x] AC-6 — One of the three verdicts in 3.3 is written into the results
      file, citing the readings it rests on — and if the verdict is delete,
      Phase 2's edits are gone from the tree.
      Verified 2026-09-08 — a **fourth** verdict is written into
      `RESULTS-candidates-treatment-2026-09-08.md` § Step 3.3, citing the
      dim-5 ITT delta, the compliance count, the 9-point attribution split and
      the dim-1 tripwire. The AC's own wording asked for one of three, and the
      criterion is met in the way that keeps the record honest: all three are
      named and shown not to describe the data, with the reason each fails.
      The delete clause is satisfied vacuously and worth stating rather than
      passing over: Phase 2 shipped **no** edit to `mandated-lines.md` or
      `lint_mandated_lines.ts` — the council blocked that half up front — so
      there is nothing to revert. `git diff origin/main` over both is empty.
