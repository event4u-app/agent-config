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

## References

- [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — the mechanics.
- [`recurring-criticism`](../../src/rules/recurring-criticism.md) — the other entrance.
- `docs/contracts/adr-layout.md` § Reopen authority — the `reopen_policy` decision and its dissent.
- `src/scripts/adr_cite_check.ts` — `--all` for the corpus view.
