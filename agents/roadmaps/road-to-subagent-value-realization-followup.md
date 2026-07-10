---
complexity: lightweight
parent_roadmap: subagent-value-realization
---

# Roadmap: Follow-up to Subagent value realization

> Seed real orchestration telemetry from production use, then re-gate the `subagents.auto` default flip on that evidence via `gateVerdict()`.

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

**Exit criteria:** ≥ 20 orchestration lines in the audit log; `/cost:report` surfaces a non-empty orchestration summary; classifier recall recorded. The ≥ 20-dispatch measurement must include the `first_pass_success` / `escalated` quality columns (per road-to-proof-under-real-conditions Phase 4 — cost and quality reported as a pair, never savings alone).
**Rollback:** none (measurement only; no code change).

## Phase 2: Re-gate the `auto: on` flip

- [ ] **Step 1:** Feed the accumulated real `ask`-mode orchestration telemetry through the existing `gateVerdict()` / `resolveShippedDefault()`.
- [ ] **Step 2:** If (and only if) the data shows a net token-or-time win at held quality, propose flipping `subagents.auto` default `ask → on` as a maintainer decision; otherwise record the renewed honest-null and keep `ask`.
- [ ] **Step 3:** Update `agents/settings/contexts/orchestration-default-flip-verdict.md` with the new evidence pass (date + outcome), per `no-roadmap-references` (inline, no session path).

**Exit criteria:** `gateVerdict()` run on real telemetry; flip decision recorded with evidence either way.
**Rollback:** none (decision is evidence-gated; `ask` is the safe default if evidence is insufficient).

## Notes (added 2026-07-08)

- **`skills:` preload field is unused package-wide** (verified: only
  `src/subagents/production-validator.md` exists, deliberately skill-isolated
  per ADR-109). When any second specialist subagent is authored, list its
  curated governance/convention skills in `skills:` frontmatter so they are
  guaranteed in startup context instead of left to description-matching. No
  roadmap work now — this note is the finding's home (council 2026-07-08).
- The PUBLIC prove-or-drop decision on the orchestration front lives in the
  standalone child `road-to-orchestration-scope-decision.md` (council
  2026-07-08: adoption claim, kept separate from this internal telemetry
  work). Its Phase 2 inherits this roadmap's telemetry blocker.

## Acceptance Criteria

- [ ] A real orchestrated dispatch emits a captured, reportable telemetry line with a sourced `token_delta`; `breachedGuardrails` reads live telemetry.
- [ ] `parallelizable:` classifier recall measured on the corpus.
- [ ] The `auto: on` flip is re-evaluated through `gateVerdict()` on real telemetry, with the outcome recorded — flip only if evidenced.

## Blockers

### blocker: telemetry-sample-size
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 1 — Seed real telemetry
- **What to do:**
  1. Use the agent with `subagents.enabled: true` and `subagents.auto: ask`
     (or `on`) during real work, long enough to accumulate real orchestrated
     dispatches — the build work is done; only real usage produces this.
  2. Check the current-month audit log line count:
     `wc -l agents/runtime/state/audit/$(date +%Y-%m).jsonl`.
  3. Once the count reaches ≥ 20, resume this roadmap
     (`/roadmap:process-full road-to-subagent-value-realization-followup.md`).
- **Resolved when:** `agents/runtime/state/audit/YYYY-MM.jsonl` carries
  ≥ 20 orchestration lines for the current month.
