#!/usr/bin/env python3
"""Prove a pack + its declared dependency closure is self-contained.

road-to-6.0.0-D Phase 1 Step 6 — the *extraction proof*. It de-risks the
monorepo collapse (Phase 3) by proving that a pack moved into the flat
``src/`` library can still be lifted back out into a standalone package:
every artefact the pack references must live inside the pack's own
``requires`` closure (plus the always-available foundation packs). A
reference that points OUTSIDE the closure is a dangling edge — the slice
would not build standalone, so re-split is no longer possible.

What "its own tests pass" means for a markdown artefact library: the
isolated slice has (1) zero dangling skill/rule references in frontmatter,
(2) zero dangling markdown links into the artefact library, and (3) a
``pack.yaml`` whose ``requires`` graph stays acyclic within the closure.
Those are the structural invariants the per-pack CI gates assert; proving
them on the isolated closure is the standalone-build proof.

Usage:
  python3 scripts/prove_pack_extractable.py <pack-id> [--json]

Exit codes: 0 = extractable · 1 = dangling reference(s) · 3 = unknown pack.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import agent_src  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PACKS_VOCAB = ROOT / "config" / "discovery" / "packs.yml"
# Always-available foundation packs: every pack may reference these without
# declaring them in `requires` (the 6.0.0-D council's resolution of the
# ambiguous "core" in the boundary rule — engineering-base + meta are the
# implicit foundation, alongside the legacy physical `core`).
FOUNDATION = {"core", "engineering-base", "meta"}
_LINK_RE = re.compile(r"\]\(([^)#?]+\.md)(?:[#?][^)]*)?\)")


def _frontmatter(path: Path) -> dict:
    text = path.read_text("utf-8", errors="replace")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 4)
    if end == -1:
        return {}
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError:
        return {}
    return data if isinstance(data, dict) else {}


def _pack_requires() -> dict[str, set[str]]:
    """Map pack id -> direct `requires` set, from the discovery vocab."""
    graph: dict[str, set[str]] = {}
    vocab = yaml.safe_load(PACKS_VOCAB.read_text("utf-8")) or []
    for entry in vocab:
        if isinstance(entry, dict) and isinstance(entry.get("id"), str):
            graph[entry["id"]] = set(entry.get("requires") or [])
    return graph


def _closure(pack: str, graph: dict[str, set[str]]) -> set[str]:
    """Transitive `requires` closure of ``pack`` (inclusive) + foundation."""
    seen: set[str] = set()
    stack = [pack]
    while stack:
        p = stack.pop()
        if p in seen:
            continue
        seen.add(p)
        stack.extend(graph.get(p, set()) - seen)
    return seen | FOUNDATION


def _library_index() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Build (slug_to_packs, logicalpath_to_packs) over the flat library."""
    slug_packs: dict[str, set[str]] = {}
    path_packs: dict[str, set[str]] = {}
    for phys, logical in agent_src.iter_all_sources():
        if not logical.endswith(".md"):
            continue
        fm = _frontmatter(phys)
        packs = set(p for p in (fm.get("packs") or []) if isinstance(p, str))
        if not packs:
            continue
        path_packs[logical] = packs
        if logical.startswith("skills/") and logical.endswith("/SKILL.md"):
            slug_packs[logical.split("/")[1]] = packs
        elif logical.startswith("rules/"):
            slug_packs[logical[len("rules/"):-len(".md")]] = packs
    return slug_packs, path_packs


def prove(pack: str) -> tuple[bool, list[str], list[str], set[str]]:
    """Return (extractable, hard_dangling, advisory_warnings, closure).

    The dependency axis is frontmatter (6.0.0-D council convergence): a
    HARD edge is a ``skills:`` / ``rules:`` include — it must resolve inside
    the closure or the standalone slice fails to build. A markdown link into
    another pack is an ADVISORY cross-reference (a "route to" / "see also")
    — it is reported as a warning but does NOT block extraction, because the
    skill still functions when the linked alternative is simply not installed.
    """
    graph = _pack_requires()
    if pack not in graph:
        return False, [f"unknown pack id '{pack}' (not in {PACKS_VOCAB})"], [], set()
    closure = _closure(pack, graph)
    slug_packs, path_packs = _library_index()

    def in_closure(packs: set[str]) -> bool:
        return bool(packs & closure)

    hard: list[str] = []
    advisory: list[str] = []
    members = [(logical, phys) for phys, logical in agent_src.iter_all_sources()
               if logical.endswith(".md") and pack in path_packs.get(logical, set())]
    for logical, phys in members:
        fm = _frontmatter(phys)
        # (1) HARD: frontmatter skill/rule includes — the build-dependency axis
        for slug in (fm.get("skills") or []) + (fm.get("rules") or []):
            if not isinstance(slug, str):
                continue
            target = slug_packs.get(slug)
            if target is None:
                continue  # command-routing target / non-library slug — not a pack edge
            if not in_closure(target):
                hard.append(
                    f"{logical}: include '{slug}' lives in {sorted(target)} — outside closure")
        # (2) ADVISORY: markdown links into the artefact library
        for raw in _LINK_RE.findall(phys.read_text("utf-8", errors="replace")):
            tgt = agent_src.strip_source_prefix(raw) or _resolve_rel(phys, raw)
            if tgt is None or tgt not in path_packs:
                continue
            if not in_closure(path_packs[tgt]):
                advisory.append(
                    f"{logical}: advisory link → {tgt} ({sorted(path_packs[tgt])}) — "
                    f"not installed when '{pack}' is extracted alone")
    return (not hard), hard, advisory, closure


def _resolve_rel(source: Path, raw: str) -> str | None:
    try:
        resolved = (source.parent / raw).resolve()
        rel = resolved.relative_to(ROOT).as_posix()
    except (OSError, ValueError):
        return None
    return agent_src.strip_source_prefix(rel)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pack", help="pack id (e.g. laravel)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()
    ok, hard, advisory, closure = prove(args.pack)
    if not closure:
        print(f"❌  {hard[0]}", file=sys.stderr)
        return 3
    if args.json:
        json.dump({"pack": args.pack, "extractable": ok,
                   "closure": sorted(closure), "hard_dangling": hard,
                   "advisory": advisory}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    elif ok:
        print(f"✅  '{args.pack}' is extractable — closure {sorted(closure)}, "
              f"0 hard dangling references.")
        for a in advisory:
            print(f"   ⚠️  {a}")
    else:
        for d in hard:
            print(f"❌  {d}", file=sys.stderr)
        print(f"\n{len(hard)} hard dangling reference(s) — '{args.pack}' is NOT "
              f"standalone-extractable.", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
