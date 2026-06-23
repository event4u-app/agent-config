# Subagent Spawn Contract (Phase 3 — task-optimal configuration)

How a delegated subagent is configured for its task. Composes the package's
existing config seams — role-mode + profile + persona + a **minimal** knowledge
slice — into a single spawn brief, so each subagent reacts optimally to its
task without re-inventing any taxonomy.

## The brief

```json
{
  "task": "<the sub-task>",
  "role_mode": "developer|reviewer|tester|po|incident|planner|null",
  "profile": "<active profile id or null>",
  "personas": ["<persona id>", "..."],
  "knowledge_refs": ["<id-or-path>", "..."]
}
```

## Selection — reuse existing seams, no new taxonomy

| Element | Source |
|---|---|
| `role_mode` | The six contracts in [`role-contracts`](../../../docs/guidelines/agent-infra/role-contracts.md). A review sub-task → `reviewer`; a planning sub-task → `planner`; default → null (no contract). |
| `profile` | The active profile (`profile.id` in `.agent-settings.yml`); inherited from the session unless the sub-task is a different domain. |
| `personas` | The persona ids already cited in the task's skill frontmatter (review lenses). Capped at 2 (`MAX_PERSONAS`). |
| `knowledge_refs` | A SMALL set of knowledge references (ingest ids / file paths) relevant to the sub-task. Capped at 5 (`MAX_KNOWLEDGE_REFS`). |

Nothing here defines a new role / persona / profile — it selects from what the
package already ships.

## Minimal-slice — hard invariant

```
KNOWLEDGE IS PASSED AS A FEW REFERENCES, NEVER AS INLINE BODIES.
NEVER BULK-DUMP CONTEXT INTO A SUBAGENT.
```

Per [`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md), the
private-data leg stays narrow: the composer rejects inline bodies (multi-line /
oversized entries), accepts only ref-like tokens, and caps the count. Anything
dropped is recorded in `warnings` and surfaced — never silently widened.

## Bundle resolver — bind to the existing surfaces

The brief is **resolved**, not hand-built. `resolveBundle(slice)` maps a task
slice to a concrete bundle by selecting from what the package already ships — no
parallel registry:

- **Role-profile via reused `judge-*` lenses** — a review slice → `judge-code-quality`,
  security → `judge-security-auditor`, tests → `judge-test-coverage`, bug-hunt →
  `judge-bug-hunter`. The lens rides as the leading persona so the subagent loads it.
- **Role-mode** per slice kind (review → `reviewer`, tests → `tester`, plan → `planner`, …).
- **Tier** per slice kind (`lite|medium|high`), consumed by `subagent-routing`.
- **Knowledge refs** filtered by the **ADR-100 guard** (`filterKnowledgeByPolicy`):
  a cross-project bundle drops `proprietary` refs; the drop is recorded.

Every resolved bundle emits an auditable `(role_mode, judge_lens, tier,
knowledge_ref_count, dropped_proprietary)` signature (`bundleAuditLine`) into the
[`orchestration-telemetry`](orchestration-telemetry.md) object — counts + ids
only, never bodies.

## Reference implementation

[`src/scripts/_lib/subagent_spawn.ts`](../../../../src/scripts/_lib/subagent_spawn.ts)
(`composeSpawnBrief`) + [`src/scripts/_lib/subagent_bundle.ts`](../../../../src/scripts/_lib/subagent_bundle.ts)
(`resolveBundle`, `filterKnowledgeByPolicy`, `bundleAuditLine`), covered by
[`tests/scripts/_lib_subagent_spawn.test.ts`](../../../../tests/scripts/_lib_subagent_spawn.test.ts)
+ [`tests/scripts/_lib_subagent_bundle.test.ts`](../../../../tests/scripts/_lib_subagent_bundle.test.ts).

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — runs before this; decides IF a subagent spawns.
- [`subagent-routing`](subagent-routing.md) — decides WHICH model the subagent runs on.
- [`role-mode-adherence`](../../rules/role-mode-adherence.md) — the role contract a spawned `role_mode` must honour.
