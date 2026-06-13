# ADR 0001 — Consumer-side snapshot of the agent-memory contract

> Area: `memory` · Status: accepted · Date: 2026-05-16 · Type: retrospective
> Roadmap: an internal parity roadmap (local-only) Phase 4 Step 3
> Supersedes: —

## Context

`@event4u/agent-memory` is a sibling package owned by this team. It
provides MCP-server semantic-retrieval plus a v1 retrieval envelope
(`id`, `type`, `source`, `confidence`, `body`, …). The spec-side
source-of-truth lives in
[`agents/roadmaps/archive/agent-memory/`](../../../agents/roadmaps/archive/agent-memory/);
the implementation lives in the sibling repo.

The question this ADR records is: **what surface does `agent-config`
freeze internally**, given the package ships independently and the
two repos can drift between releases?

## Decision

**Maintain a consumer-side snapshot at
[`docs/contracts/agent-memory-contract.md`](../../contracts/agent-memory-contract.md)** —
a point-in-time pin of the interface `agent-config`'s wired code
**currently assumes**.

### Three expected backend states

Probed by [`scripts/memory_status.py`](../../../src/scripts/memory_status.py):

| Status | Meaning | Agent-config behaviour |
|---|---|---|
| `absent` | Package not installed / CLI not on PATH | File fallback only |
| `misconfigured` | Installed; `health()` fails within 2 s | Warn once per session, fall back to file |
| `present` | Installed; healthy within 2 s | Route retrieval through package |

Detection is **bounded** (≤ 2 s cold probe), **cached per process**,
**non-raising** on probe failure.

### CLI candidates

Probed in `_CLI_CANDIDATES`: `memory` (canonical, v1.1+) ·
`agent-memory` (planned alias) · `agentmem` (legacy). If the released
package diverges from these names, this file updates — never the
other way round.

### Retrieval envelope (v1)

Mandatory per entry: `id`, `type`, `source ∈ {repo, operational}`,
`confidence`, `body`. Optional: `trust`, `last_validated`,
`shadowed_by`. Envelope: `contract_version`, `status ∈ {ok, partial,
error}`, `entries`, `slices`, `errors`. Source-of-truth:
[`scripts/memory_lookup.py`](../../../src/scripts/memory_lookup.py)
lines 320–345.

### Refresh policy

The snapshot doc carries a `Last refreshed:` line. On every sibling
package release that touches the CLI or envelope shape, the
maintainer:

1. Runs the sibling package's CLI against `agent-config`'s test
   fixtures.
2. Updates this contract doc with the new shape, bumps
   `Last refreshed:`, files the diff as a PR.
3. Updates `_CLI_CANDIDATES` and any consumer skills only if the
   shape diff is breaking.

## Considered alternatives

### Alt 1 — No internal pin; trust the sibling spec (rejected)

Read the sibling package's spec at runtime / docs time.

**Why rejected:** the two repos release on independent cadences. A
mid-iteration sibling-package change would silently break consumer
code. The internal pin makes the divergence point a diffable doc.

### Alt 2 — Submodule the sibling spec (rejected)

Git submodule pulls `agent-memory/docs/` into `agent-config/`.

**Why rejected:** submodules complicate consumer installs (npx /
shell installer must handle nested clones); the spec is fast-moving
and submodule churn dwarfs the consumer-side surface this package
actually wires.

### Alt 3 — Consumer-side snapshot (accepted)

The chosen path. One readable doc, refreshed on sibling-package
release, citable from every consumer skill that touches memory.

## Consequences

- **Positive:** drift between sibling spec and consumer wiring lands
  in one diffable file; the `present` / `misconfigured` / `absent`
  contract is one citation away; new consumer skills don't have to
  re-derive the envelope shape.
- **Negative:** the snapshot can lag the sibling package. Mitigated
  by the explicit `Last refreshed:` line and the refresh policy in §
  "Refresh policy" above.
- **Reversal cost:** delete the contract doc; consumers fall back to
  reading the sibling spec directly. No code change required.

## References

- [`docs/contracts/agent-memory-contract.md`](../../contracts/agent-memory-contract.md) — the consumer-side snapshot.
- [`scripts/memory_status.py`](../../../src/scripts/memory_status.py) — three-state probe.
- [`scripts/memory_lookup.py`](../../../src/scripts/memory_lookup.py) — retrieval envelope source.
- [`agents/roadmaps/archive/agent-memory/`](../../../agents/roadmaps/archive/agent-memory/) — sibling-package spec.
- an internal parity roadmap (local-only) Phase 4 Step 3 — origin.
