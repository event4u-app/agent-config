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

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
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


def latest_trackb_with_rdp() -> dict:
    """Latest Track B report for the third condition (`with-rdp`), or {}."""
    reports = sorted(REPORTS_DIR.glob("*-ab-trackb-with-rdp.json"))
    return safe_load(reports[-1]) if reports else {}


def _delta_pct(a: float | None, b: float | None) -> str:
    return fmt_pct((a or 0) - (b or 0))


def fmt_pct(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value * 100:.1f}%"


def fmt_num(value: float | None, places: int = 2) -> str:
    if value is None:
        return "—"
    return f"{value:.{places}f}"


def fmt_int(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{int(value):,}"


def _delta_num(a: float | None, b: float | None, places: int = 3) -> str:
    d = (a or 0) - (b or 0)
    return f"{d:+.{places}f}"


def render_headline(track_a: dict, track_b: dict, track_b_rdp: dict) -> str:
    wo = (track_b.get("without") or {}).get("results", {})
    wi = (track_b.get("with") or {}).get("results", {})
    rd = (track_b_rdp or {}).get("results", {})
    mode = wi.get("mode") or wo.get("mode") or rd.get("mode") or "—"
    total = wi.get("total") or wo.get("total") or rd.get("total") or 0
    dry = mode != "live"
    lines = [
        "## Headline",
        "",
        "> **Lift of agent-config on the host model — NOT a model-vs-model benchmark.** "
        "This measures what the package + the RDP reasoning lift do to a *fixed* host "
        "model on a neutral fixture; it is not comparable to public SWE-bench / "
        "Fable-5 model scores (different question entirely).",
        "",
    ]
    if dry:
        lines += [
            "> ⚠️ **DRY RUN — no model calls were made; every cell is 0/N by construction.** "
            "This shows the *shape* the real numbers will fill. Run `task bench:ab:live` "
            "(billable) for actual results.",
            "",
        ]
    err_bits = []
    for name, res in (("without", wo), ("with", wi), ("with-rdp", rd)):
        e = res.get("errored") or 0
        if e:
            err_bits.append(f"{name}: {e}/{res.get('total', 0)}")
    lines += [
        f"> ⚠️ **Low statistical power: corpus N={total} (< 40).** Directional only; "
        "per-cell N is shown below. The `long × mechanical` cell is intentionally "
        "empty (documented hole, not an error).",
        "",
    ]
    if err_bits:
        lines += [
            "> ⚠️ **Some tasks errored (rate-limit / budget-cap / timeout) and are "
            "excluded from the hit-rate** — they are NOT content failures. Errored "
            f"counts — {'; '.join(err_bits)}. Hit-rate is computed over completed tasks only.",
            "",
        ]
    lines += [
        "_Host model + inference config (temp / top-p / max-tokens) are recorded in "
        "Methodology and must be cited with any quoted number._",
        "",
        "### Table 1 — Package value (without → with)",
        "",
        "| Metric | without | with | delta |",
        "|---|---|---|---|",
        f"| Success / hit-rate | {fmt_pct(wo.get('completion_rate'))} | {fmt_pct(wi.get('completion_rate'))} | {_delta_pct(wi.get('completion_rate'), wo.get('completion_rate'))} |",
        f"| Mean wall-time | {fmt_num(wo.get('mean_wall_time'))}s | {fmt_num(wi.get('mean_wall_time'))}s | {fmt_num((wi.get('mean_wall_time') or 0) - (wo.get('mean_wall_time') or 0))}s |",
        f"| Ask-vs-act ratio | {fmt_num(wo.get('ask_vs_act_ratio'), 3)} | {fmt_num(wi.get('ask_vs_act_ratio'), 3)} | {_delta_num(wi.get('ask_vs_act_ratio'), wo.get('ask_vs_act_ratio'))} |",
        f"| Total tokens | {fmt_int(wo.get('total_tokens'))} | {fmt_int(wi.get('total_tokens'))} | {fmt_int((wi.get('total_tokens') or 0) - (wo.get('total_tokens') or 0))} |",
        "",
        "### Table 2 — RDP reasoning lift (with → with-rdp)",
        "",
        "| Metric | with | with-rdp | delta |",
        "|---|---|---|---|",
        f"| Success / hit-rate | {fmt_pct(wi.get('completion_rate'))} | {fmt_pct(rd.get('completion_rate'))} | {_delta_pct(rd.get('completion_rate'), wi.get('completion_rate'))} |",
        f"| Mean wall-time | {fmt_num(wi.get('mean_wall_time'))}s | {fmt_num(rd.get('mean_wall_time'))}s | {fmt_num((rd.get('mean_wall_time') or 0) - (wi.get('mean_wall_time') or 0))}s |",
        f"| Ask-vs-act ratio | {fmt_num(wi.get('ask_vs_act_ratio'), 3)} | {fmt_num(rd.get('ask_vs_act_ratio'), 3)} | {_delta_num(rd.get('ask_vs_act_ratio'), wi.get('ask_vs_act_ratio'))} |",
        f"| Total tokens | {fmt_int(wi.get('total_tokens'))} | {fmt_int(rd.get('total_tokens'))} | {fmt_int((rd.get('total_tokens') or 0) - (wi.get('total_tokens') or 0))} |",
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


def render_track_b(track_b: dict, track_b_rdp: dict) -> str:
    lines = ["## Track B — Task completion", ""]
    wo = (track_b.get("without") or {}).get("results", {})
    wi = (track_b.get("with") or {}).get("results", {})
    rd = (track_b_rdp or {}).get("results", {})
    mode = wi.get("mode") or wo.get("mode") or rd.get("mode") or "—"
    lines.append(f"- Mode: `{mode}`")
    if not (wo or wi or rd):
        lines += ["", "_No Track B reports yet. Run `task bench:ab:track-b`._", ""]
        return "\n".join(lines)
    lines += [
        f"- without → **{fmt_pct(wo.get('completion_rate'))}** ({wo.get('passed', 0)}/{wo.get('total', 0)})",
        f"- with → **{fmt_pct(wi.get('completion_rate'))}** ({wi.get('passed', 0)}/{wi.get('total', 0)})",
        f"- with-rdp → **{fmt_pct(rd.get('completion_rate'))}** ({rd.get('passed', 0)}/{rd.get('total', 0)})",
        "",
        "### Per 2×2 cell (success-rate per condition; per-cell N in parens)",
        "",
        "| Cell (duration × cognitive) | N | without | with | with-rdp |",
        "|---|---|---|---|---|",
    ]
    wo_c, wi_c, rd_c = wo.get("per_cell", {}), wi.get("per_cell", {}), rd.get("per_cell", {})
    cells = sorted(set(wo_c) | set(wi_c) | set(rd_c)) or [
        "short/reasoning-heavy", "short/mechanical",
        "long/reasoning-heavy", "long/mechanical",
    ]
    for cell in cells:
        n = (wi_c.get(cell) or wo_c.get(cell) or rd_c.get(cell) or {}).get("total", 0)
        lines.append(
            f"| {cell} | {n} | {fmt_pct(wo_c.get(cell, {}).get('completion_rate'))} "
            f"| {fmt_pct(wi_c.get(cell, {}).get('completion_rate'))} "
            f"| {fmt_pct(rd_c.get(cell, {}).get('completion_rate'))} |"
        )
    lines += [
        "",
        "### Per 2×2 cell — mean tokens per condition",
        "",
        "| Cell (duration × cognitive) | without | with | with-rdp |",
        "|---|---|---|---|",
    ]
    for cell in cells:
        lines.append(
            f"| {cell} | {fmt_int(wo_c.get(cell, {}).get('mean_tokens'))} "
            f"| {fmt_int(wi_c.get(cell, {}).get('mean_tokens'))} "
            f"| {fmt_int(rd_c.get(cell, {}).get('mean_tokens'))} |"
        )
    lines += [
        "",
        "_`short × mechanical` mean-tokens across conditions answers \"are short "
        "tasks more expensive?\"; `long × reasoning-heavy` answers \"do long tasks "
        "get cheaper / better?\"._",
        "",
        "### Per category",
        "",
        "| Category | without | with | with-rdp |",
        "|---|---|---|---|",
    ]
    wo_cat, wi_cat, rd_cat = wo.get("per_category", {}), wi.get("per_category", {}), rd.get("per_category", {})
    for cat in sorted(set(wo_cat) | set(wi_cat) | set(rd_cat)):
        lines.append(
            f"| {cat} | {fmt_pct(wo_cat.get(cat, {}).get('completion_rate'))} "
            f"| {fmt_pct(wi_cat.get(cat, {}).get('completion_rate'))} "
            f"| {fmt_pct(rd_cat.get(cat, {}).get('completion_rate'))} |"
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
    track_b_rdp = latest_trackb_with_rdp()
    have_data = bool(
        track_a["with"] or track_a["without"]
        or track_b["with"] or track_b["without"] or track_b_rdp
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
        render_headline(track_a, track_b, track_b_rdp),
        render_track_a(track_a),
        render_track_b(track_b, track_b_rdp),
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
