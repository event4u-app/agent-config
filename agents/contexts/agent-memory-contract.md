# Agent-Memory Contract (as expected by `agent-config`)

**Purpose.** Freeze the interface `agent-config` currently expects from
the sibling package `@event4u/agent-memory`, so when that package
actually ships we can diff its real surface against this document in
one place — instead of chasing drift across skills, commands, and
helpers.

**Ownership.** `agent-memory` is ours; we decide release timing. This
doc is internal, not a spec handed to an external team. The
authoritative spec-side documents live under
[`../roadmaps/agent-memory/`](../roadmaps/agent-memory/); this context
is the **consumer-side snapshot** — what our wired code assumes today.

Last refreshed: 2026-04-22.

## What this doc is *not*

- Not a replacement for
  [`road-to-retrieval-contract.md`](../roadmaps/agent-memory/road-to-retrieval-contract.md)
  — that is the spec we hand to the agent-memory implementer.
- Not a commitment that consumer code looks exactly like this forever
  — it is a point-in-time pin.
- Not an agent-facing skill. Humans read this when the package lands.

## Expected backend states

Defined in [`memory-access.md`](../../.agent-src.uncompressed/guidelines/agent-infra/memory-access.md)
and `scripts/memory_status.py`:

| Status | Meaning | Agent-config behaviour |
|---|---|---|
| `absent` | Package not installed or CLI not on PATH | File fallback only |
| `misconfigured` | Installed but `health()` fails within 2s | Warn once / session, fall back to file |
| `present` | Installed and healthy within 2s | Route retrieval through package |

Detection must be **bounded** (≤ 2s cold probe), **cached** per
process, **non-raising** on probe failure.

## Expected CLI surface

Probed in `scripts/memory_status.py`:

- Executable on `PATH` as `agent-memory` **or** `agentmem`.
- Supports `health` subcommand returning non-zero on unhealthy.
- Supports (future) `retrieve --types … --keys … --limit …
  --format json` returning the retrieval envelope below.

If the released package diverges from these names, we update
`_CLI_CANDIDATES` in `memory_status.py` — not the other way round.

## Expected retrieval shape (present path)

Source of truth:
[`road-to-retrieval-contract.md`](../roadmaps/agent-memory/road-to-retrieval-contract.md).
Consumer skills call the shared abstraction, not the package directly.

**Request** (Python):

```python
retrieve(types=[…], keys=[…] or {…}, limit: int = 20, timeout_ms: int = 2000)
```

**Response** (v1 envelope) — mandatory fields per entry: `id`, `type`,
`source ∈ {repo, operational}`, `confidence`, `body`. Optional:
`trust`, `last_validated`, `shadowed_by`.

Envelope: `contract_version`, `status ∈ {ok, partial, error}`,
`entries`, `slices`, `errors`.

## ⚠️ Known contract drift (consumer vs. spec)

The file fallback in `scripts/memory_lookup.py` currently returns a
**flat `list[Hit]`** with a different field set:

| File fallback `Hit` | Spec entry | Notes |
|---|---|---|
| `id`, `type` | `id`, `type` | match |
| `source ∈ {curated, intake}` | `source ∈ {repo, operational}` | **naming drift** |
| `score ∈ [0,1]` | `confidence` | **naming drift** |
| `path` | — (spec has no `path`) | extra field |
| — (no envelope) | `contract_version`, `status`, `slices`, `errors` | **missing layer** |

This drift is tolerable while the package is absent (skills only
consume the fallback shape). When the package ships, one of two paths:

1. **Align fallback to spec** — rename `source` values, rename `score`
   → `confidence`, wrap return value in the envelope. Breaking change
   in `memory_lookup.py`; skills adjust once.
2. **Keep fallback flat, adapt package** — the package adapter
   flattens the envelope on the consumer boundary. Keeps skills
   unchanged; hides the envelope from agent-config entirely.

Decision postponed until the package is closer to release — the
tradeoff shifts depending on whether other consumers emerge that want
the full envelope.

## Expected `propose()` / signal emission

Shape used by `scripts/memory_signal.py` and the `/propose-memory`
command: JSONL append-only drop-ins under
`agents/memory/intake/*.jsonl`, one signal per line. When the package
is present, the same payload is accepted by a `propose()` CLI or MCP
call. File-drop is the always-works path.

Required fields (keep in sync with `/propose-memory` command):
`ts`, `type`, `key` (path or logical id), `observation`, `source`
(`agent` or `human`), `session_id`.

## Revisit triggers

Q29 is **parked open**, not a blocker. Revisit when **one** of these
holds:

- `@event4u/agent-memory` ships a tagged release (any v0.x)
- A consumer project explicitly asks for the `present` path
- The agent-memory repo opens an integration PR against `agent-config`
- We change the file fallback's public shape (then rewrite this doc
  *before* the change lands)

## See also

- [`road-to-memory-self-consumption.md`](../roadmaps/road-to-memory-self-consumption.md)
- [`road-to-agent-memory-integration.md`](../roadmaps/road-to-agent-memory-integration.md)
- [`agent-memory/road-to-retrieval-contract.md`](../roadmaps/agent-memory/road-to-retrieval-contract.md)
- [`agent-memory/road-to-promotion-flow.md`](../roadmaps/agent-memory/road-to-promotion-flow.md)
- [`memory-access guideline`](../../.agent-src.uncompressed/guidelines/agent-infra/memory-access.md)
- [`scripts/memory_status.py`](../../.agent-src.uncompressed/templates/scripts/memory_status.py)
- [`scripts/memory_lookup.py`](../../.agent-src.uncompressed/templates/scripts/memory_lookup.py)
- [`open-questions-2.md`](../roadmaps/open-questions-2.md) — Q29
