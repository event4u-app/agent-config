#!/usr/bin/env python3
"""Validate every ``packages/*/pack.yaml`` against the pack schema.

road-to-6.0.0-D Phase 0 Step 2 — "validate-on-load with a clear fail
message on a typo'd / non-existent reference." Two checks per manifest:

1. **Shape** — the manifest validates against
   ``scripts/schemas/pack.schema.json`` (Draft-07, via ``jsonschema``).
2. **References resolve** — every ``dependencies.skills`` slug backs a real
   ``skills/<slug>/SKILL.md``; every ``dependencies.rules`` slug backs a real
   ``rules/<slug>.md``; every ``requires`` / ``suggests`` / ``dependencies.packs``
   id is a known pack id (closed vocabulary in ``config/discovery/packs.yml``
   plus the physical ``packages/*/`` ids).

Exit codes: 0 = all valid · 1 = at least one violation · 3 = internal error.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import resolve_logical  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = ROOT / "packages"
SRC_DOMAINS = ROOT / "src" / "domains"
PACKS_VOCAB = ROOT / "config" / "discovery" / "packs.yml"


def _manifest_dirs() -> list[Path]:
    """Every directory that may own a ``pack.yaml`` — legacy ``packages/*/``
    plus 6.0.0-D ``src/domains/*/`` homes."""
    dirs: list[Path] = []
    if PACKAGES.is_dir():
        dirs.extend(sorted(p for p in PACKAGES.iterdir() if p.is_dir()))
    if SRC_DOMAINS.is_dir():
        dirs.extend(sorted(p for p in SRC_DOMAINS.iterdir()
                           if p.is_dir() and not p.name.startswith("_")))
    return dirs
SCHEMA = ROOT / "src" / "scripts" / "schemas" / "pack.schema.json"
ALLOWLIST = ROOT / "src" / "scripts" / "pack_dependency_allowlist.json"


def _load_allowlist() -> set[tuple[str, str]]:
    """Baseline of pre-existing (pack_id, slug) references to skip.

    road-to-6.0.0-D Phase 0 is move-only; pre-existing `skills:` entries that
    point at command-routing targets or non-existent skills are tracked for a
    6.1 cleanup rather than edited now (council convergence, 2026-06-03).
    """
    if not ALLOWLIST.exists():
        return set()
    try:
        data = json.loads(ALLOWLIST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    return {
        (e["pack"], e["slug"])
        for e in data.get("entries", [])
        if isinstance(e, dict) and "pack" in e and "slug" in e
    }


def _known_pack_ids() -> set[str]:
    """Closed pack-id vocabulary: discovery vocab ids + physical pack ids."""
    ids: set[str] = set()
    try:
        vocab = yaml.safe_load(PACKS_VOCAB.read_text(encoding="utf-8")) or []
        for entry in vocab:
            if isinstance(entry, dict) and isinstance(entry.get("id"), str):
                ids.add(entry["id"])
    except (OSError, yaml.YAMLError):
        pass
    if PACKAGES.is_dir():
        for pkg in PACKAGES.iterdir():
            if pkg.is_dir():
                # mirror _pack_id_from_dir: strip a leading "pack-"
                ids.add(pkg.name[5:] if pkg.name.startswith("pack-") else pkg.name)
    if SRC_DOMAINS.is_dir():
        for dom in SRC_DOMAINS.iterdir():
            if dom.is_dir() and not dom.name.startswith("_"):
                ids.add(dom.name)
    return ids


def _slug_resolves(slug: str, kind: str) -> bool:
    """A dependency reference resolves if it backs a real skill OR rule.

    The `dependencies.skills` / `dependencies.rules` buckets are derived from
    each command's `skills:` / `rules:` frontmatter, which authors use loosely
    as a general artefact-dependency marker — a rule frequently appears under
    `skills:`. Accepting skill OR rule keeps this validator consistent with the
    transitive hasher in condense.py (`_slug_to_logical` checks both) rather
    than enforcing a `skills: must be skills` contract that never held at
    runtime (council convergence claude-sonnet-4-5 + gpt-4o, 2026-06-03).
    """
    del kind  # symmetric: resolve against skills first, then rules
    return (
        resolve_logical(f"skills/{slug}/SKILL.md") is not None
        or resolve_logical(f"rules/{slug}.md") is not None
    )


def _validate_manifest(path: Path, schema: dict, known_packs: set[str],
                       allowlist: set[tuple[str, str]]) -> list[str]:
    import jsonschema  # local import — maintainer/CI dependency only

    errors: list[str] = []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        return [f"{path}: cannot parse YAML — {exc}"]

    validator = jsonschema.Draft7Validator(schema)
    for err in sorted(validator.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in err.path) or "<root>"
        errors.append(f"{path}: schema error at {loc}: {err.message}")

    pack_id = data.get("id", path.parent.name)
    deps = data.get("dependencies") or {}
    for kind in ("skills", "rules"):
        for slug in deps.get(kind, []) or []:
            if (pack_id, slug) in allowlist:
                continue
            if not _slug_resolves(slug, kind):
                errors.append(
                    f"{path}: dependencies.{kind} references '{slug}' but no "
                    f"skill or rule with that slug exists (typo or unmoved artefact?)"
                )
    for field in ("requires", "suggests"):
        for pid in data.get(field, []) or []:
            if pid not in known_packs:
                errors.append(
                    f"{path}: {field} references unknown pack id '{pid}'"
                )
    for pid in deps.get("packs", []) or []:
        if pid not in known_packs:
            errors.append(
                f"{path}: dependencies.packs references unknown pack id '{pid}'"
            )
    return errors


def main() -> int:
    if not SCHEMA.exists():
        print(f"❌  pack schema not found: {SCHEMA}", file=sys.stderr)
        return 3
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    manifest_dirs = _manifest_dirs()
    if not manifest_dirs:
        print("no pack homes (packages/ or src/domains/) — nothing to validate")
        return 0
    known_packs = _known_pack_ids()
    allowlist = _load_allowlist()
    all_errors: list[str] = []
    count = 0
    for pkg in manifest_dirs:
        manifest = pkg / "pack.yaml"
        if not manifest.exists():
            continue
        count += 1
        all_errors.extend(_validate_manifest(manifest, schema, known_packs, allowlist))
    if all_errors:
        for e in all_errors:
            print(f"❌  {e}", file=sys.stderr)
        print(f"\n{len(all_errors)} pack.yaml violation(s) across {count} manifest(s).",
              file=sys.stderr)
        return 1
    print(f"✅  {count} pack.yaml manifest(s) valid (schema + references resolve).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
