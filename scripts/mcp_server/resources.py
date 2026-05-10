"""Resource loader — exposes rules, guidelines, contexts as MCP resources.

Phase 3 (C1–C4) extends the read-only MCP surface from prompts (skills
+ commands) to read-only **resources** for the governance layer:

- `rule://<basename>`             — `.agent-src/rules/*.md`
- `guideline://<relpath-no-ext>`  — `docs/guidelines/**/*.md`
- `context://<relpath-no-ext>`    — `.agent-src/contexts/**/*.md`

All three are served with `mimeType=text/markdown`. The merge-at-sync
contract is the same as for prompts: `.agent-src/` is already the
package + project merged view; this loader does not re-merge.

Description resolution: frontmatter `description:` wins, else the
first H1 line (`# Title`) is used as a title-style fallback, else the
filename-derived stem.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from .prompts import _project_root, _strip_frontmatter

ResourceKind = Literal["rule", "guideline", "context"]
MIME_MARKDOWN = "text/markdown"


@dataclass(frozen=True)
class Resource:
    """Resolved Markdown asset ready for MCP exposure."""

    uri: str
    name: str
    description: str
    body: str
    source: str = "package"
    mime_type: str = MIME_MARKDOWN
    kind: ResourceKind = "rule"


_H1_RE = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)


def _derive_description(meta: dict[str, str], body: str, fallback: str) -> str:
    desc = meta.get("description", "").strip()
    if desc:
        return desc
    match = _H1_RE.search(body)
    if match:
        return match.group(1).strip()
    return fallback


def _load(path: Path, *, uri: str, fallback_name: str, kind: ResourceKind) -> Resource:
    text = path.read_text(encoding="utf-8")
    meta, body = _strip_frontmatter(text)
    name = meta.get("name", fallback_name).strip() or fallback_name
    description = _derive_description(meta, body, fallback_name)
    return Resource(
        uri=uri,
        name=name,
        description=description,
        body=text.rstrip() + "\n",
        source=meta.get("source", "package"),
        kind=kind,
    )


def scan_rules(root: Path | None = None) -> tuple[list[Resource], list[str]]:
    base = root or _project_root()
    rules_root = base / ".agent-src" / "rules"
    out: list[Resource] = []
    errors: list[str] = []
    if not rules_root.is_dir():
        return out, errors
    for path in sorted(rules_root.glob("*.md")):
        if not path.is_file():
            continue
        stem = path.stem
        try:
            out.append(_load(path, uri=f"rule://{stem}", fallback_name=stem, kind="rule"))
        except OSError as exc:
            errors.append(f"{path}: read failed ({exc})")
    return out, errors


def _scan_tree(
    root: Path,
    *,
    scheme: str,
    kind: ResourceKind,
) -> tuple[list[Resource], list[str]]:
    out: list[Resource] = []
    errors: list[str] = []
    if not root.is_dir():
        return out, errors
    for path in sorted(root.rglob("*.md")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).with_suffix("")
        slug = str(rel).replace("\\", "/")
        try:
            out.append(
                _load(path, uri=f"{scheme}://{slug}", fallback_name=slug, kind=kind)
            )
        except OSError as exc:
            errors.append(f"{path}: read failed ({exc})")
    return out, errors


def scan_guidelines(root: Path | None = None) -> tuple[list[Resource], list[str]]:
    base = root or _project_root()
    return _scan_tree(base / "docs" / "guidelines", scheme="guideline", kind="guideline")


def scan_contexts(root: Path | None = None) -> tuple[list[Resource], list[str]]:
    base = root or _project_root()
    return _scan_tree(base / ".agent-src" / "contexts", scheme="context", kind="context")


def load_all_resources(
    root: Path | None = None,
) -> tuple[list[Resource], list[str]]:
    """Phase 3 entrypoint — every rule, guideline, context."""
    rules, e1 = scan_rules(root)
    guidelines, e2 = scan_guidelines(root)
    contexts, e3 = scan_contexts(root)
    errors = list(e1) + list(e2) + list(e3)
    seen: dict[str, Resource] = {}
    for r in rules + guidelines + contexts:
        if r.uri in seen:
            errors.append(f"duplicate URI {r.uri!r}: keeping first")
            continue
        seen[r.uri] = r
    merged = sorted(seen.values(), key=lambda r: r.uri)
    return merged, errors


def to_mcp_resource_meta(resource: Resource) -> dict[str, object]:
    """Project a Resource into MCP `Resource` constructor kwargs."""
    return {
        "uri": resource.uri,
        "name": resource.name,
        "description": resource.description,
        "mimeType": resource.mime_type,
        "_meta": {"source": resource.source, "kind": resource.kind},
    }


class ResourceCache:
    """In-memory cache with mtime-based invalidation (mirrors `PromptCache`).

    Re-scans rules / guidelines / contexts on each `get()` when the set
    of tracked files or any mtime has changed. No watcher dependency.
    """

    def __init__(self, root: Path | None = None) -> None:
        self._root = root or _project_root()
        self._resources: list[Resource] = []
        self._errors: list[str] = []
        self._signature: tuple[tuple[str, float], ...] = ()
        self._index: dict[str, Resource] = {}

    def _current_signature(self) -> tuple[tuple[str, float], ...]:
        entries: list[tuple[str, float]] = []
        for sub in (
            self._root / ".agent-src" / "rules",
            self._root / "docs" / "guidelines",
            self._root / ".agent-src" / "contexts",
        ):
            if not sub.is_dir():
                continue
            for path in sorted(sub.rglob("*.md")):
                if path.is_file():
                    entries.append((str(path), path.stat().st_mtime))
        return tuple(entries)

    def _refresh(self) -> None:
        resources, errors = load_all_resources(self._root)
        self._resources = resources
        self._errors = errors
        self._index = {r.uri: r for r in resources}

    def get(self) -> tuple[list[Resource], list[str]]:
        signature = self._current_signature()
        if signature != self._signature:
            self._signature = signature
            self._refresh()
        return self._resources, self._errors

    def lookup(self, uri: str) -> Resource | None:
        self.get()
        return self._index.get(uri)
