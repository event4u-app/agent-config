"""Surface-tier (core vs lab) resolution for the install split.

road-to-install-contract-stability Phase 2. ``core`` = the lean stable engine
users install; ``lab`` = experimental / pilot tooling. A core-only install
excludes ``lab``-tier artefacts so lab churn cannot destabilise the adoptable
surface.

Pack tier lives in ``src/config/discovery/packs.yml`` (``surface_tier: lab``);
the deployed artefacts carry it in frontmatter — commands as ``pack:`` (scalar),
skills as ``packs:`` (list). The script-cluster tier registry is
``src/scripts/surface-tiers.yml`` (consumed by the boundary guard, not here).
"""
from __future__ import annotations

from pathlib import Path

# Conservative fallback if packs.yml is unreadable: the day-one lab packs.
_LAB_FALLBACK = frozenset({"ai-video", "ai-image", "fun"})


def load_lab_pack_ids(repo_root: Path) -> set[str]:
    """Pack ids tagged ``surface_tier: lab`` in packs.yml (+ safe fallback)."""
    vocab = repo_root / "src" / "config" / "discovery" / "packs.yml"
    ids: set[str] = set()
    try:
        import yaml  # noqa: WPS433 — optional, fallback below

        data = yaml.safe_load(vocab.read_text(encoding="utf-8"))
        for entry in data or []:
            if isinstance(entry, dict) and entry.get("surface_tier") == "lab":
                pid = entry.get("id")
                if isinstance(pid, str):
                    ids.add(pid)
    except Exception:  # noqa: BLE001 — packs.yml missing / unparseable / no yaml
        return set(_LAB_FALLBACK)
    return ids or set(_LAB_FALLBACK)


def frontmatter_packs(md_path: Path) -> set[str]:
    """Parse a markdown file's leading frontmatter into its pack set.

    Handles both shapes: ``pack: <id>`` (commands) and ``packs:`` followed by
    ``- <id>`` list items (skills). Returns an empty set on any parse failure
    or when the file carries no pack tag.
    """
    try:
        text = md_path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return set()
    if not text.startswith("---"):
        return set()
    end = text.find("\n---", 3)
    block = text[3:end] if end != -1 else text[3:]

    packs: set[str] = set()
    in_packs_list = False
    for raw in block.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if in_packs_list:
            if stripped.startswith("- "):
                packs.add(stripped[2:].strip().strip("'\""))
                continue
            in_packs_list = False
        if stripped.startswith("pack:"):
            val = stripped.split(":", 1)[1].strip().strip("'\"")
            if val:
                packs.add(val)
        elif stripped.startswith("packs:"):
            inline = stripped.split(":", 1)[1].strip()
            if inline.startswith("[") and inline.endswith("]"):
                for item in inline[1:-1].split(","):
                    item = item.strip().strip("'\"")
                    if item:
                        packs.add(item)
            else:
                in_packs_list = True
    return packs


def is_lab_artefact(md_path: Path, lab_ids: set[str]) -> bool:
    """True when a deployed markdown artefact belongs to a lab-tier pack."""
    return bool(frontmatter_packs(md_path) & lab_ids)
