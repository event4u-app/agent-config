---
name: analytics:prune
tier: 2
cluster: analytics
sub: prune
description: Drop events older than the 90-day retention window from the local analytics log. Atomic and idempotent.
skills: [file-editor]
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "prune the analytics log, drop old events, clean up events.jsonl"
  trigger_context: "user wants to manually advance the rolling retention window"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# /analytics prune

Drops every record in `events.jsonl` whose timestamp is older than the
90-day retention window. Atomic: writes to `events.jsonl.tmp` first,
then renames over the original. A lock file prevents two prune passes
from racing.

## Prerequisites

- Python 3.10+ on the host.
- `~/.event4u/agent-config/workspace/analytics/events.jsonl` exists.

## Steps

### 1. Run the implementation

```bash
python3 packages/core/installer/python/workspace_analytics.py prune
```

No flags. The 90-day window is fixed by contract.

### 2. Surface the result

```
> pruned 47 event(s)
```

If the file is missing or already empty, print `pruned 0 event(s)` and
exit 0 — pruning is idempotent.

### 3. If another prune pass is running

The implementation acquires `retention.lock` with `O_EXCL`. If the lock
is held, the call returns 0 dropped (silent no-op). Re-run after the
other pass finishes.

## Safety

- **Atomic file replace.** The new JSONL is written to `events.jsonl.tmp`
  and atomically renamed with `replace`; no readers see a half-written
  file.
- **Lock-file mutex.** `retention.lock` is created with `O_EXCL` and
  unlinked in a `finally` block — even on crash, the next run can
  reclaim it after the lock owner is gone.
- Never reads the network, never POSTs.

## See also

- [`/analytics show`](show.md) — render the (post-prune) report.
- [`local-analytics`](../../../docs/contracts/local-analytics.md)
  § Storage — atomicity guarantees and lock semantics.
