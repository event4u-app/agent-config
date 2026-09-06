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

- [ ] **1.1 Build the clean prose corpus on the template the design side already ships.**
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
- [ ] **1.2 Disarm `tell-rule-of-three` (D3).** The rule stays and loses solo
      effect: a hit counts only when two or more three-item lists share a paragraph,
      or when all three members are abstract nouns rather than names or numbers.
      *`corrected-from-reproduction`* — the proposal cited 32.61/500w for its own
      sample; the figure for the sample in the goal above is **39.47**, and the
      correction is the mechanism, not the number.
      verify: `Alice, Bob, and Carol` alone scores 0; the seeded fixture that
      legitimately carries this tell keeps its hit.
- [ ] **1.3 Add a density floor (D4).** Below a minimum word count,
      `cluster_score_per_500` and `dash_density_per_500` are reported as `null`
      and their thresholds are not applied; hard rules still apply, and `--fail`
      says the density was not evaluated.
      verify: `Not a tool — a system.` passes with that note; a 60-word text with
      three dashes still fails.
- [ ] **1.4 Bring the bound table and the scanner into step (D2).** Either the
      three unimplemented bounds are implemented — all three are deterministic — or
      the table at `anti-aiisms.md:87-93` stops attributing them to the scanner and
      says which are eye-checked in step 3.
      verify: for each of the five bounds, the table's attribution matches what a
      probe of the scanner does, and a fixture reddens if a bound is claimed and
      absent.

- [ ] **1.5 Split the fixture corpus into tune and holdout.** `loadPairs()`
      (`src/scripts/bench_humanizer_eval.ts:66-89`) reads every file under `en/` and
      `de/` into one array, so a rule tuned against the 20 pairs is measured against
      the same 20 pairs and overfitting is not excluded by construction.
      verify: a rule tuned on the tune split is scored on the holdout split, the two
      sets are disjoint by name, and the bench reports which split each figure came from.
- [ ] **1.6 Record the 2026-07-11 decision as a decision record.** There are 198 ADRs
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

- [ ] **2.1 One family per epoch, promoted only at a zero false-positive count.**
      The interaction-layer sibling already runs this discipline; borrow it rather
      than inventing a second one. A family enters as a weighted cluster rule, not
      a hard rule, and its promotion requires zero hits across `clean/`.
      verify: the promotion of any family is refused while its clean-corpus count is
      above zero, and the refusal names the file that hit.
- [ ] **2.2 Close the recall gap the source exposed, in that order.** The families
      the source's own examples slipped past — throat-clearing openers, emphasis
      crutches, false agency, narrator-at-a-distance, vague declaratives, binary
      contrasts beyond `not just` — each as its own epoch under 2.1. Patterns are
      authored here, never copied from the source: the source is a corpus, and a
      word-list import would carry a licence obligation and a plaintext pin.
      verify: each landed family raises recall on the seeded corpus without raising
      any clean-corpus count above zero.
- [ ] **2.3 Reach German parity (D6).** `tell-de-negative-parallelism` matches the
      `nicht um … sondern` form as well as `nicht nur`, and the DE register covers
      the families 2.2 lands for English.
      verify: the six-tell German paragraph in the goal scores above zero, and the
      German half of `clean/` stays at zero.

## Phase 3 — The claim stops being fixture-scoped

- [ ] **3.1 Make step 4b emit one event per run.** `docs/CLAIMS.md:467` states its
      own limit — the measurement is seeded-tell removal on a self-constructed
      corpus, and real-draft lift is unmeasured. The blocker naming that has been
      open since 2026-07-11. Nothing in the tree moves it because no run is
      recorded: `grep humaniz src/scripts/_lib/` finds no event.
      verify: a step-4b run appends one record through the existing collector, and
      no second instrument was built to hold it.
- [ ] **3.2 Give the blind judge an attribution vector.** The paired bench returns a
      binary preference, so a family landed in Phase 2 cannot be tied to an effect.
      verify: a bench run reports which family or families the preference tracked,
      and a run with one family disabled changes that report.

## Phase 4 — Finding is not the same act as rewriting

- [ ] **4.1 Add an audit-only form to `/humanize`.** The command has no such
      form: `src/domains/gtm-marketing/humanize/command.md` step 4 always prints
      "the final rewrite", and a grep for `audit-only`, `--audit`, `dry-run` or
      `findings-only` over that file returns **0**. On someone else's text — a
      customer quote, a contributed draft, a document under review — rewriting is
      the wrong action and locating is the right one.
      verify: the audit-only form prints located findings and no rewrite, the
      default form is unchanged, and the disclosure-footer rule still holds in both.
- [ ] **4.2 Let a consistently used pattern count as intent.** A pattern the author
      uses consistently through one document is evidence of style, not of a tell;
      without a voice sample the skill falls back to defaults
      (`src/skills/humanizer/SKILL.md:60-63`), and the detector's `per_pattern`
      counts occurrences without locating them, so consistency is not observable.
      verify: the JSON carries per-occurrence locations, and a document using one
      flagged pattern uniformly throughout reports it as consistent rather than as
      N independent hits.

## Blockers

### blocker: real-draft-lift-unmeasured-feeder

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-06, in the round `inbox-2026-09-s` disposition and in the reply that carried it.
- **Blocks:** Phase 3 only. Phases 1 and 2 are independent and agent-doable in full — precision, the floor, the documentation and the epochs need no real-draft corpus.
- **Recommendation:** none; this is the owner's call — it turns on whether real drafts written through step 4b may be collected at all, which is a data-handling decision about the maintainer's own writing.
- **If you do nothing:** `docs/CLAIMS.md:466-471` keeps its honest scope note and the blocker on `agents/roadmaps/archive/road-to-humanizer-hardening.md:168` stays open past 57 days, so no register growth from Phase 2 can ever be tied to real-draft improvement.
- **What to do:**
  1. Authorise full collection — set the retention in `src/config/agent-settings.template.yml`, record what is stored in `docs/contracts/write-engine.md`, and flip the blocker at `agents/roadmaps/archive/road-to-humanizer-hardening.md:168` to `resolved`. Phase 3.1 is then unblocked as written.
  2. Or decline it — edit the scope note at `docs/CLAIMS.md:467` to say the fixture scope is permanent rather than provisional, and mark the same blocker `resolved` with that reason. Phase 3.1 becomes a documentation step and 3.2 stands alone.
  3. Or authorise the text-free form — counts and scores per run only, no draft retained, recorded through the existing collector; confirm with `grep -rn "humaniz" src/scripts/_lib/` returning the one new event and nothing that holds text.
- **Resolved when:** the blocker at `archive/road-to-humanizer-hardening.md:168` carries one of the three outcomes, and `docs/CLAIMS.md` agrees with whichever was chosen.

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

- [ ] AC-1 — `tests/fixtures/ai-tells/clean/{en,de}/` exists with at least 30 files and a near-miss per rule family, and a per-rule false-positive count over it is produced by a command.
- [ ] AC-2 — Three ordinary Oxford-comma lists in one paragraph pass, and the seeded fixture that legitimately carries that tell still fails.
- [ ] AC-3 — A text below the density floor reports its densities as not evaluated and passes, while hard rules still apply to it.
- [ ] AC-4 — Every bound in the `anti-aiisms.md` table is either implemented in the scanner or attributed to the eye-check, and a claimed-but-absent bound reddens a fixture.
- [ ] AC-5 — No rule family was promoted while its clean-corpus false-positive count was above zero.
- [ ] AC-6 — The German paragraph in the goal scores above zero and the German clean corpus stays at zero.
- [ ] AC-7 — The blocker on the archived parent carries one of its three named outcomes, and `docs/CLAIMS.md` agrees with it.
- [ ] AC-8 — No absolute rule from the source entered the register, and no pattern list was copied from it.
- [ ] AC-9 — The tune and holdout splits are disjoint by name and the bench reports which split each figure came from.
- [ ] AC-10 — A decision record exists for the 2026-07-11 verdicts, `adr_cite_check` reports it live, and the archived roadmap points at it.
- [ ] AC-11 — `/humanize` has an audit-only form that locates without rewriting, and the default form is unchanged.
- [ ] AC-12 — The detector reports per-occurrence locations, and a uniformly used flagged pattern is reported as consistent rather than as N hits.
