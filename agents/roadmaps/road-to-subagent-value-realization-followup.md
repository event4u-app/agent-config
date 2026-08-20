---
complexity: lightweight
parent_roadmap: subagent-value-realization
---

# Roadmap: Follow-up to Subagent value realization

> Seed real orchestration telemetry from production use, then confirm-or-demote the ADR-117 `subagents.auto: on` default on that evidence via `gateVerdict()`.
> <!-- reconciled 2026-07-12 with ADR-117 (default flipped ask → on on 2026-07-09,
>      bounded-downside basis; this roadmap was written pre-flip) via
>      road-to-opt-portfolio-consolidation Phase 1. -->

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-subagent-value-realization.md`](archive/road-to-subagent-value-realization.md).
The parent built the full telemetry-capture path (agent-emit → audit-log JSONL),
the `readOrchestrationMetrics` aggregator, the `/cost:report` orchestration
summary, the delegable-task corpus, and the bench arms. What remains is purely
**measurement** — it requires real orchestrated dispatches to exist, which
cannot be produced by a headless harness (see the parent's `## Council notes`
and `agents/settings/contexts/orchestration-default-flip-verdict.md`).

- **Parent:** `agents/roadmaps/archive/road-to-subagent-value-realization.md`
- **Trigger to unblock:** ≥ 20 orchestration lines in the current-month audit log.

## Phase 1: Seed real telemetry

- [x] **Step 1:** Verify end-to-end on one real `do-in-parallel` dispatch: a telemetry line is emitted, appended, and reportable. Cite the JSONL line. (Run corpus `orch-01` from `internal/bench/orchestration/corpus/` with `subagents.auto: on`.)
      <!-- done 2026-07-11: ran orch-01 (multi-file analysis) as a real
      do-in-parallel dispatch via the native Agent tool — 3 parallel read-only
      subagents (parser.ts / formatter.ts / cli.ts; the 4th fixture reducers.mjs
      is absent), each returned a usable findings block first-pass, no rework, no
      escalation. Recorded via `orchestration_record --spawn-count 3
      --task-class read-only-fanout --first-pass-success true --escalated false`
      → audit line id 872AEB965EE351794177F1C128 in
      agents/runtime/state/audit/2026-07.jsonl (gitignored runtime state).
      `orchestration_savings_report` reads it (dispatches 1 · spawns 3 · paired
      cost×quality). PIPELINE-VERIFICATION ONLY: token_delta is `provenance:
      estimated` (+28000 = tokens ADDED — 3-tiny-file fan-out is overhead-bound,
      not a win), n=1. This line is explicitly NOT a measured data point and does
      NOT count toward Step 2's ≥20-measured gate or the pre-registered
      `orchestration-dispatch-net-win` claim (orch-02/03, provenance measured). -->
- [ ] **Step 2:** Run the full delegable-task corpus (`orch-01`, `orch-02`, `orch-03`) under both arms (`agent-settings.orchestrated.yml` and `agent-settings.baseline.yml`) across enough sessions to reach ≥ 20 orchestrated dispatches.
      <!-- PREMISE-STALE as written, 2026-08-10. The two arms are settings
      states of `subagents.enabled` / `subagents.auto`, and always-on
      orchestration (road-to-always-on-orchestration Phase 1) DELETED both keys
      — there is no per-layer on/off setting left, so "both arms" names a
      contrast the tree can no longer express. Re-cutting the arms (host
      capability? emergency halt? a bench-only override?) is a scope decision,
      not execution. The ≥ 20 half is separately met at 99 — see the blocker. -->
      <!-- Reachable substitute, if one is wanted: `emergency.orchestration_halt`
      is the only remaining switch that suppresses dispatch, but it is an
      emergency brake rather than an experimental arm, and using it as one would
      make the baseline arm indistinguishable from an incident. Recorded as an
      option to reject, not a plan. -->
- [x] **Step 3:** Measure `parallelizable:` classifier recall on the corpus — confirm the deterministic classifier fires `do-in-parallel` / `do-in-steps` on the corpus tasks as expected; record actual hit/miss counts.
      <!-- done 2026-07-11: deterministic measurement (no spend/agents) via the
      new regression test src/scripts/_lib/auto_dispatch.corpus.test.ts (8 tests,
      green). Encodes each corpus task's documented classification signal +
      asserts classifyTask v1 output. RESULT: recall 2/2 on the modes v1 covers
      — orch-01 → do-in-parallel, orch-02 → do-in-steps; FP 0 — pv-02 negative
      control correctly NOT dispatched (below size floor). Documented scope gap:
      orch-03 (do-competitively) + pv-01 (verdict) are NOT in classifyTask v1's
      two DispatchModes — recorded as known scope, not misses. -->

**Exit criteria:** ≥ 20 orchestration lines in the audit log; `/cost:report` surfaces a non-empty orchestration summary; classifier recall recorded. The ≥ 20-dispatch measurement must include the `first_pass_success` / `escalated` quality columns (per road-to-proof-under-real-conditions Phase 4 — cost and quality reported as a pair, never savings alone).
**Rollback:** none (measurement only; no code change).

## Phase 2: Confirm or demote the ADR-117 `auto: on` default

- [ ] **Step 1:** Feed the accumulated real orchestration telemetry through the existing `gateVerdict()` / `resolveShippedDefault()`.
- [ ] **Step 2:** If the data shows a net token-or-time win at held quality, record the ADR-117 `on` default as evidence-CONFIRMED (bounded-downside basis upgrades to measured); otherwise record the renewed honest-null and demote the default back to `ask` via ADR-117's retained demotion gate — a maintainer decision either way.
      <!-- PREMISE-STALE on its DEMOTE branch, 2026-08-10: `subagents.auto` no
      longer exists to demote (deleted with `subagents.enabled` by
      road-to-always-on-orchestration Phase 1), so "back to `ask`" has no target.
      The CONFIRM branch is unaffected in shape but unreachable on today's data.
      Whether the demotion gate re-cuts against a different surface, or the
      honest null is recorded without a demotion, is the maintainer decision the
      step already reserves — it is now a decision about a deleted mechanism,
      which is worth knowing before anyone re-opens this step. -->
- [ ] **Step 3:** Update `agents/settings/contexts/orchestration-default-flip-verdict.md` with the new evidence pass (date + outcome), per `no-roadmap-references` (inline, no session path).

**Exit criteria:** `gateVerdict()` run on real telemetry; flip decision recorded with evidence either way.
**Rollback:** none (decision is evidence-gated; `ask` is the safe default if evidence is insufficient).

## Notes (added 2026-07-08)

- **`skills:` preload field is unused package-wide** (verified: only
  `src/subagents/production-validator.md` exists, deliberately skill-isolated
  per ADR-109). When any second specialist subagent is authored, list its
  curated governance/convention skills in `skills:` frontmatter so they are
  guaranteed in startup context instead of left to description-matching. No
  roadmap work now — this note is the finding's home (council 2026-07-08).
- The PUBLIC prove-or-drop decision on the orchestration front lives in the
  standalone child `road-to-orchestration-scope-decision.md` (council
  2026-07-08: adoption claim, kept separate from this internal telemetry
  work). Its Phase 2 inherits this roadmap's telemetry blocker.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-10 | reviewer: claude/host -->

Added 2026-08-10 with the measured telemetry state below; every row is a way the
new numbers can be **mis**read, because a cleared count on a blocker that still
stands is exactly the shape that invites a wrong resume.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The cleared line count is read as "unblocked" | implementation | The blocker's literal condition (≥ 20 lines) is met at 99, so a screen that reads only the resolution line concludes Phase 1 is resumable and runs Step 2 against settings arms the tree deleted | The blocker records count-met / value-not in the same block as the condition, and Step 2 carries its own premise-stale note naming the deleted keys | Phase 1 |
| 2 | The null value fields are "fixed" by emitting a fabricated delta | product | `token_delta: 0` looks like a bug, and the cheapest way to make it non-zero is to compute a number the layer cannot source — which would put manufactured evidence into a published aggregate | The hook's own reasoning (no post-hoc baseline; absolute cost rides `dispatch_tokens` on sync completions only) is quoted at the acceptance criterion, so the honest path is a host probe, not an emitter edit | Acceptance criteria |
| 3 | The pre-registered criterion is re-scoped by whoever measured it | product | Once the measurement fails, rewriting the criterion to what the data can support is the `evaluator-independence` failure — the author of the work grading it | The end-state note states re-scoping is a maintainer act and names what a re-scope would have to concede (the net-delta claim as an explicit non-claim) | Acceptance criteria |
| 4 | The aggregate keeps being read as a value verdict | product | `orchestration_savings_report` currently prints a net of tokens *added* at a 1 % measured share, assembled from one July line; quoted without provenance it reads as evidence that orchestration loses | The blocker records the field-level nulls and the n=1 provenance, so any figure taken from that report carries its own disclaimer | Phase 2 |
| 5 | More usage is mistaken for progress | implementation | The obvious response to a blocked measurement is to accumulate more dispatches, which cannot help while every line's value fields are null by construction | The blocker states plainly that raising the line count will not move the exit criterion | Phase 1 |

## Acceptance Criteria

- [ ] A real orchestrated dispatch emits a captured, reportable telemetry line with a sourced `token_delta`; `breachedGuardrails` reads live telemetry.
      <!-- OPEN, and NOT a small fix — measured 2026-08-10 over 99 hook-emitted
      August lines: `token_delta` 0 / `estimated` in all 99, `dispatch_tokens`
      null in all 99. Both are correct at that layer per the hook's own header
      (no post-hoc baseline exists for a net delta; the absolute count arrives
      only on a SYNC completion, and all 99 were background spawn acks). So
      "sourced" cannot be satisfied by editing the emitter — it needs a host
      surface that delivers subagent usage, which the task-completion
      notification does carry but no hook slot is known to see. Treat this as a
      live-host probe, not an emitter bug; details in the blocker below. -->
      <!-- END-STATE NOTE: if the probe comes back negative, the honest close is
      to re-scope this criterion to what IS provable (the dispatch FACT and the
      sync-completion subset) and record the net-delta claim as a non-claim.
      Rewriting a pre-registered success criterion is a maintainer act, not an
      agent one — `evaluator-independence`. -->

      Third-party premise check, 2026-08-10: the pipeline-verification note on
      Phase 1 Step 1 already flagged its own line as `provenance: estimated`
      and explicitly not a data point. That was accurate and is not the gap —
      the gap is that the *measured* provenance is unreachable for background
      dispatches, which the Step 1 note could not have known.
- [x] `parallelizable:` classifier recall measured on the corpus.
      <!-- met 2026-07-11: recall 2/2 (v1-covered modes) + FP 0, via
      src/scripts/_lib/auto_dispatch.corpus.test.ts. -->
- [ ] The ADR-117 `auto: on` default is re-evaluated through `gateVerdict()` on real telemetry, with the outcome recorded — confirmed if evidenced, demoted to `ask` if not.

## Blockers

### blocker: telemetry-sample-size
- **Status:** open
- **Owner:** user
- **Class:** 3 — human-only (only real parallel work fills the columns; no command synthesises usage)
- **Blocks:** Phase 1 — Seed real telemetry
- **What to do:**
  1. Use the agent with `subagents.enabled: true` under the post-ADR-117
     default (`subagents.auto: on`) during real work, long enough to
     accumulate real orchestrated dispatches — the build work is done;
     only real usage produces this.
  2. Check the current-month audit log line count:
     `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`.
  3. Once the count reaches ≥ 20, resume this roadmap
     (`/roadmap:process-full road-to-subagent-value-realization-followup.md`).
  **Measured 2026-08-10 — the count condition is MET and the blocker still
  stands, because the count was never the hard part.** `2026-08.jsonl` holds
  **100 lines, 99 of them orchestration** (`2026-07.jsonl` holds 1 — the
  pipeline-verification line from Step 1), and
  `orchestration_savings_report` agrees: `dispatches: 99 (total spawns: 101)`.
  The move is not usage discipline: the `orchestration-record` `post_tool_use`
  concern now emits the line deterministically per dispatch, replacing the
  model-carried capture that had reached 1 of 370.

  What the 99 lines do **not** carry is the whole remaining gap: `token_delta`
  is `0` and `token_delta_provenance` `estimated` in all 99; `dispatch_tokens`,
  `wall_clock_ms`-as-measured, `first_pass_success`, `escalated`, `task_class`
  and `dispatch_mode` are `null` in all 99; `spawn_count` is 1 in 98 of 99, so
  the corpus never produced a fan-out ≥ 2. That is **documented behaviour, not
  a defect** — the hook's own header states that `token_delta` has no honest
  value at its layer (it is a net against a not-delegating baseline that does
  not exist post-hoc) and that the absolute cost rides `dispatch_tokens`, which
  the host populates only on a **sync** completion. All 99 were background
  dispatches, i.e. spawn acks with no usage fields, so the null is correct
  rather than lossy.

  **Correction (2026-08-17) — the count moved and two of the field claims are
  now false, one of them load-bearing.** `2026-08.jsonl` holds **368 lines,
  367 orchestration** (July still 1). Unchanged and still true: `token_delta`
  `0` with provenance `estimated` in **367/367**, and `first_pass_success`,
  `escalated`, `task_class`, `dispatch_mode` `null` in **367/367** — the
  quality columns really are absent, so the exit criterion below is untouched.
  Now false: `dispatch_tokens` is **numeric on 40 of 367** (327 null, values
  from 315 to 194330), and `wall_clock_ms` is numeric on **367/367** (0 to
  955883), not null. That matters beyond bookkeeping, because the sentence
  above explains the nulls by "all were background dispatches, and the host
  populates usage only on a sync completion" — 40 sync completions have since
  landed, so the absolute-cost half of the argument no longer applies. It does
  **not** unblock the roadmap: there is still no counterfactual and no quality
  column, and n=40 carries no family labels. `spawn_count` is **1 in 366 of
  367** (one `0`, none ≥ 2), so the fan-out finding is unchanged.

  Consequence for the exit criterion: a hook at `post_tool_use` cannot supply
  the quality columns for a background dispatch at all. The usage does surface
  later, on the task-completion notification, so the open question is whether
  any hook slot sees that payload — a live-host semantics probe of the same
  shape as `background-continuation-probe`, not a code fix. Until that is
  answered, `≥ 20 usable dispatches` is unreachable regardless of how many
  lines accumulate, and raising the line count further will not move it.
- **Recommendation:** stop treating this as a usage-volume blocker and run the
  live-host semantics probe instead — does **any** hook slot receive the
  task-completion notification payload, and does that payload carry the usage
  fields a background dispatch withholds at `post_tool_use`? Same shape as
  `background-continuation-probe`, not a code fix. It is the recommended option
  because it is the only one that can move the exit criterion: the line count
  is already met at 99, and the missing columns are documented behaviour of the
  slot, so more usage produces more of the same nulls.
- **If you do nothing:** the log keeps growing and Phase 1 stays open forever —
  `≥ 20 **usable** dispatches` is unreachable at this slot regardless of volume,
  so the roadmap's last acceptance criterion (re-evaluating the ADR-117
  `auto: on` default on real telemetry) never gets the evidence it names, and
  the default stands unexamined by default rather than by decision.
- **Answer:** NOT COVERED by option (a) — 2026-08-20, disposition **transferred**,
  merged into the same task-completion observability stub as `real-orchestration-usage`
  per
  [drain-blocker-dispositions-a](../evidence/council/drain-blocker-dispositions-a.md).
  The rendered default is accepted as the REFRAMING — stop treating this as a
  usage-volume blocker and ask instead whether any hook slot sees the task-completion
  payload — and batch A adopts exactly that reasoning. Running the probe is a live-host
  observation, so Rule 3 assigns it `B`. Batch A carries the three-point check verbatim,
  including the >=20 non-null quality-column rows as the detection probe.
- **Resolved when:** a probe result records whether any hook slot sees the
  task-completion payload, and — if one does — `agents/runtime/state/audit/YYYY-MM.jsonl`
  carries ≥ 20 orchestration lines whose quality columns are populated rather
  than `null`. The bare line-count condition this field carried until
  2026-08-16 was already satisfied at 99 lines while the blocker stayed open,
  which made it unusable as a resolution test.
