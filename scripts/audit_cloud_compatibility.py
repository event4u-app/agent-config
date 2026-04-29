#!/usr/bin/env python3
"""audit_cloud_compatibility.py — tier each artefact for cloud distribution.

Classifies every .md under .agent-src.uncompressed/{skills,rules,commands,
guidelines} into a tier:

  T1  Universal       no script / no FS / pure guidance
  T2  Local-Agent     references repo paths or FS work, no script
  T3-S Script-soft    mentions a script as one option (manual fallback exists)
  T3-H Script-hard    artefact's core procedure REQUIRES a script

Output: JSON summary on stdout + per-artefact list on --details.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / ".agent-src.uncompressed"
SCAN_DIRS = ["skills", "rules", "commands", "guidelines"]

# patterns
SCRIPT_RE = re.compile(
    r"(?:scripts/[a-z_]+\.(?:py|sh)|python3\s+scripts/|bash\s+scripts/|\./scripts/)"
)
TASK_RE = re.compile(r"`task\s+[a-z][a-z0-9-]+`")
HARD_RE = re.compile(
    r"(?:MUST\s+(?:run|invoke|call)|"
    r"^\s*[*-]?\s*(?:Run|Invoke|Call)\s+`?(?:python3\s+)?scripts/|"
    r"first\s+tool\s+call.*scripts/|"
    r"runs?\s+silently\s+before|"
    r"automatically\s+(?:invokes?|runs?)\s+`?scripts/)",
    re.IGNORECASE | re.MULTILINE,
)
FS_RE = re.compile(
    r"(?:\.agent-src(?:\.uncompressed)?/|"
    r"\.augment/|\.claude/|\.cursor/|\.clinerules/|"
    r"agents/|\.agent-settings\.yml|\.agent-chat-history)"
)


def classify(text: str) -> tuple[str, dict]:
    scripts = sorted(set(SCRIPT_RE.findall(text)))
    tasks = sorted(set(m.strip("`") for m in TASK_RE.findall(text)))
    fs_refs = sorted(set(FS_RE.findall(text)))
    has_hard = bool(HARD_RE.search(text))

    has_script = bool(scripts) or bool(tasks)
    has_fs = bool(fs_refs)

    if has_script and has_hard:
        tier = "T3-H"
    elif has_script:
        tier = "T3-S"
    elif has_fs:
        tier = "T2"
    else:
        tier = "T1"

    return tier, {
        "scripts": scripts,
        "tasks": tasks,
        "fs_refs_sample": fs_refs[:3],
        "has_hard_dep_marker": has_hard,
    }


def scan() -> list[dict]:
    rows: list[dict] = []
    for sub in SCAN_DIRS:
        base = SOURCE / sub
        if not base.is_dir():
            continue
        for md in sorted(base.rglob("*.md")):
            if md.name.lower() == "readme.md":
                continue
            text = md.read_text(encoding="utf-8")
            tier, evidence = classify(text)
            rows.append({
                "path": str(md.relative_to(ROOT)),
                "kind": sub,
                "tier": tier,
                **evidence,
            })
    return rows


def summarize(rows: list[dict]) -> dict:
    by_tier = Counter(r["tier"] for r in rows)
    by_kind_tier: dict[str, Counter] = {}
    for r in rows:
        by_kind_tier.setdefault(r["kind"], Counter())[r["tier"]] += 1
    script_freq = Counter()
    task_freq = Counter()
    for r in rows:
        for s in r["scripts"]:
            script_freq[s] += 1
        for t in r["tasks"]:
            task_freq[t] += 1
    return {
        "total": len(rows),
        "by_tier": dict(by_tier.most_common()),
        "by_kind_tier": {k: dict(v) for k, v in by_kind_tier.items()},
        "top_scripts": script_freq.most_common(15),
        "top_tasks": task_freq.most_common(10),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    p.add_argument("--details", action="store_true",
                   help="emit per-artefact rows, not just summary")
    p.add_argument("--tier", choices=["T1", "T2", "T3-S", "T3-H"],
                   help="filter --details to one tier")
    p.add_argument("--format", choices=["json", "md"], default="json")
    args = p.parse_args(argv)

    rows = scan()
    summary = summarize(rows)

    if args.details:
        filtered = [r for r in rows if not args.tier or r["tier"] == args.tier]
        if args.format == "json":
            print(json.dumps({"summary": summary, "rows": filtered}, indent=2))
        else:
            print(f"# Cloud-compat audit — tier filter: {args.tier or 'all'}\n")
            print(f"Total in scope: {len(filtered)}\n")
            for r in filtered:
                marker = " 🔴" if r["has_hard_dep_marker"] else ""
                print(f"- `{r['path']}` — **{r['tier']}**{marker}")
                if r["scripts"]:
                    print(f"  - scripts: `{'`, `'.join(r['scripts'])}`")
                if r["tasks"]:
                    print(f"  - tasks: `{'`, `'.join(r['tasks'])}`")
        return 0

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
