"""Pure-Python validator for retrieval contract v1 envelopes.

Mirrors `schemas/retrieval-v1.schema.json`. Deliberately hand-written
so the conformance harness has zero third-party runtime dependencies.
If `jsonschema` is ever added to the toolchain, this file can be
replaced with a thin wrapper; until then, keeping the shape assertions
in ~120 lines of readable Python is cheaper than adopting a new dep
for a single validation use case.
"""

from __future__ import annotations

import re
from typing import Any

_SLICE_STATUSES = {"ok", "timeout", "unknown_type", "misconfigured", "internal"}
_ERROR_CODES = {"timeout", "unknown_type", "misconfigured", "internal"}
_ENVELOPE_STATUSES = {"ok", "partial", "error"}
_HEALTH_STATUSES = {"ok", "degraded", "error"}
_DT_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:\d{2})$"
)
_SHADOWED_BY_RE = re.compile(r"^repo:")


class ValidationError(AssertionError):
    """Raised with a dotted `.path` showing where the envelope failed."""


def _fail(path: str, msg: str) -> None:
    raise ValidationError(f"{path}: {msg}")


def _require(payload: dict, path: str, *keys: str) -> None:
    for k in keys:
        if k not in payload:
            _fail(path, f"missing required key `{k}`")


def _no_extras(payload: dict, path: str, *allowed: str) -> None:
    extra = set(payload) - set(allowed)
    if extra:
        _fail(path, f"unexpected keys {sorted(extra)}")


def _entry(entry: Any, path: str) -> None:
    if not isinstance(entry, dict):
        _fail(path, "entry must be object")
    _require(entry, path, "id", "type", "source", "confidence", "body")
    _no_extras(
        entry, path,
        "id", "type", "source", "confidence",
        "trust", "body", "last_validated", "shadowed_by",
    )
    if not isinstance(entry["id"], str) or not entry["id"]:
        _fail(f"{path}.id", "must be non-empty string")
    if not isinstance(entry["type"], str) or not entry["type"]:
        _fail(f"{path}.type", "must be non-empty string")
    if entry["source"] not in ("repo", "operational"):
        _fail(f"{path}.source", f"got {entry['source']!r}")
    conf = entry["confidence"]
    if not isinstance(conf, (int, float)) or not 0 <= conf <= 1:
        _fail(f"{path}.confidence", f"must be in [0,1], got {conf!r}")
    if "trust" in entry:
        t = entry["trust"]
        if not isinstance(t, (int, float)) or not 0 <= t <= 1:
            _fail(f"{path}.trust", f"must be in [0,1], got {t!r}")
    if not isinstance(entry["body"], dict):
        _fail(f"{path}.body", "must be object")
    if "last_validated" in entry:
        lv = entry["last_validated"]
        if not isinstance(lv, str) or not _DT_RE.match(lv):
            _fail(f"{path}.last_validated", f"must be RFC3339, got {lv!r}")
    if "shadowed_by" in entry:
        sb = entry["shadowed_by"]
        if sb is not None and not (isinstance(sb, str) and _SHADOWED_BY_RE.match(sb)):
            _fail(f"{path}.shadowed_by", f"must be null or `repo:<id>`, got {sb!r}")


def _slice_status(slc: Any, path: str) -> None:
    if not isinstance(slc, dict):
        _fail(path, "slice must be object")
    _require(slc, path, "status", "count")
    _no_extras(slc, path, "status", "count")
    if slc["status"] not in _SLICE_STATUSES:
        _fail(f"{path}.status", f"got {slc['status']!r}")
    if not isinstance(slc["count"], int) or slc["count"] < 0:
        _fail(f"{path}.count", f"must be non-negative int, got {slc['count']!r}")


def _error(err: Any, path: str) -> None:
    if not isinstance(err, dict):
        _fail(path, "error must be object")
    _require(err, path, "type", "code", "message")
    _no_extras(err, path, "type", "code", "message")
    if not isinstance(err["type"], str) or not err["type"]:
        _fail(f"{path}.type", "must be non-empty string")
    if err["code"] not in _ERROR_CODES:
        _fail(f"{path}.code", f"got {err['code']!r}")
    if not isinstance(err["message"], str):
        _fail(f"{path}.message", "must be string")


def validate_retrieve(envelope: Any) -> None:
    """Validate a `retrieve()` response envelope against v1."""
    if not isinstance(envelope, dict):
        _fail("$", "envelope must be object")
    _require(envelope, "$", "contract_version", "status", "entries", "slices")
    _no_extras(
        envelope, "$",
        "contract_version", "status", "entries", "slices", "errors",
    )
    if envelope["contract_version"] != 1:
        _fail("$.contract_version", f"expected 1, got {envelope['contract_version']!r}")
    if envelope["status"] not in _ENVELOPE_STATUSES:
        _fail("$.status", f"got {envelope['status']!r}")
    if not isinstance(envelope["entries"], list):
        _fail("$.entries", "must be array")
    for i, e in enumerate(envelope["entries"]):
        _entry(e, f"$.entries[{i}]")
    if not isinstance(envelope["slices"], dict):
        _fail("$.slices", "must be object")
    for name, slc in envelope["slices"].items():
        _slice_status(slc, f"$.slices[{name!r}]")
    for i, err in enumerate(envelope.get("errors", []) or []):
        _error(err, f"$.errors[{i}]")


def validate_health(envelope: Any) -> None:
    """Validate a `health()` response envelope against v1."""
    if not isinstance(envelope, dict):
        _fail("$", "health envelope must be object")
    _require(envelope, "$", "contract_version", "status", "backend_version", "features")
    _no_extras(envelope, "$", "contract_version", "status", "backend_version", "features")
    if envelope["contract_version"] != 1:
        _fail("$.contract_version", f"expected 1, got {envelope['contract_version']!r}")
    if envelope["status"] not in _HEALTH_STATUSES:
        _fail("$.status", f"got {envelope['status']!r}")
    if not isinstance(envelope["backend_version"], str) or not envelope["backend_version"]:
        _fail("$.backend_version", "must be non-empty string")
    feats = envelope["features"]
    if not isinstance(feats, list) or len(feats) != len(set(feats)):
        _fail("$.features", "must be unique string array")
    for i, f in enumerate(feats):
        if not isinstance(f, str) or not f:
            _fail(f"$.features[{i}]", "must be non-empty string")
