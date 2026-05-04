---
stability: beta
---

# Decision-trace v1

**Purpose.** Pin the JSON shape that `/implement-ticket` and `/work`
runs emit when the user opts into trace surfacing. The trace is the
audit substrate for the rule-interaction matrix
([`rule-interactions.md`](rule-interactions.md)) and feeds the
showcase-session capture pipeline
([`outcome-baseline.md`](../../agents/contexts/outcome-baseline.md)).

**Scope.** Defines the JSON envelope written next to a `WorkState`
file when `decision_engine.surface_traces: true`. Does **not**
specify how individual rules detect their own activation — that is
the rule's own responsibility — only the shape of the report.

Last refreshed: 2026-05-04.

## Opt-in

Off by default. Toggled in `.agent-settings.yml`:

```yaml
decision_engine:
  surface_traces: true
```

The `/work` and `/implement-ticket` engines check this flag at phase
boundaries and emit one trace file per phase when set.

## File location

```
agents/state/work/<work-id>/decision-trace-<phase>.json
```

`work-id` matches the `WorkState` directory; `phase` is one of
`refine`, `memory`, `analyze`, `plan`, `implement`, `test`, `verify`,
`report`. Files are gitignored.

## Envelope shape

```json
{
  "schema_version": 1,
  "work_id": "ABCD-1234-2026-05-04T12-34-56Z",
  "phase": "implement",
  "started_at": "2026-05-04T12:35:01Z",
  "ended_at": "2026-05-04T12:38:42Z",
  "confidence_band": "high",
  "risk_class": "low",
  "rules": [
    {
      "rule_id": "verify-before-complete",
      "applied": true,
      "skipped": false,
      "conflicted_with": [],
      "evidence_refs": ["agents/state/work/.../verify.log"]
    }
  ],
  "memory": {
    "asks": 3,
    "hits": 2,
    "ids": ["mem_42", "mem_57"]
  },
  "verify": {
    "claims": 1,
    "first_try_passes": 1
  }
}
```

Concerns and engines MUST treat unknown top-level keys as forward-
compat extensions and MUST NOT raise on them.

## Field semantics

| Field | Meaning |
|---|---|
| `schema_version` | Always `1` for this contract. Major bump on breaking changes. |
| `work_id` | Stable id of the WorkState directory. Allows cross-trace correlation across phases. |
| `phase` | Engine phase that produced the trace. One of the eight phases above. |
| `confidence_band` | One of `low` / `medium` / `high`. Heuristic defined below — derived from memory hits + ambiguity flags + verify evidence count. |
| `risk_class` | One of `low` / `medium` / `high`. Per [`rule-interactions.md`](rule-interactions.md) — drives reviewer routing. |
| `rules[].rule_id` | Stable rule id, matches the filename under `.agent-src.uncompressed/rules/` minus `.md`. |
| `rules[].applied` | True if the rule's Iron Law fired and changed engine behaviour this phase. |
| `rules[].skipped` | True if the rule was checked but produced no effect (no trigger match). |
| `rules[].conflicted_with` | List of rule_ids that fired against this one. Reduction handled per `rule-interactions.md`. |
| `rules[].evidence_refs` | Optional list of paths under `agents/state/` or `tests/` that back the `applied` claim. |
| `memory.asks` | Count of `memory_retrieve` calls during the phase. |
| `memory.hits` | Count of calls that returned ≥ 1 result. |
| `memory.ids` | Stable memory entry ids returned. Bounded to ≤ 32 ids per phase; remainder dropped silently. |
| `verify.claims` | Count of "done"-class claims the engine attempted this phase. |
| `verify.first_try_passes` | Count of those claims that passed the verify gate without a re-prompt. |

## Confidence-band heuristic

```
high:    memory.hits ≥ 2  AND  verify.first_try_passes == verify.claims  AND  no ambiguity flag
medium:  memory.hits ≥ 1  OR   verify.first_try_passes ≥ 1
low:     otherwise
```

Edge case: `verify.claims == 0` is not "high" by default — it folds
into "medium" if at least one memory hit landed, "low" otherwise.

## Risk-class heuristic

Mirrors [`file-ownership-matrix.json`](file-ownership-matrix.json):
the trace inherits the **maximum** risk class across all files the
phase touched. If no files were touched (pure planning phase), risk
is `low`.

## Privacy floor

- `memory.ids` carries opaque ids only — no entry bodies, no secrets.
- `evidence_refs` carries paths only — no file contents.
- `rules[].rule_id` is stable id, not free-form text.

The visibility line surfaced to the user (Phase 4) consumes this file
under the same floor.

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Engines MUST gate on `schema_version` and refuse unknown
majors.

## Cross-references

- Personas (Architect, Risk-Officer) live in the package's persona
  library under [`.agent-src.uncompressed/personas/`](../../.agent-src.uncompressed/personas/).
  This contract does not duplicate them — when a future trace consumer
  attributes a decision to one of those personas, the persona file is
  the source of truth, not this envelope.
- Rule-interaction matrix:
  [`rule-interactions.md`](rule-interactions.md) (machine-readable
  source: [`rule-interactions.yml`](rule-interactions.yml)).
- Confidence-band heuristic is implemented in
  `work_engine/scoring/decision_trace.py` and exercised by
  `tests/work_engine/scoring/test_decision_trace_scoring.py`.
- Outcome metrics consume `verify.first_try_passes`:
  [`outcome-baseline.md`](../../agents/contexts/outcome-baseline.md).
