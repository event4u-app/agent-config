#!/usr/bin/env python3
"""CI guard for docs/featured-skills.md entry validity.

Every artefact referenced from the three Featured tables (Founders &
Consultants, Content Creators, Engineering Leads) MUST resolve in
`dist/discovery/discovery-manifest.json`. Stale entries (renamed or
removed skills / commands) fail the build.

Detection:

  - Scan `docs/featured-skills.md` for inline links of shape
    `[`<token>`](../.agent-src/{skills|commands}/<path>.md)` inside the
    Featured tables. Strip the `/` prefix on commands and the leading
    slash on skill names.
  - Cross-check each token against the manifest's `artefacts` array
    (`category` in {`skill`, `command`} + `name` match, namespaced
    commands like `video/from-script` → `video:from-script`).
  - Verify `--pack <slug>` install hints reference packs that exist in
    `manifest.packs[].id`.

Exit codes:
  0 — every entry resolves; install-pack hints are valid.
  1 — at least one stale entry or unknown pack.

Invocation:
  python3 scripts/lint_featured_skills.py
  python3 scripts/lint_featured_skills.py --quiet
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

DOC = Path("docs/featured-skills.md")
MANIFEST = Path("dist/discovery/discovery-manifest.json")

# Matches `[`token`](../.agent-src/skills/<slug>/SKILL.md)` or
# `[`/token`](../.agent-src/commands/<path>.md)`. Captures (category, slug-path).
LINK_RE = re.compile(
    r"\[`/?[^`]+`\]\(\.\./\.agent-src/(skills|commands)/([^)]+?)\.md\)"
)
PACK_HINT_RE = re.compile(r"--pack\s+([a-z][a-z0-9-]*)")


def load_manifest() -> dict:
    if not MANIFEST.exists():
        print(f"error: manifest not found at {MANIFEST}", file=sys.stderr)
        sys.exit(1)
    return json.loads(MANIFEST.read_text(encoding="utf-8"))


def manifest_names(manifest: dict) -> tuple[set[str], set[str], set[str]]:
    """Return (skill-names, command-names, pack-ids)."""
    skills: set[str] = set()
    commands: set[str] = set()
    for art in manifest.get("artefacts", []):
        cat = art.get("category")
        name = art.get("name")
        if not name:
            continue
        if cat == "skill":
            skills.add(name)
        elif cat == "command":
            commands.add(name)
            # Deprecation aliases are permanent stubs (ADR-057 § 8a) and
            # still resolve — docs may feature a command by its alias.
            for alias in art.get("replaces") or []:
                if isinstance(alias, str) and alias:
                    commands.add(alias)
    packs = {p.get("id") for p in manifest.get("packs", []) if p.get("id")}
    return skills, commands, packs


def slug_from_path(category: str, raw: str) -> str:
    """Convert a doc-link path to the manifest `name` form.

    skills/<slug>/SKILL  → <slug>
    commands/<group>/<leaf>  → <group>:<leaf>
    commands/<leaf>     → <leaf>
    """
    if category == "skills":
        # raw looks like "<slug>/SKILL"; strip trailing /SKILL if present.
        return raw.split("/", 1)[0]
    # commands
    parts = raw.split("/")
    return ":".join(parts) if len(parts) > 1 else parts[0]


def main() -> int:
    quiet = "--quiet" in sys.argv
    if not DOC.exists():
        print(f"error: {DOC} not found", file=sys.stderr)
        return 1

    manifest = load_manifest()
    skills, commands, packs = manifest_names(manifest)
    body = DOC.read_text(encoding="utf-8")

    missing: list[str] = []
    seen: set[tuple[str, str]] = set()
    for cat, raw in LINK_RE.findall(body):
        slug = slug_from_path(cat, raw)
        key = (cat, slug)
        if key in seen:
            continue
        seen.add(key)
        pool = skills if cat == "skills" else commands
        if slug not in pool:
            missing.append(f"  - {cat}/{slug} (linked path: ../.agent-src/{cat}/{raw}.md)")

    unknown_packs: list[str] = []
    for pack in PACK_HINT_RE.findall(body):
        if pack not in packs:
            unknown_packs.append(f"  - --pack {pack}")

    if missing or unknown_packs:
        print(f"FAIL  {DOC}: stale Featured Skills entries detected.")
        if missing:
            print("\nMissing artefacts (not in discovery-manifest.json):")
            for line in missing:
                print(line)
        if unknown_packs:
            print("\nUnknown pack ids referenced in install hints:")
            for line in unknown_packs:
                print(line)
        print(
            "\nFix: either restore the artefact, update the doc entry to a "
            "current name, or substitute with the nearest existing artefact."
        )
        return 1

    if not quiet:
        print(
            f"OK    {DOC}: {len(seen)} artefact entries + "
            f"{len(set(PACK_HINT_RE.findall(body)))} pack hints validated."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
