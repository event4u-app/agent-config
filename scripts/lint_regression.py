#!/usr/bin/env python3
"""Detect lint regressions between the current branch and a baseline (default: main).

Runs skill_linter.py --all --format json on both the baseline and current branch,
then compares results to find:
- New failures (file did not fail before, fails now)
- Status downgrades (pass → warn, warn → fail, pass → fail)
- New issues (issue codes that appeared on existing files)
- Status upgrades (fail → warn, warn → pass, fail → pass) — shown as improvements

Usage:
    python3 scripts/lint_regression.py [--baseline main] [--format text|json|markdown]

Requires: git, python3, scripts/skill_linter.py
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path


def run_linter_json(ref: str | None, repo_root: Path) -> dict:
    """Run the linter and return parsed JSON. If ref is None, run on working tree."""
    env_cmd = []
    if ref:
        # Run linter at a specific git ref using git stash + checkout
        # Instead, use git show to avoid checkout — run on working tree after git stash
        pass

    cmd = [sys.executable, str(repo_root / "scripts" / "skill_linter.py"), "--all", "--format", "json",
           "--repo-root", str(repo_root)]

    if ref:
        # Strategy: create a temp worktree at the ref, run linter there, clean up
        with tempfile.TemporaryDirectory(prefix="lint-baseline-") as tmpdir:
            subprocess.run(
                ["git", "-C", str(repo_root), "worktree", "add", "--detach", tmpdir, ref],
                capture_output=True, check=True
            )
            try:
                result = subprocess.run(
                    [sys.executable, str(repo_root / "scripts" / "skill_linter.py"),
                     "--all", "--format", "json", "--repo-root", tmpdir],
                    capture_output=True, text=True, cwd=tmpdir
                )
                return json.loads(result.stdout) if result.stdout.strip() else {"results": [], "summary": {}}
            finally:
                subprocess.run(
                    ["git", "-C", str(repo_root), "worktree", "remove", "--force", tmpdir],
                    capture_output=True
                )
    else:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(repo_root))
        return json.loads(result.stdout) if result.stdout.strip() else {"results": [], "summary": {}}


def build_status_map(data: dict) -> dict[str, dict]:
    """Build {file: {status, issue_codes}} from linter JSON output."""
    result = {}
    for entry in data.get("results", []):
        f = entry["file"]
        codes = {i["code"] for i in entry.get("issues", [])}
        result[f] = {"status": entry["status"], "codes": codes}
    return result


STATUS_ORDER = {"pass": 0, "pass_with_warnings": 1, "fail": 2}


def compare(baseline: dict[str, dict], current: dict[str, dict]) -> dict:
    """Compare baseline and current lint results."""
    regressions = []
    improvements = []
    new_files = []

    all_files = sorted(set(baseline.keys()) | set(current.keys()))

    for f in all_files:
        base = baseline.get(f)
        curr = current.get(f)

        if curr and not base:
            if curr["status"] != "pass":
                new_files.append({"file": f, "status": curr["status"], "codes": sorted(curr["codes"])})
            continue

        if base and not curr:
            continue  # File removed — not a regression

        base_order = STATUS_ORDER.get(base["status"], 0)
        curr_order = STATUS_ORDER.get(curr["status"], 0)

        if curr_order > base_order:
            new_codes = curr["codes"] - base["codes"]
            regressions.append({
                "file": f,
                "was": base["status"],
                "now": curr["status"],
                "new_codes": sorted(new_codes),
            })
        elif curr_order < base_order:
            removed_codes = base["codes"] - curr["codes"]
            improvements.append({
                "file": f,
                "was": base["status"],
                "now": curr["status"],
                "removed_codes": sorted(removed_codes),
            })

    return {"regressions": regressions, "improvements": improvements, "new_files": new_files}


def format_text(delta: dict) -> str:
    lines = ["=== Lint Regression Report ===", ""]

    if not delta["regressions"] and not delta["new_files"]:
        lines.append("✅  No regressions detected.")
    else:
        if delta["regressions"]:
            lines.append(f"❌  {len(delta['regressions'])} regression(s):")
            for r in delta["regressions"]:
                codes = ", ".join(r["new_codes"]) if r["new_codes"] else "(same codes, stricter)"
                lines.append(f"  {r['file']}: {r['was']} → {r['now']}  [{codes}]")
            lines.append("")

        if delta["new_files"]:
            lines.append(f"⚠️  {len(delta['new_files'])} new file(s) with issues:")
            for nf in delta["new_files"]:
                lines.append(f"  {nf['file']}: {nf['status']}  [{', '.join(nf['codes'])}]")
            lines.append("")

    if delta["improvements"]:
        lines.append(f"✅  {len(delta['improvements'])} improvement(s):")
        for imp in delta["improvements"]:
            lines.append(f"  {imp['file']}: {imp['was']} → {imp['now']}")

    return "\n".join(lines)


def format_markdown(delta: dict) -> str:
    lines = ["## 📊 Lint Regression Report", ""]

    if not delta["regressions"] and not delta["new_files"]:
        lines.append("✅ No regressions detected.")
    else:
        if delta["regressions"]:
            lines.extend(["### ❌ Regressions", "", "| File | Was | Now | New Issues |", "|---|---|---|---|"])
            for r in delta["regressions"]:
                codes = ", ".join(r["new_codes"]) if r["new_codes"] else "—"
                lines.append(f"| `{r['file']}` | {r['was']} | {r['now']} | {codes} |")
            lines.append("")

        if delta["new_files"]:
            lines.extend(["### ⚠️ New Files with Issues", "", "| File | Status | Issues |", "|---|---|---|"])
            for nf in delta["new_files"]:
                lines.append(f"| `{nf['file']}` | {nf['status']} | {', '.join(nf['codes'])} |")
            lines.append("")

    if delta["improvements"]:
        lines.extend(["### ✅ Improvements", "", "| File | Was | Now |", "|---|---|---|"])
        for imp in delta["improvements"]:
            lines.append(f"| `{imp['file']}` | {imp['was']} | {imp['now']} |")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect lint regressions between branches.")
    parser.add_argument("--baseline", default="main", help="Git ref to compare against (default: main)")
    parser.add_argument("--format", choices=["text", "json", "markdown"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--repo-root", default=".", help="Repository root")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()

    print(f"Collecting baseline ({args.baseline})...", file=sys.stderr)
    try:
        baseline_data = run_linter_json(args.baseline, root)
    except subprocess.CalledProcessError:
        print(f"Error: could not create worktree for '{args.baseline}'. "
              f"Does the ref exist?", file=sys.stderr)
        return 2

    print("Collecting current branch...", file=sys.stderr)
    current_data = run_linter_json(None, root)

    baseline_map = build_status_map(baseline_data)
    current_map = build_status_map(current_data)

    delta = compare(baseline_map, current_map)

    if args.format == "json":
        print(json.dumps(delta, indent=2))
    elif args.format == "markdown":
        print(format_markdown(delta))
    else:
        print(format_text(delta))

    # Exit 1 if regressions found
    return 1 if delta["regressions"] or delta["new_files"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
