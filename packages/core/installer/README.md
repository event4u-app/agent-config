# `@event4u/installer`

TypeScript Core Installer for `@event4u/agent-config`. Drives selection,
materialization, drift detection, and pruning of the agent-config surface
in consumer projects.

## Status

Phase 3 of the monorepo plan. See:

- Roadmap: [`agents/roadmaps/monorepo-phase-3-typescript-installer.md`](../../../agents/roadmaps/monorepo-phase-3-typescript-installer.md)
- Architecture: [ADR-016](../../../docs/decisions/ADR-016-installer-architecture.md)
- Manifest contract: [ADR-015](../../../docs/decisions/ADR-015-discovery-manifest-contract.md)

## Commands

| Command | Purpose |
|---|---|
| `init` | First-time install — pick workspaces + packs, write files + lockfile |
| `sync` | Pull upstream changes, apply merge decision matrix, leave overrides alone |
| `validate` | Assert lockfile vs disk sha256s; exit non-zero on drift |
| `prune` | Remove orphan files (no longer in lockfile) |
| `info` | Show installed packs, versions, file counts |

## Modes

Three execution surfaces per command:

- **`--interactive`** — default when stdin is a TTY. Renders prompts via `@inquirer/prompts`.
- **`--non-interactive`** — flag-driven (`--workspaces`, `--packs`, `--yes`, `--dry-run`). CI-safe.
- **`--agent`** — stdin/stdout JSON protocol with strict question-id sequencing (see ADR-016 § 4).

## Local development

```bash
cd packages/core/installer
npm install                  # populates node_modules locally
npm run typecheck            # tsc --noEmit
npm test                     # vitest suite
npm run build                # emit dist/
```

Top-level CI runs the same gates via `task installer-test`.

## Layout

```
src/
  cli.ts                 # commander entry
  index.ts               # public exports for embedding
  manifest-loader.ts     # discovery-manifest.json loader + sha256
  lockfile.ts            # YAML read/write + schema_version: 1
  types.ts               # manifest + lockfile TS types
  commands/
    init.ts              # workspace + pack selection, atomic write
    sync.ts              # merge decision matrix
    validate.ts          # drift detection
    prune.ts             # orphan removal
    info.ts              # status report
  agent-mode/
    protocol.ts          # JSON envelope + question sequencing
    state-machine.ts     # select-workspaces → select-packs → confirm → write
  io/
    atomic-write.ts      # staging dir + atomic rename
    sha256.ts            # file hashing helper
tests/
  manifest-loader.test.ts
  lockfile.test.ts
  sync-algorithm.test.ts # decision matrix coverage (ADR-016 § 3)
  agent-mode.test.ts     # protocol_version + out-of-order rejection
```
