#!/usr/bin/env python3
"""P3.1 — consumer-facing agent-config security audit (road-to-security-pillar.md).

Points the Phase-1 detection logic at a *consumer's assembled* agent config —
instruction files (CLAUDE.md, AGENTS.md, .cursor/rules, copilot-instructions),
MCP configs (.mcp.json, .cursor/mcp.json, claude_desktop_config.json), settings
+ hooks (.claude/settings.json), and installed skills — and emits an A–F score
with a per-category breakdown mapped to the OWASP Top 10 for Agentic
Applications (ASI).

Detection is the same library as the self-audit gate (so there is one source of
truth for the patterns) under the same false-positive containment convention.
This is decision-support, not a guarantee: detection is probabilistic.

Usage:
  python3 src/scripts/security_audit_config.py [--root DIR] [--json]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from _lib import security_lint as sl  # noqa: E402
import lint_hidden_unicode as p11  # noqa: E402
import lint_instruction_smuggling as p12  # noqa: E402
import lint_mcp_config_security as p13  # noqa: E402
import lint_skill_frontmatter_safety as p14  # noqa: E402

# Consumer config surfaces (globs relative to --root).
SURFACES = [
    "CLAUDE.md", "AGENTS.md", "GEMINI.md", ".clinerules", ".windsurfrules",
    ".github/copilot-instructions.md",
    ".cursor/rules/**/*", ".cursorrules",
    ".claude/skills/**/SKILL.md", ".claude/commands/**/*.md",
    ".claude/settings.json", ".claude/settings.local.json",
    ".mcp.json", ".cursor/mcp.json", "claude_desktop_config.json",
]

# check id → (category, OWASP-ASI tag)
CATEGORY = {
    "hidden-unicode": ("Agents/Rules", "ASI01 Goal Hijack"),
    "instruction-smuggling": ("Agents/Rules", "ASI01 Goal Hijack"),
    "mcp-config-security": ("MCP", "ASI04 Supply Chain"),
    "dangerous-frontmatter": ("Permissions", "ASI03 Privilege Abuse"),
}
SECRET_HINT = "secret"  # mcp finding mentioning a secret → Secrets category
CATEGORIES = ["Secrets", "Permissions", "Hooks", "MCP", "Agents/Rules"]

# Deduction per finding (full weight); weighted findings scale by their weight.
_DEDUCT = {"HIGH": 25.0, "MED": 5.0, "LOW": 2.0}


def _grade(score: float) -> str:
    return ("A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70
            else "D" if score >= 60 else "F")


def _category(f) -> str:
    if f.check == "mcp-config-security" and SECRET_HINT in f.message.lower():
        return "Secrets"
    return CATEGORY.get(f.check, ("Agents/Rules", ""))[0]


def _iter_targets(root: Path):
    seen = set()
    for pattern in SURFACES:
        for p in root.glob(pattern):
            if p.is_file() and p not in seen:
                seen.add(p)
                yield p


def audit(root: Path) -> dict:
    findings = []
    for p in _iter_targets(root):
        try:
            sf = sl.scan_path(p, root)
        except (UnicodeDecodeError, OSError):
            continue
        for mod in (p11, p12, p13, p14):
            try:
                findings.extend(mod._scan(sf))
            except Exception:
                pass

    per_cat = {c: 100.0 for c in CATEGORIES}
    cat_findings = {c: [] for c in CATEGORIES}
    for f in findings:
        cat = _category(f)
        per_cat[cat] -= _DEDUCT.get(f.severity, 2.0) * float(f.weight)
        cat_findings[cat].append(f)
    for c in per_cat:
        per_cat[c] = max(0.0, per_cat[c])

    overall = round(sum(per_cat.values()) / len(CATEGORIES), 1)
    return {
        "root": str(root),
        "overall_score": overall,
        "overall_grade": _grade(overall),
        "categories": {
            c: {
                "score": round(per_cat[c], 1),
                "grade": _grade(per_cat[c]),
                "owasp": next((CATEGORY[fl.check][1] for fl in cat_findings[c]
                               if fl.check in CATEGORY), ""),
                "findings": [
                    {"path": fl.path, "line": fl.line, "check": fl.check,
                     "severity": fl.severity, "message": fl.message,
                     "weight": fl.weight}
                    for fl in cat_findings[c]
                ],
            }
            for c in CATEGORIES
        },
    }


def _print(report: dict) -> None:
    print(f"Agent-config security audit — {report['root']}")
    print(f"Overall: {report['overall_grade']} ({report['overall_score']}/100)\n")
    for c in CATEGORIES:
        cat = report["categories"][c]
        tag = f" · {cat['owasp']}" if cat["owasp"] else ""
        print(f"  {cat['grade']}  {c:<12} {cat['score']:>5}/100{tag}")
        for f in cat["findings"]:
            loc = f"{f['path']}:{f['line']}" if f["line"] else f["path"]
            w = "" if f["weight"] >= 1.0 else f" (weight {f['weight']:g})"
            print(f"        [{f['severity']}] {loc}{w}: {f['message']}")
    print("\n> Decision support, not a guarantee — detection is probabilistic. "
          "Pair with /threat-model and judge-security-auditor for a deep pass.")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, epilog=sl.GUIDELINE_EPILOG)
    ap.add_argument("--root", default=".", help="consumer repo root to audit (default: cwd)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    report = audit(Path(args.root))
    if args.json:
        import json
        print(json.dumps(report, indent=2))
    else:
        _print(report)
    # Audit is advisory: always exit 0 (it informs, it does not gate the consumer).
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
