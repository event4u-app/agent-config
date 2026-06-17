#!/usr/bin/env python3
"""File-first global knowledge-card layer — store path, config, origin-tier.

Structure-grounding v2 (ADR-100 / road-to-structure-grounding-v2). Promotes
*expensive* (remote) project-local knowledge cards to a per-user, file-first
global store reusable across projects **as leads only**.

This module is the shared spine for every later phase (redaction, promotion,
the command surface, the linter):

  * ``global_store_dir`` — resolve ``~/.event4u/agent-config/knowledge/``
    (the install ``global`` scope), created **lazily**. No index, no daemon,
    no DB, no vector store, no background decay (preserves the 2026-06-14
    Layer-2 sunset's core — see ADR-100).
  * ``load_global_sharing_config`` — read the user-global ``knowledge.global_sharing``
    setting (default ON for the safe tiers), with hard defaults.
  * ``classify_tier`` — origin-tier detection: a card source is ``public``
    (registry / GitHub / docs URL), ``vendor`` (known SaaS API host), or
    ``proprietary`` (in-house DB / private API / repo-relative). Conservative:
    an unknown / hostless source classifies ``proprietary`` (manual-only).

Pure, read-only except ``global_store_dir(create=True)``. Lazy PyYAML import.

Exit codes (CLI): 0 = ok, 1 = bad usage, 3 = internal error.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlsplit

try:  # invocation-agnostic import (repo-root-on-path vs scripts-on-path)
    from scripts._lib import user_global_paths
    from scripts._lib.agent_settings import load_agent_settings
except ModuleNotFoundError:  # pragma: no cover
    # Run directly (``python3 src/scripts/_lib/knowledge_global.py``): put the
    # parent ``scripts`` dir on the path so ``_lib`` imports as a package.
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from _lib import user_global_paths  # type: ignore
    from _lib.agent_settings import load_agent_settings  # type: ignore


# ---------------------------------------------------------------------------
# Tiers
# ---------------------------------------------------------------------------

TIERS: tuple[str, ...] = ("public", "vendor", "proprietary")

#: Default tiers eligible to auto-cross a project boundary under default-on.
#: ``proprietary`` is excluded by design — manual-only regardless of `enabled`.
DEFAULT_ALLOWED_TIERS: tuple[str, ...] = ("public", "vendor")

#: Hard defaults applied when the setting block is absent. Default is ON for
#: the safe tiers; turning sharing on never makes promotion automatic.
DEFAULT_CONFIG: dict[str, Any] = {
    "enabled": True,
    "allowed_tiers": list(DEFAULT_ALLOWED_TIERS),
    "redaction": {"enabled": True, "halt_on_trigger": True},
    "auto_promote_threshold": 2,
    "freshness": {"hypothesis_after_days": 90, "stale_after_days": 180},
}

# Host suffix allowlists — extend as new sources appear. Matched on the
# registrable host suffix so subdomains are covered (e.g. ``foo.npmjs.com``).
_PUBLIC_HOST_SUFFIXES: tuple[str, ...] = (
    "npmjs.com",
    "npmjs.org",
    "registry.npmjs.org",
    "yarnpkg.com",
    "pypi.org",
    "pythonhosted.org",
    "readthedocs.io",
    "readthedocs.org",
    "packagist.org",
    "rubygems.org",
    "crates.io",
    "pkg.go.dev",
    "github.com",
    "raw.githubusercontent.com",
    "githubusercontent.com",
    "gitlab.com",
    "bitbucket.org",
    "developer.mozilla.org",
    "w3.org",
    "ietf.org",
    "json-schema.org",
)

# Known third-party SaaS / vendor API hosts. Their structure is shareable
# **with redaction** (may carry account ids / region hints in examples).
_VENDOR_HOST_SUFFIXES: tuple[str, ...] = (
    "stripe.com",
    "amazonaws.com",
    "googleapis.com",
    "cloud.google.com",
    "azure.com",
    "azure.net",
    "twilio.com",
    "sendgrid.com",
    "slack.com",
    "atlassian.net",
    "atlassian.com",
    "shopify.com",
    "salesforce.com",
    "hubspot.com",
    "openai.com",
    "anthropic.com",
    "cloudflare.com",
    "datadoghq.com",
    "sentry.io",
    "auth0.com",
    "okta.com",
    "plaid.com",
)

# Hosts that always mean a private / in-house surface.
_PROPRIETARY_HOST_MARKERS: tuple[str, ...] = (
    "localhost",
    ".internal",
    ".local",
    ".lan",
    ".intranet",
    ".corp",
    ".test",
)


# ---------------------------------------------------------------------------
# Store path
# ---------------------------------------------------------------------------

def global_store_dir(env: Optional[dict] = None, *, create: bool = False) -> Path:
    """Resolve the file-first global card store.

    ``~/.event4u/agent-config/knowledge/`` (honours ``EVENT4U_CONFIG_HOME``).
    Created **lazily** only when ``create=True`` — no index, no daemon.
    """
    root = user_global_paths.event4u_root(env) / "knowledge"
    if create:
        root.mkdir(parents=True, exist_ok=True)
    return root


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _deep_default_merge(base: dict[str, Any], override: Any) -> dict[str, Any]:
    out = {k: (dict(v) if isinstance(v, dict) else v) for k, v in base.items()}
    if not isinstance(override, dict):
        return out
    for key, val in override.items():
        if isinstance(out.get(key), dict) and isinstance(val, dict):
            out[key] = _deep_default_merge(out[key], val)
        else:
            out[key] = val
    return out


def load_global_sharing_config(
    cwd: Optional[Path] = None, env: Optional[dict] = None
) -> dict[str, Any]:
    """Return the resolved ``knowledge.global_sharing`` config with defaults.

    Reads the full settings cascade (project + user-global whitelist) via
    :func:`load_agent_settings`. Missing block → defaults (sharing ON for the
    safe tiers). Tolerant: any read failure returns the hard defaults.
    """
    try:
        settings = load_agent_settings(cwd=cwd)
    except Exception:  # pragma: no cover — never let a read error gate the agent
        return _deep_default_merge(DEFAULT_CONFIG, {})
    block = (settings or {}).get("knowledge", {})
    block = block.get("global_sharing", {}) if isinstance(block, dict) else {}
    return _deep_default_merge(DEFAULT_CONFIG, block)


def is_enabled(cwd: Optional[Path] = None, env: Optional[dict] = None) -> bool:
    """True when the global-sharing layer is active. ``enabled: false`` no-ops."""
    return bool(load_global_sharing_config(cwd=cwd, env=env).get("enabled", True))


def allowed_tiers(cwd: Optional[Path] = None, env: Optional[dict] = None) -> set[str]:
    """Tiers auto-eligible to cross a boundary. ``proprietary`` is never here —
    it is manual-only regardless of the configured list (the gate hard-codes it)."""
    cfg = load_global_sharing_config(cwd=cwd, env=env)
    tiers = {t for t in cfg.get("allowed_tiers", DEFAULT_ALLOWED_TIERS) if t in TIERS}
    tiers.discard("proprietary")
    return tiers


# ---------------------------------------------------------------------------
# Origin-tier detection
# ---------------------------------------------------------------------------

def _host_of(source: str) -> Optional[str]:
    """Return the lowercased host of a URL source, or None if hostless."""
    s = (source or "").strip()
    if "://" not in s:
        # Bare ``host/path`` or relative file path. Treat a leading
        # ``domain.tld/...`` as a URL-ish host; anything else is hostless.
        head = s.split("/", 1)[0]
        if "." in head and " " not in head and not head.startswith("."):
            return head.lower()
        return None
    host = urlsplit(s).hostname
    return host.lower() if host else None


def _suffix_match(host: str, suffixes: tuple[str, ...]) -> bool:
    return any(host == suf or host.endswith("." + suf) for suf in suffixes)


def classify_tier(source: str) -> str:
    """Classify a card source into ``public`` / ``vendor`` / ``proprietary``.

    * ``public`` — registry / GitHub / canonical-docs host.
    * ``vendor`` — known third-party SaaS API host (shareable with redaction).
    * ``proprietary`` — in-house DB / private API / repo-relative / unknown.

    Conservative: an unknown or hostless source is ``proprietary`` (manual-only),
    so a misclassification never auto-leaks a private surface.
    """
    s = (source or "").strip().lower()
    if not s:
        return "proprietary"

    host = _host_of(source)
    if host is None:
        # No host — repo-relative path, file:, or a bare in-house identifier.
        return "proprietary"

    # Private markers win outright.
    if host == "localhost" or any(
        host == m.lstrip(".") or host.endswith(m) for m in _PROPRIETARY_HOST_MARKERS
    ):
        return "proprietary"
    # Bare IPs (incl. private ranges) are in-house by default.
    if all(part.isdigit() for part in host.split(".") if part) and host.replace(
        ".", ""
    ).isdigit():
        return "proprietary"

    if _suffix_match(host, _VENDOR_HOST_SUFFIXES):
        return "vendor"
    if _suffix_match(host, _PUBLIC_HOST_SUFFIXES):
        return "public"
    # Unknown public-looking host → conservative manual-only.
    return "proprietary"


# ---------------------------------------------------------------------------
# Provenance footer — the audit trail that substitutes for git history
# ---------------------------------------------------------------------------

PROVENANCE_START = "<!-- global-provenance:start -->"
PROVENANCE_END = "<!-- global-provenance:end -->"
_PROVENANCE_FIELDS = ("first_seen", "promoted_at", "last_verified", "tier", "seen_in")


def render_provenance_footer(
    *,
    first_seen_repo: str,
    first_seen_date: str,
    promoted_at: str,
    last_verified: str,
    tier: str,
    seen_in: list[str],
) -> str:
    """Render the global-card provenance footer (the unversioned-store audit trail)."""
    return "\n".join(
        [
            PROVENANCE_START,
            "<!-- This global store is unversioned (ADR-100); this footer is its audit trail. -->",
            f"- first_seen: {first_seen_repo} · {first_seen_date}",
            f"- promoted_at: {promoted_at}",
            f"- last_verified: {last_verified}",
            f"- tier: {tier}",
            f"- seen_in: {', '.join(seen_in)}",
            PROVENANCE_END,
            "",
        ]
    )


def parse_provenance_footer(text: str) -> dict[str, str]:
    """Extract the provenance footer fields as a flat dict (empty if absent)."""
    if PROVENANCE_START not in text or PROVENANCE_END not in text:
        return {}
    block = text.split(PROVENANCE_START, 1)[1].split(PROVENANCE_END, 1)[0]
    out: dict[str, str] = {}
    for line in block.splitlines():
        s = line.strip().lstrip("-").strip()
        if ":" in s:
            key, _, val = s.partition(":")
            key = key.strip()
            if key in _PROVENANCE_FIELDS:
                out[key] = val.strip()
    return out


def strip_provenance_footer(text: str) -> str:
    """Remove the provenance footer block from card text (for `purge`)."""
    if PROVENANCE_START not in text:
        return text
    head = text.split(PROVENANCE_START, 1)[0]
    tail = text.split(PROVENANCE_END, 1)[1] if PROVENANCE_END in text else ""
    return head.rstrip() + ("\n" + tail.lstrip() if tail.strip() else "\n")


# ---------------------------------------------------------------------------
# CLI (used by the command surface + the linter; also handy for debugging)
# ---------------------------------------------------------------------------

def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="cmd")

    p_tier = sub.add_parser("classify", help="Classify a source into a tier.")
    p_tier.add_argument("source", help="URL or path to classify.")

    sub.add_parser("store-path", help="Print the resolved global store path.")
    sub.add_parser("config", help="Print the resolved global_sharing config (JSON).")

    args = parser.parse_args(argv)

    if args.cmd == "classify":
        print(classify_tier(args.source))
        return 0
    if args.cmd == "store-path":
        print(global_store_dir())
        return 0
    if args.cmd == "config":
        import json

        print(json.dumps(load_global_sharing_config(), indent=2, sort_keys=True))
        return 0

    parser.print_help()
    return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
