#!/usr/bin/env python3
"""Group cost-tracking sessions by conversation_id (the external runtime `conversation.mjs` `5b71c7a` ref)."""
from __future__ import annotations
import argparse, json, sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_JSONL = REPO_ROOT / "agents" / "cost-tracking" / "sessions.jsonl"


def _load(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        try:
            out.append(json.loads(s))
        except json.JSONDecodeError:
            continue
    return out


def group(rows: list[dict]) -> dict:
    by_conv: dict = defaultdict(lambda: {
        "sessions": 0, "total_cost_usd": 0.0, "input_tokens": 0,
        "output_tokens": 0, "telegraph_delta_tokens": 0,
        "by_model": defaultdict(lambda: {"sessions": 0, "cost_usd": 0.0}),
    })
    for row in rows:
        cid = str(row.get("conversation_id") or "unknown")
        b = by_conv[cid]
        cost = float(row.get("total_cost_usd") or 0)
        b["sessions"] += 1
        b["total_cost_usd"] += cost
        b["input_tokens"] += int(row.get("input_tokens") or 0)
        b["output_tokens"] += int(row.get("output_tokens") or 0)
        b["telegraph_delta_tokens"] += int(row.get("telegraph_delta_tokens") or 0)
        m = b["by_model"][str(row.get("model") or "unknown")]
        m["sessions"] += 1
        m["cost_usd"] += cost
    return {cid: {**b, "by_model": dict(b["by_model"])} for cid, b in by_conv.items()}


def render_text(report: dict) -> str:
    if not report:
        return "cost-by-conversation: no rows.\n"
    lines = ["cost-by-conversation lens · grouped by conversation_id", ""]
    for cid, b in sorted(report.items()):
        lines.append(
            f"  {cid}: {b['sessions']} sessions · ${b['total_cost_usd']:.4f} · "
            f"in {b['input_tokens']:,} · out {b['output_tokens']:,} · "
            f"telegraph_delta {b['telegraph_delta_tokens']:+,}"
        )
        for model, m in sorted(b["by_model"].items()):
            lines.append(f"      {model}: {m['sessions']} sessions · ${m['cost_usd']:.4f}")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--input", type=Path, default=DEFAULT_JSONL)
    p.add_argument("--format", choices=["text", "json"], default="text")
    args = p.parse_args(argv)
    report = group(_load(args.input))
    if args.format == "json":
        print(json.dumps({"schema_version": "cost-by-conversation/v1",
                          "by_conversation": report}, indent=2))
    else:
        print(render_text(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
