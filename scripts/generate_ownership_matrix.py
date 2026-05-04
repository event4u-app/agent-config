#!/usr/bin/env python3
"""Generate the file-ownership matrix.

Produces:

  * docs/contracts/file-ownership-matrix.json (machine, internal-locked)
  * agents/contexts/structural/file-ownership-matrix.md (human-readable)

Walks `.agent-src.uncompressed/{rules,skills,commands,contexts,personas}/`,
parses frontmatter for `load_context:` / `load_context_eager:`, scans
markdown bodies for inline links to `.md` files inside the scanned roots,
and emits READ_ONLY edges plus depth-2 transitive closure of load_context
chains. Depth-3 chains abort the build (matches the 0.2.4 nesting cap).

Contract: docs/contracts/file-ownership-matrix.md
Roadmap:  road-to-structural-optimization.md § 0.1

Modes:
  --check      Regenerate to memory and diff against committed JSON.
               Exit 0 if identical, 1 if drifted.
  (default)    Regenerate JSON + MD in place; exit 0 on success.

Exit codes: 0 = ok, 1 = drift (--check), 2 = depth-3 chain, 3 = internal.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC_ROOT = ROOT / ".agent-src.uncompressed"

SCAN_DIRS = ("rules", "skills", "commands", "contexts", "personas")

JSON_OUT = ROOT / "docs" / "contracts" / "file-ownership-matrix.json"
MD_OUT = ROOT / "agents" / "contexts" / "structural" / "file-ownership-matrix.md"

LINK_RE = re.compile(r"\]\(([^)]+\.md)(?:#[^)]*)?\)")


@dataclass
class FileEntry:
    path: str
    kind: str
    rule_type: str | None = None
    load_context: list[str] = field(default_factory=list)
    load_context_eager: list[str] = field(default_factory=list)


@dataclass
class Edge:
    source: str
    target: str
    type: str
    via: str
    depth: int


def _rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def _kind_for(rel: str) -> str:
    parts = rel.split("/")
    if len(parts) >= 3 and parts[0] == ".agent-src.uncompressed":
        return parts[1].rstrip("s") if parts[1] != "personas" else "persona"
    return "unknown"


def _parse_frontmatter(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def _collect_files(src_root: Path) -> list[Path]:
    out: list[Path] = []
    for sub in SCAN_DIRS:
        d = src_root / sub
        if d.exists():
            out.extend(sorted(d.rglob("*.md")))
    return out


def _resolve(target: str, src_root: Path) -> Path | None:
    """Resolve a path string (repo-relative or short) into an absolute Path
    under src_root or the repo root. Return None if not under a scanned root."""
    cand = src_root.parent / target if "/" in target else src_root / target
    try:
        rel = cand.resolve().relative_to(src_root.parent)
    except ValueError:
        return None
    parts = rel.parts
    if len(parts) >= 3 and parts[0] == ".agent-src.uncompressed" and parts[1] in SCAN_DIRS:
        return cand if cand.exists() else None
    return None


def build_matrix(src_root: Path) -> tuple[dict[str, FileEntry], list[Edge], list[str]]:
    """Build the file map + edge list. Returns (files, edges, depth3_chains).

    depth3_chains is non-empty iff the depth invariant is violated; the
    caller must abort with exit code 2.
    """
    files: dict[str, FileEntry] = {}
    for f in _collect_files(src_root):
        rel = f.relative_to(src_root.parent).as_posix()
        fm = _parse_frontmatter(f)
        rtype = fm.get("type")
        if isinstance(rtype, str):
            rtype = rtype.strip('"').strip("'")
        else:
            rtype = None
        lazy = fm.get("load_context") or []
        eager = fm.get("load_context_eager") or []
        if not isinstance(lazy, list):
            lazy = []
        if not isinstance(eager, list):
            eager = []
        files[rel] = FileEntry(
            path=rel,
            kind=_kind_for(rel),
            rule_type=rtype,
            load_context=[str(x) for x in lazy if isinstance(x, str)],
            load_context_eager=[str(x) for x in eager if isinstance(x, str)],
        )

    edges: list[Edge] = []
    for rel, entry in files.items():
        for tgt in entry.load_context:
            edges.append(Edge(rel, tgt, "READ_ONLY", "load_context", 1))
        for tgt in entry.load_context_eager:
            edges.append(Edge(rel, tgt, "READ_ONLY", "load_context_eager", 1))

    # Body markdown links — only count edges to files we know about
    for rel, entry in files.items():
        body = (src_root.parent / rel).read_text(encoding="utf-8")
        body = body.split("\n---\n", 1)[-1] if body.startswith("---\n") else body
        seen_targets: set[str] = set()
        for m in LINK_RE.finditer(body):
            href = m.group(1).strip()
            if href.startswith("http"):
                continue
            resolved = _resolve_link(rel, href, src_root)
            if resolved is None or resolved == rel or resolved in seen_targets:
                continue
            if resolved in files:
                seen_targets.add(resolved)
                edges.append(Edge(rel, resolved, "READ_ONLY", "body_link", 1))

    # Transitive closure on load_context* edges, depth 2; depth 3 aborts.
    lc_edges_by_src: dict[str, list[str]] = {}
    for e in edges:
        if e.via in ("load_context", "load_context_eager"):
            lc_edges_by_src.setdefault(e.source, []).append(e.target)

    transitive: list[Edge] = []
    depth3: list[str] = []
    for src, lvl1_targets in lc_edges_by_src.items():
        for t1 in lvl1_targets:
            for t2 in lc_edges_by_src.get(t1, []):
                if t2 == src or t2 == t1:
                    continue
                transitive.append(Edge(src, t2, "READ_ONLY", "load_context_transitive", 2))
                # depth-3 probe
                for t3 in lc_edges_by_src.get(t2, []):
                    if t3 in (src, t1, t2):
                        continue
                    depth3.append(f"{src} → {t1} → {t2} → {t3}")

    edges.extend(transitive)
    for rel in files:
        edges.append(Edge(rel, rel, "WRITE", "self", 0))

    edges.sort(key=lambda e: (e.source, e.target, e.via, e.depth))
    return files, edges, depth3


def _resolve_link(source_rel: str, href: str, src_root: Path) -> str | None:
    """Resolve a markdown link href (relative to source file) to a repo-relative
    path inside a scanned root, or None."""
    if href.startswith(".agent-src.uncompressed/") or href.startswith("agents/"):
        cand = (src_root.parent / href).resolve()
    else:
        base = (src_root.parent / source_rel).parent
        cand = (base / href).resolve()
    try:
        rel = cand.relative_to(src_root.parent).as_posix()
    except ValueError:
        return None
    parts = rel.split("/")
    if len(parts) >= 3 and parts[0] == ".agent-src.uncompressed" and parts[1] in SCAN_DIRS:
        return rel if cand.exists() else None
    return None


def _to_json(files: dict[str, FileEntry], edges: list[Edge]) -> dict:
    return {
        "version": 1,
        "generated_by": "scripts/generate_ownership_matrix.py",
        "source_of_truth": ".agent-src.uncompressed/",
        "files": {
            rel: {
                "kind": e.kind,
                "rule_type": e.rule_type,
                "load_context": e.load_context,
                "load_context_eager": e.load_context_eager,
            }
            for rel, e in sorted(files.items())
        },
        "edges": [
            {
                "source": e.source,
                "target": e.target,
                "type": e.type,
                "via": e.via,
                "depth": e.depth,
            }
            for e in edges
        ],
    }


def _to_markdown(payload: dict) -> str:
    lines: list[str] = [
        "# File-ownership matrix (regenerated)",
        "",
        "> **Do not edit.** Regenerated by `scripts/generate_ownership_matrix.py`.",
        "> Schema: [`docs/contracts/file-ownership-matrix.md`](../../../docs/contracts/file-ownership-matrix.md).",
        "",
        f"- Schema version: `{payload['version']}`",
        f"- Source of truth: `{payload['source_of_truth']}`",
        f"- Files indexed: **{len(payload['files'])}**",
        f"- Edges (incl. self-WRITE): **{len(payload['edges'])}**",
        "",
        "## READ_ONLY edges",
        "",
        "| Source | Target | Via | Depth |",
        "|---|---|---|---:|",
    ]
    ro = [e for e in payload["edges"] if e["type"] == "READ_ONLY"]
    for e in ro:
        lines.append(f"| `{e['source']}` | `{e['target']}` | `{e['via']}` | {e['depth']} |")
    if not ro:
        lines.append("| _(none)_ |  |  |  |")
    lines += [
        "",
        "## Files by kind",
        "",
        "| Kind | Count |",
        "|---|---:|",
    ]
    counts: dict[str, int] = {}
    for f in payload["files"].values():
        counts[f["kind"]] = counts.get(f["kind"], 0) + 1
    for k in sorted(counts):
        lines.append(f"| `{k}` | {counts[k]} |")
    lines.append("")
    return "\n".join(lines)


def _write_outputs(payload: dict, json_out: Path, md_out: Path) -> None:
    json_out.parent.mkdir(parents=True, exist_ok=True)
    md_out.parent.mkdir(parents=True, exist_ok=True)
    json_out.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    md_out.write_text(_to_markdown(payload) + "\n", encoding="utf-8")


def main(argv: Iterable[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="Regenerate to memory and diff against committed JSON.")
    args = ap.parse_args(list(argv) if argv is not None else None)

    if not SRC_ROOT.is_dir():
        print(f"❌  source dir missing: {SRC_ROOT}", file=sys.stderr)
        return 3

    files, edges, depth3 = build_matrix(SRC_ROOT)
    if depth3:
        print("❌  load_context depth-3 chain detected (limit is 2):", file=sys.stderr)
        for chain in depth3:
            print(f"  🔴 {chain}", file=sys.stderr)
        return 2

    payload = _to_json(files, edges)

    if args.check:
        if not JSON_OUT.exists():
            print(f"❌  {JSON_OUT.relative_to(ROOT)} not committed; run `task generate-ownership-matrix`",
                  file=sys.stderr)
            return 1
        committed = json.loads(JSON_OUT.read_text(encoding="utf-8"))
        if committed != payload:
            print("❌  ownership matrix is stale — run `task generate-ownership-matrix` and commit",
                  file=sys.stderr)
            return 1
        print(f"✅  ownership matrix in sync ({len(files)} files, {len(edges)} edges)")
        return 0

    _write_outputs(payload, JSON_OUT, MD_OUT)
    print(f"✅  wrote {JSON_OUT.relative_to(ROOT)} ({len(files)} files, {len(edges)} edges)")
    print(f"✅  wrote {MD_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
