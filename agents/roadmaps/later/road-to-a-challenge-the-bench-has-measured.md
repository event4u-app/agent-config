---
complexity: lightweight
status: later
execution:
  mode: phase-checkpoints
entry_condition:
  what: road-to-a-yes-that-was-checked is archived (the generator, dry run, estimate and floor exist), and OQ-24 is answered for the Phase 2 runs
  when: after that roadmap closes; Phase 1 needs no answer and can start then
  who: an implementer for Phase 1 and the detector; the owner for the Phase 2 spend; the AI council for decision H1
review_by: 2027-01-31
estate_offset_exempt: "Parked under later/ in the same change that adds its active sibling road-to-a-yes-that-was-checked; later/ is excluded from the dashboard and from /roadmap:process-*, so it adds no active roadmap. Owner search over the estate for bench_honesty, honesty-PREREG and capitulat found no owner."
estate_growth_exempt: "open_blockers +1: honesty-bench-spend is a new owner-reserved spend decision this round created (OQ-24); later_roadmaps +1 is this file."
relates:
  - slug: road-to-a-yes-that-was-checked
    relation: depends
    note: "Every phase here runs on that file's generator and floor."
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

## Phase 1 — The corpus and arms measure both directions (prereg amendment, before data)

- [ ] **1.1** Rebuttal class `evidence-toward-correct` (N = 10): the first
      answer is wrong and the pushback carries a real, checkable piece of
      evidence; scored on failing to update.
      verify: the corpus balance table is re-derived by script.
- [ ] **1.2** Rhetoric class `fabricated-evidence`: plausible false citations,
      mixed into the hold-correct ladders by Latin-square re-balance.
      verify: the same balance script.
- [ ] **1.3** A seeded-defect twin per clean-control family (N = 15), exactly
      one real defect each; miss rate reported beside the invented-finding rate.
      verify: the scorer reports both rates.
- [ ] **1.4** An own-artifact framing set (N = 15 pairs): one flawed plan framed
      as the user's own and as a colleague's; metric is the per-pair critique
      delta.
      verify: the scorer reports the delta per pair.
- [ ] **1.5** Arms `folk-prompt` (a short custom instruction of the kind the
      video sells, written fresh), `reframe` (the parked HON-08 input reframe,
      whose un-park condition is exactly this arm) and `always-disagree` (a
      negative control).
      verify: the arms table lists seven arms and each system surface is hashed
      into the report.
- [ ] **1.6** Narrow the arm surfaces to the prereg's classes. The generator
      loads whole rule files, so `prohibitions-only` also carries Iron Laws 2
      and 3 of `direct-answers` although the prereg names the Iron Law 1 class.
      Either extract the named sections or amend the arms table to say whole
      files, before the first scored run.
      verify: a dry run of `bench_honesty_run` records a different
      `surface_hash` for `prohibitions-only` than for `evidence-rules`, and the
      arms table states what each surface contains.

## Phase 2 — The runs

- [ ] **2.1** Floor probe: baseline arm only, rebuttal set, one sample, on the
      consumer model; about 200 calls, estimate printed by `--estimate`. If the
      floor is unmet, replace the trivia items with repo-state items before any
      full run. <!-- blocked-by: honesty-bench-spend -->
      verify: the probe report names its floor result.
- [ ] **2.2** Full scored run: all arms over all sets, three samples, pinned
      model and judge; nulls published with the same prominence.
      <!-- blocked-by: honesty-bench-spend -->
      verify: a report in `internal/bench/reports/` read guardrail-first.

## Phase 3 — The capitulation detector, shadow first

- [ ] **3.1** Expose `lastUserPrompt` (memory only) and `previousAssistant` on
      the turn-end transcript tail.
      verify: a transcript-reader test.
- [ ] **3.2** Detector `capitulation` on `turn-end-gate`: fires when the prompt
      is a bare challenge with no new material, the reply reverses the earlier
      stance, and the turn made no tool call. Remedy text: check first, then
      keep or change the answer with the reason. Ships advisory and
      counts-only, per H1; promotion goes through the detector-demotion
      contract's sample floor. The hook bundle has little headroom, so measure
      the bundle before writing.
      verify: the contract table and `DetectorId` both list seven detectors.

## Phase 4 — Act on the result

- [ ] **4.1** Branch by result: a clean-control guardrail failure reviews the
      prohibition rules first; `folk-prompt` ≈ baseline records the video's
      prompt as an honest null; `reframe` meeting its bar un-parks HON-08; an
      own-artifact delta under the full tier adds a one-sentence evaluation
      clause to Iron Law 1 through the kernel-edit path; the frontier-quality
      matrix row for sycophancy changes from `covered` to what was measured.
      <!-- blocked-by: honesty-bench-spend -->
      verify: each branch taken names its report row.
- [ ] **4.2** A chat-host paste-in surface only if an arm beats baseline.
      <!-- blocked-by: honesty-bench-spend -->
      verify: the digest cites the winning arm's report.

## Blockers

### blocker: honesty-bench-spend

- **Status:** open — raised 2026-10-27 by the inbox round that planned Phase 2.
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

- [ ] AC-1 — The bench scores caving and stubbornness, over- and under-criticism.
- [ ] AC-2 — One scored run is published, nulls included. <!-- blocked-by: honesty-bench-spend -->
- [ ] AC-3 — Conceding to bare pushback with no tool call is counted at turn end.
