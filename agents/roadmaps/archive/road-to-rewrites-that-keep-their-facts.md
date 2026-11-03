---
complexity: standard
status: ready
tree_pin: f9054d0f10
review_by: 2026-12-15
relates:
  - slug: road-to-tells-a-near-miss-can-refute
    relation: extends
    note: "Archived: shipped fact_diff (5.3); this completes its classes and false-alarm fixes."
  - slug: road-to-a-tree-that-keeps-its-neighbours
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-checks-that-name-their-catch
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-checks-that-name-their-catch-carried
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-edges-that-earn-their-target
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-figures-that-name-their-denominator
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-findings-that-show-their-exhibits
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-forecasts-that-know-their-sources
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-inbox-harvest-residuals
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-neighbours-that-pull-their-weight
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-neighbours-that-pull-their-weight-carried
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-records-that-match-their-code
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-touched-files-that-pass-their-own-tools
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
  - slug: road-to-touched-files-that-pass-their-own-tools-carried
    relation: disjoint
    note: "Title-word match only; subject differs (checked 2026-11-03)."
estate_offset_exempt: "Operator-directed in the invocation (2026-11-03: analyse the round, then process its roadmaps with /roadmap:process-full and land them in one PR); archived in the same PR when its open work closes, so the active count on landing is unchanged. Owner search at f9054d0f10 (grep -rlF for fact_diff, bench_humanizer_eval, humanizer-tell-reduction, dashCount, hiring-loop-design over agents/roadmaps/*.md, later, stubs) found no owner; the prior owner road-to-tells-a-near-miss-can-refute is archived with no follow-up for these."
---
# Road to rewrites that keep their facts

> **Source:** `agents/tmp.old/inbox-2026-11-u/` (topic T3, supplied plan v3 plus transcript).
> **Arrivals:** 1 — `inbox-2026-11-u` (2026-11-03).

## Goal

A rewrite may change how something is said, never what is true. The fact diff
shipped (`src/scripts/_lib/fact_diff.ts`, humanizer step 6) but catches one of
five mutation classes, false-alarms on German nouns and locale numbers, and the
corpus behind the humanizer claim fails it: 17 of 20 "after" fixtures add
numbers absent from their input, and the bench never runs the skill. Done
means: the witness catches all five classes with zero findings on benign
controls, the corpus and bench report fact conservation, and the dash counter
stops counting ranges.

## Verified at the pin (probes under `agents/runtime/tmp/t3/`)

| Claim | Verdict | Evidence |
|---|---|---|
| fact preservation is self-report only | partly fixed (`e7bca8680d`) | `src/skills/humanizer/SKILL.md` step 6 |
| witness catches 1/5 classes | reproduced (new) | status, negation, we→I, number word missed |
| German nouns read as names; `10,000`/`10.000` flagged | reproduced (new) | `fact_diff` on `de/02-blog-de` |
| 17/20 after-fixtures add numbers | reproduced | `tests/fixtures/ai-tells/` |
| bench reads static files, judge prompt says "same content" | still-true | `src/scripts/bench_humanizer_eval.ts:134,151,168` |
| claim `last_verified` older than its own dated text, gate green | reproduced (new) | `docs/CLAIMS.md:554-559` |
| dash counter counts ranges | reproduced | `src/scripts/detect_ai_tells.ts:385` |
| tell register has no cadence | still-true | no `src/skills/humanizer/data/manifest.json` |
| hiding covered at Unicode level only | still-true | `docs/guidelines/agent-infra/untrusted-input-spotlighting.md:80-104` |
| `hiring-loop-design` has no AI-screening content | still-true | `src/skills/hiring-loop-design/SKILL.md` |

## Phase 1 — Measure first

- [x] **1.1 Characterization test of the corpus.** <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      `tests/scripts/humanizer_corpus_fact_conservation.test.ts` asserts the
      current counts (17 flagged, 16 by `diffFacts`) as a ratchet that may fall,
      never rise.
      verify: green now; red when a supplied number is added to a fixture.
      Done: ratchet test green (17 supplied, 16 witness-added); appending "It took 37 days." to `en/04` turned both ceilings red.
      production entry: `src/scripts/detect_ai_tells.ts`

## Phase 2 — Complete the witness

- [x] **2.1 Four new classes in `fact_diff.ts`:** unit-bound EN/DE number words, <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      status/qualifier lexicon, negation and modality, attribution subject.
      Fixtures under `tests/fixtures/fact-atoms/` (5 mutations, 3 benign).
      verify: 5/5 mutations caught; benign reorder gives 0 findings.
      Done: `numword`, `status` (incl. number qualifiers), `negation`/`modality`, `attribution` (presence) added; `npx vitest run tests/scripts/fact_diff.test.ts` 19/19, 5 mutations caught, 3 benign at 0. The 1.1 witness ceiling is scoped to the literal kinds so a stronger witness cannot raise a corpus ratchet.
      production entry: `src/scripts/detect_ai_tells.ts`
- [x] **2.2 False-alarm fixes:** locale-normalize numbers; drop German <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      sentence-initial and imperative capitalised pairs from names.
      verify: `npx vitest run tests/scripts/fact_diff.test.ts` -> 0 and `de/02` gives
      0 name findings, and
      0 findings on a sentence-reordered copy of each clean-corpus file.
      Done: locale-normalized numbers (versions stay literal), German sentence-initial and formal-address pairs dropped, names no longer span a line break; `fact_diff.test.ts` exit 0 (65 with the ratchet), `de/02` 0 name findings, 35 reordered clean files at 0.
      production entry: `src/scripts/detect_ai_tells.ts`
- [x] **2.3 Word ↔ digit stays literal.** Decided (D2) at planning; no code. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      verify: `npx vitest run tests/scripts/fact_diff.test.ts` -> 0 unchanged.

## Phase 3 — Skill, bench, claim

- [x] **3.1 Fixture 4 "fact preservation"** in <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      `src/skills/humanizer/references/fixtures.md` plus an eval case.
      verify: `task lint-skills` -> 0 holds.
      Done: Fixture 4 (good and false after, diff generated by the witness and pinned by `fact_diff.test.ts`), `evals/evals.json` scenario `fact-preservation`, step 6 names the new classes; `task lint-skills` exit 0.
      production entry: `src/scripts/detect_ai_tells.ts`
- [x] **3.2 Fact conservation as a free third bench metric**, per split, no <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      judge call.
      verify: the objective-only run prints `fact_added_pairs` per split.
      Done: `npx tsx src/scripts/bench_humanizer_eval.ts` exit 0 printed tune 11/12, holdout 8/8 `fact_added_pairs`; the regenerated reports were not committed — the canonical report backs `humanizer-tell-reduction`, whose rerun is 3.4.
      production entry: `src/scripts/bench_humanizer_eval.ts`
- [x] **3.3 `check_claims` flags a stale `last_verified`** older than the newest <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      date named in the claim text.
      verify: a fixture claim with a newer dated change fails.
      Done: `stale_last_verified` (`src/scripts/_lib/claims_stale_verified.ts`, kept out of `check_claims.ts` to hold the source-size ratchet) + ratchet `check_claims:stale-last-verified` (7 at introduction, `humanizer-tell-reduction` among them, listed as reported findings); `npx vitest run tests/scripts/check_claims.test.ts` 32/32 with the stale fixture exiting 2; `./scripts-run src/scripts/check_claims` exit 0.
      production entry: `src/scripts/check_claims.ts`
- [~] **3.4 Corpus repair and claim narrowing.** blocked-by: owner-instrument-change (owner). <!-- deferred-resolution: carried-to=road-to-rewrites-that-keep-their-facts-carried -->
      verify: `./scripts-run src/scripts/check_claims` -> 0 after the narrowed row.
       Remove supplied facts from the
      17 after-files as a new epoch, drop "same content" from the judge prompt,
      narrow `humanizer-tell-reduction` to what is measured. Changes the
      instrument behind a backed claim and a judged rerun is billable.

## Phase 4 — Dashes

- [x] **4.1 Ranges are not dashes** (digit–digit, years, pages, times, quarters) <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      at `detect_ai_tells.ts:385`; epoch line if counts move; DE clean corpus
      gains Gedankenstrich prose.
      verify: `npx vitest run tests/scripts/detect_ai_tells.test.ts` -> 0 with
      "Pages 12–14" counting 0 and "X – Y" counting 1, and
      `npx vitest run tests/scripts/prose_tells_metamorphic.test.ts` -> 0 holds.
      Done: range dashes excluded; no existing corpus dash count moved; `clean/de/12-gedankenstrich.md` added (counts 2) with the new pin and a dash-epoch note in `prose-tells-epochs.md`; both vitest runs exit 0.
      production entry: `src/scripts/detect_ai_tells.ts`

## Phase 5 — Register currency

- [x] **5.1 Humanizer data manifest** in the `refresh_cadence` format so <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      `check_corpus_staleness` covers it; `evidence_tier` and `suppressible`
      per family with a schema test.
      verify: `./scripts-run src/scripts/check_corpus_staleness` -> /humanizer/ and
      the schema test passes.
      Done: `src/skills/humanizer/data/manifest.json` (quarterly, `last_checked` 2026-11-03, 46 families: 27 `seeded`, 19 `probe`; style group and dash density `suppressible`); the gate now names the corpora it holds to a date and prints `humanizer`, exit 0; `humanizer_register_manifest.test.ts` 5/5 and red on a flipped tier.
      production entry: `src/scripts/check_corpus_staleness.ts`

## Phase 6 — Document-level hiding

- [x] **6.1 Rendering-layer hiding and a data-injection class** in <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      `untrusted-input-spotlighting.md` (background-colour text, tiny font,
      off-page, hidden layers, DOCX `w:vanish`).
      verify: `task check-refs` -> 0 and `task lint-skills` -> 0 holds.
      Done: § Document-level hiding (five rendering vectors, model-carried — no visible-vs-extracted gate) and § Data injection; `task check-refs` exit 0, `task lint-skills` exit 0.

## Phase 7 — Hiring side

- [x] **7.1 "AI-assisted screening" routing section** in <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      `src/skills/hiring-loop-design/SKILL.md`: route to `legal-practice-profile`,
      `privacy-review`, `dpa-review`; CVs as untrusted input; name-swap bias
      probe before any LLM ranking. No dated legal statements without a source.
      verify: skill linter green.
      Done: § AI-assisted screening routes the legal, data and vendor questions (named, not linked — cross-pack), keeps the untrusted-CV and name-swap-probe controls in the loop, and makes no legal statement; `task lint-skills` exit 0 (`[PASS] hiring-loop-design`).

## Phase 8 — Consumers of the witness

- [x] **8.1 Four inflation classes** (widened verb, supplied number, smoothed <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/gate-violation-baselines.json -->
      status, absorbed achievement) as checklists in `release-comms` and
      `roadmap-writing`.
      verify: `task lint-skills` -> 0 holds.
      Done: release-comms Step 4 carries the four checks plus the `--baseline` pointer; roadmap-writing points to `references/inflation-checklist.md` from Do NOT (SKILL.md held at 400 lines); `task lint-skills` exit 0, both skills PASS.
- [~] **8.2 Prose-fact clause in `ask-when-uncertain`** — a kernel-rule edit <!-- deferred-resolution: carried-to=road-to-rewrites-that-keep-their-facts-carried -->
      (own PR, 24 h soak). blocked-by: kernel-edit-own-pr (owner).
      verify: `task lint-skills` -> 0 in that PR.

## Not in this roadmap

- A career / CV domain pack and `career:*` commands — domain-adoption gate, no
  demand signal or maintainer named, and ADR-041 governs command verbs.
- A visible-vs-extracted text checker for PDF/DOCX (new dependency).

## Decisions

| # | Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|---|
| D1 | The active-estate addition is covered by the invocation and offset by archiving this file in the same PR | park in `later/` | the operator asked for execution in this run | a step cannot close in this PR → carry it |
| D2 | Word ↔ digit stays a reported difference | treat as benign | the earlier "literal on purpose" decision stands; no new evidence it misfires on real rewrites | a measured false-alarm rate on real humanizer output |
| D3 | No career/CV domain pack | adopt it | no demand signal, no maintainer, conflicts with ADR-041 | a written consumer request plus a volunteering maintainer |

## Blockers

### blocker: owner-instrument-change
- **Status:** resolved here by carry — still open, moved with step 3.4, to `later/road-to-rewrites-that-keep-their-facts-carried.md` on 2026-11-03
- **Owner:** user
- **Blocks:** step 3.4 only
- **What to do:** see the carried roadmap.
- **Resolved when:** the carried blocker resolves.

### blocker: kernel-edit-own-pr
- **Status:** resolved here by carry — still open, moved with step 8.2, to `later/road-to-rewrites-that-keep-their-facts-carried.md` on 2026-11-03
- **Owner:** user
- **Blocks:** step 8.2 only
- **What to do:** see the carried roadmap.
- **Resolved when:** the carried blocker resolves.

## Risk Register

| Risk | Mitigation |
|---|---|
| new classes false-alarm on real prose | 2.2 benign controls; report-only until 0 FP |
| 4.1 moves tell counts | epoch line in `prose-tells-epochs.md` |
