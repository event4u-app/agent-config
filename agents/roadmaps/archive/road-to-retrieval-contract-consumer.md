# Roadmap: Retrieval-contract consumer implementation

> **agent-config side** of the cross-repo retrieval contract. The wire
> shape itself is specified in
> [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md)
> — this roadmap tracks what **this repo** must deliver so the spec
> is actually consumable: schema publication, golden fixtures, and
> the two consumer scripts that already exist as stubs.

- **Spec source:** [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md)
- **Matching external roadmap:** `agent-memory` repo adopts the same
  spec as its own implementation roadmap (tracked in
  [`agent-memory/road-to-retrieval-contract.md#downstream-deliverables`](agent-memory/road-to-retrieval-contract.md#downstream-deliverables))
- **Status:** Complete (2026-04-23) — schema published, fixtures
  committed, conformance harness (21 tests) green with zero
  `agent-memory` dependency. Split out of the spec file earlier
  on 2026-04-23 so the dashboard shows it as agent-config work,
  not external tracking.
- **Author:** Split per user request — "die Punkte, die für uns sind,
  sollten in einer eigenen roadmap für uns stehen"

## Guiding principle

**The contract is only real when agent-config consumes it against a
frozen schema and a committed fixture set.** A spec file that no
consumer script validates is a document, not an interface. This
roadmap makes the contract runnable from the agent-config side.

## Scope

**In scope (agent-config responsibilities):**

- Accepting the spec file at
  [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md)
  as canonical — any future change goes through a roadmap
  amendment, not a PR rider.
- Publishing the request/response shape as a machine-readable JSON
  schema inside this repo.
- Committing the golden fixture set both repos test against.
- Wiring the two existing stub scripts (`scripts/memory_status.py`,
  `scripts/memory_lookup.py`) to speak the frozen v1 shape.
- Building the conformance harness that validates any backend
  (file-backed, MCP, HTTP, library) against the shipped fixtures
  — zero `agent-memory` runtime dependency.

**Out of scope:**

- MCP/CLI/library surfaces that `agent-memory` exposes — tracked in
  the spec's downstream-deliverables section and implemented in
  the `agent-memory` repo.
- Trust scoring, decay, cross-project promotion — own roadmaps.
- Wire protocol choice (MCP vs HTTP vs library) — the contract is
  shape-only per the spec's non-goals.

## Prerequisites

- [x] Spec draft exists (`agent-memory/road-to-retrieval-contract.md`).
- [x] Open questions listed at the bottom of the spec file are
      resolved for v1 — `shadowed_by` leans backend (documented),
      concurrent `retrieve` calls are out of scope for v1,
      streaming responses are deferred until a consumer hits the
      20-entry limit budget.

## Phase 0 — freeze v1

Lock the shape so downstream work cannot regress the contract.

- [x] Spec file
      [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md)
      accepted as the canonical contract — marked `Status: accepted`
      at the top, amendment process documented.
- [x] JSON schema published under
      [`/schemas/retrieval-v1.schema.json`](../../schemas/retrieval-v1.schema.json)
      that validates the response envelope (`contract_version`,
      `status`, `entries[]`, `slices`, `errors`) and the health
      envelope.
- [x] Golden fixtures committed under
      [`/tests/fixtures/retrieval/`](../../tests/fixtures/retrieval/)
      — empty result (`01-empty.json`), single-type hit
      (`02-single-type-hit.json`), multi-type partial hit
      (`03-multi-type-partial.json`), all-slice error
      (`04-error-all-slices.json`), `shadowed_by` present
      (`05-shadowed-by.json`), plus a health envelope
      (`06-health-ok.json`).

## Phase 1 — consumer implementation

Make the two existing stub scripts speak v1, and prove any backend
can be validated without requiring `agent-memory` at runtime.

- [x] `scripts/memory_status.py` exposes `health(refresh=False) ->
      dict` returning a v1 envelope with `contract_version`,
      `status` (`ok | degraded | error`), `backend_version`, and
      `features`. CLI: `memory_status.py --health`.
- [x] `scripts/memory_lookup.py` exposes `retrieve_v1(types, keys,
      limit, operational_provider=None) -> dict` returning a v1
      envelope. Unknown types return `status: unknown_type` for
      their slice only; the envelope status is `ok | partial | error`
      according to slice outcomes. CLI: `memory_lookup.py --envelope v1`.
- [x] Conformance test harness under
      [`/tests/conformance/retrieval/`](../../tests/conformance/retrieval/)
      — pure-Python validator plus 21 tests covering fixtures,
      backend function calls, and CLI outputs. Zero
      `agent-memory` runtime dependency — runs on a fresh clone.

## Acceptance criteria

- [x] **Phase 0 ships** when: `schemas/retrieval-v1.schema.json`
      validates every fixture in `tests/fixtures/retrieval/`
      (`test_retrieve_fixture_passes_validation` +
      `test_health_fixture_passes_validation`, 6 parametrised
      cases), and the spec is marked accepted.
- [x] **Phase 1 ships** when: file-backed retrieval passes the
      conformance harness with zero `agent-memory` dependency
      (`tests/conformance/retrieval/test_backend.py`, 8 tests).
      Cross-backend parity (operational vs file-backed returning
      byte-identical envelopes for the same input where the
      operational side has no extras) is tracked in the
      spec's downstream-deliverables section — not this roadmap.

## Risks

- **Schema drift vs spec prose.** Mitigation: the schema is
  generated from the spec fixtures, not hand-written. A
  contradiction is a bug in either the spec or the fixture.
- **Fixture set too narrow.** Mitigation: every `status` and
  `source` combination gets at least one fixture before Phase 0
  closes.
- **Consumer scripts drift from the schema.** Mitigation: the
  conformance harness runs in CI against the shipped scripts.

## See also

- [`agent-memory/road-to-retrieval-contract.md`](agent-memory/road-to-retrieval-contract.md)
  — the authoritative spec
- [`../contexts/agent-memory-contract.md`](../contexts/agent-memory-contract.md)
  — how the contract is consumed from agent-config
- [`../../.agent-src.uncompressed/guidelines/agent-infra/memory-access.md`](../../.agent-src.uncompressed/guidelines/agent-infra/memory-access.md)
  — guideline that agents read before calling `retrieve()`
