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
from snapshot_agent_outputs import (  # noqa: E402
    _build_snapshot,
    _logical_path,
    _SKIP_DIRS,
    _SKIP_NAMES,
)


def _normalise_loaded_snapshot(snap: dict[str, Any]) -> None:
    """Re-apply current snapshot filters to a previously-captured snapshot.

    The pre-move snapshot file is immutable history; this lets verify
    compare it against a freshly-captured post-move snapshot whose
    filters have evolved (runtime-cache exclusion, logical-path stripping,
    volatile-field drop) without regenerating the reference.
    """
    for key, tree in (snap.get("trees") or {}).items():
        keep = {}
        for path, sha in tree.items():
            name = path.rsplit("/", 1)[-1]
            if name in _SKIP_NAMES:
                continue
            if any(part in _SKIP_DIRS for part in path.split("/")):
                continue
            keep[path] = sha
        snap["trees"][key] = keep
    m = snap.get("manifest_path_stripped")
    if isinstance(m, dict):
        for k in ("unassigned", "documented_unassigned"):
            entries = m.get(k) or []
            normalised: list[dict[str, Any]] = []
            for e in entries:
                if not isinstance(e, dict):
                    normalised.append(e)
                    continue
                if "path" in e:
                    e["path"] = _logical_path(e["path"])
                path = e.get("path", "")
                name = path.rsplit("/", 1)[-1]
                if name in _SKIP_NAMES:
                    continue
                if any(part in _SKIP_DIRS for part in path.split("/")):
                    continue
                normalised.append(e)
            normalised.sort(key=lambda e: (e.get("path", ""), e.get("category", "")))
            m[k] = normalised
        # Recompute the two counts that ride on the filtered lists so the
        # stats block stays consistent with the normalised entries.
        stats = m.get("stats")
        if isinstance(stats, dict):
            stats["documented_unassigned_count"] = len(m.get("documented_unassigned") or [])
            stats["unassigned_count"] = len(m.get("unassigned") or [])
        # Re-sort artefacts by (category, checksum) — pre-move snapshot
        # was sorted by path; that order shifts when files move roots.
        arts = m.get("artefacts") or []
        for a in arts:
            a.pop("path", None)
        arts.sort(key=lambda a: (a.get("category", ""), a.get("checksum", "")))
        m["artefacts"] = arts
        m.pop("checksum", None)
        m.pop("scanner_version", None)

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

    # The pre-move snapshot was captured before _hash_tree / manifest
    # stripping learned to filter runtime artefacts. Re-apply the current
    # filter to the loaded snapshot so the diff is apples-to-apples.
    _normalise_loaded_snapshot(before)

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
