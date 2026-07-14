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

## Reference implementation

[`src/scripts/_lib/subagent_spawn.ts`](../../../../src/scripts/_lib/subagent_spawn.ts)
(`composeSpawnBrief`), covered by
[`tests/scripts/_lib_subagent_spawn.test.ts`](../../../../tests/scripts/_lib_subagent_spawn.test.ts).

## Worker-prompt rules — verbatim at spawn

Relocated from `subagent-orchestration` skill body (road-to-feedback-9.2.0 Phase 2,
size-budget split). Every dispatched worker prompt obeys these rules — prevent two
classic handoff failures: lossy re-summarization dropping user's requirements;
over-scripted prompts breaking on first contingency.

- **(a) User constraints verbatim.** Pass user's constraints/exclusions/preferences
  into worker prompt **verbatim** — never paraphrase (silently drops requirements).
- **(b) Describe goal, don't script approach.** State outcome; worker chooses path;
  over-scripting breaks on contingencies.
- **(c) Translate environment paths.** Orchestrator-local paths don't exist in the
  worker's sandbox — resolve/translate at spawn.
- **(d) Pre-declared check-in conditions.** Worker names, at spawn, conditions it
  halts and asks ("if login required", "if multiple candidates found") — interrupts
  predictable, not surprises.
- **(e) Attach relevant knowledge — read-only (road-to-opt-subagent-harvest P3).**
  Before dispatch, look up the slice's key identifiers via `memory_lookup` / the
  knowledge cards, attach top hits to the worker prompt AS LEADS — labelled per the
  source-discovery discipline (negative facts + pointers durable; positive structure
  = hypothesis to re-confirm, never a build input). WRITE half forbidden: a
  subagent's output is never auto-persisted into memory — promotion is always the
  human-gated flow (ADR-098 floor). Auto-surface, never auto-write.

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — runs before this; decides IF a subagent spawns.
- [`subagent-routing`](subagent-routing.md) — decides WHICH model the subagent runs on.
- [`role-mode-adherence`](../../rules/role-mode-adherence.md) — the role contract a spawned `role_mode` must honour.
