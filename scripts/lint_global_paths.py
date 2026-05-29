#!/usr/bin/env python3
"""Permissions-audit entry-gate for the global install tree.

Phase 5.0 / amendment A7 of road-to-global-only-install. Runs BEFORE
any legacy snapshot write so a perms leak cannot be created by the
migration itself. Historically invoked by `agent-config migrate-to-global`;
that command was collapsed into `agent-config migrate` (see
`docs/contracts/migrate-command.md`). The audit now runs standalone via
`agent-config doctor` or directly through this script.

Policy source: scripts/expected_perms.json (parameterised so the policy
can evolve without code changes).

Exit codes:
    0  — all checks pass.
    1  — at least one finding (printed to stdout, one finding per line).
    2  — bad invocation (missing policy, JSON parse error, etc).

Usage:
    python3 scripts/lint_global_paths.py
    python3 scripts/lint_global_paths.py --policy scripts/expected_perms.json
    python3 scripts/lint_global_paths.py --quiet

The script is intentionally read-only — no fixups, no chmod, no creates.
The migration owns side effects.
"""

from __future__ import annotations

import argparse
import json
import os
import stat
import sys
from pathlib import Path

DEFAULT_POLICY = Path(__file__).resolve().parent / "expected_perms.json"


def _expand(p: str) -> Path:
    return Path(os.path.expanduser(p))


def _mode_str(mode: int) -> str:
    return f"0{stat.S_IMODE(mode):03o}"


def _check_mode(path: Path, expected: str, kind: str) -> str | None:
    """Return finding text or None when path is clean."""
    if not path.exists():
        return None  # missing optional paths are silent — checked by `required`
    try:
        actual = _mode_str(path.stat().st_mode)
    except OSError as exc:
        return f"{path}: stat failed ({exc})"
    if actual != expected:
        return f"{path}: {kind} mode {actual} (expected {expected})"
    return None


def _check_symlinks(root: Path) -> list[str]:
    """All symlinks under `root` must resolve to paths still under `root`."""
    findings: list[str] = []
    if not root.exists():
        return findings
    root_resolved = root.resolve()
    for entry in root.rglob("*"):
        if not entry.is_symlink():
            continue
        try:
            target = entry.resolve(strict=False)
        except OSError as exc:
            findings.append(f"{entry}: symlink resolve failed ({exc})")
            continue
        try:
            target.relative_to(root_resolved)
        except ValueError:
            findings.append(f"{entry}: symlink escapes global root → {target}")
    return findings


def _check_glob(root: Path, glob: str, expected_mode: str, required: bool, kind: str) -> list[str]:
    findings: list[str] = []
    # Globs anchored at ~ are pre-expanded; reduce them to a root-relative pattern.
    home = Path.home()
    pattern_path = Path(os.path.expanduser(glob))
    try:
        rel = pattern_path.relative_to(home)
    except ValueError:
        rel = pattern_path
    matches = list(home.glob(str(rel)))
    if not matches and required:
        findings.append(f"{glob}: required {kind} missing")
        return findings
    for match in matches:
        finding = _check_mode(match, expected_mode, kind)
        if finding:
            findings.append(finding)
    return findings


def lint(policy_path: Path, quiet: bool = False) -> int:
    try:
        policy = json.loads(policy_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: policy load failed: {exc}", file=sys.stderr)
        return 2

    findings: list[str] = []

    root_spec = policy.get("global_root") or {}
    root_path = _expand(root_spec.get("path", "~/.event4u/agent-config"))
    if root_path.exists():
        finding = _check_mode(root_path, root_spec.get("expected_mode", "0700"), "directory")
        if finding:
            findings.append(finding)
        findings.extend(_check_symlinks(root_path))

    for spec in policy.get("files", []):
        findings.extend(_check_glob(
            root_path, spec["glob"], spec["expected_mode"],
            spec.get("required", False), "file",
        ))
    for spec in policy.get("directories", []):
        findings.extend(_check_glob(
            root_path, spec["glob"], spec["expected_mode"],
            spec.get("required", False), "directory",
        ))

    if not findings:
        if not quiet:
            print(f"✅ global paths clean ({root_path})")
        return 0
    for f in findings:
        print(f"❌ {f}")
    return 1


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    return lint(args.policy, quiet=args.quiet)


if __name__ == "__main__":
    sys.exit(main())
