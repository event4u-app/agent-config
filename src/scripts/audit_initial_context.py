#!/usr/bin/env python3
"""Initial-context token audit (roadmap `road-to-lean-initial-context`).

Serves three roadmap steps with one analyzer (no new analyzer where one
exists — reuses `scripts/_lib/token_count.py`):

- **0B.2** — always-on rule-body footprint per tool projection.
- **0B.4** — description-catalog initial cost (skill + command name+desc).
- **1.3** — unified `audit:tokens` surfacing per-tool initial-token estimate,
  longest rules in tokens, and the description-catalog pool.

`char != token`: every number is reported in both. GPT counts are exact when
`tiktoken` is installed, else a documented proxy (see `token_count`).

Usage:
    python3 scripts/audit_initial_context.py            # markdown report → stdout
    python3 scripts/audit_initial_context.py --json     # machine-readable
    python3 scripts/audit_initial_context.py --write     # write report files
    python3 scripts/audit_initial_context.py --fail-if-over-budget  # CI gate (1.4)

Exit codes: 0 = ok (or no budget set); 1 = a measured surface exceeds its
configured token budget (only with --fail-if-over-budget).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import glob
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib import token_count  # noqa: E402
from _lib.agent_src import SRC_AGENT, SRC_DOMAINS  # noqa: E402

# 6.0.x: uncondensed source container moved to src/agent-src/ (ADR-051);
# commands live under src/domains/<pack>/<verb>/command.md since 6.0.0-D Step 10.
_CORE_SRC = SRC_AGENT
# Enforced source target — the command surface the description-catalog scans.
# Read by scripts/check_gate_paths.py so a future move that desyncs it fails CI
# instead of silently no-opping. Skills moved to the flat shared library
# (src/skills/) in 6.0.0-D Phase 2 and are no longer a source-container target;
# the skills catalog globs the flat library directly.
GATE_CORE_PATHS = (SRC_DOMAINS,)

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.stderr.write("error: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

REPORT_DIR = REPO_ROOT / "internal" / "bench" / "reports"

# Tools whose rules/ dir holds one .md per rule (full body projected today).
DIR_RULE_TOOLS = (".claude", ".augment", ".cursor")
# Tools whose always-on surface is a single monolithic file.
MONOLITH_TOOLS = (".windsurfrules",)

# MCP tool-schema accounting (road-to-mcp-token-accounting). Every connected
# MCP server's tool definitions (name + description + input schema) are
# always-loaded context for an MCP client — the same "what is this context
# costing?" question as the rule/description surfaces, for the MCP slice. The
# source-of-truth catalog is the one shipped by this package's MCP server.
MCP_CATALOG = REPO_ROOT / "src" / "scripts" / "mcp_server" / "consumer_tool_catalog.json"
# This package ships a single MCP server; the accounting is keyed by server so
# a multi-server consumer surface generalises without a shape change.
MCP_SERVER_NAME = "agent-config"
# Soft advisory ceiling on tool count per server. "Few used" cannot be known at
# audit time (no runtime call data), so over-subscription is a count-based
# heuristic: many tools => maintainer should review which earn their cost.
MCP_OVERSUBSCRIPTION_TOOL_CAP = 25

# Initial-token budget per surface (None = advisory only, no gate). These are
# soft ceilings the audit can enforce once a baseline is agreed (1.4). Set
# generously now; tighten as Phase 3 lands.
BUDGETS: dict[str, int | None] = {
    "rules.gpt": None,
    "skill_catalog.gpt": None,
    "command_catalog.gpt": None,
    "mcp_schemas.gpt": None,
}


def _frontmatter(path: Path) -> dict:
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return {}
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def _measure_files(paths: list[Path]) -> dict:
    blob = "".join(p.read_text(encoding="utf-8", errors="ignore") for p in paths)
    out = token_count.measure(blob)
    out["files"] = len(paths)
    return out


def rule_footprint() -> dict:
    """0B.2 — always-on rule footprint per tool."""
    tools: dict[str, dict] = {}
    for tool in DIR_RULE_TOOLS:
        files = sorted((REPO_ROOT / tool / "rules").glob("*.md"))
        if files:
            tools[tool] = _measure_files(files)
    for tool in MONOLITH_TOOLS:
        f = REPO_ROOT / tool
        if f.is_file():
            m = token_count.measure(f.read_text(encoding="utf-8", errors="ignore"))
            m["files"] = 1
            tools[tool] = m
    return tools


def _catalog(glob_pat: str) -> dict:
    entries = []
    for f in glob.glob(str(REPO_ROOT / glob_pat), recursive=True):
        fm = _frontmatter(Path(f))
        name = fm.get("name") or Path(f).parent.name
        desc = fm.get("description", "")
        if desc:
            entries.append(f"{name}: {desc}")
    m = token_count.measure("\n".join(entries))
    m["entries"] = len(entries)
    return m


def description_catalog() -> dict:
    """0B.4 — description-catalog cost (eager progressive-disclosure surface)."""
    return {
        "skills_projected": _catalog(".claude/skills/*/SKILL.md"),
        "skills_core_source": _catalog("src/skills/*/SKILL.md"),
        "commands_core_source": _catalog("src/domains/*/**/command.md"),
    }


def longest_rules(top: int = 10) -> list[dict]:
    """1.3 — longest rules in tokens (the trim candidates)."""
    rows = []
    for tool in DIR_RULE_TOOLS:
        d = REPO_ROOT / tool / "rules"
        if d.is_dir():
            for p in d.glob("*.md"):
                m = token_count.measure(p.read_text(encoding="utf-8", errors="ignore"))
                rows.append({"id": p.stem, "tokens_gpt": m["tokens_gpt"], "chars": m["chars"]})
            break  # one tool is representative — bodies are identical across DIR tools
    rows.sort(key=lambda r: (-r["tokens_gpt"], r["id"]))
    return rows[:top]


def thin_projection() -> dict:
    """Eager-vs-thin rule-layer footprint (Phase 3.1 lever).

    Reuses `scripts/project_thin_rules.py::measure` so the value dashboard can
    cite a single persisted source for both the eager always-on cost and the
    thin-projection saving. Returns an empty dict if the measurer is
    unavailable, so the audit never hard-fails on it.
    """
    try:
        from project_thin_rules import measure as _measure  # noqa: E402
        return _measure()
    except Exception:  # pragma: no cover — best-effort enrichment
        return {}


def _measure_tool_schema(tool: dict) -> dict:
    """Token cost of one MCP tool definition as a client loads it.

    An MCP ``tools/list`` entry carries ``name`` + ``description`` +
    ``inputSchema``; that triple is what lands in an MCP client's always-on
    context. Price the serialized triple, not the whole catalog record (the
    catalog's bookkeeping fields — ``side_effect``, ``implemented_on`` — are
    not sent to the client).
    """
    payload = json.dumps(
        {
            "name": tool.get("name", ""),
            "description": tool.get("description", ""),
            "inputSchema": tool.get("input_schema", {}),
        },
        separators=(",", ":"),
        sort_keys=True,
    )
    m = token_count.measure(payload)
    m["name"] = tool.get("name", "")
    return m


def mcp_tool_schemas() -> dict:
    """Per-server MCP tool-schema footprint (road-to-mcp-token-accounting).

    Prices each tool definition the package's MCP server exposes and folds the
    result into the same initial-context budget surface as rules/descriptions
    (NOT a new surface). Returns an empty dict when the catalog is absent so the
    audit never hard-fails on it. Shape is keyed by server name so a
    multi-server consumer generalises without a change here.
    """
    if not MCP_CATALOG.is_file():
        return {}
    try:
        catalog = json.loads(MCP_CATALOG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):  # pragma: no cover — defensive
        return {}
    tools = catalog.get("tools") or []
    priced = [_measure_tool_schema(t) for t in tools if isinstance(t, dict)]
    priced.sort(key=lambda r: (-int(r["tokens_gpt"]), str(r["name"])))
    server = {
        "tool_count": len(priced),
        "chars": sum(int(r["chars"]) for r in priced),
        "tokens_gpt": sum(int(r["tokens_gpt"]) for r in priced),
        "tokens_claude": sum(int(r["tokens_claude"]) for r in priced),
        "tokens_gpt_exact": all(bool(r["tokens_gpt_exact"]) for r in priced) if priced else True,
        "over_subscription": len(priced) > MCP_OVERSUBSCRIPTION_TOOL_CAP,
        "oversubscription_cap": MCP_OVERSUBSCRIPTION_TOOL_CAP,
        "tools": [
            {"name": r["name"], "tokens_gpt": r["tokens_gpt"], "chars": r["chars"]}
            for r in priced
        ],
    }
    return {MCP_SERVER_NAME: server}


def build() -> dict:
    return {
        "generated": _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds"),
        "token_method": token_count.method_note(),
        "rule_footprint": rule_footprint(),
        "thin_projection": thin_projection(),
        "description_catalog": description_catalog(),
        "longest_rules": longest_rules(),
        "mcp_tool_schemas": mcp_tool_schemas(),
    }


def render_md(d: dict) -> str:
    L = ["# Initial-context token audit", "",
         f"- generated: `{d['generated']}`",
         f"- token method: {d['token_method']}", "",
         "## 0B.2 — always-on rule footprint per tool", "",
         "| tool | files | chars | GPT tok | Claude tok |",
         "|---|--:|--:|--:|--:|"]
    for tool, m in d["rule_footprint"].items():
        L.append(f"| `{tool}` | {m['files']} | {m['chars']:,} | {m['tokens_gpt']:,} | {m['tokens_claude']:,} |")
    L += ["", "## 0B.4 — description-catalog cost (eager)", "",
          "| catalog | entries | chars | GPT tok | Claude tok |",
          "|---|--:|--:|--:|--:|"]
    for name, m in d["description_catalog"].items():
        L.append(f"| {name} | {m['entries']} | {m['chars']:,} | {m['tokens_gpt']:,} | {m['tokens_claude']:,} |")
    L += ["", "## 1.3 — top-10 longest rules (token trim candidates)", "",
          "| rule | GPT tok | chars |", "|---|--:|--:|"]
    for r in d["longest_rules"]:
        L.append(f"| `{r['id']}` | {r['tokens_gpt']:,} | {r['chars']:,} |")
    mcp = d.get("mcp_tool_schemas") or {}
    if mcp:
        L += ["", "## MCP — tool-schema cost per server (always-loaded for connected clients)", "",
              "| server | tools | chars | GPT tok | Claude tok | over-subscribed? |",
              "|---|--:|--:|--:|--:|:--:|"]
        for server, m in mcp.items():
            flag = "⚠️ yes" if m["over_subscription"] else "no"
            L.append(
                f"| `{server}` | {m['tool_count']} | {m['chars']:,} | "
                f"{m['tokens_gpt']:,} | {m['tokens_claude']:,} | {flag} |"
            )
        for server, m in mcp.items():
            if m["over_subscription"]:
                L += ["",
                      f"> ⚠️  `{server}` exposes {m['tool_count']} tools "
                      f"(> {m['oversubscription_cap']} soft cap). Every tool schema is "
                      f"always-loaded for connected MCP clients — review which tools earn "
                      f"their context cost. (\"Few used\" needs runtime call data, not "
                      f"available at audit time; this is a count-based heuristic.)"]
            top = m["tools"][:10]
            if top:
                L += ["", f"### `{server}` — top-{len(top)} tools by schema cost", "",
                      "| tool | GPT tok | chars |", "|---|--:|--:|"]
                for t in top:
                    L.append(f"| `{t['name']}` | {t['tokens_gpt']:,} | {t['chars']:,} |")
    L.append("")
    return "\n".join(L)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--write", action="store_true", help="write report files under internal/bench/reports/")
    ap.add_argument("--fail-if-over-budget", action="store_true",
                    help="exit 1 if a surface exceeds its configured token budget (1.4)")
    args = ap.parse_args(argv)

    data = build()

    if args.fail_if_over_budget:
        breaches = []
        rf = next(iter(data["rule_footprint"].values()), {})
        mcp = data.get("mcp_tool_schemas") or {}
        mcp_gpt = sum(int(s["tokens_gpt"]) for s in mcp.values())
        checks = {
            "rules.gpt": rf.get("tokens_gpt", 0),
            "skill_catalog.gpt": data["description_catalog"]["skills_projected"]["tokens_gpt"],
            "command_catalog.gpt": data["description_catalog"]["commands_core_source"]["tokens_gpt"],
            "mcp_schemas.gpt": mcp_gpt,
        }
        for key, val in checks.items():
            cap = BUDGETS.get(key)
            if cap is not None and val > cap:
                breaches.append(f"{key} {val} > budget {cap}")
        if breaches:
            print("❌  initial-context budget: " + "; ".join(breaches))
            return 1
        print("✅  initial-context budget: pass (or advisory-only)")
        return 0

    if args.json:
        print(json.dumps(data, indent=2, sort_keys=True))
    else:
        print(render_md(data))

    if args.write:
        REPORT_DIR.mkdir(parents=True, exist_ok=True)
        (REPORT_DIR / "projection-cost.json").write_text(
            json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")
        (REPORT_DIR / "projection-cost.md").write_text(render_md(data), encoding="utf-8")
        print(f"\n→ wrote {REPORT_DIR.relative_to(REPO_ROOT)}/projection-cost.{{json,md}}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
