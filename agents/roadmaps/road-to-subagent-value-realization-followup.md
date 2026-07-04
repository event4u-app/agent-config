---
complexity: lightweight
parent_roadmap: subagent-value-realization
---

# Roadmap: Follow-up to Subagent value realization

> Seed real orchestration telemetry from production use, then re-gate the `subagents.auto` default flip on that evidence via `gateVerdict()`.

> Blocked until: ≥ 20 real orchestrated dispatches are recorded in `agents/runtime/state/audit/YYYY-MM.jsonl` (run with `subagents.enabled: true` and `subagents.auto: ask` or `on`). Execution starts when the audit log carries enough orchestration lines to be a meaningful sample. The build work (parent roadmap) is complete; this roadmap is pure measurement and is gated on accumulated telemetry that cannot be synthesised.

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/road-to-subagent-value-realization.md`](archive/road-to-subagent-value-realization.md).
The parent built the full telemetry-capture path (agent-emit → audit-log JSONL),
the `readOrchestrationMetrics` aggregator, the `/cost:report` orchestration
summary, the delegable-task corpus, and the bench arms. What remains is purely
**measurement** — it requires real orchestrated dispatches to exist, which
cannot be produced by a headless harness (see the parent's `## Council notes`
and `agents/settings/contexts/orchestration-default-flip-verdict.md`).

- **Parent:** `agents/roadmaps/archive/road-to-subagent-value-realization.md`
- **Trigger to unblock:** ≥ 20 orchestration lines in the current-month audit log.

## Phase 1: Seed real telemetry

- [ ] **Step 1:** Verify end-to-end on one real `do-in-parallel` dispatch: a telemetry line is emitted, appended, and reportable. Cite the JSONL line. (Run corpus `orch-01` from `internal/bench/orchestration/corpus/` with `subagents.auto: on`.)
- [ ] **Step 2:** Run the full delegable-task corpus (`orch-01`, `orch-02`, `orch-03`) under both arms (`agent-settings.orchestrated.yml` and `agent-settings.baseline.yml`) across enough sessions to reach ≥ 20 orchestrated dispatches.
- [ ] **Step 3:** Measure `parallelizable:` classifier recall on the corpus — confirm the deterministic classifier fires `do-in-parallel` / `do-in-steps` on the corpus tasks as expected; record actual hit/miss counts.

**Exit criteria:** ≥ 20 orchestration lines in the audit log; `/cost:report` surfaces a non-empty orchestration summary; classifier recall recorded.
**Rollback:** none (measurement only; no code change).

## Phase 2: Re-gate the `auto: on` flip

- [ ] **Step 1:** Feed the accumulated real `ask`-mode orchestration telemetry through the existing `gateVerdict()` / `resolveShippedDefault()`.
- [ ] **Step 2:** If (and only if) the data shows a net token-or-time win at held quality, propose flipping `subagents.auto` default `ask → on` as a maintainer decision; otherwise record the renewed honest-null and keep `ask`.
- [ ] **Step 3:** Update `agents/settings/contexts/orchestration-default-flip-verdict.md` with the new evidence pass (date + outcome), per `no-roadmap-references` (inline, no session path).

**Exit criteria:** `gateVerdict()` run on real telemetry; flip decision recorded with evidence either way.
**Rollback:** none (decision is evidence-gated; `ask` is the safe default if evidence is insufficient).

## Acceptance Criteria

- [ ] A real orchestrated dispatch emits a captured, reportable telemetry line with a sourced `token_delta`; `breachedGuardrails` reads live telemetry.
- [ ] `parallelizable:` classifier recall measured on the corpus.
- [ ] The `auto: on` flip is re-evaluated through `gateVerdict()` on real telemetry, with the outcome recorded — flip only if evidenced.
