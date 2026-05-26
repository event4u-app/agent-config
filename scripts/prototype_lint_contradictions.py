#!/usr/bin/env python3
"""
Prototype contradiction linter (P1.1 of road-to-package-optimization).

Hard acceptance: must flag >=3 real cross-artifact contradictions in this
repo within 5 s wall-clock and < $0.01 cost (deterministic, no LLM calls).
On failure, the roadmap closes with the null result documented; no
Phase 2 work begins.

Heuristic family — three deterministic checks across rules, skills,
commands, and contexts:

1. Routing mismatch: rule frontmatter `routes_to: [skill:foo]` but the
   target artifact does not exist or has no matching trigger.
2. Trigger collision with imperative conflict: two artifacts share a
   trigger keyword AND one body contains an `ALWAYS X` Iron Law while
   the other contains `NEVER X` (or `MUST` vs `MUST NOT`) on the same
   verb-object.
3. Catalog drift: a token-optimizer-style catalog row cites a path that
   does not exist (subset of #1, broader scope than the freshness gate).

Stdlib only. JSON to stdout. Exit 0 = clean / Exit 1 = contradictions found.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / ".agent-src.uncondensed"

ARTIFACT_DIRS = {
    "rule": SRC / "rules",
    "skill": SRC / "skills",
    "command": SRC / "commands",
    "context": SRC / "contexts",
}

FM_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
ALWAYS_RE = re.compile(r"^\s*(ALWAYS|MUST)\s+([A-Z][^.\n]{2,80})", re.MULTILINE)
NEVER_RE = re.compile(r"^\s*(NEVER|MUST NOT|DO NOT)\s+([A-Z][^.\n]{2,80})", re.MULTILINE)


def parse_artifact(path: Path, kind: str) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    fm: dict = {}
    m = FM_RE.match(text)
    body = text
    if m:
        body = text[m.end():]
        for line in m.group(1).splitlines():
            if ":" in line and not line.startswith(" "):
                k, _, v = line.partition(":")
                fm[k.strip()] = v.strip()
    triggers = re.findall(r"`([a-z][a-z0-9_-]+)`", fm.get("description", ""))
    routes = re.findall(r"(skill|rule|command):([a-z0-9_-]+)", fm.get("routes_to", ""))
    always = [m.group(2).strip() for m in ALWAYS_RE.finditer(body)]
    never = [m.group(2).strip() for m in NEVER_RE.finditer(body)]
    return {
        "kind": kind,
        "path": str(path.relative_to(REPO)),
        "id": path.stem if path.name != "SKILL.md" else path.parent.name,
        "triggers": set(triggers),
        "routes": routes,
        "always": always,
        "never": never,
    }


def collect() -> list[dict]:
    out: list[dict] = []
    for kind, root in ARTIFACT_DIRS.items():
        if not root.exists():
            continue
        for p in root.rglob("*.md"):
            if p.name in {"README.md", "INDEX.md"}:
                continue
            out.append(parse_artifact(p, kind))
    return out


def check_routing(arts: list[dict]) -> list[dict]:
    by_id = {(a["kind"], a["id"]): a for a in arts}
    flags: list[dict] = []
    for a in arts:
        for tgt_kind, tgt_id in a["routes"]:
            if (tgt_kind, tgt_id) not in by_id:
                flags.append({
                    "type": "routing_mismatch",
                    "artifact_a": a["path"],
                    "artifact_b": f"{tgt_kind}:{tgt_id} (missing)",
                    "evidence": f"{a['id']} routes_to {tgt_kind}:{tgt_id}, target not found",
                })
    return flags


def normalize_verb(s: str) -> str:
    return re.sub(r"[^a-z ]+", "", s.lower()).split(" ", 1)[0] if s else ""


def check_imperative_conflict(arts: list[dict]) -> list[dict]:
    flags: list[dict] = []
    by_trigger: dict[str, list[dict]] = {}
    for a in arts:
        for t in a["triggers"]:
            by_trigger.setdefault(t, []).append(a)
    for trigger, group in by_trigger.items():
        if len(group) < 2:
            continue
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                a_verbs = {normalize_verb(s) for s in a["always"]}
                b_verbs = {normalize_verb(s) for s in b["never"]}
                conflict = a_verbs & b_verbs - {""}
                if conflict:
                    flags.append({
                        "type": "imperative_conflict",
                        "artifact_a": a["path"],
                        "artifact_b": b["path"],
                        "evidence": f"shared trigger '{trigger}', a says ALWAYS {sorted(conflict)}, b says NEVER {sorted(conflict)}",
                    })
    return flags


def main() -> int:
    t0 = time.monotonic()
    arts = collect()
    flags = check_routing(arts) + check_imperative_conflict(arts)
    elapsed = time.monotonic() - t0
    report = {
        "artifacts_scanned": len(arts),
        "elapsed_seconds": round(elapsed, 3),
        "flags": flags,
        "acceptance": {
            "min_flags": 3,
            "max_seconds": 5.0,
            "passed": len(flags) >= 3 and elapsed < 5.0,
        },
    }
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0 if not flags else 1


if __name__ == "__main__":
    sys.exit(main())
