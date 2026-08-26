---
adr: 247
status: accepted
date: 2026-08-26
decision: decision-revisit-doctrine
supersedes: —
superseded_by: —
phase: road-to-decision-conformance · Phase 1.4
type: governance
reopen_policy: owner
provenance:
  kind: mixed
  decision_makers: [agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - src/rules/decision-revisit-gate.md
    - docs/contracts/adr-layout.md
    - src/scripts/adr_cite_check.ts
    - agents/evidence/analysis/agent-memory-reference-classification-2026-08-26.md
review_trigger: >-
  Reopen when a measurement shows the doctrine is not doing its work: either the
  corpus survey reports a RISING uncited fraction over two consecutive readings
  (a decision nobody can find is a decision nobody obeys), or a recurrence audit
  finds a lock cited as a blocker without having been evaluated first — which is
  the one obligation here that no gate can observe. Explicitly NOT a trigger: the
  count of ADRs carrying `reopen_policy`. That number is low by design and
  raising it is not evidence of anything.
---

# ADR-247 — The revisit doctrine, written down where a decision can cite it

## Status

Accepted.

## Context

The obligation to evaluate a recorded decision **before citing it as a reason
not to act** exists, is stated in
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), and is
enforced by nothing. That rule says so itself, and the honesty is the point: no
gate can observe an agent citing a decision it never opened.

What was missing is a **decision record** for the doctrine, as opposed to a rule
that carries it. A rule is instruction to an agent; an ADR is a thing another
ADR can cite, a thing `adr_cite_check` can evaluate, and a thing whose own
reopening condition is machine-readable. The doctrine governed the estate
without being in the estate.

This record does not restate the rule. It records the **decision** that the
doctrine holds, so that the doctrine is itself subject to the discipline it
describes.

## Decision

**A recorded decision is evaluated before it is cited as a blocker.** The
mechanics — mechanism-match first, read status and amendments and successors,
surface the conflict, route it, record the outcome with a `revisit-if` — live in
`decision-revisit-gate` and are not duplicated here. `adr_cite_check` is the
tool; `adr_cite_check --all` is the corpus view of the same question.

**Three consequences are recorded here because they are decisions rather than
mechanics:**

1. **A grade is a measurement, never a permission.** No evidence grade lets an
   agent supersede a record, skip a council, or take an action it could not take
   the day before. The council-first venue holds at every grade.
2. **`unclassified` is the honest default for `reopen_policy`, and stays
   optional.** Requiring it estate-wide would rename "blocked on the owner" to
   "drafts pending owner approval" and change nothing. Classification happens
   when a record is on the desk — reopened, cited as a blocker, or under an
   owner-mandated census. See `adr-layout.md` § Reopen authority, where the
   2026-08-26 decision and its dissent are recorded.
3. **`challenged` is a live lock.** An ADR at `challenged` is accepted and under
   active question. It names no successor and suspends nothing. If citing it
   cleared the lock, the status would become a way to stop obeying a decision
   without reopening it — which is the failure this record exists to name.

## Consequences

- `adr_cite_check` reports `challenged` distinctly from `accepted` and from
  `superseded`, and its verdict for `challenged` says the decision **still
  binds**.
- The corpus survey (`--all`) publishes the trigger-state split and the
  citation reach, so "how much of the estate is findable" is a number rather
  than an impression.
- **This record is `instruction-only` on its central obligation**, and says so:
  the "evaluate before citing" step happens inside a model and leaves no
  artefact. The tools make evaluation cheap and the survey makes coverage
  visible; neither makes evaluation observable.

## Alternatives

**Leave the doctrine as a rule only.** Rejected: a rule is not citable by an
ADR, is not evaluated by `adr_cite_check`, and carries no `review_trigger` of
its own. The doctrine was governing the estate from outside it.

**Make evaluation enforceable.** Refused as unbuildable rather than declined: a
gate would have to observe a reasoning step. Claiming enforcement here would
inflate coverage, which is the defect this record's own § Consequences names.

**Require `reopen_policy` on every ADR, so the doctrine has data.** Rejected —
see Decision 2 above, and the recorded dissent in `adr-layout.md`.

## Evidence

| Claim | Basis |
|---|---|
| The obligation exists as a rule and is enforced by nothing — the rule says so itself | `src/rules/decision-revisit-gate.md:27` (`instruction-only: no gate can observe an agent citing a decision it never opened`) and its `## Honest enforcement` section at `:181` |
| `adr_cite_check` treats `challenged` as a LIVE lock rather than a cleared one | `src/scripts/adr_cite_check.ts:506-508` — the `challenged` branch is separate from `accepted` and from `superseded`, and its comment records "accepted, and under active question" |
| The corpus view exists and is a real mode, not a plan | `src/scripts/adr_cite_check.ts:950` (`const survey_mode = argv.includes('--all')`), documented in the usage block at `:965-969` |
| The `reopen_policy`-stays-optional decision and its dissent are recorded, not asserted here | `docs/contracts/adr-layout.md:248` (§ Reopen authority), `:331` (the 2026-08-26 decision), `:353-360` (the dissent and its preserved implementation path) |
| Estate coverage is a number rather than an impression | `adr_cite_check --all`, run this session: 137 of 161 accepted ADRs cited outside `docs/decisions/` (14.9 % uncited); 74 records carry a `review_trigger`, all 74 indeterminate; 7 of 203 declare a `reopen_policy` |
| The memory-layer reference classification behind Decision 2 is a committed artifact | `agents/evidence/analysis/agent-memory-reference-classification-2026-08-26.md` |

The grade is **E2 — repeated and comparative**. Every row above is read off a
file in this tree at a named line, and the one quantitative row is a live run of
the tool this record governs. It is not E3: there is no external authority and
no pre-registered benchmark behind the doctrine itself.

**What the evidence does NOT establish.** It does not show that the doctrine
changes agent behaviour. The central obligation — evaluate before citing — leaves
no artifact, so the 14.9 % uncited figure measures *findability*, never
*obedience*, and no reading of it should be taken as the latter. That is the
same limit § Consequences states, restated here so the grade is not read as more
than it is.

## References

- [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — the mechanics.
- [`recurring-criticism`](../../src/rules/recurring-criticism.md) — the other entrance.
- `docs/contracts/adr-layout.md` § Reopen authority — the `reopen_policy` decision and its dissent.
- `src/scripts/adr_cite_check.ts` — `--all` for the corpus view.
