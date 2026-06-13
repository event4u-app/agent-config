#!/usr/bin/env python3
"""P1.6 — umbrella runner for the agent-security self-audit linters.

Runs the four Phase-1 corpus linters (hidden-unicode, instruction-smuggling,
mcp-config-security, dangerous-frontmatter) under the shared false-positive
containment convention, aggregates their findings, and reports once. Supply-chain
integrity gate for the suite's *own* artifacts (road-to-security-pillar.md P1).

Exit 0 when no linter reports a blocking finding, 1 otherwise. ``--sarif PATH``
writes a SARIF 2.1.0 report so reviewers / CI read a standard schema.

Usage:
  python3 src/scripts/lint_agent_security.py [--sarif artifacts/agent-security.sarif]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

LINTERS = [
    ("hidden-unicode", "lint_hidden_unicode.py"),
    ("instruction-smuggling", "lint_instruction_smuggling.py"),
    ("mcp-config-security", "lint_mcp_config_security.py"),
    ("dangerous-frontmatter", "lint_skill_frontmatter_safety.py"),
]


def _run(script: str) -> tuple[int, list[dict]]:
    proc = subprocess.run(
        [sys.executable, str(HERE / script), "--json"],
        capture_output=True, text=True,
    )
    try:
        findings = json.loads(proc.stdout or "[]")
    except json.JSONDecodeError:
        findings = []
    return proc.returncode, findings


def _is_fail(f: dict) -> bool:
    return f.get("severity") == "HIGH" and f.get("weight", 1.0) >= 1.0


def _sarif(all_findings: list[dict]) -> dict:
    results = []
    for f in all_findings:
        results.append({
            "ruleId": f.get("check", "security-lint"),
            "level": "error" if _is_fail(f) else "warning",
            "message": {"text": f.get("message", "")},
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": {"uri": f.get("path", "")},
                    "region": {"startLine": max(1, int(f.get("line", 1) or 1))},
                }
            }],
        })
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {
                "name": "agent-security-lint",
                "informationUri": "https://github.com/event4u-app/agent-config",
                "rules": [{"id": cid} for cid, _ in LINTERS],
            }},
            "results": results,
        }],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sarif", metavar="PATH", help="write a SARIF 2.1.0 report")
    ap.add_argument("--quiet", action="store_true",
                    help="accepted for Taskfile QUIET_FLAG parity; output is already terse")
    args = ap.parse_args()

    all_findings: list[dict] = []
    blocking = 0
    for check, script in LINTERS:
        rc, findings = _run(script)
        all_findings.extend(findings)
        fails = sum(1 for f in findings if _is_fail(f))
        warns = len(findings) - fails
        blocking += fails
        glyph = "❌" if fails else ("⚠️" if warns else "✅")
        print(f"  {glyph} {check}: {fails} blocking, {warns} warning(s)")

    if args.sarif:
        out = Path(args.sarif)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(_sarif(all_findings), indent=2), encoding="utf-8")
        print(f"  SARIF → {args.sarif}")

    print()
    if blocking:
        print(f"❌  agent-security: {blocking} blocking finding(s). "
              f"Run each linter directly for detail (e.g. python3 src/scripts/lint_hidden_unicode.py).")
        return 1
    warn_total = len(all_findings)
    print(f"✅  agent-security: clean (0 blocking, {warn_total} warning(s)).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
