# Fixture — a component library's *package surface*, in two shapes

Two sibling package roots, not one hybrid. `check_package_surface` classifies each from its
**declared export targets**, never from its directory name.

| Directory | Models | Proves |
|---|---|---|
| `source-consumed/` | a workspace library the consumer compiles — no bundler, no build step | that a source-export surface classifies as source-consumed and its targets resolve |
| `built-surface/` | the **package surface a build would publish** | that a dist-export surface classifies as built shape and its targets resolve |

## What `built-surface/` is NOT

**It is not proof of buildability.** Its `dist/` is hand-authored — a *golden metadata
fixture*. No bundler is installed in this repository and none is executed here. A real Vite
or tsup config can emit a different layout and this fixture would not notice; establishing
that needs a separate integration test, and step 1.2 cannot honestly claim it.

The directory is named `ui-lib-vite` because it models the shape a Vite library-mode build
would publish. Vite is never exercised.

## Why two roots instead of one package with a `source` condition

A single package declaring both `"source": "./src/index.ts"` and `"import":
"./dist/index.js"` models **one hybrid package**, not two variants — and `"source"` is a
custom condition no runtime generally selects. The blocker's `Resolved when` asks for the
check to run against *both the source-export and the buildable variant*; two manifests
express that directly, and keep the checker from being tuned to one bundler's output layout.

## Decision provenance

`b-bundler-choice-for-fixture` — AI council 2026-08-23, 2/2 quorum, convergent: option
**(c)** for the source-consumed fixture plus a **static built-package-surface** fixture
modelled after (b), with no bundler installed or run. The maintainer delegated
owner-reserved blockers to the council for this autonomous drain run.

Both reviewers independently rejected naming the second fixture "buildable": a hand-authored
`dist/` is a built-package *surface*, and the name is what would have made the test
overclaim.

## No `node_modules`

Nothing is installed. `peerDependencies` are declarations the check reads; they are never
resolved.
