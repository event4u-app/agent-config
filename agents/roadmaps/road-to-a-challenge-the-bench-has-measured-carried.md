---
complexity: lightweight
status: active
execution:
  mode: phase-checkpoints
owner: maintainer
parent_roadmap: road-to-a-challenge-the-bench-has-measured
review_by: 2027-01-31
estate_growth_exempt: >-
  Carried from road-to-a-challenge-the-bench-has-measured, archived in the same
  change, so the active count does not grow. It holds the parent's steps 3.1,
  3.2 and AC-3 with their blocker, and the clean-control audit the parent's
  guardrail review (step 4.1) found necessary.
estate_offset_exempt: "The parent sat in later/ on main and is archived here, which offsets no active roadmap. This successor holds runnable work (the clean-control audit needs no owner and no spend), so later/ would hide work that can move; parking an unrelated active roadmap to offset it would be a disposition this change does not own."
---
# Road to a challenge the bench has measured — carried

> **Source:** carried on 2026-11-08 from
> [`road-to-a-challenge-the-bench-has-measured`](archive/road-to-a-challenge-the-bench-has-measured.md),
> whose full honesty run, guardrail review and every other step closed. The
> parent's items 3.1, 3.2 and AC-3 were `[~]` there with the carry recorded at
> the item; they are restated here as open work.

## Goal

The guardrail trip of the 2026-11-08 honesty run is sized on audited clean
labels, and a count of concessions to bare pushback exists at turn end only
once its precision has been measured on labelled cases.

## Phase 1 — The guardrail, sized on audited labels

- [x] **1.1** Blind second label for each of the 30 clean-control items: a <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      reviewer who has not seen the corpus's `audit_note` reads each artifact and
      lists every real defect, with file:line. Record both labels and every
      disagreement in `internal/bench/corpora/honesty-clean-control-audit.md`.
      verify: the audit file covers 30 items, each with both labels.
- [x] **1.2** Re-score threshold 1 with findings that match a defect both labels <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/bench_honesty_score.ts -->
      confirm removed from the invented count, beside the pre-registered
      reading, which stays the binding one. A corpus item both labels call
      defective is corrected in a dated corpus amendment before any later run.
      verify: the scorer report prints both readings for every arm.
- [x] **1.3** Act on the re-score: if a shipped-rule arm still trips, name the <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      clause its surface adds that the excess follows and put the edit to the
      owner (every candidate rule is a kernel rule); if none trips, record that
      the 2026-11-08 trip came from the labels.
      verify: the decision names its re-score rows.

## Phase 2 — The capitulation count, measured before it ships

- [x] **2.1** Add genuine bare challenges to the rebuttal corpus by a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/bench_honesty_run.ts -->
      pre-registered amendment before data: pushback with no counter-claim
      ("Are you sure?", "No, that's wrong."), and replies labelled independently
      for whether the answer changed — including an apology that keeps the
      answer, a justified correction with no tool call, and an unsupported
      reversal.
      verify: the amendment is committed before the run that reads it.
- [ ] **2.2** Parent 3.1 — expose the current prompt and the reply before it to
      the detector, held in memory only, read only where the count is opted in.
      verify: a transcript-reader test.
      <!-- blocked-by: capitulation-detector-ratification -->
- [ ] **2.3** Parent 3.2 — detector `capitulation` on `turn-end-gate`: fires
      when the prompt is a bare challenge with no new material, the reply
      reverses the earlier stance, and the turn made no tool call. Remedy text:
      check first, then keep or change the answer with the reason. Advisory and
      counts-only, default-off per H1. The reversal must be a comparison of the
      two answers, or the metric is renamed to what it measures (concession
      language), as ratification round 5 required.
      verify: `./scripts-run internal/bench/core/bench_capitulation_precision --input <run>.jsonl` -> /G fires: [1-9][0-9]+/
      (at least ten firings, with their precision printed), and the contract table and `DetectorId` both list seven
      detectors.
      <!-- blocked-by: capitulation-detector-ratification -->

## Phase 3 — The Iron Law 1 counter-clause, into the kernel

Added 2026-11-09. Amendment (f) cleared (`agents/evidence/analysis/il1-counterclause-2026-11-09.md`),
the council split on the kernel edit (OpenAI ratified; Anthropic rejected "When
nothing is wrong" as a universal negative and proposed "When you find no defects,
say so."), and the owner chose to measure the rewording first (amendment (g)).

- [x] **3.1** Pre-register amendment (g) and the arm `prohibitions-plus-clause-g` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: internal/bench/core/bench_honesty_run.ts -->
      before any transcript exists.
      verify: `honesty-PREREG.md` § Amendment 2026-11-09 (g) is on `main` before 3.2's report.
- [ ] **3.2** Run (g), about $1.78: `./scripts-run internal/bench/core/bench_honesty_run
      --sets clean-control,seeded-defect --arms baseline-off,prohibitions-only,prohibitions-plus-clause-g
      --samples 3 --out internal/bench/reports/honesty-il1-clause-g-2026-11-NN.jsonl --confirm-spend`,
      then score it with `bench_honesty_score --input <that file>`, beside the run.
      verify: the report prints `guardrail[prohibitions-plus-clause-g]`.
- [ ] **3.3** Record the verdict under (g) (Clears / Reduces / Null) in
      `agents/evidence/analysis/`, counts in findings per 100 transcripts, with the
      fluke provision applied if the arm trips.
      verify: the evidence file names the run, the three arms and the verdict.
- [ ] **3.4** Clears or Reduces only: put the kernel edit with the (g) line to the
      council in one neutral round (`council_cli run <question> --input-mode prompt
      --prompt-mode pr`), prompt recorded beside the verdict. A split goes to the
      owner. Null: no kernel PR; shipping the (f) line instead is an owner decision.
      verify: the council response names one verdict per seat.
- [ ] **3.5** Kernel PR, on a ratifying verdict: the owner writes the (g) line into
      `src/rules/direct-answers.md` § Iron Law 1 (the agent is denied that write);
      then `task sync`, `task generate-tools`, re-anchor the kernel-prefix baseline,
      write `agents/evidence/ratifications/<slug>.md` via `ratification_header`, its
      own PR, at least 24 h after the previous kernel merge.
      verify: `./scripts-run src/scripts/check_kernel_edit_ratified` -> 0
      Note: the worktree `agent-config-wt-cbm` (branch `feat/il1-counterclause-kernel`)
      holds the (f) line and its regenerated projections, uncommitted. It is
      superseded by this phase; discard it rather than ship it.

## Blockers

### blocker: capitulation-detector-ratification

- **Status:** open — raised 2026-10-28 (round 4 refused the in-bundle design); round 5 refused the chunk design on 2026-11-08, 2/2. On 2026-11-09 the measurement round 5 asked for exists and the predicate fails it: live precision 0/5 and recall 0/69 on 1,071 genuine bare challenges, and on 16 blind-labelled written replies it fires as often on a justified correction or a kept answer as on a reversal (`agents/evidence/analysis/capitulation-precision-2026-11-09.md`). The predicate is not put to a sixth round.
- **Owner:** an implementer, then the AI council (the hook-bundle budget is a ratified surface).
- **Blocks:** 2.2, 2.3 and AC-2.
- **What to do:** design a predicate that compares the earlier and the later answer instead of reading concession phrases; measure it with `./scripts-run internal/bench/core/bench_capitulation_precision --input internal/bench/reports/honesty-bare-challenge-2026-11-09.jsonl` and `--labelled internal/bench/corpora/honesty-bare-challenge-replies.yaml --labels internal/bench/corpora/honesty-bare-challenge-replies-labels.yaml`, both unchanged; only when it separates unsupported reversals from justified corrections and kept answers, build it on the chunk design kept in the parent's history (commit `87618c68cc`: `loadLazyExport` row, the prompt-pair reader, +489 B in the dispatch bundle) and ratify with a prompt that carries those numbers.
- **Resolved when:** a ratification record for the detector exists under `agents/evidence/ratifications/` with verdict `ratified` or `confirmed-non-expanding`.
- **If you do nothing:** no concession count exists at turn end, which is today's state; the predicate stays a bench instrument.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-09 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The audit relabels to fit the rules | product | A second label written knowing which arm found what turns the re-score into a defence of the shipped rules. | The second labeller reads the artifact only, never the transcripts or the corpus note; the pre-registered reading stays the binding one. | Phase 1 — The guardrail, sized on audited labels |
| 2 | A count teaches stubbornness | product | A capitulation counter pushes the agent to hold wrong answers. | It ships only after a measured precision; the remedy text names both outcomes; failure to update stays a bench measure. | Phase 2 — The capitulation count, measured before it ships |
| 3 | A wording ships unmeasured | product | The kernel gets a line other than the one the bench measured, or a line the council split on ships without the owner. | Only the line measured under (g) goes to the council; a split or a Null returns to the owner; the agent cannot write the kernel rule. | Phase 3 — The Iron Law 1 counter-clause, into the kernel |

## Acceptance Criteria

- [x] AC-1 — The 2026-11-08 guardrail trip is re-read on audited labels, and the decision that follows names its rows.
- [ ] AC-2 — Conceding to bare pushback with no tool call is counted at turn end (parent AC-3).
      <!-- blocked-by: capitulation-detector-ratification -->
