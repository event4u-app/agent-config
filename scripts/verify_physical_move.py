#!/usr/bin/env python3
"""Verify the post-move state matches the pre-move snapshot byte-for-byte.

Re-runs `task sync` + `task build-discovery` (caller invokes them
ahead of this script), then loads the fresh outputs and compares them
against `dist/migration/pre-move-snapshot.json`. The contract:

- `.agent-src/` tree hashes must match exactly
- `.augment/` tree hashes must match exactly
- `dist/discovery/discovery-manifest.json` with `artefacts[].path`
  stripped + `generated_at` dropped must match exactly

Anything else is a regression — exit non-zero with a diff summary.

CLI:
  --snapshot PATH   path to pre-move snapshot JSON
  --json            machine-readable verdict to stdout
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from snapshot_agent_outputs import _build_snapshot  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SNAPSHOT = ROOT / "dist" / "migration" / "pre-move-snapshot.json"


def _diff_tree(name: str, before: dict[str, str], after: dict[str, str]) -> list[str]:
    issues: list[str] = []
    keys = sorted(set(before) | set(after))
    for k in keys:
        b = before.get(k)
        a = after.get(k)
        if b is None:
            issues.append(f"  {name}: added   {k}")
        elif a is None:
            issues.append(f"  {name}: removed {k}")
        elif a != b:
            issues.append(f"  {name}: changed {k}  ({b[:12]}… → {a[:12]}…)")
    return issues


def _diff_manifest(before: dict[str, Any] | None, after: dict[str, Any] | None) -> list[str]:
    if before is None and after is None:
        return []
    if before is None:
        return ["  manifest: pre-move snapshot missing"]
    if after is None:
        return ["  manifest: post-move manifest missing"]
    before_str = json.dumps(before, sort_keys=True, ensure_ascii=False)
    after_str = json.dumps(after, sort_keys=True, ensure_ascii=False)
    if before_str == after_str:
        return []
    # Field-level diff for visibility.
    issues = ["  manifest: path-stripped content differs"]
    b_arts = {a.get("name", "?"): a for a in (before.get("artefacts") or [])}
    a_arts = {a.get("name", "?"): a for a in (after.get("artefacts") or [])}
    only_b = sorted(set(b_arts) - set(a_arts))
    only_a = sorted(set(a_arts) - set(b_arts))
    for n in only_b[:10]:
        issues.append(f"    artefact removed: {n}")
    for n in only_a[:10]:
        issues.append(f"    artefact added:   {n}")
    common_changed = []
    for n in sorted(set(b_arts) & set(a_arts)):
        if json.dumps(b_arts[n], sort_keys=True) != json.dumps(a_arts[n], sort_keys=True):
            common_changed.append(n)
    for n in common_changed[:10]:
        issues.append(f"    artefact changed: {n}")
    return issues


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--snapshot", type=Path, default=DEFAULT_SNAPSHOT)
    ap.add_argument("--json", action="store_true", help="emit machine-readable verdict to stdout")
    args = ap.parse_args()

    if not args.snapshot.exists():
        print(f"ERROR: snapshot missing: {args.snapshot}", file=sys.stderr)
        return 2

    before = json.loads(args.snapshot.read_text(encoding="utf-8"))
    after = _build_snapshot()

    issues: list[str] = []
    for key in (".agent-src", ".augment"):
        issues.extend(_diff_tree(key, before["trees"].get(key, {}), after["trees"].get(key, {})))
    issues.extend(_diff_manifest(before.get("manifest_path_stripped"), after.get("manifest_path_stripped")))

    ok = not issues
    if args.json:
        print(json.dumps({
            "ok": ok,
            "issue_count": len(issues),
            "issues": issues,
        }, indent=2))
    else:
        if ok:
            print("verify_physical_move: byte-identity OK")
            print(f"  .agent-src/ files: {len(after['trees'].get('.agent-src', {}))}")
            print(f"  .augment/   files: {len(after['trees'].get('.augment', {}))}")
            print(f"  manifest: path-stripped content matches")
        else:
            print(f"verify_physical_move: FAIL ({len(issues)} issue(s))")
            for line in issues[:50]:
                print(line)
            if len(issues) > 50:
                print(f"  … and {len(issues) - 50} more")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
