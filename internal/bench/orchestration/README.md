# Orchestration Telemetry Corpus

> Controlled delegable-task set for generating and comparing real orchestration
> telemetry. NOT a headless benchmark — tasks run in an actual Claude Code
> session; Phase-2 telemetry captures the results.

## What this corpus measures

Real orchestration telemetry (`token_delta`, `spawn_count`, `verify_mode`) from
the actual Claude Code `Task` tool, read from
`agents/runtime/state/audit/YYYY-MM.jsonl`. This is the primary evidence for
the `gateVerdict()` flip-gate.

## What this corpus does NOT measure

- It is not a headless automation (the bench harness cannot execute real `Task`
  tool calls). The `bench_ab_v2_run.ts` harness is a scripted re-call loop — it
  does not spawn subagents. These corpus tasks require an interactive or
  `claude --dangerously-skip-permissions` session with real tool execution.
- It does not establish a controlled single-agent baseline independently — the
  single-agent baseline is inferred from the `task_size_estimate` field in the
  telemetry (approximation, marked `token_delta_provenance: "estimated"` when
  host usage is unavailable).

## How to run

1. Ensure `subagents.enabled: true` and `subagents.auto: on` in
   `.agent-settings.yml`.
2. Open a Claude Code session on the `internal/bench/ab/fixture/` project.
3. Paste each corpus task from `corpus/` as a user message.
4. After the task completes, check `agents/runtime/state/audit/YYYY-MM.jsonl`
   for the `orchestration` sub-object. Run `/cost:report` to see the summary.

For a baseline (single-agent, no orchestration):
1. Set `subagents.auto: off`.
2. Run the same corpus tasks.
3. The `spawn_count` will be 0 — the audit line will show `token_delta: 0`.
4. Compute the ratio manually or wait for `gateVerdict()` in Phase 5.

## Corpus entries

| ID | Signal | Expected mode |
|---|---|---|
| `orch-01-multifile-analysis` | N independent files — `parallelizable: files` | `do-in-parallel` |
| `orch-02-ordered-refactor` | Ordered 3-step plan | `do-in-steps` |
| `orch-03-competitive-impl` | Two design approaches, judge picks | `do-competitively` |
| `pv-01-hollow-detection` | "is it ready?" over a stub-covered shipped path | `production-validator` verdict (A3) |
| `pv-02-negative-control` | clean one-file "is it ready?" — MUST NOT flip | negative control (A3) |

## A3 — subagent Gate-A eval (`production-validator`)

Reuses this corpus + the #699 orchestration telemetry object (no parallel bench).
The `pv-*` tasks measure whether the `production-validator` **subagent** earns its
place versus **two baselines**, per the roadmap's dual-baseline rule:

1. **inline host** — the host answers directly (`subagents.auto: off`).
2. **generic inline dispatch** — a generic reviewer subagent, no
   `production-validator` identity.
3. **production-validator** — the shipped wedge subagent.

Fill this table per task (one row per arm), from the telemetry line's
`orchestration` object (`token_delta`, `verdict_changed_outcome`, `verify_mode`):

| task | arm | verdict | verdict_changed_outcome | token_delta | tokens acceptable? |
|---|---|---|---|---|---|

> **First run recorded (2026-07-05): HONEST NULL** — see
> [`pv-a3-results.md`](pv-a3-results.md). No baseline was fooled on `pv-01`
> (all arms caught the hollow path), so `production-validator` shows no verdict
> lift and stays default-off per ADR-109 Gate A. The `pv-02` control passed.

**Gate A (ships the unit only if):** on `pv-01`, `production-validator` records
`verdict_changed_outcome: true` (flips a false baseline `READY`→`NOT READY`) at
acceptable `token_delta`, **and** on `pv-02` (negative control) **every** arm —
including `production-validator` — records `verdict_changed_outcome: false`. A
`true` on the control is a spurious finding and **fails the gate** regardless of
`pv-01`. If no baseline is fooled on `pv-01`, there is no lift — record the honest
null and the unit stays default-off in `src/` per ADR-109 Gate A.

**Billable + operator-gated.** These are real-session runs (the harness cannot
spawn subagents headlessly — see limitations below). Do NOT fire the billable run
autonomously; the maintainer runs the three arms and records the table.

## Honest limitations (per roadmap step 3)

- `user_override_rate` cannot be measured from these task runs — it requires
  tracking settings changes across a real user population. Stays 0 in all
  telemetry.
- Each run is a single session sample. A meaningful gate requires ≥ 20
  orchestrated dispatches per corpus entry (across multiple sessions/runs) to
  reduce variance.
- The fixture project is static — task difficulty is controlled but artificial.
  Real `ask`-mode telemetry from diverse real tasks is always the stronger
  signal.
