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

---

# Run 5 — 2026-08-30, later the same day

> Six PRs. **Four merged during the run** (#1744, #1746, #1747, #1748); two open
> at close (#1749, #1750). One roadmap closed and archived; four advanced; none
> abandoned. Five council rounds, one of which **split** and was resolved
> conservatively rather than by picking the convenient half.

## PRs

| PR | branch | what it carries | state at close |
|---|---|---|---|
| **#1744** | `drain/gates-that-do-not-run` | inherited from Run 4; this run fixed **three** CI defects in it and merged `main` twice | **merged** |
| **#1746** | `drain/retired-claims-stay-retired` | `road-to-retired-claims-stay-retired` **14/14**, archived | **merged** |
| **#1747** | `drain/agent-turnaround` | `road-to-agent-turnaround` **19/21**, 2 deferred behind named blockers | **merged** |
| **#1748** | `drain/governed-harness` | `road-to-governed-harness-evolution` Phases 0–1, **12/58** | **merged** |
| **#1749** | `drain/capability-native-2` | `road-to-capability-native-execution` step 0.6 — the only step AC-14 permits | open |
| **#1750** | `drain/council-topology-2` | council-topology Phase 0 + Phase 1A, **12/77**, and this file | open |

## Council decisions — five rounds, all seats present

| # | question | verdict | acted on as |
|---|---|---|---|
| 1 | Gate the user-scope bucket in the payload budget? | **(a)** gate + rebaseline, **2/2** | superseded by round 2 |
| 2 | …given the checker's actual bucket definitions | **(a′)** correct the false reason, add the reconciliation test, leave the baseline, **2/2** | implemented verbatim |
| 3 | E4 + E9 — activation-ladder and cascade arity | **(B)** six rungs, twelve stages, **2/2**, with an evidence-matrix condition | implemented; the condition is `LADDER` |
| 4 | Was closing governed-harness 0.4–0.6 premature? | **SPLIT 1/1** — (b) vs (d) | conservative side taken; see below |
| 5 | A 2-line feature vs a shrink-only source ratchet | **(c)** pay with a local behaviour-preserving reduction, **2/2** | paid; baseline untouched |

**Round 2 is the one worth reading.** Round 1 voted to gate the user-scope
bucket and rebaseline; its two seats explicitly deferred the arithmetic to "the
checker's exact calculation" and proposed baselines **~124k apart**, which is
the signal that neither had the bucket definitions. Given them, round 2 found
the 104 user-scope rules are a **subset** of a bucket the gate already measures
in full — gating them would have moved the baseline ~111k for zero additional
delivered payload. A council answering the question it was given, and a second
round answering the question that was actually there.

**Round 4 split, and a split is an escalation condition, not a verdict.** Both
seats agreed the guards work, that their tests prove the behaviour the verify
clauses name, and that **the gap is real** — nothing forces a future runner to
call them. They differed on whether 0.4/0.5 may close meanwhile. The
conservative side was taken **on asymmetry, not on agreement**: under-claiming a
closed step costs a checkbox; over-claiming one is the failure Run 4 named, with
*"never got built"* replaced by *"never got called"*. Both rationales are
recorded verbatim at `blocker: guard-call-site-integration`, and AC-8 — which
both seats asked for — is in the roadmap.

## Descopes and deferrals

| item | disposition | why it is not effort |
|---|---|---|
| `agent-turnaround` 2.4 | `[~]` → `post-change-window` | measures the effect of 2.2, which landed minutes earlier; the post-change sessions do not exist yet |
| `agent-turnaround` 5.3 | `[~]` → `authorization-shape-for-long-runs` | **owner-reserved**; put with both options and the measured spans, deliberately with no recommended value |
| the `paths:` wiring gap | carried to `road-to-turnaround-followups` | a consumer-facing installer change that would silently narrow three rules' activation, from inside a measurement roadmap |
| `governed-harness` 0.4, 0.5 | `[~]` → `guard-call-site-integration` | the split above |
| `governed-harness` 0.8 / Phase 7 | unchanged `[~]` | merge-authority is owner-reserved |
| `capability-native` Phases 1–9 | untouched | **AC-14**: all five blockers must read resolved first, and `b-adr-088`'s remaining half narrows an accepted ADR floor — owner-reserved, no council may close it |

## Twelve defects found, each by executing rather than reviewing

**In CI, on inherited work (#1744):**

1. `check_release_includes_discovery` wired as a bare workflow step; `dist/discovery/` is gitignored, so it died on a missing file on every PR run.
2. The same class again in `lint_mcp_registry_manifest` — and the first repair (a build step) fixed the gate and **broke CI↔local parity**. The dep on the task target settles both; `ci_only:` would have been the wrong shape, because a builder is not a gate.

**In the roadmaps' own premises:**

3. `retired-claims` said six `resolved-null` rows; there are **seven**.
4. It said four closed claims had published phrasings; measured, exactly **one** — `git log -S` over all five publish surfaces.
5. `agent-turnaround`'s risk register had ranks out of order (1, 2, 7, 6, 3, 4, 5), invisible while the file was a draft.
6. `non-destructive-by-default` cannot carry an `evidence:` block: it is `type: always`, and four frontmatter lines breached the kernel top-3 cap on a ratchet with **two characters** of headroom.

**In the instruments this run built:**

7. `probe_turnaround` **gated on its own execution** — baseline 81.42, re-run 81.61 minutes later with nothing changed but the clock.
8. `calls_per_request` is unratchetable even so: 81.42 → 72.67 → 73.73 across one afternoon as the mtime window slid. Now reported, never compared.
9. The census's derived rows were added to a **sum**, injecting ~123k phantom tokens and reddening the payload gate on the first run.

**In the re-council guard, found by probing the live CLI:**

10. The exact pass compared the **built prompt** against the hash of the question **file**, so both `exact-*` states were unreachable and every true repeat reported as a near-duplicate at similarity 1.00.
11. The config fingerprint used bare member names while the artefact writer records `name/model` — so `exact-same-config` could never fire. *Two states that can never both occur are one state with extra words.*

**In the tree, found by a gate:**

12. `task preflight` measures **36.05 s** against a declared `pre_push_budget_seconds: 25` — **44 % over** a ceiling whose own comment calls it "a real budget, not a wish", and nothing measures the hook. Recorded, not fixed: narrowing preflight is one edit from turning a push-blocking mirror into a partial one.

## What this run did NOT do

- **It closed one roadmap, not five.** `retired-claims-stay-retired` is archived
  at 14/14. The other four are advanced and open, and two of them are stopped at
  an owner decision no council may take.
- **It did not archive `road-to-agent-turnaround`,** and that is the mechanism
  working: `update_roadmap_progress` archives only at `deferred === 0`, which is
  Iron Law 3 refusing to bury planned-for-later work.
- **It reversed a Run 4 disposition and then partly un-reversed it.** Run 4 left
  governed-harness 0.4–0.6 open on purpose; this run closed all three, put the
  reversal to the council as `decision-revisit-gate` requires, and reopened two
  of them when the seats split. 0.6 stands — both seats agreed its clause names
  no run at all.
- **It wired no Phase 1–9 code into `capability-native`,** because AC-14 forbids
  it. One pre-registration step is the whole legal surface, and that is the
  roadmap working rather than stalling.
