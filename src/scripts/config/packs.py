#!/usr/bin/env python3
"""Pack loader (6.0.0-B Phase 3) — deterministic build/install-time resolver.

Given a selected pack set, resolves:

  1. the full ACTIVE PACK set — seed the ``always_on`` packs + the selected
     packs, then expand the ``requires`` closure (capability-packs.md;
     ``suggests`` is advisory and is NOT expanded);
  2. the ACTIVE ARTEFACT set — commands by their canonical ``pack`` OWNER,
     skills by ``packs`` membership. Rules are excluded: they stay
     router-driven (ADR-040). ``legacy_all=True`` returns the full set —
     the 6.0.0 default, byte-for-byte the pre-6.0.0 projection.

This is the resolver ADR-040 scopes as build/install-time — NOT a runtime
daemon. The projector (``scripts/condense.py``) and ``agent-config use``
(``scripts/profile_use.py``) consult it; it never runs per host-tool request.

CLI (debugging):
  python3 scripts/config/packs.py --packs laravel,finance-basic
  python3 scripts/config/packs.py --legacy-all
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Reuse the vocab / closure / manifest loaders — single source of truth.
from scripts.config.session_profiles import (  # noqa: E402
    expand_closure,
    load_manifest,
    load_packs_vocab,
)

_PROJECTED_CATEGORIES = ("command", "skill")  # rules stay router-driven


@dataclass
class ActiveSet:
    """Resolved active pack + artefact set for one projection."""

    packs: list[str]
    commands: list[str]
    skills: list[str]
    legacy_all: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "legacy_all": self.legacy_all,
            "packs": self.packs,
            "commands": self.commands,
            "skills": self.skills,
            "counts": {
                "packs": len(self.packs),
                "commands": len(self.commands),
                "skills": len(self.skills),
            },
        }


def always_on_packs(vocab: dict[str, dict[str, Any]]) -> set[str]:
    """Default packs the resolver seeds into every scoped projection."""
    return {pid for pid, p in vocab.items() if (p or {}).get("always_on")}


def resolve_active_packs(
    vocab: dict[str, dict[str, Any]],
    selected: Iterable[str] | None,
    *,
    legacy_all: bool = False,
) -> list[str]:
    """Full active pack set: always-on ∪ selected, expanded over ``requires``.

    ``legacy_all`` short-circuits to the entire declared vocabulary.
    ``suggests`` edges are advisory and intentionally not expanded.
    """
    if legacy_all:
        return sorted(vocab.keys())
    seeds = set(selected or ()) | always_on_packs(vocab)
    # Drop unknown ids defensively — a typo'd pack must not crash projection.
    seeds &= set(vocab.keys())
    return expand_closure(seeds, vocab)


def resolve_active_set(
    repo_root: Path,
    selected: Iterable[str] | None = None,
    *,
    legacy_all: bool = False,
) -> ActiveSet:
    """Resolve the active pack + artefact set for a projection.

    Command membership is OWNER-based (``pack``); skill membership is
    discovery-based (``packs`` ∩ active). Rules are never returned.
    """
    vocab = load_packs_vocab(repo_root)
    active = set(resolve_active_packs(vocab, selected, legacy_all=legacy_all))
    commands: list[str] = []
    skills: list[str] = []
    for art in load_manifest(repo_root):
        cat = art.get("category")
        if cat not in _PROJECTED_CATEGORIES:
            continue
        path = art.get("path")
        if not path:
            continue
        if legacy_all:
            (commands if cat == "command" else skills).append(path)
            continue
        if cat == "command":
            if art.get("pack") in active:
                commands.append(path)
        else:  # skill
            if set(art.get("packs") or ()) & active:
                skills.append(path)
    return ActiveSet(
        packs=sorted(active),
        commands=sorted(commands),
        skills=sorted(skills),
        legacy_all=legacy_all,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--packs", default="", help="Comma-separated selected pack ids."
    )
    parser.add_argument(
        "--legacy-all", action="store_true",
        help="Resolve the full set (6.0.0 default, non-breaking).",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON.")
    args = parser.parse_args(argv)

    selected = [p.strip() for p in args.packs.split(",") if p.strip()]
    result = resolve_active_set(REPO_ROOT, selected, legacy_all=args.legacy_all)
    if args.json:
        print(json.dumps(result.to_dict(), indent=2))
    else:
        mode = "legacy-all" if result.legacy_all else f"scoped({','.join(selected) or 'always-on only'})"
        print(f"Active set [{mode}]:")
        print(f"  packs ({len(result.packs)}): {', '.join(result.packs)}")
        print(f"  commands: {len(result.commands)}")
        print(f"  skills:   {len(result.skills)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
