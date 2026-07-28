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
  "knowledge_refs": ["<id-or-path>", "..."],
  "max_tokens_per_worker": 15000
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

## Per-worker token stop-loss (L0b) — hard budget, structured escalation

```
EVERY DISPATCHED WORKER CARRIES A max_tokens_per_worker BUDGET FOR ITS TIER.
ON HIT: RETURN A STRUCTURED PARTIAL RESULT + ESCALATION FLAG — STOP EXPLORING.
A WORKER OVERRUNNING ITS BUDGET 20× IS A DISPATCH ERROR ON THE WRONG RUNG,
NOT DILIGENCE.
```

Budgets keyed by the worker's resolved tier
(`worker_budget.budgetForTier`; start values `lite: 15k` — the lookup-class
seed — `medium: 60k`, `high: 150k`, refined from `budget_hit` telemetry, never
final). On hit the worker returns a `BLOCKED` envelope whose body is the
partial-result shape from the
[response contract](subagent-response-contract.md#budget-hit-partial-result):
what was found (refs), what remains, suggested next rung. The stop-loss
**composes** with the N=3 validation budget
([`autonomous-execution`](../../rules/autonomous-execution.md)) and the
ADR-109 response contract — replaces nothing. Live evidence (2026-07-28):
four lookup-class workers burned 280–327k tokens each on tasks a
deterministic primitive answers for <1k.

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
(`resolveBundle`, `filterKnowledgeByPolicy`, `bundleAuditLine`) +
[`src/scripts/_lib/worker_budget.ts`](../../../../src/scripts/_lib/worker_budget.ts)
(`budgetForTier`, `evaluateWorkerBudget`, `validateWorkerPartialResult`),
covered by
[`tests/scripts/_lib_subagent_spawn.test.ts`](../../../../tests/scripts/_lib_subagent_spawn.test.ts)
+ [`tests/scripts/_lib_subagent_bundle.test.ts`](../../../../tests/scripts/_lib_subagent_bundle.test.ts)
+ [`tests/scripts/_lib_worker_budget.test.ts`](../../../../tests/scripts/_lib_worker_budget.test.ts)
(the budget-hit partial-result fixture).

## Worker rtk allowlist — wrap only the measured class

Worker tool loops wrap a command with rtk **only** when that command class
measured ≥ ~50% output saving in `internal/bench/rtk-savings/RESULTS.md`
(`git status`, full-format `git log -N`, `ls -la`); the ~0%-class
(`--oneline`, `--stat` views, `npm ls`) stays unwrapped — wrap overhead
without return. Deterministic list: `src/scripts/_lib/rtk_allowlist.ts`
(`shouldWrapWithRtk`); congruence with RESULTS.md is test-enforced
(`tests/scripts/_lib_rtk_allowlist.test.ts`) — numbers live in the bench
file, referenced, never duplicated.

## Prefix stability — deterministic payload ordering

Spawn payloads serialize **static prefix first** (role contract, profile,
personas, budget — byte-identical across dispatches of the same
configuration), **variable task part last**; no timestamps, no random IDs
(`serializeSpawnPayload` / `spawnPayloadHash`). Provider prompt-caching keys
on the stable prefix; `payload_hash` + `cache_hit` audit fields
([`orchestration-telemetry`](orchestration-telemetry.md)) measure whether it
actually hits. Measurement only — no savings claim without provider-response
evidence.

## Worker-prompt rules — verbatim at spawn

Relocated from the `subagent-orchestration` skill body (road-to-feedback-9.2.0
Phase 2, size-budget split). Every dispatched worker prompt obeys these rules —
they prevent the two classic handoff failures: lossy re-summarization dropping
the user's requirements, and over-scripted prompts that break on first
contingency.

- **(a) User constraints verbatim.** Pass the user's
  constraints/exclusions/preferences into the worker prompt **verbatim** — never
  a paraphrase (a paraphrase silently drops requirements).
- **(b) Describe the goal, don't script the approach.** State the outcome and
  let the worker choose the path; over-scripting breaks on contingencies.
- **(c) Translate environment paths.** Orchestrator-local paths do not exist in
  the worker's sandbox — resolve/translate them at spawn.
- **(d) Pre-declared check-in conditions.** The worker names, at spawn time, the
  conditions under which it will halt and ask ("if login required", "if
  multiple candidates found") — so interrupts are predictable, not surprises.
- **(e) Attach relevant knowledge — read-only (road-to-opt-subagent-harvest
  P3).** Before dispatch, look up the slice's key identifiers via
  `memory_lookup` / the knowledge cards and attach the top hits to the
  worker prompt AS LEADS — labelled per the source-discovery discipline
  (negative facts + pointers durable; positive structure = hypothesis to
  re-confirm, never a build input). The WRITE half stays forbidden: a
  subagent's output is never auto-persisted into memory — promotion is
  always the human-gated flow (ADR-098 floor). Auto-surface, never
  auto-write.

## Hand-off worked examples — step N output feeds step N+1

Relocated from the `subagent-orchestration` skill (ecosystem-harvest ergonomics
U4, size-budget split). Ordered modes (`do-in-steps`) pass each step's return
as the next step's context; the failure this prevents is re-deriving state the
previous step established, or dropping a decision it made.

**Ordered chain (do-in-steps).** Step 1 returns a structured result; step 2's
worker prompt embeds it verbatim as "context from step 1", never a paraphrase:

```
Step 1 (analyze) → returns: { entrypoints: [...], risk_notes: "..." }
Step 2 (implement) worker prompt:
  "Context from step 1 (verbatim, do not re-derive):
     entrypoints = [...]; risk_notes = '...'
   Your task: <goal>. Use the entrypoints above; do not re-scan."
Step 3 (verify) worker prompt:
  "Context: step 2 changed <files>. Assert <invariant>."
```

**Fan-out → synthesis (do-in-parallel + a synthesis step).** Each parallel
worker returns one envelope; the synthesis step receives ALL of them as an
ordered list and is told what to reconcile ("merge the N findings; a finding
present in ≥2 returns is high-confidence"). The synthesis prompt names the
cross-item comparison — it does not just concatenate.

The rule both encode: **the receiving prompt embeds the prior return verbatim
and states what to do with it** — the same verbatim-first discipline as the
worker-prompt rules above, applied across a step boundary.

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — runs before this; decides IF a subagent spawns.
- [`subagent-routing`](subagent-routing.md) — decides WHICH model the subagent runs on.
- [`role-mode-adherence`](../../rules/role-mode-adherence.md) — the role contract a spawned `role_mode` must honour.
