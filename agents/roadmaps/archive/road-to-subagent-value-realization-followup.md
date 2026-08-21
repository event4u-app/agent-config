---
complexity: lightweight
parent_roadmap: subagent-value-realization
---

# Roadmap: Follow-up to Subagent value realization

> Seed real orchestration telemetry from production use, then confirm-or-demote the ADR-117 `subagents.auto: on` default on that evidence via `gateVerdict()`.
> <!-- reconciled 2026-07-12 with ADR-117 (default flipped ask → on on 2026-07-09,
>      bounded-downside basis; this roadmap was written pre-flip) via
>      road-to-opt-portfolio-consolidation Phase 1. -->

## Outcome — closed 2026-08-20, and closed is not achieved

```
ARCHIVED DOES NOT MEAN ACHIEVED. NEITHER PHASE OF THIS ROADMAP WAS SATISFIED.
THE ADR-117 `auto: on` DEFAULT IS STILL UNEXAMINED BY MEASUREMENT, NOT CONFIRMED
AND NOT DEMOTED.
```

Six items were open when this run started. **One is `[x]`** — Phase 2 Step 3, the
flip-verdict evidence pass, and what it records is a measured null, not a win.
**Five are `[-]` transferred.** Disposition **B**, outcome `transferred`, per
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md),
which found this roadmap's `telemetry-sample-size` and
`road-to-orchestration-scope-decision`'s `real-orchestration-usage` to be **one
evidence gap wearing two names** and merged them into a single shared stub:
[`stubs/road-to-task-completion-observability.md`](stubs/road-to-task-completion-observability.md). <!-- ref-ignore -->

The `ref-ignore` marker on that link is deliberate and temporary. The stub was
written by the agent closing the sibling roadmap and is not on `main` yet — it
lives on `drain/road-to-orchestration-scope-decision`
(`git show origin/drain/road-to-orchestration-scope-decision:agents/roadmaps/stubs/road-to-task-completion-observability.md`,
commit `b2f1119da`). The marker keeps `check_references` green on a forward
reference that resolves the moment that branch merges; remove it then. Writing a
second stub instead would have split one evidence gap back into two files, which
is exactly what the council merged away — the stub already names **both** parents
in its own header, including this roadmap.

| Phase | State | One-line honest reading |
|---|---|---|
| Phase 1 — seed real telemetry | 2 satisfied (pre-run), 1 **transferred** | Steps 1 and 3 were `[x]` before this run. Step 2 is transferred and is **doubly** unexecutable: the two arms it names are `subagents.enabled` / `subagents.auto` settings states, and both keys were deleted; and the ≥ 20 count it gates on is met many times over while every quality column is `null`. |
| Phase 1 exit criteria | **not met** | The line count and the classifier recall halves are met; the `first_pass_success` / `escalated` half is `0` of 582 and is not reachable from any hook slot. Cost and quality are a pair by contract, so a met count is not a met criterion. |
| Phase 2 — confirm or demote ADR-117 | 1 **satisfied**, 2 **transferred** | Step 3 (record the evidence pass) is executed and `[x]`. Steps 1-2 are transferred: `gateVerdict()` takes `{net_win, quality_held}` and the corpus supplies neither, and the DEMOTE branch is premise-stale — `subagents.auto` no longer exists to demote. |
| Acceptance criteria | 1 of 3 met | AC2 (classifier recall) was already met. AC1 and AC3 are transferred; **neither was re-scoped**, because re-scoping a pre-registered criterion is a maintainer act under `evaluator-independence` and the criterion's own END-STATE NOTE says so. |

### Re-measured corpus — 2026-08-20, this run's own reading

Measured directly over `agents/runtime/state/audit/` (gitignored host state, read
from the parent checkout — a worktree carries no runtime state), not quoted from
the sibling:

| | 2026-07 | 2026-08 |
|---|---:|---:|
| total lines / orchestration rows | 1 / 1 | 591 / **582** |
| `first_pass_success` non-null | 1 | **0** |
| `escalated` non-null | 1 | **0** |
| `task_class` non-null | 1 | **0** |
| `dispatch_mode` non-null | 0 | 0 |
| `dispatch_tokens` numeric | 0 | **40** (range 321-506234) |
| `wall_clock_ms` numeric / of those `> 0` | 1 / 0 | 582 / **40** |
| `token_delta_provenance: measured` | 1 | **0** (`estimated` 582) |
| `spawn_count >= 2` | 1 (=3) | **0** (`1` in 581, `0` in 1) |

`orchestration_savings_report --dir <parent>/agents/runtime/state/audit`:
`dispatches: 582 (total spawns: 584)`, net `token_delta: 1087078` — tokens
**added**, `first_pass_success_rate: n/a (n=1)`, `escalation_rate: n/a (n=1)`,
`measured share: 0%`, `MODELED cost reduction: n/a`. The entire non-zero net is
the single July line.

**Did it move?** The line count did; nothing else did. The shared stub's
transfer-date baseline was **570** orchestration rows earlier the same day, and
this reading is **582** — the corpus grew while this roadmap was being closed,
because this session's own dispatches append to it. Every field verdict is
byte-identical to the transfer baseline: quality columns still `0`, provenance
still `estimated` on all, fan-out still `0`. That is the stub's own movement test
answered against itself — a few hundred more lines is noise; one row with three
non-null quality columns would be signal.

**Two refinements this reading adds beyond the transfer baseline.**

1. `wall_clock_ms` is numeric on 582 of 582 but **`> 0` on only 40** — the same
   40 rows that carry `dispatch_tokens`. The stub's table records it as "numeric
   570", which is true and overstates latency coverage: 542 rows carry a
   placeholder zero, not a measured duration.
2. Those 40 sync completions are all dated **2026-08-09 to 2026-08-13** — none
   since. The sync subset has been flat for a week while background spawn acks
   accumulated from 367 to 582, which is the sharpest available statement of why
   volume cannot move this criterion.

**One unreconciled discrepancy, recorded rather than silently corrected.** The
2026-08-17 correction in the blocker below reports `dispatch_tokens` values
"from 315 to 194330" over the same **40** rows; this reading gets **321 to
506234** over 40. The audit log is append-only and the count is identical, so the
two ranges cannot both be readings of this field over these rows. The
discrepancy is noted, not resolved — nothing in this closure depends on it, and
the count (40) is what the argument uses.

### What must not be read out of this closure

- **The default was not evaluated.** ADR-117's `auto: on` still rests on the
  2026-07-09 bounded-downside basis. This run recorded that a third evidence pass
  found no usable evidence; it did not confirm the default, and it did not demote
  it. "Unexamined by measurement" is the honest state.
- **`0` here is not a measured loss.** The net figure the aggregate prints is
  tokens *added*, assembled entirely from one July line at `measured share: 0%`.
  Quoted without that provenance it reads as evidence that orchestration loses,
  which is Risk-Register row 4 and is not what the corpus says.
- **Nothing was fixed by writing a value.** `token_delta: 0` and the `null`
  quality columns are documented behaviour of the emitting slot, not a defect —
  Risk-Register row 2. No row was appended, no emitter was edited, no criterion
  was lowered to fit the data.
- **The fan-out arm has no population at all.** Across 582 recorded dispatches
  the corpus has never produced `spawn_count >= 2`. Any future verdict read off
  this corpus is a verdict about single-spawn dispatch, whatever the columns say.

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
- [-] **Step 2:** Run the full delegable-task corpus (`orch-01`, `orch-02`, `orch-03`) under both arms (`agent-settings.orchestrated.yml` and `agent-settings.baseline.yml`) across enough sessions to reach ≥ 20 orchestrated dispatches.
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
      <!-- TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to
      stubs/road-to-task-completion-observability.md: both arms name deleted
      settings keys, and the count half is met at 582 with 0 usable quality
      columns — not satisfied, not abandoned, moved with its criterion. -->
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

- [-] **Step 1:** Feed the accumulated real orchestration telemetry through the existing `gateVerdict()` / `resolveShippedDefault()`.
      <!-- TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to
      stubs/road-to-task-completion-observability.md. Verified this run rather
      than assumed: `gateVerdict` (src/scripts/_lib/orchestration_gate.ts:38)
      is a pure function of `{net_win, quality_held}`. The corpus supplies
      neither — `token_delta_provenance` is `estimated` on 582 of 582 so there
      is no measured net, and `first_pass_success` is null on 582 of 582 so
      there is no held-quality input. There is nothing to feed it; running it on
      invented inputs would manufacture a verdict. -->
- [-] **Step 2:** If the data shows a net token-or-time win at held quality, record the ADR-117 `on` default as evidence-CONFIRMED (bounded-downside basis upgrades to measured); otherwise record the renewed honest-null and demote the default back to `ask` via ADR-117's retained demotion gate — a maintainer decision either way.
      <!-- PREMISE-STALE on its DEMOTE branch, 2026-08-10: `subagents.auto` no
      longer exists to demote (deleted with `subagents.enabled` by
      road-to-always-on-orchestration Phase 1), so "back to `ask`" has no target.
      The CONFIRM branch is unaffected in shape but unreachable on today's data.
      Whether the demotion gate re-cuts against a different surface, or the
      honest null is recorded without a demotion, is the maintainer decision the
      step already reserves — it is now a decision about a deleted mechanism,
      which is worth knowing before anyone re-opens this step. -->
      <!-- TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to
      stubs/road-to-task-completion-observability.md. Both branches are
      unreachable here: CONFIRM has no evidence (Step 1), and DEMOTE has no
      target key. Which mechanism the demotion gate re-cuts against — or whether
      the null is recorded without a demotion at all — is the maintainer decision
      this step already reserved. -->
- [x] **Step 3:** Update `agents/settings/contexts/orchestration-default-flip-verdict.md` with the new evidence pass (date + outcome), per `no-roadmap-references` (inline, no session path).
      <!-- done 2026-08-20: added `## Evidence pass (2026-08-20) — no usable
      evidence; the default is unexamined, not confirmed` to
      agents/settings/contexts/orchestration-default-flip-verdict.md. Records
      this run's own re-measurement (582 orchestration rows, quality columns 0 of
      582, provenance `estimated` 582 of 582, `spawn_count >= 2` 0 of 582, the 40
      sync completions all dated 2026-08-09..13) and states plainly that the
      demotion trigger is NOT met — a measured net loss or a quality regression
      is required, and neither exists; an unmeasurable corpus is not a regression.
      No default changed: recording an evidence pass is documentation, flipping a
      shipped default is a maintainer release act. Inline convergence, no session
      path, per `no-roadmap-references`. -->

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
<!-- risk-review: v1 | reviewed: 2026-08-20 | reviewer: claude/host -->

Added 2026-08-10 with the measured telemetry state below; every row is a way the
new numbers can be **mis**read, because a cleared count on a blocker that still
stands is exactly the shape that invites a wrong resume.

**Re-reviewed 2026-08-20** on the drain-run close, row by row rather than
restamped. The corpus was re-measured at **582 orchestration rows** against the
99 this register was written on — and the outcome that matters is that **not one
field verdict moved**: quality columns non-null 0 of 582, provenance `estimated`
582 of 582, `spawn_count >= 2` on 0. Rows 1 and 4 have their figures corrected
below. Row 2 held and was tested by the work itself. Row 3 **materialised as a
live temptation and was refused**. Row 5 is new, for a risk this close creates.

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The cleared line count is read as "unblocked" | implementation | The blocker's literal condition (≥ 20 lines) is met at 99, so a screen that reads only the resolution line concludes Phase 1 is resumable and runs Step 2 against settings arms the tree deleted | The blocker records count-met / value-not in the same block as the condition, and Step 2 carries its own premise-stale note naming the deleted keys. **Re-reviewed 2026-08-20: the count is now 582, and the gap it invites has widened rather than closed — 5.9x the lines, identical verdicts. Step 2 is `[-]` transferred, so the arm that would have run against deleted keys no longer has an open box to run from.** | Phase 1 |
| 2 | The null value fields are "fixed" by emitting a fabricated delta | product | `token_delta: 0` looks like a bug, and the cheapest way to make it non-zero is to compute a number the layer cannot source — which would put manufactured evidence into a published aggregate | The hook's own reasoning (no post-hoc baseline; absolute cost rides `dispatch_tokens` on sync completions only) is quoted at the acceptance criterion, so the honest path is a host probe, not an emitter edit. **Re-reviewed 2026-08-20: held, and the close exercised it — no row was appended and no null was filled, in a pass that re-read the whole 2026-08 window. One reading discrepancy was flagged rather than silently reconciled: the 2026-08-17 note gives the `dispatch_tokens` range as 315-194330 over the same 40 rows where this pass reads 321-506234, and on an append-only log both cannot be readings of that field.** | Acceptance criteria |
| 3 | The pre-registered criterion is re-scoped by whoever measured it | product | Once the measurement fails, rewriting the criterion to what the data can support is the `evaluator-independence` failure — the author of the work grading it | The end-state note states re-scoping is a maintainer act and names what a re-scope would have to concede (the net-delta claim as an explicit non-claim). **Re-reviewed 2026-08-20: this risk materialised. AC-1 was unmeasurable and re-scoping it to what 582 rows can support was the cheap close available; it was left `[-]` transferred instead, with the END-STATE NOTE's reservation to a maintainer cited as the reason. The mitigation is the only thing that stopped it.** | Acceptance criteria |
| 4 | The aggregate keeps being read as a value verdict | product | `orchestration_savings_report` currently prints a net of tokens *added* at a 1 % measured share, assembled from one July line; quoted without provenance it reads as evidence that orchestration loses | The blocker records the field-level nulls and the n=1 provenance, so any figure taken from that report carries its own disclaimer. **Re-reviewed 2026-08-20: the figure is now a net of 1,087,078 tokens ADDED at `measured share: 0%` and `first_pass_success_rate: n/a (n=1)` — a larger number with the same n, which is exactly the shape that reads as a verdict when quoted bare.** | Phase 2 |
| 5 | More usage is mistaken for progress | implementation | The obvious response to a blocked measurement is to accumulate more dispatches, which cannot help while every line's value fields are null by construction | The blocker states plainly that raising the line count will not move the exit criterion | Phase 1 |
| 6 | The closed roadmap reads as a measured answer, and one coverage figure invites it | product | Every remaining item is `[-]`, so the dashboard renders this roadmap complete while the question it existed to answer is untouched. The sharpest specific case is latency coverage: `wall_clock_ms` is numeric on 582 of 582 but **greater than zero on only 40**, so 542 rows carry a placeholder, and those 40 sync completions are all dated 2026-08-09..13 with none since — quoting 582 as latency coverage overstates it by 14x on a subset that has been flat for a week | `## Outcome` leads with the distinction and carries four must-not-be-read-out-of-this items; the `> 0` split and the frozen date range are stated at the measurement rather than left in the raw field, so the next reader inherits the caveat with the number | Acceptance criteria |

## Acceptance Criteria

- [-] A real orchestrated dispatch emits a captured, reportable telemetry line with a sourced `token_delta`; `breachedGuardrails` reads live telemetry.
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

      TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to
      stubs/road-to-task-completion-observability.md — **not** re-scoped. The
      END-STATE NOTE above reserves re-scoping to a maintainer, and this run
      honours that: the net-delta claim is carried forward intact rather than
      trimmed to what the data can support. What this run added is the
      measurement that makes the re-scope decidable when a maintainer takes it.
- [x] `parallelizable:` classifier recall measured on the corpus.
      <!-- met 2026-07-11: recall 2/2 (v1-covered modes) + FP 0, via
      src/scripts/_lib/auto_dispatch.corpus.test.ts. -->
- [-] The ADR-117 `auto: on` default is re-evaluated through `gateVerdict()` on real telemetry, with the outcome recorded — confirmed if evidenced, demoted to `ask` if not.
      <!-- TRANSFERRED 2026-08-20 (disposition B, outcome `transferred`) to
      stubs/road-to-task-completion-observability.md. The "outcome recorded" half
      IS done (Phase 2 Step 3): the flip-verdict context now carries a dated
      third evidence pass. The re-evaluation half is not, and cannot be — the
      gate has no inputs. Recorded as transferred rather than met, because a
      recorded null is not a re-evaluation. -->

## Blockers

### blocker: telemetry-sample-size
- **Status:** resolved — transferred 2026-08-20 (disposition B, outcome `transferred`)
- **Owner:** user
- **Class:** 3 — human-only (only real parallel work fills the columns; no command synthesises usage)
- **Blocks:** Phase 1 — Seed real telemetry
- **Merged pair — this entry is ONE HALF of two.** Its sibling is
  `real-orchestration-usage` in
  [`road-to-orchestration-scope-decision.md`](road-to-orchestration-scope-decision.md),
  and the two were found to be **one evidence gap wearing two names** by
  [`agents/evidence/council/drain-blocker-dispositions-a.md`](../evidence/council/drain-blocker-dispositions-a.md):
  "Line count is already satisfied and no longer diagnostic; the shared gap is
  whether a hook can observe task completion and populate quality fields." Both
  halves were rewritten off the count and onto the quality columns (this one
  2026-08-16, the sibling 2026-08-17) and both point at **one** shared stub. That
  sibling roadmap's own checkboxes are owned by the agent that closed it and were
  **not** touched here; only this half is closed by this run.
- **Resolution (2026-08-20) — transferred to
  [`stubs/road-to-task-completion-observability.md`](stubs/road-to-task-completion-observability.md), <!-- ref-ignore -->
  outcome state `transferred`.** The stub already exists, already names this
  roadmap as a second parent, and already carries the probe result — it was
  written by the agent closing the sibling and deliberately shaped to serve both.
  It is not on `main` yet (branch `drain/road-to-orchestration-scope-decision`,
  commit `b2f1119da`), which is why the link above carries `ref-ignore`; drop the
  marker when that branch merges. No second stub was written: duplicating it
  would re-split the gap the council merged.

  **Why this is a transfer and not a wait.** The criterion's two clauses are not
  one chain. Clause 1 (does a hook slot see the task-completion payload) has a
  live-host path and is **partly answered already** — cost and latency are read
  today on a **sync** completion at `orchestration_record_hook.ts:193-199`, which
  is why 40 rows carry numeric `dispatch_tokens`. Clause 2 (≥ 20 rows with
  populated quality columns) has **no** hook path at any slot: `first_pass_success`
  and `escalated` are defined over the parent's *subsequent* rework and
  re-dispatch, events that have not happened at task completion. A perfect
  payload capture therefore fills cost and leaves the quality columns exactly as
  `null` as they are now. That asymmetry — not a missing probe run — is what
  moves this out of the roadmap.

  **Re-measured this run, 2026-08-20, independently of the sibling's reading.**
  `2026-08.jsonl`: 591 lines, **582 orchestration**. `first_pass_success` /
  `escalated` / `task_class` / `dispatch_mode` non-null on **0 of 582**.
  `token_delta_provenance` `estimated` on **582 of 582**. `dispatch_tokens`
  numeric on **40 of 582**, and all 40 are dated **2026-08-09 to 2026-08-13** —
  none since, so the sync subset has been flat for a week while background acks
  grew from 367 to 582. `wall_clock_ms` numeric on 582 but **`> 0` on only those
  same 40**. `spawn_count >= 2` on **0 of 582**. `2026-07.jsonl` still holds the
  single hand-emitted line that is the entire quality corpus.
  `orchestration_savings_report` over the same dir: `dispatches: 582`,
  `first_pass_success_rate: n/a (n=1)`, `escalation_rate: n/a (n=1)`,
  `measured share: 0%`, `MODELED cost reduction: n/a`. Full table and the two
  refinements over the transfer baseline: § Outcome above.

  **Count-met / value-not, stated once more because that is the shape that
  invites a wrong resume** (Risk-Register row 1): the `≥ 20 lines` condition this
  field carried until 2026-08-16 is satisfied roughly 29× over and the blocker
  was open the whole time. Raising the count further moves nothing.
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
