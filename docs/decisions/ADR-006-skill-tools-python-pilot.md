---
adr: 006
status: accepted
date: 2026-05-09
decision: skill-tools-python-pilot-pass
supersedes: —
superseded_by: —
phase: road-to-better-skills-and-profiles · Block D (D1–D5)
---

# ADR-006 — Skill-Tools Python Pilot: Outcome and Decision

## Status

**Accepted** · 2026-05-09 · pilot **PASSED** · tools kept under
`scripts/skill_tools/`.

## Context

`road-to-better-skills-and-profiles` **Block D** introduced four
Python tools for skill / persona corpus maintenance:

| ID | Tool | Purpose |
|---|---|---|
| D1 | `lint_skill_tools.py` | Pilot-invariant gate (stdlib-only, ≤ 200 LOC, `--json`/`--help`, `_SAMPLE`) |
| D2 | `score_skill_relevance.py` | Rank skills for a task by keyword overlap + persona match |
| D3 | `audit_persona_coverage.py` | Tier-aware persona-citation matrix (specialist < 3, core < 5 → flag) |
| D4 | `suggest_skill_for_task.py` | Top-N skill + persona combos with one-line justification (wraps D2 + D3) |

The pilot was gated by **iter-1 AI-Council verdict**
([`block-d-python-tools-pilot-verdict`](../../agents/council-responses/block-d-python-tools-pilot-verdict.md))
under strict invariants: stdlib-only (internal package imports
allowed), ≤ 200 LOC per tool, machine-readable output (`--json`),
embedded `_SAMPLE`, blind-labelled eval corpora, and a kill-switch if
< 2 / 3 functional tools pass.

## Eval Outcome (D5)

Corpora at `agents/eval-corpora/block-d/`. Runner:
`scripts/skill_tools/run_block_d_eval.py`. Report:
[`agents/eval-corpora/block-d/report.json`](../../agents/eval-corpora/block-d/report.json).

| Tool | Target | Result | Verdict |
|---|---|---|---|
| **D2** (relevance scorer) | ≥ 85 % top-3 hit on 10 blind tasks | **10 / 10 (100 %)** | ✅ pass |
| **D3** (persona audit) | ≥ 2 under-cited personas surfaced | **5** (`ai-agent`, `developer`, `eloquent-tamer`, `qa`, `stakeholder`) | ✅ pass |
| **D4** (skill suggester) | ≥ 3 / 5 top-1 hits on blind corpus | **3 / 5 (60 %)** | ✅ pass (at floor) |
| **Pilot** | ≥ 2 / 3 functional tools pass | **3 / 3** | ✅ **PASS** |

D4 misses are honest: B01 ranks `livewire` over the more specific
`livewire-architect` (close cousins; both legitimate top-1 picks);
B03 (`description-assist` for "review trigger quality") is partial
overlap. Both surface as `confirm-with-reviewer`-grade suggestions,
which matches the tool's design contract.

## Decision

1. **Keep** the four tools under `scripts/skill_tools/` and the meta
   linter at `scripts/lint_skill_tools.py`.
2. **Keep** `lint-skill-tools` in the CI pipeline (`task ci` →
   `taskfiles/ci-fast.yml`).
3. **Keep** the eval corpora and the runner at
   `scripts/skill_tools/run_block_d_eval.py` for regression.
4. **Defer** the v2 refinements (anthropic round-2):
   - `--ratio-mode` flag for D3 (absolute thresholds proved adequate
     on first run; no false alarms on real corpus).
   - Token-frequency reweighting for D2 (100 % top-3 hit rate leaves
     no signal to reweight against).
   - Council `do-competitively` mode for skill-suggester (out of
     scope; orthogonal to the pilot).
5. **No** promotion to a `task` subcommand or kernel-rule citation.
   Tools stay advisory; no agent rule references them yet.

## Consequences

**Positive:**
- 4 advisory tools available for future skill / persona corpus work
  without third-party dependencies.
- Tier-aware persona thresholds are now mechanically enforced
  (advisory, not gated).
- Eval corpora become the regression baseline — any future heuristic
  edit must keep ≥ 2 / 3 tools passing.

**Neutral:**
- Tools are advisory only; no rule cites them, so they cannot
  silently drift into a Hard-Floor or auto-execution role.
- `task ci` gains one cheap meta-lint step (~ 50 ms).

**Negative:**
- Four new files to maintain. Mitigation: pilot-invariants linter
  gates structural drift; tests gate semantic drift.
- D4's 3 / 5 floor result is not a comfortable margin. If a future
  edit drops it below 3 / 5, kill-switch fires per the council
  verdict and the tool is removed without further debate.

## Reversibility

**Trigger:** any single `run_block_d_eval.py` execution that returns
< 2 / 3 tools passing on `main` for two consecutive commits.
**Action:** delete `scripts/skill_tools/`,
`scripts/lint_skill_tools.py`, `tests/test_*_skill*.py`, the corpora
dir, and the `lint-skill-tools` task entry. Mark this ADR
`superseded_by`. ~ 30 min mechanical revert.

## References

- Roadmap: [`road-to-better-skills-and-profiles`](../../agents/roadmaps/road-to-better-skills-and-profiles.md) Block D.
- Council: [`block-d-python-tools-pilot-verdict`](../../agents/council-responses/block-d-python-tools-pilot-verdict.md).
- Tools: [`scripts/skill_tools/`](../../scripts/skill_tools/).
- Linter: [`scripts/lint_skill_tools.py`](../../scripts/lint_skill_tools.py).
- Corpora + report: [`agents/eval-corpora/block-d/`](../../agents/eval-corpora/block-d/).
- Tests: `tests/test_lint_skill_tools.py`, `tests/test_score_skill_relevance.py`, `tests/test_audit_persona_coverage.py`, `tests/test_suggest_skill_for_task.py`.
