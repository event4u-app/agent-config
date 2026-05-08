#!/usr/bin/env python3
"""Measure the Augment workspace-guidelines budget (Phase 1.1 of
road-to-augment-limit-fit).

Mirrors Augment's accounting model for the workspace prompt:

1. `AGENTS.md` body (full file, including frontmatter) injected verbatim.
2. `always`-type rules under `.augment/rules/` — full body injected.
3. `auto`-type rules — only a registry stub is injected per rule:

       If the user prompt matches the description "<desc>", read the
       file located in <path>

   The body of an `auto` rule is NOT counted; only the stub line is.

The 49,512-char ceiling is the empirical limit observed against the
Augment Code workspace prompt (2026-05-08 baseline). This script emits
a per-component breakdown plus the total against that ceiling.

Output:
- Default: stdout summary (totals + per-component breakdown).
- `--json`: deterministic JSON.
- `--trend-append`: append a snapshot record to
  `agents/.augment-budget-history.jsonl`.

Exit codes: 0 = under fail threshold, 1 = at/above fail threshold,
3 = internal error.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_MD = REPO_ROOT / "AGENTS.md"
RULES_DIR = REPO_ROOT / ".augment" / "rules"
TREND_FILE = REPO_ROOT / "agents" / ".augment-budget-history.jsonl"

# Augment workspace-guidelines ceiling — empirical 2026-05-08.
TOTAL_CAP = 49_512
WARN_THRESHOLD = 0.85
FAIL_THRESHOLD = 0.95

# Stub template Augment injects for `type: auto` rules. Measured by
# subtracting variable-length fields (description, path) from a real
# rendered stub in the host system prompt.
STUB_TEMPLATE = (
    'If the user prompt matches the description "{desc}", '
    "read the file located in {path}"
)


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    fm_block = text[4:end]
    body = text[end + 4 :].lstrip("\n")
    fm: dict[str, str] = {}
    for line in fm_block.splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return fm, body


def measure() -> dict:
    components: dict[str, dict] = {}

    # 1. AGENTS.md
    agents_text = AGENTS_MD.read_text() if AGENTS_MD.exists() else ""
    components["agents_md"] = {
        "path": str(AGENTS_MD.relative_to(REPO_ROOT)),
        "chars": len(agents_text),
    }

    # 2 + 3. Rules under .augment/rules/.
    always_total = 0
    always_rules: list[dict] = []
    auto_total = 0
    auto_rules: list[dict] = []

    for rule_path in sorted(RULES_DIR.glob("*.md")):
        text = rule_path.read_text()
        fm, _body = parse_frontmatter(text)
        rtype = fm.get("type", "")
        rel = str(rule_path.relative_to(REPO_ROOT))
        if rtype == "always":
            chars = len(text)
            always_total += chars
            always_rules.append({"path": rel, "chars": chars})
        elif rtype == "auto":
            desc = fm.get("description", "")
            stub = STUB_TEMPLATE.format(desc=desc, path=rel)
            chars = len(stub)
            auto_total += chars
            auto_rules.append(
                {"path": rel, "desc_chars": len(desc), "stub_chars": chars}
            )

    components["always_rules"] = {
        "count": len(always_rules),
        "chars": always_total,
        "rules": sorted(always_rules, key=lambda r: -r["chars"]),
    }
    components["auto_rules"] = {
        "count": len(auto_rules),
        "chars": auto_total,
        "rules": sorted(auto_rules, key=lambda r: -r["stub_chars"]),
    }

    total = (
        components["agents_md"]["chars"]
        + always_total
        + auto_total
    )
    return {
        "ts": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total": total,
        "cap": TOTAL_CAP,
        "utilisation": round(total / TOTAL_CAP, 4),
        "components": components,
    }


def render_text(data: dict) -> str:
    total = data["total"]
    cap = data["cap"]
    util = data["utilisation"]
    a = data["components"]["agents_md"]["chars"]
    ar = data["components"]["always_rules"]
    aur = data["components"]["auto_rules"]
    lines = [
        f"Augment workspace-guidelines budget — cap {cap:,} chars",
        "",
        f"  AGENTS.md          {a:>6,} chars  ({a/cap*100:5.1f}%)",
        f"  always-rules ({ar['count']:>2})  {ar['chars']:>6,} chars  ({ar['chars']/cap*100:5.1f}%)",
        f"  auto-rule stubs ({aur['count']:>2}) {aur['chars']:>6,} chars  ({aur['chars']/cap*100:5.1f}%)",
        "  " + "-" * 50,
        f"  TOTAL              {total:>6,} chars  ({util*100:5.1f}%)",
        "",
    ]
    if util >= 1.0:
        lines.append(f"❌  OVER CAP by {total - cap:,} chars")
    elif util >= FAIL_THRESHOLD:
        lines.append(f"❌  FAIL — utilisation {util*100:.1f}% ≥ {FAIL_THRESHOLD*100:.0f}%")
    elif util >= WARN_THRESHOLD:
        lines.append(f"⚠️   WARN — utilisation {util*100:.1f}% ≥ {WARN_THRESHOLD*100:.0f}%")
    else:
        lines.append(f"✅  OK — utilisation {util*100:.1f}%")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument(
        "--trend-append",
        action="store_true",
        help="Append a snapshot record to agents/.augment-budget-history.jsonl",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero when utilisation ≥ FAIL_THRESHOLD or over cap",
    )
    args = parser.parse_args()

    data = measure()

    if args.trend_append:
        TREND_FILE.parent.mkdir(parents=True, exist_ok=True)
        rec = {
            "ts": data["ts"],
            "total": data["total"],
            "cap": data["cap"],
            "utilisation": data["utilisation"],
            "agents_md": data["components"]["agents_md"]["chars"],
            "always_rules": data["components"]["always_rules"]["chars"],
            "auto_rules": data["components"]["auto_rules"]["chars"],
        }
        with TREND_FILE.open("a") as fh:
            fh.write(json.dumps(rec, sort_keys=True) + "\n")

    if args.json:
        print(json.dumps(data, indent=2, sort_keys=True))
    else:
        print(render_text(data))

    if args.check:
        if data["utilisation"] >= 1.0 or data["utilisation"] >= FAIL_THRESHOLD:
            return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pragma: no cover - defensive top-level guard
        print(f"❌  measure_augment_budget: internal error: {exc}", file=sys.stderr)
        sys.exit(3)
