#!/usr/bin/env python3
"""Phase 6.6 platform spot-check via AI council.

Sends the refactored package-root AGENTS.md and the consumer template
to Sonnet 4.5 + gpt-4o, asks each member to answer five questions
that simulate a fresh agent landing on the file. Records qualitative
verdicts in agents/runtime/reports/thin-root-platform-spotcheck.md.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "src"))

from scripts.ai_council.clients import (  # noqa: E402
    AnthropicClient,
    OpenAIClient,
    load_anthropic_key,
    load_openai_key,
)
from scripts.ai_council.orchestrator import (  # noqa: E402
    CostBudget,
    CouncilQuestion,
    consult,
)
from scripts.ai_council.pricing import load_prices  # noqa: E402

QUESTIONS = """
You are evaluating whether the AGENTS.md file below is a sufficient
entry point for an AI coding agent landing on this repository for
the first time. You see only the AGENTS.md content; you do NOT have
file-system access. Answer the following five questions in JSON
shape `{"q1": {...}, ..., "q5": {...}}` where each value is
`{"answer": <string>, "confidence": "high"|"medium"|"low",
"pointer_used": <one of the linked paths from AGENTS.md, or null>}`.

Q1. Where do I edit content in this repo / project? (a path)
Q2. What command do I run to verify everything is green before opening a PR?
Q3. Where would I find the always-active behavioural rules?
Q4. If only this file is reachable, what five things must I assume to be true to act safely? (cite the emergency-triage block)
Q5. What outboard target document would I open to learn the package-self-orientation / the consumer-fill-out guide? (a path)

After the JSON, add a short prose verdict (≤ 5 sentences) on:
- Whether the pointer-following worked (could you cite a path for Q1, Q3, Q5?)
- Whether the emergency-triage block answered Q4 unambiguously.
- One concrete improvement you'd make to the AGENTS.md.

Do not invent file paths. If a question cannot be answered from the
file alone, set `"pointer_used": null` and lower confidence.
""".strip()


def main() -> int:
    package_root = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    consumer_template = (
        ROOT / ".agent-src.uncondensed" / "templates" / "AGENTS.md"
    ).read_text(encoding="utf-8")

    artefact = (
        "## Artefact A — package-root AGENTS.md\n\n"
        f"```markdown\n{package_root}\n```\n\n"
        "## Artefact B — consumer-template AGENTS.md\n\n"
        f"```markdown\n{consumer_template}\n```\n\n"
        f"{QUESTIONS}\n"
    )

    members = [
        AnthropicClient(model="claude-sonnet-4-5", api_key=load_anthropic_key()),
        OpenAIClient(model="gpt-4o", api_key=load_openai_key()),
    ]

    question = CouncilQuestion(
        mode="files",
        user_prompt=artefact,
        max_tokens=1500,
    )
    budget = CostBudget(max_total_usd=2.00, max_calls=4)
    table = load_prices()

    print("Running spot-check council …", file=sys.stderr)
    responses = consult(members, question, budget, table=table, rounds=1)

    out_dir = ROOT / "agents" / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    md_path = out_dir / "thin-root-platform-spotcheck.md"
    json_path = out_dir / "thin-root-platform-spotcheck.json"

    md_lines = [
        "# Thin-Root platform spot-check (Phase 6.6)",
        "",
        "> AI-council proxy for the manual platform spot-check. Two",
        "> external reviewers (Sonnet 4.5, gpt-4o) simulate a fresh",
        "> agent landing on the refactored AGENTS.md and answer five",
        "> orientation questions from the file alone.",
        "",
        "## Verdicts",
        "",
    ]

    raw = []
    for r in responses:
        body = r.text or f"<error: {r.error}>"
        raw.append({
            "provider": r.provider,
            "model": r.model,
            "tokens_in": r.input_tokens,
            "tokens_out": r.output_tokens,
            "latency_ms": r.latency_ms,
            "error": r.error,
            "text": body,
        })
        md_lines.append(f"### {r.provider} ({r.model})")
        md_lines.append("")
        md_lines.append(f"- tokens in: {r.input_tokens} · out: {r.output_tokens} · latency: {r.latency_ms}ms")
        if r.error:
            md_lines.append(f"- error: `{r.error}`")
        md_lines.append("")
        md_lines.append("```")
        md_lines.append(body[:8000])
        md_lines.append("```")
        md_lines.append("")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")
    json_path.write_text(json.dumps(raw, indent=2), encoding="utf-8")
    print(f"✅  Wrote {md_path}", file=sys.stderr)
    print(f"✅  Wrote {json_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
