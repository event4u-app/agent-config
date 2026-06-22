---
name: reasoning-orchestrator
description: "Use for multi-step / ambiguous / end-to-end work — refactor a whole module, drive a vague ticket to a verified result, plan+build+verify a migration; coordinates the reasoning chain across skills."
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

Scope (eval-calibrated, L6): engage only for **interdependent multi-step** work
— multiple steps whose ordering and handoffs matter (schema → API → job → UI; a
staged migration; a cross-cutting refactor). **Not** for single-turn analysis
(explain / name / yes-no / pick-X-or-Y / one-shot edit): there the ordered chain
is a no-op and only adds tokens.

- An interdependent **multi-step** task on a standard host. Analyze the
  dependency structure (what blocks what) before acting.
- Work where a missed or out-of-order link (grounding, verification) compounds
  downstream.

Do NOT use for trivial / linear / fully-specified tasks **or single-turn
analysis** (the gate filters these), and do not let it duplicate the work of the
skills it coordinates.

> **Why scoped (L6, 2026-06-22).** A controlled distributed-vs-orchestrated eval
> (N=16, independent rater) found the ordered chain gains **+19.2%** on
> multi-step work but **−1.1%** (a no-op) on single-turn reasoning. The standard
> host classifies multi-step vs single-turn at gate time with 16/16 accuracy, and
> a misclassification degrades gracefully (wrong arm is still functional). The
> revert trigger is a re-run of `tests/reasoning-layer-eval` (the eval is the
> telemetry — this is a no-runtime package); RDP flip conditions are judged
> per-mechanism, never on a univariate aggregate. Evidence:
> `tests/reasoning-layer-eval/RESULTS-L6-largeN-2026-06-22.md`.

## When the agent should load this

- A task is complex / ambiguous / long-horizon and the host is a standard model.
- The reasoning steps are interdependent and a skipped link (grounding,
  verification) would compound downstream.
- Several discipline skills would otherwise fire piecemeal — load this to make
  them act as one ordered chain instead of a buffet of optional steps.

## Procedure — the chain it enforces

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

The task's actual deliverable, produced **through the chain** (analysis before
action — grounding and the load-bearing-unknown resolution precede any edit):

1. **Outcome first** — the response leads with the result and its evidence.
2. **Reasoning stays in notes** — hypotheses / predictions / decisions live in
   the notes file, never dumped into the response.
3. **Chain honoured in order** — ground → intent → notes → resolve-hardest-first
   → audit → verify ran as ordered links (with handoffs), not a buffet.
4. **Verified before "done"** — no completion claim without the verifier link's
   evidence.

## Do NOT

- Re-implement grounding / verification / planning here — **delegate**.
- Create a new flow or a standalone pack — this is a skill invoked within existing flows.
- Run the full chain on a strong-reasoning host or a trivial task — the gate says light/off.

## Gotchas

- **Buffet collapse.** Without the orchestrator, the discipline skills fire
  independently and the chain's *order* is lost (verification before grounding,
  notes never written). The whole value is the ordered handoff — running the
  links out of sequence is the failure this skill prevents.
- **Duplication creep.** Inlining a delegated step's logic here (re-doing the
  grounding instead of pointing at `think-before-action`) silently forks the
  behavior; the two copies then drift. Always delegate, never re-implement.
- **Wrong host, full chain.** Running every link on a strong-reasoning host wastes
  tokens and reads as nagging — the gate says light/suggestion there. Forcing the
  full chain regardless of host is a cost regression, not rigor.

## Related Skills

**WHEN to use this**

- A complex / ambiguous / long-horizon task on a standard host where the reasoning
  links are interdependent.
- Several discipline skills would otherwise fire piecemeal and need ordering.

**WHEN NOT to use this**

- Trivial / linear / fully-specified tasks — the
  [`rdp-gate`](../../contexts/execution/rdp-gate.md) filters these.
- A single discipline step in isolation — invoke that skill/rule directly
  ([`think-before-action`](../../rules/think-before-action.md),
  [`verify-before-complete`](../../rules/verify-before-complete.md)) instead of the
  whole chain.
- Needing the rationale behind the protocol — read
  [`frontier-reasoning-operating-profile`](../../../../docs/guidelines/agent-infra/frontier-reasoning-operating-profile.md).
