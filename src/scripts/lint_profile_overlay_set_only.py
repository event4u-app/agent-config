#!/usr/bin/env python3
"""lint_profile_overlay_set_only — freeze the set-only overlay invariant.

Phase 3 of road-to-session-profile-observability. The `runtime.active_packs`
overlay is an **order-independent union of pack ids** (ADR-010 addendum): there
is intentionally no precedence, no scalar "audience hint", no ordering. The
resolver (`scripts/config/session_profiles.py`) writes it via `set_overlay`,
which always emits `sorted(set(...))` — a set. This lint freezes that invariant
at the *data* layer, so a future scalar-precedence regression in the static
profile / pack / alias definitions fails the build instead of silently
re-introducing a precedence concept.

Two clauses, straight from the roadmap:

  1. Every `/profile activate` token resolves only to **pack-id sets** — every
     `aliases.<name>` in `session-profiles.yml` is a list of strings, each a
     known pack id, and every profile's seed `profile.packs` is a list of known
     pack ids. No alias / seed is a scalar or a dict.

  2. No profile / pack path injects a **scalar audience hint** into the overlay
     — no static definition declares a scalar `active_packs`, and none carries a
     `precedence` / `priority` / `order` key on a pack association (such a key
     would be a scalar-precedence regression against the order-independent union).

Pure data lint, no I/O beyond reading the four yaml surfaces. Exit 0 clean,
1 on any violation. `--quiet` suppresses the success line.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover - yaml is a hard dep in CI
    yaml = None

REPO_ROOT = Path(__file__).resolve().parents[2]
ALIASES_YML = REPO_ROOT / "src/config/discovery/session-profiles.yml"
PACKS_YML = REPO_ROOT / "src/config/discovery/packs.yml"
PROFILES_DIR = REPO_ROOT / "src/agent-src/profiles"
PACKS_DIR = REPO_ROOT / "src/agent-src/packs"

# A key whose presence on a pack association would imply ordering / precedence —
# forbidden, because the union is order-independent by construction.
PRECEDENCE_KEYS = {"precedence", "priority", "order", "rank", "weight"}
OVERLAY_KEY = "active_packs"


def _load_yaml(path: Path) -> Any:
    if yaml is None or not path.exists():
        return None
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError:
        return None


def _pack_universe() -> set[str]:
    data = _load_yaml(PACKS_YML)
    if not isinstance(data, list):
        return set()
    return {str(e["id"]) for e in data if isinstance(e, dict) and e.get("id")}


def _walk_keys(node: Any) -> list[str]:
    """Every mapping key anywhere in the tree (depth-first)."""
    keys: list[str] = []
    if isinstance(node, dict):
        for k, v in node.items():
            keys.append(str(k))
            keys.extend(_walk_keys(v))
    elif isinstance(node, list):
        for item in node:
            keys.extend(_walk_keys(item))
    return keys


def _find_scalar_active_packs(node: Any) -> bool:
    """True if `active_packs` appears anywhere as a non-list scalar/dict."""
    if isinstance(node, dict):
        for k, v in node.items():
            if str(k) == OVERLAY_KEY and not isinstance(v, list):
                return True
            if _find_scalar_active_packs(v):
                return True
    elif isinstance(node, list):
        return any(_find_scalar_active_packs(item) for item in node)
    return False


def lint(quiet: bool = False) -> int:
    errors: list[str] = []
    universe = _pack_universe()

    # --- Clause 1a: aliases resolve only to pack-id sets ----------------------
    alias_data = _load_yaml(ALIASES_YML)
    aliases = alias_data.get("aliases") if isinstance(alias_data, dict) else None
    if not isinstance(aliases, dict):
        errors.append(f"{ALIASES_YML.name}: no `aliases:` mapping found")
    else:
        for name, value in aliases.items():
            if not isinstance(value, list):
                errors.append(
                    f"{ALIASES_YML.name}: alias '{name}' is not a list "
                    f"(set-only invariant — got {type(value).__name__}). "
                    f"An alias must resolve to a pack-id set, never a scalar/dict."
                )
                continue
            for pid in value:
                if not isinstance(pid, str):
                    errors.append(
                        f"{ALIASES_YML.name}: alias '{name}' has a non-string member {pid!r}"
                    )
                elif universe and pid not in universe:
                    errors.append(
                        f"{ALIASES_YML.name}: alias '{name}' → unknown pack '{pid}'"
                    )

    # --- Clause 1b + 2: per static definition file ----------------------------
    for label, directory, root_key, seed_key in (
        ("profile", PROFILES_DIR, "profile", "packs"),
        ("pack", PACKS_DIR, "pack", None),
    ):
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.yml")):
            doc = _load_yaml(path)
            if not isinstance(doc, dict):
                continue
            rel = path.relative_to(REPO_ROOT)

            # Clause 2a: no scalar `active_packs` pre-seed anywhere in the file.
            if _find_scalar_active_packs(doc):
                errors.append(
                    f"{rel}: declares a scalar `active_packs` — the overlay is a "
                    f"set written only by set_overlay(); a static scalar seed is a "
                    f"precedence regression."
                )

            # Clause 2b: no precedence/priority/order key anywhere.
            bad = sorted(set(_walk_keys(doc)) & PRECEDENCE_KEYS)
            if bad:
                errors.append(
                    f"{rel}: carries ordering key(s) {bad} — the overlay union is "
                    f"order-independent; precedence is intentionally undefined."
                )

            # Clause 1b: a profile's seed `profile.packs` is a list of known ids.
            if seed_key:
                inner = doc.get(root_key)
                if isinstance(inner, dict) and seed_key in inner:
                    seeds = inner[seed_key]
                    if not isinstance(seeds, list):
                        errors.append(
                            f"{rel}: {root_key}.{seed_key} is not a list "
                            f"(got {type(seeds).__name__}) — seed packs must be a set."
                        )
                    else:
                        for pid in seeds:
                            if not isinstance(pid, str):
                                errors.append(f"{rel}: {root_key}.{seed_key} non-string {pid!r}")
                            elif universe and pid not in universe:
                                errors.append(f"{rel}: {root_key}.{seed_key} → unknown pack '{pid}'")

    if errors:
        for e in errors:
            print(f"❌ {e}", file=sys.stderr)
        return 1
    if not quiet:
        n_alias = len(aliases) if isinstance(aliases, dict) else 0
        print(f"✅ profile overlay set-only OK — {n_alias} aliases, precedence undefined by design")
    return 0


if __name__ == "__main__":
    sys.exit(lint(quiet="--quiet" in sys.argv))
