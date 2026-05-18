---
complexity: lightweight
status: draft
---

# Implementation Sequence — TS-Foundation · Discovery · GUI · Explain · Visibility

> Five roadmaps land in this branch; their merge order is not free.
> This document fixes the **sequence**, the **parallel slots**, and
> the **blocking edges** between them so the implementing agent (or
> a council of agents) does not pick the cheapest-looking roadmap
> first and dead-end on a missing dependency.

## Prerequisites

- [ ] Read [`typescript-cli-and-local-gui-foundation.md`](typescript-cli-and-local-gui-foundation.md) (Roadmap 1)
- [ ] Read [`unified-setup-and-settings-gui.md`](unified-setup-and-settings-gui.md) (Roadmap 2)
- [ ] Read [`automated-pack-workspace-and-skill-discovery.md`](automated-pack-workspace-and-skill-discovery.md) (Roadmap 3)
- [ ] Read [`explainability-v2-explain-last.md`](explainability-v2-explain-last.md) (Roadmap 4)
- [ ] Read [`strategic-visibility-mcp-topics-positioning.md`](strategic-visibility-mcp-topics-positioning.md) (Roadmap 5)

## Context

The five roadmaps are not independent. Three of them produce
**contracts** that other roadmaps consume:

- Roadmap 1 freezes `dist/cli/agent-config.js` and
  `docs/contracts/local-server-api.md` — consumed by Roadmap 2
  (GUI talks to the local server) and consumed by Roadmap 4
  (`explain last` is a TS-CLI subcommand once Phase 5 of Roadmap 1
  flips the shebang).
- Roadmap 3 emits `dist/discovery/discovery-manifest.json` —
  consumed by Roadmap 2 (settings GUI populates workspace toggles
  from the manifest) and consumed by Roadmap 5's MCP-manifest
  builder (`tools_count` and pack listing come from the
  manifest).
- Roadmap 4's execution-trace consumes
  `agents/council-sessions/`, `.work-state.json`, and (if
  available) the discovery manifest. None of those are produced
  by another roadmap in this set; they pre-date this branch.

Roadmap 5 has no upstream consumers in this set, only downstream:
it asserts the README / `package.json` / Topics agreement that the
TS-CLI's `package.json` edits in Roadmap 1 will perturb.

The sequence below resolves these edges into a merge order with two
parallel slots, so the branch can ship in five PRs instead of one
mega-PR.

### Why a separate sequence doc and not a section in each roadmap

Three reasons:

1. The sequence is **cross-roadmap state**. Encoding it in each
   roadmap means five copies that drift.
2. The sequence changes if a roadmap is split, deferred, or
   superseded; a single document is cheaper to revise than five
   intersecting prose sections.
3. The roadmap-complexity linter (`scripts/lint_roadmap_complexity.py`)
   treats each roadmap as a unit. The sequence is meta, lightweight,
   and gets its own complexity budget.

## What this document is NOT

- **Not** a project plan with dates. No estimates, no calendar.
- **Not** an assignment of work to specific contributors.
- **Not** a substitute for the per-roadmap Council pass — each
  roadmap still owns its own gate.
- **Not** a binding contract on the order in which Council
  verdicts must be filed. Council can run in any order; only the
  **merge** order is fixed.

## Acceptance criteria

- [ ] The dependency graph below is consistent with the
      contracts each roadmap names in its Prerequisites and
      Acceptance Criteria sections
- [ ] Every blocking edge cites the roadmap section that
      produces the artefact and the roadmap section that
      consumes it
- [ ] The parallel slots do not share a `package.json` /
      `Taskfile.yml` / `.github/workflows/*` write surface in
      the same merge window
- [ ] `python3 scripts/lint_roadmap_complexity.py` exits 0
- [ ] `python3 scripts/lint_roadmap_ci_steps.py` exits 0

## Non-goals

- **Picking a calendar week for each roadmap.** Out of scope.
- **Estimating effort in person-days.** Out of scope.
- **Re-ordering the five roadmaps for a different optimization
  target** (e.g. ship visibility first to drive adoption while
  the TS-CLI is still in flight). The optimization here is **merge
  safety**, not adoption velocity. A future sequence doc can swap
  the optimization target and supersede this one.

## Dependency graph

```
                ┌──────────────────────────────────────────┐
                │  Roadmap 1: TypeScript CLI + Local       │
                │  Fastify Server (FOUNDATION)             │
                │  ── produces ──                          │
                │   • dist/cli/agent-config.js             │
                │   • docs/contracts/local-server-api.md   │
                │   • .npmrc engine-strict, npm audit gate │
                │   • shadow-mode flip path (5a → 5b)      │
                └─────────────┬────────────────────────────┘
                              │
                              │  HARD BLOCK: 2, 4 cannot merge
                              │  until Roadmap 1 Phase 5a ships
                              ▼
   ┌───────────────────────────┐    ┌───────────────────────────┐
   │  Roadmap 3: Automated     │    │  Roadmap 5: Strategic     │
   │  Discovery (workspaces +  │    │  Visibility — Topics-as-  │
   │  virtual packs)           │    │  Code, MCP listing,       │
   │  ── produces ──           │    │  positioning lint         │
   │   • dist/discovery/...    │    │  ── consumes ──           │
   │     discovery-manifest    │    │   • README tagline        │
   │     .json (+ sha256)      │    │   • package.json desc     │
   │   • frontmatter contract  │    │   • discovery manifest's  │
   │     for workspaces/packs  │    │     tools_count (if R3)   │
   └─────────────┬─────────────┘    └─────────────┬─────────────┘
                 │                                │
                 │ feeds GUI workspace toggles    │ may consume R3
                 │ feeds R4 trace.pack attrib.    │ degrades if R3
                 ▼                                ▼ not yet merged
   ┌───────────────────────────┐    ┌───────────────────────────┐
   │  Roadmap 2: Unified Setup │    │  Roadmap 4: Explainability│
   │  + Settings GUI           │    │  v2 — explain last        │
   │  ── consumes ──           │    │  ── consumes ──           │
   │   • local-server-api.md   │    │   • .work-state.json      │
   │     (R1)                  │    │   • council-sessions      │
   │   • discovery-manifest    │    │   • discovery-manifest    │
   │     (R3) for toggles      │    │     (R3, optional)        │
   │   • .agent-user.md parser │    │   • TS-CLI subcommand     │
   │     contract              │    │     surface (R1, optional │
   │                           │    │     — Python fallback ok) │
   └───────────────────────────┘    └───────────────────────────┘
```

## Sequenced phases

The five roadmaps land in **four merge windows**. Within each
window, roadmaps may proceed in parallel as long as the listed
isolation constraints hold.

### Window 1 — Foundation (Roadmap 1, alone)

- [ ] **Merge Roadmap 1, Phases 1-4** (TS-CLI scaffolding, Fastify
      server, IPC contract, GUI shell). Phase 5 (shebang flip) is
      explicitly NOT in this window.
- [ ] Exit gate for Window 1:
  - [ ] `docs/contracts/local-server-api.md` exists and is
        JSON-Schema'd (the contract Roadmap 2 consumes)
  - [ ] `dist/cli/agent-config.js` exists and runs `--help`
        without invoking Python
  - [ ] The Bash entry point is unchanged (still the default)
  - [ ] `npm audit --audit-level=high` exits 0 in CI
- [ ] **Isolation**: this window writes `package.json`,
      `tsconfig.json`, `vite.config.ts`, `src/cli/`, `src/server/`,
      `docs/contracts/local-server-api.md`. No other roadmap in
      Window 1.

### Window 2 — Parallel Slot A: Discovery (Roadmap 3) + Visibility (Roadmap 5)

Both Window-2 roadmaps depend on Window 1 being merged but are
**isolated from each other** at the file-write level. They may
land in either order or interleaved.

- [ ] **Roadmap 3** writes: `scripts/build_discovery_manifest.py`,
      `docs/contracts/discovery-manifest.schema.json`,
      `dist/discovery/`, `.augment/rules/discovery-frontmatter.md`,
      `scripts/lint_discovery_frontmatter.py`. Does NOT touch
      `package.json` `description` or `.github/`.
- [ ] **Roadmap 5** writes: `.github/topics.yml`,
      `.github/about.yml`, `.github/workflows/sync-visibility.yml`,
      `scripts/sync_github_topics.py`,
      `scripts/lint_positioning.py`, `dist/mcp/`,
      `docs/contracts/mcp-registry-manifest.schema.json`,
      `docs/distribution/mcp-submission-checklist.md`. Touches
      `package.json` `description` ONCE (the canonical correction)
      and `package.json` `files` array (`+ dist/mcp/`,
      `+ dist/discovery/`).
- [ ] **Isolation constraint**: if both PRs need to bump
      `package.json` `files`, the second PR rebases on the first.
      A merge conflict here is trivial; a silent overwrite is not,
      so the second PR's reviewer asserts both `dist/` entries are
      present.
- [ ] Exit gate for Window 2:
  - [ ] `task lint-discovery-frontmatter` exits 0
  - [ ] `task visibility-check` exits 0
  - [ ] `npm pack --dry-run --json | jq '.[0].files[] | .path'`
        contains both `dist/discovery/` and `dist/mcp/` lines

### Window 3 — Parallel Slot B: GUI (Roadmap 2) + Explainability (Roadmap 4)

Both consume Window-1 and Window-2 outputs.

- [ ] **Roadmap 2** writes: `src/gui/`, `src/server/api/v1/settings.ts`,
      `docs/contracts/settings-gui-agent-mode.schema.json`,
      `docs/architecture/setup-vs-settings-shared-surface.md`,
      `scripts/lint_settings_gui.py`. May extend the IPC
      contract file with new routes (additive only — never
      modify existing routes from Window 1).
- [ ] **Roadmap 4** writes: `scripts/_cli/cmd_explain_last.py`,
      `docs/contracts/explain-trace-v1.md`, `tests/cli/explain_last/`,
      `scripts/lint_explain_trace.py`. If Roadmap 1 Phase 5 has
      not yet flipped (see Window 4), the subcommand registers in
      the Python CLI (`scripts/_cli/`); after the flip it surfaces
      via `dist/cli/agent-config.js`.
- [ ] **Isolation constraint**: Roadmap 2 owns
      `docs/contracts/local-server-api.md` extensions; Roadmap 4
      owns `docs/contracts/explain-trace-v1.md`. No shared write
      surface other than the changelog footer in `README.md`.
- [ ] Exit gate for Window 3:
  - [ ] `task lint-settings-gui` exits 0
  - [ ] `task lint-explain-trace` exits 0
  - [ ] `agent-config explain last` (Python or TS, whichever is
        live) produces a valid trace against a sample
        `.work-state.json` fixture

### Window 4 — The Flip (Roadmap 1, Phase 5)

Window 4 is **only Roadmap 1 Phase 5** (shadow-mode flip → default
flip). Held until all of Windows 1-3 are green, because:

- The flip changes the runtime contract for every consumer in one
  PR. The risk floor is Window-1's shadow log being green for one
  release cycle (per the Council's `backend-architect` lens).
- Roadmap 2 (GUI) and Roadmap 4 (explain) both inherit the new
  runtime once flipped; landing the flip first would couple their
  exit gates to a non-shipped runtime.

- [ ] **Roadmap 1 Phases 5a-5b** ship. After 5b, `npm i -g
      @event4u/agent-config && agent-config --help` runs the TS
      build by default, the Bash file becomes a deprecation shim.
- [ ] Exit gate for Window 4:
  - [ ] The shadow log from the prior release shows 0 hard
        discrepancies between Bash and TS for the subcommand
        surface
  - [ ] `dist/cli/agent-config.js` is the documented entry in
        `docs/architecture.md` and `docs/installation.md`

## Re-sequencing rules

If a roadmap is split, deferred, or superseded, the sequence
updates as follows:

- [ ] **Roadmap 1 Phase 5 deferred** → Roadmaps 2 and 4 still
      land in Window 3 against the Python CLI. The TS flip becomes
      its own Window 5. No other roadmap blocks.
- [ ] **Roadmap 3 deferred** → Roadmap 2's workspace toggles
      degrade to a hard-coded list (the existing template default).
      Roadmap 5's MCP manifest builder degrades to `tools_count:
      null` (already in its open questions). Both Window-2 and
      Window-3 roadmaps continue. Roadmap 4's `trace.pack` field
      reads `null` until Roadmap 3 lands.
- [ ] **Roadmap 5 deferred** → No downstream impact. Re-merge in
      any later window.
- [ ] **A NEW roadmap added** to this branch → revise this file
      first; PR title must include `(seq)` so the reviewer
      examines the dependency graph above before the new
      roadmap's exit gate is voted on.

## Open questions

- [ ] Does the Window-2 → Window-3 boundary require **all** of
      Window 2 to be merged before **any** of Window 3 starts?
      Current draft says yes (a partial Window 2 leaves the
      `dist/` claim in `package.json` `files` half-true). The
      alternative is parallel Window-2/3 with a stricter
      `package.json` review per PR; deferred decision.
- [ ] Should the shadow-mode log path (`~/.event4u/agent-config/
      shadow.log`) be retained, rotated, or purged after Window 4
      closes? Suggested default: rotate weekly, purge after 30
      days. Settled in Roadmap 1's Council resolution gate.

## Sequence ownership

This document is owned jointly by the maintainers of all five
roadmaps. A change here that affects more than one window
requires the council pass to be re-run on every affected roadmap,
not just on this file.
