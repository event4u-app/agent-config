# Confidence-band API audit — 2026-05-09

**Trigger:** P1.4a of `road-to-superpowers-harvest.md` (READY 2026-05-06).
**Outcome:** `confidence_band` is **defined** inside `work_engine/scoring/`
but **not exposed** as a queryable signal to rules. P1.4b kill-switch fires.

## Audit commands

```bash
grep -rn "confidence_band" scripts/                            # 0 hits
grep -rn "confidence_band" .agent-src.uncompressed/rules/      # 0 hits
grep -rln "confidence_band" --include="*.py" --include="*.md"  # 16 paths
```

## Where it lives

| Path | Role |
|---|---|
| `.agent-src.uncompressed/templates/scripts/work_engine/scoring/decision_trace.py` | `derive_confidence_band()` — pure function, returns `low` / `medium` / `high` |
| `.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/decision_trace.py` | hook that emits `confidence_band` into a decision trace event |
| `.agent-src.uncompressed/templates/scripts/work_engine/directives/ui/audit.py` | UI directive consuming it inside the work engine |
| `docs/contracts/decision-trace-v1.md` | contract spec for the trace envelope |
| `tests/work_engine/scoring/test_decision_trace_scoring.py` | tests against the function |

The signal is **live** within the work-engine subsystem. No rule, no kernel
guard, no skill outside `work_engine/` reads it.

## Why this still counts as "not exposed" for P1.4b

`improve-before-implement` is a **rule** (auto, tier 2b). For P1.4b's
HARD-GATE to gate on a confidence band, the rule must read the value
**at rule-evaluation time**. That requires either:

1. A rule-side reader (e.g. `confidence_band_for_current_task()` in a
   shared scripts helper that rules can call), OR
2. Promotion of `confidence_band` from work_engine event payload into a
   process-wide context that the rule loader inspects.

Neither exists today. Implementing one is its own design decision — not a
1-day API addition as the roadmap optimistically estimated. It needs:

- A spec for "task" boundary (rule fires per-message, work-engine fires
  per-step — boundaries don't align).
- A fallback when no work_engine session is active.
- Tests that prove autonomy=on doesn't bypass and autonomy=off doesn't
  over-block.

## Decision

Per kill-switch row 3 of the roadmap (§ Kill-switch / abort criteria):
> "P1.4a reveals no `confidence_band` exposure → defer P1.4b. Land P1.4a
>  as audit-only outcome."

**P1.4b deferred to Phase 2.** When Phase 2 unlocks (per § Promotion
gate), a separate spike issue should design the rule-side API before the
HARD-GATE wording lands.

## Phase 2 reopen trigger

Reopen P1.4b when **any** of:

1. A rule gains the ability to query `confidence_band` (helper added to
   `scripts/` or `.agent-src.uncompressed/contexts/`).
2. The work_engine boundary is unified with the rule loader (e.g. via a
   shared session-state file).
3. User explicitly requests a `confidence-band-rule-bridge` spike.

## Citation

- Roadmap: `agents/roadmaps/archive/road-to-superpowers-harvest.md` § P1.4a, § Kill-switch
- Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
  2026-05-07, Q3): both members AGREE on defer — no rule-side
  `confidence_band` API exists, so HARD-GATE wording would have to
  improvise an interface (regression risk on the work_engine boundary).
