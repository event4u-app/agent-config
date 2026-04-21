#!/usr/bin/env python3
"""
PR review-routing classifier.

Reads changed files between two git refs, resolves reviewer roles from
`ownership-map.yml`, and matches the diff against
`historical-bug-patterns.yml`. Emits a Markdown routing block plus a
single-word severity level (low / medium / high) for downstream CI steps.

This classifier is **informational** — it surfaces who should review and
what regression tests historical patterns demand. It is not a merge gate.

Config file formats — see:
    ownership-map.example.yml
    historical-bug-patterns.example.yml

Usage:
    python3 pr_review_routing.py \\
        --base <sha> --head <sha> \\
        --ownership-map .github/ownership-map.yml \\
        --patterns .github/historical-bug-patterns.yml \\
        --output routing-report.md \\
        --level-file routing-level.txt

Exit codes: 0 = success, 2 = invalid arguments, 3 = git/config error.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("error: pyyaml not installed (pip install pyyaml)", file=sys.stderr)
    sys.exit(3)

LEVELS = ("high", "medium", "low")
STALE_MONTHS = 6


@dataclass
class OwnershipHit:
    path: str
    roles: list[str]
    focus: str | None
    risk: str | None


@dataclass
class PatternHit:
    id: str
    label: str
    severity: str
    required_test: str
    references: list[str] = field(default_factory=list)
    matched_files: list[str] = field(default_factory=list)


@lru_cache(maxsize=512)
def _compile(pattern: str) -> re.Pattern[str]:
    """Translate a gitignore-ish glob to a regex (same semantics as pr_risk_review.py)."""
    out: list[str] = []
    i, n = 0, len(pattern)
    while i < n:
        c = pattern[i]
        if c == "*":
            if i + 1 < n and pattern[i + 1] == "*":
                if i + 2 < n and pattern[i + 2] == "/":
                    out.append("(?:.*/)?")
                    i += 3
                    continue
                if i > 0 and pattern[i - 1] == "/":
                    out[-1] = "(?:/.*)?"
                    i += 2
                    continue
                out.append(".*")
                i += 2
                continue
            out.append("[^/]*")
        elif c == "?":
            out.append("[^/]")
        elif c in r".^$+{}()[]|\\":
            out.append(re.escape(c))
        else:
            out.append(c)
        i += 1
    return re.compile("^" + "".join(out) + "$")


def _match(path: str, pattern: str) -> bool:
    return bool(_compile(pattern).match(path))


def _load_yaml(path: Path | None) -> dict[str, Any] | None:
    if path is None or not path.exists():
        return None
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        print(f"error: {path} parse failed: {exc}", file=sys.stderr)
        sys.exit(3)
    if data.get("version") != 1:
        print(f"error: {path} missing or unsupported 'version: 1'", file=sys.stderr)
        sys.exit(3)
    return data


def changed_files(base: str, head: str) -> list[str]:
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", f"{base}...{head}"],
            check=True, capture_output=True, text=True,
        )
    except subprocess.CalledProcessError as exc:
        print(f"error: git diff failed: {exc.stderr}", file=sys.stderr)
        sys.exit(3)
    return [line for line in out.stdout.splitlines() if line.strip()]


def match_ownership(files: list[str], cfg: dict[str, Any] | None) -> tuple[list[OwnershipHit], list[str], bool]:
    """Return per-file hits, fallback roles, and a stale flag."""
    if not cfg:
        return [], [], False

    entries = cfg.get("entries", []) or []
    defaults = (cfg.get("defaults") or {}).get("roles", []) or []

    hits: list[OwnershipHit] = []
    for path in files:
        for entry in entries:
            globs = entry.get("paths", []) or []
            if any(_match(path, g) for g in globs):
                hits.append(OwnershipHit(
                    path=path,
                    roles=list(entry.get("roles", []) or []),
                    focus=entry.get("focus"),
                    risk=entry.get("risk"),
                ))
                break

    stale = False
    updated = cfg.get("updated")
    if isinstance(updated, (date, datetime)):
        updated_date = updated.date() if isinstance(updated, datetime) else updated
        months = (date.today().year - updated_date.year) * 12 + (date.today().month - updated_date.month)
        stale = months >= STALE_MONTHS

    return hits, defaults, stale


def match_patterns(files: list[str], cfg: dict[str, Any] | None) -> list[PatternHit]:
    if not cfg:
        return []
    result: list[PatternHit] = []
    for pattern in cfg.get("patterns", []) or []:
        globs = pattern.get("paths", []) or []
        matched = [f for f in files if any(_match(f, g) for g in globs)]
        if not matched:
            continue
        result.append(PatternHit(
            id=str(pattern.get("id", "unknown")),
            label=str(pattern.get("label", pattern.get("id", "unknown"))),
            severity=str(pattern.get("severity", "medium")),
            required_test=str(pattern.get("required_test", "")),
            references=list(pattern.get("references", []) or []),
            matched_files=matched,
        ))
    return result


def overall_level(patterns: list[PatternHit]) -> str:
    if any(p.severity == "high" for p in patterns):
        return "high"
    if any(p.severity == "medium" for p in patterns):
        return "medium"
    return "low"


def _merge_roles(ownership: list[OwnershipHit], fallback: list[str]) -> list[tuple[str, list[str], list[str]]]:
    """Return [(role, focus_notes, files), …] ordered by hit count then name."""
    by_role: dict[str, tuple[set[str], set[str]]] = {}
    for hit in ownership:
        for role in hit.roles:
            notes, files = by_role.setdefault(role, (set(), set()))
            if hit.focus:
                notes.add(hit.focus)
            files.add(hit.path)
    if not by_role and fallback:
        for role in fallback:
            by_role.setdefault(role, (set(), set()))
    ordered = sorted(by_role.items(), key=lambda kv: (-len(kv[1][1]), kv[0]))
    return [(role, sorted(notes), sorted(files)) for role, (notes, files) in ordered]


def render(
    level: str,
    ownership: list[OwnershipHit],
    fallback: list[str],
    stale: bool,
    patterns: list[PatternHit],
    total: int,
    have_ownership_file: bool,
    have_patterns_file: bool,
) -> str:
    emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}[level]
    lines = [
        f"## {emoji} Review Routing: **{level}**",
        "",
        f"_{total} changed file(s), {len(patterns)} historical pattern(s) matched._",
        "",
    ]

    roles = _merge_roles(ownership, fallback)
    lines.append("### Suggested reviewers (role-based)")
    if not roles:
        lines.append("- No ownership map and no fallback roles configured.")
        lines.append("  Fall back to generic reviewer selection per `reviewer-awareness`.")
    else:
        labels = ["primary", "secondary"] + [f"additional #{i}" for i in range(1, 20)]
        for (role, notes, files), label in zip(roles, labels):
            focus = " / ".join(notes) if notes else "anchored in diff"
            lines.append(f"- **{label}**: `{role}` — focus: {focus}")
            if files:
                preview = ", ".join(f"`{f}`" for f in files[:3])
                suffix = f" (+{len(files) - 3} more)" if len(files) > 3 else ""
                lines.append(f"  - files: {preview}{suffix}")
    lines.append("")

    if patterns:
        lines.append("### Historical patterns matched")
        order = {"high": 0, "medium": 1, "low": 2}
        for p in sorted(patterns, key=lambda x: order.get(x.severity, 9)):
            bullet = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(p.severity, "•")
            lines.append(f"- {bullet} **{p.id}** — {p.label}")
            if p.required_test:
                lines.append(f"  - required test: {p.required_test}")
            for ref in p.references:
                lines.append(f"  - ref: {ref}")
        lines.append("")

    if stale:
        lines += [
            "> ⚠️ Ownership map last updated > 6 months ago — treat roles as hints.",
            "",
        ]

    source_bits = []
    if have_ownership_file:
        source_bits.append("ownership-map.yml")
    if have_patterns_file:
        source_bits.append("historical-bug-patterns.yml")
    source = " + ".join(source_bits) if source_bits else "no project data — generic fallback"
    lines.append(f"_Data source: {source}. Routing is informational — merge is not blocked._")

    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--ownership-map", type=Path, default=None)
    parser.add_argument("--patterns", type=Path, default=None)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--level-file", type=Path, required=True)
    args = parser.parse_args()

    ownership_cfg = _load_yaml(args.ownership_map)
    patterns_cfg = _load_yaml(args.patterns)

    files = changed_files(args.base, args.head)
    ownership_hits, fallback_roles, stale = match_ownership(files, ownership_cfg)
    pattern_hits = match_patterns(files, patterns_cfg)
    level = overall_level(pattern_hits)

    args.output.write_text(
        render(
            level, ownership_hits, fallback_roles, stale, pattern_hits,
            total=len(files),
            have_ownership_file=ownership_cfg is not None,
            have_patterns_file=patterns_cfg is not None,
        ),
        encoding="utf-8",
    )
    args.level_file.write_text(level, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
