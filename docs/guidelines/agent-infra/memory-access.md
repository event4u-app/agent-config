# Memory Access

How a skill or command reads engineering memory. Memory is entirely
**file-backed** (`agents/memory/`); there is no external backend.

Single entry point: the shared `retrieve(types, keys, limit)`
abstraction backed by `scripts/memory_lookup.py`. It reads curated YAML
under `agents/memory/<type>/` and the agent-written `agents/memory/intake/
*.jsonl` signal log.

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
| `type` | One of the curated types (`ownership`, `historical-patterns`, `domain-invariants`, `incident-learnings`, `product-rules`) |
| `source` | `"curated"` or `"intake"` |
| `path` | File or logical source that produced the hit |
| `score` | Float in `[0..1]`; higher is better |
| `entry` | Full decoded entry — skills read what they need |

Skills treat `source: "curated"` as higher-trust and `source: "intake"`
as provisional (best-effort, agent-written, not human-reviewed).

**Sharing boundary.** Curated YAML (`agents/memory/<type>/*.yml`) is
**committed** — it is the team-shared layer. Raw intake
(`agents/memory/intake/*.jsonl`) is **gitignored, local scratch** — only
entries promoted to curated get shared. `retrieve()` still reads local
intake (low-confidence tier); it just never reaches the team repo unpromoted.

## The status helper

`scripts/memory_status.py` reports the (constant) file backend so
consumers — including the MCP `memory_status` tool and the v1 health
envelope — read a stable shape:

```python
from scripts.memory_status import status
r = status()          # constant; file-backed, never raises
assert r.status == "file" and r.backend == "file"
```

Contract guarantees:

- **Never raises** — `status()` is side-effect-free and constant.
- **Stable** — the four fields (`status`, `backend`, `reason`,
  `elapsed_ms`) never change shape between releases.

## How skills should use it

1. **Call the abstraction.** Skills use `retrieve()`, not ad-hoc file
   reads, so the supersede-chain and ranking semantics stay intact.
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
| PO / planner | `product-rules` |
| Incident | `incident-learnings`, `ownership` |

Other types remain accessible on demand via
`/memory-full <type>` (not a skill choice).

## Anti-patterns

- **Do NOT** read `agents/memory/**` directly with ad-hoc globbing.
  Skills lose the supersede-chain semantics and the `merge=union`
  guarantees. Always go through `retrieve()`.
- **Do NOT** cache hits across sessions. Curated files change between
  reads; re-run `retrieve()` each time.
- **Do NOT** fall back to intake JSONL when the curated file *exists
  but is empty*. That is a valid "no entries" answer, not a fallback
  signal.

## See also

- [`engineering-memory-data-format.md`](engineering-memory-data-format.md)
  — the on-disk schema
- [`../../rules/context-hygiene.md`](../../rules/context-hygiene.md)
  — token budget that `max_entries_per_task` protects
