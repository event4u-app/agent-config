---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-u (third arrival of the slow-run subject) verified at 553e58dfb that the completion review has no round cap (docs/contracts/plan-review-gates.md:303-307, § 2.5; nothing in src/scripts/check_completion_review.ts counts rounds) while review artefacts reach round25 (agents/evidence/reviews, slug fix-release-shape-allows-its-own-census). No active, later/ or stub roadmap owns a completion-review round cap. Folding it into road-to-agent-throughput-recovery was rejected: that file owns night-level throughput and waits on two pre-registered 14-night windows until 2026-11-17, so a contract change it does not measure would sit behind a window it does not need. Folding into road-to-a-step-that-costs-what-it-changes was rejected because this file needs one owner ADR and nothing else, and must not wait on that file's Phase 0 baseline."
estate_growth_exempt: "+1 open_blockers: review-round-cap-is-an-owner-contract-change, added in this change. Capping the completion review weakens a recorded verification loop, which the decision-revisit gate reserves to the owner; recording it as a blocker is the honest form of a decision that no agent may take."
relates:
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: "Sibling from the same round. That file decides how much ceremony a step gets by change class; this file decides when one review ends. Its Phase 3 depth table cites this file's cap for R2/R3 and does not re-plan it."
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: disjoint
    note: "Its review loop is the sharpest live instance (#2537: five rounds, not passed, reverted). The cap here applies to it unchanged once landed; nothing here edits its plan."
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: "Owns the night-level reading and the foreground CI wait. A review round that re-pushes repeats its pre-push and CI wait; the round counts this file reads are an input to its Phase 2, not a re-plan of it."
---
# Road to a review that ends

> **Source:** `agents/tmp.old/inbox-2026-10-u/` — one transcript of one owner
> turn (2026-10-20) and two externally drafted plans from parallel sessions,
> both pinned at `main@418a09379d`, re-verified against `main@553e58dfb` on
> 2026-10-21. None of the ten commits between pin and verification touches a
> claim below.
>
> **The owner's demand, turn 1:** a roadmap step takes hours and roadmaps
> sized for two hours take days; apply only what a step needs, skip nothing it
> needs; AC must become effective again. Both plans named the unbounded
> completion review as the largest single multiplier.

## Context

The completion review re-binds in place after every fix pass and nothing
counts the passes:

| # | Finding | Evidence at `553e58dfb` |
|---|---|---|
| F1 | No round cap. A fix commit changes the scope hash, the artefact re-binds, the review runs again. | `docs/contracts/plan-review-gates.md:303-307` (§ 2.1), § 2.5 at `:504`, § 2.7 at `:580`; `check_completion_review.ts:1050-1053` states per-round ordering is "agent-carried convention" |
| F2 | Rounds reach 25. Per-slug maxima: round 1 only 16 slugs, 2: 4, 3: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 1, 25: 1. The supplied plan said "up to round 9"; it under-counted. | `ls agents/evidence/reviews \| grep -oE 'round[0-9]+'` — `round22`..`round25` on one slug, `round21` on another |
| F3 | The live HEAD at the pin was a five-round review that did not pass and was reverted. | `git log -1 418a09379d` (#2537) |
| F4 | Round 3+ carries less weight and more noise — high+critical 14.0 % (round 1) → **16.5 %** (round 2) → 8.2 % (round 3+); low 46.0 % → 42.6 % → 54.4 %. Round 2 is the round with the highest severity share, so a one-round cap would drop it. | Re-derived in step 0.1: `agents/evidence/analysis/review-severity-by-round-2026-10-21.md` (2,867 findings incl. archived round records; the supplied plan read 14.1 / 11.5 / 7.4 %) |
| F5 | A two-round cap with a narrow round 2 and a default-plus-memo for the rest already governs another loop in this tree. | `src/agent-src/contexts/execution/plan-confidence-gate.md:110-118` |
| F6 | Per exact round, high/critical rows per artefact: 1.49 · 1.54 · 0.78 · 0.79 · 0.71 (rounds 1-5), 0.38 (6-10), 0.15 (11+). 18 of 188 reviews ran past round 2. Of the 51 high/critical rows in rounds ≥ 3, 33 were introduced by an earlier round's fix and 18 were missed in earlier rounds. | Measured 2026-10-21 for steps 0.1/0.2: `agents/evidence/analysis/review-severity-by-round-2026-10-21.md` |

The council's own round limit is **not** in scope: `debate_max_rounds` is wired
(`src/scripts/council_cli.ts:1746`, default 4, user-global config), and the
supplied plan's "four council rounds on one termination question"
(`agents/evidence/drain-run-summary-run-24.md:38-47`) is four rounds on four
different questions. Nothing here changes a consumer default.

This roadmap relaxes no Hard Floor, kernel rule, required CI context or
review-independence rule. The cap ends the *loop*; every open high or critical
row after round N reaches the owner and is never closed silently.

## Goal

A completion review runs at most N rounds, N set by the owner — round 1 over
the scope, each later round over the fix delta plus the previous round's open
rows — after which open high/critical rows go to the owner report and
medium/low rows become deferred with a ledger link. Finished means: after step
1.3 lands, no review artefact beyond round N is accepted by
`check_completion_review`, and the high+critical rows found per review over the
next 20 reviews are not lower than the per-artefact rate measured in F6 for
rounds 1..N.

## Phase 0 — Re-derive what the cap rests on

- [x] **0.1 Re-derive the severity-by-round table.** Done 2026-10-21: `agents/evidence/analysis/review-severity-by-round-2026-10-21.md`; revised after R2 findings 2/3/7/9 to `probe_depth_shadow --rounds` (archived rounds, `round:` header, sibling rule), which reproduces both tables; F4 corrected (round 2 rises to 16.5 %). Count findings per round <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      and severity over `agents/evidence/reviews/*.md`; write it as an analysis
      artefact with the command that produced it. F4's figures are a supplied
      plan's and are not cited by 1.1 until this lands.
      verify: the artefact carries the command; re-running it reproduces every
      row; rows per round sum to the round total.
- [x] **0.2 Classify what round 3+ found.** Done 2026-10-21: 51 rows after the revised parse — 33 fix-delta, 18 missed (two fresh subagent passes); two rows re-checked by hand; same artefact § What round 3+ high/critical rows were. For every high/critical row in a <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      round ≥ 3, record whether it was introduced by a fix of the previous round
      (fix-delta) or present in round 1's scope (missed). Only the "missed"
      class is a cost of the cap.
      verify: every row is classified; the two counts are in the artefact.

## Phase 1 — The cap

- [x] **1.1 Owner ADR: a round cap N and a severity gate.** Done 2026-10-21: owner chose (b), five passes; ADR-294; contract § 2.1, § 2.5, § 2.7 and the new § 2.8 cite it. A pass is a reviewer dispatch (`prompt_hash`), not a re-bind — the first artefact with `round:` reached 7 on one pass (D5). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=raised to R2 from R0 --> N is the owner's
      answer to the blocker (two or five). Round 1 reviews the scope; every
      later round reviews the fix delta plus the previous round's open rows.
      After round N: high/critical open rows go to the owner report, medium/low
      become `deferred` with a ledger link. Precedent F5. Blocked on
      `review-round-cap-is-an-owner-contract-change`.
      verify: ADR merged; `plan-review-gates.md` § 2.5 and § 2.7 cite it.
- [x] **1.2 Make the round readable.** Done 2026-10-21: `round:` parsed in `check_completion_review`, `round-not-advanced` on a re-bind that drops or skips it, dispatcher writes `round: 1`, § 2.1 documented; 5 gate tests seen RED, then GREEN; sabotage probe reds the two refusal tests. Add an additive `round:` field to the <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_completion_review.ts -->
      § 2.1 header (v1 stays valid, read as round 1), written on every re-bind.
      Without it the gate cannot count what F1 says is convention.
      verify: red-first test — a re-bound artefact without an incremented
      `round:` is refused once the field is present.
- [x] **1.3 Refuse round N+1 in `check_completion_review`.** Done 2026-10-21: `round-cap-exceeded` at pass 6, `round-miscounted`, `cap-deferral-without-owner-report`; the dispatcher refuses pass 6 and continues the count after an archive. Tests written after the code, so sensitivity was proven by sabotage instead: cap raised to 6, dedupe removed, archive ending the chain, dispatcher writing round 1 — each turned its test red. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/check_completion_review.ts --> A `round: N+1`
      artefact is refused with the owner-report path in the message; a round-N
      artefact whose scope is the fix delta is accepted. Blocked on the same
      blocker as 1.1.
      verify: red-first tests for both; sabotage-probe by raising the cap and
      watching the refusal test go red.
- [x] **1.4 Findings bind to correctness and the step's stated requirements.** Done 2026-10-21: `## Severity` in the reviewer brief (`dispatch_r2_reviewer.ts`), test seen RED then GREEN. Re-scoring the 35 record-prose high/critical round-1 rows: 0 style, 2 inert false claims (→ medium), 33 actionable (unchanged) — so 2 of 224 move; a blanket "record prose is low" would have moved 35. Verify done by re-scoring existing rows, not re-running 20 reviews; reason in the artefact. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/dispatch_r2_reviewer.ts -->
      The reviewer brief scores style and record-prose findings `low`.
      verify: replay 20 archived round-1 artefacts through the new brief;
      high+critical count unchanged, low count reported.

## Phase 2 — Read it

- [ ] **2.1 Read the next 20 reviews.** Rounds per review, high+critical per
      review against 0.1's round-1 rate, and the owner-report rows produced.
      verify: a Decisions row with all three figures, written after the 20th
      review merges.

## Blockers

### blocker: review-round-cap-is-an-owner-contract-change
- **Status:** resolved — 2026-10-21, the owner chose (b), five rounds with the severity gate (`agents/evidence/owner-directives/2026-10-21-review-cap-and-depth-flip.md`, ADR-294)
- **Class:** 3
- **Owner:** user
- **Ownership:** product-owned
- **Blocks:** steps 1.1, 1.3; AC-1
- **Routed:** council 2026-10-21 ESCALATE — cannot be bounded from available evidence (one seat; the other read it council-decidable, so the seats split). One seat: council-decidable by a narrow margin, recommends a three-round cap. The other: owner-reserved under "cannot be bounded from available evidence", recommends measurement only for now. Both converged on: later rounds scoped to the fix delta, an exact-round breakdown, and a shadow reading of the cap before any hard cap. A split plus an unbounded-risk reading routes to the owner. The exact-round breakdown both asked for was then measured (Context F6).
- **Question:** The completion review is a recorded verification loop with no round limit (F1). Rounds 1 and 2 yield about 1.5 high/critical rows per artefact, rounds 3-5 about half of that (0.71-0.79); from round 6 the yield falls to 0.38, from round 11 to 0.15 (F6). 18 of 188 reviews ran past round 2. Should the loop be capped, and where?
- **Recommendation:** (b). Rounds 3-5 still pay half of round 1, and the yield falls sharply only after round 5, so a cap at five keeps every round that still pays and ends the 12 reviews that ran to round 6-25 (16 high/critical rows across those rounds, each routed to the owner report rather than dropped). A two-round cap (a) would cut rounds 3-5, which the data says still find defects; (c) leaves the 25-round loop in place.
- **If you do nothing:** reviews keep re-binding until they pass or are abandoned; the `round:` field (1.2) keeps counting, so Phase 2 still reads the next 20 reviews as measurement.
- **What to do:** pick exactly one — (a) approve a two-round cap with the severity gate as written in 1.1; or (b) approve a five-round cap with the same severity gate; or (c) refuse any cap and cancel 1.1 and 1.3, keeping 1.2 as measurement only.
- **Resolved when:** the chosen option is recorded in `docs/decisions/` or in this entry, and this entry's Status reads resolved.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | No change to the council's round limit. Rejected alternative: Lower `debate_max_rounds` default to 2 (supplied plan E8). | The key is wired and user-configurable; the evidence cited for it was four questions, not four rounds of one; changing a shipped default is owner-reserved and nothing measured asks for it. | Phase 2 shows council debates, not completion reviews, carrying the round count. |
| D2 | reversible-technical | evidence | Dedup key for repeated reviews is not built. Rejected alternative: A `(tree_sha, diff_hash, criteria)` key (supplied plan PR-F). | The scope hash already decides staleness (§ 2.1); an unchanged scope is not re-reviewed today. Nothing measured shows a duplicate review. | 0.1 finds two artefacts with an identical scope hash. |
| D4 | contested-technical | council: anthropic, openai (2026-10-21) | The cap and its N go to the owner; the blocker's options were re-cut to two or five rounds on the exact-round data (F6). | The seats split on routing (one: council-decidable, three rounds; other: owner-reserved, measurement only) and converged on fix-delta later rounds and an exact-round breakdown, which was then measured. | the owner answers, or a later reading moves the yield curve in F6. |
| D5 | contested-technical | council: anthropic (2026-10-21, three single-seat readings) | A round is a reviewer pass identified by `prompt_hash`, not a re-bind; the count walks the path's history through the archive rename; no post-cap delta threshold. | The first `round:` artefact read 7 after one reviewer pass; a cap on re-binds caps CI churn. All three readings (openai seat failed `exit_1` each time) recommended passes and archive-continues; they split on a post-cap threshold (500 vs ±50 lines), which nothing measured supports. | 2.1 finds a post-cap re-bind that carried a high/critical defect. |
| D3 | deterministic | evidence | Closure pass ran 2026-10-21: no open decision beyond the blocker. Step 1.4's prose verify is made command-shaped when the step is executed. | `closure_scan` listed one `unfalsifiable-verify` (non-blocking by its own contract) and no owner question. | the step is executed with the prose oracle unchanged. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A real later-round finding is lost | product | The cap ends a review whose next round would have found a missed critical defect. | 0.2 measured the "missed" share first (18 of 51); F6 sets N where the yield falls; open high/critical rows after round N reach the owner report; 2.1 reads the rate. | Phase 0 — Re-derive what the cap rests on |
| 2 | Round counting is gamed | implementation | An agent re-names the artefact to restart at round 1. | 1.2 writes `round:` on every re-bind; § 2.7's superseding rename carries the round forward; the sabotage probe in 1.3. | Phase 1 — The cap |
| 3 | Round 2 widens back to the full scope | implementation | A fix that touches many files makes the "fix delta" the whole change. | The round-2 scope is the delta by hash; a delta larger than round 1's scope is reported in the owner report rather than reviewed a third time. | Phase 1 — The cap |

## Acceptance Criteria

- [x] AC-1 — No completion-review artefact beyond round N is accepted by `check_completion_review` after 1.3 lands.
- [x] AC-2 — Every high/critical row open after round N appears in an owner report; none is closed by the cap.
- [ ] AC-3 — The severity-by-round table is re-derived from the tree before any decision cites it.
