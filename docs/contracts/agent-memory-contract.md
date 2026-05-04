---
stability: beta
---

# Agent-Memory Contract (as expected by `agent-config`)

**Purpose.** Freeze the interface `agent-config` currently expects from
the sibling package `@event4u/agent-memory`, so when that package
actually ships we can diff its real surface against this document in
one place — instead of chasing drift across skills, commands, and
helpers.

**Ownership.** `agent-memory` is ours; we decide release timing. This
doc is internal, not a spec handed to an external team. The
authoritative spec-side documents live under
[`agents/roadmaps/agent-memory/`](../../agents/roadmaps/agent-memory/); this context
is the **consumer-side snapshot** — what our wired code assumes today.

Last refreshed: 2026-04-22.

## What this doc is *not*

- Not a replacement for the agent-memory retrieval-contract spec —
  that lives in the agent-memory package and is the spec we hand to
  the implementer.
- Not a commitment that consumer code looks exactly like this forever
  — it is a point-in-time pin.
- Not an agent-facing skill. Humans read this when the package lands.

## Expected backend states

Defined in [`memory-access.md`](../../docs/guidelines/agent-infra/memory-access.md)
and `scripts/memory_status.py`:

| Status | Meaning | Agent-config behaviour |
|---|---|---|
| `absent` | Package not installed or CLI not on PATH | File fallback only |
| `misconfigured` | Installed but `health()` fails within 2s | Warn once / session, fall back to file |
| `present` | Installed and healthy within 2s | Route retrieval through package |

Detection must be **bounded** (≤ 2s cold probe), **cached** per
process, **non-raising** on probe failure.

## Expected CLI surface

Probed in `scripts/memory_status.py` via `_CLI_CANDIDATES`:

- Executable on `PATH` as **`memory`** (canonical, ships in
  `@event4u/agent-memory` v1.1+ as `package.json#bin.memory`),
  **`agent-memory`** (planned alias), or **`agentmem`** (legacy).
- Supports `health` subcommand emitting a v1 health envelope on stdout
  (`{contract_version, status, backend_version, features, latency_ms}`)
  and exiting non-zero on unhealthy.
- Supports `retrieve <query> [--type T …] [--limit N] [--layer 1|2|3]
  [--budget N] [--low-trust] [--repository ID]` emitting a v1
  retrieval envelope on stdout (always JSON).

The retrieval invocation is **semantic, not key-based** — see the
"⚠️ Known contract drift" section below for the consumer-side
implication.

If the released package diverges from these names, we update
`_CLI_CANDIDATES` in `memory_status.py` — not the other way round.

## Expected retrieval shape (present path)

Source of truth: the retrieval-contract spec in the agent-memory
package. Consumer skills call the shared abstraction, not the package
directly.

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

**Status: resolved at the consumer boundary.** The CLI / JSON output of
`scripts/memory_lookup.py` already emits the v1 envelope with
`source ∈ {repo, operational}`, `confidence`, `slices`, `status`, and
`contract_version` — see `memory_lookup.py:320-345` (envelope
assembly).

What remains is **internal-only**: the private `Hit` dataclass inside
`memory_lookup.py` still uses `source ∈ {curated, intake}` and `score`.
No skill, command, or external consumer imports `Hit` directly — they
all go through the public JSON surface, which is already spec-aligned.

| Internal `Hit` field | Public envelope field | Visible to consumers? |
|---|---|---|
| `id`, `type` | `id`, `type` | yes — match |
| `source ∈ {curated, intake}` | `source ∈ {repo, operational}` | no — translated at boundary |
| `score ∈ [0,1]` | `confidence` | no — translated at boundary |
| `path` | — | no — internal scoring signal |

**Trigger to revisit:** if a second module starts importing the `Hit`
dataclass directly (e.g. `memory_lookup.py` is split into multiple
files and `Hit` becomes a public type), rename `Hit.source`/`Hit.score`
to match the envelope so the boundary translation can be deleted.
Until then, the internal naming is an implementation detail.

There is also a **calling-convention drift** between the contract's
key-based `retrieve(types, keys, limit)` and the package's
semantic-only `retrieve(query, …)`. This is tracked separately and
is the subject of an ongoing design decision (hybrid contract — keys
synthesise into a query for the package path; file-fallback stays
key-match).

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

- [`memory-access guideline`](../../docs/guidelines/agent-infra/memory-access.md)
- [`scripts/memory_status.py`](../../.agent-src.uncompressed/templates/scripts/memory_status.py)
- [`scripts/memory_lookup.py`](../../.agent-src.uncompressed/templates/scripts/memory_lookup.py)
