#!/usr/bin/env python3
"""Lint trust/safety coherence across the discovery manifest.

Phase 5.4 of the monorepo trust-and-safety layer. Walks the freshly
built `dist/discovery/discovery-manifest.json` and asserts three
invariants:

  1. Every pack whose ``trust_summary`` declares ``advisory`` or
     ``restricted`` artefacts ships at least one ``*safety-floor*``
     rule in the same pack.
  2. Every artefact with ``trust.human_review_required: true`` carries
     the ``_HRR_BANNER_MARKER`` in its compiled output under
     ``.agent-src/<logical>``.
  3. Every rule listed in ``router.json`` ``kernel[]`` declares
     ``trust.level: core`` (no escalation to advisory/restricted,
     no demotion to experimental).

Exits 0 clean, 1 on any violation. Stdlib + pyyaml. Cap: ≤ 200 LOC.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"
ROUTER = ROOT / "dist" / "router.json"
COMPILED_SRC = ROOT / ".agent-src"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import strip_source_prefix  # noqa: E402

# Imported lazily inside _banner_marker() to keep the cap loose if condense.py
# grows additional top-level side effects.
_BANNER_MARKER = "<!-- agent-config:human-review-banner -->"

# Trust levels that demand a domain-safety floor in the same pack.
_FLAGGED_LEVELS = ("advisory", "restricted")
_SAFETY_FLOOR_FRAGMENT = "safety-floor"


def _load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise SystemExit(
            f"ERROR: manifest not found: {path}\n"
            "  Run `task build-discovery` first."
        )
    return json.loads(path.read_text("utf-8"))


def _load_kernel(path: Path) -> set[str]:
    if not path.exists():
        raise SystemExit(f"ERROR: router.json not found: {path}")
    data = json.loads(path.read_text("utf-8"))
    kernel = data.get("kernel") or []
    if not isinstance(kernel, list):
        raise SystemExit("ERROR: router.json `kernel` must be a list")
    return {str(name) for name in kernel}


def _check_pack_safety_floors(manifest: dict[str, Any]) -> list[str]:
    """Check 1: advisory/restricted packs ship a *safety-floor* rule."""
    errs: list[str] = []
    # Build pack -> [artefact path] index from the artefact list so we can
    # spot the safety-floor regardless of how trust_summary was computed.
    pack_paths: dict[str, list[str]] = {}
    for art in manifest.get("artefacts", []):
        for pack in art.get("packs", []) or []:
            pack_paths.setdefault(pack, []).append(art["path"])

    for pack in manifest.get("packs", []):
        summary = pack.get("trust_summary", {}) or {}
        flagged_total = sum(int(summary.get(lvl, 0)) for lvl in _FLAGGED_LEVELS)
        if flagged_total == 0:
            continue
        paths = pack_paths.get(pack["id"], [])
        has_floor = any(_SAFETY_FLOOR_FRAGMENT in p for p in paths)
        if not has_floor:
            counts = ", ".join(
                f"{lvl}={int(summary.get(lvl, 0))}" for lvl in _FLAGGED_LEVELS
            )
            errs.append(
                f"pack `{pack['id']}` declares flagged artefacts ({counts})"
                f" but ships no `*{_SAFETY_FLOOR_FRAGMENT}*` rule"
            )
    return errs


def _check_human_review_banners(
    manifest: dict[str, Any], compiled_src: Path
) -> list[str]:
    """Check 2: every human_review_required artefact has the banner."""
    errs: list[str] = []
    for art in manifest.get("artefacts", []):
        trust = art.get("trust", {}) or {}
        if not trust.get("human_review_required"):
            continue
        rel = art["path"]
        logical = strip_source_prefix(rel)
        if logical is None:
            errs.append(
                f"{rel}: human_review_required=true but path is not under"
                " any known source root"
            )
            continue
        compiled = compiled_src / logical
        if not compiled.exists():
            errs.append(
                f"{rel}: human_review_required=true but compiled output"
                f" missing at `{compiled.relative_to(ROOT)}`"
            )
            continue
        body = compiled.read_text("utf-8", errors="replace")
        if _BANNER_MARKER not in body:
            errs.append(
                f"{rel}: human_review_required=true but compiled output"
                f" `{compiled.relative_to(ROOT)}` is missing the HRR banner"
                f" (`{_BANNER_MARKER}`) — re-run `task condense`."
            )
    return errs


def _check_kernel_trust(
    manifest: dict[str, Any], kernel: set[str]
) -> list[str]:
    """Check 3: every kernel rule declares trust.level=core."""
    errs: list[str] = []
    # name -> artefact for category=rule entries. Manifest does not always
    # populate `name` for rules, so fall back to the logical filename stem.
    rule_by_name: dict[str, dict[str, Any]] = {}
    for art in manifest.get("artefacts", []):
        if art.get("category") != "rule":
            continue
        name = art.get("name")
        if not name:
            logical = strip_source_prefix(art.get("path", ""))
            if logical is None:
                continue
            stem = Path(logical).stem
            name = stem
        rule_by_name[name] = art

    for kname in sorted(kernel):
        art = rule_by_name.get(kname)
        if art is None:
            errs.append(
                f"kernel rule `{kname}` listed in router.json but no"
                " matching artefact in manifest"
            )
            continue
        level = (art.get("trust", {}) or {}).get("level")
        if level != "core":
            errs.append(
                f"kernel rule `{kname}` has trust.level=`{level}`"
                " — must be `core` (router.json kernel guarantees Iron-Law"
                " floor)"
            )
    return errs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--manifest", type=Path, default=MANIFEST, help="discovery manifest"
    )
    parser.add_argument(
        "--router", type=Path, default=ROUTER, help="router.json with kernel[]"
    )
    parser.add_argument(
        "--compiled-src",
        type=Path,
        default=COMPILED_SRC,
        help="compiled output root (.agent-src/)",
    )
    args = parser.parse_args(argv)

    manifest = _load_manifest(args.manifest)
    kernel = _load_kernel(args.router)

    errs: list[str] = []
    errs.extend(_check_pack_safety_floors(manifest))
    errs.extend(_check_human_review_banners(manifest, args.compiled_src))
    errs.extend(_check_kernel_trust(manifest, kernel))

    if errs:
        for e in errs:
            print(f"ERROR: {e}", file=sys.stderr)
        print(
            f"\n{len(errs)} trust-coherence violation(s) across"
            f" {len(manifest.get('packs', []))} pack(s) and"
            f" {len(manifest.get('artefacts', []))} artefact(s).",
            file=sys.stderr,
        )
        return 1

    if not args.quiet:
        print(
            "✅  lint-trust-coherence:"
            f" {len(manifest.get('packs', []))} pack(s),"
            f" {len(kernel)} kernel rule(s),"
            f" {sum(1 for a in manifest.get('artefacts', []) if (a.get('trust') or {}).get('human_review_required'))}"
            " HRR artefact(s) clean."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
