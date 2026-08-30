<!-- evidence-type: analysis -->

# Autonomous drain run — 2026-08-30

> **INTERIM, not final.** The run was asked to empty `agents/roadmaps/`. It
> closed three of the seven present and stopped with four open. This file
> records what shipped, every council decision, every descope, and — because
> they are the useful part — the defects the execution found in the roadmaps
> themselves.

## PRs

| PR | Roadmap | State |
|---|---|---|
| [#1742](https://github.com/event4u-app/agent-config/pull/1742) | `road-to-experience-loop-broadening` | 44/47, 3 carried, archived. CI **46 pass / 0 fail** |
| [#1743](https://github.com/event4u-app/agent-config/pull/1743) | `road-to-concern-admission-ratchet` | 13/13, nothing deferred, archived |
| [#1744](https://github.com/event4u-app/agent-config/pull/1744) | `road-to-gates-that-do-not-run` | 14/14, nothing deferred, archived |

## Council decisions (5 rounds, anthropic + openai, 2/2 convergent each)

| # | Question | Verdict |
|---|---|---|
| 1 | Does a parked ENFORCEMENT decision bind a RECORD-LABELLING change? | **(B) No** — different mechanism. Switch-back condition recorded at the stub; audited, not met. |
| 2 | Where do experience cards live? | **(A)** `agents/knowledge/` as a strict tagged union — never conditional fields. |
| 3 | AC-9 needs elapsed time — re-scope or descope? | **(b) Carry verbatim.** "Can close" is not "has closed". |
| 4 | *(within 1)* Cutover marker required before a labelling change | Lines carry `outcome_semantics`; append-only logs do not roll back. |
| 5 | *(within 3)* Data-quality gate before the lifecycle gate | A follow-up gated only on elapsed time never closes if the sensor cannot record what it waits for. |

Two pre-existing blockers were **not** re-run: both were already 2/2-decided on
2026-08-29 and record their remaining halves as owner-reserved. Re-running would
have been verdict shopping.

## Descopes — carried, never cancelled

| Item | Receiver | Why |
|---|---|---|
| AC-9 | `later/road-to-experience-lifecycle-operational-proof.md` | Needs elapsed operational time. No failure pattern exists to mine; nothing can have expired. |
| 7.6 | `later/road-to-experience-loop-owner-decisions.md` | Blocked on E8, an open maintainer decision. |
| 9.6 | same | Crosses a recorded architectural boundary — owner-reserved. |

## Defects the execution found, that the roadmaps did not

1. **Dispatch capture is an honest null at 85.7 %** against a 95 % pre-registered bar — a ~317× improvement over the 0.27 % prior, and still a fail.
2. **A denominator effect found by an impossible reading.** `CLAUDE_PROJECT_DIR` resolves to the parent checkout in a worktree; counting the main checkout alone returned **187 %**.
3. **A safety carve-out exempted 4 of 9 safety rules.** `domain-safety-pii`, `tool-safety`, `runtime-safety` and two others were REAP-eligible on low usage.
4. **`rules_applied` is a producer constant** while the contract called it an observation. Prose deleted, replaced by a checkable helper.
5. **The concern-ratchet roadmap's own reproduce command over-counts** — whole-file grep catches `roles:`/`platforms:`/`native_event_aliases:`. Exactly 16 at every pin: the axis is **55, not 71**. The finding survived; the figures did not.
6. **The gates roadmap's "32 unreachable" was 22** — a workflow can call the *script* directly, which a task-graph reading cannot see. 17 gates were running all along.
7. **`deps:` is a third task-edge kind**, missed by the first parser — and missing it reports a target as unreachable when CI does run it.
8. **Wiring into `task ci` is only half of reachable** — the parity ratchet caught the roadmap's own defect reproduced by its own fix.
9. **`check_estate_count`'s guidance names a key its parser does not read** (`estate_growth_exempt` vs `estate_offset_exempt`). **Not fixed — owner's call.**
10. **An archived roadmap claimed CI wiring that never existed.** Annotated in place.

## Not started, with the reason

| Roadmap | Steps | Why not |
|---|---|---|
| `road-to-retired-claims-stay-retired` | 14 | Depends on #1744's Phase 2.1; would have needed a stacked 4th PR on unmerged work. |
| `road-to-agent-turnaround` | 21 | Not reached. |
| `road-to-capability-native-execution` | 55 | **AC-14 hard stop**: all five blockers must read `resolved` before any Phase 1-9 code; `b-adr-088` is open and owner-reserved. Its `s7` fixture also makes AC-6 unsatisfiable against its own frozen corpus. |
| `road-to-governed-harness-evolution` | 58 | Phases 1-6 legal, ~12 decisions outstanding. |
| `road-to-inbox-harvest-2026-08-e-council-topology-evidence` | 77 | Not reached. |

Full briefs for capability-native and governed-harness were produced during the
run and are the cheapest resume point.
