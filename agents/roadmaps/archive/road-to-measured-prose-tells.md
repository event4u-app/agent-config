---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-tell-detector-promotions
    relation: disjoint
    note: >
      That roadmap is the INTERACTION-layer detector line — design and frontend
      texture, parked with its own council verdict. This one is the PROSE line.
      They share the word "tell" and no rule, no corpus and no threshold. The
      epoch-and-M1 discipline below is borrowed from it deliberately and is
      named as borrowed.
  - slug: road-to-figures-that-name-their-denominator
    relation: extends
    note: >
      Same shape one surface over. That roadmap repairs three published figures
      the tree contradicts; this one repairs a documentation table that claims
      three deterministic bounds the scanner does not implement, and a density
      that is published without a minimum denominator.
estate_growth_exempt: "Four precision and truth defects in a shipped, default-on detector, every one reproduced at 9b75231ed by running it: three ordinary Oxford-comma lists fail the gate at 39.47/500w against a cap of 3; six words with one em-dash fail at 83.33/500w against a cap of 2; six consecutive short declaratives score zero although the skill's own bound table says that bound is enforced; and six German tells score zero. No active roadmap, later roadmap or stub owns the prose-tell line — the one tell roadmap in the estate is the interaction-layer one, parked, and its subject is design texture. The held object for this lineage is an ARCHIVED roadmap whose blocker has been open 57 days."
estate_offset_exempt: "Cannot be offset. Its natural offset is the archived roadmap that owns the lineage and cannot be archived twice; the interaction-layer sibling is parked under a 2/2 council verdict that neither of its steps can ship a truthful backed claim, so archiving it to pay for this would drop work a council explicitly parked."
---
# Road to measured prose tells

> **Source:** `agents/tmp.old/inbox-2026-09-s/` — a three-loop external analysis
> of a third-party writing skill, delivered 2026-09-06 as two proposals. Its
> own conclusion was that this tree already teaches more than the source does
> and that the source's value is as a **test corpus**, not as a rule list. That
> inversion is what makes it adoptable; every defect below was re-run here at
> `9b75231ed` rather than carried from the proposal.

> **Arrivals:** the humanizer subject appears in **15** consumed inbox rounds
> under `agents/tmp.old/` (measured 2026-09-06, `grep -rli humanizer`, distinct
> round directories); the narrower `ai-tell` phrasing in 5. Latest
> `inbox-2026-09-s`. A floor on the recurrence, not a count of asks for this
> roadmap — and the four defects below are new, raised by no earlier round.

## Goal

The prose tell detector fails text that is bad and passes text that is fine, and
the documentation describing it does not claim checks it never runs. Four things
reproduced at `9b75231ed` by running `src/scripts/detect_ai_tells.ts`:

1. **Precision.** `We shipped apples, pears, and plums. We track revenue,
   churn, and margin. The team is Alice, Bob, and Carol.` — nineteen words of
   ordinary English — scores `cluster 39.47/500w` against a cap of 3 and exits
   **1**. `tell-rule-of-three` (`src/scripts/ai_tells_rules.ts:208-216`) matches
   every Oxford-comma list.
2. **No short-text floor.** `Not a tool — a system.` scores
   `dashes 83.33/500w` against a cap of 2 and exits **1**. The density is
   `n/words*500` with no minimum word count.
3. **Documentation drift.** `src/skills/humanizer/references/anti-aiisms.md:80-93`
   lists five self-validation bounds and says "the deterministic subset is
   enforced by `detect_ai_tells.ts`". Three of the five — consecutive staccato
   fragments, uniform-shape bullet runs, hedge-per-claim — are implemented
   nowhere: six consecutive short declaratives score `hard 0 · cluster 0`.
4. **German recall.** Six German tells in one paragraph score `hard 0 ·
   cluster 0` under `--language de`. The register holds four DE rules
   (`ai_tells_rules.ts:370-413`), and `tell-de-negative-parallelism` requires
   the literal `nicht nur`, so `nicht um … sondern um` passes.

And one thing that makes every fix above unmeasurable: `tests/fixtures/ai-tells/`
holds 40 files in `en/` and `de/`, all seeded before/after pairs, and **no clean
corpus** — so the false-positive rate of any rule is unknown by construction.

Out of scope by decision: every absolute rule the source proposes and the
2026-07-11 council rejected — no zero-dash target, no CI gate over this
repository's own documentation, no blanket adverb or passive ban
(`agents/roadmaps/archive/road-to-humanized-writing.md:28-60`); and the
README's house style, measured at `words 4588 · hard 0 · dashes 13.08/500w`,
which those verdicts explicitly cover. Also out of scope: the two new commands the
proposals place in the `analyze:*` cluster — that cluster ships in the non-default
`analysis-workbench` pack while the humanizer sits in `gtm-marketing`, so a consumer
with the humanizer installed would not have them.

## Phase 1 — Measurement truth before any growth

- [x] **1.1 Build the clean prose corpus on the template the design side already ships.**
      `internal/bench/corpora/design-slop-clean/` holds **32** files with a
      pre-registration at `internal/bench/corpora/design-slop-fp-PREREG.md`; the
      prose side has no equivalent. Build `tests/fixtures/ai-tells/clean/{en,de}/`
      to that shape — at least 30 files of human-authored deliverable prose with a
      near-miss per rule family: legitimate three-item lists, a paragraph with two
      em-dashes, a real rhetorical question, a deliberate four-word line, technical
      vocabulary. Pre-register the expected false-positive rate before measuring it.
      No company-identifying text. *`corrected-from-reproduction`* — the proposal
      described this as new discipline; the template exists and is cited here instead.
      verify: a per-rule false-positive count over `clean/` is reported by a
      command, the pre-registration predates the first measurement, and adding a
      file to the corpus changes the count.
- [x] **1.2 Disarm `tell-rule-of-three` (D3).** The rule stays and loses solo
      effect: a hit counts only when two or more three-item lists share a paragraph,
      or when all three members are abstract nouns rather than names or numbers.
      *`corrected-from-reproduction`* — the proposal cited 32.61/500w for its own
      sample; the figure for the sample in the goal above is **39.47**, and the
      correction is the mechanism, not the number.
      verify: `Alice, Bob, and Carol` alone scores 0; the seeded fixture that
      legitimately carries this tell keeps its hit.
- [x] **1.3 Add a density floor (D4).** Below a minimum word count,
      `cluster_score_per_500` and `dash_density_per_500` are reported as `null`
      and their thresholds are not applied; hard rules still apply, and `--fail`
      says the density was not evaluated.
      verify: `Not a tool — a system.` passes with that note; a 60-word text with
      three dashes still fails.
- [x] **1.4 Bring the bound table and the scanner into step (D2).** Either the
      three unimplemented bounds are implemented — all three are deterministic — or
      the table at `anti-aiisms.md:87-93` stops attributing them to the scanner and
      says which are eye-checked in step 3.
      verify: for each of the five bounds, the table's attribution matches what a
      probe of the scanner does, and a fixture reddens if a bound is claimed and
      absent.

- [x] **1.5 Split the fixture corpus into tune and holdout.** `loadPairs()`
      (`src/scripts/bench_humanizer_eval.ts:66-89`) reads every file under `en/` and
      `de/` into one array, so a rule tuned against the 20 pairs is measured against
      the same 20 pairs and overfitting is not excluded by construction.
      verify: a rule tuned on the tune split is scored on the holdout split, the two
      sets are disjoint by name, and the bench reports which split each figure came from.
- [x] **1.6 Record the 2026-07-11 decision as a decision record.** There are 198 ADRs
      under `docs/decisions/` and **zero** mention this subject — a grep for
      `humaniz|prose.tell|anti-slop|em.dash` over all of them returns nothing. The
      verdicts that govern a shipped, default-on surface live in one archived roadmap
      and in code comments, which is the most plausible reason two independent
      external sessions treated the question as open and one proposed re-litigating
      it. Write the record: what was decided, what was rejected, and the reopen
      condition. *`corrected-from-reproduction`* — neither proposal names this gap;
      it was found by grepping the ADR corpus while checking their claims.
      verify: `./scripts-run src/scripts/adr_cite_check <the new ADR>` reports a live
      status, and the archived roadmap's verdict section points at it.

## Phase 2 — The register grows in epochs, under a measured floor

- [x] **2.1 One family per epoch, promoted only at a zero false-positive count.**
      The interaction-layer sibling already runs this discipline; borrow it rather
      than inventing a second one. A family enters as a weighted cluster rule, not
      a hard rule, and its promotion requires zero hits across `clean/`.
      verify: the promotion of any family is refused while its clean-corpus count is
      above zero, and the refusal names the file that hit.
- [x] **2.2 Close the recall gap the source exposed, in that order.** The families
      the source's own examples slipped past — throat-clearing openers, emphasis
      crutches, false agency, narrator-at-a-distance, vague declaratives, binary
      contrasts beyond `not just` — each as its own epoch under 2.1. Patterns are
      authored here, never copied from the source: the source is a corpus, and a
      word-list import would carry a licence obligation and a plaintext pin.
      verify: each landed family raises recall on the seeded corpus without raising
      any clean-corpus count above zero.
- [x] **2.3 Reach German parity (D6).** `tell-de-negative-parallelism` matches the
      `nicht um … sondern` form as well as `nicht nur`, and the DE register covers
      the families 2.2 lands for English.
      verify: the six-tell German paragraph in the goal scores above zero, and the
      German half of `clean/` stays at zero.

## Phase 3 — The claim stops being fixture-scoped

- [x] **3.1 Make step 4b emit one event per run.** `docs/CLAIMS.md:467` states its
      own limit — the measurement is seeded-tell removal on a self-constructed
      corpus, and real-draft lift is unmeasured. The blocker naming that has been
      open since 2026-07-11. Nothing in the tree moves it because no run is
      recorded: `grep humaniz src/scripts/_lib/` finds no event.
      verify: a step-4b run appends one record through the existing collector, and
      no second instrument was built to hold it.
- [x] **3.2 Give the blind judge an attribution vector.** The paired bench returns a
      binary preference, so a family landed in Phase 2 cannot be tied to an effect.
      verify: a bench run reports which family or families the preference tracked,
      and a run with one family disabled changes that report.

## Phase 4 — Finding is not the same act as rewriting

- [x] **4.1 Add an audit-only form to `/humanize`.** The command has no such
      form: `src/domains/gtm-marketing/humanize/command.md` step 4 always prints
      "the final rewrite", and a grep for `audit-only`, `--audit`, `dry-run` or
      `findings-only` over that file returns **0**. On someone else's text — a
      customer quote, a contributed draft, a document under review — rewriting is
      the wrong action and locating is the right one.
      verify: the audit-only form prints located findings and no rewrite, the
      default form is unchanged, and the disclosure-footer rule still holds in both.
- [x] **4.2 Let a consistently used pattern count as intent.** A pattern the author
      uses consistently through one document is evidence of style, not of a tell;
      without a voice sample the skill falls back to defaults
      (`src/skills/humanizer/SKILL.md:60-63`), and the detector's `per_pattern`
      counts occurrences without locating them, so consistency is not observable.
      verify: the JSON carries per-occurrence locations, and a document using one
      flagged pattern uniformly throughout reports it as consistent rather than as
      N independent hits.

## Blockers

### blocker: real-draft-lift-unmeasured-feeder

- **Status:** resolved
- **Outcome state:** **decided — option 2, declined for this round, with the word
  "permanent" removed from it.** A scoped refusal, not a measurement. The
  substantive owner-facing question is unchanged and explicitly un-prejudged;
  Phase 3.1 closed as a documentation step and 3.2 stood alone, exactly as the
  option predicted.
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-s` disposition and in the reply that carried it.
- **Blocks:** nothing further. Phase 3 is closed. Phases 1 and 2 were independent and were completed in full.
- **Recommendation:** — superseded by the decision below.
- **If you do nothing:** — no longer applicable; the decision landed.
- **What to do:** nothing further in this round. If the owner authorizes
  collection later, the three options below are unchanged and the path in
  option 1 or 3 is still the path. Reopening also needs a measurement:
  `npx tsx src/scripts/bench_humanizer_eval.ts --judge --confirm-spend` over a
  real corpus, not the seeded fixtures.
  1. Authorise full collection — set the retention in `src/config/agent-settings.template.yml`, record what is stored in `docs/contracts/write-engine.md`, and flip the blocker at `agents/roadmaps/archive/road-to-humanizer-hardening.md` to `resolved`.
  2. Or decline it — the option taken, minus its "permanent" wording. See below.
  3. Or authorise the text-free form — counts and scores per run only, no draft retained, recorded through the existing collector.
- **Resolved when:** — resolved 2026-09-07 by taking option 2 **with its
  "permanent" wording struck**. Recorded so the reasoning survives the closure:

  Both collecting options were held **categorically unreachable at this level**,
  and for the same reason rather than on a balance of risk. Option 1 creates new
  retention of the maintainer's own prose, which lowers the fixture-only
  data-handling floor this package currently records. Option 3 avoids retaining
  the *draft* and still retains *metrics derived from* real drafts, which is
  itself a collection practice that does not exist today. "Safer" was not the
  dispositive test; "does this create collection beyond the recorded floor" was,
  and both answered yes.

  Option 2's own wording was amended before it was taken. Writing **"permanent"**
  into a published scope note prejudges a future owner ruling, which a scoped
  refusal may not do — a refusal says *not this round*, never *not ever*. So
  `docs/CLAIMS.md` § `claim:humanizer-tell-reduction` now describes fixture-only
  evaluation as **the declared scope of the current roadmap phase** and states
  explicitly that **future authorization is neither granted nor refused**.
  Widening the claim needs an authorization AND a measurement; neither alone.

  If option 3 is ever revisited, a genuinely text-incapable schema requires all
  of: a closed schema of bounded numeric or enumerated values, rejection of
  unknown fields, no free-form identifiers and no error context, no serialization
  of source objects, no debug logging of inputs or outputs, and tests inspecting
  every persistence and telemetry sink. A `grep` for one keyword is explicitly
  too weak to establish it.

  The parent blocker at `agents/roadmaps/archive/road-to-humanizer-hardening.md`
  carries the same disposition with its own outcome state named, and
  `docs/CLAIMS.md` agrees with it. Decided by the AI council (2 seats,
  run-19 session 5, unanimous, 2026-09-06) under the maintainer's standing
  delegation; owner-reserved dimensions were the reason both collecting options
  were unreachable rather than merely disfavoured.

## Evidence

Every figure below was produced by running the named command in this branch.

### Steps 1.1-1.6

- **1.1** — `tests/fixtures/ai-tells/clean/{en,de}/`, **35** files, each opening
  with an exempt blockquote label. Pre-registration
  `internal/bench/corpora/prose-tells-fp-PREREG.md` committed at `822b5b2dd`,
  **before** the corpus, the bench and every number. Command:
  `npx tsx src/scripts/bench_prose_tells_fp.ts` → per-rule M1 plus corpus pin.
  `tests/scripts/bench_prose_tells_fp.test.ts` asserts adding a file moves both
  the count and the pin, and that counting is per file rather than per hit.
  Run 1 and run 2, including **two falsified predictions**:
  `internal/bench/reports/prose-tells-fp-v1.md`.
- **1.2** — `matchRuleOfThree` in `src/scripts/ai_tells_rules.ts`. Measured:
  the goal's nineteen-word sample scores 0; the same three lists padded past
  the word floor score 0; an abstract triplet still scores 1; all five seeded
  fixtures keep their hit (asserted per fixture). M1 for the rule: 1 → **0**.
- **1.3** — `MIN_DENSITY_WORDS = 50`. Measured: `Not a tool — a system.`
  passes with `density not evaluated (6 words < 50-word floor; … 1 dash(es)
  counted)`; a 64-word text with three dashes still fails on dash density;
  a hard hit below the floor still fails. Clean files rejected: 15 → **10**.
- **1.4** — `anti-aiisms.md` gains a mechanical-signal column and a
  bound-applied-by column. Two claimed bounds implemented
  (`tell-staccato-run`, `tell-uniform-bullet-run`); two re-attributed to the
  step-3 eye-check with the reason stated (their denominators are *per claim*
  and *per 100 words*, which the scanner does not segment).
  `tests/scripts/tell_bound_attribution.test.ts` parses the shipped table and
  probes the scanner per row. Probed red two ways: a signal that resolves to no
  rule, and a `scanner` attribution on a bound stated per claim.
- **1.5** — `tests/fixtures/ai-tells/SPLITS.json`: 12 tune / 8 holdout,
  disjoint by name, both languages both sides. A pair in neither half or in
  both throws rather than defaulting. The report prints tune, holdout and
  both-halves columns.
- **1.6** — `docs/decisions/ADR-257-prose-tell-detector-scope-and-rejected-absolutes.md`.
  `./scripts-run src/scripts/adr_cite_check ADR-257` → `LIVE, TRIGGER
  INDETERMINATE`, 4 evidence refs, 0 unresolved.
  `check_new_adr_evidence --base origin/main` → 1 accepted and disclosing, 0
  violations. `agents/roadmaps/archive/road-to-humanized-writing.md` § Council
  notes now points at it.

### Steps 2.1-2.3

- **2.1** — `internal/bench/corpora/prose-tells-epochs.md` plus
  `bench_prose_tells_fp --gate <rule-id…>`. The refusal path is exercised
  against a rule that really hits: `--gate tell-de-connector-stack` exits **1**
  with `promotion refused: tell-de-connector-stack has 2 clean-corpus false
  positive(s) — …de/01-konnektor.md, …de/02-darueber-hinaus.md`.
  `tests/scripts/tell_family_epochs.test.ts` re-measures every ledger family at
  zero and probed red when one was widened.
- **2.2** — six English families, each M1 = 0 at promotion. Three clean files
  were added first so they have a near-miss to survive. Recall per family on
  the seeded corpus: `tell-throat-clearing` 5 pairs,
  `tell-emphasis-crutch` 2, others 0 — a zero there is a statement about a
  corpus authored for the July register, and those families are measured by
  their own probe and counter-probe instead.
- **2.3** — seven German families plus the `nicht um … sondern um` extension,
  all M1 = 0. The goal's six-tell German paragraph goes from `hard 0 ·
  cluster 0` to five families firing and 6 cluster weight. The German half of
  `clean/` did not gain a single count from anything this roadmap promoted; the
  pre-existing `tell-de-connector-stack` count of 2 was measured in run 1
  before Phase 2 began and is published in the FP report.
- Also repaired here because it silenced two of these families outright:
  `stripExempt` matched any two apostrophes on a line as a quoted span, so
  `In today's fast-paced world, let's be honest` was read as a quotation and
  stripped whole. An opening quote must now start a token and a closing quote
  must end one. No new false positive on the clean corpus.

### Steps 3.1-3.2

- **3.1** — closed as a **documentation step** per the blocker disposition
  above. `docs/CLAIMS.md` scopes fixture-only evaluation to the current phase,
  never permanently, and says future authorization is neither granted nor
  refused. `check_claims` green. No collector, no event, no retention.
- **3.2** — per-pair `families_removed` vector, an attribution table in the
  report, and `--disable-family <rule-id>` which excludes a family from the
  **scan** rather than from the table. Measured: disabling
  `tell-ai-vocabulary` moves the both-halves cluster mean from 48.06 to 33.88
  and drops the family from the table. The judge column is labelled a
  co-occurrence, never an isolated effect.
- Also repaired here: an objective-only re-run overwrote the canonical report
  with a `Not run` placeholder, which unbacked `claim:humanizer-tell-reduction`
  for free and announced nothing. The judged block is carried forward, dated,
  and labelled as not a measurement of the current register.
  `tests/scripts/humanizer_attribution.test.ts` guards the anchor and probed
  red — both the test and `check_claims`.

### Steps 4.1-4.2

- **4.1** — `src/domains/gtm-marketing/humanize/command.md` § 2a. The audit
  form locates and stops; the default form is unchanged and the command never
  selects the audit form itself; the disclosure rule holds in both.
  `tests/scripts/humanize_audit_form.test.ts` asserts all four on the source
  **and** on the projection, and probed red when the default-form clause was
  weakened.
- **4.2** — every finding carries `line:column` per occurrence, asserted to
  resolve to the text it points at. A pattern used ≥ 3 times across ≥ 60 % of
  the document is reported `used consistently throughout` and charged **once**;
  a local repetition stays `scattered` and is charged N times; a **hard** rule
  is never discounted, and that carve-out probed red.

### Figures that moved, and what they do not mean

The both-halves seeded cluster mean went **53.97 → 48.06**. Two scoring changes
pulled it in opposite directions — thirteen new families raised it, 4.2's
consistency discount lowered it further — so the number is not a
before-and-after of the same thing and is **not** quoted as a recall result in
either direction. `docs/CLAIMS.md` and the epoch ledger both say so. The
after-side stayed **0** on all three metrics in both halves, and every seeded
`before` fixture still exceeds the thresholds.

### Not done, and named rather than implied

Four clean files carrying a single em dash in 78–125 words are still rejected
on dash density. At a cap of 2 per 500 words no document under ~250 words can
carry one dash and pass, and a floor high enough to clear them would break step
1.3's own verify. The cap is a council decision of 2026-07-11; this roadmap
holds no authority to move it. Published with a reopening condition in
`internal/bench/reports/prose-tells-fp-v1.md` rather than repaired or edited
away.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The clean corpus is written to pass | implementation | The same run that builds `clean/` also tunes the rules against it, so the cheapest corpus is one made of text the current rules already pass — which measures nothing and certifies everything. | 1.1 requires a near-miss per family, each of which is a case the current rules DO fire on, so a corpus that starts at zero false positives has not met the step; 1.2's verify names one such near-miss explicitly. | Phase 1 — Measurement truth before any growth |
| 2 | Precision is bought with recall and nobody notices | implementation | Disarming `tell-rule-of-three` and adding a density floor both make the detector fire less, and the seeded corpus is the only thing that would show the loss. | 1.2 requires the seeded fixture that legitimately carries the tell to keep its hit, and 1.3's floor leaves hard rules applying; 2.2 measures recall against the seeded corpus on every promotion. | Phase 1 — Measurement truth before any growth |
| 3 | The register grows into the rules the council rejected | product | The source's families overlap the absolute rules of 2026-07-11 — adverbs, passive, dashes — and an epoch framing makes each one look like a small measured step rather than a re-litigation. | The goal names those verdicts and their record by path as out of scope by decision; 2.1 admits a family only as a weighted cluster rule at zero clean-corpus hits, which no blanket ban can reach. | Phase 2 — The register grows in epochs |
| 4 | Patterns are imported rather than authored | product | Copying the source's word lists is faster than authoring equivalents and would carry a licence obligation plus a plaintext source pin into a tracked file, which `source-confidentiality` forbids. | 2.2 states the constraint in the step and the source stays a corpus; no phase names it, and the round's provenance annex remains outside the tree. | Phase 2 — The register grows in epochs |
| 5 | The audit-only form becomes the default by drift | product | An audit form that is safer on other people's text is also the form a cautious run reaches for on its own text, and a default that quietly stops rewriting turns a shipped capability into a linter without anyone deciding that. | 4.1's verify requires the DEFAULT form to be unchanged and tested as such, so a silent swap fails the step; the audit form is additive and named, never a mode the command picks by itself. | Phase 4 — Finding is not the same act as rewriting |
| 6 | Phase 3 collects drafts before it is authorised | implementation | An event per 4b run is one line of code away from storing the draft text it saw, and the blocker that gates it sits on an archived roadmap nobody opens. | The blocker is carried here with three named outcomes including a text-free form; 3.1's verify requires the existing collector and forbids a second instrument. | Phase 3 — The claim stops being fixture-scoped |

## Acceptance Criteria

- [x] AC-1 — `tests/fixtures/ai-tells/clean/{en,de}/` exists with at least 30 files and a near-miss per rule family, and a per-rule false-positive count over it is produced by a command.
- [x] AC-2 — Three ordinary Oxford-comma lists in one paragraph pass, and the seeded fixture that legitimately carries that tell still fails.
- [x] AC-3 — A text below the density floor reports its densities as not evaluated and passes, while hard rules still apply to it.
- [x] AC-4 — Every bound in the `anti-aiisms.md` table is either implemented in the scanner or attributed to the eye-check, and a claimed-but-absent bound reddens a fixture.
- [x] AC-5 — No rule family was promoted while its clean-corpus false-positive count was above zero.
- [x] AC-6 — The German paragraph in the goal scores above zero and the German clean corpus stays at zero.
- [x] AC-7 — The blocker on the archived parent carries one of its three named outcomes, and `docs/CLAIMS.md` agrees with it.
- [x] AC-8 — No absolute rule from the source entered the register, and no pattern list was copied from it.
- [x] AC-9 — The tune and holdout splits are disjoint by name and the bench reports which split each figure came from.
- [x] AC-10 — A decision record exists for the 2026-07-11 verdicts, `adr_cite_check` reports it live, and the archived roadmap points at it.
- [x] AC-11 — `/humanize` has an audit-only form that locates without rewriting, and the default form is unchanged.
- [x] AC-12 — The detector reports per-occurrence locations, and a uniformly used flagged pattern is reported as consistent rather than as N hits.
