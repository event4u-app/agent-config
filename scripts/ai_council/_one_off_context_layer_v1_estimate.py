"""One-shot estimator for the v1 council review (no consult call).

Sibling of `_one_off_context_layer_v1_review.py`. Prints bundle size and
per-model token / cost projection so the user can confirm spend before
the actual consult fires.
"""
from __future__ import annotations

from pathlib import Path

from scripts.ai_council._one_off_context_layer_v1_review import (
    ORIGINAL_ASK,
    REVIEW_PROMPT_HEADER,
    ROADMAP_PATH,
    _diff_stat,
    _pr_body,
)
from scripts.ai_council.bundler import bundle_prompt
from scripts.ai_council.clients import (
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
)
from scripts.ai_council.orchestrator import CouncilQuestion, estimate
from scripts.ai_council.pricing import load_prices
from scripts.ai_council.project_context import detect_project_context

REPO_ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    roadmap_text = ROADMAP_PATH.read_text(encoding="utf-8")
    parts = [
        REVIEW_PROMPT_HEADER,
        "## PR #36 — diff --stat\n\n```\n" + _diff_stat() + "\n```",
        "## PR #36 — body\n\n" + _pr_body(),
        "## Roadmap v1\n\n" + roadmap_text,
    ]
    bundle_text = "\n\n---\n\n".join(parts)
    print(f"Bundle bytes: {len(bundle_text.encode('utf-8'))}")

    ctx = bundle_prompt(bundle_text)
    project = detect_project_context(REPO_ROOT)
    table = load_prices()

    anthropic = AnthropicClient(api_key=load_anthropic_key(), model="claude-sonnet-4-5")
    openai = OpenAIClient(api_key=load_openai_key(), model="gpt-4o")
    members = [anthropic, openai]

    question = CouncilQuestion(mode="prompt", user_prompt=ctx.text, max_tokens=4096)
    estimates = estimate(
        question, members, table, project=project, original_ask=ORIGINAL_ASK,
    )
    total = 0.0
    for c, e in zip(members, estimates):
        print(
            f"  {c.name}/{c.model}: ~{e.input_tokens} in + "
            f"{e.output_tokens} out = ${e.total_usd:.4f}"
        )
        total += e.total_usd
    print(f"  TOTAL (max, single round): ${total:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
