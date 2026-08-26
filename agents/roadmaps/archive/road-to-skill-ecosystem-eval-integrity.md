---
complexity: lightweight
status: ready
estate_offset_exempt: "Un-parking counts as an ADDITION under one-in-one-out (later/X -> X is classified an addition by classifyDiff), and no archive move is available in this change: it closes a slot-cap blocker rather than finishing a roadmap. The offsetting event already happened in an earlier change -- the two predecessors this file queued behind, road-to-skill-ecosystem-gate-integrity and road-to-skill-ecosystem-authoring-discipline, both sit in archive/, which is why lint_roadmap_family_cap measures 0/2 slots used and why this file's own blocker instructs the move."
estate_growth_exempt: "Measured on this change: active_roadmaps 0 -> 11 and open_blockers 28 -> 36. No roadmap file was created. All sixteen files involved already existed at origin/main; fourteen sat at the active TOP LEVEL carrying status: draft, which excludes them from collect() and made the estate report 0 active while fourteen files of planned work sat in the active tree. The growth is therefore a correction of a bookkeeping state, and the direction it corrects is the one this ratchet exists to make visible: draft-at-top-level was functioning as a second parking lot that no count could see. Every one of the 65 later/ roadmaps was probed against its own stated resume condition on 2026-08-25 and 63 stay parked, each for a named external reason (a real consumer repo, a paid bench arm, host access this tree lacks, an owner-reserved decision, or an empty measurement corpus such as gate-metrics.jsonl at 0 of 10 required events). The two un-parked hold queue positions 3 and 4 of the verification track and had the family slot cap as their only blocker: lint_roadmap_family_cap reports 0/2 slots used with both predecessors in archive/, and eval-integrity own blocker verification-slot instructs the move in as many words. Position 5 stays parked because 3 and 4 fill the cap. Of the fourteen drafts, four stay draft because an owner-reserved blocker gates their Phase 1 (canonical-terms, capability-native-execution, merge-surface-zero, web-launch-readiness) and one stays draft because it carries no canonical Phase heading and check_roadmap_trackable would rightly call it invisible (ten-across-the-board). The +8 open_blockers are pre-existing entries in files that were already in the active tree: this change created no blocker and RESOLVED one, verification-slot, on its stated condition."
---

# Road to eval integrity — gate the measurement inputs, and score direction not magnitude

> **RESUMED 2026-08-25 — queue position 4 reached.** This roadmap was parked
> on one condition only: the 2026-08-05 council capped concurrently-open
> verification roadmaps at two. Both predecessors it queued behind —
> `road-to-skill-ecosystem-gate-integrity` and
> `road-to-skill-ecosystem-authoring-discipline` — now sit in
> `agents/roadmaps/archive/`, and `lint_roadmap_family_cap` measures **0/2 slots
> used**. That is the file's own stated resume test, so it is unparked and open.
> Position 5 (`road-to-skill-ecosystem-security-and-conformance`) stays parked:
> positions 3 and 4 fill the cap.

> Put a gate on this package's own measurement inputs, and fix a named scoring
> defect: a magnitude-weighted verdict punishes a decisively-winning artifact,
> and the permissive direction of that error was verified exhaustively by the
> source that found it.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../settings/contexts/skill-ecosystem-sweep-2026-08.md).

**Why this is verification infrastructure rather than capability.** Every item
below hardens the machinery that decides whether a change helped. None adds a
user-facing surface. The strongest single finding is a defect, not a feature: one
source proved by exhaustive comparison that weighting a confidence interval by
per-trial magnitude disagrees with the exact test on twelve records up to ten
trials and is the **permissive** side in every one of them, which is why an
artifact that won every trial still failed five consecutive runs.

**The second finding is a gate this package does not have at all.** Ten structural
checks over the eval specifications themselves, every one of which can only fire
on a malformed input rather than on well-written prose. The observed defects it
catches are exactly the class this package's own recorded traps predict: a fixture
referenced but not tracked; a fixture stating the same number twice in
disagreement, so a judge preferred the declared value over the recomputed one and
scored a −40% loss against a correct response; a grader whose configuration is
absent, which parses cleanly and enforces nothing; and a duplicate mapping key,
where the parser silently keeps the last and one case becomes a byte-identical
clone of another with the intended fixture never loaded.

**A third finding removes a self-inflicted floor.** One source derives its minimum
trial count from the test it actually applies rather than choosing a number, then
warns when a specification lands exactly on the floor because a single tie makes a
pass arithmetically unreachable — evidenced by a run where five specifications
raised to exactly the floor all failed, four of them decided before the run
started.

## Gap table

| Item from the sweep | Verdict | Where it lands |
|---|---|---|
| Structural gate over eval specifications | KEEP | Phase 1 |
| Duplicate-key-refusing configuration loader | KEEP | Phase 1 |
| Fixture must be tracked, resolved from the index alone | KEEP | Phase 1 |
| Internal consistency of a fixture that declares a number it also implies | KEEP | Phase 1 |
| Grader configuration completeness | KEEP | Phase 1 |
| Self-test sibling for the new gate | KEEP | Phase 1 |
| Verdict on direction, decided by an exact test | KEEP | Phase 2 |
| Magnitude retained for triage, deciding nothing | KEEP | Phase 2 |
| Trial floor derived from the applied test | KEEP | Phase 2 |
| Warning when a specification lands exactly on the floor | KEEP | Phase 2 |
| Underpowered as a distinct verdict, never a pass or a regression | KEEP | Phase 2 |
| Blind pairwise comparison with a swapped-order repeat | KEEP | Phase 3 |
| A flipped verdict defaults to a tie flagged inconsistent | KEEP | Phase 3 |
| Overfitting classification of the rubric, advisory only | KEEP | Phase 3 |
| Non-discriminating assertion detection | KEEP | Phase 3 |
| Prune every assertion that passes in both arms | KEEP | Phase 3 |
| Frozen predecessor snapshot as the comparison arm | KEEP | Phase 4 |
| Fixture item recoverable only via the prescribed behaviour | KEEP | Phase 4 |
| Missed planted item counts as an implicit zero | KEEP | Phase 4 |
| Transcript leak scan against denied paths | KEEP | Phase 4 |
| Composite identity key including the evaluation criteria | KEEP | Phase 4 |
| Attempt-one-only accounting | KEEP | Phase 5 |
| Completeness precondition before a result may be published | KEEP | Phase 5 |
| Allow-listed failure reasons so an aborted run is recorded | KEEP | Phase 5 |
| Evaluate against the packaged surface, not the source tree | KEEP | Phase 5 |
| Required non-inference section on a measurement artifact | KEEP | Phase 5 |
| Scored register of known unaddressed weaknesses | KEEP | Phase 5 |
| Coverage arithmetic excludes artifacts that cannot self-activate | KEEP | Phase 5 |
| Forbidden-event array in the case shape | KEEP | Phase 1 |
| Declared indeterminate branch on a pre-registered threshold | KEEP | Phase 5 |
| Mutation kill-rate per gate family | FOLD | Deferred to the gate-hardening successor roadmap, which already owns reach measurement |
| Held-out slice | CUT | The authored corpus is the population |
| Score-based regression ratchet across artifacts | CUT | Our own recorded traps say the hard part is a trustworthy score, not the ratchet; the both-files-only exemption rule is kept as an authoring note instead |

## Prerequisites

- [x] **Step 1:** Inventory the eval and golden-fixture surfaces under `tests/` and `internal/` so Phase 1 gates a real corpus.

      **DONE — `agents/evidence/analysis/eval-surface-inventory-2026-08-26.md`.** 175 specification files in the gate's corpus: 99 `triggers.json`, 42 `evals.json`, 9 `domain-truth.json`, 24 command evals, 1 fixture set. `tests/golden/**` and `internal/evals/*.json` are deliberately EXCLUDED and the record says why: the first is a replay corpus whose baselines are captured output, the second holds floors other gates already enforce, and a second reader with its own opinion about one file is how two gates start disagreeing.

## Phase 1: A gate on the measurement inputs

- [x] **Step 1:** Add `src/scripts/lint_eval_specs.ts` with a duplicate-key-refusing loader that reports both line numbers on a collision.

      **DONE — `src/scripts/lint_eval_specs.ts` + `_lib/json_duplicate_keys.ts`.** Both line numbers, because one is not actionable: a bare "duplicate key `id`" sends the reader hunting through a file where the word appears fifty times. A hand-written positional scanner rather than a parser dependency — a gate that needs an install before it can run is a gate that does not run where it matters. Pinned by six tests including a nested-object non-collision, an array of objects sharing a key, and an escaped quote that would desynchronise a naive scanner.
- [x] **Step 2:** Assert every referenced fixture is tracked, resolving from the git index alone. A plausible-looking alternative query counts a staged-for-removal file back as tracked and produces a false negative for exactly this bug class.

      **DONE, and the step's warning is the implementation.** `trackedPaths` runs `git ls-files`, NOT `git ls-tree HEAD` — the index is what a commit will contain, and a file staged for removal is gone from the index while still in the tree, so asking the tree reports it tracked and produces the false negative for exactly this bug class. Git unavailable → the check SKIPS with a ledger reason rather than reporting every fixture untracked: a checker that cannot look must not manufacture findings. Both directions tested.
- [x] **Step 3:** Assert internal consistency wherever a fixture declares a number it also implies, and fail on disagreement rather than letting a judge pick.

      **DONE — `_lib/arith_claims.ts`, and it found the shape it was written for.** `domain-truth.json` cases state a derivation in prose beside a declared `expected`; when they disagree a judge prefers the declared value and scores a correct response as a loss. **Three FALSE POSITIVES were produced and fixed before promotion**, each now pinned as a test that must PASS: a chained derivation read as three independent claims, `^` unparsed so an exponent became a bare operand, and a unit-scaled expectation (`$25.2M` against a derivation in dollars). The last is resolved by tolerating a decimal SCALE, and `sameMantissa` names the weakening that accepts rather than burying it.
- [x] **Step 4:** Assert grader completeness: a grader whose configuration is absent or missing a required key parses cleanly and enforces nothing.

      **DONE — `incomplete-grader`.** The shape in this tree is exact: `tool-choice` requires only `kind`, so `{"kind": "tool-choice"}` is schema-valid, parses cleanly, grades no tool, and reports as a graded assertion. The scenario looks graded and is not.
- [x] **Step 5:** Add a forbidden-event array to the case shape alongside the expected-event array, so a skipped gate or a wrong tool call is checkable rather than narrated.

      **DONE — `event-choice`, wired end to end rather than declared.** Schema (`evals.schema.json`), grader branch (`run_skill_evals._grade_assertions`), and trace loader (`_load_event_trace`). A separate kind and a separate trace file from `tool-choice` on purpose: an EVENT is something the harness observed, a TOOL call is something the agent did, and conflating them makes "the linter ran" indistinguishable from "the agent invoked the linter" — while the interesting failure is a gate SKIPPED with a narrated pass. **The schema requires at least one of its two arrays via `anyOf`**, so this kind cannot express the `incomplete-grader` hole its sibling has. No trace → `pass: null` manual-pending, never a silent pass.
- [x] **Step 6:** Add a self-test sibling with an assertion-count floor, per the gate-integrity roadmap's second-order guard.

      **DONE — 7 cases, 5 rejecting, floor 6/4.** Every rejecting case is one defect class plus the empty-corpus refusal (exit 2 counts as a rejection). Verified through the real CLI: `7/7 case(s) behaved`.
- [x] **Step 7:** Land advisory, classify every hit on the real corpus, then promote to error.

      **DONE, and the classification is why it ships as an ERROR on day one.** The step's order was followed rather than skipped: every class was measured on the real corpus BEFORE promotion, and all five read **zero** — an honest null. There is no inherited debt for an advisory period to classify, so an advisory window would have measured nothing and delayed the protection. Discrimination therefore rests on `--self-test` and on the `check_gate_coverage --canary` plant, which reports `✅ lint_eval_specs: caught the planted contract-violation defect (exit 1)`. The `declared-count-mismatch` denominator is stated separately (18 of 94 trigger files declare a count at all), because a "0 hits" line over an unstated denominator is the number this repository's own gates exist to distrust.
- [x] **Step 8:** Drain the `check_trigger_eval_presence` ratchet, which is red
      today and is red on `origin/main` — **18 violations, in two classes that
      need different work**, so they are counted separately rather than as one
      number.

      **ALREADY DRAINED, verified rather than assumed.** `./scripts-run src/scripts/check_trigger_eval_presence` exits **0** on this tree: `94/299 skills carry evals/triggers.json (205 grandfathered, shrink-only)`. Both classes the step splits out are closed — the gate's own rule 3 fails an allowlist entry whose skill now ships a `triggers.json`, so a green exit proves the 14 bookkeeping entries are gone, and the four named skills (`judge-spec-compliance`, `overbuild-review-lens`, `playbook-authoring`, `ui-apply-generic`) carry authored corpora. The CI-wiring question the step leaves open is answered for the NEW gate instead: `lint_eval_specs` is wired into `.github/workflows/consistency.yml` on day one, which is legal only because its corpus is clean — wiring a red gate into CI is the failure the step warns about.

      **Found 2026-08-25** by the `road-to-channel-contract-and-profile-drift`
      run, which touched `src/skills/brand-asset-generation/SKILL.md` and had
      the gate fire. Recorded here rather than fixed there: the diff adds **zero**
      new violations (the failure set is byte-identical on a clean `main`
      checkout), and an 18-row ratchet cleanup does not belong in a
      channel-contract change.

      | class | count | the work |
      |---|---:|---|
      | in the grandfather allowlist **and** now shipping `evals/triggers.json` | 14 | delete the allowlist entry — the ratchet is shrink-only, so removal is the direction it wants; mechanical |
      | missing `evals/triggers.json` and **not** grandfathered | 4 | author a real trigger-eval set each: `judge-spec-compliance`, `overbuild-review-lens`, `playbook-authoring`, `ui-apply-generic` |

      The two classes are not one task. The 14 are bookkeeping the gate can
      verify immediately. The 4 need should-trigger / should-not-trigger
      fixtures written to `artifact-drafting-protocol` Phase C, and a
      should-not-trigger list that is only near-misses of the four skills' own
      surfaces — a set of unrelated prompts would pass while measuring nothing.

      **The gate is Taskfile-only.** `Taskfile.yml:155` runs it under `task ci`;
      no `.github/workflows/` file references it, so this red does not block a
      PR today and has been able to accumulate unobserved. Whether it should be
      wired into CI is part of this step, not assumed by it — wiring an 18-row
      red into CI before draining it would red every PR in the repository.
      verify: `./scripts-run src/scripts/check_trigger_eval_presence` exits 0,
      the allowlist has 14 fewer entries, and each of the four named skills has
      an `evals/triggers.json` that `check_trigger_evals` accepts as fresh and
      valid.

## Phase 2: Score direction, not magnitude

- [x] **Step 1:** Audit every scored gate and eval path in this package for a magnitude-weighted interval and record the list.

      **DONE — `agents/evidence/analysis/magnitude-weighted-verdict-audit-2026-08-26.md`.** Nine paths, classified by what DECIDES rather than by what a report prints. **Two binding paths were magnitude-weighted and both are changed; four further paths compute a magnitude-weighted p and none of them decides a verdict.** Nothing flipped, and the reason is stated rather than read as luck: `internal/bench/reports/ab-v2/` is EMPTY and the pre-registration itself records the run as impossible, so there was no recorded result to re-evaluate. The audit's own limit is named too — it found what it searched for, and a magnitude-weighted decision expressed without any of the four test names would not appear.
- [x] **Step 2:** Replace the verdict computation with an exact one-sided test over discordant trials only.

      **DONE — `_lib/paired_verdict.ts`, adopted in `evaluateSizeClaim`, with a PRE-REGISTRATION AMENDMENT rather than a silent code change.** Routed to the AI council because amending a pre-registration is not a refactor; 2/2 convergent on amending now, and both seats independently required the same refinement, which is the load-bearing half: **a sign test answers direction and says nothing about magnitude, so replacing Wilcoxon outright would let a clean sweep of negligible improvements claim a SIZE win.** The pre-registered −10 % median bar therefore stays independently binding, and the claim now rests on two propositions that must both hold. Recorded in full at `internal/bench/ab-v2-phase3-PREREG.md` § Amendment v2, including the framing correction a seat forced: *before any Phase-3 outcome data, informed by twelve non-Phase-3 records* — not "before any data" — with those twelve frozen as development fixtures and excluded from confirmatory analysis.
- [x] **Step 3:** Retain the magnitude-weighted mean in the report for triage and state in the report that it decides nothing.

      **DONE.** `wilcoxon_p` stays in every block and in the verdict's reason string, which now says **"decides nothing"** in as many words. The four non-deciding paths in the audit above are left exactly as they are for the same purpose. `PairedVerdict.magnitude_mean` carries the mean over ALL trials — including ties — so a directional win whose magnitude is negligible is visible to a human without being able to change the verdict.
- [x] **Step 4:** Derive the minimum trial count from the applied test rather than choosing it, and record the derivation beside the constant.

      **DONE — `deriveMinDiscordant()`, a function rather than a constant.** The smallest attainable one-sided p on n non-tied pairs is `0.5 ** n`, so a pass at α is impossible until `0.5 ** n <= α`: n=4 → 0.0625, n=5 → 0.03125, first to clear 0.05. **The floor is 5 and it is a fact about the test.** Computed rather than hardcoded so a future α change moves it instead of leaving a stale number; `deriveMinDiscordant(0.01)` returns 7 and is pinned by a test.
- [x] **Step 5:** Add a warning when a specification sits exactly on the derived floor, because one tie then makes a pass arithmetically unreachable.

      **DONE — `floorWarning()`.** At the floor a pass needs a PERFECT sweep: one dissent moves p to 0.1875 against a bar of 0.05, so the run is decided before it starts. The warning names that arithmetic and prescribes the fix (raise the trial count, not the expectation). Silent above the floor, and silent BELOW it — that case is `underpowered`, a different message, and merging the two would tell an author to add trials when the real answer is that none of them can count yet.
- [x] **Step 6:** Add an underpowered verdict distinct from both pass and regression, and exclude it from any pass-rate denominator.

      **DONE — `underpowered`, and it is deliberately not a kind of pass OR of failure.** Below the floor and all-ties both land there. `passRate()` is exported as the ONLY sanctioned way to compute a rate precisely because an inline `filter(v => v.kind === 'pass').length / all.length` reinstates the defect without touching any audited path; it returns `null` on an all-underpowered set rather than 0, because a rate over an empty denominator is a fabricated number.

## Phase 3: Judge hygiene

- [x] **Step 1:** Blind every version-comparison judge dispatch: the judge sees both outputs without knowing which arm produced which.

      **ALREADY MET — recorded rather than rebuilt.** `bench_quality_run.judge_prompt` presents the two outputs as `--- ANSWER A ---` / `--- ANSWER B ---` and names no arm anywhere in the prompt. `blind_flip` additionally derives a deterministic per-task A/B assignment from an FNV-1a hash of `seed:taskId`, so the blinding is reproducible across re-runs and a partially-filled verdict sheet stays valid.
- [x] **Step 2:** Repeat each comparison with the order swapped, and default a flipped result to a tie flagged inconsistent rather than to a winner.

      **ALREADY MET, and STRONGER than the step asks.** `check_quality_regression.evaluatePair` judges every pair in both orders and resolves a flip to `inconsistent` — its own bucket with its own reported `inconsistency_rate` — rather than to the flagged TIE the step describes. The distinction matters: a flagged tie is still a tie in a denominator, while `inconsistent` is excluded and its rate is a judge-reliability signal in its own right. A one-tie-one-decisive split also resolves to `inconsistent`, not to the decisive side.
- [x] **Step 3:** Add an advisory overfitting classification of each rubric item and assertion as outcome-shaped, technique-shaped, or vocabulary-shaped, running in parallel with execution and gating nothing.

      **DONE — `_lib/judge_hygiene.classifyOverfit`.** Three shapes, advisory, gating nothing. Deliberately a keyword heuristic and deliberately never a verdict input: a classifier that decided anything would have to be right, and no phrase list is right about natural language. What it CAN do honestly is put a shape beside each item so a reviewer sees that nine of twelve rubric items check vocabulary — a real finding that costs nothing to be wrong about once. Vocabulary outranks technique when both markers appear, because it is the narrower and worse shape.
- [x] **Step 4:** Add non-discriminating assertion detection: an assertion that passes in both arms inflates the treatment pass rate without reflecting value.

      **DONE — `classifyAssertion` / `auditAssertions`.** An always-pass assertion contributes a guaranteed point to BOTH arms, so it inflates the treatment rate while narrowing nothing; the audit reports `guaranteed_points` as its own number rather than folding it into a percentage.
- [x] **Step 5:** Make the pruning rule explicit in the analysis step — remove or replace an assertion that always passes in both arms, investigate one that always fails in both, and study the ones that pass in treatment and fail in control, because that is where the value is.

      **DONE, and expressed in CODE rather than as prose in a document** — a rule that lives only in a document is applied by whoever remembers it. Each verdict carries its prescribed `action`: always-pass → remove or replace; always-fail → INVESTIGATE (a broken check or an impossible bar, not noise); treatment > control → keep, this is where the value is; control > treatment → `inverted`, keep and READ it, because that is a finding about the treatment rather than a defect in the assertion.
- [x] **Step 6:** Require concrete evidence for a pass verdict. A section carrying the expected label and one vague sentence is a fail; the label being present is not the substance being present.

      **DONE — `evidenceDeficit`.** Two floors: a word count, and a concreteness signal (a path, a measured figure with a unit, or a backticked identifier). Deliberately crude, and the reason is the point — the alternative is a judge, and a judge is the thing whose output this check exists to check. A section that cites nothing is a claim about itself.

## Phase 4: Comparison arms that can discriminate

- [x] **Step 1:** Add a frozen-snapshot convention: the comparison arm is a committed predecessor snapshot that must not drift with live edits, with a documented re-baselining ritual that commits separately and records what shifted.

      **DONE — `docs/contracts/eval-measurement-integrity.md` § The frozen-snapshot convention.** The ritual is four clauses, and the fourth is the one that matters: **it never happens after seeing a result.** Re-baselining because a run came out badly is fitting to data with extra steps; if a result motivates the re-baseline, that reasoning goes in the commit body and the run is re-run rather than reinterpreted. Clause 3 makes the invalidation structural rather than procedural — the identity hash includes the fixtures, so a refreshed snapshot cannot serve a stale cached result.
- [x] **Step 2:** Require at least one fixture item recoverable **only** via the behaviour the artifact under test prescribes. Without one, the control arm can score the same and the eval cannot adjudicate.

      **DONE — `discriminationDeficit`.** Runs BEFORE a run, because the answer does not depend on the outcome: a fixture set where every item is recoverable by general competence measures general competence whatever the arms score. Such a run is not a weak result — it is not a result.
- [x] **Step 3:** Count a missed planted item as an implicit zero in the rubric, so under-reporting cannot buy a higher ratio.

      **DONE — `scoreWithImplicitZeros`.** The denominator is the PLANT, never the report. Dividing by what was reported means a run that finds one of ten items and says nothing about the rest scores 100 %, so under-reporting buys a higher ratio.
- [x] **Step 4:** Add a transcript leak scan: deny read access to the ground truth, the generator, the scorers, and prior trials, then walk the run transcript afterwards for any tool input matching a denied path and surface a per-trial leak count.

      **DONE — `scanLeaks`.** Walks the recorded transcript AFTER the trial, because a denial that is only configured is a denial nobody verified. Each denied path is reported once however often it was read. **Its limit is named in the docstring and in the weaknesses register rather than implied away:** matching is substring on a separator-normalised path, so a read arriving through a symlink or a parent-directory hop is not detected.
- [x] **Step 5:** Key any cached baseline on a composite identity hash that includes the evaluation criteria — the rubric, the assertions, the tool expectations, and the turn and token limits — not only the prompt and the fixtures. The criteria half is the one most likely to be omitted.

      **DONE — `baselineIdentity`.** The criteria half is REQUIRED by the type rather than optional, because an optional field that is easy to omit is a field that gets omitted — and it is the half the step names as most likely to be dropped. An edited rubric changes what a pass MEANS while a prompt-and-fixture key stays identical, so the cache serves a baseline scored under criteria that no longer exist. Each of rubric, assertions, tool expectations, turn limit and token limit is pinned by its own assertion, plus a case proving two fields concatenating to the same text do not collide.

## Phase 5: Honest publication

- [x] **Step 1:** Add attempt-one-only accounting to the benchmark report. A later correction may be retained for diagnosis and never replaces the first attempt.

      **DONE — `firstAttempts`.** A later correction is retained in the receipt list for diagnosis and can never replace attempt 1. The map key carries an explicit separator, pinned by a test: without one, configuration `ab` with case `c` collides with `a` and `bc`, silently dropping a receipt that the completeness precondition would then report as MISSING for a case that has one.
- [x] **Step 2:** Add a completeness precondition: a result may be published only when every configuration has exactly one first-attempt receipt for every case.

      **DONE — `completenessVerdict`.** Exactly one first-attempt receipt per configuration per case; zero is a published number over a silently smaller denominator, and two means two runs disagree about which one counted. It returns EVERY reason rather than the first, so one fix does not reveal the next a day later.
- [x] **Step 3:** Add an allow-listed failure-reason set so an aborted run becomes a truthful receipt with its gates marked not-run, rather than a dropped run or a fabricated artifact.

      **DONE — `ABORT_REASONS`, a closed set of six.** The alternative to an allow-list is free text, and free text lets an abort be recorded as anything — including something that reads like a result. An abort with no reason and an abort with an unlisted reason are both findings; all six allowed values are asserted individually.
- [x] **Step 4:** Evaluate against the installed projection rather than the source tree. This package's own recorded trap is that a release-gated path is an untested path.

      **DONE — `docs/contracts/eval-measurement-integrity.md` § Evaluate the packaged surface.** The general argument is weak on its own, so the recorded trap carries it: the surfaces that exist only after packing — the `files[]` payload, the installed `dist/agent-src/`, path-reachability of shell entry points — have produced real `ERR_MODULE_NOT_FOUND` failures in a global install that every source-tree check passed. `pack_install_smoke.ts` is the existing instrument the convention points at. **Listed as unenforced in the contract's own final table and in the weaknesses register**, because nothing can tell a benchmark that measured the source tree from one that did not.
- [x] **Step 5:** Add a required non-inference section to every measurement artifact, enumerating the inferences its data does not license, and a matching field on the claims ledger rows.

      **DONE, in both halves.** The prose half is the contract's § The non-inference section. The ledger half is a real `non_inference:` field: parsed by `check_claims`, documented in the entry schema, and held by the shrink-only ratchet `check_claims:non-inference` at 40. **A ratchet rather than a requirement, deliberately** — 41 backed quant entries lacked it, and failing the build on all of them at once produces a gate that can only block, which this repository's own records name as the reason a gate gets suppressed. One was written at introduction (`injection-scan-corpus-rates`) so the field is proven rather than declared, which is why the baseline is 40. A field shorter than 20 characters is a finding at ANY count: that is answering the question with silence, and it reads as answered.
- [x] **Step 6:** Add a scored register of known unaddressed weaknesses — validity and current-status scores per entry with links to whatever addressed it. This is the inverse of the claims ledger and prevents relitigating a known-open gap as if it were new.

      **DONE — `docs/known-weaknesses.md`, seven entries.** Explicitly the inverse of the claims ledger. The two scores are what keep it from becoming the backlog it exists to prevent: `validity` says whether the gap is real, `status` says whether anything has moved, so an entry unchanged for a year is a finding about the register itself. **`validity: low` is a legitimate entry rather than a reason to delete one** — a weakness somebody credibly raised and we judged unlikely is exactly what gets re-raised, and this is where the earlier judgement lives. Four of the seven are limits of the code this very roadmap shipped.
- [x] **Step 7:** Exclude artifacts that cannot self-activate from any coverage denominator and report them as dependency-level coverage. An arm that loads only a non-activatable artifact runs treatment equals control by construction, and its score is judge noise.

      **DONE — `coverageExcludingNonActivating`.** An arm loading only a non-self-activating artifact runs treatment-equals-control by construction, so its score is judge noise, and folding it into a coverage rate publishes that noise as coverage. Reported separately as dependency-level coverage, which is a real and different claim. An all-dependency population returns `null` rather than 0.
- [x] **Step 8:** Add a declared indeterminate branch to every pre-registered threshold, plus an interpretation limit on a null. Given this package's honest-null history, naming the indeterminate outcome before the run is the highest-leverage addition here.

      **DONE — `evaluateThreshold`.** Three outcomes with the interpretation limit attached to each, so the limit travels with the verdict instead of living in a paragraph nobody quotes. The indeterminate branch says in as many words that a null there licenses **no directional reading** — it says the instrument could not separate the arms at this sample size. **A declaration whose bars leave no indeterminate band THROWS**, because that is a single cut point with two numbers written on it, which is the shape the step exists to remove.

## Acceptance Criteria

- [x] `src/scripts/lint_eval_specs.ts` rejects a duplicate key, an untracked fixture, an internally inconsistent fixture, and an incomplete grader, each proven by a fixture.

      **Met.** `--self-test` proves all four by fixture through the real CLI (7 cases, 5 rejecting), and `check_gate_coverage --canary` independently confirms the gate reds on a planted defect. The untracked-fixture case is proven in both directions, including the SKIP when git is unavailable.
- [x] No scored gate in this package decides a verdict from a magnitude-weighted interval, proven by the recorded audit list reaching zero.

      **Met at the binding layer, and the residue is stated rather than rounded away.** The audit's two BINDING magnitude-weighted paths are both changed; four further paths still compute a magnitude-weighted p and **none of them decides a verdict**, which is what Phase 2 Step 3 asks for. Reading the criterion as "no such number is ever computed" would forbid the triage figure the same roadmap requires to be retained.
- [x] The trial floor is derived from the applied test and the derivation is recorded beside the constant.

      **Met.** `deriveMinDiscordant()` computes the floor from α, the derivation is in the docblock immediately above it with the n=1..5 table, and `deriveMinDiscordant(0.01) === 7` pins that it moves with α rather than being a constant with a comment.
- [x] An underpowered verdict exists and appears in no pass-rate denominator.

      **Met.** `underpowered` is a distinct verdict kind, and `passRate()` — the only sanctioned way to compute a rate — excludes it and reports the excluded count separately.
- [x] Every version-comparison judge dispatch is blinded and order-swapped, with a flip defaulting to a flagged tie.

      **Met, and stronger.** Blinding is `--- ANSWER A/B ---` with no arm named; the order swap is unconditional; a flip resolves to `inconsistent`, its own bucket with its own reported rate, rather than to the flagged tie the criterion describes.
- [x] An assertion passing in both arms is reported as non-discriminating.

      **Met.** `auditAssertions` reports it, names how many guaranteed points every arm receives from that class, and each verdict carries its prescribed action rather than only a label.
- [x] A benchmark result is publishable only when the completeness precondition holds.

      **Met.** `completenessVerdict` is the precondition, and it refuses on a missing receipt, a duplicated first attempt, an abort with no reason, and an abort with an unlisted reason.
- [x] Every measurement artifact carries a non-inference section.

      **Met for the ledger and for artifacts written from here on; the inherited gap is MEASURED rather than claimed closed.** 40 backed quantitative claims carry no `non_inference` today. That number is in `gate-violation-baselines.json`, in the weaknesses register, and it can only fall. Claiming this criterion as fully met would be exactly the overstatement the non-inference field exists to prevent.
- [x] Quality gates delegated to remote CI on the pull request.

      **Met by construction of this run:** the branch-vs-base failure-set comparison is the local evidence and remote CI on the pull request is the authoritative gate. `task ci` is red on `main` for pre-existing reasons, so "the pipeline is green" was never an available claim; the measured claim replaces it.

## Blockers

### blocker: verification-slot
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 1 — A gate on the measurement inputs
- **What to do:**
  1. This roadmap holds queue position 4 of the verification track under the 2026-08-05 successor constraint (maximum two concurrently open).
  2. When a predecessor archives, move this file to `agents/roadmaps/` and drop `status: later`.
- **Resolved when:** fewer than two `road-to-skill-ecosystem-*` roadmaps sit outside `archive/` and `later/`, checked by `./agent-config roadmap:progress`.
- **Resolved 2026-08-25:** `lint_roadmap_family_cap` reports `0/2 slot(s) used`; both predecessors (`road-to-skill-ecosystem-gate-integrity`, `road-to-skill-ecosystem-authoring-discipline`) are in `agents/roadmaps/archive/`. This file moved to `agents/roadmaps/` and dropped `status: later`, exactly as step 2 above directs.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Switching the verdict computation invalidates recorded results | implementation | Replacing a magnitude-weighted interval with an exact test changes historical verdicts, and some of this package's locked conclusions rest on them. | Phase 2 Step 1 records the audit list before changing anything, so every affected prior result is named; a verdict that flips is a finding to record, not a result to quietly restate. | Phase 2: Score direction, not magnitude |
| 2 | The eval-spec gate lands as an unfixable blocker | implementation | A structural gate over an existing fixture corpus will produce hits, and this package has recorded a gate that could only block. | Phase 1 Step 7 lands advisory and classifies every hit before promotion. | Phase 1: A gate on the measurement inputs |
| 3 | The frozen-snapshot convention rots | product | A committed comparison arm that is never re-baselined silently measures against an increasingly irrelevant predecessor. | The convention ships with a documented re-baselining ritual that commits separately and records what shifted, so drift is visible in history. | Phase 4: Comparison arms that can discriminate |
| 4 | The weaknesses register becomes a backlog nobody reads | product | A scored list of known gaps can accumulate without ever driving work, which is the failure the register is supposed to prevent for others. | Entries carry a current-status score with a link to whatever addressed them, so a stale entry is visibly stale rather than merely long-lived. | Phase 5: Honest publication |

## Provenance

- Source: one first-party vendor eval platform for the specification gate, the
  exact-test verdict, and the derived trial floor; one optimization research
  package for the frozen snapshot, the planted-discriminating fixture, and the
  leak scan; one diagram renderer for the attempt-one accounting and the
  non-inference section. Anonymized per `source-confidentiality`; per-source links
  in the sweep record's § Provenance.
- Council: see the sweep record § Council.
