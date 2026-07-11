## 4.2.0

The settings page got a full rebuild. Options that lived in three tabs now sit on one searchable page, and keyboard navigation works throughout.

Sync is faster on large workspaces: pulling 10,000 items dropped from 40 seconds to 6 in our benchmark, because the client now requests deltas instead of full snapshots.

Direct messages are now end-to-end encrypted. Existing message history stays readable; only new messages use the new envelope format.

One breaking change: the `v1/export` endpoint is gone. Use `v2/export`, which returns the same fields plus pagination.
