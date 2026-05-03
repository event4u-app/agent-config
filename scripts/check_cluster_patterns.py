#!/usr/bin/env python3
"""Cluster-pattern compliance check.

Compares each cluster dispatcher under
`.agent-src.uncompressed/commands/<cluster>.md` against the Phase 1
reference patterns (`fix.md`, `optimize.md`, `feature.md`).

Required structure:

  Frontmatter:
    - `name: <cluster>`
    - `cluster: <cluster>`
    - `disable-model-invocation: true`

  Body:
    - `# /<cluster>` H1
    - `## Sub-commands` section with a markdown table whose header is
      exactly `Sub-command | Routes to | Purpose`
    - `## Dispatch` section
    - `## Migration` section
    - `## Rules` section

Cluster files are detected by reading the locked-clusters table in
`docs/contracts/command-clusters.md` (column-1 backticks).

Exit codes: 0 = clean, 1 = pattern violations, 3 = internal error.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMANDS_DIR = ROOT / ".agent-src.uncompressed/commands"
CONTRACT = ROOT / "docs/contracts/command-clusters.md"

REQUIRED_SECTIONS = ["## Sub-commands", "## Dispatch", "## Migration", "## Rules"]
TABLE_HEADER_RE = re.compile(
    r"\|\s*Sub-command\s*\|\s*Routes to\s*\|\s*Purpose\s*\|", re.IGNORECASE
)


@dataclass
class FileReport:
    path: Path
    cluster: str
    errors: list[str] = field(default_factory=list)


def load_cluster_table() -> list[tuple[str, str]]:
    """Return [(cluster_name, kind)] where kind ∈ {"dispatch", "flag"}."""
    text = CONTRACT.read_text(encoding="utf-8")
    in_table = False
    rows: list[tuple[str, str]] = []
    row_re = re.compile(
        r"\|\s*`([a-z][a-z0-9-]*)`\s*\|\s*\d+\s*\|\s*([^|]+)\|"
    )
    for line in text.splitlines():
        if line.startswith("## Locked clusters"):
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if in_table:
            m = row_re.match(line)
            if m:
                name, sub_col = m.group(1), m.group(2).strip().lower()
                kind = "flag" if sub_col.startswith("flag:") else "dispatch"
                rows.append((name, kind))
    return rows


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}, text
    fm: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if line and not line.startswith(" ") and ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    body = text[end + len("\n---\n"):]
    return fm, body


def check_dispatcher(cluster: str) -> FileReport:
    path = COMMANDS_DIR / f"{cluster}.md"
    rep = FileReport(path=path, cluster=cluster)
    if not path.exists():
        rep.errors.append(f"dispatcher file missing: {path.relative_to(ROOT)}")
        return rep
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)

    # Frontmatter checks.
    if fm.get("name") != cluster:
        rep.errors.append(f"frontmatter `name:` is {fm.get('name')!r}, expected {cluster!r}")
    if fm.get("cluster") != cluster:
        rep.errors.append(f"frontmatter `cluster:` is {fm.get('cluster')!r}, expected {cluster!r}")
    if fm.get("disable-model-invocation") != "true":
        rep.errors.append("frontmatter `disable-model-invocation: true` missing")

    # H1 check.
    h1 = f"# /{cluster}"
    if h1 not in body.splitlines()[:5]:
        rep.errors.append(f"missing top-level heading {h1!r} in first 5 body lines")

    # Section presence.
    for section in REQUIRED_SECTIONS:
        if section not in body:
            rep.errors.append(f"missing section header {section!r}")

    # Sub-commands table header (only meaningful if Sub-commands section exists).
    if "## Sub-commands" in body and not TABLE_HEADER_RE.search(body):
        rep.errors.append(
            "Sub-commands table header must be `| Sub-command | Routes to | Purpose |`"
        )
    return rep


def main() -> int:
    rows = load_cluster_table()
    if not rows:
        print(f"❌  No clusters parsed from {CONTRACT.relative_to(ROOT)}",
              file=sys.stderr)
        return 3

    dispatch_clusters = [n for n, k in rows if k == "dispatch"]
    flag_clusters = [n for n, k in rows if k == "flag"]

    reports = [check_dispatcher(n) for n in dispatch_clusters]
    bad = [r for r in reports if r.errors]

    # Flag clusters: only assert the file exists; legacy shape is preserved.
    flag_missing = [n for n in flag_clusters
                    if not (COMMANDS_DIR / f"{n}.md").exists()]
    if flag_missing:
        print(f"❌  Flag-cluster file(s) missing: {flag_missing}")
        return 1

    if bad:
        print(f"❌  {len(bad)}/{len(reports)} cluster dispatcher(s) deviate "
              f"from the Phase-1 reference pattern:")
        for r in bad:
            print(f"  • {r.path.relative_to(ROOT)} (cluster `{r.cluster}`)")
            for err in r.errors:
                print(f"      - {err}")
        print(f"\nReference: commands/fix.md, commands/optimize.md, commands/feature.md")
        return 1
    print(f"✅  {len(reports)} cluster dispatcher(s) match the Phase-1 reference "
          f"pattern; {len(flag_clusters)} flag-cluster(s) verified present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
