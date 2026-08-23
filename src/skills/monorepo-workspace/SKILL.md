---
model_tier: medium
name: monorepo-workspace
description: "Use to orient in a monorepo — which package manager, which workspaces, which task runner and its tasks — derived from the repository's own config and the runner's own listing, never guessed."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# Monorepo workspace orientation

Read-only. Answers "what is this repository, structurally" before anything
edits it: the package manager, the workspace list, the task runner, and the
tasks the runner actually defines.

Every answer is a **pointer plus a digest** — the file that states the fact and
a short quotation of it — never a flattened claim. This is the Class-A shape
[`standards-from-config`](../standards-from-config/SKILL.md) uses, and for the
same reason: a digest the reader can check beats a summary they have to trust.

## When to use

- Before editing anything in a repository with `apps/`, `packages/`, `libs/`,
  a `pnpm-workspace.yaml`, a `turbo.json`, or an `nx.json`.
- "Which packages depend on `@org/ui`?", "what does `build` run here?",
  "which workspace owns this file?"
- Before a cross-workspace change, as the input to
  [`blast-radius-analyzer`](../blast-radius-analyzer/SKILL.md) § Monorepo.

**Not** for authoring a component or picking a UI idiom — the stack detector
already reports the frontend workspace as `state.stack.scope_root`, and the UI
lane routes on that.

## Procedure

### 1. Package manager — from the declaration, then the lockfile

`packageManager` in the root `package.json` is the declaration and wins when
present (it is what Corepack enforces). Otherwise infer from the lockfile:
`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lock` / `bun.lockb` → bun,
`package-lock.json` → npm. Two lockfiles is a finding, not a tie to break —
report both and stop.

### 2. Workspaces — from the declarative source

In precedence order, and report which one answered:

| Source | Field |
|---|---|
| `pnpm-workspace.yaml` | `packages:` |
| `package.json` | `workspaces` (array, or `{ packages: [...] }`) |
| `nx.json` beside per-project `project.json` | Nx infers; use step 3 |
| `lerna.json` | `packages` |

Globs are globs: `packages/*` means every direct child carrying a manifest, not
every directory.

### 3. Task runner — ask the runner, do not read its config

When a runner is present, its own listing is the source of truth, because a
runner infers projects that appear in no config file you can read:

```bash
# Nx — never read project.json by hand for the project list
npx nx show projects
npx nx show project <name>   # targets for one project

# Turborepo
npx turbo ls
```

Print the task list **with each task's `description` field when it has one** —
`turbo.json` tasks carry an optional `description`, and it is the only place the
repository says what a task is *for* rather than what it depends on.

### 4. No runner on PATH — walk the manifests and say so

`turbo` and `nx` are the **consumer project's** binaries, invoked through its
own `npx` / `pnpm dlx`. This package never installs them. When neither
resolves, build the graph from the manifests instead: for each workspace, read
its `dependencies` / `devDependencies` and keep the entries whose names match
another workspace's `name`. That is the dependency graph, and it is complete
for `workspace:`-linked packages.

State plainly that the listing came from manifests rather than the runner — an
inferred target list can miss runner-inferred targets. This is the posture
[`react-shadcn-ui`](../react-shadcn-ui/SKILL.md) already takes for the shadcn
CLI; the stop condition is `missing-tool-handling` (never install it silently,
never fake the output).

## Output format

An orientation report MUST contain, in order:

1. **The package manager**, with the source that decided it — `packageManager`
   when declared, otherwise the lockfile filename. Two lockfiles is reported as
   a finding, never resolved by picking one.
2. **The workspace table** — one row per workspace: directory path, package
   `name`, and its workspace-internal dependencies. Both the path and the name,
   because the graph links on `name` and humans talk in paths.
3. **The task runner and its tasks**, each task with its `description` field
   when the config carries one, and its `dependsOn` when it has one.
4. **A source line** naming which of the two paths produced the listing — the
   runner's own (`turbo ls` / `nx show projects`) or the manifest walk. When it
   was the manifest walk, the line also says that runner-inferred targets may be
   missing.
```
Package manager: pnpm@9.12.0   [package.json#packageManager]
Workspaces (2)                 [pnpm-workspace.yaml#packages: apps/*, packages/*]
  apps/web        @fixture/web   deps: @fixture/ui
  packages/ui     @fixture/ui    deps: —
Task runner: turbo             [turbo.json#tasks]
  build   "Compile every workspace to its dist/ output."   dependsOn: ^build
  lint    "Run the workspace linter over its own sources."
  test    "Run the workspace unit tests."                  dependsOn: ^build
Source: turbo ls  (runner listing)
```

When the runner was absent, the last line reads
`Source: manifest walk (turbo not on PATH — runner-inferred targets may be missing)`.

## Gotcha

- A workspace's directory name and its package `name` are different keys. The
  graph links on `name`; humans talk in paths. Print both.
- `packages/eslint-config` is a workspace. It is not a frontend, and it is not
  a scope candidate for a UI change.
- An `nx.json` with no `workspaces` key in `package.json` is normal, not broken.
- `packageManager` pinning a manager whose lockfile is absent means the install
  was never run with it. Report the mismatch.

## Do NOT

- Read `project.json` by hand to enumerate Nx projects — `nx show projects` is
  the source of truth and includes inferred targets.
- Install `turbo` or `nx` to answer a question. They are the consumer's
  binaries; when absent, walk the manifests and say that is what you did.
- Flatten the answer into prose without the file that states it.
- Report a workspace list from the conventional directories when a declarative
  source exists — the declaration is authoritative, and the two can disagree.

## See also

- [`standards-from-config`](../standards-from-config/SKILL.md) — the Class-A pointer+digest shape this follows.
- [`workspace-link`](../workspace-link/SKILL.md) — when a cross-workspace import will not resolve.
- [`blast-radius-analyzer`](../blast-radius-analyzer/SKILL.md) — § Monorepo consumes this graph.
- [`monorepo-antipatterns`](../../../docs/guidelines/monorepo-antipatterns.md) — diff-detectable task-graph mistakes.
