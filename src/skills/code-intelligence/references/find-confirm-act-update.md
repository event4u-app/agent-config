# Find → confirm → act → update (ADR-303)

The graph is an index, never the truth: every fact carries a witness
(`file:line` plus a hash of the span read there), and a witness says where to
look, not what is there now.

1. **Find.** `query` / `explain` / `affected` take `--kind K,..`,
   `--relation R,..`, `--direction in|out|both`, `--depth 1-3` and `--limit N`
   and then answer a filtered tree: each item with its witness, `returned N of
   M`, and the population searched. An `affected` answer adds a `usage:` line —
   the graph's count is a **lower bound**, paired with a text search for the
   name; `text only:` lines are places the graph missed.
   `agent-config code-graph pack "<task>" [--diff] [--since <rev>] [--budget N]`
   returns the facts a task touches, seed-first within a token budget, each one
   confirmed; a seed word naming too many nodes is refused with its candidates.
2. **Confirm before acting.** `agent-config code-graph confirm <id…>` (or
   `--from-query <symbol>` with the same filters) re-reads only the witnesses and
   answers per fact `confirmed | moved | changed | gone`, or `added` for a fact
   only the working-tree overlay holds. It reads through the SQLite twin and
   refuses rather than loading the JSON graph. The change-risk class of the
   witnessed files picks a depth (R0 none, R1 witness, R2 plus a text check, R3
   plus callers one hop out and a drift re-run); `--risk-depth auto` runs that
   depth, the default reads the witnesses and records the choice.
   `--neighbours in|out|both` confirms the edges too.
3. **Act** on what was confirmed. A `changed` or `gone` fact is read again from
   the source, never acted on from the graph.
4. **Update after acting.** `agent-config code-graph refresh --touched [file…]`
   re-reads changed and named files into the working-tree overlay, recomputes
   drift for their facts only, and prints the tree the graph was verified at.
   Readers see the overlay without a rebuild.

`agent-config code-graph review-risk [--diff <rev>] [--json]` states a diff as a
sum of terms — callers, entry points, flows, co-change partners, areas,
columns, operations, pipelines — each counted fact with its witness.
`agent-config code-graph rebuild-diff` sets the incremental build against a cold
one; every difference is a reader defect, and it exits 1.

A build merges the lane readers (data, interfaces, runtime, delivery, history,
decisions, flows) and prints one line per lane; `--no-lanes` skips them. A
`refresh` whose result loses a large share of facts with no matching change in
the tree is refused unless `--allow-shrink` is passed; dropped facts leave a
tombstone, so a later confirm says `gone` instead of nothing.

Where it lives: `agents/map/` holds the map, `manifest.json` and one folder per
area (`code/`, `data/`, `interfaces/`, `runtime/`, `delivery/`); only
`agents/map/.build/` (graph cache, SQLite twin, overlay, lock) is gitignored. A <!-- ref-ignore -->
root without a project home writes to the user-global hub's `map/`. A cache an
older release left in `agents/runtime/state/` is still read. The
`check_graph_writers` gate fails any writer outside these two layouts.

The same steps over MCP: `graph_query` takes `kind` / `relation` / `direction` /
`depth` for the filtered tree and `mode: "pack"` for `pack`; `graph_node` takes
`mode: "confirm"` to confirm that one node; `graph_impact` takes
`review_risk: true` for `review-risk`.
