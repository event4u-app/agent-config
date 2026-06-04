"""JSON-pointer helpers for the v2 ``merged_keys[]`` manifest field.

P1.5 of road-to-multi-package-coexistence (Anthropic constraint
2026-05-12). When a tool merges into a shared JSON file, the manifest
records which JSON pointers it owns so uninstall can subtract them
cleanly without touching foreign keys. Two invariants:

1. **No array indices.** Pointers MUST target named object keys only.
   ``/hooks/PostToolUse`` is valid; ``/hooks/PostToolUse/0`` is not.
   Array indices shift when another tool inserts or removes entries
   at the same array, so an index-based pointer corrupts other
   packages' ownership records on neighbour-tool uninstall.
2. **Arrays carry a ``value_hash`` discriminator.** A pointer that
   targets a parent whose value is a list records the SHA-256 of the
   JSON-serialised list contents the install wrote, so uninstall can
   identify the owned elements by content rather than position.

This module is dependency-free (stdlib only) so it can be imported in
both the installer (``scripts/install.py``) and the manifest layer
(``scripts/_lib/installed_tools.py``).
"""
from __future__ import annotations

import hashlib
import json
from typing import Any, Optional


class ArrayIndexPointerError(ValueError):
    """Raised when a JSON pointer segment is an array index."""

    def __init__(self, pointer: str, segment: str):
        super().__init__(
            f"json_pointer {pointer!r} targets array index {segment!r}; "
            "pointers MUST target named object keys only "
            "(see road-to-multi-package-coexistence.md § P1.5)"
        )
        self.pointer = pointer
        self.segment = segment


def _escape_segment(key: str) -> str:
    """Escape a JSON pointer segment per RFC 6901 § 4."""
    return key.replace("~", "~0").replace("/", "~1")


def validate_pointer(pointer: str) -> None:
    """Raise :class:`ArrayIndexPointerError` if any segment is an integer.

    The empty pointer (``""``) is valid (targets the document root).
    Otherwise the pointer must start with ``/`` and split into
    segments; each segment that parses cleanly as a non-negative
    integer is rejected (RFC 6901 array-index syntax).
    """
    if pointer == "":
        return
    if not pointer.startswith("/"):
        raise ValueError(
            f"json_pointer {pointer!r} must start with '/' (RFC 6901)"
        )
    # Skip the leading empty segment from the leading slash.
    segments = pointer.split("/")[1:]
    for seg in segments:
        # RFC 6901 § 4 — array index = unsigned integer, no leading zero
        # except for "0" itself.
        if seg.isdigit() and (seg == "0" or not seg.startswith("0")):
            raise ArrayIndexPointerError(pointer, seg)


def value_hash(value: Any) -> str:
    """Return a stable SHA-256 hex digest of ``value`` (JSON-serialised).

    Uses canonical JSON (sorted keys, no whitespace) so the hash is
    insertion-order independent. Used to discriminate tool-owned
    entries in a shared array on uninstall.
    """
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def collect_pointers(
    overlay: dict,
    *,
    prefix: str = "",
    include_arrays: bool = True,
) -> list[dict[str, Any]]:
    """Walk an overlay dict and return one entry per object-key pointer.

    Each entry: ``{"json_pointer": str, "value_hash": Optional[str]}``.
    ``value_hash`` is set when the targeted value is a list (arrays
    need content-hash discrimination on uninstall); for nested dicts
    we recurse and emit a pointer for each inner key. Scalars get a
    pointer with ``value_hash=None`` (the key/value pair fully
    identifies the merge).

    The collector NEVER emits array-index pointers — list contents
    are owned wholesale at the parent key.
    """
    entries: list[dict[str, Any]] = []
    for key, value in overlay.items():
        pointer = f"{prefix}/{_escape_segment(str(key))}"
        if isinstance(value, dict):
            # Recurse so the manifest captures the leaf object keys,
            # not just the root container. Empty dicts get a single
            # entry at the key so an uninstall can still remove them.
            if not value:
                entries.append({"json_pointer": pointer, "value_hash": None})
            else:
                entries.extend(
                    collect_pointers(
                        value, prefix=pointer, include_arrays=include_arrays,
                    )
                )
        elif isinstance(value, list):
            entries.append(
                {
                    "json_pointer": pointer,
                    "value_hash": value_hash(value) if include_arrays else None,
                }
            )
        else:
            entries.append({"json_pointer": pointer, "value_hash": None})
    # Validate every emitted pointer once at the end — cheap and
    # guarantees the invariant even if a future caller hand-crafts
    # entries.
    for entry in entries:
        validate_pointer(entry["json_pointer"])
    return entries


def build_merge_entries(
    file_label: str,
    overlay: dict,
) -> list[dict[str, Any]]:
    """Return v2 ``merged_keys[]`` entries for a single JSON merge.

    ``file_label`` is the manifest-relative file path the merge
    touched (e.g. ``.cursor/hooks.json``). The overlay is the dict the
    installer wrote into the file; only its top-level object keys
    become pointers (recursing through nested objects, halting at
    lists / scalars).
    """
    pointers = collect_pointers(overlay)
    return [
        {
            "file": file_label,
            "json_pointer": entry["json_pointer"],
            "value_hash": entry["value_hash"],
        }
        for entry in pointers
    ]


# ---------------------------------------------------------------------------
# Subtraction (P2.2 — uninstall round-trip)
# ---------------------------------------------------------------------------


def _split_segments(pointer: str) -> list[str]:
    """Split a non-empty pointer into unescaped segments."""
    if pointer == "":
        return []
    # RFC 6901: leading '/' separates segments; unescape ~1 → '/' and ~0 → '~'.
    parts = pointer.split("/")[1:]
    return [p.replace("~1", "/").replace("~0", "~") for p in parts]


def _navigate(doc: Any, segments: list[str]) -> tuple[Any, str] | None:
    """Walk ``doc`` down ``segments`` and return ``(parent_dict, leaf_key)``.

    Returns ``None`` when any intermediate segment is missing or not a
    dict (we never descend into lists by index, see :func:`validate_pointer`).
    """
    if not segments:
        return None
    cursor = doc
    for seg in segments[:-1]:
        if not isinstance(cursor, dict) or seg not in cursor:
            return None
        cursor = cursor[seg]
    if not isinstance(cursor, dict):
        return None
    leaf = segments[-1]
    if leaf not in cursor:
        return None
    return cursor, leaf


def subtract_pointers(
    doc: dict,
    entries: list[dict[str, Any]],
) -> tuple[dict, list[dict[str, Any]]]:
    """Remove the pointers in ``entries`` from ``doc``; trim empty ancestors.

    ``entries`` is a list of ``{"json_pointer": str, "value_hash":
    Optional[str]}`` records (the per-file slice of a tool's
    ``merged_keys[]``). For each entry:

    * ``value_hash is None`` → delete the key at the pointer.
    * ``value_hash is set`` → the target is a list owned wholesale by
      the tool. Delete only when the current value's hash still
      matches; otherwise treat as **drift** (a neighbour package or
      the user edited the array) and skip, surfacing a warning.

    After every leaf removal we walk up the ancestor chain and drop
    any empty dict the removal left behind — but only empty ones. A
    neighbour tool's remaining keys keep the container alive, so its
    contributions are never touched.

    Returns ``(updated_doc, warnings)`` where ``warnings`` is a list of
    ``{"pointer": str, "reason": "missing" | "drift", "expected_hash":
    Optional[str], "actual_hash": Optional[str]}`` entries describing
    pointers that could not be subtracted cleanly.
    """
    warnings: list[dict[str, Any]] = []
    # Sort longest-first so leaves are removed before their ancestors —
    # otherwise ancestor cleanup races leaf removal in deep trees.
    ordered = sorted(
        entries,
        key=lambda e: len(_split_segments(e["json_pointer"])),
        reverse=True,
    )
    for entry in ordered:
        pointer = entry["json_pointer"]
        expected = entry.get("value_hash")
        segments = _split_segments(pointer)
        nav = _navigate(doc, segments)
        if nav is None:
            warnings.append({
                "pointer": pointer,
                "reason": "missing",
                "expected_hash": expected,
                "actual_hash": None,
            })
            continue
        parent, leaf = nav
        if expected is not None:
            actual = value_hash(parent[leaf])
            if actual != expected:
                warnings.append({
                    "pointer": pointer,
                    "reason": "drift",
                    "expected_hash": expected,
                    "actual_hash": actual,
                })
                continue
        del parent[leaf]
        # Trim empty-ancestor chain — never remove a container that
        # still holds foreign keys.
        for depth in range(len(segments) - 1, 0, -1):
            ancestor_segments = segments[:depth]
            anc_nav = _navigate(doc, ancestor_segments)
            if anc_nav is None:
                break
            anc_parent, anc_leaf = anc_nav
            if isinstance(anc_parent[anc_leaf], dict) and not anc_parent[anc_leaf]:
                del anc_parent[anc_leaf]
                continue
            break
    return doc, warnings
