## Acceptance criteria

- The template comment no longer calls the parser a devDependency and the key is still registered.
- A Bash search in a fresh-graph repository yields one context line per distinct token, at most five per session; other Bash yields nothing.
- `graphState` returns `edited` for an uncommitted change to an indexed file and `fresh` once reverted.
- `graph_node` answers in-edges and out-edges for a seed the existing ladder resolves and refuses one it cannot.
- Every stop where a graph existed writes both verdicts to the feeder record, and no exit code changes because of the graph.
