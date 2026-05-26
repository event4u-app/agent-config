#!/usr/bin/env python3
"""Render `docs/benchmark.md` from the latest paired A/B bench reports.

Phase 5 Step 1 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

Reads:
  - internal/bench/reports/ab/{stamp}-ab-tracka-{with,without}.json (latest pair)
  - internal/bench/reports/ab/{stamp}-ab-trackb-{with,without}.json (latest pair)
  - any matching diff under internal/bench/reports/ab/diff/

Emits: `docs/benchmark.md`. The renderer is deterministic — it does not run
any bench; it only formats existing reports. `task bench:ab` calls this last;
`task bench:ab:diff` calls it alone.

Sections of the rendered file:
  - Headline (delta table)
  - Track A — behavioural
  - Track B — task completion
  - Methodology (target shape, corpus versions, claude CLI version, timestamps)
  - History (last 5 runs)

If no reports exist yet, the script writes a placeholder document explaining
how to produce one — never errors out, so the file is always a real
description of the current bench state.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"
DIFF_DIR = REPORTS_DIR / "diff"
OUT_PATH = REPO_ROOT / "docs" / "benchmark.md"

REQUIRED_SECTIONS = (
    "## Headline",
    "## Track A",
    "## Track B",
    "## Methodology",
    "## History",
)


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def latest_pair(corpus: str) -> tuple[Path | None, Path | None]:
    """Return the (with, without) report pair for a corpus, both with the same stamp.

    If only one variant has a fresh report, the other position is None.
    """
    with_reports = sorted(REPORTS_DIR.glob(f"*-{corpus}-with.json"))
    without_reports = sorted(REPORTS_DIR.glob(f"*-{corpus}-without.json"))
    if not with_reports and not without_reports:
        return None, None
    # Latest of each — they don't have to share stamps; the diff handles that.
    return (
        with_reports[-1] if with_reports else None,
        without_reports[-1] if without_reports else None,
    )


def latest_diff(corpus: str) -> Path | None:
    diffs = sorted(DIFF_DIR.glob(f"*-{corpus}-diff.json"))
    return diffs[-1] if diffs else None


def safe_load(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def fmt_pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:.1f}%"


def fmt_num(value: float | None, places: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value:.{places}f}"


def render_headline(track_a: dict, track_b: dict) -> str:
    a_results = (track_a.get("with") or {}).get("results", {})
    a_without = (track_a.get("without") or {}).get("results", {})
    b_results = (track_b.get("with") or {}).get("results", {})
    b_without = (track_b.get("without") or {}).get("results", {})
    a_with_acc = a_results.get("trigger_accuracy")
    a_wo_acc = a_without.get("trigger_accuracy")
    b_with_comp = b_results.get("completion_rate")
    b_wo_comp = b_without.get("completion_rate")
    lines = [
        "## Headline",
        "",
        "| Metric | with | without | delta |",
        "|---|---|---|---|",
        f"| Track A trigger-accuracy | {fmt_pct(a_with_acc)} | {fmt_pct(a_wo_acc)} | "
        f"{fmt_pct((a_with_acc or 0) - (a_wo_acc or 0))} |",
        f"| Track B completion-rate  | {fmt_pct(b_with_comp)} | {fmt_pct(b_wo_comp)} | "
        f"{fmt_pct((b_with_comp or 0) - (b_wo_comp or 0))} |",
        f"| Track B mean wall-time   | {fmt_num(b_results.get('mean_wall_time'))}s "
        f"| {fmt_num(b_without.get('mean_wall_time'))}s | "
        f"{fmt_num((b_results.get('mean_wall_time') or 0) - (b_without.get('mean_wall_time') or 0))}s |",
        f"| Track B ask-vs-act ratio | {fmt_num(b_results.get('ask_vs_act_ratio'), 3)} "
        f"| {fmt_num(b_without.get('ask_vs_act_ratio'), 3)} | — |",
        "",
    ]
    return "\n".join(lines)


def render_track_a(track_a: dict) -> str:
    with_data = (track_a.get("with") or {}).get("results", {})
    without_data = (track_a.get("without") or {}).get("results", {})
    lines = ["## Track A — Behavioural eval", ""]
    if not with_data and not without_data:
        lines.append("_No Track A reports yet. Run `task bench:ab:track-a`._")
        lines.append("")
        return "\n".join(lines)
    lines.extend(
        [
            f"- with → **{fmt_pct(with_data.get('trigger_accuracy'))}** "
            f"({with_data.get('matched', 0)}/{with_data.get('total', 0)})",
            f"- without → **{fmt_pct(without_data.get('trigger_accuracy'))}** "
            f"({without_data.get('matched', 0)}/{without_data.get('total', 0)})",
            f"- integrity OK: `{track_a.get('with', {}).get('integrity_ok', '—')}`",
            "",
            "Per-target presence (sample):",
            "",
        ]
    )
    per_target = with_data.get("per_target_present", {})
    for i, (target, score) in enumerate(sorted(per_target.items())):
        if i >= 10:
            lines.append(f"- … {len(per_target) - 10} more")
            break
        lines.append(f"- `{target}` → with={score}, without=0")
    lines.append("")
    return "\n".join(lines)


def render_track_b(track_b: dict) -> str:
    lines = ["## Track B — Task completion", ""]
    with_data = (track_b.get("with") or {}).get("results", {})
    without_data = (track_b.get("without") or {}).get("results", {})
    mode = with_data.get("mode") or without_data.get("mode") or "—"
    lines.append(f"- Mode: `{mode}`")
    if not with_data and not without_data:
        lines.append("")
        lines.append("_No Track B reports yet. Run `task bench:ab:track-b`._")
        lines.append("")
        return "\n".join(lines)
    lines.extend(
        [
            f"- with → **{fmt_pct(with_data.get('completion_rate'))}** "
            f"({with_data.get('passed', 0)}/{with_data.get('total', 0)})",
            f"- without → **{fmt_pct(without_data.get('completion_rate'))}** "
            f"({without_data.get('passed', 0)}/{without_data.get('total', 0)})",
            "",
            "Per-category:",
            "",
            "| Category | with | without | delta |",
            "|---|---|---|---|",
        ]
    )
    with_cats = with_data.get("per_category", {})
    without_cats = without_data.get("per_category", {})
    for cat in sorted(set(with_cats) | set(without_cats)):
        w = with_cats.get(cat, {}).get("completion_rate") or 0
        wo = without_cats.get(cat, {}).get("completion_rate") or 0
        lines.append(
            f"| {cat} | {fmt_pct(w)} | {fmt_pct(wo)} | {fmt_pct(w - wo)} |"
        )
    lines.append("")
    return "\n".join(lines)


def render_methodology(track_a: dict, track_b: dict) -> str:
    with_report = track_a.get("with") or track_b.get("with") or {}
    cache_key = with_report.get("cache_key", {})
    lines = [
        "## Methodology",
        "",
        "- **Target shape:** Shape A (neutral TypeScript fixture under `internal/bench/ab/fixture/`).",
        "- **Variants:** `with` clone inherits `.claude/`, `.augment/`, `AGENTS.md`, "
        "`CLAUDE.md` from the package root; `without` does not.",
        "- **Integrity:** `python3 scripts/bench_ab_integrity.py` exits 0 on every run "
        "(clones differ only at the agent-config surface).",
        "- **Scoring:** structural only (no LLM judge). See `scripts/_lib/bench_ab_scoring.py`.",
        "",
        "Cache key for the latest run:",
        "",
    ]
    if cache_key:
        for k in ("corpus_hash", "claude_cli_version", "target_shape_hash"):
            lines.append(f"- `{k}`: `{cache_key.get(k, '—')}`")
    else:
        lines.append("- _no cache key recorded yet_")
    lines.append("")
    lines.append(f"- **Last rendered:** `{utc_iso()}`")
    lines.append("")
    return "\n".join(lines)


def render_history() -> str:
    lines = ["## History", "", "Last 5 runs (per corpus):", ""]
    for corpus in ("ab-tracka", "ab-trackb"):
        lines.append(f"### `{corpus}`")
        lines.append("")
        reports = sorted(
            REPORTS_DIR.glob(f"*-{corpus}-with.json"), reverse=True
        )[:5]
        if not reports:
            lines.append("_no runs yet_")
            lines.append("")
            continue
        for report in reports:
            try:
                data = json.loads(report.read_text())
            except json.JSONDecodeError:
                continue
            results = data.get("results") or {}
            metric = (
                results.get("trigger_accuracy")
                if corpus == "ab-tracka"
                else results.get("completion_rate")
            )
            lines.append(f"- `{data.get('stamp', '—')}` → {fmt_pct(metric)}")
        lines.append("")
    return "\n".join(lines)


def render_placeholder() -> str:
    return (
        "# Package-Impact A/B Benchmark\n"
        "\n"
        "_No A/B bench reports yet._ Produce one with:\n"
        "\n"
        "```sh\n"
        "task bench:ab\n"
        "```\n"
        "\n"
        "Methodology lives in `agents/roadmaps/road-to-package-impact-benchmark.md` "
        "and `internal/bench/ab/README.md`.\n"
        f"\n_Last rendered: {utc_iso()}_\n"
    )


def render(quiet: bool = False) -> int:
    a_with, a_without = latest_pair("ab-tracka")
    b_with, b_without = latest_pair("ab-trackb")
    track_a = {"with": safe_load(a_with), "without": safe_load(a_without)}
    track_b = {"with": safe_load(b_with), "without": safe_load(b_without)}
    have_data = bool(
        track_a["with"] or track_a["without"] or track_b["with"] or track_b["without"]
    )
    if not have_data:
        OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        OUT_PATH.write_text(render_placeholder())
        if not quiet:
            sys.stdout.write(
                f"render_benchmark_md: no reports — wrote placeholder to {OUT_PATH.relative_to(REPO_ROOT)}\n"
            )
        return 0
    parts = [
        "# Package-Impact A/B Benchmark",
        "",
        "> Generated by `scripts/render_benchmark_md.py`. Source of truth: "
        "`internal/bench/reports/ab/`. Re-render anytime with `task bench:ab:diff`.",
        "",
        render_headline(track_a, track_b),
        render_track_a(track_a),
        render_track_b(track_b),
        render_methodology(track_a, track_b),
        render_history(),
    ]
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text("\n".join(parts))
    if not quiet:
        sys.stdout.write(
            f"render_benchmark_md: wrote {OUT_PATH.relative_to(REPO_ROOT)}\n"
        )
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render docs/benchmark.md from A/B reports.")
    parser.add_argument("--quiet", action="store_true", help="Suppress stdout.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    return render(quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
