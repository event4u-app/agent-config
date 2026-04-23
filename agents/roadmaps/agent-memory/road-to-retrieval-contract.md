# Spec: Cross-repo retrieval contract

> **Spec for `agent-memory`, authored from `agent-config`.**
> See [`README.md`](README.md) for the ownership split.

## Status

**Accepted (v1, 2026-04-23).** Frozen as the canonical contract. The
consumer-side implementation shipped schema + fixtures + conformance
harness in this repo on 2026-04-23
([`../archive/road-to-retrieval-contract-consumer.md`](../archive/road-to-retrieval-contract-consumer.md));
the `agent-memory` repo adopts this file verbatim as its
implementation reference.

### Amendment process

- **Additive changes (minor bump)** — new optional response fields or
  new error codes land via PR that updates this spec, the JSON schema
  under [`/schemas/retrieval-v1.schema.json`](../../../schemas/retrieval-v1.schema.json),
  and adds a fixture under
  [`/tests/fixtures/retrieval/`](../../../tests/fixtures/retrieval/)
  covering the new field. Existing fixtures MUST keep passing.
- **Breaking changes (major bump)** — require a new roadmap (e.g.
  `road-to-retrieval-contract-v2.md`), a deprecation window of at
  least one consumer-release cycle, and a new schema file
  (`retrieval-v2.schema.json`) alongside v1.
- **Open questions at the bottom of this file** are resolved by PR
  that updates the relevant section, adds a fixture demonstrating
  the resolved semantics, and links the PR from this status block.

### Originally proposed after

GPT review of
[`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md)
flagged that the `retrieve()` abstraction was named but not
specified — which blocked Phase 1 of that roadmap (consumers
could not wire against an unstable shape).

## Problem

`agent-config` and `agent-memory` live in separate repos, ship on
independent release cycles, and must interoperate across `present |
absent | misconfigured` backend states. Without a versioned contract
the integration silently drifts: a new `agent-memory` release changes
the response shape, consumer skills break in `present` mode, the
`absent` fallback masks the symptom. This spec defines the contract
both sides pin against.

## Non-goals

- **No** wire protocol choice (MCP, stdio, HTTP, library). The contract
  is shape-only; transports are the package's concern.
- **No** schema for individual memory types — that lives in
  [`../road-to-engineering-memory.md`](../road-to-engineering-memory.md).
- **No** trust scoring semantics — decay lives in
  [`road-to-decay-calibration.md`](road-to-decay-calibration.md).

## Contract v1

### Request

```python
retrieve(
    types: list[str],        # one or more memory type names
    keys:  dict[str, any],   # scope filters: path, domain, role, tag
    limit: int = 20,         # hard cap across all types combined
    timeout_ms: int = 2000,  # total budget
) -> RetrieveResponse
```

`types` values are drawn from the six curated types plus whatever the
operational store offers. Unknown types MUST return `status:
unknown_type` for that slice, not fail the whole call.

### Response

```json
{
  "contract_version": 1,
  "status": "ok" | "partial" | "error",
  "entries": [
    {
      "id": "01H...",
      "type": "historical-patterns",
      "source": "repo" | "operational",
      "confidence": 0.82,
      "trust": 0.74,
      "body": { "...": "type-specific payload" },
      "last_validated": "2026-04-21T00:00:00Z",
      "shadowed_by": null | "repo:<id>"
    }
  ],
  "slices": {
    "historical-patterns": { "status": "ok", "count": 4 },
    "ownership":          { "status": "timeout", "count": 0 }
  },
  "errors": [
    { "type": "ownership", "code": "timeout", "message": "..." }
  ]
}
```

Mandatory fields on every entry: `id`, `type`, `source`, `confidence`,
`body`. Optional: `trust` (only in `present` mode), `last_validated`,
`shadowed_by` (set when an operational entry conflicts with a repo
entry — see [`../road-to-memory-self-consumption.md`](../road-to-memory-self-consumption.md#conflict-rule-repo-vs-operational)).

### Partial-hit semantics

- Per-slice status in `slices[type]`. Caller can see which types
  answered and which did not.
- `status: partial` on the envelope ⇔ at least one slice failed
  **and** at least one slice returned entries.
- `status: ok` ⇔ every requested slice returned `ok`.
- `status: error` ⇔ every slice failed. Entries is empty.

Callers MUST handle `partial` without raising. Treating `partial` as
fatal defeats the fallback design.

### Timeouts

Total budget is `timeout_ms`. Slices run concurrently. A slice that
exceeds its fair share is cancelled and reported with
`code: "timeout"`. The envelope returns within `timeout_ms + 100 ms`
wall clock — hard ceiling.

### Error codes

| Code | Meaning |
|---|---|
| `ok` | Slice returned |
| `timeout` | Slice exceeded its budget |
| `unknown_type` | Backend does not support the requested type |
| `misconfigured` | Backend is present but cannot serve this slice (e.g., missing table) |
| `internal` | Unclassified backend error — caller treats as fallback-worthy |

### Version negotiation

- Every response carries `contract_version`. Caller reads it, compares
  against its own pinned major.
- Major bump ⇔ breaking change to field names or semantics. Minor bump
  ⇔ additive field, defaults preserve v1 behaviour.
- A caller pinned to v1 that receives v2 MAY continue if it can ignore
  unknown fields; MUST NOT guess semantics of renamed fields.

## Health contract

Separate from `retrieve`. Documented here because both sides call it.

```python
health(timeout_ms: int = 2000) -> {
    "contract_version": 1,
    "status": "ok" | "degraded" | "error",
    "backend_version": "1.4.2",
    "features": ["trust-scoring", "decay", "cross-project-feed"]
}
```

`status: degraded` is the `misconfigured` surface from
[`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md#detection-helper)
— caller falls back but logs once per session.

## Evolution rules

- **Additive fields only in minor versions.** New optional fields land
  at minor bump; defaults preserve old behaviour.
- **Breaking changes go through a deprecation window.** One minor
  version announces it, the next major removes it.
- **The contract lives in this file.** `agent-memory` copies it into
  its own repo as the implementation reference; drift = bug.
- **Fixtures are shared.** `agent-config` ships golden-fixture JSON
  files under `tests/fixtures/retrieval/` that both repos test against.

## Implementation tracking

This spec file is the **canonical contract**. Concrete implementation
work is split across two repos and tracked in separate roadmaps so
neither side's dashboard is polluted with the other's open items.

### Consumer deliverables (`agent-config` side)

Shipped 2026-04-23 — archived as
[`../archive/road-to-retrieval-contract-consumer.md`](../archive/road-to-retrieval-contract-consumer.md):

- Spec accepted as canonical contract (this file marked `accepted`).
- JSON schema published under
  [`/schemas/retrieval-v1.schema.json`](../../../schemas/retrieval-v1.schema.json).
- Golden fixtures committed under
  [`/tests/fixtures/retrieval/`](../../../tests/fixtures/retrieval/).
- `scripts/memory_status.py` exposes `health()` returning a v1 envelope.
- `scripts/memory_lookup.py` exposes `retrieve_v1()` and CLI
  `--envelope v1` speaking v1.
- Conformance harness (21 tests) under
  [`/tests/conformance/retrieval/`](../../../tests/conformance/retrieval/)
  validates any backend against the fixtures with zero
  `agent-memory` runtime dependency.

### Downstream deliverables (`agent-memory` repo)

Tracked in the `agent-memory` repo's own roadmap once the spec is
accepted here:

- `agent-memory` repo adopts this spec as an issue/roadmap.
- MCP + CLI + library surfaces all return v1 envelopes.
- Conformance tests pass against the fixtures shipped from
  `agent-config`.

## Acceptance criteria

- **Consumer side ships** when: schema validates the fixture set,
  GPT review confirms every ambiguity from the initial review is
  resolved, and file-backed retrieval passes the conformance
  harness with zero `agent-memory` dependency.
- **Downstream side ships** when: both backends (file-backed,
  operational) return byte-identical responses for the same fixture
  input where the operational side has no extra entries — proves
  the shape is truly identical across modes.

## Open questions

- **`shadowed_by` computation** — is shadowing resolved by the caller
  or the backend? Leaning **backend**: the operational store already
  knows which repo entries exist (it indexes them). Caller gets a clean
  merged view.
- **Concurrent `retrieve` calls** — do slices share a connection pool?
  Out of scope for v1; per-backend concern.
- **Streaming responses** — not in v1. Defer until a consumer hits the
  limit budget at 20 entries.

## See also

- [`../archive/road-to-retrieval-contract-consumer.md`](../archive/road-to-retrieval-contract-consumer.md) —
  agent-config consumer implementation (archived 2026-04-23)
- [`../road-to-agent-memory-integration.md`](../road-to-agent-memory-integration.md) —
  the caller side that depends on this contract
- [`../road-to-memory-self-consumption.md`](../road-to-memory-self-consumption.md) —
  conflict rule and shadow semantics referenced by `shadowed_by`
- [`../road-to-memory-merge-safety.md`](../road-to-memory-merge-safety.md) —
  on-disk format for the file-backed path
- [`road-to-consumer-integration-guide.md`](road-to-consumer-integration-guide.md) —
  how consumers install both sides
