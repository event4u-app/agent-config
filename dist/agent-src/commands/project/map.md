---
model_tier: lite
name: project-map
pack: engineering-base
visibility: internal
sub: map
cluster: project
skills: [code-intelligence]
description: Draw the project map into agents/map/ — areas, files, links, offline
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# project-map

## Instructions

Build the map of the project the user is standing in, then point at it. The map is
deterministic and local: no model call, no network, nothing committed by default
(`agents/map/` is gitignored, ADR-297).

### 1. Build

```bash
agent-config code-graph map
```

It builds or updates the code graph first when it is absent or behind, then writes
`agents/map/index.html`, `agents/map/MAP.md`, one `agents/map/areas/<id>.md` per
area of five or more files, and `agents/map/map.json`. With Playwright present it
also renders the page at three widths and reports the render check; without it the
check reads `unverified`, which is not a pass.

`--root <path>` maps another checkout; `--open` opens the page; `--no-verify`
skips the render check.

### 2. Report

Quote the command's summary lines (files, areas, largest area, graph state, render
check) and give the path to `agents/map/index.html`. Do not paraphrase the counts.

### 3. Answer from the map, when the user asked a question

Read `agents/map/MAP.md` first, then the page of the area in question. Say which
answers came from the map and which from a follow-up `code-graph query` or a file
read — the map groups files by coupling, it does not explain what they do.

## Rules

- **Never edit `agents/map/` by hand.** Every file there is regenerated.
- **A `behind:N` or `edited` graph state is part of the answer.** Say it.
- **"Isolated" is not "dead".** A file reached by reflection, a string path or a
  framework convention the engine does not read is isolated too.
