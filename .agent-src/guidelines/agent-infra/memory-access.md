# Memory Access

How a skill or command reads engineering memory without caring whether
the optional `agent-memory` companion package is installed.

Single entry point: the shared `retrieve(types, keys, limit)`
abstraction backed by `scripts/memory_lookup.py` (file fallback) or the
package adapter (when present). The status helper
`scripts/memory_status.py` decides which path to take and caches the
result for the session.

Referenced by
[`road-to-agent-memory-integration.md`](../../../agents/roadmaps/road-to-agent-memory-integration.md)
Phase 0. The retrieval contract itself lives in
[`agent-memory/road-to-retrieval-contract.md`](../../../agents/roadmaps/agent-memory/road-to-retrieval-contract.md).

## The contract

```python
from scripts.memory_status import status
from scripts.memory_lookup import retrieve as retrieve_file

hits = retrieve_file(
    types=["ownership", "historical-patterns"],
    keys=["app/Http/Controllers/Billing/Checkout.php"],
    limit=3,
)
```

Every backend MUST return a list of `Hit` with:

| Field | Meaning |
|---|---|
| `id` | Stable identifier |
| `type` | One of the curated types (`ownership`, `historical-patterns`, `domain-invariants`, `architecture-decisions`, `incident-learnings`, `product-rules`) |
| `source` | `"curated"` or `"intake"` |
| `path` | File or logical source that produced the hit |
| `score` | Float in `[0..1]`; higher is better |
| `entry` | Full decoded entry — skills read what they need |

Skills treat `source: "curated"` as higher-trust and `source: "intake"`
as provisional (best-effort, agent-written, not human-reviewed).

## The detection helper

```python
from scripts.memory_status import status
r = status()          # cached; returns in 0ms on hit
if r.status == "present":
    ...               # route through agent-memory
elif r.status == "misconfigured":
    # surface a warning once per session, then fall back
    ...
else:
    ...               # r.status == "absent" — file fallback, always works
```

Contract guarantees:

- **Bounded** — cold probe capped at `_HEALTH_TIMEOUT_SECONDS` (2s).
- **Cached** — subsequent calls in the same process return 0ms.
- **Never raises on probe failure** — degrades to `absent` or
  `misconfigured`. Bugs in the helper itself still propagate so they
  get fixed.
- **Stable** — the four fields (`status`, `backend`, `reason`,
  `elapsed_ms`) never change shape between releases.

## How skills should use it

1. **Don't inline the branch.** Skills call the abstraction, not
   `memory_status.status()` directly, unless they need the human-
   readable reason (e.g., `review-routing` surfacing "backend
   misconfigured" on the PR report).
2. **Cap the load.** Respect `memory.retrieval.max_entries_per_task`
   from `.agent-project-settings`. Over-retrieval pollutes the context
   window without improving answers.
3. **Log the source in the reply.** A reviewer skill citing memory
   should say "per `ownership:team-payments` (curated) at
   `agents/memory/ownership.yml:42`" — the reader verifies cheaply.
4. **Treat intake as low-confidence.** Only promote intake findings
   into the final reply when the user can act on them; otherwise keep
   them as internal context.

## Access policy per role mode

Echoes `memory.retrieval.auto_load_shared_types` in
`.agent-project-settings`:

| Role mode | Auto-loaded types |
|---|---|
| Developer | `domain-invariants`, `ownership` |
| Reviewer | `ownership`, `historical-patterns`, `incident-learnings` |
| Tester | `historical-patterns`, `incident-learnings` |
| PO / planner | `product-rules`, `architecture-decisions` |
| Incident | `incident-learnings`, `ownership` |

Other types remain accessible on demand via
`/memory-full <type>` (not a skill choice).

## Anti-patterns

- **Do NOT** read `agents/memory/**` directly with ad-hoc globbing.
  Skills lose the supersede-chain semantics and the `merge=union`
  guarantees. Always go through `retrieve()`.
- **Do NOT** cache hits across sessions. Curated files change; the
  session cache in `status()` is specifically *only* for the detection
  probe, not for entries.
- **Do NOT** silently ignore `misconfigured`. Surface a one-liner once
  per session so the user knows the package is installed but degraded.
- **Do NOT** fall back to intake JSONL when the curated file *exists
  but is empty*. That is a valid "no entries" answer, not a fallback
  signal.

## See also

- [`engineering-memory-data-format.md`](engineering-memory-data-format.md)
  — the on-disk schema
- [`../../rules/context-hygiene.md`](../../rules/context-hygiene.md)
  — token budget that `max_entries_per_task` protects
- [`../../../agents/roadmaps/road-to-memory-merge-safety.md`](../../../agents/roadmaps/road-to-memory-merge-safety.md)
  — why intake is append-only JSONL with `merge=union`
