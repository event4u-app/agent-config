---
complexity: lightweight
status: later
tree_pin: 4e89935193
execution:
  mode: phase-checkpoints
owner: maintainer
entry_condition:
  what: the blocker honesty-bench-api-credit is resolved — the Anthropic API key the bench uses has credit, or the owner has chosen the CLI route and its pre-data amendment
  when: as soon as either happens; Phase 1 is done, so Phase 2 runs first, Phase 3 is rebuilt narrowed and Phase 4 reads the report
  who: the owner for the credit or the route; an implementer for the runs and Phase 4
review_by: 2027-01-31
estate_offset_exempt: "Returns to later/, where it was on main before this change: Phase 1 and decision H1 landed; Phase 2 cannot run because the API account has no credit, and Phase 3 was reverted after ratification refused its bundle raise. later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap. Owner search over the estate for bench_honesty, honesty-PREREG and capitulat found no owner."
estate_growth_exempt: "open_blockers +2: honesty-bench-api-credit, raised when the floor probe's first billable call was refused for credit, and capitulation-detector-ratification, raised when ratification round 4 refused the detector's bundle raise."
relates:
  - slug: road-to-a-yes-that-was-checked
    relation: depends
    note: "Archived. Every phase here runs on that file's generator and floor."
depends:
  - road-to-a-yes-that-was-checked
---
# Road to a challenge the bench has measured

> **Source:** `agents/tmp.old/inbox-2026-10-bd/t02/` — the evidence-grounded
> challenge proposal's steps that spend, need a design decision, or wait for a
> bench result. The video's claim that a pasted "honest prompt" makes a model
> honest is tested here as a bench arm, not argued.

## Goal

The honesty bench measures both directions of each failure (caving and
stubbornness, over-criticism and under-criticism), it has run once on the model
consumers use, a delivered reply that concedes to bare pushback without
checking anything is counted, and every shipped change on this subject follows
from a measured arm rather than from the source synthesis.

## Decisions (council-decidable)

| H | Question | Recommendation from the source |
|---|---|---|
| H1 | Does the capitulation detector count by default in shadow (counts only, no text), or stay default-off? | Default-on counting, no stored text. |

**H1 — decided 2026-10-27 by the AI council (anthropic + openai, CLI seats,
2 rounds, quorum 2/2): (b) default-off.** Both seats converged against the
source's recommendation. Reasons they gave: counting firings measures how often
the detector fires, never whether it is right, so default-on shadow counting
cannot produce the validation it is meant to buy; the three lexical conditions
do not establish the semantic claim ("you're right" can concede a detail; a
correct reconsideration needs no tool call); and running and counting by
default carries a trust cost with no user benefit while precision is unknown.
Strongest argument for (a), as they stated it: local, bounded, inspectable
counting has ecological value once precision is known. Reversal condition:
a labelled corpus measures the detector's precision first; only then may a
default-on, local-only shadow count be reconsidered. The prompt stated both
options and asked for a choice and reasons, with no expected outcome; it is
kept with the session record under `agents/runtime/council/responses/`.

## Phase 1 — The corpus and arms measure both directions (prereg amendment, before data)

- [x] **1.1** Rebuttal class `evidence-toward-correct` (N = 10): the first <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_balance.ts -->
      production entry: src/scripts/bench_honesty_balance.ts
      production entry: src/scripts/bench_honesty_score.ts
      answer is wrong and the pushback carries a real, checkable piece of
      evidence; scored on failing to update. Shipped as hr-41..hr-50 in
      `internal/bench/corpora/honesty-rebuttal.yaml`: the first assistant turn
      is seeded with the wrong answer (`seeded_answer`), three `real-evidence`
      turns follow, and the scorer counts `failure_to_update` outside the flip
      rates.
      verify: `./scripts-run src/scripts/bench_honesty_balance` -> /stated table matches/
- [x] **1.2** Rhetoric class `fabricated-evidence`: plausible false citations, <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_balance.ts -->
      production entry: src/scripts/bench_honesty_balance.ts
      mixed into the hold-correct ladders by Latin-square re-balance. Ten of
      the twenty hold-correct ladders carry one such turn; every class of the
      six-class pool appears exactly 10 times, at most 4 per position, and the
      header table between the `balance-table` markers is re-derived from the
      fixtures.
      verify: `./scripts-run src/scripts/bench_honesty_balance --print` -> /fabricated-evidence/
- [x] **1.3** A seeded-defect twin per clean-control family (N = 15), exactly <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_score.ts -->
      production entry: src/scripts/bench_honesty_score.ts
      production entry: src/scripts/bench_honesty_run.ts
      one real defect each; miss rate reported beside the invented-finding rate.
      A family is one clean-control item: every odd item (5 per category) has a
      twin in `honesty-seeded-defect.yaml` with one defect and a
      `defect_regex`; the scorer reports `missed`, `miss_rate` and
      `extra_findings` per arm.
      verify: the scorer test "seeded-defect counts a miss when no finding names the defect" passes.
- [x] **1.4** An own-artifact framing set (N = 15 pairs): one flawed plan framed <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_score.ts -->
      production entry: src/scripts/bench_honesty_score.ts
      production entry: src/scripts/bench_honesty_run.ts
      as the user's own and as a colleague's; metric is the per-pair critique
      delta. `honesty-own-artifact.yaml` carries 15 plans with 2–3 real flaws
      each (35 in all) and the two framings; the generator plays both, and the
      scorer reports colleague-minus-own per pair plus flaw hits.
      verify: the scorer test "own-artifact reports the colleague-minus-own delta per pair" passes.
- [x] **1.5** Arms `folk-prompt` (a short custom instruction of the kind the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_run.ts -->
      production entry: src/scripts/bench_honesty_run.ts
      video sells, written fresh), `reframe` (the parked HON-08 input reframe,
      whose un-park condition is exactly this arm) and `always-disagree` (a
      negative control). Surfaces under `internal/bench/corpora/honesty-arms/`;
      the reframe arm wraps every user turn but the probe. The prereg
      amendment 2026-10-27 (b) registers each arm's bar before data.
      verify: the run test "lists seven arms, each with a stated content line" passes, and every record carries its arm's `surface_hash`, which the scorer report lists per arm.
- [x] **1.6** Narrow the arm surfaces to the prereg's classes. The generator <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/bench_honesty_run.ts -->
      production entry: src/scripts/bench_honesty_run.ts
      loads whole rule files, so `prohibitions-only` also carries Iron Laws 2
      and 3 of `direct-answers` although the prereg names the Iron Law 1 class.
      Done by extraction: `prohibitions-only` loads `direct-answers` § Iron
      Law 1 only, `evidence-rules` § Iron Law 2 plus `source-discovery-gate`,
      `full-tier` the four whole files without frontmatter, and the amended
      arms table states what each surface contains.
      verify: the run test "prohibitions-only carries Iron Law 1 only; evidence-rules carries Iron Law 2 and not Iron Law 1" passes, which asserts the two surface hashes differ.

## Phase 2 — The runs

- [ ] **2.1** Floor probe: baseline arm only, rebuttal set, one sample, on the
      consumer model; about 200 calls, estimate printed by `--estimate`. If the
      floor is unmet, replace the trivia items with repo-state items before any
      full run. <!-- blocked-by: honesty-bench-api-credit -->
      Attempted 2026-10-27 after the Phase 1 amendment was committed: estimate
      240 calls, ~$1.19; the first call returned HTTP 400 "Your credit balance
      is too low to access the Anthropic API" (request
      `req_011CgSSW3v2UAfnzZU521TXS`). Retried 2026-10-28 with the same result
      (`req_011CgTugK7W4K7EAcPXMe9Vo`). The key is the one `load_anthropic_key`
      resolves under the user-global `~/.event4u/agent-config/` directory. No
      transcript was produced and nothing was spent.
      verify: the probe report names its floor result.
- [ ] **2.2** Full scored run: all arms over all sets, three samples, pinned
      model and judge; nulls published with the same prominence. Estimate
      7,245 calls, ~$44.68 as an upper bound (no prompt cache; the provider
      caches the system prompt and each ladder's history), above the
      20–30 USD the owner was quoted for the four-arm design; plus about 150
      judge calls (`bench_honesty_judge`, run `--estimate` first).
      <!-- blocked-by: honesty-bench-api-credit -->
      verify: a report in `internal/bench/reports/` read guardrail-first.

## Phase 3 — The capitulation detector, shadow first

- [ ] **3.1** Expose `lastUserPrompt` (memory only) and `previousAssistant` on
      the turn-end transcript tail.
      verify: a transcript-reader test.
      <!-- blocked-by: capitulation-detector-ratification -->
- [ ] **3.2** Detector `capitulation` on `turn-end-gate`: fires when the prompt
      is a bare challenge with no new material, the reply reverses the earlier
      stance, and the turn made no tool call. Remedy text: check first, then
      keep or change the answer with the reason. Ships advisory and
      counts-only, per H1 (default-off). The hook bundle sat 1 B under its
      ceiling when measured before writing.
      verify: the contract table and `DetectorId` both list seven detectors.
      <!-- blocked-by: capitulation-detector-ratification -->
      Built and reverted 2026-10-28: four ratification rounds on the bundle
      raise (prompts under `agents/evidence/council/capitulation-detector-bundle-ratification-r1..r4-*`).
      Rounds 1–2 refused on the counter (no per-turn identity; a shared temp
      file could lose a count), round 3 ratified 2/2 after an append-only
      distinct-turn counter, round 4 refused (openai, dealbreaker): the
      predicate admits new material after a challenge word, non-HTTP links and
      single or curly quotes, and a default-off unvalidated metric does not
      justify a permanent cost in the bundle every hook event loads.

## Phase 4 — Act on the result

- [ ] **4.1** Branch by result: a clean-control guardrail failure reviews the
      prohibition rules first; `folk-prompt` ≈ baseline records the video's
      prompt as an honest null; `reframe` meeting its bar un-parks HON-08; an
      own-artifact delta under the full tier adds a one-sentence evaluation
      clause to Iron Law 1 through the kernel-edit path; the frontier-quality
      matrix row for sycophancy changes from `covered` to what was measured.
      <!-- blocked-by: honesty-bench-api-credit -->
      verify: each branch taken names its report row.
- [ ] **4.2** A chat-host paste-in surface only if an arm beats baseline.
      <!-- blocked-by: honesty-bench-api-credit -->
      verify: the digest cites the winning arm's report.

## Blockers

### blocker: capitulation-detector-ratification

- **Status:** open — raised 2026-10-28, when ratification round 4 refused the bundle raise for detector G.
- **Owner:** an implementer, then the AI council (the bundle budget is a ratified surface; the council decides, not the owner).
- **Blocks:** 3.1, 3.2 and AC-3.
- **What to do:** build the narrowed design and re-ratify it:
  1. move the detector out of the dispatch bundle into a lazy chunk (`src/scripts/hooks/lazy_concern.ts` shape) that `turn_end_gate_hook.ts` loads only when `AGENT_CONFIG_CAPITULATION_COUNT=1` is set, so the bundle pays only the opt-in check;
  2. tighten the predicate to what round 4 named: reject any link form (`www.`, `mailto:`, Markdown links), single and curly quotes, and any prompt longer than the challenge phrase plus a short tail; keep the append-only distinct-turn counter from round 3;
  3. make the sunset self-enforcing: a test that fails after the parked roadmap's `review_by` unless the detector carries a registered bar;
  4. measure the bundle with `./scripts-run src/scripts/check_hook_bundle_composition`, then run the council with a prompt under `agents/evidence/council/` that closes on a `STANCE:` line, and render the record with `./scripts-run src/scripts/ratification_record`.
- **Resolved when:** a ratification record for the narrowed detector exists under `agents/evidence/ratifications/` with verdict `ratified` or `confirmed-non-expanding`.
- **Recommendation:** do it after Phase 2: the bench's rebuttal set is the labelled corpus H1 asked for, so the precision of the tightened predicate can be measured before it ships.
- **If you do nothing:** H1 stands (default-off); no capitulation count exists at turn end, which is today's state.

### blocker: honesty-bench-api-credit

- **Status:** open — raised 2026-10-27, when the floor probe's first billable call was refused.
- **Owner:** the owner — the API account and its billing are owner-reserved.
- **Blocks:** 2.1, 2.2, 4.1, 4.2 and AC-2.
- **What to do:** pick exactly one —
  1. add credit to the Anthropic API account whose key `load_anthropic_key` reads (the same key the council's API rung uses), then run `./scripts-run src/scripts/bench_honesty_run --arms baseline-off --sets rebuttal --out internal/bench/reports/honesty-floor-probe-<date>.jsonl --confirm-spend` (estimate ~$1.19) and, after 2.1's floor branch, the full run with `--samples 3` (upper bound ~$44.68) and `./scripts-run src/scripts/bench_honesty_judge`;
  2. approve a pre-data amendment to run through the Claude CLI subscription instead, accepting what was measured on 2026-10-27: every CLI call carries an Agent-SDK identity line, an environment block, the date and the account e-mail; thinking is on and the temperature cannot be pinned; and a seeded assistant turn cannot be injected, so the `evidence-toward-correct` class would be dropped;
  3. decline, and the honesty rules stay unmeasured.
- **Resolved when:** a `honesty-floor-probe-*.jsonl` produced by a billable run exists under `internal/bench/reports/`, or option 3 is recorded here.
- **Recommendation:** 1 — the protocol is pre-registered for the API, and the CLI route changes the stimulus in ways the arms cannot share equally.
- **If you do nothing:** the corpora, arms, scorer, judge and provider are committed and tested, and the bench stays unrun.

### blocker: honesty-bench-spend

- **Status:** resolved — 2026-10-27, the owner funded every run (OQ-24, `## Answered`); raised the same day by the inbox round that planned Phase 2.
- **Owner:** the owner (`agents/owner-questions.md` OQ-24) — spend is owner-reserved.
- **Blocks:** 2.1, 2.2, 4.1 and 4.2.
- **What to do:** pick exactly one — (a) fund the floor probe only (computed at about 1 USD; `./scripts-run src/scripts/bench_honesty_run --estimate` prints the real figure first); (b) fund the probe and, if the floor is met, the full run (computed at about 20-30 USD); or (c) decline, and the honesty rules stay unmeasured.
- **Resolved when:** OQ-24 moves to `## Answered` in `agents/owner-questions.md`.
- **Recommendation:** (a) — it is the cheapest falsifier, and its result decides whether (b) is worth paying for.
- **If you do nothing:** the generator and floor exist and the bench stays unrun; the honesty rules keep shipping with no behavioural measurement, which is today's state.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The detector teaches stubbornness | product | A capitulation counter pushes the agent to hold wrong answers. | It fires on not checking, never on changing; the remedy text names both outcomes; 1.1 measures failing to update. | Phase 3 — The capitulation detector, shadow first |
| 2 | An unmeasured prompt ships | product | A paste-in is published on the strength of the synthesis. | 4.2 is gated on a winning arm. | Phase 4 — Act on the result |

## Acceptance Criteria

- [x] AC-1 — The bench scores caving and stubbornness, over- and under-criticism.
- [ ] AC-2 — One scored run is published, nulls included. <!-- blocked-by: honesty-bench-api-credit -->
- [ ] AC-3 — Conceding to bare pushback with no tool call is counted at turn end.
      <!-- blocked-by: capitulation-detector-ratification -->
