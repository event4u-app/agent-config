<!-- evidence-type: analysis -->
# Inbox round inbox-2026-10-ay — disposition

Round `agents/tmp.old/inbox-2026-10-ay/`: one owner transcript and two
externally drafted plans comparing this package with an external multi-agent
orchestration runtime (Source S1). Both plans were drafted on 2026-10-25, one
pinned at `e494248c`, the other unpinned. Re-verified on 2026-10-26 against
`f9af88efe0` (`origin/main`). The directory arrived under a speaking name and
was renamed to its opaque id before triage.

## Triage

| file | genre | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|
| transcript | transcript | unstated | first-seen | n/a | the owner's demand; walked turn by turn |
| plan A (S1 runtime, v3) | feature-spec | `e494248c` | substrate stub, 17th arrival (runtime half) | n/a | verified claim by claim |
| plan B (17 measures) | feature-spec | unstated | substrate stub, same arrival | n/a | verified claim by claim |

## Anchor census and passes

| Source | Anchors counted | Rows produced | `no-demand` | Unaccounted |
|---|---:|---:|---:|---:|
| transcript (1 owner turn, 5 asks) | 5 | 5 | 0 | 0 |
| plan A (D1–D7, E1–E4, K1–K10, 20 steps) | 41 | 41 | 0 | 0 |
| plan B (R01–R17, 7 invariants, 7 anti-goals) | 31 | 31 | 0 | 0 |

Pass 1 produced 72 rows; pass 2, read against the open files with the ledger in
hand, added 5 (plan A's steps 2.3, 5.4; plan B's invariants 3 and 6 and its
two-hosts adapter R06 split from R02); pass 3 found every `adopted` row in an
artifact. Converged at pass 2.

## Claims

| Claim | Verdict | Checked |
|---|---|---|
| D1 lanes cap is prose; mechanical cap per session only | still-true | `src/agent-src/contexts/execution/process-full-all.md:68-72`, `src/scripts/_lib/host_env_write.ts:50` |
| D2 completion evidence binds to no artifact identity | still-true | `src/scripts/before_complete_hook.ts:21-30` |
| D3 injected memory is not framed as data — **narrowed** | still-true for `memory-recall` only | `src/scripts/hooks/memory_recall_hook.ts:397-420`; hot-context and handoff already spotlight as DATA (`hot_context_hook.ts:22`, `handoff_context_hook.ts:10`, `session_memory_index.ts:139`) |
| D4a 11 of 40 MCP catalog tools are stubs that mislead | never-true | `consumer_tool_catalog.json` description: stubs are not registered on stdio `tools/list` (ADR-132) and carry `[stub — implemented on demand]`; 11 of 41 entries |
| D4b collector daemon opt-in marker has no writer | already recorded | `docs/CLAIMS.md` `resident-process-permitted-under-governance`; stub `road-to-runtime-orchestration-substrate` § What would make this pending state stale |
| D4c `extract_audit_patterns` is never invoked | never-true | invoked from `src/skills/learning-to-rule-or-skill/SKILL.md:35,351`, tested in `tests/scripts/extract_audit_patterns.test.ts` |
| D5 recall leaves no measurable trace | still-true | no log write in `memory_recall_hook.ts`; `session_index: "off"`, `learn_on_session_end: false` (`agent-settings.template.yml:1139,1150`) |
| D6 no contract for a future peer transport | still-true, no consumer | no peer transport exists in `src/` |
| D7 plugin + project install dispatch one event twice | never-true | `src/scripts/_lib/claude_settings_hooks.ts:211-214`: both carriers run the byte-same command, which the host dedupes |
| MCP server binds no network socket | still-true, unpinned | no `listen(`/`createServer`/`0.0.0.0` under `src/scripts/mcp_server/`; no test asserts it |
| Plan B: AC has no intent-ordering planner (R03) | never-true | `src/scripts/_lib/invocation_plan.ts`, ADR-288 Amendment 1 |

## Demands and instructions — discharges

| Point | Discharge | Where |
|---|---|---|
| Owner: compare in depth, research, plan, three critique loops, download | already-satisfied | the two drafts are that output; this run is the in-tree half |
| D3 frame + screen memory recall | adopted | `road-to-recall-that-reads-as-data` Phase 1 |
| Plan A 5.2 / plan B "no network listener" | adopted | `road-to-recall-that-reads-as-data` 2.1 |
| D1 fleet-wide launch budget, fail-closed, deny receipt (E2) | recurrence → substrate stub | `stubs/road-to-runtime-orchestration-substrate` Arrivals 17, track 3; the fourteen-lane run named as a candidate gate record; E2 recorded there as owner-reserved |
| D2 verification bound to checked state; unreachable ≠ failed; plan B R04 split | adopted onto owner | `later/road-to-adversarial-verification-and-long-runs` new step 8.3 |
| D5 / plan A 5.3 recall log without prompt content | adopted onto owner | `later/road-to-a-memory-the-consumer-owns` new step 8.2 |
| Plan A 5.4 coverage-gate measurement arm | declined | predicate table is the measured choice (`memory_recall_hook.ts:20-29`); an arm needs 8.3's log first, so it belongs to that owner once the log exists |
| Plan A 0.3 / 2.2 / 2.3 unconsumed-module census + ratchet; E3 | declined | the three named examples are never-true or already recorded (D4a–c); a new gate needs a measured false-positive rate first |
| D6 / plan A 5.1 peer-transport invariants + fixtures | declined | no transport exists and none is planned in the tree; fixtures against no implementation test nothing |
| E1 fold vs own trunk | already-satisfied | each finding landed on its owner above |
| E4 doctor flags third-party hook registration | already-satisfied | `src/scripts/_lib/neighbour_census.ts` (read-only, by shape) |
| Plan B R02, R06, R08, R09, R15, R16, R17 — executor, worker, resume, 24/7, interop, federation | recurrence → substrate stub | `stubs/road-to-runtime-orchestration-substrate` Arrivals 17; no new measurement, posed question unchanged |
| Plan B R05 n≥20 A/B benchmark | declined | spend-bearing; `docs/contracts/benchmark-ab-contract.md` already sets the contract |
| Plan B R07 global request cap | recurrence → substrate stub | same row as D1 |
| Plan B R10 OpenTelemetry traces | declined | no consumer in the tree; payload logging default-off is already the house rule |
| Plan B R11 review independence | already-satisfied | `evaluator-independence` rule, completion review |
| Plan B R12, R13 learned memory / routing | declined | both plans kill them (plan A K4); the tier already reaches the host natively (`_lib/subagent_native_fields.ts`) |
| Plan B R14 Linear adapter | declined | no demand in the owner turn; `jira-integration` covers the tracker surface |
| Plan A K1–K10, plan B anti-goals | already-satisfied | consistent with ADR-280 and existing kill records; nothing to change |

## Ledger

```
claims        11 extracted → still-true 6 / already-fixed 0 / never-true 4 / unverifiable 0 / recorded 1
instructions  24 extracted → reproduced 0 / diverged 0 / unexecutable 0 / out-of-bound 0 / not-attempted 24 (plans, not procedures: no asserted outcome to reproduce)
demands       42 extracted → adopted 5 / already-satisfied 8 / declined 9 / owner-decision 1 / recurrence 19
```

Recurrence rows count every plan-B measure routed to the substrate stub
individually. The owner-decision is E2 (fail-closed launch budget), recorded on
the substrate stub and not asked now: its track is gated on a measurement no
run has produced, and the owner settled "promote none" for that stub.
