---
name: batchcmd
pack: __origtest
---

# /batchcmd

This orchestrator coordinates a bespoke reconciliation sweep across every
ledger partition, folding divergent snapshots into a single authoritative
manifest before the downstream settlement window opens for the trading desk.
It never mutates a partition in place; it stages a shadow copy, diffs the
delta, and promotes only once the invariant checker signs off on the merge.