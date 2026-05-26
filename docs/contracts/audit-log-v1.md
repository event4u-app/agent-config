---
stability: beta
keep-beta-until: 2026-08-12
---

# Audit-log v1

**Purpose.** Pin the append-only schema that the audit-as-memory
pipeline writes per `/work` and `/implement-ticket` run, so the
pattern-extraction script ([`extract_audit_patterns.py`](../../scripts/extract_audit_patterns.py))
and the `learning-to-rule-or-skill` skill can mine repeated successful
patterns without re-reading conversation bodies.

**Scope.** Defines the JSONL line shape, file location, redaction
floor, append-only invariant, and the producer/consumer contract.
Does **not** define how patterns are scored or how proposals are
promoted — that is the consumer's responsibility (see Cross-references).

Last refreshed: 2026-05-11.

## Producer / consumer split

| Side | Responsibility | Where |
|---|---|---|
| **Producer** | One JSONL line per phase end, derived from the phase's [`decision-trace-v1.md`](decision-trace-v1.md) JSON and the [`memory-visibility-v1.md`](memory-visibility-v1.md) counts. | `work_engine` hook on phase boundary. |
| **Consumer** | Pattern mining + human review gate. Never edits a written line; corrections are new lines with `type=supersede`. | [`extract_audit_patterns.py`](../../scripts/extract_audit_patterns.py). |

## File location

```
agents/runtime/state/audit/<YYYY-MM>.jsonl
```

One file per UTC month. Files are append-only — `merge=union` via
`.gitattributes` (same mechanism as the archived
`agents/memory/intake/*.jsonl` recipe). Files MAY be gitignored in
consumer projects; the contract does not require commit.

## Line shape

One JSON object per line, UTF-8, no trailing whitespace:

```json
{"schema_version":1,"id":"01HXY...","ts":"2026-05-11T12:34:56Z","work_id":"PROJ-123-2026-05-11T12-30-00Z","phase":"verify","outcome":"success","confidence_band":"high","risk_class":"low","memory":{"asks":3,"hits":2},"verify":{"claims":1,"first_try_passes":1},"rules_applied":["verify-before-complete","commit-policy"],"persona":"backend","input_kind":"ticket","type":"phase"}
```

Single-line. The pretty-printed reference shape:

```json
{
  "schema_version": 1,
  "id": "01HXY7K9...",
  "ts": "2026-05-11T12:34:56Z",
  "work_id": "PROJ-123-2026-05-11T12-30-00Z",
  "phase": "verify",
  "outcome": "success",
  "confidence_band": "high",
  "risk_class": "low",
  "memory": { "asks": 3, "hits": 2 },
  "verify": { "claims": 1, "first_try_passes": 1 },
  "rules_applied": ["verify-before-complete", "commit-policy"],
  "persona": "backend",
  "input_kind": "ticket",
  "type": "phase"
}
```

## Field semantics

| Field | Type | Meaning |
|---|---|---|
| `schema_version` | int | Always `1` for this contract. Major bump on breaking changes. |
| `id` | string | ULID or content hash. Stable, deduplicated by the **reader**, never by in-place edit. |
| `ts` | string | ISO-8601 UTC timestamp of phase end. |
| `work_id` | string | Matches the `WorkState` directory id from [`decision-trace-v1.md`](decision-trace-v1.md). Allows cross-trace correlation. |
| `phase` | enum | One of `refine` · `memory` · `analyze` · `plan` · `implement` · `test` · `verify` · `report`. |
| `outcome` | enum | One of `success` · `blocked` · `skipped` · `error`. Mirrors `Outcome` from `work_engine.directives`. |
| `confidence_band` | enum | One of `low` · `medium` · `high`. Sourced from decision-trace. |
| `risk_class` | enum | One of `low` · `medium` · `high`. Inherits max risk from touched files. |
| `memory.asks` / `memory.hits` | int | Counts only — never ids, never bodies. |
| `verify.claims` / `verify.first_try_passes` | int | Verify-gate counts. |
| `rules_applied` | string[] | Stable rule ids whose Iron Law fired this phase. Bounded to ≤ 32; remainder dropped silently. |
| `persona` | string \| null | Resolved `roles.active_role` from `.agent-settings.yml` at phase start. |
| `input_kind` | enum | One of `prompt` · `ticket` · `orchestration`. Matches `WorkState.input.kind`. |
| `type` | enum | One of `phase` · `supersede` · `note`. `supersede` carries an extra `supersedes` field with the prior `id`. |

Unknown trailing fields are forward-compat extensions; readers MUST
NOT raise on them.

## Privacy floor

Lines MUST NOT contain:

- Conversation **bodies**, summaries, prompts, or quoted snippets.
- Memory entry bodies, ids, or content. Only **counts** travel here —
  ids stay in `decision-trace-*.json` per [`memory-visibility-v1.md`](memory-visibility-v1.md).
- Secrets, tokens, environment values, file contents.
- Paths outside the package's `agents/runtime/state/` and `tests/` allowlist.

The floor is enforced by
`tests/contracts/test_audit_log_redaction.py` — any new producer-side
edit that touches this schema adds a fixture there.

## Append-only invariant

- New entries append. Existing lines are **immutable**.
- A correction is a **new** entry with `type=supersede` and a
  `supersedes` field carrying the prior `id`. The reader applies the
  chain.
- Deletion is forbidden at the producer layer. Operators rotate
  monthly files; archived months MAY be purged out-of-band by the
  consumer project's retention policy.

## Cadence

One line per phase end. The producer hook fires on the same
`post_tool_use` / `stop` boundary that emits the visibility line
([`memory-visibility-v1.md`](memory-visibility-v1.md) § Cadence).

Cost-profile interaction:

| Cost profile | Line emission |
|---|---|
| `lean` | suppress unless `outcome != success` OR `risk_class >= medium` |
| `standard` | always |
| `verbose` | always |

## Stability

Beta. Breaking changes between v1 and v2 are allowed in a minor
release if the change appears in `CHANGELOG.md` under a `### Breaking`
heading. Consumers MUST gate on `schema_version` and refuse unknown
majors.

## Cross-references

- Input feed (counts + ids): [`memory-visibility-v1.md`](memory-visibility-v1.md).
- Per-phase JSON the producer reads: [`decision-trace-v1.md`](decision-trace-v1.md).
- Pattern-extraction consumer: [`extract_audit_patterns.py`](../../scripts/extract_audit_patterns.py).
- Skill that consumes promoted patterns:
  [`learning-to-rule-or-skill`](../../.agent-src.uncondensed/skills/learning-to-rule-or-skill/SKILL.md).
- Append-only JSONL precedent:
  [`adr-chat-history-split.md`](adr-chat-history-split.md).
