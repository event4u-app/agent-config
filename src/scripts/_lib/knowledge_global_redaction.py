#!/usr/bin/env python3
"""Write-time redaction + tier gate for global knowledge-card sharing.

Structure-grounding v2, Phase 1 — the privacy crux (ADR-100 /
road-to-structure-grounding-v2). Before any project-local card may cross a
project boundary into the file-first global store, it passes this gate:

  1. **Tier gate.** ``public`` / ``vendor`` are auto-eligible under default-on;
     ``proprietary`` (in-house DB / private API / client schemas) is
     **manual-only regardless of `enabled`** — the gate hard-codes it, so no
     client-A schema ever auto-leaks into client-B's session. A per-project
     ``share-blocklist`` opts individual sources out.
  2. **Redaction.** Runs the ``low-impact-corpus-privacy-floor`` pattern set
     (secrets, emails, project paths, internal hostnames, money, blocklisted
     field/table identifiers, long code) **plus** the ``source-confidentiality``
     external-source denylist. On any hit it **halts and surfaces** — never
     silent-shares, never auto-rewrites (a soft rewrite would be a soft gate).

The gate is a deterministic backstop the agent-in-the-loop promotion flow calls
before writing a global card; the Phase-4 linter re-runs the redaction scan on
committed global cards as the CI net.

Pure, read-only. Exit codes (CLI): 0 = eligible/clean, 1 = blocked, 3 = error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

try:  # invocation-agnostic import
    from scripts.ai_council.redact_low_impact_entry import (
        RedactionViolation,
        redact_low_impact_entry,
    )
except ModuleNotFoundError:  # pragma: no cover
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
    from scripts.ai_council.redact_low_impact_entry import (  # type: ignore
        RedactionViolation,
        redact_low_impact_entry,
    )

_ROOT = Path(__file__).resolve().parent.parent.parent
_DENYLIST_PATH = _ROOT / "scripts" / "external_sources_denylist.json"
# Per-project opt-out list — one source/card-name per line, ``#`` comments.
SHARE_BLOCKLIST_REL = Path("agents") / "knowledge" / ".share-blocklist"


@dataclass(frozen=True)
class GateResult:
    """Outcome of the global-share gate for one card."""

    eligible: bool
    reason: str
    tier: str = ""
    manual_only: bool = False
    violations: tuple[RedactionViolation, ...] = ()

    def summary(self) -> str:
        head = "eligible" if self.eligible else "BLOCKED"
        parts = [f"{v.category}: {v.snippet!r}" for v in self.violations]
        tail = (" — " + "; ".join(parts)) if parts else ""
        return f"global-share {head} (tier={self.tier or '?'}): {self.reason}{tail}"


# ---------------------------------------------------------------------------
# Redaction scan (privacy floor + source-confidentiality)
# ---------------------------------------------------------------------------

def _load_denylist_patterns() -> list[re.Pattern[str]]:
    """External-source denylist regexes (source-confidentiality). Tolerant."""
    try:
        cfg = json.loads(_DENYLIST_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):  # pragma: no cover — missing denylist
        return []
    out: list[re.Pattern[str]] = []
    for raw in cfg.get("deny", []):
        try:
            out.append(re.compile(raw, re.IGNORECASE))
        except re.error:  # pragma: no cover
            continue
    return out


def redaction_scan(
    text: str,
    *,
    repo_root: Optional[str] = None,
    private_domains: tuple[str, ...] = (),
    customer_names: tuple[str, ...] = (),
    sql_identifiers: tuple[str, ...] = (),
) -> list[RedactionViolation]:
    """Combined privacy-floor + source-confidentiality scan over ``text``.

    Returns the list of violations (empty = clean). Reused by the Phase-4
    linter as the CI net that redaction actually fired on committed cards.
    """
    floor = redact_low_impact_entry(
        text,
        repo_root=repo_root,
        private_domains=private_domains,
        customer_names=customer_names,
        sql_identifiers=sql_identifiers,
    )
    violations: list[RedactionViolation] = list(floor.violations)
    for rx in _load_denylist_patterns():
        m = rx.search(text)
        if m:
            violations.append(
                RedactionViolation(
                    "external_source", m.group(0)[:40], "source-confidentiality denylist"
                )
            )
    return violations


# ---------------------------------------------------------------------------
# Share-blocklist
# ---------------------------------------------------------------------------

def load_share_blocklist(project_root: Path) -> set[str]:
    """Per-project opt-out: sources/card-names that must never go global."""
    path = project_root / SHARE_BLOCKLIST_REL
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return set()
    out: set[str] = set()
    for line in lines:
        s = line.strip()
        if s and not s.startswith("#"):
            out.add(s)
    return out


def _is_blocklisted(source: str, card_name: str, blocklist: set[str]) -> bool:
    if not blocklist:
        return False
    return source in blocklist or card_name in blocklist or any(
        b and (b in source or b == card_name) for b in blocklist
    )


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------

def gate_card_for_global(
    text: str,
    *,
    tier: str,
    source: str = "",
    card_name: str = "",
    allowed_tiers: tuple[str, ...] = ("public", "vendor"),
    redaction_enabled: bool = True,
    halt_on_trigger: bool = True,
    blocklist: Optional[set[str]] = None,
    repo_root: Optional[str] = None,
    private_domains: tuple[str, ...] = (),
    customer_names: tuple[str, ...] = (),
    sql_identifiers: tuple[str, ...] = (),
) -> GateResult:
    """Decide whether a card may cross a project boundary into the global store.

    Order: blocklist → tier gate (proprietary is always manual-only) →
    redaction (halt-and-surface on any hit). Auto-eligibility is the default-on
    path; proprietary returns ``manual_only=True`` so a deliberate manual
    promotion can still proceed past the auto gate with explicit operator intent.
    """
    blocklist = blocklist or set()

    if _is_blocklisted(source, card_name, blocklist):
        return GateResult(False, "source opted out via share-blocklist", tier=tier)

    if tier == "proprietary":
        return GateResult(
            False,
            "proprietary tier — manual-only, never auto-shared (default-off regardless of enabled)",
            tier=tier,
            manual_only=True,
        )
    if tier not in allowed_tiers:
        return GateResult(
            False, f"tier '{tier}' not in allowed_tiers {sorted(allowed_tiers)}", tier=tier
        )

    if redaction_enabled:
        violations = redaction_scan(
            text,
            repo_root=repo_root,
            private_domains=private_domains,
            customer_names=customer_names,
            sql_identifiers=sql_identifiers,
        )
        if violations and halt_on_trigger:
            return GateResult(
                False,
                "redaction halt — confidential pattern(s) found; rephrase or redact before sharing",
                tier=tier,
                violations=tuple(violations),
            )

    return GateResult(True, "passed tier gate + redaction", tier=tier)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("card", type=Path, help="Path to the card file to gate.")
    parser.add_argument("--tier", required=True, choices=("public", "vendor", "proprietary"))
    parser.add_argument("--source", default="", help="Card source URL/path.")
    args = parser.parse_args(argv)

    try:
        text = args.card.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"cannot read {args.card}: {exc}", file=sys.stderr)
        return 3

    result = gate_card_for_global(
        text, tier=args.tier, source=args.source, card_name=args.card.name
    )
    print(result.summary())
    return 0 if result.eligible else 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
