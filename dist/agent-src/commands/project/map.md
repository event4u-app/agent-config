---
model_tier: lite
name: project-map
pack: engineering-base
visibility: internal
sub: map
cluster: project
skills: [code-intelligence]
description: Draw the code map into agents/map/
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
deterministic: no model call, no network, and the same tree draws the same bytes.
Everything lives in one folder, `agents/map/` (ADR-297, ADR-303); only its <!-- ref-ignore -->
`.build/` part — the graph cache, its SQLite twin, the refresh lock — is gitignored.

### 1. Build

```bash
agent-config code-graph map
```

It builds or updates the code graph first when it is absent or behind, then writes
`agents/map/index.html`, `agents/map/MAP.md`, `agents/map/manifest.json` (generation, <!-- ref-ignore -->
sources and freshness per area), `agents/map/code/map.json` with one <!-- ref-ignore -->
`agents/map/code/areas/<id>.md` per area of five or more files, and a folder per <!-- ref-ignore -->
knowledge area that has a payload (`data/`, `interfaces/`, `runtime/`, `delivery/`).
The page opens on the Overview. With Playwright present it also renders the page at
three widths and reports the render check; without it the check reads `unverified`,
which is not a pass.

`agent-config code-graph map --estate` draws the hub instead: every registered project
of this machine, the links between them, shared ports, images and services, and which
call of one project lands on a route of another — written to the user-global `map/`,
refused inside any git work tree, never into a project map.

`--root <path>` maps another checkout; `--open` opens the page; `--no-verify`
skips the render check.

To look at a map that is already drawn without redrawing it:

```bash
agent-config code-graph open
```

It resolves the page where `map` writes it (`--root` and `--out` work the same) and
exits 1, opening nothing, when no map has been drawn yet.

### 2. Report

Quote the command's summary lines (files, areas, largest area, graph state, render
check) and give the path to `agents/map/index.html`. Do not paraphrase the counts. <!-- ref-ignore -->

### 3. Answer from the map, when the user asked a question

Read `agents/map/MAP.md` first, then the page of the area in question. Say which <!-- ref-ignore -->
answers came from the map and which from a follow-up `code-graph query` or a file
read — the map groups files by coupling, it does not explain what they do.

## Rules

- **Never edit `agents/map/` by hand.** Every file there is regenerated; a file the <!-- ref-ignore -->
  map does not write (`layers.yaml`, notes) stays untouched by a redraw.
- **A `behind:N` or `edited` graph state is part of the answer.** Say it.
- **"Isolated" is not "dead".** A file reached by reflection, a string path or a
  framework convention the engine does not read is isolated too.
