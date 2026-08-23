# Monorepo anti-patterns — the diff-detectable set

Task-graph mistakes a reviewer can catch by **reading a diff**, with no build
run and no repository checked out. That is the whole selection criterion: a
review judge sees a patch, not a running pipeline, so a rule it cannot evaluate
from the patch is not a rule it can enforce.

> **Own analysis, corroboration outstanding.** The six rows below describe
> publicly documented behaviour of Turborepo and Nx and are stated from that
> behaviour, not adopted from a third-party artefact — so no
> `provenance/borrows.jsonl` entry backs them, and none should be read into
> them. The roadmap that commissioned this file recorded specific source line
> numbers in an external MIT-licensed reference; that reference is **not
> reachable from this checkout** (it was never cloned here, and the consumed
> inbox copy carrying the real identifiers is gitignored), so those line numbers
> could not be re-read and are deliberately **not** reproduced as citations. A
> citation nobody in this tree can follow is worse than an honest own-analysis
> label. See § Not harvested for what that leaves open.

## The six rows

### 1. A root script that bypasses the task runner

```jsonc
// root package.json — WRONG
{ "scripts": { "build": "tsc -b packages/ui && vite build apps/web" } }
```

The runner exists to know the graph, cache the results, and parallelise. A root
script that invokes the underlying tools directly gets none of that, and — worse
— becomes a second, divergent definition of what "build" means. Route through
the runner: `"build": "turbo run build"`.

**In a diff:** a root `scripts` entry naming a compiler, bundler, or test runner
directly instead of `turbo run` / `nx run-many`.

### 2. `prebuild` that builds a sibling

```jsonc
// packages/ui/package.json — WRONG
{ "scripts": { "prebuild": "cd ../tokens && npm run build" } }
```

npm lifecycle hooks are invisible to the task runner. The dependency is real but
undeclared, so the runner may build the two in the wrong order, in parallel, or
skip the sibling entirely on a cache hit. Express it as a dependency
(`dependsOn: ["^build"]` plus a real `workspace:` dependency) so the graph
carries it.

**In a diff:** a `pre*` / `post*` script containing `cd ..`, a sibling path, or
another workspace's name.

### 3. `&&`-chained runner tasks

```jsonc
{ "scripts": { "ci": "turbo run lint && turbo run test && turbo run build" } }
```

Three sequential invocations, each with its own graph walk, forcing full
serialisation and discarding the parallelism the runner would have found. It
also makes the cache less effective, because each invocation is scoped to one
task. Pass the tasks together: `turbo run lint test build`.

**In a diff:** two or more `turbo run` / `nx run-many` invocations joined by
`&&` in one script.

### 4. Shared code inside `apps/`

```
apps/web/src/shared/format-currency.ts   ← imported by apps/admin
```

`apps/*` are leaves: deployable things nothing else depends on. The moment a
second app imports from the first, the two are coupled with no declared edge,
the affected-set calculation is wrong, and neither app can be built or released
alone. Shared code belongs in a `packages/*` workspace with a real dependency
declared ([`workspace-link`](../../src/skills/workspace-link/SKILL.md)).

**In a diff:** an import whose specifier reaches into `apps/<other>/`, or a new
`shared/` `common/` `utils/` directory added under `apps/*`.

### 5. `../` traversal in a task's `inputs`

```jsonc
// turbo.json — WRONG
{ "tasks": { "build": { "inputs": ["src/**", "../tokens/src/**"] } } }
```

`inputs` are scoped to the workspace on purpose: they define that task's cache
key. Reaching outside it makes the key depend on files the runner does not
consider part of this task, which produces both false cache hits (the sibling
changed in a way the key did not capture) and false misses. The sibling's output
should be an input *because it is a declared dependency*, not because a glob
walked up the tree.

**In a diff:** a `../` segment inside `inputs`, `outputs`, or a task-scoped glob
in `turbo.json`.

### 6. A file-producing task with no `outputs`

```jsonc
{ "tasks": { "build": { "dependsOn": ["^build"] } } }   // writes dist/, declares nothing
```

With no `outputs`, the runner caches the task's *logs* and not its artefacts. A
cache hit then restores nothing, so the next task in the chain runs against a
missing or stale `dist/` — and the failure is intermittent, because it only
appears on a hit. Declare what the task writes: `"outputs": ["dist/**"]`.

**In a diff:** a task whose command runs a compiler or bundler while its config
block carries no `outputs` key.

## Not harvested

The external reference this file was commissioned from carries a substantially
longer anti-pattern list. The rows above are the ones whose violation is visible
in a patch; the classes below were deliberately left out, each for a reason that
is a property of the *check*, not of the advice:

| Class not harvested | Why it cannot be a diff rule |
|---|---|
| Cache hit-rate and timing regressions | Needs two runs to compare; a diff has no runtime. |
| Task-graph cycles | Requires resolving the whole graph, not reading one file. |
| Over-broad `inputs` causing cache misses | "Too broad" is a judgement against observed hit rates. |
| Remote-cache and CI configuration mistakes | Lives in CI/runner settings, not in the reviewed diff. |
| Dependency-order races that only appear under `--parallel` | Needs a running build to observe. |
| Environment-variable declarations missing from the cache key | Detectable only once a build produces a wrong artefact. |

**Honest limit on this table:** it enumerates *classes* reasoned about from what
such a list contains, not a row-by-row disposition of the source — which, per
the note above, could not be opened here. So it does not establish that every
source row is accounted for. Closing that needs the reference reachable in a
checkout; until then this section states what was decided and on what basis,
rather than implying a completeness it does not have.

## See also

- [`monorepo-workspace`](../../src/skills/monorepo-workspace/SKILL.md) — read the graph and the task list before judging either.
- [`workspace-link`](../../src/skills/workspace-link/SKILL.md) — the `workspace:` declaration rows 2 and 4 both come back to.
- [`blast-radius-analyzer`](../../src/skills/blast-radius-analyzer/SKILL.md) — § Monorepo, for the affected set of an edit.
- [`design-antipatterns.md`](design-antipatterns.md) — sibling diff-detectable catalog for a different surface.
