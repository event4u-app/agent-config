---
complexity: standard
status: later
estate_growth_exempt: "Fix-what-you-see disposition (feat/map-always-fresh, ratification round 9, 2026-11-01): the round found that the code-graph engine's existing writes under agents/map/ follow a repository-shipped symlink; the new writes of that branch are contained, the pre-existing ones are larger than that change may carry. +1 later_roadmaps; no active roadmap is added."
estate_offset_exempt: "rg -F 'symlink' and 'contained_write' over agents/roadmaps found no roadmap owning write containment for the map engine, so nothing absorbs this item. Parked rather than active to keep the active estate unchanged."
review_by: 2026-11-30
entry_condition:
  what: "feat/map-always-fresh merged, so src/scripts/_lib/contained_write.ts exists on main"
  when: "after that merge"
  who: owner
---
# Road to a map engine that never writes through a symlink

> Observed during `feat/map-always-fresh` (2026-11-01), ratification round 9.

## Defect

A repository can commit `agents/map` (or a folder under it) as a symlink. The
code-graph engine's writes under `agents/map/` then land wherever the link
points. `feat/map-always-fresh` contained the writes it added (the turn-end
claims, the outcome record, the auto-refresh opt-in and opt-out) through
`src/scripts/_lib/contained_write.ts`: every component from the repository root
down must be a real directory by `lstat`, and the final component is opened with
`O_NOFOLLOW`. The writes that existed before it are not contained.

## Evidence

Ratification round 9 (2026-11-01, both seats): "three separate filesystem write
paths … follow repository-controlled symlinks outside the checkout". The same
pattern holds for the engine's existing writers.

## Where

- `src/scripts/code_graph/map.ts` — the staged map generation and `swapIn`.
- `src/scripts/code_graph/build.ts` — the graph cache, its SQLite twin, the extracts sidecar.
- `src/scripts/code_graph/refresh_lock.ts` — the refresh lock and its owner file.
- `src/scripts/code_graph/cli.ts` — `auto-refresh off` removes markers by path (`rmSync` through a symlinked ancestor deletes the target).

## Closes when

- [ ] every write and delete under a project home goes through a contained helper
- [ ] a test per writer symlinks `agents/map` to an outside folder and asserts the outside tree is unchanged
- [ ] the residual concurrent-replacement window is stated where it cannot be closed in Node
