#!/usr/bin/env python3
"""Lint Phase-4 discovery frontmatter on every artefact.

Walks the same trees as `scripts/build_discovery_manifest.py` (skills,
rules, commands, templates under `.agent-src.uncondensed/`) and asserts
per-file that the five ADR-013 keys (`workspaces`, `packs`, `lifecycle`,
`trust`, `install`) are present and well-formed:

  - `workspaces:` exists, is a non-empty list, every value in `workspaces.yml`
  - `packs:`      exists, is a non-empty list, every value in `packs.yml`
  - `lifecycle:`  is one of {active, deprecated, experimental, archived}
  - `trust.level` is one of {core, professional, experimental, advisory, restricted}
  - `trust.confidence` is one of {high, medium, low}
  - `trust.human_review_required` is a bool
  - `install.default` and `install.removable` are bools
  - artefact path is not also listed in `unassigned-artefacts.yml`

Exits 0 clean, 1 on any violation. Stdlib + pyyaml. Cap: ≤ 200 LOC.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    print("ERROR: PyYAML required (pip install pyyaml)", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / ".agent-src.uncondensed"
VOCAB_DIR = ROOT / "config" / "discovery"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402

LIFECYCLES = frozenset({"active", "deprecated", "experimental", "archived"})
TRUST_LEVELS = frozenset(
    {"core", "professional", "experimental", "advisory", "restricted"}
)
TRUST_CONFIDENCE = frozenset({"high", "medium", "low"})


def _load_vocab() -> tuple[set[str], set[str], set[str]]:
    ws = yaml.safe_load((VOCAB_DIR / "workspaces.yml").read_text("utf-8")) or []
    packs = yaml.safe_load((VOCAB_DIR / "packs.yml").read_text("utf-8")) or []
    raw_un = yaml.safe_load((VOCAB_DIR / "unassigned-artefacts.yml").read_text("utf-8")) or []
    ws_ids = {e["id"] for e in ws}
    pack_ids = {e["id"] for e in packs}
    quarantine = {e["path"] for e in raw_un}
    return ws_ids, pack_ids, quarantine


def _iter_artefacts() -> list[Path]:
    out: list[Path] = []
    for p in sorted((SRC / "skills").rglob("SKILL.md")):
        out.append(p)
    for p in sorted((SRC / "rules").rglob("*.md")):
        out.append(p)
    for p in sorted((SRC / "commands").rglob("*.md")):
        out.append(p)
    if (SRC / "templates").exists():
        for p in sorted((SRC / "templates").rglob("*.md")):
            out.append(p)
    return out


def _check_one(
    path: Path,
    ws_ids: set[str],
    pack_ids: set[str],
    quarantine: set[str],
) -> list[str]:
    rel = path.relative_to(ROOT).as_posix()
    errs: list[str] = []
    if rel in quarantine:
        # Quarantined scaffolds are not required to carry frontmatter and
        # must NOT also try to (would shadow the materialisation contract).
        text = path.read_text("utf-8", errors="replace")
        fm, _ = parse_frontmatter(text)
        if isinstance(fm, dict) and any(
            k in fm for k in ("workspaces", "packs", "lifecycle", "trust", "install")
        ):
            errs.append(
                f"{rel}: quarantined in unassigned-artefacts.yml but carries"
                " discovery frontmatter — remove one or the other."
            )
        return errs

    text = path.read_text("utf-8", errors="replace")
    fm, _ = parse_frontmatter(text)
    if not isinstance(fm, dict):
        errs.append(f"{rel}: missing or unparseable frontmatter")
        return errs

    for key in ("workspaces", "packs", "lifecycle", "trust", "install"):
        if key not in fm:
            errs.append(f"{rel}: missing required key `{key}`")
    if errs:
        return errs

    ws = fm["workspaces"]
    if not isinstance(ws, list) or not ws:
        errs.append(f"{rel}: workspaces must be a non-empty list")
    else:
        bad = [w for w in ws if w not in ws_ids]
        if bad:
            errs.append(f"{rel}: workspaces not in workspaces.yml: {bad}")

    packs = fm["packs"]
    if not isinstance(packs, list) or not packs:
        errs.append(f"{rel}: packs must be a non-empty list")
    else:
        bad = [p for p in packs if p not in pack_ids]
        if bad:
            errs.append(f"{rel}: packs not in packs.yml: {bad}")

    lc = fm["lifecycle"]
    if lc not in LIFECYCLES:
        errs.append(f"{rel}: lifecycle `{lc}` not in {sorted(LIFECYCLES)}")

    trust = fm["trust"]
    if not isinstance(trust, dict):
        errs.append(f"{rel}: trust must be a mapping")
    else:
        if trust.get("level") not in TRUST_LEVELS:
            errs.append(
                f"{rel}: trust.level `{trust.get('level')}` not in {sorted(TRUST_LEVELS)}"
            )
        if trust.get("confidence") not in TRUST_CONFIDENCE:
            errs.append(
                f"{rel}: trust.confidence `{trust.get('confidence')}` not in"
                f" {sorted(TRUST_CONFIDENCE)}"
            )
        if not isinstance(trust.get("human_review_required"), bool):
            errs.append(f"{rel}: trust.human_review_required must be bool")

    install = fm["install"]
    if not isinstance(install, dict):
        errs.append(f"{rel}: install must be a mapping")
    else:
        if not isinstance(install.get("default"), bool):
            errs.append(f"{rel}: install.default must be bool")
        if not isinstance(install.get("removable"), bool):
            errs.append(f"{rel}: install.removable must be bool")
    return errs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args(argv)

    ws_ids, pack_ids, quarantine = _load_vocab()
    artefacts = _iter_artefacts()
    all_errs: list[str] = []
    for p in artefacts:
        all_errs.extend(_check_one(p, ws_ids, pack_ids, quarantine))

    if all_errs:
        for e in all_errs:
            print(f"ERROR: {e}", file=sys.stderr)
        print(
            f"\n{len(all_errs)} violation(s) across {len(artefacts)} artefact(s).",
            file=sys.stderr,
        )
        return 1
    if not args.quiet:
        print(
            f"✅  lint-artefact-frontmatter: {len(artefacts)} artefact(s) clean"
            f" (quarantine: {len(quarantine)})."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
