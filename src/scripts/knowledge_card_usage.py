#!/usr/bin/env python3
"""Knowledge-card usage counter — Phase 4 v1-safe instrument.

Records which knowledge cards are consulted and in which repo (by
owner/repo slug, never by absolute path or file contents).

NOTE: `agents/memory/knowledge/session/usage.json` must be gitignored.
      The script creates the directory and file but never touches .gitignore.
      Maintainer is responsible for the gitignore entry.

Phase 4 v1-safe instrument ONLY. No global write, no promotion, no
auto->=2. Cross-project reuse is MEASURED here; the decision to build
a global layer is a gated follow-up.

Subcommands:
  record --card <name>   Tick usage for a card in the current repo.
  show                   Print the usage JSON to stdout.

Exit codes: 0 = success, 1 = usage error, 3 = internal error.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------

_STORE_RELPATH = Path("agents") / "memory" / "knowledge" / "session" / "usage.json"


def _repo_root() -> Path:
    """Resolve the git repo root; fall back to cwd if git is unavailable."""
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        return Path(out.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return Path.cwd()


def _store_path() -> Path:
    return _repo_root() / _STORE_RELPATH


def _load(store: Path) -> dict:
    if store.exists():
        try:
            return json.loads(store.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {"cards": {}}
    return {"cards": {}}


def _save(store: Path, data: dict) -> None:
    store.parent.mkdir(parents=True, exist_ok=True)
    store.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


# ---------------------------------------------------------------------------
# Repo slug — owner/repo from remote.origin.url, never an absolute path
# ---------------------------------------------------------------------------

_SLUG_RE = re.compile(r"[:/]([^/]+/[^/]+?)(?:\.git)?$")


def _repo_slug() -> str:
    """Return 'owner/repo' from remote.origin.url, or 'local/unknown'."""
    try:
        url = subprocess.check_output(
            ["git", "config", "--get", "remote.origin.url"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        m = _SLUG_RE.search(url)
        if m:
            return m.group(1)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return "local/unknown"


# ---------------------------------------------------------------------------
# Subcommands
# ---------------------------------------------------------------------------

def cmd_record(card: str) -> int:
    """Tick a usage count for `card` in the current repo."""
    store = _store_path()
    data = _load(store)
    cards = data.setdefault("cards", {})
    entry = cards.setdefault(card, {"repos": {}})
    repos = entry.setdefault("repos", {})
    slug = _repo_slug()
    repo_entry = repos.setdefault(slug, {"count": 0, "last_used": ""})
    repo_entry["count"] += 1
    repo_entry["last_used"] = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    _save(store, data)
    print(f"Recorded: {card} in {slug} (count={repo_entry['count']})")
    return 0


def cmd_show() -> int:
    """Print the usage JSON to stdout."""
    store = _store_path()
    data = _load(store)
    print(json.dumps(data, indent=2, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__.splitlines()[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sub = parser.add_subparsers(dest="cmd", metavar="subcommand")

    rec = sub.add_parser("record", help="Tick usage for a card in the current repo")
    rec.add_argument("--card", required=True, metavar="NAME",
                     help="Card filename (e.g. stripe.md)")

    sub.add_parser("show", help="Print usage JSON to stdout")

    args = parser.parse_args()

    if args.cmd is None:
        parser.print_help()
        return 1

    try:
        if args.cmd == "record":
            return cmd_record(args.card)
        if args.cmd == "show":
            return cmd_show()
    except Exception as exc:  # pragma: no cover
        print(f"Internal error: {exc}", file=sys.stderr)
        return 3

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
