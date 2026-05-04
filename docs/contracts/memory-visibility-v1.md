---
stability: beta
---

# Memory-visibility v1

**Purpose.** Pin the format of the user-facing visibility line that
every memory-using `/work` and `/implement-ticket` run prints, so the
user can tell what the agent retrieved and what it ignored.
Complements [`agent-memory-contract.md`](agent-memory-contract.md):
that doc describes the **CLI surface and backend states**; this doc
describes the **operator-facing surface** the engine emits per turn.

**Scope.** Defines the line shape, the privacy floor, the opt-out
toggle, and the interaction with the chat-history heartbeat. Does
**not** define how memory entries are scored or routed — that is the
sibling agent-memory package.

Last refreshed: 2026-05-04.

## Line shape

A single one-line ASCII record, prefixed with the memory icon `🧠`
and a single space:

```
🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>]
```

Examples:

```
🧠 Memory: 3/4 · ids=[mem_42, mem_57, mem_91]
🧠 Memory: 0/2 · ids=[]
🧠 Memory: 5/5 · ids=[mem_a01, mem_a02, mem_a03, …+2]
```

Cap at 5 ids inline; remainder rendered as `…+N`. The full id list
lives in the decision-trace JSON
([`decision-trace-v1.md`](decision-trace-v1.md)).

## Field semantics

| Field | Meaning |
|---|---|
| `hits` | Count of `memory_retrieve_*` calls during this turn that returned ≥ 1 entry. |
| `asks` | Count of `memory_retrieve_*` calls during this turn — both successful and empty. |
| `ids` | Stable memory entry ids returned across all calls, deduped, ordered by retrieval timestamp. |

`hits ≤ asks` is invariant. If `asks == 0`, the engine MUST suppress
the line entirely — no `0/0` noise.

## Privacy floor

The visibility line and the JSON it derives from MUST NOT contain:

- Entry **bodies**, summaries, or quoted snippets.
- Secrets, tokens, environment values, or paths outside the
  package's `agents/state/` and `tests/` allowlist.
- User identifiers beyond what is already public in the working
  directory's `.agent-settings.yml` (e.g. developer name).

The privacy floor is enforced by
`tests/contracts/test_memory_visibility_redaction.py` — any new
content path that ships memory output adds a fixture there.

## Opt-out

On by default whenever memory is asked at all in a turn. Users can
suppress the visibility line via:

```yaml
memory:
  visibility: off
```

Off-mode does not silence the underlying memory calls; it only stops
the line from rendering. The decision-trace JSON still records the
counts and ids for downstream metrics.

## Interaction with chat-history heartbeat

The chat-history heartbeat (`📒` marker) and the memory-visibility
line are **independent**:

- Heartbeat fires on cadence boundaries
  (`per_turn` / `per_phase` / `per_tool`).
- Visibility line fires whenever `asks ≥ 1` for the current turn,
  regardless of cadence.
- Both render on the same reply when both fire — heartbeat first,
  visibility line second, separated by a single newline.

The visibility line is **not** part of the heartbeat payload — that
keeps the heartbeat contract bytes-stable.

## Cadence interaction

| Cost profile | Visibility line | Heartbeat |
|---|---|---|
| `lean` | suppress unless `asks ≥ 3` | per-phase |
| `standard` | always when `asks ≥ 1` | per-turn |
| `verbose` | always when `asks ≥ 1` | per-tool |

Cost-profile lookup respects `.agent-settings.yml`'s `cost_profile`
key. Default is `standard`.

## Audit-as-memory feed

The visibility output produced by the engine is the input to the
audit-as-memory pipeline (consumed by the sibling distribution +
adoption work). Concretely:

- The engine emits the line + the underlying counts to the
  decision-trace JSON.
- A consumer hook reads `agents/state/work/<work-id>/decision-trace-*.json`,
  rolls counts up to the session level, and feeds the result back
  into the agent-memory store as an audit entry.

This contract pins the **producer** side. The audit-feed consumer
lives outside the package's stable surface and must read this
contract before parsing.

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Engines MUST gate on the visibility line shape — clients
parsing the stream MUST treat unknown trailing fields as forward-
compat extensions.

## Cross-references

- CLI surface and backend states:
  [`agent-memory-contract.md`](agent-memory-contract.md).
- Decision-trace JSON consumes the same counts:
  [`decision-trace-v1.md`](decision-trace-v1.md).
- Privacy regression test path:
  `tests/contracts/test_memory_visibility_redaction.py`.
