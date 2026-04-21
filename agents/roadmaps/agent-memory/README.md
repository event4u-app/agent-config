# Roadmaps for the `agent-memory` package

> **Scope.** The files in this subdirectory are **specs and
> requirements from the `agent-config` perspective** — what
> `agent-config` needs `agent-memory` to do so the integration works
> end-to-end.
>
> **Implementation of these specs lives in the
> [`event4u-app/agent-memory`](https://github.com/event4u-app/agent-memory)
> repository**, not here. When a spec is accepted, the concrete
> implementation roadmap and code belong in that repo.

## Why these files exist here

Three reasons:

1. **Clarity of ownership.** `agent-config` = behaviour, policy,
   governance. `agent-memory` = persistence, retrieval, trust scoring,
   decay. Specs written here describe the **contract** between the two
   so neither side drifts.
2. **Review continuity.** Discussions about "what should memory do"
   happen in agent-config sessions (this repo is the main agent target).
   Capturing the outcome here keeps the decision trail visible.
3. **Portability of the spec.** Each spec can be lifted into the
   `agent-memory` repo as an issue or implementation roadmap without
   rewriting.

## What **does not** belong here

- Storage engine internals (pgvector schema, migration files, index
  tuning) — belong to `agent-memory`
- 4-tier consolidation algorithm details — belong to `agent-memory`
- MCP server wire protocol — belongs to `agent-memory`
- Ebbinghaus decay curve implementation — belongs to `agent-memory`
  (this repo specifies *defaults per memory type*, not the math)
- TypeScript/Node toolchain, package structure — belongs to `agent-memory`

## What **does** belong here

- The **contract**: what API surface `agent-config` consumes (retrieve,
  propose, promote, health, …)
- **Defaults and policy** that `agent-config` declares and
  `agent-memory` consumes — decay rates per memory type, access policy
  per role mode, promotion triggers, trust thresholds
- **Integration specs** — how consumer projects install and wire the
  two packages together
- **Known gaps in `agent-memory`** that block `agent-config` features
  (e.g. the AGENTS.md stack mismatch spotted in review)

## Index

| Spec | Purpose |
|---|---|
| [`road-to-promotion-flow.md`](road-to-promotion-flow.md) | When and how observations become quarantined → episodic → semantic entries; intra-project vs. cross-project promotion |
| [`road-to-decay-calibration.md`](road-to-decay-calibration.md) | Default decay rates per memory type; mapping of the 6 content types onto the 4 cognitive tiers; override surface for teams |
| [`road-to-cross-project-learning.md`](road-to-cross-project-learning.md) | Stage-3 loop — how `agent-memory` aggregates recurring signals across consumers and feeds proposals back into `agent-config` |
| [`road-to-consumer-integration-guide.md`](road-to-consumer-integration-guide.md) | How a consumer project installs both packages, wires MCP/CLI access, and meets the prerequisites (PostgreSQL + pgvector) |
| [`road-to-agents-md-fix.md`](road-to-agents-md-fix.md) | Fix the stale Laravel-flavoured `AGENTS.md` in the `agent-memory` repo — a small but visible quality issue spotted in review |

## Consumption path

```
agent-config session identifies a memory need
           │
           ▼
   spec lives here (agent-config perspective)
           │
           ▼
   accepted → copied/linked as issue or roadmap in agent-memory repo
           │
           ▼
   implementation lands in agent-memory
           │
           ▼
   agent-config integration roadmap consumes the new capability
```

The matching integration-side roadmap in `agent-config` is
[`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md).
That one defines the **commands, rules, and skills** this package
adds to talk to `agent-memory`.

## Relationship with existing roadmaps

- [`../road-to-project-memory.md`](../road-to-project-memory.md) —
  layered settings and repo-shared curated files. Policy-only; the
  storage/lifecycle pieces have moved into the specs below.
- [`../road-to-engineering-memory.md`](../road-to-engineering-memory.md) —
  the six content types (ownership, historical-patterns,
  domain-invariants, ADRs, incident-learnings, product-rules). Content
  definition lives there; mapping to cognitive tiers lives here
  (`road-to-decay-calibration.md`).
- [`../road-to-role-modes.md`](../road-to-role-modes.md) — role-mode
  retrieval defaults are declared there, consumed through the
  integration roadmap.
- [`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md) —
  the 5-stage pipeline that cross-project learning (stage 3 of GPT's
  review) plugs into as an additional source.
- [`../road-to-memory-merge-safety.md`](../road-to-memory-merge-safety.md) —
  no-conflict contract for every write path. Promotion drop-ins follow
  the content-addressed layout defined there.

## License

Same as the rest of the package — MIT.
