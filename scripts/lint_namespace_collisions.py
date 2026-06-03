#!/usr/bin/env python3
"""Single-namespace collision lint (road-to-6.0.0-D Phase 0 Step 4).

The 6.0.0-D target keeps skills + rules in one flat shared library and folds
commands into a flat hyphenated namespace. For that to be safe, names must be
unique **within each namespace** after normalization (lowercase, ``_`` -> ``-``,
``:`` -> ``-`` so the colon cluster form collides with the hyphenated flat
form):

  - **library** = skills ∪ rules (one flat slug space — a command resolves a
    dependency by slug against skills-then-rules, so a skill and a rule sharing
    a slug is a genuine ambiguity);
  - **commands** = the flat hyphenated command space.

A command sharing a name with a skill/rule is NOT a collision — that is the
endorsed thin-command pattern (a thin ``/refine-ticket`` command delegating to
the ``refine-ticket`` skill); they live in separate trees and separate `.claude/`
surfaces. This lint catches a collision now, before the flatten in Phase 2
silently overwrites one artefact with another.

Sources walked (every active root, via _lib.agent_src):
  - ``skills/<slug>/SKILL.md``  -> name = slug
  - ``rules/<slug>.md``         -> name = slug
  - ``commands/.../<x>.md``     -> name = normalized frontmatter `name:`
                                   (falls back to the path slug)

Exit codes: 0 = no collisions · 1 = at least one collision · 3 = internal error.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import iter_all_sources  # noqa: E402

try:
    from condense import _parse_frontmatter  # reuse the canonical FM splitter
except ImportError:  # pragma: no cover
    _parse_frontmatter = None


def _normalize(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(":", "-")


def _category(rel: str) -> str | None:
    top = rel.split("/", 1)[0]
    return top if top in ("skills", "rules", "commands") else None


def _artefact_name(rel: str, path: Path, category: str) -> str:
    if category == "skills":
        return rel.split("/")[1] if "/" in rel else Path(rel).stem
    if category == "rules":
        return Path(rel).stem
    # command — prefer frontmatter name, else path slug
    if _parse_frontmatter is not None:
        try:
            meta, _ = _parse_frontmatter(path.read_text(encoding="utf-8"))
            if isinstance(meta.get("name"), str) and meta["name"].strip():
                return meta["name"]
        except (OSError, UnicodeDecodeError):
            pass
    return Path(rel).stem


# Which namespace each artefact category belongs to for collision purposes.
_NAMESPACE = {"skills": "library", "rules": "library", "commands": "commands"}


def main() -> int:
    # (namespace, normalized name) -> list of (category, logical_rel)
    seen: dict[tuple[str, str], list[tuple[str, str]]] = defaultdict(list)
    total = 0
    for path, rel in iter_all_sources():
        category = _category(rel)
        if category is None or not rel.endswith(".md"):
            continue
        if category == "skills" and not rel.endswith("/SKILL.md"):
            continue  # only the SKILL.md head names a skill
        name = _normalize(_artefact_name(rel, path, category))
        if not name:
            continue
        total += 1
        seen[(_NAMESPACE[category], name)].append((category, rel))

    collisions = {k: v for k, v in seen.items() if len(v) > 1}
    if collisions:
        for (namespace, name) in sorted(collisions):
            entries = ", ".join(
                f"{cat}:{rel}" for cat, rel in sorted(collisions[(namespace, name)])
            )
            print(f"❌  {namespace} name collision '{name}': {entries}", file=sys.stderr)
        print(f"\n{len(collisions)} within-namespace name collision(s).", file=sys.stderr)
        return 1
    print(f"✅  {total} skill/rule/command names unique within each namespace (normalized).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
