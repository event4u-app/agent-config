# Subagent Topologies — per-mode communication shape

Descriptive, not enforced. Documents the **expected agent-to-agent
communication topology** for each [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md)
mode so consumers can predict latency, failure modes, and where consensus
is required. Cited from
an internal findings note (local-only) <!-- council-ref-allowed: ADR decision trace for topology anti-drift defaults -->
row 7 (the external runtime's `hierarchical, 6–8 agents, raft consensus` anti-drift
default).

| Mode | Topology | Anti-drift default | Notes |
|---|---|---|---|
| do-and-judge | `hierarchical` | 1 implementer · 1 judge · session-orchestrated | Two-node hub-and-spoke; orchestrator owns the loop. |
| do-and-judge-two-stage | `hierarchical` | 1 implementer · 2 sequential judges | Stages are serialized; spec-judge gates quality-judge. |
| do-in-steps | `ring` | N steps · 1 judge between each | Step N output → judge → step N+1 input; cycle on revise. |
| do-in-parallel | `star` | 6–8 implementers · 1 judge · session-hub | Capped by `subagents.max_parallel`; judge runs once on union. |
| do-competitively | `mesh` | 2–4 implementers · 1 judge | Implementers do not see each other; judge sees all candidates. |
| judge-with-debate | `hierarchical-mesh` | 2 judges · 1 meta-judge | Judges debate (mesh edge); meta-judge reconciles (hierarchical). |
| do-in-worktrees | `adaptive` | per-step topology of the underlying mode | Each worktree picks its own shape; chain is hierarchical. |

**Anti-drift default** (the external runtime convention, descriptive only):
`hierarchical, 6–8 agents, raft consensus`. Consumers free to
override per orchestration — the table is the **starting point**,
not a constraint. Topology is metadata for capacity planning, not
runtime-enforced.

**Glossary:**

- `hierarchical` — orchestrator hub; agents reply to hub only.
- `mesh` — agents see each other's outputs (e.g. competing diffs).
- `hierarchical-mesh` — peer debate followed by hub reconciliation.
- `ring` — output of step N feeds input of step N+1 in order.
- `star` — N agents fan out from a single hub; no peer comms.
- `adaptive` — topology shifts per step; outer chain remains hub.
