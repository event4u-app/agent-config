---
stability: beta
keep-beta-until: 2026-08-12
---

# Audit-log v1

**Purpose.** Pin the append-only schema that the audit-as-memory
pipeline writes per `/work` and `/implement-ticket` run, so the
pattern-extraction script ([`extract_audit_patterns.py`](../../src/scripts/extract_audit_patterns.ts))
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
| **Consumer** | Pattern mining + human review gate. Never edits a written line; corrections are new lines with `type=supersede`. | [`extract_audit_patterns.py`](../../src/scripts/extract_audit_patterns.ts). |

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
{"schema_version":1,"id":"01HXY...","ts":"2026-05-11T12:34:56Z","work_id":"PROJ-123-2026-05-11T12-30-00Z","phase":"verify","outcome":"success","confidence_band":"high","risk_class":"low","memory":{"asks":3,"hits":2},"verify":{"claims":1,"first_try_passes":1},"rules_applied":["verify-before-complete","commit-policy"],"privacy_class":"ids-only","outcome_semantics":2,"skills_applied":["code-review"],"persona":"backend","input_kind":"ticket","type":"phase"}
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
  "privacy_class": "ids-only",
  "outcome_semantics": 2,
  "skills_applied": ["code-review"],
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
| `outcome` | enum | One of `success` · `blocked` · `skipped` · `error`. Defined by `PHASE_OUTCOMES` in `src/scripts/_lib/outcome_vocabularies.ts` and checked against this row by `tests/contracts/outcome_vocabularies.test.ts`. |
| `confidence_band` | enum | One of `low` · `medium` · `high`. Sourced from decision-trace. |
| `risk_class` | enum | One of `low` · `medium` · `high`. Inherits max risk from touched files. |
| `memory.asks` / `memory.hits` | int | Counts only — never ids, never bodies. |
| `verify.claims` / `verify.first_try_passes` | int | Verify-gate counts. |
| `rules_applied` | string[] | Stable rule ids whose Iron Law fired this phase. Bounded to ≤ 32; remainder dropped silently. |
| `outcome_semantics` | int (optional) | Which version of the `DispatchOutcome` → `outcome` mapping produced this line. `1` = unconditional (`DONE`/`DONE_WITH_CONCERNS` always `success`); `2` = contract-gated (a `code-change` dispatch claiming success with a **measured** empty diff does not resolve to `success`). **An ABSENT field means `1`** — every line written before 2026-08-30 predates the versioning and carries no marker. A reader aggregating across the cutover MUST segment on this field or normalize deliberately; inferring the semantics from a timestamp is not sufficient, because producers upgrade independently. Rationale: an enforcement gate rolls back, but a labelling change poisons historical analysis permanently, since lines here are append-only and cannot be rewritten. |
| `privacy_class` | enum | **Mandatory.** What this line declares about ITSELF: `counts-only` (counts, enums, timestamps, package-minted opaque ids) or `ids-only` (the former, plus stable artefact ids the package governs — rule ids, skill ids, task-class ids). Defined once in `src/scripts/_lib/privacy_class.ts`. A consumer deciding whether the stream is safe to aggregate, export or ship reads this field rather than re-deriving the answer from each producer's source. Both shipped producers emit `ids-only`, because both carry `rules_applied`. |
| `skills_applied` | string[] (optional) | Stable skill ids applied this phase — the skills counterpart of `rules_applied`, absent from v1 until 2026-08-30. Ids only, never bodies. Bounded to ≤ 32; remainder dropped silently. **ABSENT and `[]` are different observations and readers MUST NOT fold them together:** the key omitted means *not recorded* (the producer had no skill observation to offer), `[]` means *recorded, and none applied*. A reader that treats a missing key as "none" cannot distinguish no signal from a negative signal, which is precisely what a per-asset report needs `unknown` for. Additive under the forward-compat rule below; `schema_version` stays `1` and no supersede lines are required. |
| `persona` | string \| null | Resolved `roles.active_role` from `.agent-settings.yml` at phase start. |
| `input_kind` | enum | One of `prompt` · `ticket` · `orchestration`. Matches `WorkState.input.kind`. |
| `type` | enum | One of `phase` · `supersede` · `note`. `supersede` carries an extra `supersedes` field with the prior `id`. |

Unknown trailing fields are forward-compat extensions; readers MUST
NOT raise on them.

A line MAY carry an optional `orchestration` object when the run was
produced by the auto-dispatch orchestration layer. It is additive and
non-breaking — `schema_version` is unchanged, no existing field is
removed or renamed, and readers that do not understand it ignore it per
the forward-compat rule above. Its shape lives in
[`orchestration-telemetry.md`](../../src/agent-src/contexts/execution/orchestration-telemetry.md).

## Privacy floor

Lines MUST NOT contain:

- Conversation **bodies**, summaries, prompts, or quoted snippets.
- Memory entry bodies, ids, or content. Only **counts** travel here —
  ids stay in `decision-trace-*.json` per [`memory-visibility-v1.md`](memory-visibility-v1.md).
- Secrets, tokens, environment values, file contents.
- Paths outside the package's `agents/runtime/state/` and `tests/` allowlist.

**Enforcement — a compile-time guard on both producers, since 2026-08-30.**
The floor used to be prose. The file this paragraph named for months —
tests/contracts/test_audit_log_redaction.py, deliberately written WITHOUT
backticks so an existence check cannot read a dead name as a live claim —
exists in no tree this repository has, so the sentence asserted an enforcement
that was never there (found 2026-08-29, `road-to-experience-loop-broadening`
1.3; closed by its step 1.4).

What is enforced now, and by what: both producers' input types carry
`Assert<[NoFreeForm<T>] extends [never] ? false : true>`, where `NoFreeForm`
resolves to `never` for any type carrying a key from `FREE_FORM_KEYS`
(`src/scripts/_lib/runtime_journal.ts`) — `prompt`, `body`, `file_path`,
`stdout`, `reason`, `payload` and the rest of the set an author reaches for
when they want to stash content. Adding such a field to
`src/scripts/_lib/orchestration_record.ts`'s `RecordInput` or
`src/scripts/_lib/review_skipped_record.ts`'s `ReviewSkippedInput` is a BUILD
ERROR, not a lint warning. Both directions are checked: a negative fixture
carrying `@ts-expect-error` asserts the guard still REJECTS, so a `NoFreeForm`
broken into an identity type fails the build instead of passing everything.

Both were verified by sabotage rather than by inspection — adding a free-form
key produced `error TS2344` on each producer, and removing it returned the tree
to zero errors.

**Two limits, named rather than implied.** (1) `tsc -p tsconfig.json` does NOT
reach these files; that config covers `src/cli`, `src/server`, `src/shared` and
`src/install` only, and `src/scripts/**` is reached solely by
`tsconfig.scripts.json`. The command that checks this floor is `npm run
typecheck`, which runs both — a bare `tsc -p tsconfig.json` here is a gate that
scans nothing and exits green. (2) The guard binds the two shipped producers by
name. A THIRD producer added outside that shape is still caught by nothing, and
the honest claim remains "privacy by construction, on two paths, guarded at
compile time, unscanned elsewhere".

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
- Pattern-extraction consumer: [`extract_audit_patterns.py`](../../src/scripts/extract_audit_patterns.ts).
- Skill that consumes promoted patterns:
  [`learning-to-rule-or-skill`](../../.agent-src.uncondensed/skills/learning-to-rule-or-skill/SKILL.md).
- Append-only JSONL precedent:
  [`adr-chat-history-split.md`](adr-chat-history-split.md).
