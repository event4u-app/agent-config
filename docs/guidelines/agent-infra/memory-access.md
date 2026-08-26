# Memory Access

How a skill or command reads engineering memory. Memory is entirely
**file-backed** (`agents/memory/`); there is no external backend.

Single entry point: the shared `retrieve(types, keys, limit)`
abstraction backed by `scripts/memory_lookup.ts` (TypeScript, run via
tsx). It reads curated YAML under `agents/memory/<type>/` and the
agent-written `agents/memory/intake/*.jsonl` signal log.

## Index by the moment, not only by the topic

Every entry answers **"what was I about to do when this would have helped"** — a
verb and its object (`author a roadmap`, `wait on CI`, `push a branch`, `edit a
markdown section with a script`) — and the index carries a trigger-moment
section keyed on those verbs beside the topic grouping.

A store indexed only by subject is an index for *browsing*, and browsing is not
the failure mode: an agent does not go looking for a trap it does not know
exists. Measured 2026-08-20 on one instrumented session — of eleven error
classes, **nine already had an entry** and all nine were read *after* the
failure. The deficit was delivery, not knowledge.

Writing the trigger key is part of writing the entry. A second index maintained
separately from the entries rots, and a rotted index is worse than none because
it still looks authoritative.

## The contract

Consumers reach it via the CLI (`agent-config memory:lookup`) or the
MCP `memory_lookup` tool — never by ad-hoc file reads:

```bash
agent-config memory:lookup \
  --types ownership,historical-patterns \
  --key "app/Http/Controllers/Billing/Checkout.php" \
  --limit 3
# --key is repeatable; add --format json for the raw hits,
# --envelope v1 for the retrieval-contract envelope.
```

**Index-first discipline** (road-to-memory-retrieval-economy — the mirror
of the MCP tool descriptions, for hosts without MCP): when you expect more
hits than you need, look up with `--envelope v1 --detail index` first —
each row carries `id`, `title` and `tokens_estimate` (the cost of fetching
it) — then fetch ONLY the ids you will actually use via the `memory_get`
MCP tool (or a full `--detail full` lookup narrowed to the right keys),
batching multiple ids into one call. For precise single-hit lookups the
full envelope is already minimal — the paired measurement showed index-
first COSTS tokens there (honest null pinned in
`internal/bench/reports/memory-retrieval-run.json`), so reach for index
mode on broad or exploratory queries, not reflexively.

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
(`agents/memory/intake/*.jsonl`) is **gitignored, local scratch** in a
consumer project — only entries promoted to curated get shared. `retrieve()`
still reads local intake (low-confidence tier); it just never reaches the team
repo unpromoted.

> **Which repo you are in changes this one line.** In a **consumer project**
> intake is gitignored — the shipped block in `src/config/gitignore-block.txt`
> lists `/agents/memory/intake/`. In **this package's own repo** it is
> **tracked** and union-merged, because here intake is part of the corpus
> under test; `agents/memory/intake/README.md` says so ("Local + tracked").
> Both are correct in their own context, and the sentence above states the
> consumer one. Read unconditionally, it makes a maintainer treat tracked
> intake files as a mistake, and it makes a consumer who follows the
> directory's README commit raw signals by accident.

## The status helper

`scripts/memory_status.ts` exports `status()`, reporting the (constant)
file backend so consumers — including the MCP `memory_status` tool and
the v1 health envelope — read a stable shape:

```ts
import { status } from './memory_status.js';
const r = status(); // constant; file-backed, never raises
// r.status === 'file' && r.backend === 'file'
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
- [`../../rules/context-hygiene.md`](../../../src/rules/context-hygiene.md)
  — token budget that `max_entries_per_task` protects
