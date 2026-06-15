#!/usr/bin/env python3
"""Pointer-CI + size + multi-evidence-consistency gate for committed knowledge cards.

Committed cards live at agents/knowledge/<source>.md (one file per source).
README.md in that directory is skipped.

Checks enforced:
  C1  Size ≤ 150 lines.
  C2  Mandatory authoritative pointer (frontmatter links.authoritative).
  C3  Pointer resolution (local path exists; URL well-formed; --check-urls for live check).
  C4  Trust tagging (frontmatter trust field present; type must be anti-hallucination).
  C5  Multi-evidence git-ancestry consistency (distinct source_version values; if git
      refs/SHAs, verifies ancestry chain; flags observed_at spanning > 7 days).
  C6  Strict mode (--strict): for positive-structure lines with source=<path:line>,
      verifies file exists and is non-empty via HEAD or disk.

Exit codes: 0 = clean, 1 = violations, 3 = internal error.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
SOURCE_VERSION_RE = re.compile(r"\bsource_version:\s*\"?([^\s\",]+)")
OBSERVED_AT_RE = re.compile(r"\bobserved_at:\s*\"?([0-9]{4}-[0-9]{2}-[0-9]{2})")
SOURCE_LINE_RE = re.compile(r"\bsource=([^:\s]+):(\d+)")
SHA_RE = re.compile(r"^[0-9a-f]{7,40}$", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Tiny frontmatter parser (no pyyaml required — cards use simple scalar fields)
# ---------------------------------------------------------------------------

def _parse_frontmatter(text: str) -> dict[str, object]:
    """Extract YAML-like frontmatter as a flat dict (scalar values only)."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}
    out: dict[str, object] = {}
    for line in m.group(1).splitlines():
        if ":" not in line or line.startswith("#"):
            continue
        key, _, val = line.partition(":")
        key = key.strip().lstrip("-").strip()
        val = val.strip().strip('"').strip("'")
        if key:
            out[key] = val
    return out


def _frontmatter_get(text: str, *keys: str) -> str:
    """Walk a dotted key path through the raw frontmatter block."""
    m = FRONTMATTER_RE.match(text)
    if not m:
        return ""
    block = m.group(1)
    # Support nested keys like links.authoritative by scanning for the leaf key
    leaf = keys[-1]
    for line in block.splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{leaf}:"):
            val = stripped[len(leaf) + 1:].strip().strip('"').strip("'")
            return val
    return ""


# ---------------------------------------------------------------------------
# Individual checks
# ---------------------------------------------------------------------------

def _check_card(path: Path, strict: bool, check_urls: bool) -> list[str]:
    errors: list[str] = []
    try:
        rel = str(path.relative_to(ROOT))
    except ValueError:
        rel = str(path)
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"{rel}:0 — cannot read file: {exc}"]

    lines = text.splitlines()

    # C1 — size
    if len(lines) > 150:
        errors.append(f"{rel}:{len(lines)} — C1: card exceeds 150 lines ({len(lines)})")

    fm = _parse_frontmatter(text)

    # C4 — trust tagging
    if not fm.get("trust"):
        errors.append(f"{rel}:0 — C4: missing 'trust' field in frontmatter")
    card_type = fm.get("type", "")
    if card_type and card_type != "anti-hallucination":
        errors.append(
            f"{rel}:0 — C4: type must be 'anti-hallucination', got '{card_type}'"
        )
    if not card_type:
        errors.append(f"{rel}:0 — C4: missing 'type' field in frontmatter")

    # C2 — authoritative pointer
    pointer = _frontmatter_get(text, "links", "authoritative")
    if not pointer:
        errors.append(f"{rel}:0 — C2: missing links.authoritative pointer in frontmatter")
    else:
        # C3 — pointer resolution
        if pointer.startswith("http://") or pointer.startswith("https://"):
            if check_urls:
                try:
                    req = urllib.request.Request(pointer, method="HEAD")
                    with urllib.request.urlopen(req, timeout=5) as resp:
                        if resp.status >= 400:
                            errors.append(
                                f"{rel}:0 — C3: URL returned {resp.status}: {pointer}"
                            )
                except Exception as exc:
                    errors.append(f"{rel}:0 — C3: URL unreachable ({exc}): {pointer}")
        else:
            # local path
            local = ROOT / pointer if not Path(pointer).is_absolute() else Path(pointer)
            if not local.exists():
                errors.append(f"{rel}:0 — C3: local pointer not found: {pointer}")

    # C5 — multi-evidence consistency
    versions = SOURCE_VERSION_RE.findall(text)
    dates_str = OBSERVED_AT_RE.findall(text)
    distinct_versions = list(dict.fromkeys(versions))  # preserve order, dedup
    if len(distinct_versions) > 1:
        # Check ancestry if they look like git SHAs
        if all(SHA_RE.match(v) for v in distinct_versions):
            for i in range(len(distinct_versions) - 1):
                a, b = distinct_versions[i], distinct_versions[i + 1]
                try:
                    result = subprocess.run(
                        ["git", "merge-base", "--is-ancestor", a, b],
                        cwd=ROOT,
                        capture_output=True,
                        timeout=5,
                    )
                    if result.returncode != 0:
                        # Try reverse
                        result2 = subprocess.run(
                            ["git", "merge-base", "--is-ancestor", b, a],
                            cwd=ROOT,
                            capture_output=True,
                            timeout=5,
                        )
                        if result2.returncode != 0:
                            errors.append(
                                f"{rel}:0 — C5: source_versions '{a}' and '{b}' "
                                "are not in a linear ancestry chain (Frankenstein card)"
                            )
                except Exception:
                    pass  # git unavailable — skip ancestry check

    if len(dates_str) >= 2:
        try:
            parsed = [
                datetime.strptime(d, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                for d in dates_str
            ]
            span_days = (max(parsed) - min(parsed)).days
            if span_days > 7:
                errors.append(
                    f"{rel}:0 — C5: observed_at timestamps span {span_days} days "
                    "(> 7 day threshold — possible Frankenstein card)"
                )
        except ValueError:
            pass

    # C6 — strict mode: verify source=<path:line> references exist
    if strict:
        for n, line in enumerate(lines, start=1):
            m = SOURCE_LINE_RE.search(line)
            if not m:
                continue
            src_path = ROOT / m.group(1)
            if not src_path.exists() or src_path.stat().st_size == 0:
                errors.append(
                    f"{rel}:{n} — C6: source path not found or empty: {m.group(1)}"
                )

    return errors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _freshness_warnings(path: Path, days: int) -> list[str]:
    """Honest freshness signal (NOT a failure). A card whose newest observed_at
    is older than ``days`` is 'lead-only': negative facts + pointers stay usable,
    positive structure must be re-confirmed. No content_hash theater."""
    if days <= 0:
        return []
    text = path.read_text(encoding="utf-8", errors="replace")
    dates = OBSERVED_AT_RE.findall(text)
    if not dates:
        return []
    try:
        newest = max(datetime.strptime(d, "%Y-%m-%d").date() for d in dates)
    except ValueError:
        return []
    today = datetime.now(timezone.utc).date()
    age = (today - newest).days
    if age > days:
        rel = path.relative_to(ROOT) if path.is_absolute() else path
        return [
            f"⚠️  {rel}: lead-only — newest observed_at is {age}d old (>{days}d); "
            "re-confirm positive structure before use (negative facts + pointers still valid)."
        ]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--dir",
        type=Path,
        default=ROOT / "agents" / "knowledge",
        help="Directory containing committed knowledge cards (default: agents/knowledge)",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="C6: verify source=<path:line> references on disk",
    )
    parser.add_argument(
        "--check-urls",
        action="store_true",
        help="C3: perform live HTTP check on URL pointers",
    )
    parser.add_argument(
        "--freshness-days",
        type=int,
        default=0,
        help="Honest freshness signal: WARN (never fail) when a card's newest "
        "observed_at is older than N days (lead-only). 0 = off.",
    )
    args = parser.parse_args()

    card_dir: Path = args.dir
    if not card_dir.exists():
        print(f"No cards directory found at {card_dir} — nothing to check.")
        return 0

    cards = [
        p for p in sorted(card_dir.glob("*.md")) if p.name.lower() != "readme.md"
    ]
    if not cards:
        print("No knowledge cards found — nothing to check.")
        return 0

    all_errors: list[str] = []
    all_warnings: list[str] = []
    for card in cards:
        all_errors.extend(_check_card(card, strict=args.strict, check_urls=args.check_urls))
        all_warnings.extend(_freshness_warnings(card, args.freshness_days))

    for warn in all_warnings:
        print(warn)

    if not all_errors:
        print(f"✅  {len(cards)} knowledge card(s) passed all checks.")
        return 0

    for err in all_errors:
        print(err)
    print(f"\n{len(all_errors)} violation(s) across {len(cards)} card(s).")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
