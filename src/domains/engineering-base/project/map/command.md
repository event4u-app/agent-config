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

### What the map reads

The build merges one reader per lane, each from files only — never a database,
a Docker daemon, a cluster, a cloud or an endpoint, never a `.env` value or
Terraform state (`--no-lanes` on `code-graph build` skips them):

| Lane | Reads | Drift (advice) |
|---|---|---|
| data | migrations, SQL schema files, committed dumps | `DR-1`…`DR-13` |
| interfaces | outbound calls, SDK dependencies, config names, contracts (OpenAPI, WSDL, GraphQL SDL, proto, `.http`) | `IF-1`…`IF-8` |
| runtime | compose, Dockerfiles, devcontainer, Make / Task targets, Terraform, Kubernetes | `RT-1`…`RT-6` |
| delivery | GitHub Actions, GitLab CI | `DL-1`…`DL-5` |
| history | co-change pairs from one bounded `git log` pass | — |
| decisions | ADRs: `supersedes`, and `governs` for a file a record names by path | — |
| flows | what an entry point reaches over stated edges (a lower bound) | — |

An area with no facts renders "no data yet" with the reason, never hidden.
Observed state enters only as a file **the user** produced and saved:

- `agents/map/data/snapshot/<connection>.sql` — `pg_dump --schema-only` / <!-- ref-ignore -->
  `mysqldump --no-data` (`default.sql` for the default connection);
- `agents/map/data/oracle/*.json` — `php artisan model:show <Model> --json`; <!-- ref-ignore -->
- `agents/map/data/declarations.json` — `fk_mode` per connection and <!-- ref-ignore -->
  `virtual_relations` waivers with a reason;
- `compose.resolved.yaml` (or `compose-config.yaml`) — `docker compose config`.

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
read — the map groups files by coupling, it does not explain what they do. Before
acting on a fact, confirm it (`code-graph confirm <id>`); after the change, update
it (`code-graph refresh --touched`) — see `code-intelligence`.

## Rules

- **Never edit `agents/map/` by hand.** Every file there is regenerated; a file the <!-- ref-ignore -->
  map does not write (`layers.yaml`, notes, the `data/` inputs above) stays
  untouched by a redraw.
- **Never fetch observed state yourself.** No connection to fill a snapshot —
  ask the user for the file.
- **A `behind:N` or `edited` graph state is part of the answer.** Say it.
- **"Isolated" is not "dead".** A file reached by reflection, a string path or a
  framework convention the engine does not read is isolated too.
