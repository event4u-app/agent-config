# Verification Budget (Phase 4)

How auto-delegated work is verified without double-costing every trivial
delegation. Preserves `verify-before-complete` and the cross-model judge Iron
Law of [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md),
while letting trivial sub-tasks skip a full LLM judge pass.

## The budget

```
TRIVIAL (below the change-size floor, read-only / no file writes)
  → DETERMINISTIC verification: diff + dry-run + structural checks. No LLM judge.
OTHERWISE
  → FULL CROSS-MODEL JUDGE (judge on a different model than the implementer).
A REQUIRED VERIFICATION THAT DID NOT RUN IS A SURFACED SAFETY GAP — NEVER A
SILENT PASS.
```

The change-size floor (`TRIVIAL_CHANGE_FLOOR`) is the line at which the cost of
a judge pass exceeds its benefit. Read-only sub-tasks (queries, analysis with no
mutation) always verify deterministically — there is nothing to mis-write.

## Recording + the gap check

Every dispatch records its `verify_mode` (`deterministic` | `judge` | `none`)
in the [`orchestration-telemetry`](orchestration-telemetry.md) object on the
audit-log line. After a dispatch, the orchestrator compares the **required**
mode (from the change shape) against the **recorded** mode; a required
verification recorded as `none`, or a non-trivial change verified only
deterministically, is a **gap** that is surfaced to the user — it never passes
silently. This is the audit-visible enforcement of the Iron Law.

## Why this does not weaken the floor

`deterministic` is still verification — a real diff + dry-run + structural
check, not "skip it". The judge Iron Law still fires on every non-trivial,
mutating change. The budget only removes a redundant LLM pass on changes too
small to carry risk, where the deterministic check is sufficient evidence.

## Reference implementation

[`src/scripts/_lib/verify_budget.ts`](../../../../src/scripts/_lib/verify_budget.ts)
(`selectVerifyMode`, `verificationGap`), covered by
[`tests/scripts/_lib_verify_budget.test.ts`](../../../../tests/scripts/_lib_verify_budget.test.ts).

## Related

- [`verify-before-complete`](../../rules/verify-before-complete.md) — the Iron Law this preserves.
- [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md) — the cross-model judge law.
- [`orchestration-telemetry`](orchestration-telemetry.md) — where `verify_mode` is recorded.
- [`subagent-response-contract`](subagent-response-contract.md) — a low-confidence mutating finding forces the full judge path (`forcesJudge`).
