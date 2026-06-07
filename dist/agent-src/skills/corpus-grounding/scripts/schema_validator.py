#!/usr/bin/env python3
"""corpus-grounding · schema_validator — manifest contract (interface v1).

Validates a domain's plug-in manifest (`manifest.json`) against the
schema-agnostic contract from ADR-061 §3. Each domain declares its OWN
axes — the validator checks structure + provenance discipline, never a
uniform schema.

Pure stdlib, no network. Interface contract: SKILL.md § Interface contract.
"""

from __future__ import annotations

import json
from pathlib import Path

MANIFEST_VERSION = 1

#: Output sophistication tiers (ADR-061 §3).
TIERS = ("lookup-only", "conditional-grounding", "constraint-emission")

_REQUIRED_TOP = ("manifest_version", "domain", "tier", "domains")
_REQUIRED_PROVENANCE = ("owner", "refresh_cadence", "upstream")
_REQUIRED_DOMAIN_KEYS = ("file", "search_cols", "output_cols")
_REQUIRED_REASONING_KEYS = ("file", "match_column", "plan")


class ManifestError(ValueError):
    """Raised when a manifest violates the v1 contract."""


def load_manifest(path: Path) -> dict:
    """Load + validate a manifest. Raises ManifestError on violation."""
    if not path.exists():
        raise ManifestError(f"Manifest not found: {path}")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ManifestError(f"Manifest is not valid JSON: {path}: {exc}") from exc
    errors = validate_manifest(data)
    if errors:
        raise ManifestError(
            f"Manifest contract violations in {path}:\n  - " + "\n  - ".join(errors)
        )
    data["_manifest_dir"] = str(path.resolve().parent)
    return data


def validate_manifest(data: object) -> list[str]:
    """Return a list of contract violations (empty = valid)."""
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["manifest must be a JSON object"]

    for key in _REQUIRED_TOP:
        if key not in data:
            errors.append(f"missing required key: {key!r}")
    if errors:
        return errors

    if data["manifest_version"] != MANIFEST_VERSION:
        errors.append(
            f"manifest_version {data['manifest_version']!r} unsupported "
            f"(engine speaks v{MANIFEST_VERSION})"
        )
    if data["tier"] not in TIERS:
        errors.append(f"tier {data['tier']!r} not in {TIERS}")

    domains = data.get("domains")
    if not isinstance(domains, dict) or not domains:
        errors.append("domains must be a non-empty object")
    else:
        for name, cfg in domains.items():
            if not isinstance(cfg, dict):
                errors.append(f"domains.{name} must be an object")
                continue
            for key in _REQUIRED_DOMAIN_KEYS:
                if key not in cfg:
                    errors.append(f"domains.{name} missing {key!r}")
            for key in ("search_cols", "output_cols"):
                if key in cfg and (
                    not isinstance(cfg[key], list) or not cfg[key]
                ):
                    errors.append(f"domains.{name}.{key} must be a non-empty list")

    default_domain = data.get("default_domain")
    if default_domain and isinstance(domains, dict) and default_domain not in domains:
        errors.append(f"default_domain {default_domain!r} not in domains")

    detect = data.get("detect")
    if detect is not None:
        if not isinstance(detect, dict):
            errors.append("detect must be an object of domain → keyword list")
        elif isinstance(domains, dict):
            for name, kws in detect.items():
                if name not in domains and name != "_stack":
                    errors.append(f"detect.{name} references unknown domain")
                if not isinstance(kws, list):
                    errors.append(f"detect.{name} must be a list of keywords")

    reasoning = data.get("reasoning")
    if reasoning is not None:
        if data.get("tier") == "lookup-only":
            errors.append("reasoning block present but tier is lookup-only")
        if not isinstance(reasoning, dict):
            errors.append("reasoning must be an object")
        else:
            for key in _REQUIRED_REASONING_KEYS:
                if key not in reasoning:
                    errors.append(f"reasoning missing {key!r}")
            plan = reasoning.get("plan")
            if plan is not None:
                if not isinstance(plan, dict):
                    errors.append("reasoning.plan must be an object of domain → max_results")
                elif isinstance(domains, dict):
                    for name in plan:
                        if name not in domains:
                            errors.append(f"reasoning.plan.{name} references unknown domain")

    stacks = data.get("stacks")
    if stacks is not None:
        if not isinstance(stacks, dict):
            errors.append("stacks must be an object of stack-id → csv path")
        elif "stack_cols" not in data:
            errors.append("stacks present but stack_cols missing")

    # Provenance discipline (ADR-061 §6) — a corpus without an owner rots.
    for key in _REQUIRED_PROVENANCE:
        if key not in data:
            errors.append(f"missing provenance key: {key!r} (ADR-061 §6)")
    upstream = data.get("upstream")
    if isinstance(upstream, dict):
        for key in ("repo", "sha", "last_checked"):
            if key not in upstream:
                errors.append(f"upstream missing {key!r}")
    elif upstream is not None:
        errors.append("upstream must be an object {repo, sha, last_checked}")

    retriever = data.get("retriever")
    if retriever is not None and retriever not in ("bm25", "structured", "hybrid"):
        errors.append(f"retriever {retriever!r} unknown")

    return errors


def resolve_data_path(manifest: dict, relative: str) -> Path:
    """Resolve a corpus file path relative to the manifest's directory.

    Refuses absolute paths and parent-escapes — corpus files live beside
    their manifest by contract (runtime-safety: read-only, local).
    """
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts:
        raise ManifestError(f"corpus path must be manifest-relative: {relative!r}")
    base = Path(manifest.get("_manifest_dir", "."))
    data_dir = manifest.get("data_dir", ".")
    dd = Path(data_dir)
    if dd.is_absolute() or ".." in dd.parts:
        raise ManifestError(f"data_dir must be manifest-relative: {data_dir!r}")
    return (base / dd / rel).resolve()
