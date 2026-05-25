# Report emitter for `scripts/bench_run.py` — step-4 Phase 2 Step 4.
#
# Serializes the unified report dict to JSON + Markdown per
# docs/contracts/benchmark-report-schema.md. Filename format:
# `internal/bench/reports/<UTC ISO-8601 with : -> ->-<corpus_id>.{json,md}`.
"""Report emitter for the bench runner."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_filename_stamp() -> str:
    """Sortable lexicographic stamp — drop ':' so filenames stay portable."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def report_paths(reports_dir: Path, corpus_id: str, stamp: str) -> tuple[Path, Path]:
    base = f"{stamp}-{corpus_id}"
    return reports_dir / f"{base}.json", reports_dir / f"{base}.md"


def write_json(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def _selection_section(selection: dict[str, Any]) -> str:
    lines = [
        "## Selection accuracy",
        "",
        f"- top-K = **{selection['top_k']}** · "
        f"hit **{selection['prompts_hit']} / {selection['prompts_total']}** · "
        f"accuracy **{selection['selection_accuracy']:.2%}** · "
        f"target **{selection['target']:.2%}** · "
        f"verdict **{'PASS' if selection['passed'] else 'FAIL'}**",
        "",
        "| id | hit | expected | top-K ranked |",
        "|---|---|---|---|",
    ]
    for r in selection.get("per_prompt", []):
        mark = "✅" if r["hit"] else "❌"
        expected = ", ".join(r.get("expected_skills") or []) or "—"
        ranked = ", ".join(r.get("top_k_ranked") or []) or "—"
        lines.append(f"| `{r['id']}` | {mark} | {expected} | {ranked} |")
    return "\n".join(lines)


def _cost_section(cost: dict[str, Any]) -> str:
    if cost.get("source") == "unavailable":
        return (
            "## Cost capture\n\n"
            f"- **source:** `unavailable` ({cost.get('reason', 'unknown')})\n"
            f"- **scanned:** `{cost.get('scanned_path', '—')}`\n"
            f"- **pricing sourced on:** {cost.get('pricing_sourced_on') or '—'}\n\n"
            "_No session jsonl available. Run `node scripts/cost/track.mjs` "
            "from a real Claude Code session to populate agents/cost-tracking/sessions.jsonl._\n"
        )
    totals = cost["totals"]
    lines = [
        "## Cost capture",
        "",
        f"- **source:** `{cost['source']}` · sessions scanned: **{cost['sessions_scanned']}**",
        f"- **pricing sourced on:** {cost.get('pricing_sourced_on') or '—'}",
        f"- **total cost:** **${totals['total_cost_usd']:.6f}**",
        "",
        "| tier | messages | cost (USD) |",
        "|---|---:|---:|",
    ]
    for tier, slot in cost["per_tier"].items():
        if slot["messages"] == 0 and slot["cost_usd"] == 0.0:
            continue
        lines.append(f"| {tier} | {slot['messages']} | ${slot['cost_usd']:.6f} |")
    lines += [
        "",
        "| metric | value |",
        "|---|---:|",
        f"| input_tokens | {totals['input_tokens']} |",
        f"| output_tokens | {totals['output_tokens']} |",
        f"| cache_read_input_tokens | {totals['cache_read_input_tokens']} |",
        f"| cache_creation_input_tokens | {totals['cache_creation_input_tokens']} |",
    ]
    return "\n".join(lines)


def _quality_section(quality: dict[str, Any]) -> str:
    if quality["source"] == "not_collected":
        return (
            "## Quality probe\n\n"
            f"- **source:** `not_collected` · assertions declared: "
            f"**{quality['prompts_with_assertion']}**\n"
            "- _Pass `--agent-output <path-to-outputs.json>` (map of `id -> str`) "
            "to score the rubrics. Schema invariant: missing output keeps "
            "`verdict.overall` at `partial`._\n"
        )
    lines = [
        "## Quality probe",
        "",
        f"- **source:** `{quality['source']}` · "
        f"passing **{quality['prompts_passing']} / {quality['prompts_with_assertion']}** · "
        f"score **{quality['quality_score']:.2%}**",
        "",
        "| id | kind | passed | assertion |",
        "|---|---|---|---|",
    ]
    for r in quality.get("per_prompt", []):
        mark = "✅" if r["passed"] is True else ("❌" if r["passed"] is False else "—")
        lines.append(f"| `{r['id']}` | {r['assertion_kind']} | {mark} | `{r['assertion']}` |")
    return "\n".join(lines)


def render_markdown(report: dict[str, Any]) -> str:
    corpus = report["corpus"]
    sel = report["selection"]
    cost = report["cost"]
    qual = report["quality"]
    verdict = report["verdict"]
    headline = (
        f"# Benchmark Report — `{corpus['id']}` · {report['generated_at']}\n\n"
        "## Headline\n\n"
        f"- **selection** {sel['selection_accuracy']:.2%} (target {sel['target']:.2%}) → **{verdict['selection']}**\n"
        f"- **cost** ${cost['totals']['total_cost_usd']:.6f} "
        f"({'sessions=' + str(cost['sessions_scanned']) if cost['source'] != 'unavailable' else cost['source']})\n"
        f"- **quality** {qual['quality_score']:.2%} → **{verdict['quality']}**\n"
        f"- **overall** → **{verdict['overall']}**\n"
    )
    notes = (
        "## Notes\n\n"
        f"- corpus path: `{corpus['path']}` · prompts: **{corpus['prompt_count']}**\n"
        f"- pricing: `internal/bench/pricing.yaml`\n"
        f"- baseline collector: `{report['runner']['baseline_collector']}`\n"
    )
    return "\n\n".join([
        headline,
        _selection_section(sel),
        _cost_section(cost),
        _quality_section(qual),
        notes,
    ]) + "\n"


def write_markdown(path: Path, report: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown(report), encoding="utf-8")
