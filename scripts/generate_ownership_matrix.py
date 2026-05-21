#!/usr/bin/env python3
"""Generate the file-ownership matrix.

Produces:

  * docs/contracts/file-ownership-matrix.json (machine, internal-locked)
  * agents/settings/contexts/structural/file-ownership-matrix.md (human-readable)

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
sys.path.insert(0, str(ROOT / "scripts"))
from _lib.agent_src import artefact_roots, resolve_logical, strip_source_prefix  # noqa: E402

# Canonical anchor used in the committed matrix. Paths are always
# emitted as ".agent-src.uncompressed/<sub>/<...>" regardless of which
# physical root (legacy or packages/*) contains the file, so the matrix
# stays stable across the monorepo migration.
CANONICAL_SRC_PREFIX = ".agent-src.uncompressed"

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


def _collect_files(root: Path | None = None) -> list[tuple[Path, str]]:
    """Walk every artefact root and yield ``(physical_path, canonical_rel)``.

    ``canonical_rel`` is always anchored at ``.agent-src.uncompressed/`` so
    the matrix is byte-identical pre- and post-monorepo-move. Duplicates
    across roots resolve to the first hit (legacy first, then packages
    alphabetically) — matches the priority in ``artefact_roots()``.

    When ``root`` is given, only that single directory is scanned — used by
    tests against a ``tmp_path`` fixture so they stay isolated from the
    real package layout.
    """
    roots = [root] if root is not None else list(artefact_roots())
    out: list[tuple[Path, str]] = []
    seen: set[str] = set()
    for r in roots:
        for sub in SCAN_DIRS:
            d = r / sub
            if not d.exists():
                continue
            for f in sorted(d.rglob("*.md")):
                logical = f.relative_to(r).as_posix()
                canonical = f"{CANONICAL_SRC_PREFIX}/{logical}"
                if canonical in seen:
                    continue
                seen.add(canonical)
                out.append((f, canonical))
    out.sort(key=lambda pair: pair[1])
    return out


def build_matrix(root: Path | None = None) -> tuple[dict[str, FileEntry], list[Edge], list[str]]:
    """Build the file map + edge list. Returns (files, edges, depth3_chains).

    depth3_chains is non-empty iff the depth invariant is violated; the
    caller must abort with exit code 2. When ``root`` is given, only that
    single directory is scanned (test isolation).
    """
    files: dict[str, FileEntry] = {}
    physical_by_canonical: dict[str, Path] = {}
    for f, rel in _collect_files(root):
        physical_by_canonical[rel] = f
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
        phys = physical_by_canonical[rel]
        body = phys.read_text(encoding="utf-8")
        body = body.split("\n---\n", 1)[-1] if body.startswith("---\n") else body
        seen_targets: set[str] = set()
        for m in LINK_RE.finditer(body):
            href = m.group(1).strip()
            if href.startswith("http"):
                continue
            resolved = _resolve_link(rel, phys, href)
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


def _resolve_link(source_rel: str, source_phys: Path, href: str) -> str | None:
    """Resolve a markdown link href to a canonical scanned-root path, or None.

    ``source_rel`` is the canonical (``.agent-src.uncompressed/...``)
    identity of the source file. Relative hrefs are resolved against
    the source's *logical* directory, then looked up across every
    artefact root via :func:`resolve_logical`. This keeps the matrix
    stable when source and target live in different physical packages.

    Repo-rooted hrefs (``agents/...``, ``packages/...``, or those
    starting with ``.agent-src.uncompressed/``) are resolved against
    the repo root and normalised through :func:`strip_source_prefix`.
    """
    if href.startswith(".agent-src.uncompressed/") or href.startswith("agents/") \
            or href.startswith("packages/"):
        cand = (ROOT / href).resolve()
        if not cand.exists():
            return None
        try:
            rel = cand.relative_to(ROOT).as_posix()
        except ValueError:
            return None
        logical = strip_source_prefix(rel)
        if logical is None:
            return None
    else:
        # Logical resolution: walk relative hops on the canonical path
        # so a `../skills/laravel/SKILL.md` link from
        # `rules/architecture.md` resolves to `skills/laravel/SKILL.md`
        # regardless of which package physically hosts either file.
        source_logical = strip_source_prefix(source_rel)
        if source_logical is None:
            return None
        base_parts = source_logical.split("/")[:-1]  # drop file name
        href_parts = href.split("/")
        for part in href_parts:
            if part == "" or part == ".":
                continue
            if part == "..":
                if not base_parts:
                    return None
                base_parts.pop()
            else:
                base_parts.append(part)
        logical = "/".join(base_parts)
    # Existence is validated downstream by the caller against the scanned
    # ``files`` dict — that handles both real ``artefact_roots()`` scans
    # and ``tmp_path`` test fixtures uniformly.
    parts = logical.split("/")
    if len(parts) >= 2 and parts[0] in SCAN_DIRS:
        return f"{CANONICAL_SRC_PREFIX}/{logical}"
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

    if not artefact_roots():
        print("❌  no artefact roots found (legacy or packages/*/.agent-src.uncompressed/)",
              file=sys.stderr)
        return 3

    files, edges, depth3 = build_matrix()
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
