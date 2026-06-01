#!/usr/bin/env python3
"""Vocabulary linter for `config/discovery/{workspaces,packs}.yml`.

Source-of-truth check: the YAML files MUST mirror the closed vocabulary
in `docs/decisions/ADR-013-discovery-frontmatter-contract.md` exactly.
Cross-reference check: every default/optional pack id referenced from
`workspaces.yml` MUST exist in `packs.yml`, and every workspace id in
`packs.yml` MUST exist in `workspaces.yml`. Bidirectional integrity:
every pack listed as a workspace's default/optional MUST list that
workspace in its own `workspaces:` array (and vice versa).

Non-overlap (ADR-010 alignment): no pack id may collide with a
`cost_profile` value (minimal/balanced/full/custom) or a `profile.id`
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

REPO_ROOT = Path(__file__).resolve().parent.parent
WORKSPACES_YML = REPO_ROOT / "config" / "discovery" / "workspaces.yml"
PACKS_YML = REPO_ROOT / "config" / "discovery" / "packs.yml"

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
    "construction", "ai-video", "fun", "meta",
})

# ADR-010 non-overlap reservations.
COST_PROFILE_RESERVED: frozenset[str] = frozenset({
    "minimal", "balanced", "full", "custom",
})
PROFILE_ID_RESERVED: frozenset[str] = frozenset({
    "founder", "developer", "content_creator", "agency", "finance", "ops",
})


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
        for hint in pk.get("requires_hint", []) or []:
            if hint not in pack_ids:
                errors.append(f"packs.yml '{pid}'.requires_hint → unknown pack '{hint}'")
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
    overlap_cost = pack_ids & COST_PROFILE_RESERVED
    if overlap_cost:
        errors.append(f"pack ids collide with cost_profile values: {sorted(overlap_cost)}")
    overlap_profile = pack_ids & PROFILE_ID_RESERVED
    if overlap_profile:
        errors.append(f"pack ids collide with profile.id values: {sorted(overlap_profile)}")

    if errors:
        for e in errors:
            print(f"❌ {e}", file=sys.stderr)
        return 1
    if not quiet:
        print(f"✅ discovery vocabulary OK — {len(ws_ids)} workspaces · {len(pack_ids)} packs")
    return 0


if __name__ == "__main__":
    sys.exit(lint(quiet="--quiet" in sys.argv))
