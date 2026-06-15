---
stability: beta
keep-beta-until: 2026-08-12
---

# Memory-visibility v1

**Purpose.** Pin the format of the user-facing visibility line that
every memory-using `/work` and `/implement-ticket` run prints, so the
user can tell what the agent retrieved and what it ignored. This doc
describes the **operator-facing surface** the engine emits per turn.

**Scope.** Defines the line shape, the privacy floor, and the opt-out
toggle. Does **not** define how memory entries are scored or routed —
that is the sibling agent-memory package.

Last refreshed: 2026-05-04.

## Line shape

A single one-line ASCII record, prefixed with the memory icon `🧠`
and a single space:

```
🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>]
🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>] · affected: <keys>
```

Examples:

```
🧠 Memory: 3/4 · ids=[mem_42, mem_57, mem_91]
🧠 Memory: 0/2 · ids=[]
🧠 Memory: 5/5 · ids=[mem_a01, mem_a02, mem_a03, …+2]
🧠 Memory: 3/4 · ids=[mem_42, mem_57] · affected: confidence_band,applied_rules
🧠 Memory: 2/4 · ids=[mem_42] · affected: none
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
| `affected` | Optional trailing segment. Comma-separated list of decision-trace keys that diverged when this memory was consulted vs not consulted. Closed key list defined in [`decision-trace-v1.md § Memory consequence keys`](decision-trace-v1.md#memory-consequence-keys). Rendered as `none` when `hits ≥ 1` but no key diverged. Omitted entirely when `hits == 0` or when the producer cannot compute a counterfactual trace. |

`hits ≤ asks` is invariant. If `asks == 0`, the engine MUST suppress
the line entirely — no `0/0` noise.

The `affected` segment is a forward-compat trailing extension per
the Stability clause below — clients pinned to the segment-free
shape MUST still parse the line.

## Privacy floor

The visibility line and the JSON it derives from MUST NOT contain:

- Entry **bodies**, summaries, or quoted snippets.
- Secrets, tokens, environment values, or paths outside the
  package's `agents/runtime/state/` and `tests/` allowlist.
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

## Cadence interaction

| `memory.cadence` | Visibility line |
|---|---|
| `auto` | suppress unless `asks ≥ 3` |
| `always` | always when `asks ≥ 1` |
| `never` | suppress entirely |

Cadence lookup respects `.agent-settings.yml`'s `memory.cadence` key.
Default is `always`. The legacy `memory.visibility: off` master switch
(above) still wins over any `memory.cadence` value.

> **History.** Before the 2026-06-01 `cost_profile` untangle this
> cadence was keyed off `cost_profile` with the values
> `lean | standard | verbose` — a collision with the rule-loading
> `cost_profile` (`minimal | balanced | full`) that made the `lean`
> branch unreachable on every real install. The cadence now owns its
> own `memory.cadence` key.

## End-of-run "Memory changed decisions" block

When the visibility line carries a non-empty `affected` segment, the
engine MUST also append a structured block at the end of the run's
report surface so reviewers can audit attribution without parsing
the inline segment:

```
Memory changed decisions:
- mem_42 → confidence_band
- mem_57 → confidence_band
```

Rules:

- Suppressed entirely when `affected` is empty or absent (no key
  diverged, or memory was not consulted).
- Each consulted id from the visibility line's `ids` is paired with
  each affected key. v1 attribution is aggregate; per-id attribution
  is a follow-up risk tracked in the roadmap Risk register.
- Block heading is the literal string `Memory changed decisions:`
  followed by `-` bullet lines in `<id> → <key>` shape.
- Implementation: `format_changed_decisions_block` in
  `work_engine/scoring/memory_visibility.py`.

## Audit-as-memory feed

The visibility output produced by the engine is the input to the
audit-as-memory pipeline (consumed by the sibling distribution +
adoption work). Concretely:

- The engine emits the line + the underlying counts to the
  decision-trace JSON.
- A consumer hook reads `agents/runtime/state/work/<work-id>/decision-trace-*.json`,
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

- Decision-trace JSON consumes the same counts:
  [`decision-trace-v1.md`](decision-trace-v1.md).
- Privacy regression test path:
  `tests/contracts/test_memory_visibility_redaction.py`.
