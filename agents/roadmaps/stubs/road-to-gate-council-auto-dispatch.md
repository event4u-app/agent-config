---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to release-gate council auto-dispatch

> **Stub — not active work.** Transferred out of
> `road-to-always-on-orchestration.md` (Phase 4.3 + blocker
> `gate-council-auto-dispatch`) by the autonomous drain run of 2026-08-20.
> Council 2026-08-20 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> quorum 2/2), disposition **B — transferred**, outcome state `transferred`.
> Rationale recorded by the council: *"Auto-dispatch changes external behavior
> and cannot precede verified reconciliation soak or a usable benefit/risk
> window."*
>
> **Promotion note.** The three shared promotion criteria in
> [`README.md`](README.md) (recruited customer, funded security audit,
> maintainer ADR) **do not govern this stub.** This is a drain-run transfer
> gated on a soak window and a telemetry window, not an org-mode surface. Its
> gate is the re-entry probe below.

## 1. Original criterion (verbatim)

The transferred blocker's `Resolved when` clause, copied without edit:

> the wiring lands citing the soak evidence, or the telemetry says auto-fire
> adds nothing and the gate stays recommend-only.

Note the criterion is satisfiable in **either** direction: the honest-null
branch ("auto-fire adds nothing, gate stays recommend-only") closes this stub
as legitimately as the wiring does. That symmetry is preserved deliberately —
a stub whose only exit is "build it" is a parking lot.

## 2. Dependent steps moved (complete list)

- **Phase 3 soak verification** — transport reconciliation confirmed in real
  passes, not just in the reconciliation commit.
- **F6/F4 and council-attendance telemetry collection** to a usable window.
- **The four guards the council named** — loop protection, metered-fallback
  cap via `cost_budget`, latency budget, and the unactioned-verdict kill
  criterion from Phase 6.2.
- **The wiring itself** — the release-gate escalation dispatching the council
  pass rather than recommending it, under the quorum rules from Phase 3.3
  (majority; `inconclusive` HOLDS the gate for a human and never degrades to
  advisory).
- **The Phase 6.2 verdict** on whether the council trigger survives its own
  registered kill criterion.

Phase 4.1's verdict-handoff envelope does **not** move — it shipped, and it is
what makes a dispatched verdict consumable in the first place.

## 3. Re-entry producer and detection probe

- **Named producer:** the **gate-autonomy maintainer** — the owner of the
  release-gate escalation path. Not "when telemetry is ready"; the producer is
  the person who owns the gate whose behaviour would change.
- **Detection probe:** a **dated soak report** plus a **telemetry query**, both
  satisfying pre-registered minima, before an integration test is permitted to
  let auto-fire run.
- **Probe values measured today (2026-08-20)** — both windows have opened
  since the parent roadmap was cut:
  - **Council attendance:** 121 `quorum_result` events in
    `agents/runtime/council/events.log` <!-- ref-ignore --> (gitignored
    runtime log). Attendance distribution: `present=2` in 94, `present=1` in
    17, `present=0` in 9, `present=3` in 1.
  - **Orchestration dispatch:** 554 lines carrying an `orchestration` block in
    `agents/runtime/state/audit/2026-08.jsonl` <!-- ref-ignore -->, of which
    553 record `spawn_count > 0`.

**What these numbers change, and what they do not.** The parent roadmap's
Context section states flatly: *"Telemetry accumulation is zero. F6/F4 shipped
yesterday. Every calibration-consuming step is therefore a gated blocker, not a
phase."* That premise no longer holds — this is the one transferred blocker
whose gate has measurably moved, and the 17 solo-concluded passes out of 121
are exactly the Risk-6 shape (majority at n=2 is a single voice) now visible in
data rather than argued in prose. What the numbers do **not** establish is the
*soak* half: attendance volume is not the same as verified transport
reconciliation across real passes, and no pre-registered minima have been
written down yet. Writing those minima is the first task on re-entry, and it
must happen **before** reading the telemetry again, or the threshold is chosen
to fit the data it is meant to judge.

## Seed content on re-entry

- Write the pre-registered minima first, then query. Sequence is the control.
- `inconclusive` holds the gate for a human. This is the clause most likely to
  be eroded under time pressure and it is the one that keeps the human in the
  loop at n=2.
- The unactioned-verdict rate is the council trigger's registered kill
  criterion (Phase 6.2). Auto-dispatch that raises verdict volume while
  unactioned rate rises is the failure mode, not a success.
- A metered-fallback cap is mandatory: auto-fire multiplies pass frequency, and
  quota exhaustion must degrade to the quorum path, never to uncapped metered
  API — the Phase 3.4 property this must not undo.
