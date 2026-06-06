#!/usr/bin/env python3
"""
PR risk classifier.

Reads a list of changed files between two git refs, matches each path against
glob patterns defined in a YAML config, and emits a Markdown report plus a
single-word risk level (low / medium / high) for downstream CI steps.

The classifier is intentionally heuristic — it flags paths that historically
correlate with higher blast radius (migrations, auth code, lockfiles, public
endpoints). It is a conversation starter for reviewers, not a merge gate.

Config file format — see `pr-risk-config.example.yml` alongside this script.

Usage:
    python3 pr_risk_review.py \\
        --base <sha> --head <sha> \\
        --config .github/pr-risk-config.yml \\
        --output risk-report.md \\
        --level-file risk-level.txt

Exit codes: 0 = success, 2 = invalid arguments, 3 = git/config error.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:
    print("error: pyyaml not installed (pip install pyyaml)", file=sys.stderr)
    sys.exit(3)

LEVELS = ("high", "medium", "low")
DEFAULT_CONFIG: dict[str, Any] = {
    "patterns": {
        "high": [
            "**/migrations/**", "**/migration/**", "**/*.sql",
            "**/auth/**", "**/security/**", "**/policies/**",
            "**/.env*", "**/secrets/**",
            "composer.lock", "package-lock.json", "pnpm-lock.yaml",
            "yarn.lock", "poetry.lock", "Gemfile.lock", "go.sum",
            "**/Dockerfile*", "**/docker-compose*.y*ml",
            ".github/workflows/**",
        ],
        "medium": [
            "**/queue/**", "**/queues/**", "**/jobs/**", "**/listeners/**",
            "**/routes/**", "**/controllers/**", "**/api/**",
            "**/schema/**", "**/models/**", "**/entities/**",
            "composer.json", "package.json", "pyproject.toml", "Gemfile",
        ],
    },
    "ignore": [
        "**/*.md", "**/CHANGELOG*", "**/docs/**",
        "**/*.lock.hcl",
    ],
}


@dataclass
class Match:
    level: str
    pattern: str
    paths: list[str] = field(default_factory=list)


@lru_cache(maxsize=512)
def _compile(pattern: str) -> re.Pattern[str]:
    """Translate a gitignore-ish glob to a regex.

    - ``**/`` matches zero or more leading path segments.
    - ``/**`` matches zero or more trailing path segments.
    - ``**`` matches any characters (including ``/``).
    - ``*`` matches any characters except ``/`` (single segment).
    - ``?`` matches a single non-slash character.
    """
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
                    out[-1] = "(?:/.*)?"  # replace the trailing '/'
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


def load_config(path: Path | None) -> dict[str, Any]:
    if path is None or not path.exists():
        return DEFAULT_CONFIG
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as exc:
        print(f"error: config parse failed: {exc}", file=sys.stderr)
        sys.exit(3)
    return {**DEFAULT_CONFIG, **data}


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


def classify(files: list[str], config: dict[str, Any]) -> tuple[str, list[Match]]:
    ignore = config.get("ignore", []) or []
    files = [f for f in files if not any(_match(f, p) for p in ignore)]
    patterns = config.get("patterns", {}) or {}

    hits: dict[tuple[str, str], Match] = {}
    for level in ("high", "medium"):
        for pattern in patterns.get(level, []) or []:
            matched = [f for f in files if _match(f, pattern)]
            if matched:
                hits[(level, pattern)] = Match(level, pattern, matched)

    level = "high" if any(k[0] == "high" for k in hits) else (
        "medium" if any(k[0] == "medium" for k in hits) else "low"
    )
    return level, list(hits.values())


def render(level: str, hits: list[Match], total: int) -> str:
    emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}[level]
    lines = [
        f"## {emoji} PR Risk: **{level}**",
        "",
        f"_{total} changed file(s), {len(hits)} risk signal(s)._",
        "",
    ]
    if not hits:
        lines += [
            "No high- or medium-risk patterns matched. Reviewers: still ",
            "inspect the diff — the classifier only flags known hotspots.",
        ]
        return "\n".join(lines) + "\n"

    for lvl in ("high", "medium"):
        bucket = [h for h in hits if h.level == lvl]
        if not bucket:
            continue
        lines.append(f"### {emoji if lvl == level else ('🟡' if lvl == 'medium' else '🟢')} {lvl.capitalize()}")
        for m in bucket:
            lines.append(f"- `{m.pattern}` — {len(m.paths)} file(s)")
            lines += [f"  - `{p}`" for p in m.paths[:5]]
            if len(m.paths) > 5:
                lines.append(f"  - … and {len(m.paths) - 5} more")
        lines.append("")

    lines += [
        "---",
        "_Classifier is heuristic. Merge is not blocked by this check._",
    ]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--config", type=Path, default=None)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--level-file", type=Path, required=True)
    args = parser.parse_args()

    config = load_config(args.config)
    files = changed_files(args.base, args.head)
    level, hits = classify(files, config)

    args.output.write_text(render(level, hits, len(files)), encoding="utf-8")
    args.level_file.write_text(level, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
