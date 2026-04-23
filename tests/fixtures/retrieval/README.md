# Golden fixtures — retrieval contract v1

Canonical response shapes both repos (`agent-config` and `agent-memory`)
test against. The conformance harness under
[`../../conformance/retrieval/`](../../conformance/retrieval/) validates
each fixture against
[`/schemas/retrieval-v1.schema.json`](../../../schemas/retrieval-v1.schema.json).

## Fixture coverage

| File | Status | Purpose |
|---|---|---|
| `01-empty.json` | `ok` | No entries, all slices returned empty. Caller MUST handle gracefully. |
| `02-single-type-hit.json` | `ok` | Single memory type, single repo entry. Minimum viable hit. |
| `03-multi-type-partial.json` | `partial` | Two slices, one timed out. Demonstrates partial semantics. |
| `04-error-all-slices.json` | `error` | Every slice failed. `entries` is empty. |
| `05-shadowed-by.json` | `ok` | Operational entry suppressed by a repo entry. `shadowed_by` populated. |
| `06-health-ok.json` | (health) | `health()` envelope — `contract_version` + feature flags. |

## Adding a fixture

1. Copy an existing fixture that is closest to the new shape.
2. Adjust fields to demonstrate exactly one new concept — not a kitchen sink.
3. Run `python3 -m pytest tests/conformance/retrieval/` — must pass.
4. Reference the fixture from the spec
   ([`/agents/roadmaps/agent-memory/road-to-retrieval-contract.md`](../../../agents/roadmaps/agent-memory/road-to-retrieval-contract.md))
   when it demonstrates a resolved open question.

## Invariants

- Every fixture is a complete, standalone envelope — no merging needed.
- Timestamps use `Z` suffix (UTC) to keep byte-identical diffs across machines.
- `id` values are stable strings; do not regenerate them between runs.
