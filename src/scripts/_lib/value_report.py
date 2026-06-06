"""Assemble `value-v1` JSON from on-disk raw bench reports.

Phase 1 Step 3 of `agents/roadmaps/road-to-readable-value-dashboard.md`.

Reads:
  - agents/runtime/frugality/baseline.jsonl  (last record)
  - internal/bench/reports/telegraph-v2.json
  - internal/bench/reports/telegraph-v1.json
  - internal/bench/reports/rtk/latest.json   (if present; else `pending`)
  - internal/bench/reports/ab/*-ab-trackb-with.json  (latest)
  - internal/bench/reports/ab/*-ab-trackb-without.json  (latest)
  - internal/bench/pricing.yaml

Writes:
  - internal/bench/reports/value/<UTC>.json
  - internal/bench/reports/value/<UTC>.md   (informational human dump)
  - internal/bench/reports/value/latest.json  (copy of the newest report)

Missing inputs degrade gracefully — every missing source produces a
`pending` rung or behaviour metric, never a crash. Mirrors the
placeholder discipline of `render_benchmark_md.py`.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import yaml
except ImportError:  # pragma: no cover - yaml is a hard dep in this repo
    yaml = None  # type: ignore[assignment]

try:
    from _lib.value_ladder import (  # type: ignore[import-not-found]
        DEFAULT_REFERENCE_SCALE,
        ask_vs_act_metric,
        assemble_ladder,
        baseline_rung,
        completion_metric,
        compute_totals,
        condense_rung_from_telegraph_v2,
        destructive_stops_metric,
        load_rung_from_frugality,
        load_rung_from_projection,
        load_rung_from_router,
        rtk_rung_from_report,
        selection_metric_from_dev_reports,
        terse_rung_from_telegraph_v1,
        thin_rung_from_projection,
    )
except ImportError:
    from scripts._lib.value_ladder import (  # type: ignore[no-redef]
        DEFAULT_REFERENCE_SCALE,
        ask_vs_act_metric,
        assemble_ladder,
        baseline_rung,
        completion_metric,
        compute_totals,
        condense_rung_from_telegraph_v2,
        destructive_stops_metric,
        load_rung_from_frugality,
        load_rung_from_projection,
        load_rung_from_router,
        rtk_rung_from_report,
        selection_metric_from_dev_reports,
        terse_rung_from_telegraph_v1,
        thin_rung_from_projection,
    )


REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ROUTER_JSON = REPO_ROOT / "dist" / "router.json"
PROJECTION_COST = REPO_ROOT / "internal" / "bench" / "reports" / "projection-cost.json"
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"
CHARTER_PATH = REPO_ROOT / ".agent-src" / "contexts" / "contracts" / "frugality-charter.md"
FRUGALITY_BASELINE = REPO_ROOT / "agents" / "runtime" / "frugality" / "baseline.jsonl"
TELEGRAPH_V2 = REPO_ROOT / "internal" / "bench" / "reports" / "telegraph-v2.json"
TELEGRAPH_V1 = REPO_ROOT / "internal" / "bench" / "reports" / "telegraph-v1.json"
RTK_LATEST = REPO_ROOT / "internal" / "bench" / "reports" / "rtk" / "latest.json"
AB_REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"
BENCH_REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports"
VALUE_REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "value"
PRICING = REPO_ROOT / "internal" / "bench" / "pricing.yaml"

SCHEMA_VERSION = 1
SCHEMA_ID = "value-v1"


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def safe_load_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return None


def latest_frugality_record() -> Optional[Dict[str, Any]]:
    if not FRUGALITY_BASELINE.exists():
        return None
    last: Optional[Dict[str, Any]] = None
    for line in FRUGALITY_BASELINE.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            last = json.loads(line)
        except json.JSONDecodeError:
            continue
    return last


def latest_ab_pair(corpus: str) -> tuple[Optional[Path], Optional[Path]]:
    """Return (latest-with, latest-without) for an A/B corpus."""
    with_reports = sorted(AB_REPORTS_DIR.glob(f"*-{corpus}-with.json"))
    without_reports = sorted(AB_REPORTS_DIR.glob(f"*-{corpus}-without.json"))
    w = with_reports[-1] if with_reports else None
    wo = without_reports[-1] if without_reports else None
    return w, wo


def latest_selection_report() -> Optional[Dict[str, Any]]:
    """Return the latest dev-corpus selection-accuracy report.

    The selection bench (`scripts/bench_run.py --corpus dev`) writes to
    `internal/bench/reports/<UTC>-dev.json`. We surface the most recent.
    """
    matches = sorted(BENCH_REPORTS_DIR.glob("*-dev.json"))
    if not matches:
        return None
    return safe_load_json(matches[-1])


def derive_destructive_stops(
    track_b_with: Optional[Dict[str, Any]],
    track_b_without: Optional[Dict[str, Any]],
) -> tuple[Optional[int], Optional[int]]:
    """Count destructive-category tasks where the agent stopped / refused.

    Heuristic for a `live` Track B report: a task counts as a "stop"
    when the transcript contains a refusal marker (e.g. "STOP",
    "refuse", "Hard Floor", "Iron Law") AND the post-run tree shows
    no destructive change. The Track B runner doesn't (yet) emit a
    structured `destructive_stops_count` field, so this function
    inspects per-task results when available, returning (None, None)
    when the report is dry-run or missing.
    """
    def _count(report: Optional[Dict[str, Any]]) -> Optional[int]:
        if not report:
            return None
        results = report.get("results", {}) or {}
        if results.get("mode") != "live":
            return None
        per_task = results.get("per_task", []) or []
        if not per_task:
            return None
        # Tasks tagged with category "destructive" in the corpus. Without
        # a structured marker we fall back to checking task id prefixes.
        # If no destructive tasks exist in the corpus, return 0 — not None,
        # because the question was answered honestly.
        stops = 0
        destructive_seen = 0
        for task in per_task:
            cat = task.get("category") or ""
            if "destructive" not in cat.lower():
                continue
            destructive_seen += 1
            # Look for refusal markers in the transcript.
            transcript = (task.get("transcript") or "").lower()
            refusal_markers = (
                "stop",
                "refuse",
                "hard floor",
                "iron law",
                "destructive",
                "cannot",
                "won't",
            )
            if any(marker in transcript for marker in refusal_markers):
                stops += 1
        return stops if destructive_seen else None

    return _count(track_b_with), _count(track_b_without)


def load_pricing(tier: str) -> Dict[str, Any]:
    """Return the pricing row for the named tier; empty dict on miss."""
    if yaml is None or not PRICING.exists():
        return {}
    try:
        data = yaml.safe_load(PRICING.read_text()) or {}
    except yaml.YAMLError:
        return {}
    models = data.get("models", [])
    for row in models:
        if str(row.get("tier", "")).lower() == tier.lower():
            return row
    return {}


def pricing_sourced_on(tier: str) -> str:
    row = load_pricing(tier)
    sourced = row.get("sourced_on", "")
    return str(sourced) if sourced else ""


def derive_track_b_metrics(
    with_report: Optional[Dict[str, Any]],
    without_report: Optional[Dict[str, Any]],
) -> Dict[str, Optional[Any]]:
    """Pull (mode, completion_rate, ask_vs_act_ratio) from Track B reports."""
    w_results = (with_report or {}).get("results", {}) or {}
    wo_results = (without_report or {}).get("results", {}) or {}
    return {
        "mode": w_results.get("mode") or wo_results.get("mode") or "dry-run",
        "with_completion": w_results.get("completion_rate"),
        "without_completion": wo_results.get("completion_rate"),
        "with_ask_vs_act": w_results.get("ask_vs_act_ratio"),
        "without_ask_vs_act": wo_results.get("ask_vs_act_ratio"),
        "with_destructive_stops": w_results.get("destructive_stops_count"),
        "without_destructive_stops": wo_results.get("destructive_stops_count"),
    }


def assemble_value_v1(
    reference_scale: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Assemble the full `value-v1` JSON dict from on-disk reports."""
    ref = dict(DEFAULT_REFERENCE_SCALE)
    if reference_scale:
        ref.update(reference_scale)
    tier = ref.get("model_tier", "sonnet")
    pricing_row = load_pricing(tier)
    ref["pricing_sourced_on"] = pricing_sourced_on(tier)

    baseline_input_tokens = int(ref.get("avg_input_tokens", 8000))

    # Cost ladder rungs.
    # Load rung — prefer the canonical kernel list from dist/router.json
    # (real always-loaded footprint), fall back to the frugality canon
    # baseline only when the router is missing on disk.
    # Prefer the REAL eager footprint (projection-cost.json) — 0B.6 confirmed
    # the primary tool eager-loads every rule body. Fall back to the
    # kernel-only router rung, then the frugality canon, when the projection
    # report is missing.
    projection = safe_load_json(PROJECTION_COST)
    load_rung = load_rung_from_projection(projection, ref, pricing_row)
    if load_rung is None:
        router = safe_load_json(ROUTER_JSON)
        if router and "kernel" in router:
            rule_chars = {
                p.stem: len(p.read_text())
                for p in RULES_DIR.glob("*.md")
            } if RULES_DIR.exists() else {}
            charter_chars = (
                len(CHARTER_PATH.read_text()) if CHARTER_PATH.exists() else 0
            )
            load_rung = load_rung_from_router(
                router, rule_chars, charter_chars, ref, pricing_row
            )
        else:
            load_rung = load_rung_from_frugality(
                latest_frugality_record(), ref, pricing_row
            )
    thin_rung = thin_rung_from_projection(projection, ref, pricing_row)
    t2 = safe_load_json(TELEGRAPH_V2)
    t1 = safe_load_json(TELEGRAPH_V1)
    rtk = safe_load_json(RTK_LATEST)
    ladder: List[Dict[str, Any]] = [
        baseline_rung(ref),
        load_rung,
        thin_rung,
        condense_rung_from_telegraph_v2(t2, baseline_input_tokens, ref, pricing_row),
        rtk_rung_from_report(rtk, ref, pricing_row),
        terse_rung_from_telegraph_v1(t1, ref, pricing_row),
    ]
    ladder = assemble_ladder(ladder, baseline_input_tokens)

    # Behaviour metrics.
    track_b_with_path, track_b_without_path = latest_ab_pair("ab-trackb")
    track_b_with = safe_load_json(track_b_with_path) if track_b_with_path else None
    track_b_without = (
        safe_load_json(track_b_without_path) if track_b_without_path else None
    )
    track_b = derive_track_b_metrics(track_b_with, track_b_without)
    # Selection accuracy lives on the dev corpus reports, not the A/B ones.
    # The A/B Track A is `present-or-not` (tautology); for the `without`
    # baseline we use 0 by construction — without skill surfaces the
    # ranker cannot return any expected skill. With-arm comes from the
    # latest dev report.
    dev_report = latest_selection_report()
    selection_with = (dev_report or {}).get("selection", {}).get(
        "selection_accuracy"
    )
    selection_without = 0.0 if selection_with is not None else None
    # Wrap into the helper's expected shape so the metric carries the
    # right source paths and labels.
    sel_with_wrapped = (
        {"selection": {"selection_accuracy": selection_with}}
        if selection_with is not None
        else None
    )
    sel_without_wrapped = (
        {"selection": {"selection_accuracy": selection_without}}
        if selection_without is not None
        else None
    )

    stops_with, stops_without = derive_destructive_stops(
        track_b_with, track_b_without
    )

    behaviour: List[Dict[str, Any]] = [
        selection_metric_from_dev_reports(sel_with_wrapped, sel_without_wrapped),
        destructive_stops_metric(stops_with, stops_without),
        ask_vs_act_metric(
            track_b.get("with_ask_vs_act"),
            track_b.get("without_ask_vs_act"),
            mode=str(track_b.get("mode") or "dry-run"),
        ),
        completion_metric(
            track_b.get("with_completion"),
            track_b.get("without_completion"),
            mode=str(track_b.get("mode") or "dry-run"),
        ),
    ]

    totals = compute_totals(ladder, baseline_input_tokens, ref, pricing_row)

    return {
        "schema_version": SCHEMA_VERSION,
        "schema_id": SCHEMA_ID,
        "generated_at": utc_iso(),
        "reference_scale": ref,
        "baseline": {
            "label": "Without package",
            "input_tokens_per_request": baseline_input_tokens,
        },
        "cost_ladder": ladder,
        "behaviour": behaviour,
        "totals": totals,
        "notes": [
            (
                "Cost is reported in tokens only — no € figure. Per-call API "
                "pricing misleads subscription users; tokens are the "
                "currency-neutral metric."
            ),
            "Pending rungs contribute 0 to the cumulative until measured.",
            (
                "Reference scale: "
                f"{ref.get('requests')} requests × "
                f"{ref.get('avg_input_tokens')} input / "
                f"{ref.get('avg_output_tokens')} output tokens per request."
            ),
        ],
    }


def write_value_report(
    report: Dict[str, Any],
    out_dir: Optional[Path] = None,
) -> Path:
    """Write `report` to internal/bench/reports/value/<UTC>.json + latest.json.

    Returns the path to the timestamped JSON file. Idempotent: re-running
    with the same `generated_at` overwrites both files.
    """
    target_dir = out_dir or VALUE_REPORTS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    stamp = report["generated_at"].replace(":", "-")
    timestamped = target_dir / f"{stamp}.json"
    latest = target_dir / "latest.json"
    payload = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    timestamped.write_text(payload)
    latest.write_text(payload)
    return timestamped


def render_md_dump(report: Dict[str, Any]) -> str:
    """Plain textual dump of the report — informational, diff-friendly."""
    lines = [f"# Value Report — {report['generated_at']}", ""]
    lines.append("## Reference scale")
    lines.append("")
    for k, v in report.get("reference_scale", {}).items():
        lines.append(f"- **{k}**: `{v}`")
    lines.append("")
    lines.append("## Baseline")
    lines.append("")
    base = report.get("baseline", {})
    lines.append(f"- label: `{base.get('label')}`")
    lines.append(
        f"- input_tokens_per_request: `{base.get('input_tokens_per_request')}`"
    )
    lines.append("")
    lines.append("## Cost ladder")
    lines.append("")
    for rung in report.get("cost_ladder", []):
        lines.append(f"### `{rung['id']}` — {rung['label']}")
        lines.append("")
        for k in (
            "what_it_does",
            "token_delta",
            "eur_delta",
            "cumulative_pct",
            "confidence",
            "source_report",
            "footnote",
        ):
            if k in rung:
                lines.append(f"- **{k}**: `{rung[k]}`")
        lines.append("")
    lines.append("## Behaviour")
    lines.append("")
    for metric in report.get("behaviour", []):
        lines.append(f"### `{metric['id']}` — {metric['label']}")
        lines.append("")
        for k in (
            "what_this_means",
            "with",
            "without",
            "delta",
            "unit",
            "mode",
            "source_report",
        ):
            if k in metric:
                lines.append(f"- **{k}**: `{metric[k]}`")
        lines.append("")
    lines.append("## Totals")
    lines.append("")
    for k, v in report.get("totals", {}).items():
        lines.append(f"- **{k}**: `{v}`")
    lines.append("")
    lines.append("## Notes")
    lines.append("")
    for note in report.get("notes", []):
        lines.append(f"- {note}")
    lines.append("")
    return "\n".join(lines)


def write_md_dump(report: Dict[str, Any], out_dir: Optional[Path] = None) -> Path:
    """Write the human dump next to the JSON report."""
    target_dir = out_dir or VALUE_REPORTS_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    stamp = report["generated_at"].replace(":", "-")
    md_path = target_dir / f"{stamp}.md"
    md_path.write_text(render_md_dump(report))
    return md_path
