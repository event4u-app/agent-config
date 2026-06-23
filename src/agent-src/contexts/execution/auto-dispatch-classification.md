# Auto-Dispatch Classification (v1 — deterministic)

Decides whether a task is **delegable** to subagents, and to which
`subagent-orchestration` mode. v1 is **rule-based and deterministic** — no
per-turn LLM meta-call. Classification is the control plane for auto-dispatch;
keeping it cheap and predictable is the point.

## The Iron Law — ambiguity never spawns

```
A TASK IS DELEGABLE ONLY ON AN ENUMERATED SIGNAL BELOW.
AMBIGUITY DEFAULTS TO ask / no-op — NEVER SPECULATIVE SPAWN.
NO PER-TURN LLM CLASSIFICATION CALL IN v1.
```

## Delegable signals (v1)

A task is classified **delegable** when **any** of these holds:

1. **Declared parallel** — the skill/command in play carries
   `parallelizable: steps | files | independent` in its frontmatter.
   - `steps` → ordered plan → `do-in-steps`.
   - `files` / `independent` → independent slices → `do-in-parallel`.
2. **Ordered-plan structure** — the task is an explicit ordered plan (numbered
   steps / a roadmap phase / a checklist) → `do-in-steps`.
3. **Independent-slices structure** — N independent targets of the same shape
   (e.g. "review these 5 files", "convert each adapter") → `do-in-parallel`.

AND the **task-size floor** is cleared: the task's estimated size exceeds a
minimum (trivial one-line edits never delegate — the dispatch overhead
dwarfs the work). Below the floor → in-session.

## Not delegable (in-session)

- Trivial / single-step edits below the size floor.
- Tasks with cross-step shared mutable state that cannot be sliced.
- Anything that fails to match a signal above → **no-op** (in-session),
  or **ask** when `subagents.auto == ask` and the shape is borderline.

## Mode selection summary

| Signal | Mode |
|---|---|
| `parallelizable: steps` / ordered plan | `do-in-steps` |
| `parallelizable: files\|independent` / independent slices | `do-in-parallel` |
| change needing verification (any of the above) | implementer + cross-model judge per the `subagent-orchestration` Iron Law |

## v2+ (deferred, gated on Phase 6 evidence)

LLM-based classification — only if the deterministic rules prove too coarse
**and** the Phase-6 benchmark justifies the meta-call cost. It must be
budgeted (consume part of the N=3 autonomous budget) and opt-in. Not in v1.

## Reference implementation

The deterministic rules are encoded in
[`src/scripts/_lib/auto_dispatch.ts`](../../../../src/scripts/_lib/auto_dispatch.ts)
(`classifyTask`), covered by
[`tests/scripts/_lib_auto_dispatch.test.ts`](../../../../tests/scripts/_lib_auto_dispatch.test.ts).

## Related

- [`auto-orchestration-activation`](auto-orchestration-activation.md) — the enable/auto/manifest gate that runs before classification.
- [`subagent-orchestration`](../../skills/subagent-orchestration/SKILL.md) — the modes this selects.
- [`autonomous-execution`](../../rules/autonomous-execution.md) — the N=3 budget any LLM-classification v2 must respect.
