#!/usr/bin/env python3
"""Phase 4.2 — Probe per-tool projection fidelity against the fixture.

Reads tests/fixtures/projection_fidelity/fixtures.yml, walks the
projected trees (.augment/, .claude/, .cursor/, .clinerules/,
.windsurfrules, .windsurf/), and records pass/fail/partial per check.

Output: agents/runtime/reports/projection-fidelity.json + stdout summary.

Pure stdlib (PyYAML reuse from scripts/_lib if installed; otherwise
inline minimal YAML loader for the fixture's restricted shape).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    print("❌  PyYAML required (already a project dep)", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parent.parent

TREES = {
    "augment": ROOT / ".augment",
    "claude": ROOT / ".claude",
    "cursor_mdc": ROOT / ".cursor" / "rules",
    "cursor_commands": ROOT / ".cursor" / "commands",
    "cline": ROOT / ".clinerules",
    "windsurf": ROOT / ".windsurfrules",
    "windsurf_workflows": ROOT / ".windsurf" / "workflows",
}


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    if not path.exists():
        return {}, ""
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    try:
        fm = yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        fm = {}
    return fm if isinstance(fm, dict) else {}, parts[2]


def locate(tree_key: str, entry_type: str, src: str) -> Path | None:
    """Locate the projected artefact in a given tree."""
    name = Path(src).stem  # 'laravel-routing'
    if entry_type == "rule":
        if tree_key in ("augment", "claude"):
            p = TREES[tree_key] / "rules" / Path(src).name
            return p if p.exists() else None
        if tree_key == "cursor_mdc":
            p = TREES[tree_key] / f"{name}.mdc"
            return p if p.exists() else None
        if tree_key == "cline":
            p = TREES[tree_key] / f"{name}.md"
            return p if p.exists() else None
        if tree_key == "windsurf":
            return TREES[tree_key] if TREES[tree_key].exists() else None
    if entry_type == "skill":
        if tree_key in ("augment", "claude"):
            p = TREES[tree_key] / "skills" / Path(src).parent.name / "SKILL.md"
            return p if p.exists() else None
    if entry_type == "command":
        if tree_key == "augment":
            p = TREES[tree_key] / "commands" / Path(src).name
            return p if p.exists() else None
        if tree_key == "claude":
            p = TREES[tree_key] / "skills" / name / "SKILL.md"
            return p if p.exists() else None
        if tree_key == "cursor_commands":
            p = TREES[tree_key] / f"{name}.md"
            return p if p.exists() else None
        if tree_key == "windsurf_workflows":
            p = TREES[tree_key] / f"{name}.md"
            return p if p.exists() else None
    return None


def check_entry(entry: dict) -> dict:
    out = {"id": entry["id"], "type": entry["type"], "tier": entry.get("tier"), "results": {}}
    for tool, spec in (entry.get("checks") or {}).items():
        result = {"status": "pass", "details": []}
        expect_present = spec.get("present", True)
        path = locate(tool, entry["type"], entry["source"])

        if tool == "windsurf" and spec.get("concatenated_in"):
            fp = ROOT / spec["concatenated_in"]
            if not fp.exists():
                result["status"] = "fail"
                result["details"].append(f"missing concat file {spec['concatenated_in']}")
            else:
                body = fp.read_text(encoding="utf-8")
                needle = spec.get("body_contains")
                if needle and needle not in body:
                    result["status"] = "fail"
                    result["details"].append(f"body missing '{needle}'")
                if spec.get("routes_to_visible") is False and "routes_to" in body:
                    result["details"].append("note: routes_to leaks into concat (info)")
            out["results"][tool] = result
            continue

        if expect_present and path is None:
            result["status"] = "fail"
            result["details"].append("file not found")
            out["results"][tool] = result
            continue
        if not expect_present:
            if path is not None:
                result["status"] = "fail"
                result["details"].append(f"unexpected file at {path}")
            else:
                result["details"].append(f"absent (ok: {spec.get('rationale', '')})")
            out["results"][tool] = result
            continue

        fm, body = parse_frontmatter(path)
        for key in spec.get("frontmatter_keys", []) or []:
            if key not in fm:
                result["status"] = "fail"
                result["details"].append(f"frontmatter missing '{key}'")
        for key in spec.get("frontmatter_drops", []) or []:
            if key in fm:
                result["status"] = "fail"
                result["details"].append(f"frontmatter unexpectedly contains '{key}'")
        if spec.get("alwaysApply") is not None and fm.get("alwaysApply") != spec["alwaysApply"]:
            result["status"] = "partial"
            result["details"].append(
                f"alwaysApply={fm.get('alwaysApply')!r} expected {spec['alwaysApply']!r}"
            )
        trig_kw = spec.get("triggers_keyword_contains") or []
        trig_pp = spec.get("triggers_path_prefix_contains") or []
        if trig_kw or trig_pp:
            trigs = fm.get("triggers") or []
            kws = [t.get("keyword") for t in trigs if isinstance(t, dict) and t.get("keyword")]
            pps = [t.get("path_prefix") for t in trigs if isinstance(t, dict) and t.get("path_prefix")]
            for kw in trig_kw:
                if kw not in kws:
                    result["status"] = "fail"
                    result["details"].append(f"trigger keyword '{kw}' missing")
            for pp in trig_pp:
                if pp not in pps:
                    result["status"] = "fail"
                    result["details"].append(f"trigger path_prefix '{pp}' missing")
        routes = spec.get("routes_to_contains") or []
        if routes:
            rt = fm.get("routes_to") or []
            for r in routes:
                if r not in rt:
                    result["status"] = "fail"
                    result["details"].append(f"routes_to missing '{r}'")
        body_needle = spec.get("body_contains")
        if body_needle and body_needle not in body:
            result["status"] = "fail"
            result["details"].append(f"body missing '{body_needle}'")
        out["results"][tool] = result
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", default="tests/fixtures/projection_fidelity/fixtures.yml")
    ap.add_argument("--report", default="agents/runtime/reports/projection-fidelity.json")
    args = ap.parse_args()

    fixture = yaml.safe_load((ROOT / args.fixture).read_text(encoding="utf-8"))
    entries = fixture.get("entries", [])
    results = [check_entry(e) for e in entries]

    summary = {"pass": 0, "partial": 0, "fail": 0}
    for e in results:
        for r in e["results"].values():
            summary[r["status"]] += 1

    report = {"summary": summary, "entries": results}
    out = ROOT / args.report
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(f"✅  Wrote {args.report}")
    print(f"   pass={summary['pass']} partial={summary['partial']} fail={summary['fail']}")
    for e in results:
        for tool, r in e["results"].items():
            if r["status"] != "pass":
                print(f"   {r['status']:7s} {e['id']:40s} {tool:18s} {'; '.join(r['details'])}")
    return 0 if summary["fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
