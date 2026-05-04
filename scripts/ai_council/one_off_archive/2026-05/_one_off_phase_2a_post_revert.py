"""Council adjudication of post-revert always-budget contract.

Phase 2A executed R4 (revert) per the prior council verdict. The
three slimmed always-rules and their mechanics contexts have been
restored; mechanics-context directory removed. Measured state on
this branch is now 47,448 / 49,000 chars = 96.8 % — strictly better
than `main` at 100.6 % which currently passes via the G3 tolerance
band.

The strict 90 % FAIL gate in scripts/check_always_budget.py was
written assuming Phase 2A would succeed in dropping utilization
below 90 %. Phase 2A is now structurally infeasible under model (b)
(per the previous council finding) and the cap-tightening was
deferred to Phase 5. Branch must unblock CI without regressing the
contract spirit.

Council task: pick the smallest viable reconciliation.
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_files
from scripts.ai_council.clients import (
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
)
from scripts.ai_council.orchestrator import (
    CostBudget,
    CouncilQuestion,
    consult,
    estimate,
)
from scripts.ai_council.pricing import estimate_cost, load_prices
from scripts.ai_council.project_context import detect_project_context
from scripts.ai_council.session import SessionManifest, save as save_session

REPO_ROOT = Path(__file__).resolve().parents[2]
ARTEFACTS = [
    REPO_ROOT / "docs/contracts/load-context-budget-model.md",
    REPO_ROOT / "scripts/check_always_budget.py",
]

ORIGINAL_ASK = (
    "Phase 2A reverted (R4) per prior council verdict. Branch budget is "
    "96.8 % (gap-zone FAIL); main is 100.6 % (PASS via G3 band). Branch "
    "is strictly better than main yet rejected by the strict 90 % gate. "
    "Pick the smallest contract reconciliation to unblock CI."
)

REVIEW_PROMPT = """\
# Council Adjudication — Post-Revert Always-Budget Reconciliation

## Current state (after R4 revert is committed locally)

```
FAIL  always-rule extended budget: 47,448 / 49,000 chars (96.8%)
      thresholds: warn 80% · fail 90% · per-rule ≤ 6,000 (ext) ·
                  top-3 ≤ 24,500 (ext) · depth ≤ 2 · G3 band ≤ +2%
```

`main` (last green): **49,311 / 49,000 = 100.6 %** — passes because
the linter only rejects 90–100 % (gap zone) and > 102 %; 100–102 %
is the documented G3 tolerance band.

This branch is objectively closer to the cap than `main` but
rejected. The 90 % gate was written under the assumption Phase 2A
would land below 90 %. Phase 2A is structurally infeasible under
model (b) (prior council finding); roadmap re-routes the trim to
Phase 5 via either model (c) shared-divisor or shared-mechanics
consolidation.

## Fixed option set (pick exactly one)

- **A1 — Recovery-band carve-out.** Extend the linter so "current
  pct ≤ last-green-`main` pct AND pct ≤ 100 %" becomes a documented
  `WARN (recovery band)`, not FAIL. Persists until Phase 5
  re-tightens. No baseline regression possible; needs `main`-pct
  lookup (committed scalar in repo or CI artifact).
- **A2 — Lower FAIL_THRESHOLD to 100 %.** Drop the 90 % gate to
  match the contract's spirit ("< cap is acceptable; > cap +2 %
  fails"). Phase 5 re-tightens to 85 %/95 % per its own task list.
  Smallest diff. Risk: removes the early-warning gate.
- **A3 — Trim ~3.4k chars from current rules.** Find another
  candidate (none of the three Phase-2A targets, since 2A proved
  extraction adds overhead). Risk: the next-largest rules touch
  the safety floor (Q3=A locked).
- **A4 — Bump TOTAL_CAP to 53,000 + keep 90 % FAIL.** Rewrites the
  contract's total cap upward; freezes current state at ~89.5 %.
  Defers Phase 5 trim to a separate roadmap. Cleanest CI but
  contract drift.
- **A5 — Mark phase as `irreducible-at-current-method` and freeze
  the linter at current state.** Pin a `CURRENT_BASELINE = 47_448`
  ceiling alongside the 90 % gate; PASS while pct ≤ baseline,
  FAIL on regression. Deflects Phase 5 work upstream into model (c).

## Constraints

- Safety-floor rules (`non-destructive-by-default`, `commit-policy`,
  `scope-control`, `verify-before-complete`) are Q3=A locked and
  may not be slimmed.
- `road-to-structural-optimization` Phase 5 owns the long-term
  trim — do not duplicate work into Phase 2A.
- The four other phases (1, 2B, 3, 4, 6) on this branch are
  blocked by this CI gate; the choice gates roadmap throughput.

## Output Contract (STRICT)

```
### Verdict
**Choice:** <A1 | A2 | A3 | A4 | A5>
**One-sentence rationale:** <≤ 30 words>
```

```
### Required follow-up actions (numbered, ≤ 4)
  1. <smallest concrete step, files named>
  2. <...>
```

```
### Risk note
**Single biggest risk of the chosen option:** <one sentence>
**Mitigation:** <one sentence>
```

```
### Contract amendment needed?
**Amend load-context-budget-model.md?** <YES — section · NO>
**Amend road-to-structural-optimization Phase 5 success criterion?**
  <YES — new criterion in 1 line · NO>
```

Be decisive — total response ≤ 800 words. Artefacts follow verbatim.
"""


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_files(ARTEFACTS)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    user_prompt = REVIEW_PROMPT + "\n\n---\n\n" + context.text

    question = CouncilQuestion(mode="files", user_prompt=user_prompt, max_tokens=2048)
    estimates = estimate(question, members, table, project=project, original_ask=ORIGINAL_ASK)
    print("=== ESTIMATE (single round) ===")
    total_est = 0.0
    for c, e in zip(members, estimates):
        print(f"  {c.name}/{c.model}: ~{e.input_tokens} in + {e.output_tokens} out = ${e.total_usd:.4f}")
        total_est += e.total_usd
    print(f"  TOTAL per round (max): ${total_est:.4f}")

    budget = CostBudget(max_input_tokens=200_000, max_output_tokens=80_000, max_calls=20, max_total_usd=2.50)
    rounds_collected: list[list] = []

    def _on_round_complete(round_idx, round_responses) -> None:
        rounds_collected.append(list(round_responses))
        print(f"=== ROUND {round_idx + 1} COMPLETE ===")
        for r in round_responses:
            if r.error:
                print(f"  [error] {r.provider}/{r.model}: {r.error}")
                continue
            a = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            print(f"  [done] {r.provider}/{r.model}: {r.input_tokens} in / {r.output_tokens} out · ${a.total_usd:.4f}")

    print("=== CONSULT (1 round, post-revert reconciliation) ===")
    consult(members, question, budget, rounds=1, on_round_complete=_on_round_complete,
            table=table, project=project, original_ask=ORIGINAL_ASK)
    if not rounds_collected:
        return 1
    actual = sum(estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table).total_usd
                 for rr in rounds_collected for r in rr if not r.error)
    print(f"=== TOTAL ACTUAL: ${actual:.4f} ===")
    final = rounds_collected[-1]
    if not [r for r in final if not r.error]:
        return 1
    manifest = SessionManifest(
        mode="files", artefact="agents/roadmaps/road-to-structural-optimization.md",
        original_ask=ORIGINAL_ASK, members=[f"{r.provider}/{r.model}" for r in final],
        rounds=len(rounds_collected), cost_usd_estimated=total_est, cost_usd_actual=actual,
        extra={"purpose": "Post-revert always-budget contract reconciliation"},
    )
    sd = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {sd.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
