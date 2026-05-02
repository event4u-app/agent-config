"""Lightweight project-context detector for the council handoff preamble.

Council members do better critique when they know what the project IS,
not just what the artefact looks like. This module reads the bare
minimum from the repo root — `composer.json`, `package.json`, root
`README.md` — and returns a neutral `ProjectContext`. All fields are
optional; missing data is `None` and the preamble silently omits the
line.

Iron law of neutrality (`ai-council` skill): nothing here may carry
host-agent identity, prior reasoning, or framing. Manifest fields and
README prose only.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

REPO_PURPOSE_MAX_CHARS = 400
_HEADING_RE = re.compile(r"^\s*#")
_BADGE_RE = re.compile(r"^\s*(\[!\[|!\[|<).*")
_HTML_RE = re.compile(r"<[^>]+>")


@dataclass
class ProjectContext:
    """Neutral project description for the council handoff preamble."""

    name: str | None = None
    stack: str | None = None
    repo_purpose: str | None = None

    def is_empty(self) -> bool:
        return self.name is None and self.stack is None and self.repo_purpose is None


def _read_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    return data if isinstance(data, dict) else None


def _name_from(composer: dict | None, package: dict | None, root: Path) -> str | None:
    for src in (composer, package):
        if src and isinstance(src.get("name"), str) and src["name"].strip():
            return src["name"].strip()
    # Fall back to the directory name; useful for repos without manifests.
    try:
        return root.resolve().name or None
    except OSError:
        return None


def _stack_from(composer: dict | None, package: dict | None) -> str | None:
    parts: list[str] = []
    if composer:
        php_v = (composer.get("require") or {}).get("php")
        if isinstance(php_v, str):
            parts.append(f"PHP {php_v}")
        # Detect well-known frameworks without claiming the project IS one.
        require = {**(composer.get("require") or {}), **(composer.get("require-dev") or {})}
        for needle, label in (
            ("laravel/framework", "Laravel"),
            ("symfony/framework-bundle", "Symfony"),
            ("laminas/laminas-mvc", "Laminas"),
        ):
            if needle in require:
                parts.append(label)
                break
    if package:
        engines = package.get("engines") or {}
        if isinstance(engines, dict) and isinstance(engines.get("node"), str):
            parts.append(f"Node {engines['node']}")
        deps = {**(package.get("dependencies") or {}), **(package.get("devDependencies") or {})}
        for needle, label in (
            ("next", "Next.js"),
            ("react", "React"),
            ("vue", "Vue"),
            ("@angular/core", "Angular"),
        ):
            if needle in deps:
                parts.append(label)
                break
    if not parts:
        return None
    return " · ".join(parts)


def _purpose_from_readme(path: Path) -> str | None:
    if not path.exists():
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    paragraph: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        stripped = line.strip()
        if not stripped:
            if paragraph:
                break
            continue
        if _HEADING_RE.match(stripped) or _BADGE_RE.match(stripped):
            if paragraph:
                break
            continue
        paragraph.append(stripped)
    if not paragraph:
        return None
    joined = " ".join(paragraph)
    joined = _HTML_RE.sub("", joined).strip()
    if not joined:
        return None
    if len(joined) > REPO_PURPOSE_MAX_CHARS:
        joined = joined[: REPO_PURPOSE_MAX_CHARS - 1].rstrip() + "…"
    return joined


def detect_project_context(root: Path | None = None) -> ProjectContext:
    """Return a `ProjectContext` for `root` (default: cwd).

    Always returns — never raises. Missing manifest files / README → the
    matching field is `None`, and `handoff_preamble()` will omit the line.
    """
    root = (root or Path.cwd()).resolve()
    composer = _read_json(root / "composer.json")
    package = _read_json(root / "package.json")
    return ProjectContext(
        name=_name_from(composer, package, root),
        stack=_stack_from(composer, package),
        repo_purpose=_purpose_from_readme(root / "README.md"),
    )
