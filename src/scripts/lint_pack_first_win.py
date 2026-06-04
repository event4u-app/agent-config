#!/usr/bin/env python3
"""Lint: every featured pack ships FIRST_WIN.md + onboarding: block.

Phase 4 Step 4 of road-to-role-first-onboarding.md.

A pack is "featured" when its id appears in the
FEATURED_PACK_IDS set below — currently the five role-first packs
listed in docs/featured-skills.md.

Each featured pack MUST have:
  - packages/pack-<id>/FIRST_WIN.md (file present, > 0 bytes)
  - packages/pack-<id>/pack.yaml with an `onboarding:` block carrying
    `first_win_doc`, `example_workflow`, `time_to_first_value_minutes`

Exits non-zero on any violation. Stdlib-only (no PyYAML — uses simple
YAML scan since pack.yaml is generator-controlled flat shape).
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
PACKAGES = REPO_ROOT / "packages"
SRC_DOMAINS = REPO_ROOT / "src" / "domains"


def _pack_home(pid: str) -> Path | None:
    """Resolve a pack's home dir, packages/ or the 6.0.0-D src/domains/ home.

    A pack whose source has moved into the flat library + src/domains
    (Step 10) is homed at ``src/domains/<id>/``; a not-yet-moved pack keeps
    its ``packages/pack-<id>/`` tree. Returns the first that exists, else None.
    """
    physical = PACKAGES / f"pack-{pid}"
    if physical.is_dir():
        return physical
    domain = SRC_DOMAINS / pid
    if domain.is_dir():
        return domain
    return None


FEATURED_PACK_IDS = {
    "founder-strategy",
    "finance-basic",
    "gtm-sales",
    "ops-people",
    "ai-video",
}

REQUIRED_ONBOARDING_KEYS = (
    "first_win_doc",
    "example_workflow",
    "time_to_first_value_minutes",
)


def _has_onboarding_block(pack_yaml: Path) -> tuple[bool, list[str]]:
    """Return (ok, missing_keys). Uses a tiny scanner — pack.yaml is
    generator-controlled, so we only check for the literal `onboarding:`
    parent key and the three required child keys nested under it."""
    if not pack_yaml.exists():
        return False, list(REQUIRED_ONBOARDING_KEYS)
    lines = pack_yaml.read_text(encoding="utf-8").splitlines()
    in_block = False
    found: set[str] = set()
    for raw in lines:
        if raw.startswith("onboarding:"):
            in_block = True
            continue
        if in_block:
            if raw and not raw.startswith((" ", "\t")):
                break
            stripped = raw.strip()
            for key in REQUIRED_ONBOARDING_KEYS:
                if stripped.startswith(f"{key}:"):
                    found.add(key)
    if not in_block:
        return False, list(REQUIRED_ONBOARDING_KEYS)
    missing = [k for k in REQUIRED_ONBOARDING_KEYS if k not in found]
    return not missing, missing


def main() -> int:
    errors: list[str] = []
    for pid in sorted(FEATURED_PACK_IDS):
        pack_dir = _pack_home(pid)
        if pack_dir is None:
            errors.append(
                f"missing pack home: neither packages/pack-{pid}/ nor "
                f"src/domains/{pid}/ exists"
            )
            continue
        first_win = pack_dir / "FIRST_WIN.md"
        if not first_win.exists() or first_win.stat().st_size == 0:
            errors.append(
                f"missing or empty: {first_win.relative_to(REPO_ROOT)}"
            )
        ok, missing = _has_onboarding_block(pack_dir / "pack.yaml")
        if not ok:
            errors.append(
                f"{pack_dir.name}/pack.yaml: onboarding block missing "
                f"key(s) {missing!r}"
            )
    if errors:
        print("❌ pack first-win lint failed:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        print(
            "  fix: add FIRST_WIN.md to the pack root and the onboarding "
            "block to config/discovery/packs.yml, then re-run "
            "`task generate-pack-manifests`",
            file=sys.stderr,
        )
        return 1
    print(
        f"✅ pack first-win lint OK — {len(FEATURED_PACK_IDS)} featured packs"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
