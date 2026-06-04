"""Phase-6 F1 — server identity metadata.

Three values surfaced at boot via stderr (`run_stdio` boot log):

- **server version** — wire-surface SemVer in `__init__.py::__version__`.
  Hand-bumped when the MCP-side surface (prompts/resources/tools shape,
  protocol semantics) changes.
- **package version** — read from `package.json::version` at boot.
  Build-ID semantics; bumps with every release of the agent-config bundle.
- **skill-set signature** — SHA-256 hex (first 12 chars) over the joined
  `PromptCache._signature` + `ResourceCache._signature` tuples
  (`(uri, mtime)` pairs, already sorted). Content fingerprint, not a
  version — auto-derived, never hand-edited.

Wire-surface caveat: the MCP SDK constructs `serverInfo.Implementation`
internally with a fixed field set (`name`, `version`, `websiteUrl`,
`icons`), so the package version and skill-set signature cannot be
attached to `serverInfo._meta` without subclassing the session.
Stderr is the canonical surface in Phase 6; a wire-surface lift can
follow once the SDK supports it.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Sequence

Signature = Sequence[tuple[str, float]]


def read_package_version(root: Path) -> str:
    """Return `package.json::version`, or `"unknown"` if unreadable."""
    path = root / "package.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return "unknown"
    version = data.get("version")
    if not isinstance(version, str) or not version:
        return "unknown"
    return version


def compute_skill_set_signature(*signatures: Signature) -> str:
    """SHA-256 hex (12 chars) over the concatenated `(uri, mtime)` tuples.

    Deterministic across processes for identical inputs. Changes when
    any tracked file's path-set or mtime changes. Inputs are taken as-is
    (callers pass already-sorted cache signatures); the hash is taken
    over the joined repr to keep the framing unambiguous.
    """
    hasher = hashlib.sha256()
    for sig in signatures:
        for uri, mtime in sig:
            hasher.update(uri.encode("utf-8"))
            hasher.update(b"\x00")
            hasher.update(f"{mtime:.6f}".encode("ascii"))
            hasher.update(b"\x1e")  # record separator
        hasher.update(b"\x1d")  # group separator between caches
    return hasher.hexdigest()[:12]


def boot_log_line(
    *,
    server_version: str,
    package_version: str,
    skill_set_signature: str,
) -> str:
    """Single stderr line surfacing all three identity values at boot."""
    return (
        f"mcp-server: identity serverVersion={server_version} "
        f"packageVersion={package_version} "
        f"skillSetSignature={skill_set_signature}"
    )
