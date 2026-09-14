---
model_tier: high
name: roadmap-materialize
produces_roadmap: true
pack: product-basic
visibility: internal
cluster: roadmap
sub: materialize
skills: [emit-tickets]
description: Materialise a roadmap into a self-contained, importable ticket bundle under agents/tickets/
argument-hint: "[roadmap-path]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
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
./scripts-run src/scripts/lint_ticket_buildable
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

## Closure — the last step, always

```
THIS COMMAND PRODUCES A ROADMAP, SO IT ENDS IN CLOSURE.
NEVER HAND BACK A PLAN CARRYING A DECISION PLANNING COULD HAVE CLOSED.
```

Declared by `produces_roadmap: true` in the frontmatter and enforced by
`lint_roadmap_producers`: a producer that does not end here reds CI.

Read `planning.closure_pass` (missing = `true`). When active, run
[`/challenge-me closure`](../../../meta/challenge-me/closure/command.md) on the
roadmap this command just produced, before handing back:

```bash
./scripts-run src/scripts/closure_scan <roadmap-path>
```

Every detected decision is resolved at the lowest rung that owns it and written
into the roadmap's `## Decisions` table. Owner-owned residue is asked **now**,
one question per turn, and its answer recorded — never handed back as *"the
open questions are in the file"*.

An explicit *just write it* drops the pass and is recorded as a **bypass** on
its own axis, never as an absent closure. A mission grant is not a bypass.
