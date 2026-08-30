<!-- evidence-type: analysis -->

# Parallel council fan-out — revisit record

`road-to-inbox-harvest-2026-08-e-council-topology-evidence` step **4.1**.
Written 2026-08-31 on `drain/council-topology-p4`, based on `origin/main`
@ `60ad56b7c`.

This record discharges [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md)
for the sequential-dispatch decision that Phase 4 proposed to reopen. It is a
**transcription of a verdict that was already reached**, not a fresh decision:
the roadmap's `blocker: parallel-fanout-reopens-a-closed-decision` carries
`Status: resolved` with resolution **(a) — keep sequential dispatch and close
Phase 4 as a published null**, decided by AI council on 2026-08-28, **2/2**.
What was missing was the record itself, in a form the next session can read
without re-deriving it from a blocker body.

## 1 — The recorded decision

Members are dispatched **sequentially, in input order**. The decision is stated
in the orchestrator's own contract docstring:

> `src/scripts/ai_council/orchestrator.ts:8-12` — *"v2 contract (sequential +
> interactive overrun prompt): Members are called **sequentially** in input
> order. The previous parallel ThreadPoolExecutor was traded for predictable
> mid-flow user prompts; with 2-3 council members the latency cost is small."*

It is a trade that was made, not a feature that was never built: the parallel
executor **existed** in the retired Python orchestrator (ADR-200 records the
port) and was removed on purpose.

Three facts pin it in the current tree:

| Fact | Where | Value |
|---|---|---|
| No parallel dispatch primitive | `grep -c 'Promise.all' src/scripts/ai_council/orchestrator.ts` | `0` |
| Dispatch order is byte-pinned by a test | `tests/scripts/ai_council/orchestrator.test.ts:125-136` (`dispatches members in input order, accumulates tokens`) | 83/83 green, file unmodified vs `origin/main` |
| The property the order buys is wired | `src/scripts/ai_council/orchestrator.ts:691-711` — `on_overrun` is consulted **before** each member's API call, per member | live |

## 2 — The condition the decision encoded

The docstring states its own scope condition rather than leaving it implicit:
**interactive mid-flow overrun prompts at 2-3 members.** The trade is only
favourable while both halves hold.

- *Interactive mid-flow prompt.* Sequential order is what makes
  `on_overrun` answerable: the callback fires before member N's call, with
  members 1..N-1 already priced from real responses, so the human is asked a
  question with a known running total. A parallel round destroys that property —
  the prompt would have to be asked before any member has answered, against an
  estimate, or after all of them have already been paid for.
- *2-3 members.* At that width, wall-clock cost of serialising is small enough
  that predictability wins.

## 3 — What has changed since

**Materially, nothing** — and this is the finding, not an absence of effort.

| Axis | State at the decision | State 2026-08-31 | Changed? |
|---|---|---|---|
| Typical council width | 2-3 members | `agents/templates/.ai-council.yml.example:39` — *"two members below ship `enabled: true`"*; five members are **defined**, three ship `enabled: false` (`:395`, `:407`, `:420`) | No |
| Interactive overrun prompt | the property being bought | still wired, `orchestrator.ts:691-711` | No |
| Recorded latency complaint | none | none found in the tree; no roadmap, blocker, or self-repair record cites council wall-clock as a defect | No |
| Dispatch-order test pinning | byte-pinned | byte-pinned and green, unmodified | No |

The one thing that *did* change is the reason this file exists: a topology
workstream (Phase 4) arrived wanting parallel fan-out. That is a
**topology experiment's convenience**, not new evidence about the condition the
decision encoded — and the revisit gate's mechanism-match step is explicit that
a resemblance is not a recurrence. The mechanism under test here is the same
one the original decision tested: dispatching members concurrently instead of
in order.

## 4 — Routing

Per [`decision-revisit-gate`](../../../src/rules/decision-revisit-gate.md)
§ *Who decides*, this transition is **council-decidable**, not owner-reserved:
it weakens no security, privacy, safety or data-handling floor, creates no
external or irreversible commitment, and is fully reversible inside the
authorised envelope (the dispatch loop is internal to `orchestrator.ts`).

It was routed accordingly. **AI council, 2026-08-28, 2/2.**

## 5 — Verdict

**Keep sequential dispatch. Phase 4 closes as a published null.**

A published null here is honest completion and is a legitimate outcome the
step's own `verify:` line names: the decision was surfaced, evaluated against
the current tree, and left standing with the reason recorded. Nothing is
"unbuilt" — the alternative was built once and deliberately removed.

Consequences, stated so a later reader does not have to infer them:

- Steps **4.2, 4.4, 4.5 and 4.6** are marked `[-]` cancelled in the roadmap.
  Each exists only if the phase reopens; with the verdict at *keep sequential*,
  their precondition never arises. This is not a drop of planned work — it is
  the recorded resolution of `blocker: parallel-fanout-reopens-a-closed-decision`
  (`Blocks: all of Phase 4`) being executed.
- Step **4.3** (*preserve the sequential default*) is satisfied as-is and is
  closed on the evidence in § 1: the byte-pinned tests are green and unmodified.

One seat named the only shape worth reconsidering if the decision is ever
reopened: **intra-round parallelism behind a ceiling flag**, preserving the
interactive-prompt property that motivated going sequential in the first place.
That shape is recorded here so a future reopen starts from it rather than from
a bare "make it parallel".

## 6 — Revisit-if

**Revisit-if:** a real, recorded latency complaint against a council run exists
(a user report or a measured wall-clock figure on a live run — not a topology
experiment's convenience), **or** the typical enabled-member count in the
shipped `agents/templates/.ai-council.yml.example` rises above 3. Either
condition falsifies a half of § 2; neither is met today. On a reopen, the
entry shape is the intra-round-parallelism-behind-a-ceiling-flag design named
in § 5, and the byte-pinned dispatch-order tests staying **unmodified** remains
the stop signal, not the thing to update.
