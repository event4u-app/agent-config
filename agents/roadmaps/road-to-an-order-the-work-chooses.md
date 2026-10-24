---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
# relates: roadmap:context 2026-10-24 — scanned: 5 PRs, 1118 roadmap files, 923 remote branches; no sibling on the topic
relates:
  - slug: road-to-agent-throughput-recovery
    relation: disjoint
    note: >
      Owns foreground-vs-background CI waiting (council D9). This roadmap removes
      only the superseded wait, whose verdict is cancelled before it can be read,
      and hands it a reader (5.1).
  - slug: road-to-a-step-that-costs-what-it-changes
    relation: disjoint
    note: >
      Owns how deep a stage runs; this roadmap owns the order of stages and where
      delivery happens.
estate_offset_exempt: "Owner search 2026-10-24: grep -rlF for 'stage order', 'delivery', 'ci-wait', 'superseded', 'composed invocation' over agents/roadmaps/*.md, later/ and stubs/, plus agents/roadmaps-owned.md — road-to-agent-throughput-recovery owns only foreground-vs-background CI waits (council D9), road-to-composite-dispatch-topology owns delegated-slice topology (parked), road-to-a-step-that-costs-what-it-changes owns per-step depth; nothing owns the order of an invocation's stages or where delivery happens. Executed and archived in the same change, so the active count is unchanged at merge."
---
# Road to an order the work chooses

> **Source:** `agents/tmp.old/inbox-2026-10-ag/` — an owner chat plus three
> supplied plans (one revision set: a dated planner plan embedded as the
> appendix of a later orchestration plan, and an independent proposal), drained
> 2026-10-24 at `origin/main` c164cc24b4. Every `file:line` below was
> re-verified against that tree.

## The incident

An invocation of the shape *"analyse the inbox — in a worktree and a PR — first
write the roadmap, then work it off with `/roadmap:process-full`, then update
the PR"* ran `/analyze:inbox` to its own end — commit, push, open the PR,
**wait for CI** — and only then started `/roadmap:process-full`, which pushes
to the same branch again and settles CI again. The first CI run could never
matter: the next push on the same PR cancels it (`tests.yml:51-52`,
`smoke.yml:43-44`, `skill-lint.yml:42-43`, all `cancel-in-progress: true`). Its
whole wait was dead time — between 11m36s (required-green p50) and 21m17s
(all-green p50) per composed invocation (`agents/reports/ci-time-to-green.md:26`).

The owner's correction, verbatim from the chat: the user often types everything
they want, which does not mean that is the best order; AC should recognise a
better order and act on it — for every direct input, not only roadmaps.

## Goal

When this is finished, an input naming several stages is executed in the order
the work needs, not the order it was typed: delivery (push, PR, CI settle)
happens once, after the last stage that writes the same branch; duplicate sinks
collapse; an explicit order marker, a review fence, a stated reason, a real
dependency and every outward or irreversible effect keep their place. The agent
states a changed order in one line and never asks permission to reorder. A
single-stage input pays nothing. Someone else can tell this happened by running
the invocation-plan fixtures: G1 (the incident) linearises to one delivery at
the end, and every constraint fixture keeps its order.

## Findings at `origin/main` c164cc24b4

| # | Finding | Evidence |
|---|---|---|
| F1 | User order becomes execution order: "first … then … finally" maps to `do-in-steps`; nothing re-derives order from dependencies or cost | `src/agent-src/contexts/execution/auto-dispatch-classification.md:24-28`; `src/scripts/_lib/auto_dispatch.ts:84-86` |
| F2 | Every command carries its own terminal delivery; ADR-288 D5 decided only the **standalone** inbox case | inbox `command.md:88-92,112-116`; `src/scripts/analysis_publish.ts:242-283`; ADR-288:99-105 |
| F3 | process-full forbids exactly the push the composed inbox run makes | `src/domains/product-basic/roadmap/process-full/command.md:156-159` |
| F4 | `--no-pr` and the run state `committed` exist; nothing selects them because a later stage delivers; no inner-stage notion anywhere | inbox `command.md:57,90`; `src/scripts/analysis_run.ts:30` |
| F5 | The intermediate CI verdict is void by construction (`cancel-in-progress: true`) | workflows above |
| F6 | Every push injects "Before this turn ends: 1. Settle it" — right for a terminal push, wrong for an intermediate one | `src/scripts/hooks/push_settle_hook.ts:199-200` |
| F7 | Publish settles with `--timeout-min 28` above the 9-minute foreground ceiling | `analysis_publish.ts:345`; `src/scripts/ci_settle.ts:63` |
| F8 | `delivery.wait_for_ci` is declared in four places and read by nothing; `settleCi` always settles | `src/server/schemas/settings.ts:146`; `analysis_publish.ts:246` |
| F9 | Authorization is op-by-op and correct; nothing says moving an authorised push later, or merging two authorised sinks, is not a new operation | `src/rules/scope-control.md:36,42-43` (kernel rule — not edited here) |
| F12 | A mid-flight "also do Z" / "that order makes no sense" has no re-plan bucket — today it is an Interrupt that stops and asks | `src/rules/user-interrupt-priority.md:44-46,52-54` |
| F14 | The incident's own PR carries two regeneration commits for generated artefacts inside one run — a sink that coalesces to one | PR #2649 (open), commits `0434a9d2f7`, `a880336180` |

## Phase 1 — The invocation plan, deterministic and testable

- [x] **1.1 A pure linearizer `src/scripts/_lib/invocation_plan.ts`.** Input:
      stages with an effect set, the object each effect touches, and the
      constraint markers C1–C5; output: the executed order, the coalesced sink
      list, and the one-line `Order: … — …` text only when the order differs.
      Rules R0–R5 as in the context (1.2). Zero model calls — the agent supplies
      the structured stages, the function decides the order.
      verify: `tests/scripts/invocation_plan.test.ts` runs fixtures G1–G12
      (table in the 1.2 context), each seen red before the function exists.
- [x] **1.2 `src/agent-src/contexts/execution/invocation-plan.md`.** The
      procedure in one screen: split into stages → tag effects → classify
      C1–C5 (DE/EN markers) → apply R0–R5 → linearise → emit the order line
      only when it differs. Fires on ≥ 2 stages or one stage with a sink; a
      single sink-free stage skips it. States the authorization clause F9 asks
      for — moving an authorised operation later, or merging two authorised
      sinks, is not a new operation and never authorises one the input did not
      name — here, because `scope-control` is a kernel rule.
      verify: `check_context_paths` and the context lints green; the fixture
      table in the context names the same G ids the test runs.
- [x] **1.3 The sixth mandated line, `Order`.** `mandated-lines.md` gains it:
      what moved and why, one line, silent when the order is unchanged.
      verify: `lint_mandated_lines` suite green; the pre-send sweep lists six
      lines.
- [x] **1.4 Ordered plan is a candidate, not a schedule.** Signal 2 of
      `auto-dispatch-classification.md` reads "first … then … finally" as an
      ordered candidate whose order the invocation plan decides before a mode
      is chosen. `auto_dispatch.ts` is untouched — it picks a mode, not an order.
      verify: `_lib_auto_dispatch.test.ts` green; the doc names the context.

## Phase 2 — Contracts that compose

- [x] **2.1 ADR-288 amendment.** "A door invoked as a non-terminal stage of a
      composed invocation stops at `committed`; the terminal stage owns
      publication. 'Standalone' in D5 means: no later stage of the same
      invocation writes the same branch." Supersedes nothing else in D5–D7.
      verify: ADR index regenerated; `analyze_inbox_limits.test.ts` green.
- [x] **2.2 `analysis_publish` honours an inner stage.** `PublishInput` gains
      `stage?: 'terminal' | 'inner'`; `inner` commits, records `committed`, and
      returns with no push, no PR and no settle.
      verify: a publish test with `stage: 'inner'` records zero pushes, zero PR
      creates and zero settles on the in-memory port, and the record ends at
      `committed`.
- [x] **2.3 `/analyze:inbox` names the composed-stage case** next to `--no-pr`
      in § Where the work happens: a later stage of the same invocation that
      writes the branch makes this run an inner stage.
      verify: `analyze_inbox_limits.test.ts` and the command lint green.
- [x] **2.4 `/roadmap:process-full` takes delivery over.** As the terminal
      stage of a composed invocation it updates the open PR on the branch if one
      exists, otherwise opens the first one — once, at its own end. "ONE ROADMAP,
      ONE PR" gains "ONE INVOCATION, ONE DELIVERY".
      verify: command lint green; the clause quotes the inner-stage contract of
      2.1.

## Phase 3 — Engine fixes found on the way

- [x] **3.1 Publish settles inside the foreground ceiling.** The
      `--timeout-min 28` at `analysis_publish.ts:345` goes; `ci_settle`'s own
      default applies.
      verify: a unit test asserts the port's settle argv carries no timeout
      above `FOREGROUND_CEILING_MIN`.
- [x] **3.2 `delivery.wait_for_ci` gets its reader.** `settleCi` takes the
      resolved setting; `false` ends at `pr-open` with a one-line reason and no
      `ciSettle` call.
      verify: settle test with `waitForCi: false` → record ends `pr-open`, the
      port records zero settles.

## Phase 4 — Free text and mid-flight amendments

- [x] **4.1 An Amendment bucket.** `user-interrupt-priority` gains a fourth
      row: same mission, a stage added, removed or re-ordered → re-plan the
      remaining stages, emit the order line, continue. A different deliverable
      stays an Interrupt. The added characters are paid for inside the same
      rule body, so the auto-rule budget baseline does not move.
      verify: the auto-rule budget check is green with the baseline unchanged;
      G13 in the context reads "PR only at the end, please" mid-run → re-plan,
      no stop.

## Phase 5 — A reader for the superseded wait

- [x] **5.1 `probe_turnaround` reports `ci-wait-superseded`.** A `ci-wait`
      whose PR receives another push from the same session afterwards is
      superseded; the probe prints the count and minutes beside the existing
      blocking causes. Reuses `classifyBlockingCall`; adds no capture.
      verify: a fixture transcript with push → settle → push on one PR reports
      one superseded wait with its minutes; a single push reports zero.

## Not done here, and why

| Item from the sources | Disposition |
|---|---|
| Effect frontmatter on every command plus a `lint_command_effects` sweep | Declined for now: the linearizer takes effects as input; a frontmatter vocabulary without a reader is ceremony. Parked as `stubs/road-to-command-effect-declarations.md`, woken by the 5.1 reading |
| Plan record + pre-push advisory hook (shadow → deny) | Parked in the same stub; needs a live miss rate first |
| 14-day baseline and re-read against a pre-registered bar | Elapsed-time work → stub (template rule 17c) |
| Foreground-vs-background CI waiting | Owned by `road-to-agent-throughput-recovery` (council D9) |
| A planner model call per turn, a DAG engine, durable resume, learned optimisation, new `/plan` verb | Killed: zero-extra-call linearisation over a handful of stages; parallelism stays with auto-dispatch; ADR-041 |
| Council deciding orders | Only for an ambiguous constraint where the reorder changes content, not timing; reorders are reversible and the 2026-10-24 directive keeps the council for irreversible, release and security decisions |

## Decisions

| ID | Class | Decided by | Decision | Evidence | Revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | The authorization clause lives in the new context, not in `scope-control` | `scope-control` is a kernel rule (`kernel-membership.md:148,169`); kernel edits need their own PR and a 24 h soak | the clause is shown not to load where a reorder happens |
| D2 | reversible-technical | owner chat 2026-10-24 | ADR-288 D5 is amended rather than superseded | the owner asked AC to act on a better order; the amendment narrows "standalone", nothing else | a composed run publishes from an inner stage |
| D3 | reversible-technical | evidence | One inner-stage parameter, not a new flag per command | F4: `--no-pr` already means "no commit"; ADR-041 controls verbs | a second command needs the same deferral and cannot take the parameter |
| D4 | reversible-technical | evidence | The closure scan's five `typed-op` hits (frontmatter, F7, 2.2, 3.1, AC-4) are prose about publish and settle code paths, not operations: no step pushes, merges or publishes on its own authority | `closure_scan` run 2026-10-24, five hits, each read | a step is added that pushes or merges on its own authority |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Literal intent reordered | product | The agent moves something the user meant literally | C1–C4 kept by the linearizer, fixtures G2–G4, "in dieser Reihenfolge" restores literal order, the order line names every move | Phase 1 — The invocation plan, deterministic and testable |
| 2 | Ceremony growth | implementation | The plan fires on every turn and adds lines | fires only on ≥ 2 stages or a sink; G11 asserts zero output for a single stage | Phase 1 — The invocation plan, deterministic and testable |
| 3 | Local-only window grows | implementation | Deferred delivery leaves work unpushed longer | worktree commits persist; G12 asserts partial delivery on failure | Phase 2 — Contracts that compose |

## Acceptance Criteria

- [ ] AC-1 — G1 linearises to inner-stage inbox → process-full → one push, one
      PR, one settle, with exactly one order line.
- [ ] AC-2 — Every constraint fixture (G2, G3, G4, G9, G10) keeps its order.
- [ ] AC-3 — A single-stage input produces no order line (G11).
- [ ] AC-4 — An inner-stage publish makes no remote call, and a
      `wait_for_ci: false` settle makes no settle call.
- [ ] AC-5 — The auto-rule budget baseline is unchanged.
