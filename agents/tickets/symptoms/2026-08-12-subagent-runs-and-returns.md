---
reported: 2026-08-12
reporter: colleague-of-maintainer
host: claude-code (version not stated by the reporter)
symptoms:
  - Frontend changes come out inconsistent
  - Subagent runs never end
  - A subagent finishes and signals completion, but its result never reaches the orchestrator
---

# Subagent runs that never end, and results that never arrive

Reported verbally, via chat, while using the suite in production. Three
recurring failures, listed by the reporter in their own order; the third was
described as the subagent being "done" and signalling so, while the orchestrator
never received anything it could act on.

Backfilled as the first intake entry. At the time it was reported there was
**nowhere in the tree for it to land** — the report existed only in a chat log
until it was turned into a roadmap, which is the gap
`road-to-symptom-driven-harvest-loop` exists to close.

## confirmed:

- **Defect:** no subagent lifecycle event is registered anywhere in the tree, so
  nothing observes a run starting or finishing — `docs/contracts/hook-architecture-v1.md:26`
  (event vocabulary, eight events, no `subagent_start` / `subagent_stop`)
- **Defect:** the envelope validator has zero runtime consumers — `src/scripts/_lib/subagent_response.ts:74`
- **Defect:** the worker stop-loss is prompt-carried only; both capsule triggers
  are shadow-only — `src/scripts/_lib/worker_budget.ts:27-31`, `src/scripts/_lib/capsule_trigger.ts:20`
- **Defect:** nothing guards the spawn itself — no depth cap, no concurrency cap,
  no open-dispatch ledger on `Agent` / `Task` — `src/scripts/hook_manifest.yaml:571`
- **Defect:** the refusal-capable stop gate has no view of pending async work —
  `src/scripts/hooks/turn_end_gate_hook.ts:355-361`
- **Pinned at:** `ed76d224` (claims), re-verified at `1432c7a45` (adoption)
- **Roadmap:** [`road-to-subagent-lifecycle-integrity`](../../roadmaps/road-to-subagent-lifecycle-integrity.md)

The first-listed symptom (inconsistent frontend changes) was reported again in
more detail the same day and is owned separately —
[`2026-08-12-frontend-built-from-screenshots.md`](2026-08-12-frontend-built-from-screenshots.md).

Two claims in the same investigation did **not** survive re-verification at
adoption, recorded here so the entry is not read as fully confirmed: the tier
router now has a production caller (`src/scripts/hooks/delegation_nudge_hook.ts:342`),
and the native event count was miscounted as six where the tree binds seven.
