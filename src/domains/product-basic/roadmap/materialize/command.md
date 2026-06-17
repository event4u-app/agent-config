---
model_tier: high
name: roadmap-materialize
pack: product-basic
tier: 2
visibility: internal
cluster: roadmap
sub: materialize
skills: [emit-tickets]
description: Materialise a roadmap into a self-contained, importable ticket bundle under agents/tickets/
suggestion:
  eligible: true
  trigger_description: "turn this roadmap into tickets, materialise the roadmap, mach Tickets aus der Roadmap"
  trigger_context: "an existing agents/roadmaps/*.md the user wants decomposed into build-ready tickets"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap materialize

## Instructions

A thin wrapper that delegates to the [`emit-tickets`](../../../skills/emit-tickets/SKILL.md)
skill. This command **orchestrates**; the skill owns the procedure.

### 1. Resolve the roadmap

Accept a roadmap path argument (`/roadmap:materialize agents/roadmaps/{roadmap}.md`)
or, with no argument, ask which roadmap to materialise. The roadmap must already
exist (authored via `/roadmap:create` + `roadmap-writing`); this command does
**not** author roadmaps.

### 2. Run the skill

Invoke [`emit-tickets`](../../../skills/emit-tickets/SKILL.md). It reads the
roadmap, writes one ticket per materialisable step into
`agents/tickets/{slug}/`, sets each ticket's `model_tier`, writes `manifest.yml`
(acyclic dependency graph + empty `linear_state`), writes
`<!-- ticket: T-NNN -->` markers back into the roadmap, and regenerates
`agents/tickets/_registry.yml`. Format contract:
[`ticket-bundle-format`](../../../../docs/contracts/ticket-bundle-format.md).

### 3. Gate on buildability

Run the build-readiness lint before handing back:

```bash
python3 src/scripts/lint_ticket_buildable.py
```

A `lite` ticket that fails the self-containedness floor is rejected or escalated
to `medium` — never shipped under-specified.

### 4. Hand back — HARD STOP

```
BUNDLE MATERIALISED → STOP. NEVER AUTO-CREATE TRACKER ISSUES OR EXECUTE.
MATERIALISE = ARTIFACT ONLY. PASTE/MCP/BUILD NEED A FRESH USER VERB.
```

Emit a single hand-back line citing the bundle path + the ticket count. The user
pastes a ticket into Linear/Jira (or creates it via MCP), or runs a per-ticket build
(`/implement-ticket <bundle>/T-NNN.md`) on a later turn, explicitly.

### Rules

- **Do NOT author the roadmap** — this consumes an existing one.
- **Do NOT auto-create tracker issues** — paste/MCP is a separate user-invoked step (ADR-102, no API export).
- **Do NOT commit or push.**
- Bundle is the source of truth; the tracker is a projection
  ([`ticket-bundle-format`](../../../../docs/contracts/ticket-bundle-format.md)).
