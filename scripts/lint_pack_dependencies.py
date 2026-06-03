#!/usr/bin/env python3
"""Pack dependency + pack-graph lints (road-to-6.0.0-D Phase 0 Step 3).

Two checks across ``packages/*/pack.yaml``:

1. **Dependency drift** — the ``dependencies`` block stored in each pack.yaml
   must equal the block re-derived from the pack's command/rule frontmatter
   (``skills:`` / ``rules:``). Drift means the manifest is stale: run
   ``task generate-pack-manifests``. This is what keeps the declared
   dependency graph honest once artefacts move (Phase 2+).

2. **Pack-graph is a DAG** — the union of every pack's ``requires`` (plus any
   ``dependencies.packs``) must be acyclic, so a pack stays extractable. A
   cycle is reported with the offending path.

Run against the CURRENT ``packages/`` layout it expects ~0 violations.

Exit codes: 0 = clean · 1 = drift and/or a cycle · 3 = internal error.
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_pack_manifests as gpm  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = ROOT / "packages"


def _dependency_drift() -> list[str]:
    errors: list[str] = []
    vocab = gpm._vocab_lookup(gpm._load_yaml(gpm.PACKS_VOCAB) or [])
    version = gpm._package_version()
    for pkg in sorted(PACKAGES.iterdir()):
        manifest = pkg / "pack.yaml"
        if not pkg.is_dir() or not manifest.exists():
            continue
        artefacts = gpm._collect_artefacts(pkg)
        expected = gpm._build_pack_yaml(pkg, vocab, artefacts, version)["dependencies"]
        try:
            on_disk = (yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}).get(
                "dependencies"
            ) or {}
        except (OSError, yaml.YAMLError) as exc:
            errors.append(f"{manifest}: cannot parse — {exc}")
            continue
        for kind in ("skills", "rules"):
            exp = sorted(expected.get(kind, []) or [])
            got = sorted(on_disk.get(kind, []) or [])
            if exp != got:
                missing = sorted(set(exp) - set(got))
                extra = sorted(set(got) - set(exp))
                detail = []
                if missing:
                    detail.append(f"missing {missing}")
                if extra:
                    detail.append(f"stale {extra}")
                errors.append(
                    f"{manifest}: dependencies.{kind} drift ({'; '.join(detail)}) "
                    f"— run `task generate-pack-manifests`"
                )
    return errors


def _pack_requires_graph() -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {}
    for pkg in sorted(PACKAGES.iterdir()):
        manifest = pkg / "pack.yaml"
        if not pkg.is_dir() or not manifest.exists():
            continue
        try:
            data = yaml.safe_load(manifest.read_text(encoding="utf-8")) or {}
        except (OSError, yaml.YAMLError):
            continue
        pid = data.get("id", pkg.name)
        edges: set[str] = set(data.get("requires", []) or [])
        deps = data.get("dependencies") or {}
        edges.update(deps.get("packs", []) or [])
        graph[pid] = edges
    return graph


def _find_cycle(graph: dict[str, set[str]]) -> list[str] | None:
    WHITE, GREY, BLACK = 0, 1, 2
    color = {n: WHITE for n in graph}
    stack: list[str] = []

    def dfs(node: str) -> list[str] | None:
        color[node] = GREY
        stack.append(node)
        for nxt in sorted(graph.get(node, set())):
            if nxt not in graph:
                continue  # external / unknown id — not a cycle edge in this graph
            if color[nxt] == GREY:
                return stack[stack.index(nxt):] + [nxt]
            if color[nxt] == WHITE:
                found = dfs(nxt)
                if found:
                    return found
        color[node] = BLACK
        stack.pop()
        return None

    for n in sorted(graph):
        if color[n] == WHITE:
            cyc = dfs(n)
            if cyc:
                return cyc
    return None


def main() -> int:
    if not PACKAGES.is_dir():
        print("packages/ does not exist — nothing to lint")
        return 0
    errors = _dependency_drift()
    cycle = _find_cycle(_pack_requires_graph())
    if cycle:
        errors.append(f"pack-graph cycle (requires/dependencies.packs): {' -> '.join(cycle)}")
    if errors:
        for e in errors:
            print(f"❌  {e}", file=sys.stderr)
        print(f"\n{len(errors)} pack-dependency violation(s).", file=sys.stderr)
        return 1
    print("✅  pack dependencies in sync; pack-graph is acyclic.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
