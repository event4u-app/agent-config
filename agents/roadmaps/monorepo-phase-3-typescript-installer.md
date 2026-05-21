---
complexity: structural
status: ready
---

# Monorepo Phase 3 — TypeScript Installer (CLI + Lockfile + Agent Mode)

> Third of six monorepo roadmaps. With Phase 1 (frontmatter) and
> Phase 2 (discovery manifest) shipped, this phase replaces the
> shell-based `install.sh` with a TypeScript Core Installer that
> drives the user through workspace + pack selection, writes a
> lockfile, and supports a structured **agent mode** so any LLM can
> invoke it deterministically.

## Goal

`npx @event4u/agent-config init` (and the post-install entry of the
PHP/Composer package) renders an interactive TUI for human users, a
non-interactive flag-driven mode for CI, and a structured JSON
question/answer protocol for agents. Selected workspaces and packs
are materialized into the consumer project; every managed file is
tracked in `agents/agent-config.lock.yml`. <!-- ref-ignore -->
`sync`, `validate`, and `prune` keep the install honest.

## Prerequisites

- [x] Phase 1 + Phase 2 shipped and green
- [x] `dist/discovery/discovery-manifest.json` published in the
      release artefact
- [x] Read [`docs/contracts/local-server-api.md`](../../docs/contracts/local-server-api.md)
      for the structural model behind the agent-mode protocol
- [x] Read [`skipped/multi-package-architecture.md`](skipped/multi-package-architecture.md)
      sections "Package Design" and "Installer flow"

## Acceptance criteria

- [x] `packages/core/installer/` (TypeScript, ESM, Node ≥ 20) ships
      `init`, `sync`, `validate`, `prune`, `info` commands
- [x] All commands work in three modes:
      `--interactive` (default, TTY), `--non-interactive` (flags only,
      CI), `--agent` (stdin/stdout JSON protocol)
- [x] Every materialized file lands in the consumer's
      `.augment/` and `.agent-src/`, and its path + sha256 + source
      pack are recorded in `agents/agent-config.lock.yml`
- [x] Re-running `init` after a release upgrades managed files,
      preserves user overrides (`install.managed: false`), and
      surfaces a diff before writing
- [x] `agent-config validate` is green on a fresh install
- [x] `agent-config prune` removes orphaned files (artefacts deleted
      upstream or de-selected workspaces)
- [x] Existing shell `install.sh` still works during the migration
      window but logs a deprecation notice pointing to `npx`

## Non-goals

- **Not** a web GUI (Phase 6)
- **Not** moving the agent-config source tree into `packages/`
      (Phase 4 — the installer reads its content from wherever the
      release ships the discovery manifest + source bundle)
- **Not** publishing to a marketplace; only npm + the bundled
      Composer post-install hook

## Command surface

```bash
# Human, interactive
npx @event4u/agent-config init

# CI, fully scripted
npx @event4u/agent-config init \
  --workspaces=engineering,governance \
  --packs=php,laravel,security \
  --yes

# Agent mode (Claude, Cursor, GPT, …) — JSON over stdio
npx @event4u/agent-config init --agent < request.json > response.json

# Maintenance
npx @event4u/agent-config sync       # pull upstream changes
npx @event4u/agent-config validate   # check lockfile vs disk
npx @event4u/agent-config prune      # remove orphans
npx @event4u/agent-config info       # show installed packs, versions
```

## Lockfile shape (`agents/agent-config.lock.yml`) <!-- ref-ignore -->

```yaml
schema_version: 1
agent_config_version: 2.0.0
generated_at: 2026-05-21T12:00:00Z
workspaces:
  - engineering
  - governance
packs:
  - id: pack.php
    version: 2.0.0
    auto_selected: false
  - id: pack.laravel
    version: 2.0.0
    auto_selected: false
    required_by: [pack.symfony-bridge]
files:
  - path: .augment/skills/laravel/SKILL.md
    pack: pack.laravel
    sha256: <hex>
    managed: true
  - path: .augment/rules/scope-control.md
    pack: pack.core
    sha256: <hex>
    managed: true
overrides:
  - path: agents/overrides/skills/laravel/SKILL.md
    base: .augment/skills/laravel/SKILL.md
    managed: false
```

## Agent-mode JSON protocol

The agent calls the CLI with a request envelope; the CLI replies
with either a `question` (waiting on a user choice the agent must
relay) or a `result` (selection complete, files written).

```json
// request.json (initial call)
{ "command": "init", "cwd": "/repo", "options": { "agent": true } }

// response.json (first question)
{
  "status": "question",
  "id": "q1.workspaces",
  "prompt": "Which workspaces does this project need?",
  "type": "multi-select",
  "choices": [
    { "id": "engineering", "label": "Engineering", "auto_suggest": true },
    { "id": "finance", "label": "Finance" }
  ],
  "next_call": "init --agent --answer q1.workspaces=engineering,finance"
}
```

The agent repeats the call with each answer until the CLI returns
`{ "status": "result", "lockfile_path": "...", "files_written": N }`.

## Phase 1 — Skeleton + manifest loader

- [x] Create `packages/core/installer/` with `package.json`
      (private to the monorepo, published as `@event4u/agent-config`),
      `tsconfig.json` (strict, Node 20+, ESM), `src/` layout
- [x] `src/manifest-loader.ts` reads `dist/discovery/discovery-manifest.json`
      (bundled into the npm tarball at build time)
- [x] `src/types.ts` mirrors the manifest schema as TypeScript types
      generated from the JSON Schema via `json-schema-to-typescript`
- [x] `src/cli.ts` wires `commander` and the five sub-commands
      (stubs only)
- [x] Add `task installer-test` running `vitest`
- [x] CI builds the package and runs vitest

## Phase 2 — Interactive `init`

- [x] `src/commands/init.ts` renders the workspace picker via
      `@inquirer/prompts` (checkbox multi-select)
- [x] After workspace selection, renders the pack picker filtered to
      the chosen workspaces; pre-selects `default: true` packs
- [x] Auto-detect helpers: detect `composer.json` → suggest `pack.php`
      and `pack.laravel`; `package.json` with Next.js → `pack.nextjs`;
      `pyproject.toml` → `pack.python` (when added)
- [x] Resolve `requires` edges transitively; show user the auto-added
      packs before confirming
- [x] Write files to consumer's `.augment/` and `.agent-src/`
- [x] Write `agents/agent-config.lock.yml` with paths, sha256s,
      managed flags
- [x] Show a summary table: workspaces, packs, file count

## Phase 3 — Non-interactive `init --yes`

- [x] `--workspaces=a,b` and `--packs=x,y` accept comma-separated ids
- [x] `--profile=<id>` accepts a pre-defined bundle from
      `dist/discovery/profiles.json` (Phase 5 of Phase 2 manifest)
- [x] `--dry-run` prints what would be written, exits 0 without
      touching disk
- [x] CI test that flag-driven init produces a deterministic lockfile
      for a known input

## Phase 4 — Agent mode

- [x] `src/agent-mode.ts` implements the question/result protocol
- [x] State machine: `select-workspaces` → `select-packs` →
      `confirm-auto-suggested` → `write-files` → `summary`
- [x] State is encoded in `--answer key=value` flags; no server-side
      session storage required (agents may invoke fresh each turn)
- [x] Validate every answer against the manifest before advancing;
      return `status: error` with explanation on bad input
- [x] Document the protocol in `docs/contracts/installer-agent-mode.md`
- [x] Add an example consumed by a Claude / Cursor command file under
      `.agent-src.uncompressed/commands/install-via-agent.md`

## Phase 5 — `sync`, `validate`, `prune`

- [x] `sync`: download new release tarball (or read local if monorepo
      dev), diff per-file sha256 against lockfile, three-way merge
      managed files, leave overrides untouched, show diff to user
      before applying
- [x] `validate`: assert every file in the lockfile exists on disk
      with the recorded sha256 (drift detection); exit non-zero on
      mismatch with a per-file report
- [x] `prune`: enumerate files in `.augment/` and `.agent-src/` that
      are not in the lockfile; offer to delete; preserve overrides

## Phase 6 — Distribution

- [ ] npm publish workflow under `.github/workflows/release-installer.yml`
      releases `@event4u/agent-config` on tag push
- [ ] Composer package adds a post-install script that calls
      `npx @event4u/agent-config sync --non-interactive` if Node is
      available; logs a hint if not
- [ ] Update consumer-facing README and AGENTS.md with the new
      install flow; keep the legacy `bash install.sh` section with
      a "deprecated, removed in 3.0" notice

## Quality gates

```bash
task installer-test                 # vitest suite
task installer-e2e                  # init+validate+prune against a fixture project
task lint-installer-protocol        # JSON-schema check on agent-mode messages
# remote CI runs the full pipeline; local full runs are skipped
```

## Downstream consumers

- Phase 4 (physical move) updates the installer's source paths
  but does not change the CLI surface
- Phase 5 (trust) adds gates inside `init` that surface a banner
  when an `advisory` or `restricted` pack is selected
- Phase 6 (browser wizard) wraps the same agent-mode protocol over
  a local HTTP server

## Failure modes guarded against

- **Hand-editing `.augment/`** — `validate` detects drift on sha256
  mismatch; `sync` re-applies upstream after surfacing the diff.
- **User override loss** — `install.managed: false` files in
  `agents/overrides/` are never touched, ever.
- **Agent loop** — agent-mode state encoded in flags, no hidden
  server state; an agent can re-issue from scratch any time.
- **Stale lockfile** — `validate` is in `task ci` for consumers.
