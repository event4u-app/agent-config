#!/usr/bin/env python3
"""File-first usage signal + hybrid promotion for global knowledge cards.

Structure-grounding v2, Phase 2 (ADR-100 / road-to-structure-grounding-v2).
Replaces the retired `knowledge_card_usage.py` — file-first, no DB, no daemon.

Two concerns:

  * **Usage signal.** A tiny JSON sidecar in the global store
    (``~/.event4u/agent-config/knowledge/.usage.json``) records, per card
    *identity*, the set of distinct **repo-slugs** it has been seen in
    (``seen_in``) — identity, never a path (privacy floor). Recording a
    sighting NEVER writes a card to the store on its own.
  * **Hybrid promotion.** When a ``public``/``vendor`` card's ``seen_in``
    reaches ``auto_promote_threshold`` distinct repos, the layer **suggests**
    promotion (one-tap confirm) — it never auto-promotes silently. ``proprietary``
    cards are never suggested; they are manual-only.

The card *write* on confirm (with the provenance footer) lives in the Phase-3
command surface; this module owns the signal + the suggestion decision.

Pure except the sidecar write. Exit codes (CLI): 0 = ok, 1 = usage, 3 = error.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Optional

try:  # invocation-agnostic import
    from scripts._lib import knowledge_global
    from scripts._lib.fs_atomic import write_atomic
except ModuleNotFoundError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from _lib import knowledge_global  # type: ignore
    from _lib.fs_atomic import write_atomic  # type: ignore

USAGE_FILENAME = ".usage.json"
_SLUG_RE = re.compile(r"[^a-z0-9._-]+")


# ---------------------------------------------------------------------------
# Repo-slug — privacy-safe project identity (NOT a path)
# ---------------------------------------------------------------------------

def repo_slug(project_root: Optional[Path] = None) -> str:
    """Return a privacy-safe repo identity (slug), never a filesystem path.

    Prefers the git remote repository name (``origin`` basename, ``.git``
    stripped); falls back to the project directory basename. Lower-cased and
    sanitised to ``[a-z0-9._-]``.
    """
    root = (project_root or Path.cwd()).resolve()
    name = ""
    try:
        out = subprocess.run(
            ["git", "-C", str(root), "remote", "get-url", "origin"],
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode == 0:
            url = out.stdout.strip()
            tail = url.rstrip("/").split("/")[-1]
            name = tail[:-4] if tail.endswith(".git") else tail
    except Exception:  # pragma: no cover — git unavailable
        name = ""
    if not name:
        name = root.name
    return _SLUG_RE.sub("-", name.lower()).strip("-") or "unknown"


def card_id_from(source: str = "", card_name: str = "") -> str:
    """Derive a stable card identity from its source or filename stem."""
    base = card_name or source
    base = base.rsplit("/", 1)[-1]
    if base.endswith(".md"):
        base = base[:-3]
    return _SLUG_RE.sub("-", base.lower()).strip("-") or "card"


# ---------------------------------------------------------------------------
# Usage sidecar
# ---------------------------------------------------------------------------

def _usage_path(env: Optional[dict] = None) -> Path:
    return knowledge_global.global_store_dir(env) / USAGE_FILENAME


def load_usage(env: Optional[dict] = None) -> dict[str, Any]:
    """Read the usage sidecar. Tolerant: missing/corrupt → empty skeleton."""
    path = _usage_path(env)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("cards"), dict):
            return data
    except (OSError, ValueError):
        pass
    return {"version": 1, "cards": {}}


def record_seen(
    card_id: str,
    slug: str,
    *,
    tier: str = "",
    source: str = "",
    today: str = "",
    env: Optional[dict] = None,
) -> dict[str, Any]:
    """Record that ``card_id`` was seen in repo ``slug``. Dedups; no card write.

    Honours the kill-switch: when global sharing is disabled this is a no-op
    (returns the in-memory entry without persisting).
    """
    usage = load_usage(env)
    entry = usage["cards"].setdefault(
        card_id, {"tier": tier, "source": source, "seen_in": [], "first_seen": {}, "promoted": False}
    )
    if tier:
        entry["tier"] = tier
    if source and not entry.get("source"):
        entry["source"] = source
    if slug and slug not in entry["seen_in"]:
        entry["seen_in"].append(slug)
        entry["seen_in"].sort()
    if not entry.get("first_seen"):
        entry["first_seen"] = {"repo": slug, "date": today}

    if not knowledge_global.is_enabled(env=env):
        return entry  # kill-switch: never persist a global-store write

    write_atomic(_usage_path(env), json.dumps(usage, indent=2, sort_keys=True) + "\n")
    return entry


# ---------------------------------------------------------------------------
# Promotion suggestion (never silent)
# ---------------------------------------------------------------------------

def should_suggest(entry: dict[str, Any], *, threshold: int, allowed: set[str]) -> bool:
    """True when a card warrants a promotion *suggestion* (never auto-promote).

    ``proprietary`` is never suggested (manual-only). An already-promoted card
    is not re-suggested.
    """
    if entry.get("promoted"):
        return False
    tier = entry.get("tier", "")
    if tier == "proprietary" or tier not in allowed:
        return False
    return len(entry.get("seen_in", [])) >= threshold


def promotion_candidates(env: Optional[dict] = None, cwd: Optional[Path] = None) -> list[dict[str, Any]]:
    """List cards that warrant a promotion suggestion under the current config.

    Empty when global sharing is disabled.
    """
    if not knowledge_global.is_enabled(cwd=cwd, env=env):
        return []
    cfg = knowledge_global.load_global_sharing_config(cwd=cwd, env=env)
    threshold = int(cfg.get("auto_promote_threshold", 2))
    allowed = knowledge_global.allowed_tiers(cwd=cwd, env=env)
    usage = load_usage(env)
    out: list[dict[str, Any]] = []
    for cid, entry in sorted(usage["cards"].items()):
        if should_suggest(entry, threshold=threshold, allowed=allowed):
            out.append({"card_id": cid, **entry})
    return out


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd")

    p_seen = sub.add_parser("record-seen", help="Record a card sighting in a repo.")
    p_seen.add_argument("card_id")
    p_seen.add_argument("--slug", default="", help="Repo slug (default: derive from CWD).")
    p_seen.add_argument("--tier", default="")
    p_seen.add_argument("--source", default="")
    p_seen.add_argument("--date", default="", help="ISO date (default: empty; caller stamps).")

    sub.add_parser("slug", help="Print the privacy-safe repo slug for the CWD.")
    sub.add_parser("candidates", help="List cards warranting a promotion suggestion (JSON).")

    args = parser.parse_args(argv)

    if args.cmd == "record-seen":
        slug = args.slug or repo_slug()
        entry = record_seen(
            args.card_id, slug, tier=args.tier, source=args.source, today=args.date
        )
        print(json.dumps(entry, indent=2, sort_keys=True))
        return 0
    if args.cmd == "slug":
        print(repo_slug())
        return 0
    if args.cmd == "candidates":
        print(json.dumps(promotion_candidates(), indent=2, sort_keys=True))
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
