#!/usr/bin/env python3
"""Vocabulary linter for `src/config/discovery/{workspaces,packs}.yml`.

Source-of-truth check: the YAML files MUST mirror the closed vocabulary
in `docs/decisions/ADR-013-discovery-frontmatter-contract.md` exactly.
Cross-reference check: every default/optional pack id referenced from
`workspaces.yml` MUST exist in `packs.yml`, and every workspace id in
`packs.yml` MUST exist in `workspaces.yml`. Bidirectional integrity:
every pack listed as a workspace's default/optional MUST list that
workspace in its own `workspaces:` array (and vice versa).

Non-overlap (ADR-010 alignment): no pack id may collide with a
`rule_loading_tier` value (minimal/balanced/full/custom) or a `profile.id`
value (founder/developer/content_creator/agency/finance/ops).

Cap: ≤ 150 LOC, stdlib + PyYAML. Exit 0 clean, 1 on failure.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    print("ERROR: PyYAML required (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
WORKSPACES_YML = REPO_ROOT / "src" / "config" / "discovery" / "workspaces.yml"
PACKS_YML = REPO_ROOT / "src" / "config" / "discovery" / "packs.yml"

# Frozen ADR-013 vocabularies. Amendments require an ADR-013 edit + this list.
ADR_WORKSPACES: frozenset[str] = frozenset({
    "engineering", "product", "finance", "founder", "gtm", "ops",
    "small-business", "construction", "agent-config-maintainer",
})
ADR_PACKS: frozenset[str] = frozenset({
    "engineering-base", "php", "laravel", "symfony", "javascript",
    "typescript", "react", "nextjs", "python", "product-basic",
    "product-discovery", "finance-basic", "finance-advanced",
    "gtm-sales", "gtm-marketing", "ops-people", "founder-strategy", "small-business",
    "construction", "ai-video", "fun", "meta", "git", "frontend-design",
    # Carved out of meta in ADR-092 (capability-scoped packs).
    "memory", "analytics", "product-reasoning",
    # road-to-image-brand-typography Phase B (ADR-013 amendment, same PR).
    "brand",
})

# ADR-010 non-overlap reservations.
RULE_LOADING_TIER_RESERVED: frozenset[str] = frozenset({
    "minimal", "balanced", "full", "custom",
})
PROFILE_ID_RESERVED: frozenset[str] = frozenset({
    "founder", "developer", "content_creator", "agency", "finance", "ops",
})

# Capability-pack size classes (docs/contracts/capability-packs.md).
SIZE_CLASSES: frozenset[str] = frozenset({
    "core", "small", "medium", "large", "platform",
})


def _requires_of(pk: dict[str, Any]) -> list[str]:
    """Canonical ``requires`` edges, falling back to legacy ``requires_hint``."""
    return list(pk.get("requires") or pk.get("requires_hint") or [])


def _detect_requires_cycle(packs: list[dict[str, Any]]) -> list[str] | None:
    """Return a node cycle in the ``requires`` graph, or None if acyclic."""
    graph = {pk.get("id"): _requires_of(pk) for pk in packs}
    WHITE, GREY, BLACK = 0, 1, 2
    color = {pid: WHITE for pid in graph}

    def visit(node: str, path: list[str]) -> list[str] | None:
        color[node] = GREY
        for dep in graph.get(node, []):
            if dep not in color:  # dangling — reported separately
                continue
            if color[dep] == GREY:
                return path[path.index(dep):] + [dep]
            if color[dep] == WHITE:
                cyc = visit(dep, path + [dep])
                if cyc:
                    return cyc
        color[node] = BLACK
        return None

    for pid in graph:
        if color[pid] == WHITE:
            cyc = visit(pid, [pid])
            if cyc:
                return cyc
    return None


def _load(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise SystemExit(f"ERROR: missing {path.relative_to(REPO_ROOT)}")
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    if not isinstance(data, list):
        raise SystemExit(f"ERROR: {path.relative_to(REPO_ROOT)} must be a YAML list")
    return data


def lint(quiet: bool) -> int:
    errors: list[str] = []
    workspaces = _load(WORKSPACES_YML)
    packs = _load(PACKS_YML)

    ws_ids = {entry.get("id") for entry in workspaces}
    pack_ids = {entry.get("id") for entry in packs}

    # 1. ADR frozen-set parity.
    missing_ws = ADR_WORKSPACES - ws_ids
    extra_ws = ws_ids - ADR_WORKSPACES
    if missing_ws:
        errors.append(f"workspaces.yml missing ADR-013 ids: {sorted(missing_ws)}")
    if extra_ws:
        errors.append(f"workspaces.yml has ids not in ADR-013: {sorted(extra_ws)}")
    missing_p = ADR_PACKS - pack_ids
    extra_p = pack_ids - ADR_PACKS
    if missing_p:
        errors.append(f"packs.yml missing ADR-013 ids: {sorted(missing_p)}")
    if extra_p:
        errors.append(f"packs.yml has ids not in ADR-013: {sorted(extra_p)}")

    # 2. Cross-reference: workspace default/optional packs → pack ids.
    for ws in workspaces:
        wid = ws.get("id")
        for key in ("default_packs", "optional_packs"):
            for pid in ws.get(key, []) or []:
                if pid not in pack_ids:
                    errors.append(f"workspaces.yml '{wid}'.{key} → unknown pack '{pid}'")

    # 3. Cross-reference: pack workspaces → workspace ids.
    for pk in packs:
        pid = pk.get("id")
        for wid in pk.get("workspaces", []) or []:
            if wid not in ws_ids:
                errors.append(f"packs.yml '{pid}'.workspaces → unknown workspace '{wid}'")
        # requires / requires_hint (capability-packs.md): hard dependency edges.
        for dep in _requires_of(pk):
            if dep not in pack_ids:
                errors.append(f"packs.yml '{pid}'.requires → unknown pack '{dep}'")
        # suggests (capability-packs.md): soft companion edges.
        for sug in pk.get("suggests", []) or []:
            if sug not in pack_ids:
                errors.append(f"packs.yml '{pid}'.suggests → unknown pack '{sug}'")
            elif sug == pid:
                errors.append(f"packs.yml '{pid}'.suggests → must not reference itself")
        # size_class (capability-packs.md): closed enum when present.
        sc = pk.get("size_class")
        if sc is not None and sc not in SIZE_CLASSES:
            errors.append(
                f"packs.yml '{pid}'.size_class → invalid '{sc}' (allowed: {sorted(SIZE_CLASSES)})"
            )
        # domain + size_class are co-required: both present or both absent.
        has_domain = pk.get("domain") is not None
        has_size = sc is not None
        if has_domain != has_size:
            errors.append(
                f"packs.yml '{pid}': domain and size_class are co-required — "
                f"got domain={has_domain}, size_class={has_size}"
            )
        # cluster (road-to-wizard-ux-improvements § Phase 4): advisory wizard
        # grouping; the value must be a known pack id and not self-referential.
        cluster = pk.get("cluster")
        if cluster is not None:
            if cluster not in pack_ids:
                errors.append(f"packs.yml '{pid}'.cluster → unknown pack '{cluster}'")
            elif cluster == pid:
                errors.append(f"packs.yml '{pid}'.cluster → must not reference itself")

    # 4. Bidirectional integrity (council HIGH fold-in).
    pack_by_id = {pk.get("id"): pk for pk in packs}
    ws_by_id = {ws.get("id"): ws for ws in workspaces}
    for ws in workspaces:
        wid = ws.get("id")
        for key in ("default_packs", "optional_packs"):
            for pid in ws.get(key, []) or []:
                pk = pack_by_id.get(pid)
                if pk and wid not in (pk.get("workspaces") or []):
                    errors.append(
                        f"bidir: workspace '{wid}'.{key} lists '{pid}' but "
                        f"pack '{pid}'.workspaces does not list '{wid}'"
                    )
    for pk in packs:
        pid = pk.get("id")
        for wid in pk.get("workspaces", []) or []:
            ws = ws_by_id.get(wid)
            if ws:
                listed = set(ws.get("default_packs") or []) | set(ws.get("optional_packs") or [])
                if pid not in listed:
                    errors.append(
                        f"bidir: pack '{pid}'.workspaces lists '{wid}' but "
                        f"workspace '{wid}' does not list '{pid}' in default/optional_packs"
                    )

    # 5. Non-overlap (ADR-010).
    overlap_cost = pack_ids & RULE_LOADING_TIER_RESERVED
    if overlap_cost:
        errors.append(f"pack ids collide with rule_loading_tier values: {sorted(overlap_cost)}")
    overlap_profile = pack_ids & PROFILE_ID_RESERVED
    if overlap_profile:
        errors.append(f"pack ids collide with profile.id values: {sorted(overlap_profile)}")

    # 6. requires graph must be acyclic (capability-packs.md graph invariant).
    cycle = _detect_requires_cycle(packs)
    if cycle:
        errors.append(f"packs.yml requires graph has a cycle: {' → '.join(cycle)}")

    if errors:
        for e in errors:
            print(f"❌ {e}", file=sys.stderr)
        return 1
    if not quiet:
        print(f"✅ discovery vocabulary OK — {len(ws_ids)} workspaces · {len(pack_ids)} packs")
    return 0


if __name__ == "__main__":
    sys.exit(lint(quiet="--quiet" in sys.argv))
