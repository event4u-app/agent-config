#!/usr/bin/env python3
"""Lint ghostwriter profile sources.

Two storage tiers exist (see docs/contracts/ghostwriter-schema.md):

  * .agent-src.uncompressed/ghostwriter/  — package source. Ships
    fictional fixtures ONLY (`fictional: true`). Every file stem must
    be on scripts/ghostwriter_fixture_allowlist.txt. `aliases:` is
    forbidden here (consumer-only feature).
  * agents/reference/ghostwriter/                    — consumer real-person
    profiles. Gitignored. Must NOT carry `fictional: true`. Optional
    `aliases:` list validated per § Aliases storage rules.

This lint enforces both rules and runs in `task ci`.

Exit codes:
  0  all profiles compliant
  1  one or more violations
"""
from __future__ import annotations

import sys
import unicodedata
from pathlib import Path

import yaml

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[1]
PACKAGE_DIR = REPO / ".agent-src.uncompressed" / "ghostwriter"
CONSUMER_DIR = REPO / "agents" / "ghostwriter"
ALLOWLIST = REPO / "scripts" / "ghostwriter_fixture_allowlist.txt"
EXEMPT_STEMS = frozenset({"README"})

ALIAS_MIN_LEN = 2
# Allowed Unicode blocks for aliases (Latin-only, no homoglyph scripts).
# Basic Latin + Latin-1 Supplement + Latin Extended-A/B cover Müller,
# Łukaszewicz, José, etc., while rejecting Cyrillic / Greek confusables.
ALLOWED_PUNCT = frozenset(" .'-")


def load_allowlist() -> set[str]:
    if not ALLOWLIST.exists():
        return set()
    stems: set[str] = set()
    for line in ALLOWLIST.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        stems.add(s)
    return stems


def parse_frontmatter(text: str) -> dict | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError:
        return None
    return data if isinstance(data, dict) else None


def is_latin_or_allowed(ch: str) -> bool:
    if ch in ALLOWED_PUNCT:
        return True
    if ch.isdigit():
        return True
    code = ord(ch)
    # Basic Latin letters + Latin-1 Supplement letters + Latin Extended-A/B
    if 0x0041 <= code <= 0x024F:
        try:
            return unicodedata.name(ch).startswith("LATIN ")
        except ValueError:
            return False
    return False


def validate_alias(alias: str) -> str | None:
    """Return an error message, or None if the alias is valid."""
    if not isinstance(alias, str):
        return f"alias must be a string, got {type(alias).__name__}"
    if len(alias) < ALIAS_MIN_LEN:
        return f"alias {alias!r} is shorter than {ALIAS_MIN_LEN} characters"
    normalised = unicodedata.normalize("NFC", alias)
    if normalised != alias:
        return f"alias {alias!r} is not Unicode-NFC-normalised"
    bad = [ch for ch in alias if not is_latin_or_allowed(ch)]
    if bad:
        return (
            f"alias {alias!r} contains non-Latin or homoglyph-prone "
            f"character(s): {bad!r}"
        )
    return None


def lint_package_side(allowlist: set[str]) -> list[str]:
    errors: list[str] = []
    if not PACKAGE_DIR.exists():
        return errors
    for path in sorted(PACKAGE_DIR.glob("*.md")):
        stem = path.stem
        if stem in EXEMPT_STEMS:
            continue
        if stem not in allowlist:
            errors.append(
                f"    off-allowlist (package source): {path.relative_to(REPO)} "
                f"— add '{stem}' to scripts/ghostwriter_fixture_allowlist.txt"
            )
            continue
        data = parse_frontmatter(path.read_text(encoding="utf-8"))
        if data is None:
            errors.append(
                f"    unparsable frontmatter (package source): {path.relative_to(REPO)}"
            )
            continue
        if data.get("fictional") is not True:
            errors.append(
                f"    missing 'fictional: true' (package source): {path.relative_to(REPO)} "
                f"(got fictional={data.get('fictional')!r})"
            )
        if "aliases" in data:
            errors.append(
                f"    'aliases:' forbidden on fictional fixtures: {path.relative_to(REPO)} "
                f"— aliases are a consumer-only feature (see schema § Aliases)"
            )
    return errors


def lint_consumer_side() -> list[str]:
    errors: list[str] = []
    if not CONSUMER_DIR.exists():
        return errors
    # Collect (alias_ci, source_path, source_kind) tuples for cross-profile
    # uniqueness check. source_kind is "alias" or "slug".
    seen: dict[str, tuple[Path, str, str]] = {}
    for path in sorted(CONSUMER_DIR.glob("*.md")):
        if path.stem in EXEMPT_STEMS:
            continue
        slug = path.stem
        slug_ci = slug.casefold()
        # Register slug for cross-profile collision detection.
        if slug_ci in seen:
            prev_path, prev_value, prev_kind = seen[slug_ci]
            errors.append(
                f"    duplicate slug across profiles: {path.relative_to(REPO)} "
                f"vs {prev_path.relative_to(REPO)} (case-insensitive)"
            )
        else:
            seen[slug_ci] = (path, slug, "slug")

        data = parse_frontmatter(path.read_text(encoding="utf-8"))
        if data is None:
            continue
        if data.get("fictional") is True:
            errors.append(
                f"    'fictional: true' in consumer tree: {path.relative_to(REPO)} "
                f"— fictional fixtures belong in .agent-src.uncompressed/ghostwriter/"
            )

        aliases = data.get("aliases")
        if aliases is None:
            continue
        if not isinstance(aliases, list):
            errors.append(
                f"    'aliases' must be a YAML list: {path.relative_to(REPO)} "
                f"(got {type(aliases).__name__})"
            )
            continue

        within_profile: set[str] = set()
        for alias in aliases:
            err = validate_alias(alias)
            if err:
                errors.append(f"    {path.relative_to(REPO)}: {err}")
                continue
            alias_ci = alias.casefold()
            if alias_ci in within_profile:
                errors.append(
                    f"    {path.relative_to(REPO)}: duplicate alias "
                    f"{alias!r} within the same profile (case-insensitive)"
                )
                continue
            within_profile.add(alias_ci)
            if alias_ci in seen:
                prev_path, prev_value, prev_kind = seen[alias_ci]
                errors.append(
                    f"    alias collision: {path.relative_to(REPO)} alias "
                    f"{alias!r} collides with {prev_kind} {prev_value!r} in "
                    f"{prev_path.relative_to(REPO)} (case-insensitive)"
                )
                continue
            seen[alias_ci] = (path, alias, "alias")
    return errors


def main() -> int:
    allowlist = load_allowlist()
    pkg_errors = lint_package_side(allowlist)
    cons_errors = lint_consumer_side()
    errors = pkg_errors + cons_errors

    if errors:
        print(
            f"❌  lint_ghostwriter_source: {len(errors)} violation(s)",
            file=sys.stderr,
        )
        for line in errors:
            print(line, file=sys.stderr)
        print(
            "    see docs/contracts/ghostwriter-schema.md § Lint enforcement",
            file=sys.stderr,
        )
        return 1

    if not QUIET:
        pkg_count = (
            sum(1 for p in PACKAGE_DIR.glob("*.md") if p.stem not in EXEMPT_STEMS)
            if PACKAGE_DIR.exists()
            else 0
        )
        cons_count = (
            sum(1 for p in CONSUMER_DIR.glob("*.md") if p.stem not in EXEMPT_STEMS)
            if CONSUMER_DIR.exists()
            else 0
        )
        print(
            f"✅  lint_ghostwriter_source: {pkg_count} package fixture(s), "
            f"{cons_count} consumer profile(s), all compliant"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

