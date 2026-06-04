# Telegraph bench report serializer — step-16 Phase 1 Step 5.
#
# Emits the telegraph-v1 JSON + Markdown shape. Distinct schema_version
# ("telegraph-v1") from the selection-accuracy bench (v1) because the
# blocks are disjoint: telegraph has no `selection`/`quality`, and the
# selection bench has no three-arm condensation metrics.
"""Telegraph bench report serializer."""
from __future__ import annotations

from typing import Any

from _lib.bench_telegraph import ARMS, PromptResult, aggregate_results, compute_cost


def build_telegraph_report(
    *,
    results: list[PromptResult],
    corpus_path_rel: str,
    generated_at: str,
    bench_run_version: str,
    model: str,
    transport: str,
    pricing_rates: dict[str, float],
    pricing_sourced_on: str | None,
) -> dict[str, Any]:
    aggregate = aggregate_results(results)
    cost = compute_cost(results, pricing_rates)
    cost["source"] = "live-api"
    cost["model"] = model
    cost["pricing_sourced_on"] = pricing_sourced_on
    errors = cost["totals"]["errors"]
    return {
        "schema_version": "telegraph-v1",
        "generated_at": generated_at,
        "corpus": {
            "id": "telegraph",
            "path": corpus_path_rel,
            "prompt_count": len(results),
        },
        "runner": {
            "bench_run_version": bench_run_version,
            "transport": transport,
            "model": model,
        },
        "telegraph": {
            "arms": list(ARMS),
            "aggregate": aggregate,
            "per_prompt": [_prompt_block(r) for r in results],
        },
        "cost": cost,
        "verdict": {
            "overall": "measured" if errors == 0 else "partial",
            "errors": errors,
        },
    }


def _prompt_block(r: PromptResult) -> dict[str, Any]:
    return {
        "id": r.id,
        "category": r.category,
        "expected_carve_out_pct": r.expected_carve_out_pct,
        "realised_carve_out_pct": (
            r.arms["condensed"].realised_carve_out_pct
            if "condensed" in r.arms else None
        ),
        "savings_vs_raw": r.savings_vs_raw,
        "savings_vs_terse": r.savings_vs_terse,
        "arms": {
            arm: {
                "input_tokens": ar.input_tokens,
                "output_tokens": ar.output_tokens,
                "latency_ms": ar.latency_ms,
                "output_chars": ar.output_chars,
                "carve_out_chars": ar.carve_out_chars,
                "error": ar.error,
                "text": ar.text,
            }
            for arm, ar in r.arms.items()
        },
    }


def _fmt_pct(x: float | None) -> str:
    return f"{x:.2%}" if isinstance(x, (int, float)) else "—"


def render_telegraph_markdown(report: dict[str, Any]) -> str:
    cv = report["telegraph"]
    agg = cv["aggregate"]
    cost = report["cost"]
    head = [
        f"# Telegraph Bench Report — `telegraph` · {report['generated_at']}",
        "",
        "## Headline",
        "",
        f"- prompts: **{report['corpus']['prompt_count']}** · "
        f"arms: **{', '.join(cv['arms'])}** · "
        f"model: **{report['runner']['model']}** · "
        f"transport: **{report['runner']['transport']}**",
        f"- median savings vs raw: **{_fmt_pct(agg['savings_vs_raw']['median'])}** "
        f"(p10 {_fmt_pct(agg['savings_vs_raw']['p10'])} · p90 {_fmt_pct(agg['savings_vs_raw']['p90'])})",
        f"- median savings vs terse-control: **{_fmt_pct(agg['savings_vs_terse']['median'])}** "
        f"(p10 {_fmt_pct(agg['savings_vs_terse']['p10'])} · p90 {_fmt_pct(agg['savings_vs_terse']['p90'])})",
        f"- median realised carve-out share (condensed arm): **{_fmt_pct(agg['realised_carve_out_pct']['median'])}** "
        f"(expected median {_fmt_pct(agg['expected_carve_out_pct']['median'])})",
        f"- calls: **{cost['totals']['calls']}** · errors: **{cost['totals']['errors']}**",
        f"- verdict: **{report['verdict']['overall']}**",
        "",
    ]
    per_arm = [
        "## Per-arm token totals",
        "",
        "| arm | calls | input_tokens | output_tokens | median out/prompt |",
        "|---|---:|---:|---:|---:|",
    ]
    for arm in cv["arms"]:
        a = cost["per_arm"][arm]
        m = agg["output_tokens"][arm]["median"]
        per_arm.append(
            f"| `{arm}` | {a['calls']} | {a['input_tokens']} | {a['output_tokens']} | {m:.0f} |"
        )
    per_arm.append("")
    per_prompt = [
        "## Per-prompt results",
        "",
        "| id | category | exp.carve | real.carve | out.condensed | out.terse | out.uncondensed | vs raw | vs terse |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for r in cv["per_prompt"]:
        arms = r["arms"]
        oc = arms.get("condensed", {}).get("output_tokens", "—")
        ot = arms.get("terse_control", {}).get("output_tokens", "—")
        ou = arms.get("uncondensed", {}).get("output_tokens", "—")
        per_prompt.append(
            f"| `{r['id']}` | {r['category']} | "
            f"{_fmt_pct(r['expected_carve_out_pct'])} | {_fmt_pct(r['realised_carve_out_pct'])} | "
            f"{oc} | {ot} | {ou} | "
            f"{_fmt_pct(r['savings_vs_raw'])} | {_fmt_pct(r['savings_vs_terse'])} |"
        )
    per_prompt.append("")
    notes = [
        "## Notes",
        "",
        f"- corpus: `{report['corpus']['path']}`",
        f"- pricing: `internal/bench/pricing.yaml` (sourced {cost.get('pricing_sourced_on') or '—'})",
        f"- schema: `telegraph-v1` (see `docs/contracts/benchmark-report-schema.md`)",
        f"- bench_run version: `{report['runner']['bench_run_version']}`",
        "",
    ]
    return "\n".join(head + per_arm + per_prompt + notes)
