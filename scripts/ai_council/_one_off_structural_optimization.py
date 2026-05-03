"""One-off council run for road-to-structural-optimization.md.

Invokes the council in `design` mode with Anthropic + OpenAI members.
Saves the session under agents/contexts/ai-council-sessions/.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_structural_optimization
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_roadmap
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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-structural-optimization.md"

ORIGINAL_ASK = (
    "Review road-to-structural-optimization.md DRAFT v2 (council-revised). "
    "This is a SECOND independent review of a roadmap that already folded "
    "in five convergence findings from a prior council pass (2026-05-03 "
    "06:52 UTC, anthropic+openai). v2 changes vs. v1: 2A/2B split (always "
    "vs. auto rules), Spike 3a.0 with kill criterion before 3a.1+, "
    "obligation-diff contract 2A.4 with worked example, budget kill-switch "
    "2A, Phase-6-before-2B sequencing, file-ownership matrix gate, per-skill "
    "30%% LOC bar (not average). Three open questions remain: (1) Phase 3a "
    "shape — separate skills + shared context vs. single dispatcher with "
    "mode parameter; (2) Phase 6 shape — one rule + three contexts vs. "
    "router + three thin specialists; (3) Phase 5 endorsement that safety-"
    "floor rules (non-destructive-by-default, commit-policy, scope-control, "
    "verify-before-complete) stay untouched. Mode: design — focus on "
    "architectural risk, sequencing risk, missing rollback, hidden coupling, "
    "AND whether v2's mitigations actually close the v1 critiques. Be hard "
    "on residual gaps; do not rubber-stamp."
)


def main() -> int:
    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    context = bundle_roadmap(ROADMAP_PATH)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    question = CouncilQuestion(
        mode="roadmap",
        user_prompt=context.text,
        max_tokens=8192,
    )

    estimates = estimate(
        question, members, table, project=project, original_ask=ORIGINAL_ASK,
    )
    print("=== ESTIMATE (single round, max tokens) ===")
    total_est = 0.0
    for c, e in zip(members, estimates):
        print(f"  {c.name}/{c.model}: ~{e.input_tokens} in + {e.output_tokens} out = ${e.total_usd:.4f}")
        total_est += e.total_usd
    print(f"  TOTAL per round (max): ${total_est:.4f}")
    print(f"  TOTAL 2 rounds (max, ignoring round-2 prompt growth): ${total_est * 2:.4f}")
    print()

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

    print("=== CONSULT (2 rounds, debate mode) ===")
    consult(
        members, question, budget,
        rounds=2,
        on_round_complete=_on_round_complete,
        table=table, project=project, original_ask=ORIGINAL_ASK,
    )

    if not rounds_collected:
        print("[error] no rounds completed", file=sys.stderr)
        return 1

    actual_total = 0.0
    for round_idx, round_responses in enumerate(rounds_collected, start=1):
        for r in round_responses:
            if r.error:
                continue
            actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
            actual_total += actual.total_usd
    print(f"=== TOTAL ACTUAL: ${actual_total:.4f} (across {len(rounds_collected)} rounds) ===")

    final_round = rounds_collected[-1]
    successes = [r for r in final_round if not r.error]
    if not successes:
        return 1

    manifest = SessionManifest(
        mode="roadmap",
        artefact=str(ROADMAP_PATH.relative_to(REPO_ROOT)),
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}" for r in final_round],
        rounds=len(rounds_collected),
        cost_usd_estimated=total_est * 2,
        cost_usd_actual=actual_total,
        extra={"purpose": "council-design 2-round debate on structural optimization roadmap v2"},
    )
    session_dir = save_session(manifest=manifest, responses=rounds_collected)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 1 if any(r.error for round_r in rounds_collected for r in round_r) else 0


if __name__ == "__main__":
    raise SystemExit(main())
