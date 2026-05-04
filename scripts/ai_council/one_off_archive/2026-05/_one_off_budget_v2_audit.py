"""Council audit of Budget-v2 result (Phase 4.5 of road-to-context-layer-maturity).

Phase 4 of road-to-context-layer-maturity selected two 4d-trim paths
(`direct-answers`, `no-cheap-questions`) from a fixed option set
documented in agents/contexts/budget-v2-matrix.md and shipped them.
Exit-gate actuals (run 2026-05-04): total 44,928 / 49,000 chars
(91.7 %, 4,072 chars headroom) — ≥ 4,000 headroom goal hit. Top-3
sum unchanged. Safety-floor rules untouched.

Phase 4.5 requires a council audit before archival: confirm the
trim choices were sound, no semantic drift introduced, no better
path missed inside the Phase 4 inputs gate.

Invocation:
    .venv/bin/python -m scripts.ai_council.one_off_archive.2026-05._one_off_budget_v2_audit
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

REPO_ROOT = Path(__file__).resolve().parents[4]
ARTEFACTS = [
    REPO_ROOT / "docs/contracts/load-context-budget-model.md",
    REPO_ROOT / "agents/contexts/budget-v2-matrix.md",
    REPO_ROOT / ".agent-src.uncompressed/rules/direct-answers.md",
    REPO_ROOT / ".agent-src.uncompressed/rules/no-cheap-questions.md",
]

ORIGINAL_ASK = (
    "Phase 4 of road-to-context-layer-maturity trimmed two always-rules "
    "(direct-answers, no-cheap-questions) under the locked Model (b) "
    "literal budget contract, hitting the ≥ 4,000-chars headroom goal "
    "(actual: 4,072). Council task: audit the trim choices for "
    "soundness and semantic drift before roadmap archival."
)

REVIEW_PROMPT = """\
# Council Audit — Budget-v2 Trim Result (Phase 4.5)

## Context

Phase 4 selected two 4d-trim paths from a fixed option set documented
in `budget-v2-matrix.md`. The matrix evaluated 4a (demote→auto), 4b
(merge), 4c (shared-context, locked at 3a Model (b) literal — no-op),
and 4d (compress prose) for every touchable always-rule. Safety-floor
rules (scope-control, non-destructive-by-default, commit-policy,
agent-authority) were untouchable. Outcome-untested rules were
restricted to 4d only per the Phase 4.0 inputs gate.

## Selected paths and result

- **4d on `direct-answers`** — emoji-scope subsection trimmed,
  failure-mode collapsed to pointer. Δ ext: 4,098 → 3,987 (−111).
- **4d on `no-cheap-questions`** — "What counts as cheap" subsection
  collapsed to pointer at `asking-and-brevity-examples.md`. Δ ext:
  4,257 → 3,933 (−324).

Combined: −435 chars · headroom 3,637 → 4,072 (+435) · top-3 sum
unchanged · safety-floor rules untouched.

## Audit questions (please address each)

1. **Trim soundness** — do the surviving Iron Laws in both rules still
   carry the rule's purpose, or did the prose trim sacrifice precision?
   Cite the specific subsection if you find drift.

2. **Path selection** — was 4d the right choice for these two rules
   given the matrix? Or should one of the deferred paths (4a, 4b)
   have been picked despite the matrix verdict?

3. **Missed leverage** — inside the Phase 4 inputs gate (4d only on
   outcome-untested rules; safety-floor untouchable), is there a
   higher-leverage 4d target the matrix missed?

4. **Headroom durability** — 4,072 chars is +72 over the 4,000 goal.
   Is this margin stable against expected near-term rule edits, or
   should Phase 5 be tightened to defend it?

## Output Contract (STRICT)

```
### Verdict
**Trim choices sound:** <YES — archive · NO — escalate>
**One-sentence rationale:** <≤ 30 words>
```

```
### Per-question findings (1–4 above)
  1. <≤ 2 sentences>
  2. <≤ 2 sentences>
  3. <≤ 2 sentences>
  4. <≤ 2 sentences>
```

```
### Risk note
**Single biggest residual risk:** <one sentence>
**Mitigation (if any):** <one sentence or NONE>
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
    print(f"  TOTAL per round (max): ${total_est:.4f}\n")

    budget = CostBudget(
        max_input_tokens=200_000,
        max_output_tokens=80_000,
        max_calls=20,
        max_total_usd=2.50,
    )

    rounds_collected: list[list] = []

    def _on_round_complete(round_idx: int, round_responses) -> None:
        rounds_collected.append(list(round_responses))
        print(f"=== ROUND {round_idx + 1} COMPLETE ===")
        for r in round_responses:
            if r.error:
                print(f"  [error] {r.provider}/{r.model}: {r.error}")
                continue
            actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            print(f"  [done] {r.provider}/{r.model}: {r.input_tokens} in / "
                  f"{r.output_tokens} out · {r.latency_ms} ms · ${actual.total_usd:.4f}")
        print()

    print("=== CONSULT (1 round, Phase 4.5 Budget-v2 audit) ===")
    consult(
        members, question, budget,
        rounds=1,
        on_round_complete=_on_round_complete,
        table=table, project=project, original_ask=ORIGINAL_ASK,
    )

    if not rounds_collected:
        print("[error] no rounds completed", file=sys.stderr)
        return 1

    actual_total = 0.0
    for round_responses in rounds_collected:
        for r in round_responses:
            if r.error:
                continue
            actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            actual_total += actual.total_usd
    print(f"=== TOTAL ACTUAL: ${actual_total:.4f} ===")

    final_round = rounds_collected[-1]
    if not [r for r in final_round if not r.error]:
        return 1

    manifest = SessionManifest(
        mode="files",
        artefact="agents/roadmaps/road-to-context-layer-maturity.md",
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est,
        cost_usd_actual=actual_total,
        extra={"purpose": "Phase 4.5 Budget-v2 trim-result audit"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
