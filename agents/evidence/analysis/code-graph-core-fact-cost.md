<!-- evidence-type: analysis -->
# Code-graph core fact cost

Step 2.7 of `road-to-a-map-that-holds-on-the-real-repo`. Measured 2026-10-27 on
`feat/inbox-2026-10-bf-core` against the lane build of this repository
(`agents/map/.build/code-graph-v1.json`), before the change.

**Cost: +2,706,132 bytes on a 100,592,154-byte graph, +2.69 %, against a budget of 10 %.**

| Quantity | Value |
|---|---|
| Nodes in the graph | 71,176 |
| Core nodes that gain a fact (no fact before) | 14,103 |
| — file | 11,573 |
| — method | 1,497 |
| — class | 898 |
| — route | 135 |
| Added JSON bytes (`fact` with owner, witness, rung) | 2,706,132 |

Method: serialise the `fact` object each of those nodes would carry — a `file`
witness for a file node, a `span` witness (8-hex hash of the trimmed first line)
for a class, method or route — and sum the byte lengths. The share is under the
budget, so all four kinds carry witnesses; the "files only" fallback is not taken.

After the change the rebuilt graph is 104,694,479 bytes, +4.08 % against the
100,592,154 before — the core facts plus the `scope` field of step 2.2 and the
witness `kind` of step 2.5, all three under the same budget.

Revisit if: the share crosses 10 % on a later measurement, or a new core kind
joins the set.
