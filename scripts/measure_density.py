#!/usr/bin/env python3
"""Measure structural density across the artifact corpus.

Phase 1.1 of `agents/roadmaps/road-to-structural-linter-reform.md`.

Density score = structured_lines / total_lines, where structured_lines
sum lines inside fenced blocks + markdown-table rows + bullet lines +
numbered/ordered-list lines + section-heading lines. Higher = more
structured (catalogue, orchestrator, Iron-Law block); lower = prose-
dominant.

Companion signals collected per artifact (consumed by Phases 1.2-1.4):

- ``multi_workflow``  ≥ 2 ``## Procedure`` (or ``## Procedure: …``)
                     blocks in a skill — candidate for cluster split.
- ``delegation``     command frontmatter has ``cluster:`` or
                     ``routes_to:``, or the body links to ≥ 3 other
                     commands/skills via ``](...md)``.
- ``iron_law_block`` ≥ 1 fenced block whose body is ≥ 60 % ALL-CAPS
                     across ≥ 3 non-empty lines.

Output:
- Default stdout: per-type distribution buckets + tail (lowest density).
- ``--json`` deterministic JSON of every artifact.
- ``--snapshot`` writes JSONL to ``agents/.density-snapshot.jsonl``.

Stdlib only; no network. Re-runnable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from skill_linter import (  # noqa: E402
    detect_artifact_type,
    extract_frontmatter,
    gather_all_candidate_files,
)

SNAPSHOT_FILE = REPO_ROOT / "agents" / ".density-snapshot.jsonl"

_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_BULLET = re.compile(r"^\s*[-*]\s+\S")
_NUMBERED = re.compile(r"^\s*\d+\.\s+\S")
_HEADING = re.compile(r"^\s{0,3}#{1,6}\s+\S")
_PROCEDURE = re.compile(r"^##\s+Procedure(\s*:.*)?\s*$", re.MULTILINE)
_LINK_MD = re.compile(r"\]\([^)]+\.md[^)]*\)")
_FRONTMATTER_KEY = re.compile(r"^(cluster|routes_to)\s*:", re.MULTILINE)
_ALLCAPS_LINE = re.compile(r"[A-Z]")


def _classify_lines(text: str) -> Dict[str, int]:
    """Bucket every non-blank line into one structural category."""
    inside_fence = False
    counts = {
        "total": 0,
        "fenced": 0,
        "table": 0,
        "bullet": 0,
        "numbered": 0,
        "heading": 0,
        "prose": 0,
    }
    for raw in text.splitlines():
        stripped = raw.strip()
        if stripped.startswith("```"):
            inside_fence = not inside_fence
            counts["total"] += 1
            counts["fenced"] += 1
            continue
        if not stripped:
            continue
        counts["total"] += 1
        if inside_fence:
            counts["fenced"] += 1
        elif _TABLE_ROW.match(raw):
            counts["table"] += 1
        elif _HEADING.match(raw):
            counts["heading"] += 1
        elif _BULLET.match(raw):
            counts["bullet"] += 1
        elif _NUMBERED.match(raw):
            counts["numbered"] += 1
        else:
            counts["prose"] += 1
    return counts


def _detect_iron_law_blocks(text: str) -> int:
    """Count fenced blocks that look like verbatim Iron-Law imperatives.

    Heuristic: fenced block with ≥ 1 non-empty line whose alphabetical
    body is ≥ 60 % uppercase AND has ≥ 30 letters total (filters single
    short ALL-CAPS markers like ``OK``). Also matches blockquote-style
    Iron Laws (``> NEVER COMMIT``).
    """
    blocks = 0
    inside = False
    body: list[str] = []
    for raw in text.splitlines():
        if raw.strip().startswith("```"):
            if inside and body:
                non_empty = [b for b in body if b.strip()]
                letters = "".join(non_empty)
                upper = sum(1 for c in letters if c.isalpha() and c.isupper())
                total = sum(1 for c in letters if c.isalpha())
                if total >= 30 and upper / total >= 0.6 and non_empty:
                    blocks += 1
            inside = not inside
            body = []
            continue
        if inside:
            body.append(raw)
    return blocks


def _count_procedures(text: str) -> int:
    return len(_PROCEDURE.findall(text))


def _delegation_signal(text: str, frontmatter: str | None) -> Dict[str, Any]:
    fm_keys = bool(frontmatter and _FRONTMATTER_KEY.search(frontmatter))
    md_links = len(_LINK_MD.findall(text))
    return {"frontmatter_routes": fm_keys, "md_links": md_links,
            "has_signal": fm_keys or md_links >= 3}


def measure(path: Path) -> Dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(REPO_ROOT) if path.is_absolute() else path
    artifact_type = detect_artifact_type(rel, text)
    frontmatter = extract_frontmatter(text)
    counts = _classify_lines(text)
    structured = counts["fenced"] + counts["table"] + counts["bullet"] + \
        counts["numbered"] + counts["heading"]
    density = structured / counts["total"] if counts["total"] else 0.0
    return {
        "file": str(rel),
        "type": artifact_type,
        "lines": counts["total"],
        "words": len(text.split()),
        "density": round(density, 3),
        "fenced": counts["fenced"],
        "table": counts["table"],
        "bullet": counts["bullet"],
        "numbered": counts["numbered"],
        "heading": counts["heading"],
        "prose": counts["prose"],
        "iron_law_blocks": _detect_iron_law_blocks(text),
        "procedures": _count_procedures(text),
        "delegation": _delegation_signal(text, frontmatter),
    }


def collect() -> List[Dict[str, Any]]:
    paths = gather_all_candidate_files(REPO_ROOT)
    return [measure(p) for p in paths]


def _bucketize(values: List[float]) -> Dict[str, int]:
    buckets = {"0.0-0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0,
               "0.6-0.8": 0, "0.8-1.0": 0}
    for v in values:
        if v < 0.2:
            buckets["0.0-0.2"] += 1
        elif v < 0.4:
            buckets["0.2-0.4"] += 1
        elif v < 0.6:
            buckets["0.4-0.6"] += 1
        elif v < 0.8:
            buckets["0.6-0.8"] += 1
        else:
            buckets["0.8-1.0"] += 1
    return buckets


def report(results: List[Dict[str, Any]]) -> str:
    by_type: Dict[str, List[Dict[str, Any]]] = {}
    for r in results:
        by_type.setdefault(r["type"], []).append(r)
    lines: List[str] = ["# Structural Density Snapshot", "",
                        f"Total artifacts: {len(results)}", ""]
    for t in sorted(by_type):
        rows = by_type[t]
        densities = [r["density"] for r in rows]
        avg = sum(densities) / len(densities) if densities else 0.0
        med = sorted(densities)[len(densities) // 2] if densities else 0.0
        buckets = _bucketize(densities)
        lines.append(f"## {t} ({len(rows)} artifacts)")
        lines.append(f"avg density={avg:.2f} median={med:.2f}")
        lines.append("buckets " + " ".join(
            f"[{k}]={v}" for k, v in buckets.items()))
        tail = sorted(rows, key=lambda r: r["density"])[:5]
        lines.append("lowest density:")
        for r in tail:
            lines.append(f"  {r['density']:.2f} {r['lines']:>4}L "
                         f"proc={r['procedures']} "
                         f"iron={r['iron_law_blocks']} "
                         f"deleg={int(r['delegation']['has_signal'])} "
                         f"{r['file']}")
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true")
    p.add_argument("--snapshot", action="store_true",
                   help=f"write JSONL to {SNAPSHOT_FILE.relative_to(REPO_ROOT)}")
    args = p.parse_args()
    results = collect()
    if args.snapshot:
        SNAPSHOT_FILE.parent.mkdir(parents=True, exist_ok=True)
        with SNAPSHOT_FILE.open("w", encoding="utf-8") as fh:
            for r in sorted(results, key=lambda x: x["file"]):
                fh.write(json.dumps(r, sort_keys=True) + "\n")
    if args.json:
        print(json.dumps(results, sort_keys=True, indent=2))
    else:
        print(report(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
