# Watch note — Game development (native engines)

**Status:** deferred, gated (inbox rounds `inbox-2026-11-q` / `inbox-2026-11-t`,
2026-11-03). Watch-only per `domain-adoption-policy`: a record of the ask, the
gate state and what reopens it, so the next harvest re-evaluates without
relitigating. Not a commitment to build.

## What was proposed

The owner named game development as a focus and plans a first-party 3D game.
The supplied plans propose a game-development pack: engine runner rows, a
GDScript code-graph provider, a playtest capture command, scene and asset
skills, a runtime performance budget, and an asset licence and AI-use ledger.

## Gate state

| Gate | State |
|---|---|
| Demand signal | One owner statement (2026-11-03). No second consumer, no usage count. |
| Named maintenance owner + cadence | None named. Engine CLIs and test frameworks churn per release. |
| CI-tooling decision | None. No engine binary runs in this repository's CI. |

Two of three gates fail, so the domain is **gated**. What landed is
domain-neutral and needs no gate: engine-root recognition in the installer and
the stack detector, Unity and Unreal cache directories skipped by the code
graph, and `dotnet test` withheld on a Unity or Unreal root with the reason
recorded in `toolchain.json`. The playtest work is parked with the later
roadmaps until the gates move.

## What reopens it

A named maintainer with a cadence, plus a CI decision (an engine running
headless in CI, or an explicit reference-only stance). The owner's own game is a
valid demand signal; it does not discharge the other two gates.

## Constraint carried from the source

The owner's game is never named in a tracked artifact.
