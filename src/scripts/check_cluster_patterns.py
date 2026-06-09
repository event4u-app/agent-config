#!/usr/bin/env python3
"""Cluster-pattern compliance check.

Compares each cluster dispatcher against the Phase 1 reference patterns
(`fix`, `optimize`, `feature`).

Post-ADR-051 layout: dispatchers live at
`src/domains/<pack>/<subpath>/command.md`; their canonical identity is the
path-derived slug from `_lib.agent_src.command_slug()` (pack-prefixed when
the pack declares `slug_prefix`, e.g. `git/commit` → `git-commit`). The
locked-clusters table lists these canonical slugs in column 1.

Required structure per dispatcher:

  Frontmatter:
    - `name: <slug>`
    - `cluster: <slug>`
    - `disable-model-invocation: true` (template mandate, council-confirmed
      enforce-and-backfill 2026-06-09 — issue #380)

  Body:
    - `# /<slug>` H1
    - `## Sub-commands` section with a markdown table whose header is
      exactly `Sub-command | Routes to | Purpose`
    - `## Dispatch` section
    - `## Rules` section

Cluster slugs are detected by reading the locked-clusters table in
`docs/contracts/command-clusters.md` (column-1 backticks, phase-numbered
rows only — `—`-phase rows keep their legacy shape).

Exit codes: 0 = clean, 1 = pattern violations, 3 = internal error.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "src" / "scripts"))
from _lib.agent_src import SRC_DOMAINS, command_slug, resolve_logical  # noqa: E402

CONTRACT = ROOT / "docs/contracts/command-clusters.md"


def build_slug_map() -> dict[str, Path]:
    """Map canonical command slug → physical dispatcher path (domains tree)."""
    out: dict[str, Path] = {}
    if not SRC_DOMAINS.is_dir():
        return out
    for p in sorted(SRC_DOMAINS.rglob("command.md")):
        if not p.is_file():
            continue
        slug = command_slug(p)
        if slug is not None:
            out[slug] = p
    return out


def _resolve_command(cluster: str, slug_map: dict[str, Path]) -> Path | None:
    """Return the physical path for the dispatcher with canonical slug
    ``cluster``.

    Domains tree wins (canonical, post-ADR-051); the legacy
    ``commands/<cluster>.md`` logical path is the fallback for any artefact
    still living in an ``.agent-src.uncondensed/`` root.
    """
    hit = slug_map.get(cluster)
    if hit is not None:
        return hit
    return resolve_logical(f"commands/{cluster}.md")

REQUIRED_SECTIONS = ["## Sub-commands", "## Dispatch", "## Rules"]
TABLE_HEADER_RE = re.compile(
    r"\|\s*Sub-command\s*\|\s*Routes to\s*\|\s*Purpose\s*\|", re.IGNORECASE
)


@dataclass
class FileReport:
    path: Path
    cluster: str
    errors: list[str] = field(default_factory=list)


def load_cluster_table() -> list[tuple[str, str]]:
    """Return [(cluster_slug, kind)] where kind ∈ {"dispatch", "flag"}."""
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


def check_dispatcher(cluster: str, slug_map: dict[str, Path]) -> FileReport:
    path = _resolve_command(cluster, slug_map)
    if path is None:
        rep = FileReport(path=SRC_DOMAINS / "<unresolved>" / cluster, cluster=cluster)
        rep.errors.append(
            f"dispatcher file missing: no domains command with slug `{cluster}` "
            f"and no legacy commands/{cluster}.md"
        )
        return rep
    rep = FileReport(path=path, cluster=cluster)
    text = path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(text)

    # Frontmatter checks — name/cluster carry the canonical slug.
    if fm.get("name") != cluster:
        rep.errors.append(f"frontmatter `name:` is {fm.get('name')!r}, expected {cluster!r}")
    if fm.get("cluster") != cluster:
        rep.errors.append(f"frontmatter `cluster:` is {fm.get('cluster')!r}, expected {cluster!r}")
    if fm.get("disable-model-invocation") != "true":
        rep.errors.append("frontmatter `disable-model-invocation: true` missing")

    # H1 check — the canonical invocation name.
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

    slug_map = build_slug_map()
    dispatch_clusters = [n for n, k in rows if k == "dispatch"]
    flag_clusters = [n for n, k in rows if k == "flag"]

    reports = [check_dispatcher(n, slug_map) for n in dispatch_clusters]
    bad = [r for r in reports if r.errors]

    # Flag clusters: only assert the file exists; legacy shape is preserved.
    flag_missing = [n for n in flag_clusters
                    if _resolve_command(n, slug_map) is None]
    if flag_missing:
        print(f"❌  Flag-cluster file(s) missing: {flag_missing}")
        return 1

    if bad:
        print(f"❌  {len(bad)}/{len(reports)} cluster dispatcher(s) deviate "
              f"from the Phase-1 reference pattern:")
        for r in bad:
            try:
                shown = r.path.relative_to(ROOT)
            except ValueError:
                shown = r.path
            print(f"  • {shown} (cluster `{r.cluster}`)")
            for err in r.errors:
                print(f"      - {err}")
        print(f"\nReference: the `fix`, `optimize`, `feature` dispatchers "
              f"under src/domains/")
        return 1
    print(f"✅  {len(reports)} cluster dispatcher(s) match the Phase-1 reference "
          f"pattern; {len(flag_clusters)} flag-cluster(s) verified present.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
