---
name: reasoning-orchestrator
description: "Use for complex / ambiguous / long-horizon work — coordinate the reasoning chain ground→intent→notes→gather→audit→verify; composes existing skills, never duplicates them."
source: package
domain: engineering
status: active
model_tier: medium
tier: senior
context_spine: [repo]
workspaces:
  - agent-config-maintainer
packs:
  - meta
requires_skills:
  - memory-consolidation
  - adversarial-review
  - subagent-orchestration
  - complexity-first-planning
---

# reasoning-orchestrator

The **primary coordination mechanism** of the Reasoning Discipline Protocol
(roadmap L6). It is behavioral glue — like [`subagent-orchestration`](../subagent-orchestration/SKILL.md)
and [`feature-planning`](../feature-planning/SKILL.md) — that sequences the
discipline so it acts as one system instead of a buffet of optional steps. It
**composes** the underlying skills/rules; it never re-implements them, and it
adds **no new flow** (it is invoked within discovery/implementation, honoring
`src/flows/README.md`).

Engage per [`rdp-gate`](../../contexts/execution/rdp-gate.md): skip on trivial
tasks; on a strong-reasoning host run **light / as suggestion** (it self-
coordinates); on a standard host run the full chain.

## When to use

- A complex, ambiguous, or long-horizon task on a standard host.
- Work where the reasoning steps are interdependent (a missed grounding or skipped
  verification compounds downstream).

Do NOT use for trivial / linear / fully-specified tasks (the gate filters these),
and do not let it duplicate the work of the skills it coordinates.

## The chain it enforces

Each link **delegates** to the artifact that owns it (no duplication):

1. **ground** — close constraints/tools/info-gaps before designing
   ([`think-before-action` § Environment grounding](../../rules/think-before-action.md)).
2. **intent** — state the inferred goal + one recommendation, standard host only
   ([`improve-before-implement` § Intent inference](../../rules/improve-before-implement.md)).
3. **notes** — hypotheses/predictions/decisions/uncertainty to the notes file, not
   the response ([`notes-first-reasoning`](../../rules/notes-first-reasoning.md)).
4. **gather** — resolve the load-bearing unknown first
   ([`complexity-first-planning`](../complexity-first-planning/SKILL.md)); dispatch
   independent subtasks async ([`subagent-orchestration` § RDP](../subagent-orchestration/SKILL.md)).
5. **audit** — check progress against real tool results
   ([`verify-before-complete`](../../rules/verify-before-complete.md)).
6. **verify** — fresh-context verifier on the structural-complexity gate
   ([`adversarial-review` § RDP](../adversarial-review/SKILL.md)).

## Fail-safe

If the orchestrator does not fire (gate off, or the host skips it), the
individual skills/rules still apply on their own triggers — the discipline
degrades gracefully to the distributed extensions rather than disappearing. The
orchestrator's value is **coherence** (the links happen in order, with handoffs),
not exclusivity.

## Output

The task's actual deliverable — produced through the chain. Reasoning stays in the
notes file; the response leads with the outcome + its evidence.

## Do NOT

- Re-implement grounding / verification / planning here — **delegate**.
- Create a new flow or a standalone pack — this is a skill invoked within existing flows.
- Run the full chain on a strong-reasoning host or a trivial task — the gate says light/off.

## See also

- [`rdp-gate`](../../contexts/execution/rdp-gate.md) — the table-free engagement gate (L17).
- [`frontier-reasoning-operating-profile`](../../../../docs/guidelines/agent-infra/frontier-reasoning-operating-profile.md) — the sourced rationale.
