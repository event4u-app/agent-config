#!/usr/bin/env python3
"""Move a single artefact between packs via ``git mv`` (history-preserving).

Phase 4.5 of the monorepo migration (ADR-017). Locates the artefact by
slug or logical path, computes its destination under the requested
pack, runs ``git mv`` for the artefact directory (skills/commands) or
the single file (rules), and rewrites the ``packs:`` frontmatter so the
discovery manifest stays in sync.

CLI:
  --id ID            artefact slug (skill/command name or rule stem)
  --type TYPE        skill | rule | command (required when --id ambiguous)
  --to PACK          target pack id (e.g. ``laravel``, ``core``)
  --dry-run          print the planned move and frontmatter edit, no FS changes
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = ROOT / "packages"
PACKS_VOCAB = ROOT / "src" / "config" / "discovery" / "packs.yml"


def _list_pack_ids() -> set[str]:
    data = yaml.safe_load(PACKS_VOCAB.read_text(encoding="utf-8")) or []
    return {p["id"] for p in data} | {"core"}


def _pack_dir(pack_id: str) -> Path:
    return PACKAGES / ("core" if pack_id == "core" else f"pack-{pack_id}")


def _find_artefact(slug: str, kind: str | None) -> tuple[Path, str, str]:
    """Return (physical_path, detected_kind, current_pack_id)."""
    hits: list[tuple[Path, str, str]] = []
    for pkg in sorted(PACKAGES.iterdir()):
        src = pkg / ".agent-src.uncondensed"
        if not src.is_dir():
            continue
        pid = "core" if pkg.name == "core" else pkg.name.removeprefix("pack-")
        for k, rel in (("skill", f"skills/{slug}/SKILL.md"),
                        ("rule", f"rules/{slug}.md"),
                        ("command", f"commands/{slug}.md")):
            p = src / rel
            if p.exists() and (kind is None or kind == k):
                hits.append((p, k, pid))
    if not hits:
        raise SystemExit(f"error: artefact '{slug}' not found under any pack")
    if len(hits) > 1 and kind is None:
        kinds = ", ".join(sorted({h[1] for h in hits}))
        raise SystemExit(f"error: '{slug}' ambiguous (found as: {kinds}); pass --type")
    return hits[0]


def _move_root(path: Path, kind: str) -> Path:
    """Return the path to git-mv (directory for skills, file for rule/command)."""
    return path.parent if kind == "skill" else path


def _rewrite_packs(md_path: Path, new_pack: str, dry_run: bool) -> bool:
    text = md_path.read_text(encoding="utf-8")
    if not text.startswith("---"):
        return False
    end = text.find("\n---", 4)
    if end == -1:
        return False
    head = text[4:end]
    body = text[end:]
    fm = yaml.safe_load(head) or {}
    if not isinstance(fm, dict):
        return False
    current = fm.get("packs") or []
    desired = [] if new_pack == "core" else [new_pack]
    if current == desired:
        return False
    if desired:
        fm["packs"] = desired
    else:
        fm.pop("packs", None)
    new_text = "---\n" + yaml.safe_dump(fm, sort_keys=False, allow_unicode=True) + body[1:]
    if dry_run:
        print(f"  would rewrite frontmatter packs: {current} -> {desired}")
    else:
        md_path.write_text(new_text, encoding="utf-8")
        print(f"  rewrote frontmatter packs: {current} -> {desired}")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--id", required=True, help="artefact slug")
    ap.add_argument("--to", required=True, help="target pack id")
    ap.add_argument("--type", choices=["skill", "rule", "command"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    vocab = _list_pack_ids()
    if args.to not in vocab:
        print(f"error: target pack '{args.to}' not in {sorted(vocab)}", file=sys.stderr)
        return 2

    src_md, kind, current_pack = _find_artefact(args.id, args.type)
    if current_pack == args.to:
        print(f"no-op: '{args.id}' already lives in pack '{args.to}'")
        return 0

    src_root = _move_root(src_md, kind)
    dest_pkg_src = _pack_dir(args.to) / ".agent-src.uncondensed"
    rel_under_pack = src_root.relative_to(_pack_dir(current_pack) / ".agent-src.uncondensed")
    dest_root = dest_pkg_src / rel_under_pack

    print(f"plan: {kind} '{args.id}' : {current_pack} -> {args.to}")
    print(f"  git mv {src_root.relative_to(ROOT)} {dest_root.relative_to(ROOT)}")

    # Frontmatter must be rewritten BEFORE the move so the new physical
    # location matches the declared pack. Discovery scanner cross-checks.
    _rewrite_packs(src_md, args.to, args.dry_run)

    if args.dry_run:
        print("dry-run: no FS changes")
        return 0

    dest_root.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["git", "mv", str(src_root.relative_to(ROOT)), str(dest_root.relative_to(ROOT))],
        cwd=ROOT, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print(f"git mv failed: {result.stderr}", file=sys.stderr)
        return result.returncode
    print(f"moved: {src_root.relative_to(ROOT)} -> {dest_root.relative_to(ROOT)}")
    print("next: run `task sync` and `task lint-pack-boundaries`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
