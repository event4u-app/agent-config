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
2. **Ordered-plan structure** — explicit ordered plan (numbered steps / a roadmap
   phase / a checklist) → `do-in-steps`. Deterministic markers:
   - `1. … 2. … 3.` numbered list in the user message.
   - References a roadmap phase or checklist.
   - "first … then … finally" with distinct deliverables.
   - "in N steps" or "phase by phase".
3. **Independent-slices structure** — N ≥ 3 independent targets of the same shape
   → `do-in-parallel`. Deterministic markers (N ≥ 3 of the same form):
   - N file paths, each a separate analysis/edit target.
   - N named modules/components for the same action.
   - N named test files, adapters, endpoints, or services to convert/review/audit.
   - "for each X in [list]" where list ≥ 3 items, no cross-item dependency.
   Do **not** fire on interdependent lists (e.g. "add these 3 sequential
   migrations") — those are ordered plans (signal 2).

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

## Per-slice tier inference (v1.5 — deterministic, task-TYPE-keyed)

Once a slice is classified **delegable**, a second deterministic table infers
its `model_tier` (road-to-cost-aware-model-routing, council 2026-07-08).
Keyed **exclusively on the classifier's task-TYPE outputs** — never raw size
metrics; diff size anti-correlates with difficulty in refactoring domains.

```
UNKNOWN / AMBIGUOUS → inherit (SESSION TIER). NEVER GUESS DOWN.
SIZE SIGNALS ARE NEGATIVE GUARDS ONLY — THEY REVOKE A lite CANDIDACY,
THEY NEVER CREATE ONE.
```

| Slice type (classifier output) | Inferred tier |
|---|---|
| Delegable + read-only fan-out (grep / inventory / discovery targets) | `lite` |
| Delegable + mechanical / template-driven transform WITH test coverage | `lite` (verify-fail escalates to `medium` per the steering cascade) |
| Delegable + mutating WITHOUT test coverage | `medium` |
| Delegable + synthesis / judgment (review, analysis slice) | `medium` — judge one tier up per the orchestration Iron Law |
| Any other / ambiguous shape | `inherit` — session tier, no downshift |

**Negative size guard:** slice scope exceeding the mechanical envelope
(multi-file mutation, diff surface beyond single responsibility) loses `lite`
candidacy, resolves one row down — size never argues FOR a downshift, only
against one.

Every inferred decision records `tier_source: "inferred"` in orchestration
telemetry (static pins record `"static"`; session-tier runs `"inherit"`) so
the evidence gate scores inferred routing separately from static pinning.

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
