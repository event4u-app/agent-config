"""One-off Phase-1 round-trip runner.

Used exactly once to generate the evidence artefact required to lift
the capture-only fence on `road-to-ai-council.md` Phase 2+ and the
end-to-end verification on `road-to-council-modes.md` Phase 2a.

Not part of the public CLI surface — `/council` remains the supported
entry point. This script is committed under `scripts/ai_council/` so
the evidence is reproducible from the git history alone.

Invocation:
    .venv/bin/python -m scripts.ai_council._one_off_roundtrip
"""
from __future__ import annotations

import sys
from pathlib import Path

from scripts.ai_council.bundler import bundle_roadmap
from scripts.ai_council.clients import AnthropicClient, load_anthropic_key
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
ROADMAP_PATH = REPO_ROOT / "agents/roadmaps/road-to-council-modes.md"

ORIGINAL_ASK = (
    "Bitte review die folgende Roadmap (council-modes Phase 2c "
    "Playwright). Die Maintainer-Recommendations für Q1-Q5 sind im "
    "Block 'Decisions Required' bereits hinterlegt. Frage: sollten "
    "wir die Recommendations annehmen wie sie sind, oder gibt es "
    "blinde Flecken die wir vor dem Lift der capture-only fence "
    "kläeren sollten?"
)


def main() -> int:
    api_key = load_anthropic_key()
    client = AnthropicClient(api_key=api_key)

    context = bundle_roadmap(ROADMAP_PATH)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    question = CouncilQuestion(
        mode="roadmap",
        user_prompt=context.text,
        max_tokens=2048,
    )

    estimates = estimate(
        question, [client], table,
        project=project, original_ask=ORIGINAL_ASK,
    )
    print(f"[estimate] {client.name}/{client.model}: "
          f"~{estimates[0].input_tokens} in + {estimates[0].output_tokens} out "
          f"= ${estimates[0].total_usd:.4f}")

    budget = CostBudget(
        max_input_tokens=50_000,
        max_output_tokens=20_000,
        max_calls=10,
        max_total_usd=0.50,
    )

    print(f"[consult] calling {client.name}/{client.model} ...")
    responses = consult(
        [client], question, budget,
        table=table, project=project, original_ask=ORIGINAL_ASK,
    )

    if not responses or responses[0].error:
        err = responses[0].error if responses else "no response"
        print(f"[error] {err}", file=sys.stderr)
        return 1

    r = responses[0]
    actual = estimate_cost(r.provider, r.model, r.input_tokens, r.output_tokens, table)
    actual_usd = actual.total_usd
    print(f"[done] tokens: {r.input_tokens} in / {r.output_tokens} out · "
          f"latency: {r.latency_ms} ms · actual ${actual_usd:.4f}")

    manifest = SessionManifest(
        mode="roadmap",
        artefact=str(ROADMAP_PATH.relative_to(REPO_ROOT)),
        original_ask=ORIGINAL_ASK,
        members=[f"{r.provider}/{r.model}"],
        rounds=1,
        cost_usd_estimated=estimates[0].total_usd,
        cost_usd_actual=actual_usd,
        extra={"purpose": "Phase 1 ai-council round-trip + Phase 2a council-modes E2E evidence"},
    )
    session_dir = save_session(manifest=manifest, responses=responses)
    print(f"[saved] {session_dir.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
