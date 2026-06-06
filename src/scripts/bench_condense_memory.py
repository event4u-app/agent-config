#!/usr/bin/env python3
"""Offline bench for input-side memory condensation (Phase 2 / Step 11).

Runs `condense_memory.py` over a fixed corpus of memory-target files, records
pre/post char counts, approximates input-token savings (chars / 4 — the
GPT-4 / Claude rule of thumb), and emits `internal/bench/reports/telegraph-v2.{json,md}`.

Offline (no API calls). Cadence-aligned with `docs/benchmarks.md`. Citation
in `internal/bench/reports/telegraph-v2.md` notes the chars→tokens approximation and
points at upstream tiktoken / claude-tokenizer if a calibrated number is
later needed.
"""
from __future__ import annotations

import json
import shutil
import statistics
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONDENSE_SCRIPT = REPO_ROOT / "src" / "scripts" / "condense_memory.py"
REPORT_JSON = REPO_ROOT / "internal" / "bench" / "reports" / "telegraph-v2.json"
REPORT_MD = REPO_ROOT / "internal" / "bench" / "reports" / "telegraph-v2.md"

CORPUS: list[tuple[str, str]] = [
    ("AGENTS.md", "thin-root-package"),
    (".agent-src.uncondensed/templates/AGENTS.md", "thin-root-consumer-template"),
    ("dist/agent-src/templates/AGENTS.md", "thin-root-consumer-generated"),
    ("docs/contracts/ai-council-config.md", "prose-heavy-contract"),
    ("docs/contracts/implement-ticket-flow.md", "prose-heavy-contract"),
    ("docs/contracts/command-clusters.md", "prose-heavy-contract"),
    ("docs/contracts/mental-models.md", "prose-heavy-contract"),
    ("docs/contracts/kernel-membership.md", "prose-heavy-contract"),
    ("docs/contracts/load-context-budget-model.md", "prose-heavy-contract"),
    ("docs/contracts/mcp-cloud-scope.md", "prose-heavy-contract"),
    ("docs/contracts/context-spine.md", "prose-heavy-contract"),
    ("docs/contracts/rule-classification.md", "rule-classification"),
]


def chars_to_tokens(n: int) -> int:
    """Approximate token count via chars / 4 (GPT-4/Claude English heuristic)."""
    return round(n / 4)


def bench_one(rel_path: str, category: str) -> dict:
    src = REPO_ROOT / rel_path
    if not src.is_file():
        return {"path": rel_path, "category": category, "error": "not-found"}
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / src.name
        shutil.copy(src, target)
        before_chars = target.stat().st_size
        result = subprocess.run(
            [sys.executable, str(CONDENSE_SCRIPT), str(target)],
            capture_output=True, text=True, cwd=REPO_ROOT,
        )
        if result.returncode != 0:
            return {"path": rel_path, "category": category,
                    "error": f"exit-{result.returncode}", "stderr": result.stderr[:200]}
        after_chars = target.stat().st_size
        before_tok = chars_to_tokens(before_chars)
        after_tok = chars_to_tokens(after_chars)
        return {
            "path": rel_path,
            "category": category,
            "before_chars": before_chars,
            "after_chars": after_chars,
            "delta_chars": after_chars - before_chars,
            "saving_pct_chars": (before_chars - after_chars) * 100 / before_chars,
            "before_tokens_est": before_tok,
            "after_tokens_est": after_tok,
            "delta_tokens_est": after_tok - before_tok,
            "saving_pct_tokens_est": (before_tok - after_tok) * 100 / before_tok if before_tok else 0.0,
        }


def aggregate(rows: list[dict]) -> dict:
    rows_ok = [r for r in rows if "error" not in r]
    savings = [r["saving_pct_chars"] for r in rows_ok]
    by_cat: dict[str, list[float]] = {}
    for r in rows_ok:
        by_cat.setdefault(r["category"], []).append(r["saving_pct_chars"])
    return {
        "calls": len(rows),
        "errors": len(rows) - len(rows_ok),
        "median_saving_pct": statistics.median(savings) if savings else 0.0,
        "p10_saving_pct": statistics.quantiles(savings, n=10)[0] if len(savings) >= 10 else min(savings, default=0.0),
        "p90_saving_pct": statistics.quantiles(savings, n=10)[8] if len(savings) >= 10 else max(savings, default=0.0),
        "stdev_saving_pct": statistics.pstdev(savings) if len(savings) > 1 else 0.0,
        "total_chars_saved": sum(r["before_chars"] - r["after_chars"] for r in rows_ok),
        "total_tokens_est_saved": sum(r["before_tokens_est"] - r["after_tokens_est"] for r in rows_ok),
        "by_category_median_pct": {k: statistics.median(v) for k, v in by_cat.items()},
    }


def render_md(payload: dict) -> str:
    agg = payload["aggregate"]
    lines = [
        "# telegraph-v2 — input-side memory condensation bench",
        "",
        f"**Generated:** {payload['generated_at']}",
        f"**Schema:** `telegraph-v2` (input-side; offline; chars→tokens via /4 heuristic)",
        f"**Script:** `scripts/bench_condense_memory.py`",
        "",
        "## Headline",
        "",
        f"- Median char saving: **{agg['median_saving_pct']:+.2f}%** (p10 {agg['p10_saving_pct']:+.2f}% · p90 {agg['p90_saving_pct']:+.2f}%)",
        f"- Total chars saved across corpus: **{agg['total_chars_saved']:+,}**",
        f"- Total tokens (estimate) saved across corpus: **{agg['total_tokens_est_saved']:+,}**",
        f"- Files: {agg['calls']} · errors: {agg['errors']}",
        "",
        "## By category (median %)",
        "",
        "| Category | Median saving |",
        "|---|---:|",
    ]
    for cat, med in sorted(agg["by_category_median_pct"].items()):
        lines.append(f"| {cat} | {med:+.2f}% |")
    lines += ["", "## Per file", "",
              "| Path | Category | Before | After | Δ chars | Saving % |",
              "|---|---|---:|---:|---:|---:|"]
    for r in payload["rows"]:
        if "error" in r:
            lines.append(f"| `{r['path']}` | {r['category']} | — | — | — | {r['error']} |")
        else:
            lines.append(
                f"| `{r['path']}` | {r['category']} | {r['before_chars']:,} | {r['after_chars']:,} | "
                f"{r['delta_chars']:+,} | {r['saving_pct_chars']:+.2f}% |"
            )
    lines += ["", "## Methodology",
              "",
              "- Offline run: `condense_memory.py` writes `.original.md` backup + frontmatter (`original_sha256`, `condensed_at`). The frontmatter pair (≈ 120 chars) is the fixed condensation tax — files with little prose net negative.",
              "- chars → tokens approximation: `tokens ≈ chars / 4` (GPT-4 / Claude English rule of thumb). Calibrated number requires `tiktoken` or `claude-tokenizer`; deferred until a consumer requests pinpoint numbers.",
              "- The `telegraph-v1` output-side verdict (`vs_terse` median −9.27%) is orthogonal — input-side savings apply to the always-loaded memory budget, not the reply stream.",
              "",
              "## Interpretation",
              "",
              "- **Thin-Root files net negative.** `AGENTS.md` and `templates/AGENTS.md` already follow `agents-md-thin-root` (≥ 40 % pointer ratio). The condenseor's frontmatter pair adds more bytes than the sparse prose loses. **Do not condense Thin-Root files.**",
              "- **Prose-heavy contract docs net 3–6 % saving.** Useful but modest. Pays off when the file is large and frequently loaded.",
              "- **Rule of thumb:** target files with > 5 KB and visible paragraph prose; skip pointer-only files.",
              ""]
    return "\n".join(lines)


def main() -> int:
    rows = [bench_one(p, c) for p, c in CORPUS]
    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "schema": "telegraph-v2",
        "rows": rows,
        "aggregate": aggregate(rows),
    }
    REPORT_JSON.parent.mkdir(parents=True, exist_ok=True)
    REPORT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    REPORT_MD.write_text(render_md(payload), encoding="utf-8")
    print(f"wrote: {REPORT_JSON}")
    print(f"wrote: {REPORT_MD}")
    print(f"median saving: {payload['aggregate']['median_saving_pct']:+.2f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
