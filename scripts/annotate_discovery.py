#!/usr/bin/env python3
"""R3 Phase 4 mass-annotator — discovery frontmatter helper.

Walks a list of artefacts in `.agent-src.uncompressed/` and:
  1. Inserts the 5 ADR-013 frontmatter keys (workspaces, packs, lifecycle,
     trust, install) before the closing `---`, deterministically.
  2. Mirrors the new keys into the matching `.agent-src/` counterpart so
     the compressed projection stays consistent (body preserved).
  3. Refreshes `.compression-hashes.json` for each touched source path so
     `task check-compression` stays green.

Idempotent: re-runs leave already-annotated files untouched.

Mapping table (`PACK_MAP`) is the council-locked authority. See
`agents/runtime/council/responses/r3-phase-4-7-execution.md`.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".agent-src.uncompressed"
DST = ROOT / ".agent-src"
HASH_FILE = ROOT / ".compression-hashes.json"

# Pack → (workspace_id, trust_level, default_install, removable, lifecycle).
PACK_DEFAULTS: dict[str, tuple[str, str, bool, bool, str]] = {
    "engineering-base":  ("engineering",              "core",         True,  False, "active"),
    "php":               ("engineering",              "professional", False, True,  "active"),
    "laravel":           ("engineering",              "professional", False, True,  "active"),
    "symfony":           ("engineering",              "professional", False, True,  "active"),
    "javascript":        ("engineering",              "professional", False, True,  "active"),
    "typescript":        ("engineering",              "professional", False, True,  "active"),
    "react":             ("engineering",              "professional", False, True,  "active"),
    "nextjs":            ("engineering",              "professional", False, True,  "active"),
    "python":            ("engineering",              "professional", False, True,  "active"),
    "product-basic":     ("product",                  "professional", True,  True,  "active"),
    "product-discovery": ("product",                  "professional", False, True,  "active"),
    "finance-basic":     ("finance",                  "professional", True,  True,  "active"),
    "finance-advanced":  ("finance",                  "core",         False, True,  "active"),
    "gtm-sales":         ("gtm",                      "professional", True,  True,  "active"),
    "gtm-marketing":     ("gtm",                      "professional", True,  True,  "active"),
    "ops-people":        ("ops",                      "professional", True,  True,  "active"),
    "founder-strategy":  ("founder",                  "core",         True,  True,  "active"),
    "small-business":    ("small-business",           "professional", True,  True,  "active"),
    "construction":      ("construction",             "professional", True,  True,  "active"),
    "ai-video":          ("small-business",           "experimental", False, True,  "experimental"),
    "meta":              ("agent-config-maintainer",  "core",         True,  False, "active"),
}

_FM_RE = re.compile(r"^(---\n)(.*?)(\n---\n)", re.DOTALL)
# Detect any of the 5 new keys at top-level to make the writer idempotent.
_HAS_NEW_KEYS_RE = re.compile(r"^(workspaces|packs|lifecycle|trust|install):", re.MULTILINE)


def _render_block(pack: str) -> str:
    ws, level, default, removable, lifecycle = PACK_DEFAULTS[pack]
    return (
        f"workspaces:\n"
        f"  - {ws}\n"
        f"packs:\n"
        f"  - {pack}\n"
        f"lifecycle: {lifecycle}\n"
        f"trust:\n"
        f"  level: {level}\n"
        f"  confidence: high\n"
        f"  human_review_required: false\n"
        f"install:\n"
        f"  default: {'true' if default else 'false'}\n"
        f"  removable: {'true' if removable else 'false'}"
    )


def _annotate(path: Path, pack: str) -> bool:
    text = path.read_text(encoding="utf-8")
    m = _FM_RE.match(text)
    if not m:
        print(f"  skip (no frontmatter): {path.relative_to(ROOT)}", file=sys.stderr)
        return False
    body_fm = m.group(2)
    if _HAS_NEW_KEYS_RE.search(body_fm):
        return False  # idempotent
    block = _render_block(pack)
    new_fm = body_fm.rstrip() + "\n" + block
    new_text = m.group(1) + new_fm + m.group(3) + text[m.end():]
    path.write_text(new_text, encoding="utf-8")
    return True


def _mirror_to_compressed(rel: Path, pack: str) -> None:
    src = SRC / rel
    dst = DST / rel
    if not dst.exists():
        return  # no compressed counterpart yet (e.g. new file)
    text = dst.read_text(encoding="utf-8")
    m = _FM_RE.match(text)
    if not m:
        return
    body_fm = m.group(2)
    if _HAS_NEW_KEYS_RE.search(body_fm):
        return
    block = _render_block(pack)
    new_fm = body_fm.rstrip() + "\n" + block
    new_text = m.group(1) + new_fm + m.group(3) + text[m.end():]
    dst.write_text(new_text, encoding="utf-8")


def _refresh_hash(rel: Path, hashes: dict) -> None:
    src = SRC / rel
    key = rel.as_posix()
    hashes[key] = hashlib.sha256(src.read_bytes()).hexdigest()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--pack", required=True, choices=sorted(PACK_DEFAULTS))
    ap.add_argument("paths", nargs="+", help="repo-relative paths under .agent-src.uncompressed/")
    args = ap.parse_args(argv)

    hashes: dict = json.loads(HASH_FILE.read_text()) if HASH_FILE.exists() else {}
    changed = 0
    for raw in args.paths:
        p = Path(raw)
        if p.is_absolute():
            p = p.relative_to(ROOT)
        if not p.is_relative_to(Path(".agent-src.uncompressed")):
            print(f"  skip (not under .agent-src.uncompressed/): {p}", file=sys.stderr)
            continue
        rel = p.relative_to(".agent-src.uncompressed")
        src_file = SRC / rel
        if not src_file.is_file():
            print(f"  skip (missing): {p}", file=sys.stderr)
            continue
        if _annotate(src_file, args.pack):
            changed += 1
        _mirror_to_compressed(rel, args.pack)
        _refresh_hash(rel, hashes)
    HASH_FILE.write_text(json.dumps(hashes, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"annotated {changed} files with pack={args.pack}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
